"use strict";

// Durable Rx handoff through the real Avis (Aris Product Options) + theme
// add-to-cart path (order #336204 regression). The live product page: Avis
// selects sit outside the product form and mirror their values into
// properties[...] inputs inside form[data-type="add-to-cart-form"]; the theme
// submit handler builds FormData from that form and POSTs /cart/add; a colour
// change rewrites the URL to "?variant=<id>". Runs the real handoff script in
// jsdom against a cart fixture; skipped when jsdom is not available
// (NODE_PATH=/path/to/node_modules node --test theme/).

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

var JSDOM = null;
try { JSDOM = require("jsdom").JSDOM; } catch (error) { JSDOM = null; }
var skipDom = JSDOM ? false : "jsdom is not installed";

var SCRIPT = fs.readFileSync(path.join(__dirname, "base", "assets", "oo-rx-product-handoff.js"), "utf8");
var HANDLE = "/products/rx-obsidian-farsighted-prescription-snorkel-scuba-dive-mask";
var CONFIG_A = "c89f8f67-acaa-4c8a-816d-dea96c1ea4b3";
var CONFIG_B = "3c40cb04-920e-4a03-b113-2db39b4acbff";
var POWERS = ["", "+1.00", "+2.00", "+3.00", "+4.00", "+5.00", "+6.00"];

function productHtml() {
  var options = POWERS.map(function (value) { return '<option value="' + value + '">' + (value || "Select") + "</option>"; }).join("");
  return [
    '<product-info class="product__info-container">',
    '<div class="app-avis-product-options-block"><div class="avpoptions-container__v2">',
    '<div class="avp-option"><select name="(OD) Right">' + options + "</select></div>",
    '<div class="avp-option"><select name="(OS) Left">' + options + "</select></div>",
    '<div class="avp-option"><select name="Snorkel"><option value="">None</option><option value="Dry Top [ $17.50 ]">Dry Top [ $17.50 ]</option></select></div>',
    '<div class="avp-option"><select name="Dry Top Color"><option value="">-</option><option value="Pink">Pink</option><option value="Black">Black</option></select></div>',
    '<div class="avp-option"><input type="file" class="avp-file__input"><input name="Upload" type="hidden"></div>',
    "</div></div>",
    '<form method="post" action="/cart/add" class="installment"><input type="hidden" name="id" value="53151486476621"></form>',
    '<form method="post" action="/cart/add" class="form" data-type="add-to-cart-form">',
    '<input type="hidden" name="form_type" value="product"><input type="hidden" name="id" value="53151486476621">',
    '<input type="hidden" name="product-id" value="10484822835533">',
    '<div class="apo-mirrors"></div>',
    '<button type="submit" name="add">Add to cart</button>',
    "</form>",
    "</product-info>",
    // A recommendation quick-add for ANOTHER product on the same page.
    '<form method="post" action="/cart/add" class="quick-add" id="quick-add"><input type="hidden" name="id" value="999"><input type="hidden" name="product-id" value="111"><button type="submit">Quick add</button></form>'
  ].join("");
}

// Avis behaviour: every option change rebuilds its property mirrors inside the
// product form, including _apo_options / _apo_addons.
function installAvis(win) {
  var doc = win.document;
  var root = doc.querySelector(".avpoptions-container__v2");
  function render() {
    var form = doc.querySelector('form[data-type="add-to-cart-form"]');
    var mirrors = form.querySelector(".apo-mirrors");
    var entries = [];
    var kept = [];
    // Avis updates its mirrors in place and drops ones no longer selected.
    function upsert(name, value) {
      var input = mirrors.querySelector('input[name="properties[' + name + ']"]');
      if (!input) {
        input = doc.createElement("input");
        input.type = "hidden";
        input.name = "properties[" + name + "]";
        mirrors.appendChild(input);
      }
      input.value = value;
      kept.push(input);
      return input;
    }
    function add(name, value) {
      upsert(name, value);
      entries.push({ name: name, value: value });
    }
    add("(OD) Right", root.querySelector('select[name="(OD) Right"]').value);
    add("_has_apo", "true");
    add("(OS) Left", root.querySelector('select[name="(OS) Left"]').value);
    var snorkel = root.querySelector('select[name="Snorkel"]').value;
    if (snorkel) {
      add("Snorkel", snorkel);
      var colour = root.querySelector('select[name="Dry Top Color"]').value;
      if (colour) add("Dry Top Color", colour);
      entries.push({ name: "_apo_addons", value: "17.5" });
      upsert("_apo_options", JSON.stringify(entries));
      upsert("_apo_addons", "17.5");
    }
    Array.prototype.forEach.call(mirrors.querySelectorAll("input"), function (input) {
      if (kept.indexOf(input) === -1) input.remove();
    });
  }
  root.addEventListener("change", render);
  render();
  return { render: render };
}

