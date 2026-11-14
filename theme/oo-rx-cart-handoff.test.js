"use strict";

// Durable Rx handoff in the cart (production order #336589).
//
// Live store, 2026-11-14 (reproduced in Chrome against oceansoptics.com with
// the Rx backend faked): a mask added with _oo_rx_config / _oo_source /
// Prescription keeps them on the cart line, but Avis "Edit options" -> "Save
// changes" posts /cart/change.js with ONLY Avis' own option properties, and
// Shopify replaces the line's whole property set. Every OO property vanished
// while the cart attributes (journey) survived: exactly #336589.
//
// oo-rx-cart-handoff.js restores the edited line's own OO properties and keeps
// a per-slot cart attribute fallback. Runs in jsdom when available
// (NODE_PATH=/path/to/node_modules node --test theme/).

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

var JSDOM = null;
try { JSDOM = require("jsdom").JSDOM; } catch (error) { JSDOM = null; }
var skipDom = JSDOM ? false : "jsdom is not installed";

var GUARD_PATH = path.join(__dirname, "base", "assets", "oo-rx-cart-handoff.js");
var GUARD = fs.readFileSync(GUARD_PATH, "utf8");
var HANDOFF = fs.readFileSync(path.join(__dirname, "base", "assets", "oo-rx-product-handoff.js"), "utf8");
var Cart = require(GUARD_PATH);

// #336589's two real configs (opaque ids; no prescription values here).
var ANDREW = "b590bd62-bf73-43be-a93b-6017373c5152";
var REBEKAH = "60c158af-404c-4ef1-9bf7-3de8a6125af7";
var SLOT_1 = "0b7c1c55-55f4-4b7e-9d1a-2f3c4d5e6f70";
var SLOT_2 = "1c8d2d66-66a5-4c8f-8e2b-3a4d5e6f7081";
var OBSIDIAN = "9735936803149";
var ROVER = "9735936901111";
var OBSIDIAN_AQUA = "50148670734669";
var ROVER_PINK = "50148671111111";
var V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function line(key, productId, variantId, properties) {
  return { key: key, product_id: Number(productId), variant_id: Number(variantId), quantity: 1, properties: properties };
}

function rxProps(config, slot, label, extra) {
  return Object.assign({
    "(OD) Right": "-1.00",
    "(OS) Left": "-1.00",
    "_has_apo": "true",
    "Snorkel": "Dry Top [ $17.50 ]",
    "_apo_options": "[]",
    "_oo_rx_config": config,
    "_oo_rx_handoff": slot,
    "_oo_source": "product_rx_checker",
    "_oo_first_source": "product_rx_checker",
    "_oo_source_history": "product_rx_checker",
    "Prescription": label
  }, extra || {});
}

// The exact /cart/change.js body Avis "Save changes" sent on the live store.
function avisEditBody(FormDataImpl, key, overrides) {
  var body = new FormDataImpl();
  var values = Object.assign({ right: "-1.00", left: "-1.00", colour: "Pink" }, overrides || {});
  body.append("(OD) Right", values.right);
  body.append("(OS) Left", values.left);
  body.append("Snorkel", "Classic [ $12.50 ]");
  body.append("Classic Snorkel Color", values.colour);
  body.append("Case", "Rx Obsidian Mask Case [ $10.00 ]");
  body.append("id", key);
  body.append("cartitem-final-price", "9250");
  body.append("properties[(OD) Right]", values.right);
  body.append("properties[_has_apo]", "true");
  body.append("properties[(OS) Left]", values.left);
  body.append("properties[Snorkel]", "Classic [ $12.50 ]");
  body.append("properties[Classic Snorkel Color]", values.colour);
  body.append("properties[Case]", "Rx Obsidian Mask Case [ $10.00 ]");
  body.append("properties[_apo_options]", "[]");
  return body;
}

function bodyProperties(body) {
  var out = {};
  body.forEach(function (value, name) {
    var match = name.match(/^properties\[(.*)\]$/);
    if (match) out[match[1]] = value;
  });
  return out;
}

// --- line guard ---------------------------------------------------------------

