"use strict";

// Storefront Rx handoff lifecycle (Phase 3). Every journey runs the real
// oo-rx-product-handoff.js (and, for checker journeys, the real Product Rx
// Checker) in jsdom against the live Avis / theme / cart behaviour: Avis
// mirrors its options into form[data-type="add-to-cart-form"], the theme
// POSTs that form as FormData to /cart/add and then leaves for /cart, and a
// colour change rewrites the URL to "?variant=<id>". One "tab" carries the
// cart and sessionStorage across page loads, so reload, back/forward, second
// masks and returning visits are real fresh page loads in the same tab.
// Skipped when jsdom is not available
// (NODE_PATH=/path/to/node_modules node --test theme/).
//
// The contract under test:
//   Active Rx handoff  = this page's oo_rx link (validated again on every
//                        load) or an explicit on-page checker apply.
//   Attribution        = _oo_first_source / _oo_source_history / quiz_*;
//                        never activates a prescription.
//   Per-line provenance = _oo_rx_config + _oo_source on the MASK line.

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

var JSDOM = null;
try { JSDOM = require("jsdom").JSDOM; } catch (error) { JSDOM = null; }
var skipDom = JSDOM ? false : "jsdom is not installed";

var ASSETS = path.join(__dirname, "base", "assets");
var SCRIPT = fs.readFileSync(path.join(ASSETS, "oo-rx-product-handoff.js"), "utf8");
var Products = require("./base/assets/oo-lens-calculator-v53-products.js");

var FAR = { path: "/products/rx-obsidian-farsighted-prescription-snorkel-scuba-dive-mask", productId: "10484822835533", variant: "53151486476621", pink: "53151486509389", powers: ["+1.00", "+1.50", "+2.00", "+2.50", "+3.00", "+3.50"] };
var MYO = { path: "/products/the-rx-obsidian-prescription-mask-for-scuba-dive-snorkeling", productId: "8721512489293", variant: "50148668899661", pink: "50148668932429", powers: ["0 (No correction)", "-1.00", "-1.50", "-2.00", "-2.50", "-3.00", "-3.50", "-4.00"] };

var CFG = {
  calcA: "c89f8f67-acaa-4c8a-816d-dea96c1ea4b3",
  calcB: "3c40cb04-920e-4a03-b113-2db39b4acbff",
  quiz: "5fcec0ef-4ff8-4071-bb0f-222b04dfd411",
  sharper: "c65844d4-4a10-449d-a3bd-ec95a0c84db4",
  balanced: "1b1e7b51-3b0c-4c55-9d3e-4f3a0c0d2e11",
  minus: "0d7c2a90-5b7e-4a52-8f39-5e0b5f2f6a01",
  checker: "7adf6f8a-1f62-4e2e-9d06-5f5348997a43"
};
var SUMMARIES = {};
SUMMARIES[CFG.calcA] = { recommendedRight: 2, recommendedLeft: 2, prescriptionLabel: "Mine" };
SUMMARIES[CFG.calcB] = { recommendedRight: 3, recommendedLeft: 2.5, prescriptionLabel: null };
SUMMARIES[CFG.quiz] = { recommendedRight: 2.5, recommendedLeft: 2.5, prescriptionLabel: null };
SUMMARIES[CFG.sharper] = { recommendedRight: -3.5, recommendedLeft: -2.5, prescriptionLabel: null };
SUMMARIES[CFG.balanced] = { recommendedRight: -3, recommendedLeft: -2, prescriptionLabel: null };
SUMMARIES[CFG.minus] = { recommendedRight: -2, recommendedLeft: -2, prescriptionLabel: null };

function summaryFor(id) {
  return Object.assign({ configId: id, status: "confirmed", prescriptionAttached: false }, SUMMARIES[id]);
}

function options(values) {
  return ['<option value="">Select</option>'].concat(values.map(function (value) {
    return '<option value="' + value + '">' + value + "</option>";
  })).join("");
}

function productHtml(product, extras) {
  var settings = extras || {};
  return [
    '<product-info class="product__info-container">',
    '<div class="app-avis-product-options-block"><div class="avpoptions-container__v2">',
    '<div class="avp-option"><select name="(OD) Right">' + options(product.powers) + "</select></div>",
    '<div class="avp-option"><select name="(OS) Left">' + options(product.powers) + "</select></div>",
    '<div class="avp-option"><select name="Snorkel"><option value="">None</option><option value="Dry Top [ $17.50 ]">Dry Top [ $17.50 ]</option></select></div>',
    '<div class="avp-option"><select name="Case"><option value="">None</option><option value="Rx Obsidian Case [ $12.00 ]">Rx Obsidian Case [ $12.00 ]</option></select></div>',
    '<div class="avp-option"><select name="Bag"><option value="">None</option><option value="2L Dry Bag [ $9.00 ]">2L Dry Bag [ $9.00 ]</option></select></div>',
    '<div class="avp-option"><input type="file" class="avp-file__input"><input name="Upload" type="hidden"></div>',
    "</div></div>",
    '<form method="post" action="/cart/add" class="installment"><input type="hidden" name="id" value="' + product.variant + '"><input type="hidden" name="product-id" value="' + product.productId + '"></form>',
    '<form method="post" action="/cart/add" id="main-form" class="form" data-type="add-to-cart-form">',
    '<input type="hidden" name="form_type" value="product"><input type="hidden" name="id" value="' + product.variant + '">',
    '<input type="hidden" name="product-id" value="' + product.productId + '">',
    '<div class="apo-mirrors"></div>',
    '<button type="submit" name="add" class="avis-new-addcart-button">Add to cart</button>',
    "</form>",
    "</product-info>",
    settings.sticky
      ? '<form method="post" action="/cart/add" id="sticky-form" class="sticky-add-to-cart"><input type="hidden" name="id" value="' + product.variant + '"><input type="hidden" name="product-id" value="' + product.productId + '"><button type="submit" name="add">Add</button></form>'
      : "",
    '<form method="post" action="/cart/add" id="quick-add"><input type="hidden" name="id" value="999"><input type="hidden" name="product-id" value="111"><button type="submit">Quick add</button></form>',
    settings.checker ? settings.checker : ""
  ].join("");
}

