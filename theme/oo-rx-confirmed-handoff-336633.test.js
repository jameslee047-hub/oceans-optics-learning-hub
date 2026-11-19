"use strict";

// Confirmed Rx handoff guarantee (production order #336633).
//
// #336633 (Rx Rover M166 Blue / Black, R -4.00 / L -4.00) reached OO Orders
// with Lens Calculator journey attribution in the cart attributes but no
// _oo_rx_config, _oo_rx_handoff, _oo_source or _oo_rx_handoffs anywhere. Its
// config was confirmed by the calculator's "View Your Rx Match" click; the
// order came eight hours later. Reproduced live on 2026-11-19 (Rx backend
// faked, throwaway carts): the same shape comes from
//   - Add pressed while the saved prescription is still loading,
//   - Add pressed after the summary failed (error shown, Add still allowed),
//   - the customer returning to the mask later without the oo_rx link
//     (the calculator, unlike the Quiz, remembered nothing).
// And the cart fallback map was only ever built from a line that already
// carried the config, so a line that lost its properties lost both.
//
// Runs the real oo-rx-cart-handoff.js (head) and oo-rx-product-handoff.js in
// jsdom (NODE_PATH=/path/to/node_modules node --test theme/).

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var childProcess = require("node:child_process");

var JSDOM = null;
try { JSDOM = require("jsdom").JSDOM; } catch (error) { JSDOM = null; }
var skipDom = JSDOM ? false : "jsdom is not installed";

var ASSETS = path.join(__dirname, "base", "assets");
var GUARD = fs.readFileSync(path.join(ASSETS, "oo-rx-cart-handoff.js"), "utf8");
var HANDOFF = fs.readFileSync(path.join(ASSETS, "oo-rx-product-handoff.js"), "utf8");
var Cart = require("./base/assets/oo-rx-cart-handoff.js");
var Handoff = require("./base/assets/oo-rx-product-handoff.js");
var Products = require("./base/assets/oo-lens-calculator-v53-products.js");