test("#336589 root cause: an Avis edit body restores the edited line's own OO properties (and only those)", function () {
  var cart = { items: [line(OBSIDIAN_AQUA + ":aaa", OBSIDIAN, OBSIDIAN_AQUA, rxProps(ANDREW, SLOT_1, "Andrew"))] };
  var result = Cart.guardChangeBody(cart, avisEditBody(FormData, OBSIDIAN_AQUA + ":aaa"));
  var props = bodyProperties(result.body);
  assert.equal(props._oo_rx_config, ANDREW);
  assert.equal(props._oo_rx_handoff, SLOT_1);
  assert.equal(props._oo_source, "product_rx_checker");
  assert.equal(props._oo_first_source, "product_rx_checker");
  assert.equal(props._oo_source_history, "product_rx_checker");
  assert.equal(props.Prescription, "Andrew");
  // Avis' own edit stands: the customer's new choice is never reverted.
  assert.equal(props["Classic Snorkel Color"], "Pink");
  assert.equal(props["(OD) Right"], "-1.00");
  assert.deepEqual(result.restored.sort(), ["Prescription", "_oo_first_source", "_oo_rx_config", "_oo_rx_handoff", "_oo_source", "_oo_source_history"]);
});

test("the guard targets the exact cart key: two identical masks keep their own configs", function () {
  var cart = { items: [
    line(OBSIDIAN_AQUA + ":aaa", OBSIDIAN, OBSIDIAN_AQUA, rxProps(ANDREW, SLOT_1, "Andrew")),
    line(OBSIDIAN_AQUA + ":bbb", OBSIDIAN, OBSIDIAN_AQUA, rxProps(REBEKAH, SLOT_2, "Rebekah"))
  ] };
  var second = bodyProperties(Cart.guardChangeBody(cart, avisEditBody(FormData, OBSIDIAN_AQUA + ":bbb")).body);
  assert.equal(second._oo_rx_config, REBEKAH);
  assert.equal(second._oo_rx_handoff, SLOT_2);
  assert.equal(second.Prescription, "Rebekah");
  var first = bodyProperties(Cart.guardChangeBody(cart, avisEditBody(FormData, OBSIDIAN_AQUA + ":aaa")).body);
  assert.equal(first._oo_rx_config, ANDREW);
});

test("identical lens values on two configs never cross: the key, not the lenses, picks the line", function () {
  var cart = { items: [
    line(ROVER_PINK + ":r1", ROVER, ROVER_PINK, rxProps(ANDREW, SLOT_1, "A")),
    line(ROVER_PINK + ":r2", ROVER, ROVER_PINK, rxProps(REBEKAH, SLOT_2, "B"))
  ] };
  ["r1", "r2"].forEach(function (suffix, index) {
    var props = bodyProperties(Cart.guardChangeBody(cart, avisEditBody(FormData, ROVER_PINK + ":" + suffix)).body);
    assert.equal(props._oo_rx_config, [ANDREW, REBEKAH][index]);
  });
});

test("the guard never overrides what the request sets, never touches removals or lines without a config", function () {
  var cart = { items: [
    line(OBSIDIAN_AQUA + ":aaa", OBSIDIAN, OBSIDIAN_AQUA, rxProps(ANDREW, SLOT_1, "Andrew")),
    line("777:plain", "111", "777", { "(OD) Right": "-2.00" })
  ] };
  var own = avisEditBody(FormData, OBSIDIAN_AQUA + ":aaa");
  own.append("properties[Prescription]", "Renamed by the customer");
  assert.equal(bodyProperties(Cart.guardChangeBody(cart, own).body).Prescription, "Renamed by the customer");

  var removal = new FormData();
  removal.append("id", OBSIDIAN_AQUA + ":aaa");
  removal.append("quantity", "0");
  assert.deepEqual(Cart.guardChangeBody(cart, removal).restored, []);

  var quantityOnly = new FormData();
  quantityOnly.append("id", OBSIDIAN_AQUA + ":aaa");
  quantityOnly.append("quantity", "2");
  assert.deepEqual(Cart.guardChangeBody(cart, quantityOnly).restored, [], "a quantity change keeps Shopify's properties by itself");

  var plain = Cart.guardChangeBody(cart, avisEditBody(FormData, "777:plain"));
  assert.deepEqual(plain.restored, []);
  assert.equal(bodyProperties(plain.body)._oo_rx_config, undefined, "an accessory/plain line never receives a config");

  var unknown = Cart.guardChangeBody(cart, avisEditBody(FormData, "999:gone"));
  assert.deepEqual(unknown.restored, []);
});