// Avis: every option change rebuilds its property mirrors in the product form.
function installAvis(win) {
  var doc = win.document;
  var root = doc.querySelector(".avpoptions-container__v2");
  function render() {
    var mirrors = doc.querySelector('form[data-type="add-to-cart-form"] .apo-mirrors');
    if (!mirrors) return;
    var addons = 0;
    var kept = [];
    // Avis updates its mirrors in place and drops ones no longer selected.
    function add(name, value) {
      var input = mirrors.querySelector('input[name="properties[' + name + ']"]');
      if (!input) {
        input = doc.createElement("input");
        input.type = "hidden";
        input.name = "properties[" + name + "]";
        mirrors.appendChild(input);
      }
      input.value = value;
      kept.push(input);
    }
    add("(OD) Right", root.querySelector('select[name="(OD) Right"]').value);
    add("_has_apo", "true");
    add("(OS) Left", root.querySelector('select[name="(OS) Left"]').value);
    ["Snorkel", "Case", "Bag"].forEach(function (name) {
      var value = root.querySelector('select[name="' + name + '"]').value;
      if (!value) return;
      add(name, value);
      addons += Number(value.match(/\$([\d.]+)/)[1]);
    });
    if (addons) add("_apo_addons", String(addons));
    Array.prototype.forEach.call(mirrors.querySelectorAll("input"), function (input) {
      if (kept.indexOf(input) === -1) input.remove();
    });
  }
  root.addEventListener("change", render);
  render();
  return { render: render };
}

// Theme product-form.js: preventDefault, FormData from the form, POST
// /cart/add; on success (no cart drawer) it leaves for /cart.
function installTheme(win, page) {
  Array.prototype.forEach.call(win.document.querySelectorAll('form[action="/cart/add"]'), function (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      win.fetch("/cart/add", { method: "POST", body: new win.FormData(form) }).then(function (response) {
        if (response.ok) page.leftForCart = true;
      });
    });
  });
}

// One browser tab: the Shopify cart and sessionStorage outlive page loads.
function newTab() {
  var tab = { session: {}, items: [], failNext: 0, history: [] };
  tab.storage = {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(tab.session, key) ? tab.session[key] : null; },
    setItem: function (key, value) { tab.session[key] = String(value); },
    removeItem: function (key) { delete tab.session[key]; }
  };
  return tab;
}

function load(tab, product, search, settings) {
  var config = settings || {};
  var dom = new JSDOM("<!doctype html><body>" + productHtml(product, config) + "</body>", {
    url: "https://oceansoptics.com" + product.path + (search || ""),
    runScripts: "outside-only",
    pretendToBeVisual: true
  });
  var win = dom.window;
  var page = { tab: tab, win: win, doc: win.document, product: product, summaries: [], cartAdds: [] };
  Object.defineProperty(win, "sessionStorage", { value: tab.storage, configurable: true });
  win.HTMLElement.prototype.scrollIntoView = function () {};
  win.fetch = function (url, init) {
    url = String(url);
    if (/\/api\/rx-config\/[^/]+\/summary$/.test(url)) {
      var id = decodeURIComponent(url.split("/api/rx-config/")[1].split("/")[0]);
      page.summaries.push(id);
      if (config.summaryFailures && config.summaryFailures > 0) {
        config.summaryFailures -= 1;
        return config.summaryFailureKind === "network"
          ? Promise.reject(new TypeError("Failed to fetch"))
          : Promise.resolve({ ok: false, status: 503, json: function () { return Promise.resolve({}); } });
      }
      var body = SUMMARIES[id] ? summaryFor(id) : null;
      return Promise.resolve(body
        ? { ok: true, status: 200, json: function () { return Promise.resolve(body); } }
        : { ok: false, status: 404, json: function () { return Promise.resolve({}); } });
    }
    if (url === "/cart/add") {
      var properties = {};
      var payload = [];
      init.body.forEach(function (value, key) {
        payload.push([key, value]);
        var match = key.match(/^properties\[(.*)\]$/);
        if (match && value !== "") properties[match[1]] = value;
      });
      page.cartAdds.push(payload);
      if (tab.failNext > 0) {
        tab.failNext -= 1;
        return Promise.resolve({ ok: false, status: 422, json: function () { return Promise.resolve({ status: 422, description: "Cart error" }); } });
      }
      tab.items.unshift({ id: Number(init.body.get("id")), path: product.path, properties: properties });
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({}); } });
    }
    if (config.backend) return config.backend(url, init);
    return Promise.reject(new Error("unexpected fetch " + url));
  };
  if (config.journey !== false) {
    var journey = [];
    win.OOSourceJourney = {
      record: function (source) {
        if (journey.indexOf(source) === -1) journey.push(source);
        return { first_source: journey[0], source_history_text: journey.join(",") };
      }
    };
  }
  page.avis = installAvis(win);
  installTheme(win, page);
  if (config.beforeHandoff) config.beforeHandoff(page);
  win.eval(SCRIPT);
  tab.history.push(win.location.pathname + win.location.search);
  return page;
}

