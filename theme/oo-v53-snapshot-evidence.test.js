"use strict";

// Durable V5.3 customer evidence on the storefront: optionLabelsShown on new
// snapshots (presentation evidence only), and the Product Rx Checker's own
// snapshot reaching the confirm payload, the line item and an alternative
// mask link, per mask, without inheriting a snapshot from an earlier tool.

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

var ASSETS = path.join(__dirname, "base", "assets");
var CONFIG_ID = "7adf6f8a-1f62-4e2e-9d06-5f5348997a43";
var Handoff = require("./base/assets/oo-rx-product-handoff.js");
var Checker = require("./base/assets/oo-product-rx-checker-v53.js");
var JSDOM = null;
try { JSDOM = require("jsdom").JSDOM; } catch (error) { JSDOM = null; }
var skipDom = JSDOM ? false : "jsdom is not installed";

var LABELS = { balanced: "Balanced", closer_to_sph: "Alternative" };
var FARSIGHTED = "rx-obsidian-farsighted-prescription-snorkel-scuba-dive-mask";
var LUMIX = "professional-apollo-like-corrective-scuba-goggles-diving-aluminium-rx-optical-dive-mask-with-diopter-strength-from-1-5-to-6-0";

function snapshotProperty(properties) {
  var entry = properties.filter(function (p) { return p[0] === "properties[_oo_v53_snapshot]"; })[0];
  return entry ? JSON.parse(entry[1]) : null;
}

function fakeDoc(search) {
  return { defaultView: { location: { search: search || "" } } };
}

var URL_SNAPSHOT = {
  schemaVersion: "1", calculatorVersion: "5.3.0-experimental", source: "calculator",
  optionsShown: { closer_to_sph: { right: "-7.00", left: "-8.00" }, balanced: { right: "-6.50", left: "-7.50" } },
  recommendedStrategy: "balanced", selectedStrategy: "closer_to_sph", selectionEvidence: "customer_explicit"
};

test("handoff: a summary snapshot from an in-page tool replaces any snapshot left in the URL", function () {
  var search = "?oo_rx=" + CONFIG_ID + "&_oo_v53_snapshot=" + encodeURIComponent(JSON.stringify(URL_SNAPSHOT));
  var base = { configId: CONFIG_ID, status: "confirmed", recommendedRight: 3, recommendedLeft: 2, prescriptionAttached: false, prescriptionLabel: null };
  var own = { schemaVersion: "1", calculatorVersion: "5.3.0-experimental", source: "product_rx_checker", optionsShown: null, selectedStrategy: null };

  // Link arrival (backend summary has no v53Snapshot key): the URL snapshot is kept.
  var fromLink = Handoff.validateSummary(base, CONFIG_ID);
  assert.equal(Object.prototype.hasOwnProperty.call(fromLink, "v53Snapshot"), false);
  assert.deepEqual(snapshotProperty(Handoff.handoffProperties(fakeDoc(search), fromLink, "lens_calculator_v53")), URL_SNAPSHOT);

  // Checker summary with its own snapshot: that snapshot wins.
  var checker = Handoff.validateSummary(Object.assign({}, base, { v53Snapshot: own }), CONFIG_ID);
  assert.deepEqual(snapshotProperty(Handoff.handoffProperties(fakeDoc(search), checker, "product_rx_checker")), own);

  // Checker summary with no snapshot: the stale URL snapshot is NOT attached.
  var none = Handoff.validateSummary(Object.assign({}, base, { v53Snapshot: null }), CONFIG_ID);
  assert.equal(snapshotProperty(Handoff.handoffProperties(fakeDoc(search), none, "product_rx_checker")), null);

  // Non-5.3 or oversized snapshots are never written.
  var bad = Handoff.validateSummary(Object.assign({}, base, { v53Snapshot: { calculatorVersion: "5.2" } }), CONFIG_ID);
  assert.equal(snapshotProperty(Handoff.handoffProperties(fakeDoc(""), bad, "product_rx_checker")), null);
});

test("checker: an alternative mask link carries the checker snapshot with the confirmed config", function () {
  var products = { defaultVariant: function () { return { url: "https://oceansoptics.com/products/rx-lumix?variant=1" }; } };
  var snapshot = { calculatorVersion: "5.3.0-experimental", source: "product_rx_checker", optionLabelsShown: LABELS };
  var url = new URL(Checker.alternativeProductUrl(products, {}, CONFIG_ID, snapshot));
  assert.equal(url.searchParams.get("oo_rx"), CONFIG_ID);
  assert.equal(url.searchParams.get("oo_source"), "product_rx_checker");
  assert.deepEqual(JSON.parse(url.searchParams.get("_oo_v53_snapshot")), snapshot);
  var unconfirmed = new URL(Checker.alternativeProductUrl(products, {}, null, snapshot));
  assert.equal(unconfirmed.searchParams.get("_oo_v53_snapshot"), null, "no snapshot without a confirmed config");
});