test("JSON, urlencoded and line-number change requests are guarded too", function () {
  var cart = { items: [
    line("777:plain", "111", "777", {}),
    line(OBSIDIAN_AQUA + ":aaa", OBSIDIAN, OBSIDIAN_AQUA, rxProps(ANDREW, SLOT_1, "Andrew"))
  ] };
  var json = JSON.parse(Cart.guardChangeBody(cart, JSON.stringify({ id: OBSIDIAN_AQUA + ":aaa", properties: { "(OD) Right": "-1.50" } })).body);
  assert.equal(json.properties._oo_rx_config, ANDREW);
  assert.equal(json.properties["(OD) Right"], "-1.50");
  var byLine = JSON.parse(Cart.guardChangeBody(cart, JSON.stringify({ line: 2, quantity: 1, properties: {} })).body);
  assert.equal(byLine.properties._oo_rx_handoff, SLOT_1);
  var encoded = new URLSearchParams(Cart.guardChangeBody(cart, "id=" + encodeURIComponent(OBSIDIAN_AQUA + ":aaa") + "&properties%5BSnorkel%5D=None").body);
  assert.equal(encoded.get("properties[_oo_rx_config]"), ANDREW);
  // A variant id targets Shopify's first line of that variant.
  var byVariant = Cart.guardChangeBody(cart, JSON.stringify({ id: Number(OBSIDIAN_AQUA), properties: {} }));
  assert.equal(JSON.parse(byVariant.body).properties._oo_rx_config, ANDREW);
});

// --- cart-level fallback map --------------------------------------------------

test("the cart map records one slot per line: two people, two configs, two masks (#336589 shape)", function () {
  var cart = { attributes: {}, items: [
    line(OBSIDIAN_AQUA + ":aaa", OBSIDIAN, OBSIDIAN_AQUA, rxProps(ANDREW, SLOT_1, "Andrew")),
    line(ROVER_PINK + ":rrr", ROVER, ROVER_PINK, rxProps(REBEKAH, SLOT_2, "Rebekah", { "(OD) Right": "-3.50", "(OS) Left": "-4.00" }))
  ] };
  var entries = Cart.reconcileEntries([], cart);
  assert.deepEqual(entries, [
    { h: SLOT_1, c: ANDREW, s: "product_rx_checker", p: OBSIDIAN, v: OBSIDIAN_AQUA },
    { h: SLOT_2, c: REBEKAH, s: "product_rx_checker", p: ROVER, v: ROVER_PINK }
  ]);
  var text = Cart.serializeMap(entries);
  assert.doesNotMatch(text, /Andrew|Rebekah|-3\.50|-4\.00|Prescription|http/i, "no labels, lens values or URLs in the cart attribute");
  assert.deepEqual(Cart.parseMap(text), entries);
});

test("a slot survives its line losing every property while that product is still in the cart", function () {
  var before = { items: [
    line(OBSIDIAN_AQUA + ":aaa", OBSIDIAN, OBSIDIAN_AQUA, rxProps(ANDREW, SLOT_1, "Andrew")),
    line(ROVER_PINK + ":rrr", ROVER, ROVER_PINK, rxProps(REBEKAH, SLOT_2, "Rebekah"))
  ] };
  var entries = Cart.reconcileEntries([], before);
  // An unguarded edit (the #336589 failure): both lines rebuilt with Avis props only.
  var stripped = { items: [
    line(OBSIDIAN_AQUA + ":new1", OBSIDIAN, OBSIDIAN_AQUA, { "(OD) Right": "-1.00", "(OS) Left": "-1.00", "_has_apo": "true" }),
    line(ROVER_PINK + ":new2", ROVER, ROVER_PINK, { "(OD) Right": "-3.50", "(OS) Left": "-4.00", "_has_apo": "true" })
  ] };
  assert.deepEqual(Cart.reconcileEntries(entries, stripped), entries);
});

