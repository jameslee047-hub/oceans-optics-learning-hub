"use strict";

// V5.3 calculator: matching masks shown immediately for every ordinary
// result (including high CYL), the two option cards switch the previewed pair
// with no save, and one confirmation happens when a mask is chosen. Result
// display (plano / review) is unchanged.
//
// The unit tests need nothing installed. The full-page tests run the real
// section and scripts in jsdom and are skipped when jsdom is not available
// (e.g. NODE_PATH=/path/to/node_modules node --test theme/).

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var Products = require("./base/assets/oo-lens-calculator-v53-products.js");
var Rx = require("./base/assets/oo-lens-calculator-v53-rx.js");

var ASSETS = path.join(__dirname, "base", "assets");
var SECTION = path.join(__dirname, "base", "sections", "oo-lens-calculator-v53.liquid");
var CONFIG_ID = "7adf6f8a-1f62-4e2e-9d06-5f5348997a43";
var OBSIDIAN = Products.CATALOG.filter(function (product) { return product.lensType === "minus"; })[0];

function previewProfile(strategy, right, left) {
  return {
    localId: "pending-prescription-1",
    configId: null,
    status: "preview",
    displayLabel: "Prescription 1",
    recommendationStrategy: strategy,
    recommendedRight: right,
    recommendedLeft: left
  };
}

function savedProfile(strategy, right, left) {
  return Object.assign(previewProfile(strategy, right, left), {
    localId: "prescription-1",
    configId: CONFIG_ID,
    status: "ready"
  });
}

function fakeBrowser(options) {
  options = options || {};
  var events = [];
  var opened = {
    location: { href: "" },
    closed: false,
    close: function () { this.closed = true; events.push("close"); },
    focus: function () {}
  };
  var win = {
    open: function (url) {
      events.push("open:" + url);
      return options.blocked ? null : opened;
    },
    OOSourceJourney: { record: function (source) { events.push("journey:" + source); return null; } }
  };
  return { doc: { defaultView: win }, opened: opened, events: events };
}

test("product card lens labels are unchanged", function () {
  assert.equal(Products.formatLensLabel(0), "Plano (0.00)");
  assert.equal(Products.formatLensLabel(-2.5), "-2.50");
});

test("historical V5.3 snapshot stays with the calculator product handoff URL", function () {
  var snapshot = {
    schemaVersion: "1", calculatorVersion: "5.3.0-experimental", source: "calculator",
    optionsShown: { closer_to_sph: { right: "-4.00", left: "-5.50" }, balanced: { right: "-4.00", left: "-5.00" } },
    recommendedStrategy: "closer_to_sph", recommendedValues: { right: "-4.00", left: "-5.50" },
    selectedStrategy: "closer_to_sph", selectedRecommendation: { right: "-4.00", left: "-5.50" },
    selectionEvidence: "customer_explicit", finalProductSelection: null, manualOverride: false
  };
  var profile = savedProfile("sharper", -4, -5.5);
  profile.v53Snapshot = snapshot;
  var url = new URL(Products.prepareProductPageUrl(profile, OBSIDIAN, Products.defaultVariant(OBSIDIAN)));
  assert.deepEqual(JSON.parse(url.searchParams.get("_oo_v53_snapshot")), snapshot);
  assert.equal(url.searchParams.get("oo_rx"), CONFIG_ID);
});

test("calculator snapshot is attached as a bounded hidden property on its mask line", function () {
  var snapshot = {
    schemaVersion: "1", calculatorVersion: "5.3.0-experimental", source: "calculator",
    optionsShown: { closer_to_sph: { right: "-4.00", left: "-5.50" }, balanced: { right: "-4.00", left: "-5.00" } },
    recommendedStrategy: "closer_to_sph", recommendedValues: { right: "-4.00", left: "-5.50" },
    selectedStrategy: "closer_to_sph", selectedRecommendation: { right: "-4.00", left: "-5.50" },
    selectionEvidence: "customer_explicit", finalProductSelection: null, manualOverride: false
  };
  var profile = savedProfile("sharper", -4, -5.5);
  profile.v53Snapshot = snapshot;
  var result = Products.prepareCartSubmission(profile, OBSIDIAN, Products.defaultVariant(OBSIDIAN));
  assert.equal(result.fields["properties[_oo_v53_snapshot]"], JSON.stringify(snapshot));
  assert.equal(result.fields["properties[_oo_rx_config]"], CONFIG_ID);
  assert.equal(result.fields["properties[(OD) Right]"], "-4.00");
});