function settle(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms || 30); });
}

async function open(tab, product, search, settings) {
  var page = load(tab, product, search, settings);
  await settle();
  return page;
}

function handoffSearch(product, configId, source, extra) {
  return "?variant=" + product.variant + (extra || "") + "&oo_rx=" + configId + "&oo_source=" + source;
}

// Quiz product URL, as lib/quizDurableRx.ts buildQuizProductUrl builds it.
function quizSearch(product, configId, sessionId) {
  return "?variant=" + product.variant + "&quiz_session_id=" + sessionId + "&quiz_product_id=" + encodeURIComponent(product.path.split("/").pop()) + "&oo_rx=" + configId + "&oo_source=quiz_v53";
}

function choose(page, name, value) {
  var select = page.doc.querySelector('select[name="' + name + '"]');
  select.value = value;
  select.dispatchEvent(new page.win.Event("change", { bubbles: true }));
}

function changeColour(page, variantId, method) {
  page.doc.querySelector('form[data-type="add-to-cart-form"] input[name="id"]').value = variantId;
  page.win.history[method || "replaceState"]({}, "", page.product.path + "?variant=" + variantId);
}

async function addToCart(page, selector) {
  page.doc.querySelector(selector || 'form[data-type="add-to-cart-form"] button[name="add"]').click();
  await settle();
}

function oo(line) {
  var p = line.properties;
  return { config: p._oo_rx_config || null, source: p._oo_source || null };
}

function lenses(line) {
  return line.properties["(OD) Right"] + "/" + line.properties["(OS) Left"];
}

function urlParams(page) {
  return new URL(page.win.location.href).searchParams;
}

function statusClass(page) {
  var status = page.doc.getElementById("oo-rx-handoff-status");
  return status ? status.className.replace("oo-rx-handoff-status ", "") : null;
}

function injected(page, selector) {
  var form = page.doc.querySelector(selector || 'form[data-type="add-to-cart-form"]');
  return Array.prototype.map.call(form.querySelectorAll('input[name^="properties[_oo"], input[name="properties[Prescription]"]'), function (input) {
    return input.name + "=" + input.value;
  });
}

// --- 1-3: each tool's link reaches the mask line ---------------------------

test("1. calculator: the calculator's own product URL reaches the PDP, survives a colour change and lands on the mask line", { skip: skipDom }, async function () {
  var catalog = Array.isArray(Products.CATALOG) ? Products.CATALOG : Object.values(Products.CATALOG);
  var product = catalog.find(function (item) { return item.id === "obsidian-farsighted"; });
  assert.ok(product, "the calculator catalog has the farsighted Obsidian");
  var variant = Products.findVariant(product, "Black", "Black");
  var url = new URL(Products.prepareProductPageUrl({ status: "ready", configId: CFG.calcA.toUpperCase(), recommendedRight: 2, recommendedLeft: 2 }, product, variant));
  assert.equal(url.pathname, FAR.path);
  assert.equal(url.searchParams.get("oo_rx"), CFG.calcA, "the opaque, lower-cased config id only");
  assert.equal(url.searchParams.get("oo_source"), "lens_calculator_v53");
  assert.deepEqual(Array.from(url.searchParams.keys()).sort(), ["oo_rx", "oo_source", "variant"], "no prescription details in the URL");

  var tab = newTab();
  var page = await open(tab, FAR, url.search);
  assert.equal(statusClass(page), "is-success");
  changeColour(page, FAR.pink);
  choose(page, "Snorkel", "Dry Top [ $17.50 ]");
  await addToCart(page);
  assert.equal(tab.items.length, 1);
  assert.deepEqual(oo(tab.items[0]), { config: CFG.calcA, source: "lens_calculator_v53" });
  assert.equal(tab.items[0].id, Number(FAR.pink));
  assert.equal(lenses(tab.items[0]), "+2.00/+2.00");
  assert.equal(tab.items[0].properties.Prescription, "Mine");
  assert.equal(tab.items[0].properties._oo_first_source, "lens_calculator_v53");
});