// The scripts that were live when #336633 was placed (LH afcf775), when git
// can still show them; the "before" half of the fixture is skipped otherwise.
function liveBefore(file) {
  try {
    return childProcess.execFileSync("git", ["show", "afcf775:theme/base/assets/" + file], { cwd: __dirname, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch (error) {
    return null;
  }
}
var BEFORE = { guard: liveBefore("oo-rx-cart-handoff.js"), handoff: liveBefore("oo-rx-product-handoff.js") };
var skipBefore = skipDom || (BEFORE.guard && BEFORE.handoff ? false : "afcf775 is not available");

// #336633's real config id, used as an opaque fixture only.
var CONFIG_336633 = "db55c505-d17a-4b13-9a0b-6513ea33148c";
var OTHER = "3c40cb04-920e-4a03-b113-2db39b4acbff";
var THIRD = "5fcec0ef-4ff8-4071-bb0f-222b04dfd411";
var ROVER = { path: "/products/rx-rover-nearsighted-prescription-freediving-scuba-dive-mask", productId: "9732576280909", blueBlack: "50139439726925", blackBlack: "50139438973261" };
var TITAN = { path: "/products/rx-titan", productId: "9732576281111", blueBlack: "50139439720001", blackBlack: "50139439720002" };
var VISTA = { path: "/products/vista-m309", productId: "9732576282222", blueBlack: "50139439730001" };
var POWERS = ["0 (No correction)", "-1.00", "-3.50", "-4.00", "-4.50"];
var SNAPSHOT = JSON.stringify({ calculatorVersion: "5.3.8", recommendationStrategy: "balanced", recommendedRight: -4, recommendedLeft: -4 });
var V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

var PAIRS = {};
PAIRS[CONFIG_336633] = [-4, -4];
PAIRS[OTHER] = [-4, -4];
PAIRS[THIRD] = [-3.5, -4.5];

function memoryStorage(values) {
  return {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null; },
    setItem: function (key, value) { values[key] = String(value); },
    removeItem: function (key) { delete values[key]; }
  };
}

// A browser: one Shopify cart and one localStorage for every tab; each tab
// has its own sessionStorage.
function newBrowser() {
  return { local: {}, cart: { items: [], attributes: {}, adds: [], updates: 0, counter: 0 }, dropLineProperties: false, failUpdates: false };
}

function newTab(browser) {
  return { browser: browser, session: {} };
}

function productHtml(product, variant, rx) {
  var options = POWERS.map(function (value) { return '<option value="' + value + '">' + value + "</option>"; }).join("");
  return [
    '<product-info class="product__info-container">',
    rx === false ? "" : '<div class="app-avis-product-options-block"><div class="avpoptions-container__v2">' +
      '<div class="avp-option"><select name="(OD) Right"><option value="">Select</option>' + options + "</select></div>" +
      '<div class="avp-option"><select name="(OS) Left"><option value="">Select</option>' + options + "</select></div>" +
      '<div class="avp-option"><select name="Snorkel"><option value="No thanks">No thanks</option><option value="Dry Top [ $17.50 ]">Dry Top</option></select></div>' +
      "</div></div>",
    '<product-form><form method="post" action="/cart/add" data-type="add-to-cart-form">',
    '<input type="hidden" name="form_type" value="product"><input type="hidden" name="id" value="' + variant + '">',
    '<input type="hidden" name="product-id" value="' + product.productId + '">',
    '<div class="apo-mirrors"></div><button type="submit" name="add">Add to cart</button></form></product-form>',
    "</product-info>"
  ].join("");
}

function jsonResponse(body, status) {
  var ok = !status || (status >= 200 && status < 300);
  var make = function () {
    return { ok: ok, status: status || 200, json: function () { return Promise.resolve(JSON.parse(JSON.stringify(body))); } };
  };
  var result = make();
  result.clone = make;
  return Promise.resolve(result);
}

function formProperties(formData) {
  var properties = {};
  formData.forEach(function (value, name) {
    var match = name.match(/^properties\[(.*)\]$/);
    if (match && value !== "") properties[match[1]] = value;
  });
  return properties;
}

// options: product, variant, search, rx (false = no lens selectors),
// summary: { delayMs, failures, status }, scripts: { guard, handoff },
// rerenderBeforeSubmit, journey (record calculator attribution first).
function openPage(tab, options) {
  var settings = options || {};
  var browser = tab.browser;
  var product = settings.product;
  var html = product ? productHtml(product, settings.variant || product.blueBlack, settings.rx) : "<main>cart</main>";
  var dom = new JSDOM("<!doctype html><body>" + html + "</body>", {
    url: "https://oceansoptics.com" + (product ? product.path : "/cart") + (settings.search || ""),
    runScripts: "outside-only",
    pretendToBeVisual: true
  });
  var win = dom.window;
  var page = { tab: tab, win: win, doc: win.document, product: product, summaries: 0, addBodies: [] };
  Object.defineProperty(win, "sessionStorage", { value: memoryStorage(tab.session), configurable: true });
  Object.defineProperty(win, "localStorage", { value: memoryStorage(browser.local), configurable: true });
  win.document.cookie = "cart=test-cart";
  var summary = settings.summary || {};
  win.fetch = function (url, init) {
    url = String(url);
    if (/\/api\/rx-config\/[^/]+\/summary$/.test(url)) {
      page.summaries += 1;
      var id = decodeURIComponent(url.split("/api/rx-config/")[1].split("/")[0]);
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          if (summary.failures > 0) {
            summary.failures -= 1;
            if (summary.kind === "network") reject(new TypeError("Failed to fetch"));
            else resolve({ ok: false, status: summary.status || 503, json: function () { return Promise.resolve({}); } });
            return;
          }
          var pair = PAIRS[id];
          if (!pair) return resolve({ ok: false, status: 404, json: function () { return Promise.resolve({}); } });
          resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ configId: id, status: "confirmed", recommendedRight: pair[0], recommendedLeft: pair[1], prescriptionAttached: false, prescriptionLabel: null }); } });
        }, summary.delayMs || 0);
      });
    }
    if (url === "/cart.js") return jsonResponse(browser.cart);
    if (url === "/cart/add") {
      var properties = formProperties(init.body);
      page.addBodies.push(Object.assign({}, properties));
      browser.cart.adds.push(Object.assign({}, properties));
      // Initial line-property loss: Shopify / an app keeps only non-OO properties.
      if (browser.dropLineProperties) {
        Object.keys(properties).forEach(function (name) { if (/^_oo_/.test(name)) delete properties[name]; });
      }
      browser.cart.counter += 1;
      var variant = String(init.body.get("id"));
      var line = { key: variant + ":k" + browser.cart.counter, product_id: Number(init.body.get("product-id") || product.productId), variant_id: Number(variant), quantity: 1, properties: properties };
      browser.cart.items.push(line);
      return jsonResponse(line);
    }
    if (url === "/cart/update.js") {
      browser.cart.updates += 1;
      if (browser.failUpdates) return jsonResponse({ status: 500 }, 500);
      Object.assign(browser.cart.attributes, JSON.parse(init.body).attributes);
      return jsonResponse(browser.cart);
    }
    return Promise.reject(new Error("unexpected fetch " + url));
  };
  if (settings.journey !== false) {
    win.OOSourceJourney = {
      record: function (source) { return { first_source: source, source_history_text: source }; },
      cartUpdate: function (attributes) {
        return win.fetch("/cart/update.js", { method: "POST", body: JSON.stringify({ attributes: attributes }) });
      }
    };
  }
  var scripts = settings.scripts || {};
  win.eval(scripts.guard || GUARD);
  if (product) {
    if (settings.rx !== false) {
      // Avis mirrors each option into a properties[...] input in the form.
      var mirror = function () {
        var form = win.document.querySelector('form[data-type="add-to-cart-form"]');
        var mirrors = form.querySelector(".apo-mirrors");
        ["(OD) Right", "(OS) Left", "Snorkel"].forEach(function (name) {
          var input = mirrors.querySelector('input[name="properties[' + name + ']"]');
          if (!input) {
            input = win.document.createElement("input");
            input.type = "hidden";
            input.name = "properties[" + name + "]";
            mirrors.appendChild(input);
          }
          input.value = win.document.querySelector('.avpoptions-container__v2 select[name="' + name + '"]').value;
        });
      };
      win.document.querySelector(".avpoptions-container__v2").addEventListener("change", mirror);
      mirror();
    }
    win.eval(scripts.handoff || HANDOFF);
    // Dawn product-form.js: FormData of the submitted form, POST /cart/add.
    win.document.addEventListener("submit", function (event) {
      event.preventDefault();
      win.fetch("/cart/add", { method: "POST", body: new win.FormData(event.target) }).then(function (response) {
        page.lastAdd = response.ok ? "ok" : "failed";
      });
    });
  }
  return page;
}