// Theme (Dawn product-form) behaviour: target-phase submit handler that
// builds FormData from the submitted form and POSTs /cart/add.
function installTheme(win) {
  win.document.addEventListener("submit", function () {}, false);
  Array.prototype.forEach.call(win.document.querySelectorAll('form[action="/cart/add"]'), function (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      win.fetch("/cart/add", { method: "POST", body: new win.FormData(form) });
    });
  });
}

function cartFixture() {
  var cart = { items: [], adds: [] };
  cart.add = function (formData) {
    var properties = {};
    var payload = [];
    formData.forEach(function (value, key) {
      payload.push([key, value]);
      var match = key.match(/^properties\[(.*)\]$/);
      if (match && value !== "") properties[match[1]] = value;
    });
    cart.adds.push(payload);
    cart.items.push({ id: Number(formData.get("id")), quantity: 1, properties: properties });
  };
  return cart;
}

function summaryFor(configId, overrides) {
  return Object.assign({
    configId: configId,
    status: "confirmed",
    recommendedRight: 2,
    recommendedLeft: 2,
    prescriptionAttached: false,
    prescriptionLabel: configId === CONFIG_A ? "QA Avis handoff" : "Second mask"
  }, overrides || {});
}

function loadProduct(search, options) {
  var settings = options || {};
  var cart = settings.cart || cartFixture();
  var dom = new JSDOM("<!doctype html><body>" + productHtml() + "</body>", {
    url: "https://oceansoptics.com" + HANDLE + search,
    runScripts: "outside-only",
    pretendToBeVisual: true
  });
  var win = dom.window;
  var summaries = [];
  win.fetch = function (url, init) {
    url = String(url);
    if (/\/api\/rx-config\/[^/]+\/summary$/.test(url)) {
      var id = decodeURIComponent(url.split("/api/rx-config/")[1].split("/")[0]);
      summaries.push(id);
      var body = (settings.summaries && settings.summaries[id]) || summaryFor(id);
      return Promise.resolve({ ok: !settings.failSummary, status: 200, json: function () { return Promise.resolve(body); } });
    }
    if (url === "/cart/add") {
      cart.add(init.body);
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve({}); } });
    }
    if (url === "/cart.js") return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ items: cart.items }); } });
    return Promise.reject(new Error("unexpected fetch " + url));
  };
  if (settings.journey) win.OOSourceJourney = settings.journey;
  var avis = installAvis(win);
  installTheme(win);
  win.eval(SCRIPT);
  return { win: win, doc: win.document, cart: cart, avis: avis, summaries: summaries };
}

function settle(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms || 30); });
}

function chooseAvis(page, name, value) {
  var select = page.doc.querySelector('select[name="' + name + '"]');
  select.value = value;
  select.dispatchEvent(new page.win.Event("change", { bubbles: true }));
}

// Theme colour change: new variant id, URL rewritten to ?variant=<id> only.
function changeColour(page, variantId) {
  page.doc.querySelector('form[data-type="add-to-cart-form"] input[name="id"]').value = variantId;
  page.win.history.replaceState({}, "", HANDLE + "?variant=" + variantId);
}