test("2/17/26. product checker: the real checker saves the displayed buildable pair and that exact config lands on the mask line", { skip: skipDom }, async function () {
  var section = fs.readFileSync(path.join(__dirname, "base", "sections", "oo-product-rx-checker-v53.liquid"), "utf8")
    .replace(/\{%\s*schema\s*%\}[\s\S]*?\{%\s*endschema\s*%\}/, "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace("{{ product.handle | escape }}", MYO.path.split("/").pop())
    .replace(/\{\{\s*section\.id\s*\}\}/g, "test")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/\{%[^%]*%\}/g, "");
  var confirmed = [];
  var tab = newTab();
  var page = load(tab, MYO, "?variant=" + MYO.variant, {
    checker: section,
    backend: function (url, init) {
      var body = init && init.body ? JSON.parse(init.body) : null;
      var data = { ok: true };
      if (/\/manual\/init$/.test(url)) data = { configId: CFG.checker, editToken: "edit-token-never-on-line" };
      if (/\/confirm$/.test(url)) confirmed.push(body);
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(data); } });
    },
    beforeHandoff: function () {}
  });
  ["base", "engine", "high-cyl", "midpoint", "rx", "products"].forEach(function (name) {
    page.win.eval(fs.readFileSync(path.join(ASSETS, "oo-lens-calculator-v53-" + name + ".js"), "utf8"));
  });
  page.win.eval(fs.readFileSync(path.join(ASSETS, "oo-product-rx-checker-v53.js"), "utf8"));
  await settle();
  var container = page.doc.querySelector("[data-oo-product-rx-checker]");
  function setEye(side, sphere) {
    var scope = container.querySelector('[data-eye="' + side + '"]');
    var sign = scope.querySelector("[data-sphere-sign]");
    while (sign.dataset.sign !== (sphere < 0 ? "-" : "+")) sign.click();
    var whole = scope.querySelector("[data-sphere-int]");
    whole.value = String(Math.floor(Math.abs(sphere)));
    whole.dispatchEvent(new page.win.Event("change", { bubbles: true }));
    var fraction = scope.querySelector("[data-sphere-frac]");
    fraction.value = String(Math.round((Math.abs(sphere) % 1) * 100)).padStart(2, "0");
    fraction.dispatchEvent(new page.win.Event("change", { bubbles: true }));
  }
  setEye("right", -3.75);
  setEye("left", -2.75);
  container.querySelector("[data-checker-form]").dispatchEvent(new page.win.Event("submit", { cancelable: true }));
  await settle();
  var checked = container.querySelector(".oo-rx-checker__choice-input:checked");
  var card = checked ? checked.parentNode : container.querySelector(".oo-rx-checker__choice-card--single");
  var shown = Array.prototype.map.call(card.querySelectorAll(".oo-rx-checker__choice-eye-value"), function (node) { return node.textContent; });
  container.querySelector(".oo-rx-checker__apply").click();
  await settle(60);
  assert.equal(confirmed.length, 1);
  var saved = confirmed[0];
  assert.deepEqual([page.doc.querySelector('select[name="(OD) Right"]').value, page.doc.querySelector('select[name="(OS) Left"]').value].map(function (v) { return Number(v); }), [saved.recommendedRight, saved.recommendedLeft], "Avis shows the saved pair");
  assert.deepEqual(shown.map(Number), [saved.recommendedRight, saved.recommendedLeft], "the saved pair is the displayed pair");
  assert.equal(urlParams(page).get("oo_rx"), CFG.checker, "the checker config is in the URL");
  changeColour(page, MYO.pink);
  await addToCart(page);
  assert.deepEqual(oo(tab.items[0]), { config: CFG.checker, source: "product_rx_checker" });
  assert.equal(JSON.stringify(tab.items[0].properties).indexOf("edit-token"), -1);
});

test("3. quiz: the Quiz link applies its config, keeps quiz parameters through a colour change and lands on the mask line", { skip: skipDom }, async function () {
  var tab = newTab();
  var page = await open(tab, FAR, quizSearch(FAR, CFG.quiz, "qs_test_1"));
  assert.equal(statusClass(page), "is-success");
  assert.match(page.doc.getElementById("oo-rx-handoff-status").textContent, /entered in the Quiz/);
  changeColour(page, FAR.pink);
  var params = urlParams(page);
  assert.deepEqual([params.get("variant"), params.get("oo_rx"), params.get("oo_source"), params.get("quiz_session_id"), params.get("quiz_product_id")],
    [FAR.pink, CFG.quiz, "quiz_v53", "qs_test_1", FAR.path.split("/").pop()]);
  await addToCart(page);
  assert.deepEqual(oo(tab.items[0]), { config: CFG.quiz, source: "quiz_v53" });
  assert.equal(lenses(tab.items[0]), "+2.50/+2.50");
});

// --- 4-7: variant / URL / reload / back-forward ------------------------------

test("4/5. variant change via replaceState and pushState, and popstate, keep oo_rx / oo_source; no unrelated parameters are kept", { skip: skipDom }, async function () {
  var tab = newTab();
  var page = await open(tab, FAR, handoffSearch(FAR, CFG.calcA, "lens_calculator_v53", "&utm_source=mail&fbclid=x"));
  changeColour(page, FAR.pink, "pushState");
  assert.equal(page.win.location.search, "?variant=" + FAR.pink + "&oo_rx=" + CFG.calcA + "&oo_source=lens_calculator_v53");
  changeColour(page, FAR.variant, "replaceState");
  assert.equal(urlParams(page).get("oo_rx"), CFG.calcA);
  page.win.history.back();
  await settle();
  assert.equal(urlParams(page).get("oo_rx"), CFG.calcA, "popstate lands on an entry that still carries the handoff");
  await addToCart(page);
  assert.deepEqual(oo(tab.items[0]), { config: CFG.calcA, source: "lens_calculator_v53" });
});

