"use strict";

// Storefront tool journey (window.OOSourceJourney in the oo-quiz-attribution
// snippet) and how the handoff, product checker and calculator use it.

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var vm = require("node:vm");
var Handoff = require("./base/assets/oo-rx-product-handoff.js");
var Products = require("./lens-calculator-v52-preview/lens-calculator-v52-products.js");

var CONFIG_ID = "28bf81b0-d4fb-4a51-a2db-d262dbf29cb8";
var DAY = 24 * 60 * 60 * 1000;
var snippet = fs.readFileSync(path.join(__dirname, "base/snippets/oo-quiz-attribution.liquid"), "utf8");
var journeyScript = snippet.slice(snippet.indexOf("<script>") + 8, snippet.indexOf("</script>"));

function storage(initial) {
  var map = new Map(Object.entries(initial || {}));
  return {
    map: map,
    getItem: function (key) { return map.has(key) ? map.get(key) : null; },
    setItem: function (key, value) { map.set(key, String(value)); }
  };
}

// Runs the snippet's journey script in a fresh page context.
function page(options) {
  var opts = options || {};
  var fetchCalls = [];
  var window = {
    localStorage: opts.localStorage || storage(),
    sessionStorage: opts.sessionStorage || storage(),
    location: { search: opts.search || "" },
    document: { cookie: opts.cookie === undefined ? "cart=c1" : opts.cookie },
    fetch: function (url, init) {
      fetchCalls.push({ url: url, attributes: JSON.parse(init.body).attributes });
      return Promise.resolve({ ok: true });
    }
  };
  vm.runInNewContext(journeyScript, { window: window, URLSearchParams: URLSearchParams, Date: Date, JSON: JSON, Promise: Promise });
  return { window: window, journey: window.OOSourceJourney, fetchCalls: fetchCalls };
}

function settle() {
  return new Promise(function (resolve) { setImmediate(resolve); });
}

function sources(view) {
  return view.source_history.join(",");
}

test("a plain visit with no tool use records nothing and never touches the cart", async function () {
  var p = page({ search: "?utm_source=google" });
  await settle();
  assert.equal(JSON.stringify(p.journey.snapshot()), JSON.stringify({ first_source: null, source_history: [], source_history_text: "" }));
  assert.equal(p.fetchCalls.length, 0);
});

test("a Quiz arrival records the Quiz even without a prescription, and syncs cart attributes", async function () {
  var p = page({ search: "?quiz_session_id=qs_1&quiz_product_id=rx-rover" });
  await settle();
  assert.equal(p.journey.snapshot().first_source, "quiz_v53");
  assert.equal(sources(p.journey.snapshot()), "quiz_v53");
  assert.equal(p.fetchCalls.length, 1);
  assert.equal(JSON.stringify(p.fetchCalls[0]), JSON.stringify({ url: "/cart/update.js", attributes: { _oo_first_source: "quiz_v53", _oo_source_history: "quiz_v53" } }));
});

test("history is ordered and de-duplicated; the first source never changes", function () {
  var p = page();
  p.journey.record("quiz_v53");
  p.journey.record("lens_calculator_v53");
  p.journey.record("quiz_v53");
  var view = p.journey.record("product_rx_checker");
  assert.equal(view.first_source, "quiz_v53");
  assert.equal(view.source_history_text, "quiz_v53,lens_calculator_v53,product_rx_checker");
});

test("only the three known tools are accepted", function () {
  var p = page();
  ["face_fit", "QUIZ_V53", "", null, "lens_calculator_v53<script>"].forEach(function (value) { p.journey.record(value); });
  assert.equal(p.journey.snapshot().source_history.length, 0);
});