function addToCart(page) {
  page.doc.querySelector('form[data-type="add-to-cart-form"] button[name="add"]').click();
}

function ooProps(properties) {
  return {
    config: properties._oo_rx_config,
    source: properties._oo_source,
    prescription: properties.Prescription
  };
}

function search(configId, source) {
  return "?variant=53151486476621&oo_rx=" + configId + "&oo_source=" + source;
}

test("A/C/D/K. confirmed calculator handoff: payload and /cart.js line carry OO properties with Avis values untouched", { skip: skipDom }, async function () {
  var page = loadProduct(search(CONFIG_A, "lens_calculator_v53"));
  await settle();
  var form = page.doc.querySelector('form[data-type="add-to-cart-form"]');
  assert.equal(form.querySelector('input[name="properties[_oo_rx_config]"]').value, CONFIG_A, "A. the Avis form holds the config");
  changeColour(page, "53151486509389");
  chooseAvis(page, "Snorkel", "Dry Top [ $17.50 ]");
  chooseAvis(page, "Dry Top Color", "Pink");
  addToCart(page);
  await settle();
  var payload = page.cart.adds[0];
  var keys = payload.map(function (entry) { return entry[0]; });
  ["properties[_oo_rx_config]", "properties[_oo_source]", "properties[Prescription]"].forEach(function (key) {
    assert.ok(keys.indexOf(key) !== -1, "C. payload has " + key);
  });
  var cart = await page.win.fetch("/cart.js").then(function (r) { return r.json(); });
  assert.equal(cart.items.length, 1);
  var line = cart.items[0];
  assert.equal(line.id, 53151486509389, "the chosen colour variant");
  assert.deepEqual(ooProps(line.properties), { config: CONFIG_A, source: "lens_calculator_v53", prescription: "QA Avis handoff" }, "D");
  // K. Avis' own metadata is exactly what Avis wrote.
  assert.equal(line.properties["(OD) Right"], "+2.00");
  assert.equal(line.properties["(OS) Left"], "+2.00");
  assert.equal(line.properties._has_apo, "true");
  assert.equal(line.properties.Snorkel, "Dry Top [ $17.50 ]");
  assert.equal(line.properties["Dry Top Color"], "Pink");
  assert.equal(line.properties._apo_addons, "17.5");
  assert.deepEqual(JSON.parse(line.properties._apo_options), [
    { name: "(OD) Right", value: "+2.00" }, { name: "_has_apo", value: "true" }, { name: "(OS) Left", value: "+2.00" },
    { name: "Snorkel", value: "Dry Top [ $17.50 ]" }, { name: "Dry Top Color", value: "Pink" }, { name: "_apo_addons", value: "17.5" }
  ]);
  assert.equal(/_oo_/.test(line.properties._apo_options), false, "OO properties never enter _apo_options");
});

test("#336204 regression: a colour change keeps oo_rx in the URL, so a reload re-validates and still attaches the config", { skip: skipDom }, async function () {
  var page = loadProduct(search(CONFIG_A, "lens_calculator_v53"));
  await settle();
  changeColour(page, "53151486509389");
  var url = new URL(page.win.location.href);
  assert.equal(url.searchParams.get("variant"), "53151486509389");
  assert.equal(url.searchParams.get("oo_rx"), CONFIG_A);
  assert.equal(url.searchParams.get("oo_source"), "lens_calculator_v53");

  // Reload / back-forward / restored tab: a fresh page from the kept URL.
  var reloaded = loadProduct(url.search, { cart: page.cart });
  await settle();
  assert.deepEqual(reloaded.summaries, [CONFIG_A], "the config is fetched and validated again");
  chooseAvis(reloaded, "Snorkel", "Dry Top [ $17.50 ]");
  addToCart(reloaded);
  await settle();
  assert.deepEqual(ooProps(page.cart.items[0].properties), { config: CONFIG_A, source: "lens_calculator_v53", prescription: "QA Avis handoff" });
});