test("6/7. reload and back/forward re-validate the same explicit handoff from the kept URL", { skip: skipDom }, async function () {
  var tab = newTab();
  var page = await open(tab, FAR, handoffSearch(FAR, CFG.calcA, "lens_calculator_v53"));
  changeColour(page, FAR.pink);
  var kept = page.win.location.search;
  // Reload (and a non-bfcache back/forward) is a fresh load of the kept URL.
  var reloaded = await open(tab, FAR, kept);
  assert.deepEqual(reloaded.summaries, [CFG.calcA], "fetched and validated again");
  assert.equal(statusClass(reloaded), "is-success");
  await addToCart(reloaded);
  assert.deepEqual(oo(tab.items[0]), { config: CFG.calcA, source: "lens_calculator_v53" });
  // Forward to a different handoff, then back again: each entry keeps its own config.
  var other = await open(tab, FAR, handoffSearch(FAR, CFG.calcB, "lens_calculator_v53"));
  assert.equal(statusClass(other), "is-success");
  var back = await open(tab, FAR, kept);
  assert.equal(back.doc.querySelector('select[name="(OD) Right"]').value, "+2.00", "back shows config A's lenses, not B's");
});

// --- 8-13: returning visitor, second mask, reuse, mixed sources --------------

test("8/9. returning visitor: ordinary navigation never resurrects config A; a new link with config B wins and A cannot override it", { skip: skipDom }, async function () {
  var tab = newTab();
  var first = await open(tab, FAR, handoffSearch(FAR, CFG.calcA, "lens_calculator_v53"));
  assert.equal(statusClass(first), "is-success");
  // Later, ordinary navigation to the same product and to another product.
  var plain = await open(tab, FAR, "?variant=" + FAR.variant);
  var other = await open(tab, MYO, "");
  [plain, other].forEach(function (page) {
    assert.deepEqual(page.summaries, [], "nothing is fetched");
    assert.equal(statusClass(page), null, "no prescription status");
    assert.deepEqual(injected(page), [], "no OO properties on the form");
  });
  choose(plain, "(OD) Right", "+2.00");
  choose(plain, "(OS) Left", "+2.00");
  await addToCart(plain);
  assert.deepEqual(oo(tab.items[0]), { config: null, source: null }, "same lenses typed by hand: still no config");

  var fresh = await open(tab, FAR, handoffSearch(FAR, CFG.calcB, "lens_calculator_v53"));
  assert.deepEqual(fresh.summaries, [CFG.calcB]);
  await addToCart(fresh);
  assert.deepEqual(oo(tab.items[0]), { config: CFG.calcB, source: "lens_calculator_v53" });
  assert.equal(lenses(tab.items[0]), "+3.00/+2.50");
});

test("10. second mask: mask 1 keeps config A, mask 2 gets config B", { skip: skipDom }, async function () {
  var tab = newTab();
  var one = await open(tab, FAR, handoffSearch(FAR, CFG.calcA, "lens_calculator_v53"));
  await addToCart(one);
  assert.equal(one.leftForCart, true);
  var two = await open(tab, FAR, handoffSearch(FAR, CFG.calcB, "lens_calculator_v53"));
  changeColour(two, FAR.pink);
  await addToCart(two);
  assert.deepEqual(tab.items.map(oo).reverse(), [
    { config: CFG.calcA, source: "lens_calculator_v53" },
    { config: CFG.calcB, source: "lens_calculator_v53" }
  ]);
  assert.deepEqual(tab.items.map(lenses).reverse(), ["+2.00/+2.00", "+3.00/+2.50"]);
});

test("11/19. second mask without a new handoff: no config, on another product or on the same product's later plain visit", { skip: skipDom }, async function () {
  var tab = newTab();
  var one = await open(tab, FAR, handoffSearch(FAR, CFG.calcA, "lens_calculator_v53"));
  await addToCart(one);
  var otherProduct = await open(tab, MYO, "?variant=" + MYO.variant);
  choose(otherProduct, "(OD) Right", "-2.00");
  choose(otherProduct, "(OS) Left", "-2.00");
  await addToCart(otherProduct);
  var sameProduct = await open(tab, FAR, "?variant=" + FAR.pink);
  choose(sameProduct, "(OD) Right", "+3.00");
  choose(sameProduct, "(OS) Left", "+3.00");
  await addToCart(sameProduct);
  assert.deepEqual(tab.items.map(oo).reverse(), [
    { config: CFG.calcA, source: "lens_calculator_v53" },
    { config: null, source: null },
    { config: null, source: null }
  ]);
});

test("19. after a successful add, going back to the same handoff page and choosing other lenses never carries config A", { skip: skipDom }, async function () {
  var tab = newTab();
  var page = await open(tab, FAR, handoffSearch(FAR, CFG.calcA, "lens_calculator_v53"));
  await addToCart(page);
  assert.deepEqual(JSON.parse(tab.session.oo_rx_handoff_added), [FAR.path + "|" + CFG.calcA]);
  // bfcache back: the same page, still showing the handoff.
  choose(page, "(OD) Right", "+3.50");
  choose(page, "(OS) Left", "+3.50");
  await settle();
  assert.equal(statusClass(page), "is-released");
  assert.equal(page.doc.getElementById("oo-rx-handoff-status").textContent, page.win.OORxProductHandoff.NOT_ATTACHED_MESSAGE);
  await addToCart(page);
  assert.deepEqual(oo(tab.items[0]), { config: null, source: null }, "different lenses: not attached");
  assert.equal(lenses(tab.items[0]), "+3.50/+3.50");
  // Non-bfcache back: a fresh load of the kept URL resumes as already added.
  var reloaded = await open(tab, FAR, page.win.location.search);
  assert.equal(statusClass(reloaded), "is-success", "the saved lenses are set again");
  choose(reloaded, "(OD) Right", "+1.00");
  choose(reloaded, "(OS) Left", "+1.00");
  await settle();
  await addToCart(reloaded);
  assert.deepEqual(oo(tab.items[0]), { config: null, source: null });
  // Choosing the saved strengths again re-attaches it.
  choose(reloaded, "(OD) Right", "+2.00");
  choose(reloaded, "(OS) Left", "+2.00");
  await settle();
  assert.equal(statusClass(reloaded), "is-success");
  await addToCart(reloaded);
  assert.deepEqual(oo(tab.items[0]), { config: CFG.calcA, source: "lens_calculator_v53" });
});