test("a preview profile is not a durable profile and cannot reach Shopify on its own", function () {
  var preview = previewProfile("balanced", -2.5, -2);
  assert.equal(Products.isPreviewProfile(preview), true);
  assert.equal(Products.isConfirmedDurableProfile(preview), false);
  assert.throws(function () {
    Products.prepareProductPageUrl(preview, OBSIDIAN, Products.defaultVariant(OBSIDIAN));
  }, /Save this prescription/);
});

test("pending result profiles carry the preview status only when asked", function () {
  var payload = { right: {}, left: {}, recommendationStrategy: "sharper", recommendedRight: -3, recommendedLeft: -2.5 };
  assert.equal(Rx.createPendingResultProfile(payload, null, { status: "preview" }).status, "preview");
  assert.equal(Rx.createPendingResultProfile(payload, null, {}).status, "unsaved");
});

test("choosing a mask opens the window first, saves once, then hands off the saved pair", async function () {
  var browser = fakeBrowser();
  var commits = [];
  var ui = {
    commitPreviewedRecommendation: function (expected) {
      commits.push(expected);
      browser.events.push("commit");
      return Promise.resolve(savedProfile("sharper", -3, -2.5));
    }
  };
  var variant = Products.defaultVariant(OBSIDIAN);
  var result = await Products.commitPreviewAndOpen(browser.doc, ui, previewProfile("sharper", -3, -2.5), OBSIDIAN, variant);

  assert.deepEqual(browser.events.slice(0, 2), ["open:", "commit"]);
  assert.deepEqual(commits, [{ recommendationStrategy: "sharper", recommendedRight: -3, recommendedLeft: -2.5 }]);
  var url = new URL(browser.opened.location.href);
  assert.equal(url.searchParams.get("oo_rx"), CONFIG_ID);
  assert.equal(url.searchParams.get("oo_source"), "lens_calculator_v53");
  assert.equal(url.searchParams.get("variant"), new URL(variant.url).searchParams.get("variant"));
  assert.ok(browser.events.indexOf("journey:lens_calculator_v53") > browser.events.indexOf("commit"));
  assert.equal(result.profile.configId, CONFIG_ID);
});

test("a failed save closes the window and hands off nothing", async function () {
  var browser = fakeBrowser();
  var ui = { commitPreviewedRecommendation: function () { return Promise.resolve(undefined); } };
  await assert.rejects(
    Products.commitPreviewAndOpen(browser.doc, ui, previewProfile("balanced", -2.5, -2), OBSIDIAN, Products.defaultVariant(OBSIDIAN)),
    /couldn't save this prescription/
  );
  assert.equal(browser.opened.closed, true);
  assert.equal(browser.opened.location.href, "");
});

test("a saved pair that differs from the pair shown is never handed off", async function () {
  var browser = fakeBrowser();
  var ui = { commitPreviewedRecommendation: function () { return Promise.resolve(savedProfile("balanced", -2.5, -2)); } };
  await assert.rejects(
    Products.commitPreviewAndOpen(browser.doc, ui, previewProfile("sharper", -3, -2.5), OBSIDIAN, Products.defaultVariant(OBSIDIAN)),
    /couldn't save/
  );
  assert.equal(browser.opened.closed, true);
  assert.equal(browser.opened.location.href, "");
});

test("a blocked window or an unbuildable pair saves nothing", function () {
  var commits = 0;
  var ui = { commitPreviewedRecommendation: function () { commits += 1; return Promise.resolve(null); } };
  assert.throws(function () {
    Products.commitPreviewAndOpen(fakeBrowser({ blocked: true }).doc, ui, previewProfile("balanced", -2.5, -2), OBSIDIAN, Products.defaultVariant(OBSIDIAN));
  }, /blocked/);
  assert.throws(function () {
    Products.commitPreviewAndOpen(fakeBrowser().doc, ui, previewProfile("balanced", -12, -2), OBSIDIAN, Products.defaultVariant(OBSIDIAN));
  }, /not available/);
  assert.equal(commits, 0);
});