test("B. Avis / theme re-rendering the form after the handoff does not lose the OO properties", { skip: skipDom }, async function () {
  var page = loadProduct(search(CONFIG_A, "lens_calculator_v53"));
  await settle();
  var form = page.doc.querySelector('form[data-type="add-to-cart-form"]');
  // Re-render strips every hidden input except the theme's own.
  Array.prototype.forEach.call(form.querySelectorAll('input[name^="properties["]'), function (input) { input.remove(); });
  page.avis.render();
  assert.equal(form.querySelector('input[name="properties[_oo_rx_config]"]'), null, "the re-render removed them");
  addToCart(page);
  await settle();
  assert.deepEqual(ooProps(page.cart.items[0].properties), { config: CONFIG_A, source: "lens_calculator_v53", prescription: "QA Avis handoff" });
  assert.equal(page.cart.items[0].properties["(OD) Right"], "+2.00");
});

test("E. direct product visit with no oo_rx: Avis add works and no OO properties are attached", { skip: skipDom }, async function () {
  var page = loadProduct("?variant=53151486476621");
  await settle();
  chooseAvis(page, "(OD) Right", "+2.00");
  chooseAvis(page, "(OS) Left", "+2.00");
  changeColour(page, "53151486509389");
  assert.equal(new URL(page.win.location.href).searchParams.has("oo_rx"), false, "the URL is not given a config");
  addToCart(page);
  await settle();
  assert.deepEqual(page.summaries, []);
  var properties = page.cart.items[0].properties;
  assert.equal(properties["(OD) Right"], "+2.00");
  assert.equal(Object.keys(properties).some(function (key) { return /^_oo_|^Prescription$/.test(key); }), false);
});

test("F. draft, mismatched or unavailable configs never attach a stale config, at load or at submit", { skip: skipDom }, async function () {
  var cases = [
    { summaries: (function () { var s = {}; s[CONFIG_A] = summaryFor(CONFIG_A, { status: "draft" }); return s; })() },
    { summaries: (function () { var s = {}; s[CONFIG_A] = summaryFor(CONFIG_B); return s; })() },
    { failSummary: true }
  ];
  for (var i = 0; i < cases.length; i += 1) {
    var page = loadProduct(search(CONFIG_A, "lens_calculator_v53"), cases[i]);
    await settle();
    chooseAvis(page, "(OD) Right", "+2.00");
    chooseAvis(page, "(OS) Left", "+2.00");
    changeColour(page, "53151486509389");
    assert.equal(new URL(page.win.location.href).searchParams.has("oo_rx"), false, "a failed handoff is not kept in the URL");
    addToCart(page);
    await settle();
    var properties = page.cart.items[0].properties;
    assert.equal(properties._oo_rx_config, undefined, "case " + i);
    assert.equal(properties._oo_source, undefined, "case " + i);
    assert.equal(page.doc.getElementById("oo-rx-handoff-status").classList.contains("is-error"), true);
  }
});

test("G/H. Lens Calculator and Quiz sources are preserved on the line", { skip: skipDom }, async function () {
  for (var source of ["lens_calculator_v53", "quiz_v53"]) {
    var page = loadProduct(search(CONFIG_A, source));
    await settle();
    changeColour(page, "53151486509389");
    assert.equal(new URL(page.win.location.href).searchParams.get("oo_source"), source);
    addToCart(page);
    await settle();
    assert.equal(page.cart.items[0].properties._oo_source, source);
    assert.equal(page.cart.items[0].properties._oo_rx_config, CONFIG_A);
  }
});