test("12. deliberate reuse: the same config sent to two masks (and added again with the same lenses) attaches every time", { skip: skipDom }, async function () {
  var tab = newTab();
  var one = await open(tab, FAR, handoffSearch(FAR, CFG.calcA, "lens_calculator_v53"));
  await addToCart(one);
  // Back to the same page (bfcache), another colour, same lenses.
  changeColour(one, FAR.pink);
  await addToCart(one);
  // The tool sends the same config to the product again.
  var again = await open(tab, FAR, handoffSearch(FAR, CFG.calcA, "lens_calculator_v53"));
  await addToCart(again);
  assert.deepEqual(tab.items.map(oo), [1, 2, 3].map(function () { return { config: CFG.calcA, source: "lens_calculator_v53" }; }));
  assert.deepEqual(tab.items.map(function (line) { return line.id; }).reverse(), [Number(FAR.variant), Number(FAR.pink), Number(FAR.variant)]);
});

test("13/D/E. two Quiz selections and a Quiz + Calculator mixed journey keep each line's own config and source", { skip: skipDom }, async function () {
  var tab = newTab();
  var quizOne = await open(tab, FAR, quizSearch(FAR, CFG.quiz, "qs_1"));
  await addToCart(quizOne);
  var quizTwo = await open(tab, MYO, quizSearch(MYO, CFG.sharper, "qs_1"));
  await addToCart(quizTwo);
  var calc = await open(tab, MYO, handoffSearch(MYO, CFG.balanced, "lens_calculator_v53"));
  await addToCart(calc);
  assert.deepEqual(tab.items.map(oo).reverse(), [
    { config: CFG.quiz, source: "quiz_v53" },
    { config: CFG.sharper, source: "quiz_v53" },
    { config: CFG.balanced, source: "lens_calculator_v53" }
  ]);
  assert.deepEqual(tab.items.map(lenses).reverse(), ["+2.50/+2.50", "-3.50/-2.50", "-3.00/-2.00"]);
});

// --- 14-17: Avis rerender and bundles ----------------------------------------

test("14/28. Avis rerender then submit: properties restored once each; repeated pre-submit application is idempotent", { skip: skipDom }, async function () {
  var tab = newTab();
  var page = await open(tab, FAR, handoffSearch(FAR, CFG.calcA, "lens_calculator_v53"));
  var form = page.doc.querySelector('form[data-type="add-to-cart-form"]');
  Array.prototype.forEach.call(form.querySelectorAll('input[name^="properties[_oo"], input[name="properties[Prescription]"]'), function (input) { input.remove(); });
  // A stray duplicate (e.g. a cloned section) with a stale value.
  var stale = page.doc.createElement("input");
  stale.type = "hidden";
  stale.name = "properties[_oo_rx_config]";
  stale.value = CFG.calcB;
  form.appendChild(stale);
  page.avis.render();
  var api = page.win.OORxProductHandoff;
  var active = page.win.__ooRxHandoffActive;
  api.writeProperties(page.doc, form, active.properties);
  var once = injected(page);
  api.writeProperties(page.doc, form, active.properties);
  assert.deepEqual(injected(page), once, "a second application changes nothing");
  assert.equal(form.querySelectorAll('input[name="properties[_oo_rx_config]"]').length, 1);
  await addToCart(page);
  var configs = page.cartAdds[0].filter(function (entry) { return entry[0] === "properties[_oo_rx_config]"; });
  assert.deepEqual(configs, [["properties[_oo_rx_config]", CFG.calcA]], "exactly one config in the request");
});

test("15/16/17. mask + snorkel + case + bag: the config is on the mask line itself, beside Avis' add-ons", { skip: skipDom }, async function () {
  var tab = newTab();
  var page = await open(tab, FAR, handoffSearch(FAR, CFG.calcA, "lens_calculator_v53"));
  choose(page, "Snorkel", "Dry Top [ $17.50 ]");
  choose(page, "Case", "Rx Obsidian Case [ $12.00 ]");
  choose(page, "Bag", "2L Dry Bag [ $9.00 ]");
  await addToCart(page);
  assert.equal(tab.items.length, 1);
  var line = tab.items[0];
  assert.deepEqual(oo(line), { config: CFG.calcA, source: "lens_calculator_v53" });
  assert.equal(line.id, Number(FAR.variant), "the mask variant owns the config");
  assert.equal(line.properties.Snorkel, "Dry Top [ $17.50 ]");
  assert.equal(line.properties.Case, "Rx Obsidian Case [ $12.00 ]");
  assert.equal(line.properties.Bag, "2L Dry Bag [ $9.00 ]");
  assert.equal(line.properties._apo_addons, "38.5");
  assert.equal(lenses(line), "+2.00/+2.00");
});