// ---------------------------------------------------------------- jsdom --

var JSDOM = null;
try { JSDOM = require("jsdom").JSDOM; } catch (error) { JSDOM = null; }
var skipDom = JSDOM ? false : "jsdom is not installed";

function sectionHtml() {
  return fs.readFileSync(SECTION, "utf8")
    .replace(/\{%\s*schema\s*%\}[\s\S]*?\{%\s*endschema\s*%\}/, "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/\{%[^%]*%\}/g, "");
}

function loadCalculator() {
  var dom = new JSDOM("<!doctype html><body>" + sectionHtml() + "</body>", {
    runScripts: "outside-only",
    pretendToBeVisual: true,
    url: "https://oceansoptics.com/pages/lens-page"
  });
  var win = dom.window;
  var calls = [];
  var opened = [];
  var initCount = 0;
  win.HTMLElement.prototype.scrollIntoView = function () {};
  win.fetch = function (url, init) {
    var body = init && init.body ? JSON.parse(init.body) : null;
    calls.push({ url: String(url), body: body, auth: init && init.headers && init.headers.Authorization });
    var data = { ok: true };
    if (/\/manual\/init$/.test(url)) {
      initCount += 1;
      data = { configId: CONFIG_ID, editToken: "edit-" + initCount, labelEditToken: "label-" + initCount };
    }
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(data); } });
  };
  win.open = function () {
    var popup = { location: { href: "" }, close: function () { this.closed = true; }, focus: function () {} };
    opened.push(popup);
    return popup;
  };
  win.OOSourceJourney = { record: function () { return null; } };
  ["base", "engine", "high-cyl", "midpoint", "ui", "rx", "products"].forEach(function (name) {
    win.eval(fs.readFileSync(path.join(ASSETS, "oo-lens-calculator-v53-" + name + ".js"), "utf8"));
  });
  var page = { win: win, doc: win.document, calls: calls, opened: opened };
  // The Rx and products modules mount on DOMContentLoaded, as on Shopify.
  if (win.document.readyState !== "loading") return Promise.resolve(page);
  return new Promise(function (resolve) {
    win.document.addEventListener("DOMContentLoaded", function () { resolve(page); }, { once: true });
  });
}

function setEye(doc, side, sphere, cylinder) {
  var eye = doc.querySelector('[data-eye="' + side + '"]');
  [["sphere", sphere], ["cylinder", cylinder || 0]].forEach(function (entry) {
    var field = entry[0];
    var value = entry[1];
    var magnitude = Math.abs(value);
    var sign = eye.querySelector('.oo-v52__sign[data-field="' + field + '"]');
    if (field === "sphere" || magnitude) {
      var want = value < 0 ? "-" : "+";
      while (sign.dataset.sign !== want) sign.click();
    }
    var integer = eye.querySelector('.oo-v52__integer[data-field="' + field + '"]');
    var fraction = eye.querySelector('.oo-v52__fraction[data-field="' + field + '"]');
    integer.value = String(Math.floor(magnitude));
    integer.dispatchEvent(new doc.defaultView.Event("change"));
    fraction.value = String(Math.round((magnitude % 1) * 100)).padStart(2, "0");
    fraction.dispatchEvent(new doc.defaultView.Event("change"));
  });
  if (cylinder) {
    var axis = eye.querySelector('.oo-v52__axis[data-field="axis"]');
    axis.value = "90";
    axis.dispatchEvent(new doc.defaultView.Event("change"));
  }
}

function calculate(page, right, left) {
  setEye(page.doc, "right", right[0], right[1]);
  setEye(page.doc, "left", left[0], left[1]);
  page.doc.getElementById("oo-v52-form").dispatchEvent(new page.win.Event("submit", { cancelable: true }));
}