test("a slot is dropped once its product has left the cart, so a later plain mask never inherits it", function () {
  var entries = [{ h: SLOT_1, c: ANDREW, s: "product_rx_checker", p: OBSIDIAN, v: OBSIDIAN_AQUA }];
  assert.deepEqual(Cart.reconcileEntries(entries, { items: [] }), []);
  assert.deepEqual(Cart.reconcileEntries(entries, { items: [line(ROVER_PINK + ":x", ROVER, ROVER_PINK, {})] }), []);
});

test("the map is validated and bounded", function () {
  assert.deepEqual(Cart.parseMap("not json"), []);
  assert.deepEqual(Cart.parseMap(JSON.stringify({ v: 2, h: [] })), []);
  assert.deepEqual(Cart.parseMap(JSON.stringify({ v: 1, h: [{ h: "x", c: ANDREW }, { h: SLOT_1, c: "nope" }] })), []);
  var many = [];
  for (var i = 0; i < 20; i += 1) {
    var slot = Cart.newHandoffId();
    assert.match(slot, V4);
    many.push(line("1:" + i, "5", "1", rxProps(ANDREW, slot, "x")));
  }
  assert.equal(Cart.reconcileEntries([], { items: many }).length, Cart.MAX_ENTRIES);
});

// --- storefront end to end (jsdom) -------------------------------------------

var POWERS = ["", "-1.00", "-3.50", "-4.00"];

function productHtml(productId, variantId) {
  var options = POWERS.map(function (value) { return '<option value="' + value + '">' + (value || "Select") + "</option>"; }).join("");
  return [
    '<product-info class="product__info-container"><div class="app-avis-product-options-block"><div class="avpoptions-container__v2">',
    '<div class="avp-option"><select name="(OD) Right">' + options + "</select></div>",
    '<div class="avp-option"><select name="(OS) Left">' + options + "</select></div>",
    "</div></div>",
    '<form method="post" action="/cart/add" data-type="add-to-cart-form">',
    '<input type="hidden" name="id" value="' + variantId + '"><input type="hidden" name="product-id" value="' + productId + '">',
    '<div class="apo-mirrors"></div><button type="submit" name="add">Add to cart</button></form></product-info>'
  ].join("");
}

// A Shopify-like cart: line key = variant + hash of properties; /cart/change
// with properties REPLACES the property set (that is what lost #336589).
function storeCart() {
  var store = { items: [], attributes: {}, changes: [] };
  var counter = 0;
  function propsOf(formData) {
    var properties = {};
    formData.forEach(function (value, name) {
      var match = name.match(/^properties\[(.*)\]$/);
      if (match && value !== "") properties[match[1]] = value;
    });
    return properties;
  }
  store.add = function (formData, productId) {
    counter += 1;
    var variant = String(formData.get("id"));
    store.items.push(line(variant + ":k" + counter, productId, variant, propsOf(formData)));
  };
  store.change = function (body) {
    var formData = body;
    store.changes.push(bodyProperties(formData));
    var key = String(formData.get("id"));
    var item = store.items.find(function (candidate) { return candidate.key === key; });
    if (!item) return;
    counter += 1;
    item.properties = propsOf(formData);
    item.key = item.variant_id + ":k" + counter;
  };
  store.snapshot = function () { return JSON.parse(JSON.stringify({ items: store.items, attributes: store.attributes })); };
  return store;
}

function response(body) {
  return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(body); } });
}