// --- 18: failed / interrupted submission -------------------------------------

test("18. failed add (422), variant change and retry: the Rx stays active and attaches on the successful retry", { skip: skipDom }, async function () {
  var tab = newTab();
  var page = await open(tab, FAR, handoffSearch(FAR, CFG.calcA, "lens_calculator_v53"));
  tab.failNext = 1;
  await addToCart(page);
  assert.equal(tab.items.length, 0);
  assert.equal(page.leftForCart, undefined);
  assert.equal(tab.session.oo_rx_handoff_added, undefined, "a failed add is not recorded as added");
  assert.equal(page.win.__ooRxHandoffActive.added, false);
  changeColour(page, FAR.pink);
  // Even with the lenses adjusted before the retry, the arriving handoff still applies.
  choose(page, "(OD) Right", "+2.50");
  await addToCart(page);
  assert.deepEqual(oo(tab.items[0]), { config: CFG.calcA, source: "lens_calculator_v53" });
  assert.equal(tab.items[0].id, Number(FAR.pink));
});

test("18. transient summary failures are retried; a definitive failure is not, and attaches nothing", { skip: skipDom }, async function () {
  var api = require("./base/assets/oo-rx-product-handoff.js");
  var tab = newTab();
  var page = load(tab, FAR, handoffSearch(FAR, CFG.calcA, "lens_calculator_v53"), { summaryFailures: 2, summaryFailureKind: "network" });
  // The page's own start ran with the default delays; drive one with short delays.
  page.win.__ooRxHandoffActive = null;
  var result = await api.start(page.doc, { search: page.win.location.search, fetch: page.win.fetch, retryDelays: [5, 5] });
  assert.equal(result.state, "confirmed");
  await addToCart(page);
  assert.deepEqual(oo(tab.items[0]), { config: CFG.calcA, source: "lens_calculator_v53" });

  var calls = 0;
  await assert.rejects(api.fetchSummary(function () { calls += 1; return Promise.resolve({ ok: false, status: 404 }); }, CFG.calcA, null, [5, 5]));
  assert.equal(calls, 1, "404 is not retried");
  calls = 0;
  await assert.rejects(api.fetchSummary(function () { calls += 1; return Promise.resolve({ ok: false, status: 503 }); }, CFG.calcA, null, [5, 5]));
  assert.equal(calls, 3, "503 is retried twice");
});

test("18. slow Avis: the summary loads in parallel, a pending status shows, and the handoff applies when Avis appears after 15 s-equivalent", { skip: skipDom }, async function () {
  var api = require("./base/assets/oo-rx-product-handoff.js");
  assert.ok(api.AVIS_WAIT_MS >= 60000, "Avis is waited for well beyond 15 s");
  var dom = new JSDOM("<!doctype html><body><div id=late></div></body>", { url: "https://oceansoptics.com" + FAR.path + handoffSearch(FAR, CFG.calcA, "lens_calculator_v53"), pretendToBeVisual: true });
  var win = dom.window;
  var order = [];
  var release;
  var gate = new Promise(function (resolve) { release = resolve; });
  var started = api.start(win.document, {
    search: win.location.search,
    fetch: function () {
      order.push("summary requested");
      return gate.then(function () { return { ok: true, status: 200, json: function () { return Promise.resolve(summaryFor(CFG.calcA)); } }; });
    }
  });
  await settle();
  assert.deepEqual(order, ["summary requested"], "requested before Avis exists");
  win.document.getElementById("late").innerHTML = productHtml(FAR);
  installAvis(win);
  await settle();
  assert.equal(win.document.getElementById("oo-rx-handoff-status").className, "oo-rx-handoff-status is-pending");
  assert.equal(win.document.getElementById("oo-rx-handoff-status").textContent, api.PENDING_MESSAGE);
  release();
  var result = await started;
  assert.equal(result.state, "confirmed");
  assert.equal(win.document.querySelector('input[name="properties[_oo_rx_config]"]').value, CFG.calcA);
});

// --- 20-22: strategy switch and product relevance ----------------------------

test("20/21. Sharper -> Softer -> Sharper: each navigation carries the config current at that click, never a stale one", { skip: skipDom }, async function () {
  var tab = newTab();
  var sharper = await open(tab, MYO, quizSearch(MYO, CFG.sharper, "qs_s"));
  assert.equal(lenses({ properties: { "(OD) Right": sharper.doc.querySelector('select[name="(OD) Right"]').value, "(OS) Left": sharper.doc.querySelector('select[name="(OS) Left"]').value } }), "-3.50/-2.50");
  var softer = await open(tab, MYO, quizSearch(MYO, CFG.balanced, "qs_s"));
  await addToCart(softer);
  var sharperAgain = await open(tab, MYO, quizSearch(MYO, CFG.sharper, "qs_s"));
  await addToCart(sharperAgain);
  assert.deepEqual(tab.items.map(oo).reverse(), [
    { config: CFG.balanced, source: "quiz_v53" },
    { config: CFG.sharper, source: "quiz_v53" }
  ]);
  assert.deepEqual(tab.items.map(lenses).reverse(), ["-3.00/-2.00", "-3.50/-2.50"]);
});