test("I. Product Rx Checker: the on-page handoff keeps product_rx_checker through a colour change and reload", { skip: skipDom }, async function () {
  var page = loadProduct("?variant=53151486476621");
  await settle();
  var api = page.win.OORxProductHandoff;
  var controls = await api.waitForAvisControls(page.doc);
  api.applyConfirmedHandoff(page.doc, controls, summaryFor(CONFIG_B), "product_rx_checker");
  var url = new URL(page.win.location.href);
  assert.equal(url.searchParams.get("oo_rx"), CONFIG_B, "the applied config is kept in the URL");
  assert.equal(url.searchParams.get("oo_source"), "product_rx_checker");
  changeColour(page, "53151486509389");
  assert.equal(new URL(page.win.location.href).searchParams.get("oo_rx"), CONFIG_B);
  addToCart(page);
  await settle();
  assert.deepEqual(ooProps(page.cart.items[0].properties), { config: CONFIG_B, source: "product_rx_checker", prescription: "Second mask" });

  var reloaded = loadProduct(new URL(page.win.location.href).search);
  await settle();
  addToCart(reloaded);
  await settle();
  assert.deepEqual(ooProps(reloaded.cart.items[0].properties), { config: CONFIG_B, source: "product_rx_checker", prescription: "Second mask" });
});

test("J. two masks with different configs keep independent per-line UUIDs", { skip: skipDom }, async function () {
  var cart = cartFixture();
  var first = loadProduct(search(CONFIG_A, "lens_calculator_v53"), { cart: cart });
  await settle();
  addToCart(first);
  await settle();
  var second = loadProduct(search(CONFIG_B, "quiz_v53"), { cart: cart });
  await settle();
  changeColour(second, "53151486509389");
  addToCart(second);
  await settle();
  // Same page, a checker re-apply for another person replaces the active config.
  var api = second.win.OORxProductHandoff;
  api.applyConfirmedHandoff(second.doc, await api.waitForAvisControls(second.doc), summaryFor(CONFIG_A, { prescriptionLabel: "Third" }), "product_rx_checker");
  addToCart(second);
  await settle();
  assert.deepEqual(cart.items.map(function (item) { return ooProps(item.properties); }), [
    { config: CONFIG_A, source: "lens_calculator_v53", prescription: "QA Avis handoff" },
    { config: CONFIG_B, source: "quiz_v53", prescription: "Second mask" },
    { config: CONFIG_A, source: "product_rx_checker", prescription: "Third" }
  ]);
});

test("another product's quick-add form on the page never receives the mask's OO properties", { skip: skipDom }, async function () {
  var page = loadProduct(search(CONFIG_A, "lens_calculator_v53"));
  await settle();
  page.doc.querySelector("#quick-add button").click();
  await settle();
  assert.equal(page.cart.items[0].id, 999);
  assert.deepEqual(page.cart.items[0].properties, {});
});

test("the URL hook only touches this product's own URL and never replaces an explicit oo_rx", { skip: skipDom }, async function () {
  var page = loadProduct(search(CONFIG_A, "lens_calculator_v53"));
  await settle();
  var api = page.win.OORxProductHandoff;
  assert.equal(api.withHandoffParameters(page.win, "/products/other?variant=1"), "/products/other?variant=1");
  assert.equal(api.withHandoffParameters(page.win, "https://example.com" + HANDLE), "https://example.com" + HANDLE);
  assert.equal(api.withHandoffParameters(page.win, HANDLE + "?oo_rx=" + CONFIG_B), HANDLE + "?oo_rx=" + CONFIG_B);
  assert.equal(api.withHandoffParameters(page.win, undefined), undefined);
  page.win.history.pushState(null, "", HANDLE + "?variant=2#media");
  assert.equal(page.win.location.search, "?variant=2&oo_rx=" + CONFIG_A + "&oo_source=lens_calculator_v53");
  assert.equal(page.win.location.hash, "#media");
});

test("no edit tokens, storage paths or backend internals are written to the line", { skip: skipDom }, async function () {
  var leaky = summaryFor(CONFIG_A, { editToken: "secret-edit", storagePath: "rx/abc.jpg", extraction: { model: "x" } });
  var summaries = {};
  summaries[CONFIG_A] = leaky;
  var page = loadProduct(search(CONFIG_A, "lens_calculator_v53"), { summaries: summaries });
  await settle();
  addToCart(page);
  await settle();
  var text = JSON.stringify(page.cart.items[0].properties);
  ["secret-edit", "rx/abc.jpg", "extraction"].forEach(function (needle) { assert.equal(text.indexOf(needle), -1, needle); });
});