function settle(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms === undefined ? 40 : ms); });
}

function calculatorSearch(configId, variant) {
  return "?variant=" + (variant || ROVER.blueBlack) + "&oo_rx=" + configId + "&oo_source=lens_calculator_v53&_oo_v53_snapshot=" + encodeURIComponent(SNAPSHOT);
}

function choose(page, name, value) {
  var select = page.doc.querySelector('.avpoptions-container__v2 select[name="' + name + '"]');
  select.value = value;
  select.dispatchEvent(new page.win.Event("change", { bubbles: true }));
}

function changeColour(page, variantId) {
  page.doc.querySelector('form[data-type="add-to-cart-form"] input[name="id"]').value = variantId;
  page.win.history.replaceState({}, "", page.product.path + "?variant=" + variantId);
}

async function pressAdd(page, wait) {
  page.doc.querySelector('form[data-type="add-to-cart-form"] button[name="add"]').click();
  await settle(wait === undefined ? 60 : wait);
}

function statusOf(page) {
  var status = page.doc.getElementById("oo-rx-handoff-status");
  return status ? status.className.replace("oo-rx-handoff-status ", "") : null;
}

function lineOf(item) {
  var p = item.properties;
  return { config: p._oo_rx_config || null, slot: p._oo_rx_handoff || null, source: p._oo_source || null, lenses: p["(OD) Right"] + "/" + p["(OS) Left"] };
}

function mapOf(browser) {
  return Cart.parseMap(browser.cart.attributes._oo_rx_handoffs);
}

// What OO Orders needs: line config + slot, or a cart map slot for the line.
function durableReference(browser, item) {
  var p = item.properties;
  if (Cart.isUuid(p._oo_rx_config) && Cart.isUuid(p._oo_rx_handoff)) return { via: "line", config: p._oo_rx_config };
  var slots = mapOf(browser).filter(function (entry) { return entry.v === String(item.variant_id) && entry.p === String(item.product_id); });
  return slots.length ? { via: "cart_map", configs: slots.map(function (entry) { return entry.c; }) } : null;
}

// --- 22. the #336633 fixture: before (live afcf775) and after -------------

async function scenario336633(scripts) {
  var browser = newBrowser();
  // 16:35 UTC: "View Your Rx Match" opens Rover with the confirmed config.
  var calculatorTab = newTab(browser);
  var arrival = openPage(calculatorTab, { product: ROVER, search: calculatorSearch(CONFIG_336633), scripts: scripts });
  await settle(80);
  var arrivedWith = statusOf(arrival);
  // 00:44 UTC: a new visit, straight to Rover without the link; -4.00/-4.00 by hand.
  var later = openPage(newTab(browser), { product: ROVER, search: "?variant=" + ROVER.blueBlack, scripts: scripts });
  await settle(120);
  choose(later, "(OD) Right", "-4.00");
  choose(later, "(OS) Left", "-4.00");
  await pressAdd(later, 200);
  return { browser: browser, arrivedWith: arrivedWith, line: browser.cart.items[0] };
}

test("22. #336633 before the fix: the calculator link applied, but the later visit added Rover with no config, no slot and no cart map (exact order shape)", { skip: skipBefore }, async function () {
  var result = await scenario336633(BEFORE);
  assert.equal(result.arrivedWith, "is-success");
  assert.equal(result.browser.cart.items.length, 1);
  assert.deepEqual(lineOf(result.line), { config: null, slot: null, source: null, lenses: "-4.00/-4.00" });
  assert.equal(result.browser.cart.attributes._oo_rx_handoffs, undefined);
  assert.equal(durableReference(result.browser, result.line), null);
});