test("22. product mismatch: a nearsighted config on the farsighted mask (and an unknown config) is suppressed at load and at submit", { skip: skipDom }, async function () {
  for (var id of [CFG.minus, "00000000-0000-4000-8000-000000000000"]) {
    var tab = newTab();
    var page = await open(tab, FAR, handoffSearch(FAR, id, "lens_calculator_v53"));
    assert.equal(statusClass(page), "is-error");
    assert.equal(urlParams(page).get("oo_rx"), id, "the link itself is left as it was");
    choose(page, "(OD) Right", "+2.00");
    choose(page, "(OS) Left", "+2.00");
    changeColour(page, FAR.pink);
    assert.equal(urlParams(page).has("oo_rx"), false, "a failed handoff is never kept on rewritten URLs");
    await addToCart(page);
    assert.deepEqual(oo(tab.items[0]), { config: null, source: null });
  }
});

// --- 23-25: manual, uploaded and no-Rx journeys ------------------------------

test("23/24/25. manual and uploaded configs attach without a file; a no-Rx visit attaches nothing", { skip: skipDom }, async function () {
  SUMMARIES[CFG.calcB].prescriptionAttached = true;
  try {
    var tab = newTab();
    var manual = await open(tab, FAR, handoffSearch(FAR, CFG.calcA, "lens_calculator_v53"));
    assert.match(manual.doc.getElementById("oo-rx-handoff-status").textContent, /Lens Calculator/);
    await addToCart(manual);
    var uploaded = await open(tab, FAR, handoffSearch(FAR, CFG.calcB, "lens_calculator_v53"));
    assert.match(uploaded.doc.getElementById("oo-rx-handoff-status").textContent, /already attached/);
    assert.equal(uploaded.doc.querySelector(".oo-rx-handoff-confirmed") !== null, true, "Avis upload is hidden");
    await addToCart(uploaded);
    var none = await open(tab, MYO, "");
    choose(none, "(OD) Right", "0 (No correction)");
    choose(none, "(OS) Left", "0 (No correction)");
    await addToCart(none);
    assert.deepEqual(tab.items.map(oo).reverse(), [
      { config: CFG.calcA, source: "lens_calculator_v53" },
      { config: CFG.calcB, source: "lens_calculator_v53" },
      { config: null, source: null }
    ]);
    assert.equal(JSON.stringify(tab.items).indexOf("Upload\":\"http"), -1, "no file URL on any line");
  } finally {
    SUMMARIES[CFG.calcB].prescriptionAttached = false;
  }
});

// --- 27: multiple forms on the page ------------------------------------------

test("27. sticky ATC for the same product gets the config on its own submit; another product's form never does", { skip: skipDom }, async function () {
  var tab = newTab();
  var page = await open(tab, FAR, handoffSearch(FAR, CFG.calcA, "lens_calculator_v53"), { sticky: true });
  assert.deepEqual(injected(page, "#sticky-form"), [], "nothing is written to other forms ahead of time");
  await addToCart(page, "#sticky-form button");
  assert.deepEqual(oo(tab.items[0]), { config: CFG.calcA, source: "lens_calculator_v53" });
  await addToCart(page, "#quick-add button");
  assert.equal(tab.items[0].id, 999);
  assert.deepEqual(tab.items[0].properties, {});
  assert.deepEqual(injected(page, "#quick-add"), []);
  // The installment form never carries properties.
  assert.equal(page.doc.querySelector("form.installment").querySelectorAll('input[name^="properties"]').length, 0);
});

// --- On-page checker re-apply on a form that already carried another config --

test("checker re-apply: config B with no label replaces config A and A's Prescription label is removed", { skip: skipDom }, async function () {
  var tab = newTab();
  var page = await open(tab, FAR, handoffSearch(FAR, CFG.calcA, "lens_calculator_v53"));
  assert.ok(injected(page).indexOf("properties[Prescription]=Mine") !== -1);
  var api = page.win.OORxProductHandoff;
  api.applyConfirmedHandoff(page.doc, await api.waitForAvisControls(page.doc), summaryFor(CFG.calcB), "product_rx_checker");
  assert.equal(injected(page).some(function (entry) { return /Prescription/.test(entry); }), false);
  await addToCart(page);
  assert.deepEqual(oo(tab.items[0]), { config: CFG.calcB, source: "product_rx_checker" });
  assert.equal(tab.items[0].properties.Prescription, undefined);
});

test("attribution alone never activates a prescription", { skip: skipDom }, async function () {
  var tab = newTab();
  tab.session.oo_rx_handoff_added = JSON.stringify([FAR.path + "|" + CFG.calcA]);
  var page = await open(tab, FAR, "?variant=" + FAR.variant + "&quiz_session_id=qs_1&quiz_product_id=x", {
    beforeHandoff: function (p) {
      p.win.localStorage.setItem("oo_source_journey", JSON.stringify({ first_source: "lens_calculator_v53", history: ["lens_calculator_v53", "quiz_v53"] }));
      p.win.localStorage.setItem("oo_quiz_attribution", JSON.stringify({ quiz_session_id: "qs_1" }));
    }
  });
  assert.deepEqual(page.summaries, []);
  assert.equal(page.win.__ooRxHandoffActive, undefined);
  choose(page, "(OD) Right", "+2.00");
  choose(page, "(OS) Left", "+2.00");
  await addToCart(page);
  assert.deepEqual(oo(tab.items[0]), { config: null, source: null });
});