// ------------------------------------------------------------------ DOM --

function loadChecker(handle) {
  var html = fs.readFileSync(path.join(__dirname, "base", "sections", "oo-product-rx-checker-v53.liquid"), "utf8")
    .replace(/\{%\s*schema\s*%\}[\s\S]*?\{%\s*endschema\s*%\}/, "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace("{{ product.handle | escape }}", handle)
    .replace(/\{\{\s*section\.id\s*\}\}/g, "test")
    .replace(/\{\{[^}]*\}\}/g, "").replace(/\{%[^%]*%\}/g, "");
  var dom = new JSDOM("<!doctype html><body>" + html + "</body>", { runScripts: "outside-only", pretendToBeVisual: true, url: "https://oceansoptics.com/products/" + handle });
  var win = dom.window;
  var calls = [];
  var applied = [];
  win.HTMLElement.prototype.scrollIntoView = function () {};
  win.fetch = function (url, init) {
    calls.push({ url: String(url), body: init && init.body ? JSON.parse(init.body) : null });
    var data = /\/manual\/init$/.test(url) ? { configId: CONFIG_ID, editToken: "edit" } : { ok: true };
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(data); } });
  };
  win.OOSourceJourney = { record: function () { return null; } };
  win.OORxProductHandoff = {
    waitForAvisControls: function () { return Promise.resolve({}); },
    applyConfirmedHandoff: function (doc, controls, summary) { applied.push(summary); return summary; }
  };
  ["base", "engine", "high-cyl", "midpoint", "rx", "products"].forEach(function (name) {
    win.eval(fs.readFileSync(path.join(ASSETS, "oo-lens-calculator-v53-" + name + ".js"), "utf8"));
  });
  win.eval(fs.readFileSync(path.join(ASSETS, "oo-product-rx-checker-v53.js"), "utf8"));
  var page = { win: win, doc: win.document, calls: calls, applied: applied };
  page.container = win.document.querySelector("[data-oo-product-rx-checker]");
  return Promise.resolve(page);
}

function change(node) { node.dispatchEvent(new node.ownerDocument.defaultView.Event("change", { bubbles: true })); }

function setEye(page, side, sphere, cylinder, axis) {
  var scope = page.doc.querySelector('[data-eye="' + side + '"]');
  var sign = scope.querySelector("[data-sphere-sign]");
  var magnitude = Math.abs(sphere);
  if (magnitude) { var want = sphere < 0 ? "-" : "+"; while (sign.dataset.sign !== want) sign.click(); }
  var whole = scope.querySelector("[data-sphere-int]"); whole.value = String(Math.floor(magnitude)); change(whole);
  var frac = scope.querySelector("[data-sphere-frac]"); frac.value = String(Math.round((magnitude % 1) * 100)).padStart(2, "0"); change(frac);
  var mag = scope.querySelector("[data-cyl-mag]"); mag.value = Math.abs(cylinder || 0).toFixed(2); change(mag);
  if (cylinder) {
    var cylSign = scope.querySelector("[data-cyl-sign]"); var wantCyl = cylinder < 0 ? "-" : "+";
    while (cylSign.dataset.sign !== wantCyl) cylSign.click();
    var axisSelect = scope.querySelector('[data-field="axis"]'); axisSelect.value = String(axis || 90); change(axisSelect);
  }
}

function check(page, right, left) {
  setEye(page, "right", right[0], right[1], right[2]);
  setEye(page, "left", left[0], left[1], left[2]);
  page.doc.querySelector("[data-checker-form]").dispatchEvent(new page.win.Event("submit", { cancelable: true }));
}

function settle() { return new Promise(function (resolve) { setTimeout(resolve, 20); }); }
function confirmBody(page) { return page.calls.filter(function (c) { return /\/confirm$/.test(c.url); }).pop().body; }
function plain(value) { return JSON.parse(JSON.stringify(value)); }

var FIXTURE_OPTIONS = { closer_to_sph: { right: "+4.00", left: "+3.00" }, balanced: { right: "+3.00", left: "+2.00" } };