function chooseCard(doc, strategy) {
  var input = doc.getElementById(strategy === "sharper" ? "oo-v52-midpoint-sharper" : "oo-v52-midpoint-balanced");
  input.click();
}

function settle() {
  return new Promise(function (resolve) { setTimeout(resolve, 20); });
}

function cardPairs(doc) {
  return Array.prototype.map.call(doc.querySelectorAll(".oo-v52-product-card__pair"), function (pair) {
    return pair.textContent;
  }).filter(function (value, index, all) { return all.indexOf(value) === index; });
}

function confirmCalls(page) {
  return page.calls.filter(function (call) { return /\/confirm$/.test(call.url); });
}

function eyeText(doc, side) {
  return doc.getElementById("oo-v52-result-" + side).textContent.trim();
}

test("normal pair with no second option: masks show immediately and nothing is saved until a mask is chosen", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-3.75, -0.75], [-3.75, -0.75]);
  await settle();
  assert.equal(page.doc.getElementById("oo-v52-midpoint").hidden, true);
  assert.equal(eyeText(page.doc, "right"), "-3.50");
  assert.deepEqual(cardPairs(page.doc), ["R -3.50L -3.50"]);
  assert.equal(page.calls.length, 0, "Find My Lens Strength never saves");
  page.doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  assert.equal(confirmCalls(page).length, 1);
  assert.equal(confirmCalls(page)[0].body.recommendationStrategy, "balanced");
});

test("exact midpoint: Balanced masks show at once with the Alternative visible, no See Matching Masks step, cards switch without saving", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-3.25], [-2.75]);
  await settle();
  assert.equal(page.doc.getElementById("oo-v52-midpoint").hidden, false);
  assert.equal(page.doc.getElementById("oo-v52-midpoint-use"), null, "no See Matching Masks button");
  assert.equal(page.doc.getElementById("oo-v52-midpoint-balanced").checked, true, "Balanced is selected by default");
  assert.equal(page.doc.getElementById("oo-v52-midpoint-sharper").checked, false);
  assert.equal(page.doc.getElementById("oo-v52-products").hidden, false);
  assert.deepEqual(cardPairs(page.doc), ["R -2.50L -2.00"]);

  chooseCard(page.doc, "sharper");
  await settle();
  assert.deepEqual(cardPairs(page.doc), ["R -3.00L -2.50"]);
  for (var i = 0; i < 5; i += 1) chooseCard(page.doc, i % 2 ? "balanced" : "sharper");
  await settle();
  assert.equal(page.calls.length, 0, "no backend request while previewing");
  assert.equal(page.doc.querySelectorAll(".oo-v52-products__grid").length, 1);
});

test("exact midpoint: choosing a mask while the Alternative is selected confirms it once", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-3.25], [-2.75]);
  await settle();
  chooseCard(page.doc, "sharper");
  await settle();
  var cta = page.doc.querySelector(".oo-v52-product-card__customize");
  assert.equal(cta.disabled, false);
  cta.click();
  cta.click();
  await settle();

  var confirms = confirmCalls(page);
  assert.equal(confirms.length, 1);
  assert.equal(page.calls.filter(function (call) { return /\/manual\/init$/.test(call.url); }).length, 1);
  assert.equal(confirms[0].body.recommendationStrategy, "closer_to_sph", "the Alternative is saved under its canonical id");
  assert.equal(confirms[0].body.recommendedRight, -3);
  assert.equal(confirms[0].body.recommendedLeft, -2.5);
  assert.equal(page.opened.length, 1);
  var url = new URL(page.opened[0].location.href);
  assert.equal(url.searchParams.get("oo_rx"), CONFIG_ID);
  assert.equal(url.searchParams.get("oo_source"), "lens_calculator_v53");
  assert.deepEqual(cardPairs(page.doc), ["R -3.00L -2.50"]);
  assert.equal(eyeText(page.doc, "right"), "-3.00");
  assert.equal(eyeText(page.doc, "left"), "-2.50");
});