test("22. #336633 after the fix: the same journey lands the confirmed config, a slot and the cart map on the Rover line", { skip: skipDom }, async function () {
  var result = await scenario336633(null);
  assert.equal(result.arrivedWith, "is-success");
  assert.deepEqual(lineOf(result.line), { config: CONFIG_336633, slot: result.line.properties._oo_rx_handoff, source: "lens_calculator_v53", lenses: "-4.00/-4.00" });
  assert.match(result.line.properties._oo_rx_handoff, V4);
  assert.equal(result.line.properties._oo_v53_snapshot, SNAPSHOT);
  await settle(1000);
  assert.deepEqual(mapOf(result.browser), [{ h: result.line.properties._oo_rx_handoff, c: CONFIG_336633, s: "lens_calculator_v53", p: ROVER.productId, v: ROVER.blueBlack }]);
  assert.equal(result.browser.local.oo_rx_calculator_handoff, undefined, "single use: spent once in the cart");
});

// --- 1-3. confirmed calculator config -> Rover -> Add ------------------------

test("1/2/3. Lens Calculator -> Rover -> Add: the line has the config and a v4 slot, and the cart map holds the same slot", { skip: skipDom }, async function () {
  var catalog = Array.isArray(Products.CATALOG) ? Products.CATALOG : Object.values(Products.CATALOG);
  var rover = catalog.find(function (item) { return item.id === "rover"; });
  var variant = Products.findVariant(rover, "Blue", "Black");
  var url = new URL(Products.prepareProductPageUrl({ status: "ready", configId: CONFIG_336633, recommendedRight: -4, recommendedLeft: -4, v53Snapshot: JSON.parse(SNAPSHOT) }, rover, variant));
  assert.equal(url.pathname, ROVER.path);
  assert.equal(url.searchParams.get("variant"), ROVER.blueBlack);
  assert.equal(url.searchParams.get("oo_rx"), CONFIG_336633);
  assert.equal(url.searchParams.get("oo_source"), "lens_calculator_v53");
  assert.equal(url.searchParams.get("_oo_v53_snapshot"), SNAPSHOT);

  var browser = newBrowser();
  var page = openPage(newTab(browser), { product: ROVER, search: url.search });
  await settle(80);
  assert.equal(statusOf(page), "is-success");
  await pressAdd(page, 1000);
  var item = browser.cart.items[0];
  assert.equal(item.properties._oo_rx_config, CONFIG_336633);
  assert.match(item.properties._oo_rx_handoff, V4);
  assert.equal(item.properties._oo_source, "lens_calculator_v53");
  assert.deepEqual(mapOf(browser), [{ h: item.properties._oo_rx_handoff, c: CONFIG_336633, s: "lens_calculator_v53", p: ROVER.productId, v: ROVER.blueBlack }]);
  assert.equal(page.tab.session[Cart.PENDING_STORAGE_KEY], undefined, "the pending record is cleared once the map holds it");
});

test("4/5. colour change and Avis option / lens interaction before Add: the config, slot and map follow the new variant", { skip: skipDom }, async function () {
  var browser = newBrowser();
  var page = openPage(newTab(browser), { product: ROVER, search: calculatorSearch(CONFIG_336633) });
  await settle(80);
  changeColour(page, ROVER.blackBlack);
  choose(page, "Snorkel", "Dry Top [ $17.50 ]");
  choose(page, "(OD) Right", "-3.50");
  choose(page, "(OD) Right", "-4.00");
  await pressAdd(page, 1000);
  var item = browser.cart.items[0];
  assert.deepEqual(lineOf(item), { config: CONFIG_336633, slot: item.properties._oo_rx_handoff, source: "lens_calculator_v53", lenses: "-4.00/-4.00" });
  assert.equal(item.variant_id, Number(ROVER.blackBlack));
  assert.equal(item.properties.Snorkel, "Dry Top [ $17.50 ]");
  assert.equal(new URL(page.win.location.href).searchParams.get("oo_rx"), CONFIG_336633, "oo_rx kept through the colour change");
  assert.deepEqual(mapOf(browser).map(function (entry) { return entry.v; }), [ROVER.blackBlack]);
});

test("6/7/8. reload, back/forward to the kept URL and a new tab: each re-validates and attaches the config", { skip: skipDom }, async function () {
  var browser = newBrowser();
  var tab = newTab(browser);
  var first = openPage(tab, { product: ROVER, search: calculatorSearch(CONFIG_336633) });
  await settle(80);
  changeColour(first, ROVER.blackBlack);
  var kept = first.win.location.search;
  // Reload (and history navigation, which reloads the same kept URL).
  var reloaded = openPage(tab, { product: ROVER, variant: ROVER.blackBlack, search: kept });
  await settle(80);
  assert.equal(statusOf(reloaded), "is-success");
  await pressAdd(reloaded, 600);
  // A new tab from the calculator link (own sessionStorage, shared cart).
  var newTabPage = openPage(newTab(browser), { product: ROVER, search: calculatorSearch(CONFIG_336633) });
  await settle(80);
  await pressAdd(newTabPage, 1000);
  assert.deepEqual(browser.cart.items.map(function (item) { return item.properties._oo_rx_config; }), [CONFIG_336633, CONFIG_336633]);
  var slots = browser.cart.items.map(function (item) { return item.properties._oo_rx_handoff; });
  assert.notEqual(slots[0], slots[1], "one slot per cart line");
  assert.deepEqual(mapOf(browser).map(function (entry) { return entry.h; }).sort(), slots.slice().sort());
});