test("the journey persists across pages and expires after 30 days", function () {
  var local = storage();
  page({ localStorage: local, search: "?quiz_session_id=qs_2" });
  var next = page({ localStorage: local });
  assert.equal(sources(next.journey.snapshot()), "quiz_v53");

  var stale = storage({ oo_source_journey: JSON.stringify({ first: "quiz_v53", history: [{ source: "quiz_v53", at: "x" }], updated_at: new Date(Date.now() - 31 * DAY).toISOString() }) });
  assert.equal(page({ localStorage: stale }).journey.snapshot().source_history.length, 0);

  var corrupt = storage({ oo_source_journey: "{not json" });
  assert.equal(page({ localStorage: corrupt }).journey.snapshot().source_history.length, 0);
});

test("cart attributes are synced once per journey state and cart, and again for a new cart", async function () {
  var local = storage();
  var session = storage();
  var p = page({ localStorage: local, sessionStorage: session, search: "?quiz_session_id=qs_3" });
  await settle();
  assert.equal(p.fetchCalls.length, 1);
  var same = page({ localStorage: local, sessionStorage: session });
  await settle();
  assert.equal(same.fetchCalls.length, 0);
  var newCart = page({ localStorage: local, sessionStorage: session, cookie: "cart=c2" });
  await settle();
  assert.equal(newCart.fetchCalls.length, 1);
});

function propertyForm(window) {
  var inputs = [];
  return {
    inputs: inputs,
    values: function () {
      var out = {};
      inputs.forEach(function (input) { out[input.name] = input.value; });
      return out;
    },
    form: {
      querySelector: function (selector) {
        var match = selector.match(/name="([^"]+)"/);
        return match ? inputs.find(function (input) { return input.name === match[1]; }) || null : null;
      },
      querySelectorAll: function () {
        return inputs.filter(function (input) { return input["data-oo-rx-handoff-property"] === "true"; });
      },
      appendChild: function (input) {
        input.remove = function () { inputs.splice(inputs.indexOf(input), 1); };
        inputs.push(input);
      }
    },
    doc: {
      defaultView: window,
      createElement: function () {
        return { setAttribute: function (name, value) { this[name] = value; } };
      }
    }
  };
}

function summary() {
  return { configId: CONFIG_ID, recommendedRight: -2.5, recommendedLeft: -1.5, prescriptionLabel: null };
}

test("handoff keeps _oo_source as the conversion tool and adds first source and history", function () {
  var p = page({ search: "?quiz_session_id=qs_4" });
  var fixture = propertyForm(p.window);
  Handoff.injectShopifyProperties(fixture.doc, fixture.form, summary(), "lens_calculator_v53");
  assert.deepEqual(fixture.values(), {
    "properties[_oo_rx_config]": CONFIG_ID,
    "properties[_oo_source]": "lens_calculator_v53",
    "properties[_oo_first_source]": "quiz_v53",
    "properties[_oo_source_history]": "quiz_v53,lens_calculator_v53"
  });
});

test("the Rx checker becomes the conversion source without erasing earlier tools", function () {
  var p = page({ search: "?quiz_session_id=qs_5" });
  p.journey.record("lens_calculator_v53");
  var fixture = propertyForm(p.window);
  Handoff.injectShopifyProperties(fixture.doc, fixture.form, summary(), "quiz_v53");
  // Checker applies new lenses on the same product page: _oo_source is replaced, history kept.
  Handoff.injectShopifyProperties(fixture.doc, fixture.form, summary(), "product_rx_checker");
  var values = fixture.values();
  assert.equal(values["properties[_oo_source]"], "product_rx_checker");
  assert.equal(values["properties[_oo_first_source]"], "quiz_v53");
  assert.equal(values["properties[_oo_source_history]"], "quiz_v53,lens_calculator_v53,product_rx_checker");
});

test("without the journey (or with a non-allowlisted source) the handoff behaves exactly as before", function () {
  var fixture = propertyForm(undefined);
  Handoff.injectShopifyProperties(fixture.doc, fixture.form, summary(), "lens_calculator_v53");
  assert.deepEqual(Object.keys(fixture.values()), ["properties[_oo_rx_config]", "properties[_oo_source]"]);
  var p = page();
  var other = propertyForm(p.window);
  Handoff.injectShopifyProperties(other.doc, other.form, summary(), "face_fit");
  assert.deepEqual(Object.keys(other.values()), ["properties[_oo_rx_config]"]);
  assert.equal(p.journey.snapshot().source_history.length, 0);
});