function loadPage(store, options) {
  var settings = options || {};
  var html = settings.product ? productHtml(settings.product, settings.variant) : "<div>cart</div>";
  var dom = new JSDOM("<!doctype html><body>" + html + "</body>", {
    url: "https://oceansoptics.com" + (settings.path || "/cart") + (settings.search || ""),
    runScripts: "outside-only",
    pretendToBeVisual: true
  });
  var win = dom.window;
  win.document.cookie = "cart=test-cart-token";
  win.fetch = function (url, init) {
    url = String(url);
    if (/\/summary$/.test(url)) {
      var id = url.split("/api/rx-config/")[1].split("/")[0];
      return response(settings.summaries[id]);
    }
    if (url === "/cart.js") return response(store.snapshot());
    if (url === "/cart/add") { store.add(init.body, settings.product); return response({}); }
    if (url === "/cart/change.js") { store.change(init.body); return response(store.snapshot()); }
    if (url === "/cart/update.js") {
      Object.assign(store.attributes, JSON.parse(init.body).attributes);
      return response(store.snapshot());
    }
    return Promise.reject(new Error("unexpected " + url));
  };
  // A jQuery-style XHR, as Avis' mini cart may use.
  function FakeXHR() { this.listeners = {}; }
  FakeXHR.prototype.open = function (method, url) { this.method = method; this.url = url; };
  FakeXHR.prototype.addEventListener = function (type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); };
  FakeXHR.prototype.send = function (body) {
    var xhr = this;
    if (xhr.url === "/cart/change.js") store.change(body);
    setTimeout(function () { (xhr.listeners.loadend || []).forEach(function (fn) { fn(); }); }, 0);
  };
  win.XMLHttpRequest = FakeXHR;
  // The guard is in <head>, before the apps and the product handoff.
  win.eval(GUARD);
  if (settings.product) {
    // Avis mirrors each lens select into a properties[...] input in the form.
    var avisRoot = win.document.querySelector(".avpoptions-container__v2");
    var mirrors = win.document.querySelector(".apo-mirrors");
    var mirror = function () {
      ["(OD) Right", "(OS) Left"].forEach(function (name) {
        var input = mirrors.querySelector('input[name="properties[' + name + ']"]');
        if (!input) {
          input = win.document.createElement("input");
          input.type = "hidden";
          input.name = "properties[" + name + "]";
          mirrors.appendChild(input);
        }
        input.value = avisRoot.querySelector('select[name="' + name + '"]').value;
      });
    };
    avisRoot.addEventListener("change", mirror);
    mirror();
    win.eval(HANDOFF);
    win.document.addEventListener("submit", function (event) {
      event.preventDefault();
      win.fetch("/cart/add", { method: "POST", body: new win.FormData(event.target) });
    });
  }
  return { win: win, doc: win.document };
}

function settle(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms || 40); });
}

function summary(configId, right, left, label) {
  return { configId: configId, status: "confirmed", recommendedRight: right, recommendedLeft: left, prescriptionAttached: false, prescriptionLabel: label };
}

async function addMask(store, productId, variantId, configId, right, left, label) {
  var summaries = {};
  summaries[configId] = summary(configId, right, left, label);
  var page = loadPage(store, {
    product: productId, variant: variantId, path: "/products/p" + productId,
    search: "?oo_rx=" + configId + "&oo_source=product_rx_checker", summaries: summaries
  });
  await settle();
  page.doc.querySelector('button[name="add"]').click();
  await settle();
  return page;
}

function ooOf(item) {
  return { config: item.properties._oo_rx_config || null, slot: item.properties._oo_rx_handoff || null, label: item.properties.Prescription || null };
}

test("E2E #336589: two masks, two people, Avis edits both lines in the cart, every config stays on its own mask", { skip: skipDom }, async function () {
  var store = storeCart();
  await addMask(store, OBSIDIAN, OBSIDIAN_AQUA, ANDREW, -1, -1, "Andrew");
  await addMask(store, ROVER, ROVER_PINK, REBEKAH, -3.5, -4, "Rebekah");
  var slots = store.items.map(function (item) { return item.properties._oo_rx_handoff; });
  assert.ok(slots.every(function (slot) { return V4.test(slot); }));
  assert.notEqual(slots[0], slots[1]);

  var cartPage = loadPage(store);
  await settle(80);
  // Avis "Save changes" on each line: fetch for the first, XHR for the second.
  await cartPage.win.fetch("/cart/change.js", { method: "POST", body: avisEditBody(cartPage.win.FormData, store.items[0].key) });
  var xhr = new cartPage.win.XMLHttpRequest();
  xhr.open("POST", "/cart/change.js");
  xhr.send(avisEditBody(cartPage.win.FormData, store.items[1].key, { right: "-3.50", left: "-4.00", colour: "Black" }));
  await settle(600);

  assert.deepEqual(store.items.map(ooOf), [
    { config: ANDREW, slot: slots[0], label: "Andrew" },
    { config: REBEKAH, slot: slots[1], label: "Rebekah" }
  ]);
  assert.equal(store.items[0].properties["Classic Snorkel Color"], "Pink", "the customer's edit is applied");
  assert.deepEqual(Cart.parseMap(store.attributes._oo_rx_handoffs), [
    { h: slots[0], c: ANDREW, s: "product_rx_checker", p: OBSIDIAN, v: OBSIDIAN_AQUA },
    { h: slots[1], c: REBEKAH, s: "product_rx_checker", p: ROVER, v: ROVER_PINK }
  ]);
});