// --- 9/10. the add is held until the handoff applies or visibly fails -------

test("9. delayed config summary: Add cannot bypass the handoff; it is held, then attaches once the summary arrives", { skip: skipDom }, async function () {
  var browser = newBrowser();
  var page = openPage(newTab(browser), { product: ROVER, search: calculatorSearch(CONFIG_336633), summary: { delayMs: 400 } });
  await settle(40);
  assert.equal(page.win.OORxProductHandoff.isAddToCartHeld(page.doc), true);
  assert.ok(page.doc.querySelector('form[data-type="add-to-cart-form"]').classList.contains("oo-rx-handoff-waiting"));
  choose(page, "(OD) Right", "-4.00");
  choose(page, "(OS) Left", "-4.00");
  await pressAdd(page, 20);
  page.doc.querySelector('form[data-type="add-to-cart-form"]').dispatchEvent(new page.win.Event("submit", { bubbles: true, cancelable: true }));
  await settle(20);
  assert.equal(browser.cart.adds.length, 0, "no /cart/add while the saved prescription loads (click or direct submit)");
  assert.equal(statusOf(page), "is-pending");
  await settle(500);
  assert.equal(statusOf(page), "is-success");
  assert.equal(page.win.OORxProductHandoff.isAddToCartHeld(page.doc), false);
  assert.ok(!page.doc.querySelector('form[data-type="add-to-cart-form"]').classList.contains("oo-rx-handoff-waiting"));
  await pressAdd(page, 600);
  assert.equal(browser.cart.items.length, 1);
  assert.equal(browser.cart.items[0].properties._oo_rx_config, CONFIG_336633);
});