test("exact midpoint: choosing a mask after selecting Balanced again confirms balanced", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-3.25], [-2.75]);
  await settle();
  chooseCard(page.doc, "balanced");
  await settle();
  page.doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  var confirms = confirmCalls(page);
  assert.equal(confirms.length, 1);
  assert.equal(confirms[0].body.recommendationStrategy, "balanced");
  assert.equal(confirms[0].body.recommendedRight, -2.5);
  assert.equal(confirms[0].body.recommendedLeft, -2);
});

test("one-eye midpoints: only the midpoint eye changes in the Alternative pair", { skip: skipDom }, async function () {
  var cases = [[[-3.25], [-3], "R -2.50L -2.50", "R -3.00L -2.50", -3, -2.5], [[-1.25], [-1.75], "R -1.00L -1.00", "R -1.00L -1.50", -1, -1.5]];
  for (var i = 0; i < cases.length; i += 1) {
    var c = cases[i];
    var page = await loadCalculator();
    calculate(page, c[0], c[1]);
    await settle();
    assert.deepEqual(cardPairs(page.doc), [c[2]], "Balanced is the default");
    chooseCard(page.doc, "sharper");
    await settle();
    assert.deepEqual(cardPairs(page.doc), [c[3]]);
    assert.equal(page.calls.length, 0);
    page.doc.querySelector(".oo-v52-product-card__customize").click();
    await settle();
    assert.equal(confirmCalls(page).length, 1);
    assert.equal(confirmCalls(page)[0].body.recommendationStrategy, "closer_to_sph");
    assert.equal(confirmCalls(page)[0].body.recommendedRight, c[4]);
    assert.equal(confirmCalls(page)[0].body.recommendedLeft, c[5]);
  }
});

test("a stale preview cannot be saved after the prescription is edited", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-3.25], [-2.75]);
  await settle();
  var staleCta = page.doc.querySelector(".oo-v52-product-card__customize");
  page.doc.getElementById("oo-v52-edit").click();
  setEye(page.doc, "right", -4);
  await settle();
  assert.equal(page.doc.getElementById("oo-v52-products").hidden, true);
  staleCta.click();
  await settle();
  assert.equal(page.calls.length, 0);
  assert.equal(page.opened.length === 0 || page.opened[0].closed === true, true);
});

test("result display is unchanged: plano and review keep the live presentation", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [0], [-0.25]);
  await settle();
  assert.equal(eyeText(page.doc, "right"), "0.00");
  assert.equal(page.doc.getElementById("oo-v52-result-right-state"), null);

  var review = await loadCalculator();
  calculate(review, [-0.5], [-3]);
  await settle();
  assert.equal(review.doc.getElementById("oo-v52-result-right").hidden, true);
  assert.equal(eyeText(review.doc, "left"), "-2.50");
  assert.equal(review.doc.getElementById("oo-v52-products").hidden, true);
  assert.equal(review.calls.length, 0);
});

test("protected low-minus pairs keep the normal flow without a choice", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-0.75], [-1.75]);
  await settle();
  assert.equal(page.doc.getElementById("oo-v52-midpoint").hidden, true);
  assert.deepEqual(cardPairs(page.doc), ["R -1.00L -1.00"]);
  assert.equal(page.calls.length, 0);
  page.doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  assert.equal(confirmCalls(page)[0].body.recommendationStrategy, "balanced");
});

test("high CYL keeps its own Balanced / Closer to your SPH workflow, with masks shown at once", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-3, -3.5], [-3, -3.5]);
  await settle();
  assert.equal(page.doc.getElementById("oo-v52-high-cyl").hidden, false);
  assert.equal(page.doc.getElementById("oo-v52-midpoint").hidden, true);
  assert.equal(page.doc.getElementById("oo-v52-high-use"), null, "no See Matching Masks step");
  assert.equal(page.doc.getElementById("oo-v52-products").hidden, false);
  var balanced = cardPairs(page.doc);
  page.doc.getElementById("oo-v52-high-alternative").click();
  await settle();
  var closer = cardPairs(page.doc);
  assert.notDeepEqual(closer, balanced);
  assert.equal(page.calls.length, 0);
  page.doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  assert.equal(confirmCalls(page).length, 1);
  assert.equal(confirmCalls(page)[0].body.recommendationStrategy, "closer_to_sph");
});