test("E2E: two identical masks with different configs get distinct slots and stay separate through edits", { skip: skipDom }, async function () {
  var store = storeCart();
  await addMask(store, OBSIDIAN, OBSIDIAN_AQUA, ANDREW, -1, -1, "Andrew");
  await addMask(store, OBSIDIAN, OBSIDIAN_AQUA, REBEKAH, -1, -1, "Rebekah");
  var before = store.items.map(ooOf);
  assert.notEqual(before[0].slot, before[1].slot);
  var cartPage = loadPage(store);
  await settle(80);
  await cartPage.win.fetch("/cart/change.js", { method: "POST", body: avisEditBody(cartPage.win.FormData, store.items[1].key) });
  await cartPage.win.fetch("/cart/change.js", { method: "POST", body: avisEditBody(cartPage.win.FormData, store.items[0].key) });
  await settle(600);
  assert.deepEqual(store.items.map(ooOf), before);
  assert.equal(Cart.parseMap(store.attributes._oo_rx_handoffs).length, 2);
});

test("E2E: the same config added twice from one page gets a new slot per cart line", { skip: skipDom }, async function () {
  var store = storeCart();
  var page = await addMask(store, OBSIDIAN, OBSIDIAN_AQUA, ANDREW, -1, -1, "Andrew");
  page.doc.querySelector('button[name="add"]').click();
  await settle();
  assert.equal(store.items.length, 2);
  assert.equal(store.items[0].properties._oo_rx_config, ANDREW);
  assert.equal(store.items[1].properties._oo_rx_config, ANDREW);
  assert.notEqual(store.items[0].properties._oo_rx_handoff, store.items[1].properties._oo_rx_handoff);
});

test("E2E: without the guard, the same Avis edit strips the line (documents the #336589 failure)", { skip: skipDom }, async function () {
  var store = storeCart();
  await addMask(store, OBSIDIAN, OBSIDIAN_AQUA, ANDREW, -1, -1, "Andrew");
  store.change(avisEditBody(FormData, store.items[0].key));
  assert.deepEqual(ooOf(store.items[0]), { config: null, slot: null, label: null });
});

test("the guard is loaded on every storefront page before the apps, and the product handoff stays product-only", function () {
  var layout = fs.readFileSync(path.join(__dirname, "base", "layout", "theme.liquid"), "utf8");
  var guardTag = layout.indexOf("oo-rx-cart-handoff.js");
  assert.ok(guardTag > 0, "guard script is in the layout");
  assert.ok(guardTag < layout.indexOf("{{ content_for_header }}"), "guard loads before app scripts (content_for_header)");
  assert.doesNotMatch(layout.slice(Math.max(0, guardTag - 200), guardTag), /request\.page_type/, "guard is not limited to one page type");
  assert.doesNotMatch(layout.slice(guardTag - 80, guardTag + 80), /defer|async/, "guard runs synchronously, before apps capture fetch");
  assert.match(layout, /request\.page_type == 'product' -%}\s*<script src="{{ 'oo-rx-product-handoff\.js' \| asset_url }}" defer="defer"><\/script>/);
});

test("the guard stores no secrets, prescription values or URLs", function () {
  assert.doesNotMatch(GUARD, /editToken|storage_?path|signed|service[_-]?role|Authorization|localStorage\.setItem/i);
});