test("10. transient summary failure: a visible error with Try again (never a silent Rx loss); Try again applies the config", { skip: skipDom }, async function () {
  var browser = newBrowser();
  var page = openPage(newTab(browser), { product: ROVER, search: calculatorSearch(CONFIG_336633), summary: { failures: 3 } });
  await settle(3000);
  assert.equal(statusOf(page), "is-error");
  var status = page.doc.getElementById("oo-rx-handoff-status");
  assert.equal(status.getAttribute("role"), "alert");
  assert.match(status.textContent, /couldn't load your saved prescription/);
  var retry = status.querySelector(".oo-rx-handoff-status__retry");
  assert.ok(retry, "a Try again button");
  assert.equal(retry.textContent, Handoff.RETRY_LABEL);
  assert.equal(page.win.OORxProductHandoff.isAddToCartHeld(page.doc), false, "after a visible failure the customer may continue by hand");
  retry.click();
  assert.equal(page.win.OORxProductHandoff.isAddToCartHeld(page.doc), true, "held again while retrying");
  await settle(80);
  assert.equal(statusOf(page), "is-success");
  await pressAdd(page, 600);
  assert.equal(browser.cart.items[0].properties._oo_rx_config, CONFIG_336633);
});

test("10. definitive failure (unknown config): visible error, no config attached, Add works by hand", { skip: skipDom }, async function () {
  var browser = newBrowser();
  var page = openPage(newTab(browser), { product: ROVER, search: calculatorSearch("9d3e1c52-1111-4222-8333-944455556666") });
  await settle(120);
  assert.equal(statusOf(page), "is-error");
  choose(page, "(OD) Right", "-4.00");
  choose(page, "(OS) Left", "-4.00");
  await pressAdd(page, 600);
  assert.deepEqual(lineOf(browser.cart.items[0]), { config: null, slot: null, source: null, lenses: "-4.00/-4.00" });
  assert.deepEqual(mapOf(browser), []);
});

test("10. Avis never renders: the hold ends with a visible error above the mask form, not a silent wait", { skip: skipDom }, async function () {
  var browser = newBrowser();
  var page = openPage(newTab(browser), { product: ROVER, rx: false, search: calculatorSearch(CONFIG_336633) });
  page.win.OORxProductHandoff.start(page.doc, { search: calculatorSearch(CONFIG_336633), fetch: page.win.fetch, timeoutMs: 100, retryDelays: [] });
  await settle(250);
  assert.equal(page.win.OORxProductHandoff.isAddToCartHeld(page.doc), false);
  var status = page.doc.getElementById("oo-rx-handoff-status");
  assert.ok(status && status.classList.contains("is-error"));
  assert.equal(status.nextElementSibling, page.doc.querySelector('form[data-type="add-to-cart-form"]'));
});

// --- 11. the submitted form is the one that carries the handoff -------------

test("11. the theme re-renders the product form after the handoff: the form actually submitted still carries the config", { skip: skipDom }, async function () {
  var browser = newBrowser();
  var page = openPage(newTab(browser), { product: ROVER, search: calculatorSearch(CONFIG_336633) });
  await settle(80);
  // Variant change re-render: a fresh form with Avis' mirrors but no OO inputs.
  var old = page.doc.querySelector('form[data-type="add-to-cart-form"]');
  var fresh = old.cloneNode(true);
  Array.from(fresh.querySelectorAll('input[name^="properties[_oo"]')).forEach(function (input) { input.remove(); });
  old.replaceWith(fresh);
  assert.equal(fresh.querySelectorAll('input[name^="properties[_oo"]').length, 0);
  await pressAdd(page, 1000);
  assert.equal(browser.cart.items[0].properties._oo_rx_config, CONFIG_336633);
  assert.equal(mapOf(browser)[0].h, browser.cart.items[0].properties._oo_rx_handoff);
});

// --- 12/13. the cart fallback is independent of the line properties ---------

test("12. initial line-property loss: the line keeps no OO property, yet the cart map records the exact slot and config of that add", { skip: skipDom }, async function () {
  var browser = newBrowser();
  browser.dropLineProperties = true;
  var page = openPage(newTab(browser), { product: ROVER, search: calculatorSearch(CONFIG_336633) });
  await settle(80);
  await pressAdd(page, 1000);
  var item = browser.cart.items[0];
  assert.deepEqual(lineOf(item), { config: null, slot: null, source: null, lenses: "-4.00/-4.00" });
  var sent = browser.cart.adds[0]._oo_rx_handoff;
  assert.match(sent, V4, "the request carried the slot");
  assert.deepEqual(mapOf(browser), [{ h: sent, c: CONFIG_336633, s: "lens_calculator_v53", p: ROVER.productId, v: ROVER.blueBlack }]);
  assert.deepEqual(durableReference(browser, item), { via: "cart_map", configs: [CONFIG_336633] });
});

test("12. the theme leaves for /cart right after the add: the pending slot is kept per tab and written by the next page", { skip: skipDom }, async function () {
  var browser = newBrowser();
  browser.dropLineProperties = true;
  var tab = newTab(browser);
  var page = openPage(tab, { product: ROVER, search: calculatorSearch(CONFIG_336633) });
  await settle(80);
  browser.failUpdates = true; // the product page's own write never lands
  await pressAdd(page, 60);
  assert.equal(mapOf(browser).length, 0);
  var pending = JSON.parse(tab.session[Cart.PENDING_STORAGE_KEY]);
  assert.deepEqual(pending.map(function (record) { return [record.c, record.v]; }), [[CONFIG_336633, ROVER.blueBlack]]);
  page.win.close();
  browser.failUpdates = false;
  openPage(tab, {}); // /cart
  await settle(1200);
  assert.deepEqual(mapOf(browser).map(function (entry) { return entry.c; }), [CONFIG_336633]);
  assert.equal(tab.session[Cart.PENDING_STORAGE_KEY], undefined);
});

test("13. line and fallback both present: they name the same slot and config", { skip: skipDom }, async function () {
  var browser = newBrowser();
  var page = openPage(newTab(browser), { product: ROVER, search: calculatorSearch(CONFIG_336633) });
  await settle(80);
  await pressAdd(page, 1000);
  var item = browser.cart.items[0];
  var entry = mapOf(browser)[0];
  assert.deepEqual([entry.h, entry.c], [item.properties._oo_rx_handoff, item.properties._oo_rx_config]);
  assert.equal(mapOf(browser).length, 1, "one slot, not one from the line and one from the add");
});

test("8 (invariant). neither the line nor the map can hold the config: the page says so with Try again instead of continuing silently", { skip: skipDom }, async function () {
  var browser = newBrowser();
  browser.dropLineProperties = true;
  var page = openPage(newTab(browser), { product: ROVER, search: calculatorSearch(CONFIG_336633) });
  await settle(80);
  browser.failUpdates = true;
  var unsaved = [];
  page.doc.addEventListener(Cart.UNSAVED_EVENT, function (event) { unsaved.push(event.detail.config); });
  await pressAdd(page, 3200);
  assert.deepEqual(unsaved, [CONFIG_336633]);
  var status = page.doc.getElementById("oo-rx-handoff-status");
  assert.ok(status.classList.contains("is-error"));
  assert.match(status.textContent, /couldn't save your prescription with this mask/);
  browser.failUpdates = false;
  status.querySelector(".oo-rx-handoff-status__retry").click();
  await settle(1000);
  assert.deepEqual(mapOf(browser).map(function (entry) { return entry.c; }), [CONFIG_336633], "Try again writes the cart map");
});

// --- 14/15/16. several masks never cross ------------------------------------

test("14/16. two Rx masks with identical lens values on two configs: distinct slots, each config on its own line and slot", { skip: skipDom }, async function () {
  var browser = newBrowser();
  var one = openPage(newTab(browser), { product: ROVER, search: calculatorSearch(CONFIG_336633) });
  await settle(80);
  await pressAdd(one, 600);
  var two = openPage(newTab(browser), { product: TITAN, search: calculatorSearch(OTHER, TITAN.blueBlack) });
  await settle(80);
  await pressAdd(two, 1000);
  var lines = browser.cart.items.map(lineOf);
  assert.deepEqual(lines.map(function (line) { return [line.config, line.lenses]; }), [[CONFIG_336633, "-4.00/-4.00"], [OTHER, "-4.00/-4.00"]]);
  assert.notEqual(lines[0].slot, lines[1].slot);
  var map = mapOf(browser);
  assert.deepEqual(map.map(function (entry) { return [entry.h, entry.c, entry.p]; }), [
    [lines[0].slot, CONFIG_336633, ROVER.productId],
    [lines[1].slot, OTHER, TITAN.productId]
  ]);
});

test("15. two identical Rover masks, both losing their line properties: two map slots with the same product / variant (OO resolves neither by guessing)", { skip: skipDom }, async function () {
  var browser = newBrowser();
  browser.dropLineProperties = true;
  var one = openPage(newTab(browser), { product: ROVER, search: calculatorSearch(CONFIG_336633) });
  await settle(80);
  await pressAdd(one, 600);
  var two = openPage(newTab(browser), { product: ROVER, search: calculatorSearch(OTHER) });
  await settle(80);
  await pressAdd(two, 1000);
  var map = mapOf(browser);
  assert.equal(map.length, 2);
  assert.notEqual(map[0].h, map[1].h);
  assert.deepEqual(map.map(function (entry) { return [entry.c, entry.v]; }), [[CONFIG_336633, ROVER.blueBlack], [OTHER, ROVER.blueBlack]]);
  assert.deepEqual(durableReference(browser, browser.cart.items[0]).configs, [CONFIG_336633, OTHER], "ambiguous for OO: two configs for one product/variant");
});

test("an expectation never pairs with another variant's add, nor with a request carrying a different slot", function () {
  var view = {
    location: { href: "https://oceansoptics.com/products/x", origin: "https://oceansoptics.com" },
    document: { cookie: "" },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    URL: URL,
    fetch: function () { return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ items: [], attributes: {} }); } }); }
  };
  var handle = Cart.install(view, { now: function () { return 1000; } });
  assert.equal(Cart.expectAdd(view, { h: "0b7c1c55-55f4-4b7e-9d1a-2f3c4d5e6f70", c: CONFIG_336633, s: "lens_calculator_v53", p: "1", v: "11" }), true);
  assert.equal(Cart.expectAdd(view, { h: "not-a-uuid", c: CONFIG_336633, v: "11" }), false);
  assert.equal(Cart.expectAdd(view, { h: "1c8d2d66-66a5-4c8f-8e2b-3a4d5e6f7081", c: CONFIG_336633 }), false, "a variant is required");
  assert.deepEqual(Cart.addRequestItems(JSON.stringify({ items: [{ id: 22, properties: {} }, { id: 11, properties: { _oo_rx_handoff: "1c8d2d66-66a5-4c8f-8e2b-3a4d5e6f7081" } }] })).map(function (item) { return [item.v, item.h]; }),
    [["22", null], ["11", "1c8d2d66-66a5-4c8f-8e2b-3a4d5e6f7081"]]);
  assert.equal(handle.state.expected.length, 1);
});