test("checker: a default Balanced selection is saved with the same per-mask evidence as the other tools", { skip: skipDom }, async function () {
  var page = await loadChecker(FARSIGHTED);
  check(page, [4, -2, 75], [3, -1.25, 110]);
  await settle();
  page.container.querySelector(".oo-rx-checker__apply").click();
  await settle();
  var expected = {
    schemaVersion: "1",
    calculatorVersion: "5.3.1",
    source: "product_rx_checker",
    optionsShown: FIXTURE_OPTIONS,
    optionLabelsShown: LABELS,
    recommendedStrategy: "balanced",
    recommendedValues: FIXTURE_OPTIONS.balanced,
    selectedStrategy: "balanced",
    selectedRecommendation: FIXTURE_OPTIONS.balanced,
    selectionEvidence: "default_recommendation",
    finalProductSelection: null,
    manualOverride: false
  };
  assert.deepEqual(plain(confirmBody(page).v53Snapshot), expected, "confirm payload");
  assert.deepEqual(plain(page.applied[0].v53Snapshot), expected, "line-item handoff");
  assert.deepEqual([page.applied[0].recommendedRight, page.applied[0].recommendedLeft], [3, 2]);
});

test("checker: an explicit Alternative selection is saved as closer_to_sph / customer_explicit", { skip: skipDom }, async function () {
  var page = await loadChecker(FARSIGHTED);
  check(page, [4, -2, 75], [3, -1.25, 110]);
  await settle();
  page.container.querySelector('.oo-rx-checker__choice[data-strategy="closer_to_sph"] input').click();
  await settle();
  page.container.querySelector(".oo-rx-checker__apply").click();
  await settle();
  var snapshot = plain(page.applied[0].v53Snapshot);
  assert.deepEqual(snapshot.optionsShown, FIXTURE_OPTIONS);
  assert.deepEqual(snapshot.optionLabelsShown, LABELS);
  assert.equal(snapshot.recommendedStrategy, "balanced");
  assert.equal(snapshot.selectedStrategy, "closer_to_sph");
  assert.deepEqual(snapshot.selectedRecommendation, FIXTURE_OPTIONS.closer_to_sph);
  assert.equal(snapshot.selectionEvidence, "customer_explicit");
  assert.deepEqual([page.applied[0].recommendedRight, page.applied[0].recommendedLeft], [4, 3]);
  assert.deepEqual(plain(confirmBody(page).v53Snapshot), snapshot);
});

test("checker: when this mask shows one pair (second option not buildable), no options, labels or selection are recorded", { skip: skipDom }, async function () {
  var page = await loadChecker(LUMIX);
  // -6.75/-0.25: target -6.375 (not a tie). Balanced -6.00 is buildable on
  // Lumix; the strictly closer -6.50 Alternative is not, so one pair is shown.
  check(page, [-6.75, -0.25, 90], [-6.75, -0.25, 90]);
  await settle();
  page.container.querySelector(".oo-rx-checker__apply").click();
  await settle();
  var snapshot = plain(page.applied[0].v53Snapshot);
  assert.equal(snapshot.source, "product_rx_checker");
  assert.equal(snapshot.optionsShown, null);
  assert.equal(snapshot.optionLabelsShown, null);
  assert.equal(snapshot.recommendedStrategy, "balanced");
  assert.deepEqual(snapshot.recommendedValues, { right: "-6.00", left: "-6.00" });
  assert.equal(snapshot.selectedStrategy, null);
  assert.equal(snapshot.selectedRecommendation, null);
  assert.equal(snapshot.selectionEvidence, null);
});

test("multi mask: two checker masks keep independent evidence (Balanced by default, Alternative explicitly)", { skip: skipDom }, async function () {
  var mask1 = await loadChecker(FARSIGHTED);
  check(mask1, [4, -2, 75], [3, -1.25, 110]);
  await settle();
  mask1.container.querySelector(".oo-rx-checker__apply").click();
  await settle();

  var mask2 = await loadChecker(FARSIGHTED);
  check(mask2, [4, -0.75, 100], [4.25, -0.75, 105]);
  await settle();
  mask2.container.querySelector('.oo-rx-checker__choice[data-strategy="closer_to_sph"] input').click();
  await settle();
  mask2.container.querySelector(".oo-rx-checker__apply").click();
  await settle();

  var one = plain(mask1.applied[0].v53Snapshot);
  var two = plain(mask2.applied[0].v53Snapshot);
  assert.deepEqual([one.selectedStrategy, one.selectionEvidence, one.selectedRecommendation], ["balanced", "default_recommendation", { right: "+3.00", left: "+2.00" }]);
  assert.deepEqual([two.selectedStrategy, two.selectionEvidence, two.selectedRecommendation], ["closer_to_sph", "customer_explicit", { right: "+4.00", left: "+4.00" }]);
  assert.deepEqual(two.optionsShown, { closer_to_sph: { right: "+4.00", left: "+4.00" }, balanced: { right: "+3.00", left: "+3.00" } });
  assert.deepEqual(one.optionsShown, FIXTURE_OPTIONS, "mask 1 keeps its own options");
  assert.deepEqual([mask1.applied[0].recommendedRight, mask1.applied[0].recommendedLeft], [3, 2]);
  assert.deepEqual([mask2.applied[0].recommendedRight, mask2.applied[0].recommendedLeft], [4, 4]);
});
