(function (root, factory) {
  "use strict";

  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (!root || !root.document || root.OORxCartHandoff) return;
  root.OORxCartHandoff = api;
  api.install(root);
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  // Durable Rx handoff in the cart (order #336589).
  //
  // A confirmed Rx config travels on its mask's cart line as the hidden
  // properties _oo_rx_config, _oo_rx_handoff (a per-mask slot UUID) and
  // _oo_source. Avis "Edit options" (cart page and mini cart) saves through
  // /cart/change.js with only its own option properties, and Shopify replaces
  // the whole property set, so every OO property disappeared from the line.
  //
  // This script, loaded on every storefront page before the apps:
  //  1. Line guard: a property-replacing /cart/change request for a line that
  //     carries a config gets that same line's OO properties back (the line is
  //     identified by the request's own cart key / line number; never by lens
  //     values). Properties the request already sets are never overridden.
  //  2. Cart fallback: the cart attribute _oo_rx_handoffs records, per slot
  //     UUID, the config, source, product and variant of the line that carried
  //     it. It reaches the Shopify order as a note attribute, so OO-Orders can
  //     still resolve a mask whose line properties were lost, deterministically
  //     and only when exactly one slot fits (see OO-Orders lib/cartRxHandoffs).
  //  3. Independent add record (order #336633): the product handoff tells this
  //     script, at submit time, which slot / config / product / variant it is
  //     adding (expectAdd). The matching /cart/add request (same slot, or the
  //     same variant within a minute) is followed to its successful response
  //     and its slot is written to _oo_rx_handoffs straight from that
  //     expectation, so the cart fallback no longer depends on Shopify having
  //     kept the line properties. Until a cart read shows the slot in the map
  //     it is kept in sessionStorage and retried on every page; if neither the
  //     line nor the map holds the config after the retries, the page is told
  //     (event "oo:rx-handoff:unsaved") instead of continuing silently.
  // Only opaque ids, tool names and Shopify product/variant ids are stored:
  // never prescription values, labels, files or URLs.

  var CONFIG_PROPERTY = "_oo_rx_config";
  var HANDOFF_PROPERTY = "_oo_rx_handoff";
  var SOURCE_PROPERTY = "_oo_source";
  var LABEL_PROPERTY = "Prescription";
  var ATTRIBUTE = "_oo_rx_handoffs";
  var MAP_VERSION = 1;
  var MAX_ENTRIES = 12;
  var READY_TIMEOUT_MS = 2500;
  var REFRESH_DELAY_MS = 400;
  var UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  var SOURCES = ["lens_calculator_v53", "product_rx_checker", "quiz_v53"];
  var INSTALLED = "__ooRxCartHandoffInstalled";
  // Per tab: confirmed cart adds whose slot is not yet seen in the cart map.
  var PENDING_STORAGE_KEY = "oo_rx_cart_pending";
  var PENDING_TTL_MS = 24 * 60 * 60 * 1000;
  var EXPECT_TTL_MS = 60 * 1000;
  var VERIFY_ATTEMPTS = 3;
  var UNSAVED_EVENT = "oo:rx-handoff:unsaved";

  function isUuid(value) {
    return typeof value === "string" && UUID_PATTERN.test(value.trim());
  }

  function hex(bytes) {
    return Array.prototype.map.call(bytes, function (byte) {
      return (byte + 256).toString(16).slice(1);
    }).join("");
  }

  // A random v4 UUID (lower case).
  function newHandoffId(view) {
    var cryptoApi = (view && view.crypto) || (typeof crypto !== "undefined" ? crypto : null);
    if (cryptoApi && typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID().toLowerCase();
    var bytes = new Uint8Array(16);
    if (cryptoApi && typeof cryptoApi.getRandomValues === "function") cryptoApi.getRandomValues(bytes);
    else for (var i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    var text = hex(bytes);
    return [text.slice(0, 8), text.slice(8, 12), text.slice(12, 16), text.slice(16, 20), text.slice(20)].join("-");
  }

  function isKeptName(name) {
    return /^_oo_/.test(name) || name === LABEL_PROPERTY;
  }

  // The OO properties of a cart line that carries a valid config, or null.
  function durableProperties(item) {
    var properties = item && item.properties && typeof item.properties === "object" ? item.properties : null;
    if (!properties || !isUuid(properties[CONFIG_PROPERTY])) return null;
    var kept = {};
    Object.keys(properties).forEach(function (name) {
      var value = properties[name];
      if (isKeptName(name) && typeof value === "string" && value.trim()) kept[name] = value;
    });
    return kept;
  }

  // --- cart-level handoff map ------------------------------------------------

  function cleanEntry(entry) {
    if (!entry || typeof entry !== "object") return null;
    var handoff = String(entry.h || "").trim().toLowerCase();
    var config = String(entry.c || "").trim().toLowerCase();
    if (!isUuid(handoff) || !isUuid(config)) return null;
    var clean = { h: handoff, c: config };
    if (SOURCES.indexOf(entry.s) >= 0) clean.s = entry.s;
    if (/^\d{1,20}$/.test(String(entry.p || ""))) clean.p = String(entry.p);
    if (/^\d{1,20}$/.test(String(entry.v || ""))) clean.v = String(entry.v);
    return clean;
  }

  function parseMap(text) {
    if (typeof text !== "string" || !text.trim()) return [];
    try {
      var data = JSON.parse(text);
      if (!data || data.v !== MAP_VERSION || !Array.isArray(data.h)) return [];
      var seen = {};
      return data.h.map(cleanEntry).filter(function (entry) {
        if (!entry || seen[entry.h]) return false;
        seen[entry.h] = true;
        return true;
      });
    } catch (error) {
      return [];
    }
  }

  function serializeMap(entries) {
    return entries.length ? JSON.stringify({ v: MAP_VERSION, h: entries }) : "";
  }

  function cartItems(cart) {
    return cart && Array.isArray(cart.items) ? cart.items : [];
  }

  // The map that matches this cart: every line carrying a config + slot is
  // recorded (the line is the authority for its own slot), and a slot whose
  // product is no longer in the cart at all is dropped. A slot whose product
  // is still in the cart is kept even when that line lost its properties:
  // that is exactly the case the fallback exists for.
  // pending: slots from confirmed add operations (see expectAdd). One is
  // added when the map does not have its slot yet; a line carrying the same
  // slot still wins, so both paths always agree.
  function reconcileEntries(entries, cart, pending) {
    var next = entries.map(function (entry) { return Object.assign({}, entry); });
    (Array.isArray(pending) ? pending : []).forEach(function (record) {
      var entry = cleanEntry(record);
      if (!entry || next.some(function (existing) { return existing.h === entry.h; })) return;
      if (!entry.p && entry.v) {
        var line = cartItems(cart).find(function (item) { return String(item.variant_id) === entry.v; });
        if (line && /^\d{1,20}$/.test(String(line.product_id || ""))) entry.p = String(line.product_id);
      }
      if (entry.p) next.push(entry);
    });
    cartItems(cart).forEach(function (item) {
      var kept = durableProperties(item);
      if (!kept || !isUuid(kept[HANDOFF_PROPERTY])) return;
      var entry = cleanEntry({
        h: kept[HANDOFF_PROPERTY],
        c: kept[CONFIG_PROPERTY],
        s: kept[SOURCE_PROPERTY],
        p: item.product_id,
        v: item.variant_id
      });
      if (!entry) return;
      var index = next.findIndex(function (existing) { return existing.h === entry.h; });
      if (index >= 0) next[index] = entry;
      else next.push(entry);
    });
    var products = cartItems(cart).map(function (item) { return String(item.product_id); });
    next = next.filter(function (entry) { return !entry.p || products.indexOf(entry.p) >= 0; });
    next = next.slice(-MAX_ENTRIES);
    return next;
  }

  function cartMap(cart) {
    var attributes = cart && cart.attributes && typeof cart.attributes === "object" ? cart.attributes : {};
    return parseMap(attributes[ATTRIBUTE]);
  }

  // --- request bodies -----------------------------------------------------------

  function isFormData(body) {
    return body && typeof body.append === "function" && typeof body.getAll === "function" && typeof body.has === "function" && typeof body.entries === "function";
  }

  function isSearchParams(body) {
    return typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams;
  }

  // A readable/extendable view of a cart request body, or null.
  function bodyAdapter(body) {
    if (isFormData(body) || isSearchParams(body)) {
      return {
        get: function (name) { var value = body.get(name); return typeof value === "string" ? value : null; },
        names: function () { var names = []; body.forEach(function (value, name) { names.push(name); }); return names; },
        setProperty: function (name, value) { body.append("properties[" + name + "]", value); },
        replacesProperties: function () { return this.names().some(function (name) { return /^properties\[/.test(name); }); },
        hasProperty: function (name) { return body.has("properties[" + name + "]"); },
        body: function () { return body; }
      };
    }
    if (typeof body !== "string" || !body.trim()) return null;
    var text = body.trim();
    if (text.charAt(0) === "{") {
      var data;
      try { data = JSON.parse(text); } catch (error) { return null; }
      if (!data || typeof data !== "object") return null;
      return {
        get: function (name) { return data[name] === undefined || data[name] === null ? null : String(data[name]); },
        names: function () { return Object.keys(data); },
        setProperty: function (name, value) { data.properties[name] = value; },
        replacesProperties: function () { return Boolean(data.properties && typeof data.properties === "object"); },
        hasProperty: function (name) { return Object.prototype.hasOwnProperty.call(data.properties || {}, name); },
        body: function () { return JSON.stringify(data); }
      };
    }
    var params = new URLSearchParams(text);
    var adapter = bodyAdapter(params);
    var toBody = adapter.body;
    adapter.body = function () { return toBody().toString(); };
    return adapter;
  }

  function isCartPath(view, url, pattern) {
    try {
      var parsed = new (view.URL || URL)(String(url), view.location.href);
      return parsed.origin === view.location.origin && pattern.test(parsed.pathname.replace(/^\/[a-z]{2}(?:-[a-z]{2})?(?=\/cart)/i, ""));
    } catch (error) {
      return false;
    }
  }

  var CHANGE_PATH = /^\/cart\/change(?:\.js)?$/;
  var ADD_PATH = /^\/cart\/add(?:\.js)?$/;
  var MUTATION_PATH = /^\/cart\/(?:add|change|update|clear)(?:\.js)?$/;

  function optionalText(value) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  // The lines a /cart/add request adds: the variant id and the OO slot /
  // config / source the request itself carries (null when it carries none).
  // FormData / urlencoded: one line; JSON: `id`, or each entry of `items`.
  function addRequestItems(body) {
    var items = [];
    if (typeof body === "string" && body.trim().charAt(0) === "{") {
      var data;
      try { data = JSON.parse(body); } catch (error) { return []; }
      var list = data && Array.isArray(data.items) ? data.items : (data && data.id !== undefined ? [data] : []);
      items = list.map(function (item) {
        var properties = item && item.properties && typeof item.properties === "object" ? item.properties : {};
        return {
          v: String(item && item.id !== undefined && item.id !== null ? item.id : "").trim(),
          h: optionalText(properties[HANDOFF_PROPERTY]),
          c: optionalText(properties[CONFIG_PROPERTY]),
          s: optionalText(properties[SOURCE_PROPERTY])
        };
      });
    } else {
      var adapter = bodyAdapter(body);
      if (!adapter) return [];
      items = [{
        v: String(adapter.get("id") || "").trim(),
        h: optionalText(adapter.get("properties[" + HANDOFF_PROPERTY + "]")),
        c: optionalText(adapter.get("properties[" + CONFIG_PROPERTY + "]")),
        s: optionalText(adapter.get("properties[" + SOURCE_PROPERTY + "]"))
      }];
    }
    return items.filter(function (item) { return /^\d{1,20}$/.test(item.v); });
  }

  // The cart line a /cart/change request targets: `id` is a line key
  // ("variant:hash") or a variant id (Shopify: the first line of that
  // variant); `line` is the 1-based position.
  function targetLine(cart, adapter) {
    var items = cartItems(cart);
    var line = Number(adapter.get("line"));
    if (Number.isInteger(line) && line >= 1 && line <= items.length) return items[line - 1];
    var id = String(adapter.get("id") || "").trim();
    if (!id) return null;
    if (id.indexOf(":") >= 0) return items.find(function (item) { return item.key === id; }) || null;
    return items.find(function (item) { return String(item.variant_id) === id; }) || null;
  }

  // Adds the target line's own OO properties to a property-replacing change
  // request when the request leaves them out. Returns the (possibly new) body
  // and what was restored.
  function guardChangeBody(cart, body) {
    var adapter = bodyAdapter(body);
    if (!adapter || !adapter.replacesProperties()) return { body: body, restored: [] };
    if (adapter.get("quantity") === "0") return { body: body, restored: [] };
    var item = targetLine(cart, adapter);
    var kept = durableProperties(item);
    if (!kept) return { body: body, restored: [] };
    var restored = Object.keys(kept).filter(function (name) { return !adapter.hasProperty(name); });
    restored.forEach(function (name) { adapter.setProperty(name, kept[name]); });
    return { body: restored.length ? adapter.body() : body, restored: restored };
  }

  // --- installation -----------------------------------------------------------

  function hasCartCookie(view) {
    try {
      return /(?:^|;\s*)cart=/.test(String(view.document.cookie || ""));
    } catch (error) {
      return true;
    }
  }

  function install(view, options) {
    if (!view || view[INSTALLED]) return view && view[INSTALLED];
    var settings = options || {};
    var originalFetch = typeof view.fetch === "function" ? view.fetch.bind(view) : null;
    var state = { cart: null, loading: null, timer: null, lastMap: null, restoredCount: 0, expected: [], pending: [], verifyTimer: null };

    function now() {
      return typeof settings.now === "function" ? Number(settings.now()) : Date.now();
    }

    function sessionStore() {
      try { return view.sessionStorage || null; } catch (error) { return null; }
    }

    function loadPending() {
      var store = sessionStore();
      if (!store) return [];
      try {
        var list = JSON.parse(store.getItem(PENDING_STORAGE_KEY) || "[]");
        return (Array.isArray(list) ? list : []).map(function (record) {
          var entry = cleanEntry(record);
          var at = Number(record && record.at);
          return entry && Number.isFinite(at) && now() - at < PENDING_TTL_MS ? Object.assign(entry, { at: at }) : null;
        }).filter(Boolean);
      } catch (error) {
        return [];
      }
    }

    function savePending() {
      var store = sessionStore();
      if (!store) return;
      try {
        if (state.pending.length) {
          store.setItem(PENDING_STORAGE_KEY, JSON.stringify(state.pending.map(function (record) {
            var copy = cleanEntry(record);
            copy.at = record.at;
            return copy;
          })));
        } else {
          store.removeItem(PENDING_STORAGE_KEY);
        }
      } catch (error) {
        // Storage unavailable: the in-page record still applies.
      }
    }

    state.pending = loadPending();

    // The product handoff's add, recorded before the request is sent.
    function expectAdd(entry) {
      var clean = cleanEntry(entry);
      if (!clean || !clean.v) return false;
      state.expected = state.expected.filter(function (item) {
        return item.entry.h !== clean.h && now() - item.at < EXPECT_TTL_MS;
      });
      state.expected.push({ entry: clean, at: now() });
      return true;
    }

    // The expectation this request line belongs to: by its own slot when it
    // carries one, otherwise (line properties lost) by the exact variant.
    function takeExpectation(item) {
      state.expected = state.expected.filter(function (expected) { return now() - expected.at < EXPECT_TTL_MS; });
      var slot = isUuid(item.h) ? item.h.trim().toLowerCase() : null;
      var index = state.expected.findIndex(function (expected) {
        return slot ? expected.entry.h === slot : expected.entry.v === item.v;
      });
      return index < 0 ? null : state.expected.splice(index, 1)[0].entry;
    }

    function addEntryFor(item) {
      var expected = takeExpectation(item);
      if (expected) {
        // The request's own config, when present, must agree; a disagreement
        // is never resolved by guessing.
        if (isUuid(item.c) && item.c.trim().toLowerCase() !== expected.c) return null;
        return Object.assign({}, expected);
      }
      return cleanEntry({ h: item.h, c: item.c, s: item.s, v: item.v });
    }

    function addPending(entry) {
      state.pending = state.pending.filter(function (record) { return record.h !== entry.h; });
      state.pending.push(Object.assign({}, entry, { at: now(), tries: 0 }));
      savePending();
    }

    function lineCarries(cart, record) {
      return cartItems(cart).some(function (item) {
        var kept = durableProperties(item);
        return Boolean(kept) && kept[CONFIG_PROPERTY].trim().toLowerCase() === record.c;
      });
    }

    function notifyUnsaved(record) {
      try {
        var EventConstructor = view.CustomEvent;
        if (typeof EventConstructor !== "function" || !view.document) return;
        view.document.dispatchEvent(new EventConstructor(UNSAVED_EVENT, { detail: { handoff: record.h, config: record.c } }));
      } catch (error) {
        // Never interfere with the page.
      }
    }

    // Drops pending slots the cart map now holds (confirmed), whose product
    // has left the cart, or that expired; counts a failed verification.
    function settlePending(cart, current) {
      var before = state.pending.length;
      state.pending = state.pending.filter(function (record) {
        if (now() - record.at >= PENDING_TTL_MS) return false;
        if (current.some(function (entry) { return entry.h === record.h; })) return false;
        return cartItems(cart).some(function (item) {
          return String(item.variant_id) === record.v || (record.p && String(item.product_id) === record.p);
        });
      });
      if (state.pending.length !== before) savePending();
    }

    function afterAdd(entries, response) {
      if (!entries.length || !response || !response.ok) return;
      entries.forEach(addPending);
      reconcileNow();
      // The response's added line gives the product id when the form had none.
      if (typeof response.clone !== "function") return;
      try {
        response.clone().json().then(function (data) {
          var items = data && Array.isArray(data.items) ? data.items : (data && data.variant_id !== undefined ? [data] : []);
          var changed = false;
          state.pending.forEach(function (record) {
            if (record.p) return;
            var line = items.find(function (item) { return item && String(item.variant_id) === record.v; });
            if (line && /^\d{1,20}$/.test(String(line.product_id || ""))) {
              record.p = String(line.product_id);
              changed = true;
            }
          });
          if (changed) savePending();
        }, function () {});
      } catch (error) {
        // An unreadable response still leaves the variant to find the line.
      }
    }

    function loadCart() {
      if (!originalFetch) return Promise.resolve(null);
      if (state.loading) return state.loading;
      state.loading = originalFetch("/cart.js", { method: "GET", headers: { Accept: "application/json" }, credentials: "same-origin", cache: "no-store" })
        .then(function (response) { return response && response.ok ? response.json() : null; })
        .then(function (cart) {
          if (cart && Array.isArray(cart.items)) state.cart = cart;
          return state.cart;
        })
        .catch(function () { return state.cart; })
        .then(function (cart) { state.loading = null; return cart; });
      return state.loading;
    }

    // Resolves once a cart snapshot is available (or after a short timeout:
    // a cart request is never held up for long).
    function ready() {
      if (state.cart) return Promise.resolve(state.cart);
      return new Promise(function (resolve) {
        var done = false;
        var timer = view.setTimeout(function () { if (!done) { done = true; resolve(state.cart); } }, settings.readyTimeoutMs || READY_TIMEOUT_MS);
        loadCart().then(function (cart) {
          if (done) return;
          done = true;
          view.clearTimeout(timer);
          resolve(cart);
        });
      });
    }

    function writeMap(text) {
      var journey = view.OOSourceJourney;
      var attributes = {};
      attributes[ATTRIBUTE] = text;
      var request = journey && typeof journey.cartUpdate === "function"
        ? journey.cartUpdate(attributes)
        : originalFetch("/cart/update.js", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ attributes: attributes })
        });
      // A refused write (non-2xx) is written again on the next reconcile.
      return Promise.resolve(request).then(function (response) {
        if (response && response.ok === false) state.lastMap = null;
      }, function () { state.lastMap = null; });
    }

    // Brings _oo_rx_handoffs in line with the cart's lines.
    // verifying: a dedicated re-read after writing pending slots.
    function reconcile(cart, verifying) {
      if (!cart) return Promise.resolve(null);
      var current = cartMap(cart);
      settlePending(cart, current);
      if (verifying === true && state.pending.length) checkPending(cart);
      var next = reconcileEntries(current, cart, state.pending);
      var text = serializeMap(next);
      var existing = String((cart.attributes || {})[ATTRIBUTE] || "");
      var changed = text !== existing && text !== state.lastMap;
      if (changed) state.lastMap = text;
      return (changed ? writeMap(text) : Promise.resolve()).then(function () {
        if (state.pending.length) verifySoon();
        return next;
      });
    }

    // A pending slot still missing from a verification read is written again
    // (up to VERIFY_ATTEMPTS reads); after that, the page is told when the
    // line has no config either. Storage keeps it for the next page.
    function checkPending(cart) {
      state.pending.forEach(function (record) {
        record.tries = (record.tries || 0) + 1;
        state.lastMap = null;
        if (record.tries === VERIFY_ATTEMPTS && !lineCarries(cart, record)) notifyUnsaved(record);
      });
    }

    function verifySoon() {
      if (state.verifyTimer) return;
      var unsettled = state.pending.some(function (record) { return (record.tries || 0) < VERIFY_ATTEMPTS; });
      if (!unsettled) return;
      state.verifyTimer = view.setTimeout(function () {
        state.verifyTimer = null;
        state.cart = null;
        loadCart().then(function (cart) { return reconcile(cart, true); });
      }, settings.verifyDelayMs || 800);
    }

    function reconcileNow() {
      state.cart = null;
      return loadCart().then(reconcile);
    }

    function refreshSoon() {
      if (state.timer) view.clearTimeout(state.timer);
      state.timer = view.setTimeout(function () {
        state.timer = null;
        state.cart = null;
        loadCart().then(reconcile);
      }, REFRESH_DELAY_MS);
    }

    function isMutation(url, body) {
      if (!isCartPath(view, url, MUTATION_PATH)) return false;
      // An attributes/note-only update (ours or the journey's) changes no line.
      if (isCartPath(view, url, /^\/cart\/update(?:\.js)?$/)) {
        var adapter = bodyAdapter(body);
        if (adapter && adapter.names().every(function (name) { return /^(?:attributes|note)(?:\[|$)/.test(name); })) return false;
      }
      return true;
    }

    function guarded(url, body) {
      if (!isCartPath(view, url, CHANGE_PATH)) return Promise.resolve(body);
      return ready().then(function (cart) {
        try {
          var result = guardChangeBody(cart, body);
          if (result.restored.length) state.restoredCount += 1;
          return result.body;
        } catch (error) {
          return body;
        }
      });
    }

    if (originalFetch) {
      view.fetch = function (input, init) {
        var url = typeof input === "string" || (input && typeof input.href === "string") ? String(input) : null;
        var method = String((init && init.method) || "GET").toUpperCase();
        if (!url || method !== "POST" || !isCartPath(view, url, MUTATION_PATH)) return originalFetch(input, init);
        var mutation = isMutation(url, init && init.body);
        var added = [];
        if (isCartPath(view, url, ADD_PATH)) {
          try { added = addRequestItems(init && init.body).map(addEntryFor).filter(Boolean); } catch (error) { added = []; }
        }
        return guarded(url, init && init.body).then(function (body) {
          var nextInit = Object.assign({}, init, { body: body });
          var response = originalFetch(input, nextInit);
          if (added.length) response.then(function (result) { afterAdd(added, result); }, function () {});
          if (mutation) response.then(refreshSoon, function () {});
          return response;
        });
      };
    }

    var XHR = view.XMLHttpRequest;
    if (XHR && XHR.prototype && !XHR.prototype.__ooRxCartHandoff) {
      var open = XHR.prototype.open;
      var send = XHR.prototype.send;
      XHR.prototype.__ooRxCartHandoff = true;
      XHR.prototype.open = function (method, url, async) {
        this.__ooRxCart = { method: String(method || "GET").toUpperCase(), url: String(url), sync: arguments.length > 2 && async === false };
        return open.apply(this, arguments);
      };
      XHR.prototype.send = function (body) {
        var xhr = this;
        var info = xhr.__ooRxCart;
        if (!info || info.method !== "POST" || !isCartPath(view, info.url, MUTATION_PATH)) return send.apply(xhr, arguments);
        if (isMutation(info.url, body)) xhr.addEventListener("loadend", refreshSoon);
        if (isCartPath(view, info.url, ADD_PATH)) {
          var added = [];
          try { added = addRequestItems(body).map(addEntryFor).filter(Boolean); } catch (error) { added = []; }
          if (added.length) {
            xhr.addEventListener("loadend", function () {
              afterAdd(added, { ok: xhr.status >= 200 && xhr.status < 300 });
            });
          }
        }
        // A synchronous request can only be guarded with a snapshot in hand.
        if (!isCartPath(view, info.url, CHANGE_PATH)) return send.apply(xhr, arguments);
        if (info.sync) {
          var syncBody = body;
          try { if (state.cart) syncBody = guardChangeBody(state.cart, body).body; } catch (error) { syncBody = body; }
          return send.call(xhr, syncBody);
        }
        guarded(info.url, body).then(function (nextBody) {
          try { send.call(xhr, nextBody); } catch (error) { /* aborted before sending */ }
        });
        return undefined;
      };
    }

    var handle = {
      ready: ready,
      reconcile: reconcileNow,
      // The page's "Try again": write every pending slot again and verify.
      retry: function () {
        state.lastMap = null;
        state.pending.forEach(function (record) { record.tries = 0; });
        return reconcileNow();
      },
      expectAdd: expectAdd,
      state: state
    };
    view[INSTALLED] = handle;
    // An empty browser has no cart to protect; otherwise take the snapshot the
    // guard needs and bring the cart's handoff map up to date.
    if (hasCartCookie(view)) loadCart().then(reconcile);
    return handle;
  }

  // The product handoff's hook: record the add it is about to submit.
  function expectAdd(view, entry) {
    var handle = view && view[INSTALLED];
    return Boolean(handle && typeof handle.expectAdd === "function" && handle.expectAdd(entry));
  }

  return {
    ATTRIBUTE: ATTRIBUTE,
    CONFIG_PROPERTY: CONFIG_PROPERTY,
    HANDOFF_PROPERTY: HANDOFF_PROPERTY,
    MAX_ENTRIES: MAX_ENTRIES,
    PENDING_STORAGE_KEY: PENDING_STORAGE_KEY,
    UNSAVED_EVENT: UNSAVED_EVENT,
    addRequestItems: addRequestItems,
    expectAdd: expectAdd,
    isUuid: isUuid,
    newHandoffId: newHandoffId,
    durableProperties: durableProperties,
    parseMap: parseMap,
    serializeMap: serializeMap,
    reconcileEntries: reconcileEntries,
    bodyAdapter: bodyAdapter,
    targetLine: targetLine,
    guardChangeBody: guardChangeBody,
    install: install
  };
});