// --- remembered calculator handoff: single use, compatible masks only -------

test("remembered calculator handoff: never on a non-Rx product, never twice, never once the cart holds the config", { skip: skipDom }, async function () {
  var browser = newBrowser();
  openPage(newTab(browser), { product: ROVER, search: calculatorSearch(CONFIG_336633) });
  await settle(80);
  var record = JSON.parse(browser.local.oo_rx_calculator_handoff);
  assert.deepEqual(Object.keys(record).sort(), ["calculatorVersion", "configId", "confirmedAt", "expiresAt", "recommendedLeft", "recommendedRight", "snapshot", "source", "version"]);
  assert.deepEqual([record.configId, record.source, record.recommendedRight, record.recommendedLeft, record.calculatorVersion], [CONFIG_336633, "lens_calculator_v53", -4, -4, "5.3.8"]);
  assert.doesNotMatch(browser.local.oo_rx_calculator_handoff, /"(sph|cyl|axis|confirmedRx|editToken|prescriptionLabel)"/);

  // 20. Vista (non-Rx, no lens selectors): untouched, nothing fetched, Add works.
  var vista = openPage(newTab(browser), { product: VISTA, rx: false, variant: VISTA.blueBlack, search: "?variant=" + VISTA.blueBlack });
  vista.win.OORxProductHandoff.start(vista.doc, { search: "", fetch: vista.win.fetch, timeoutMs: 50 });
  await settle(150);
  assert.equal(vista.summaries, 0);
  assert.equal(statusOf(vista), null);
  assert.equal(vista.win.OORxProductHandoff.isAddToCartHeld(vista.doc), false);
  await pressAdd(vista, 200);
  assert.deepEqual(lineOf(browser.cart.items[0]).config, null);
  assert.ok(browser.local.oo_rx_calculator_handoff, "a non-Rx add does not spend it");

  // A compatible Rx mask reached without the link gets it, once.
  var rover = openPage(newTab(browser), { product: ROVER, search: "?variant=" + ROVER.blueBlack });
  await settle(120);
  assert.equal(statusOf(rover), "is-success");
  await pressAdd(rover, 600);
  assert.equal(browser.cart.items[1].properties._oo_rx_config, CONFIG_336633);
  assert.equal(browser.local.oo_rx_calculator_handoff, undefined);

  var again = openPage(newTab(browser), { product: TITAN, search: "?variant=" + TITAN.blueBlack });
  await settle(120);
  assert.equal(again.summaries, 0, "spent: never applied to a second mask");
  assert.equal(statusOf(again), null);
});