test("failed handoffs remove the journey properties together with the config", function () {
  var p = page({ search: "?quiz_session_id=qs_6" });
  var fixture = propertyForm(p.window);
  Handoff.injectShopifyProperties(fixture.doc, fixture.form, summary(), "quiz_v53");
  Handoff.removeInjectedProperties(fixture.form);
  assert.equal(fixture.inputs.length, 0);
});

test("calculator cart submission carries the journey alongside _oo_source", function () {
  var selected = Products.CATALOG.find(function (candidate) { return candidate.id === "obsidian-nearsighted"; });
  var profile = { status: "ready", configId: CONFIG_ID, label: "James", recommendedRight: -2.5, recommendedLeft: -1.5, recommendationStrategy: "balanced" };
  var view = { first_source: "quiz_v53", source_history_text: "quiz_v53,lens_calculator_v53" };
  var fields = Products.prepareCartSubmission(profile, selected, Products.defaultVariant(selected), view).fields;
  assert.equal(fields["properties[_oo_source]"], "lens_calculator_v53");
  assert.equal(fields["properties[_oo_first_source]"], "quiz_v53");
  assert.equal(fields["properties[_oo_source_history]"], "quiz_v53,lens_calculator_v53");
  var plain = Products.prepareCartSubmission(profile, selected, Products.defaultVariant(selected)).fields;
  assert.equal("properties[_oo_source_history]" in plain, false);
});

test("product checker and calculator record their own use through the journey", function () {
  var checker = fs.readFileSync(path.join(__dirname, "base/assets/oo-product-rx-checker-v53.js"), "utf8");
  assert.match(checker, /recordCheckerUse\(\);\n\s+root\.location\.assign\(alternativeProductUrl\(products, candidate, configId\)\)/);
  assert.match(checker, /recordCheckerUse\(\);\n\s+var controls = await handoffApi\.waitForAvisControls\(doc\);/);
  var calculator = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-preview/lens-calculator-v52-products.js"), "utf8");
  assert.match(calculator, /if \(cartReady\) recordCalculatorUse\(doc\);/);
  assert.match(calculator, /var destination = prepareProductPageUrl\(profile, product, selection\);\n\s+recordCalculatorUse\(doc\);/);
});

test("cart attribute updates are serialised so a new cart never loses attributes", async function () {
  var order = [];
  var inFlight = 0;
  var maxInFlight = 0;
  var window = {
    localStorage: storage(),
    sessionStorage: storage(),
    location: { search: "?quiz_session_id=qs_7" },
    document: { cookie: "" },
    fetch: function (url, init) {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      order.push(JSON.parse(init.body).attributes);
      return new Promise(function (resolve) { setTimeout(function () { inFlight -= 1; resolve({ ok: true }); }, 5); });
    }
  };
  vm.runInNewContext(journeyScript, { window: window, URLSearchParams: URLSearchParams, Date: Date, JSON: JSON, Promise: Promise });
  window.OOSourceJourney.cartUpdate({ quiz_session_id: "qs_7" });
  await new Promise(function (resolve) { setTimeout(resolve, 40); });
  assert.equal(maxInFlight, 1);
  assert.equal(JSON.stringify(order), JSON.stringify([
    { _oo_first_source: "quiz_v53", _oo_source_history: "quiz_v53" },
    { quiz_session_id: "qs_7" }
  ]));
});

test("the quiz attribution sync goes through the shared cart queue", function () {
  assert.match(snippet, /journey && typeof journey\.cartUpdate === 'function'\n\s+\? journey\.cartUpdate\(attributes\)/);
});