test("remembered calculator handoff is not applied while the cart map already holds that config, and it expires", { skip: skipDom }, async function () {
  var browser = newBrowser();
  var now = Date.now();
  browser.local.oo_rx_calculator_handoff = JSON.stringify({ version: 1, configId: CONFIG_336633, source: "lens_calculator_v53", recommendedRight: -4, recommendedLeft: -4, calculatorVersion: "5.3.8", snapshot: null, confirmedAt: new Date(now).toISOString(), expiresAt: new Date(now + 3600000).toISOString() });
  browser.cart.items.push({ key: "1:k", product_id: Number(ROVER.productId), variant_id: Number(ROVER.blueBlack), quantity: 1, properties: { "(OD) Right": "-4.00", "(OS) Left": "-4.00" } });
  browser.cart.attributes._oo_rx_handoffs = Cart.serializeMap([{ h: "0b7c1c55-55f4-4b7e-9d1a-2f3c4d5e6f70", c: CONFIG_336633, s: "lens_calculator_v53", p: ROVER.productId, v: ROVER.blueBlack }]);
  var page = openPage(newTab(browser), { product: TITAN, search: "?variant=" + TITAN.blueBlack });
  await settle(150);
  assert.equal(page.summaries, 0);
  assert.equal(statusOf(page), null);
  assert.equal(browser.local.oo_rx_calculator_handoff, undefined, "already in the cart: spent");

  browser.local.oo_rx_calculator_handoff = JSON.stringify({ version: 1, configId: OTHER, source: "lens_calculator_v53", recommendedRight: -4, recommendedLeft: -4, calculatorVersion: "5.3.8", snapshot: null, confirmedAt: new Date(now - 80 * 3600000).toISOString(), expiresAt: new Date(now - 8 * 3600000).toISOString() });
  var expired = openPage(newTab(browser), { product: TITAN, search: "?variant=" + TITAN.blueBlack });
  await settle(150);
  assert.equal(expired.summaries, 0);
  assert.equal(browser.local.oo_rx_calculator_handoff, undefined);
});

test("remembered calculator handoff: Add is held while it is re-validated, then the config attaches", { skip: skipDom }, async function () {
  var browser = newBrowser();
  openPage(newTab(browser), { product: ROVER, search: calculatorSearch(CONFIG_336633) });
  await settle(80);
  var later = openPage(newTab(browser), { product: ROVER, search: "?variant=" + ROVER.blueBlack, summary: { delayMs: 300 } });
  await settle(60);
  await pressAdd(later, 20);
  assert.equal(browser.cart.adds.length, 0, "held while the remembered config loads");
  await settle(400);
  assert.equal(statusOf(later), "is-success");
  await pressAdd(later, 600);
  assert.equal(browser.cart.items[0].properties._oo_rx_config, CONFIG_336633);
});

test("the product handoff and cart guard store only opaque ids, tool names and Shopify ids", function () {
  [GUARD, HANDOFF].forEach(function (source) {
    assert.doesNotMatch(source, /setItem\([^)]*(sph|cyl|axis|label)/i);
  });
  assert.doesNotMatch(Handoff.UNSAVED_MESSAGE + Handoff.RETRY_LABEL, /[-‐-―]/, "no hyphens or dashes in customer copy");
});
