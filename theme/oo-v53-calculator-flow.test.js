"use strict";

// V5.3 Lens Calculator page flow: second recommendation options (broadened
// Sharper, Closer to Your SPH preference), the shared calculation
// explanation, Edit Prescription invalidation, save timing and multiple
// previewed prescriptions. Runs the real section and scripts in jsdom and is
// skipped when jsdom is not available
// (NODE_PATH=/path/to/node_modules node --test theme/).

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

var ASSETS = path.join(__dirname, "base", "assets");
var SECTION = path.join(__dirname, "base", "sections", "oo-lens-calculator-v53.liquid");
var CONFIG_ID = "7adf6f8a-1f62-4e2e-9d06-5f5348997a43";

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
  var journey = [];
  var initCount = 0;
  win.HTMLElement.prototype.scrollIntoView = function () {};
  win.fetch = function (url, init) {
    var body = init && init.body ? JSON.parse(init.body) : null;
    calls.push({ url: String(url), body: body });
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
  win.OOSourceJourney = { record: function (source) { journey.push(source); return null; } };
  ["base", "engine", "high-cyl", "midpoint", "ui", "rx", "products"].forEach(function (name) {
    win.eval(fs.readFileSync(path.join(ASSETS, "oo-lens-calculator-v53-" + name + ".js"), "utf8"));
  });
  var page = { win: win, doc: win.document, calls: calls, opened: opened, journey: journey };
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

function text(doc, id) {
  return doc.getElementById(id).textContent.replace(/\s+/g, " ").trim();
}

function visibleText(doc, selector) {
  return Array.prototype.map.call(doc.querySelectorAll(selector), function (node) { return node.textContent; }).join(" ");
}

function choiceOrder(doc) {
  return Array.prototype.map.call(doc.querySelectorAll("#oo-v52-midpoint .oo-v52-high-cyl__choice"), function (choice) {
    var input = choice.querySelector("input");
    var title = choice.querySelector(".oo-v52-high-cyl__option-title").textContent.replace(/\s+/g, " ").trim();
    return input.value + (input.checked ? "*" : "") + " " + title;
  });
}

test("B. -7.00/-0.75 and -7.75/-1.25: strictly closer Sharper -7.00/-8.00 is the default Closer Match; Softer -6.50/-7.50 saves balanced", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-7, -0.75], [-7.75, -1.25]);
  await settle();
  assert.equal(page.doc.getElementById("oo-v52-midpoint").hidden, false);
  assert.equal(text(page.doc, "oo-v52-midpoint-balanced-right"), "-6.50");
  assert.equal(text(page.doc, "oo-v52-midpoint-balanced-left"), "-7.50");
  assert.equal(text(page.doc, "oo-v52-midpoint-sharper-right"), "-7.00");
  assert.equal(text(page.doc, "oo-v52-midpoint-sharper-left"), "-8.00");
  assert.equal(page.doc.getElementById("oo-v52-midpoint-sharper").value, "sharper");
  assert.deepEqual(choiceOrder(page.doc), ["sharper* Closer Match Recommended", "balanced Softer Option"]);
  assert.equal(page.doc.getElementById("oo-v52-midpoint-alternative-notice").hidden, true, "Sharper never exceeds SE");
  assert.deepEqual(cardPairs(page.doc), ["R -7.00L -8.00"], "masks follow the default Sharper pair straight away");
  assert.equal(page.win.OOV52CalculatorUI.getActiveRecommendation().recommendationStrategy, "sharper");

  page.doc.getElementById("oo-v52-midpoint-balanced").click();
  await settle();
  assert.deepEqual(cardPairs(page.doc), ["R -6.50L -7.50"]);
  assert.equal(page.calls.length, 0, "switching cards never saves");
  page.doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  var confirms = confirmCalls(page);
  assert.equal(confirms.length, 1);
  assert.deepEqual(
    [confirms[0].body.recommendationStrategy, confirms[0].body.recommendedRight, confirms[0].body.recommendedLeft],
    ["balanced", -6.5, -7.5]
  );
  assert.deepEqual(confirms[0].body.right, { sph: -7, cyl: 0.75, cylSign: "-", axis: 90 });
  var url = new URL(page.opened[0].location.href);
  assert.equal(url.searchParams.get("oo_rx"), CONFIG_ID);
  assert.equal(url.searchParams.get("oo_source"), "lens_calculator_v53");
});

test("default selects the recommended Sharper option for the #336254 and #336246 fixtures", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  var sharper = page.doc.getElementById("oo-v52-midpoint-sharper");
  var balanced = page.doc.getElementById("oo-v52-midpoint-balanced");

  calculate(page, [4, -0.75], [4.25, -0.75]);
  await settle();
  assert.equal(text(page.doc, "oo-v52-midpoint-sharper-right"), "+4.00");
  assert.equal(text(page.doc, "oo-v52-midpoint-sharper-left"), "+4.00");
  assert.equal(text(page.doc, "oo-v52-midpoint-balanced-right"), "+3.00");
  assert.equal(text(page.doc, "oo-v52-midpoint-balanced-left"), "+3.00");
  assert.equal(sharper.checked, true, "Sharper — Recommended is checked on initial display");
  assert.equal(balanced.checked, false);
  assert.deepEqual(cardPairs(page.doc), ["R +4.00L +4.00"]);

  page.doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  var firstConfirm = confirmCalls(page)[0];
  assert.deepEqual(firstConfirm.body.v53Snapshot.optionsShown, {
    closer_to_sph: { right: "+4.00", left: "+4.00" },
    balanced: { right: "+3.00", left: "+3.00" }
  });
  assert.equal(firstConfirm.body.v53Snapshot.recommendedStrategy, "closer_to_sph");
  assert.equal(firstConfirm.body.v53Snapshot.selectedStrategy, "closer_to_sph", JSON.stringify(firstConfirm.body.v53Snapshot));
  assert.equal(firstConfirm.body.v53Snapshot.selectionEvidence, "default_recommendation");

  var togglePage = await loadCalculator();
  calculate(togglePage, [4, -0.75], [4.25, -0.75]);
  await settle();
  var toggleBalanced = togglePage.doc.getElementById("oo-v52-midpoint-balanced");
  var toggleSharper = togglePage.doc.getElementById("oo-v52-midpoint-sharper");
  toggleBalanced.click();
  await settle();
  assert.equal(toggleBalanced.checked, true, "Balanced can be selected");
  assert.equal(toggleSharper.checked, false);
  assert.equal(togglePage.win.OOV52CalculatorUI.getActiveRecommendation().recommendationStrategy, "balanced");
  toggleSharper.click();
  await settle();
  assert.equal(toggleSharper.checked, true, "Sharper can be selected again");
  assert.equal(toggleBalanced.checked, false);
  togglePage.doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  var explicitConfirm = confirmCalls(togglePage)[0];
  assert.equal(explicitConfirm.body.v53Snapshot.selectedStrategy, "closer_to_sph");
  assert.equal(explicitConfirm.body.v53Snapshot.selectionEvidence, "customer_explicit");

  var page336246 = await loadCalculator();
  calculate(page336246, [-3.5, -2], [-5, -1.5]);
  await settle();
  assert.equal(text(page336246.doc, "oo-v52-midpoint-sharper-right"), "-4.00");
  assert.equal(text(page336246.doc, "oo-v52-midpoint-sharper-left"), "-5.50");
  assert.equal(text(page336246.doc, "oo-v52-midpoint-balanced-right"), "-4.00");
  assert.equal(text(page336246.doc, "oo-v52-midpoint-balanced-left"), "-5.00");
  assert.equal(page336246.doc.getElementById("oo-v52-midpoint-sharper").checked, true, "Sharper is the default for the #336246 fixture too");
  assert.equal(page336246.doc.getElementById("oo-v52-midpoint-balanced").checked, false);
});

test("A. Daniel -3.75/-0.25, -3.50/-0.75: Closer Match -3.50/-3.50 is default, explained, and saved as sharper with no change", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-3.75, -0.25], [-3.5, -0.75]);
  await settle();
  assert.deepEqual(choiceOrder(page.doc), ["sharper* Closer Match Recommended", "balanced Softer Option"]);
  assert.equal(text(page.doc, "oo-v52-midpoint-sharper-right"), "-3.50");
  assert.equal(text(page.doc, "oo-v52-midpoint-sharper-left"), "-3.50");
  assert.equal(text(page.doc, "oo-v52-midpoint-balanced-right"), "-3.00");
  assert.equal(text(page.doc, "oo-v52-midpoint-balanced-left"), "-3.00");
  assert.equal(text(page.doc, "oo-v52-midpoint-alternative-copy"), "The closest stocked match to your calculated underwater strength.");
  var softerCopy = page.doc.getElementById("oo-v52-midpoint-balanced").parentNode.querySelector(".oo-v52-high-cyl__copy").textContent;
  assert.equal(softerCopy, "A slightly softer correction if you prefer a more relaxed underwater feel.");
  assert.deepEqual(cardPairs(page.doc), ["R -3.50L -3.50"]);
  assert.deepEqual(page.journey, [], "automatic default selection is not a product click");

  var explain = visibleText(page.doc, "#oo-v52-explain").replace(/\s+/g, " ");
  ["Calculated underwater strength-3.38 D", "Available nearby lenses", "-3.50 distance 0.12 D", "-3.00 distance 0.38 D",
    "Recommended mask lens-3.50 D",
    "-3.50 is the closer stocked match to your calculated underwater strength. -3.00 remains available as a softer option."].forEach(function (needle) {
    assert.ok(explain.indexOf(needle) !== -1, "missing: " + needle);
  });
  assert.equal(/not stronger than your underwater-adjusted strength/.test(explain), false, "no contradictory directional copy");
  assert.equal(/Your chosen option/.test(explain), false, "the default needs no 'chosen option' step");

  page.doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  var confirms = confirmCalls(page);
  assert.equal(confirms.length, 1);
  assert.deepEqual(
    [confirms[0].body.recommendationStrategy, confirms[0].body.recommendedRight, confirms[0].body.recommendedLeft],
    ["sharper", -3.5, -3.5]
  );
  assert.ok(page.journey.indexOf("lens_calculator_v53") !== -1);
});

test("A. Daniel: choosing Softer shows -3.00/-3.00 masks and explains the softer choice", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-3.75, -0.25], [-3.5, -0.75]);
  await settle();
  page.doc.getElementById("oo-v52-midpoint-balanced").click();
  await settle();
  assert.deepEqual(cardPairs(page.doc), ["R -3.00L -3.00"]);
  assert.equal(page.calls.length, 0);
  assert.match(text(page.doc, "oo-v52-midpoint-selection-status"), /^Softer Option selected\. Right -3\.00, left -3\.00\.$/);
  var explain = visibleText(page.doc, "#oo-v52-explain").replace(/\s+/g, " ");
  assert.ok(explain.indexOf("Recommended mask lens-3.50 D") !== -1);
  assert.ok(explain.indexOf("Selected mask lens-3.00 D") !== -1);
  assert.match(explain, /You chose the Softer Option\. -3\.00 D is the next weaker stocked lens\./);
});

test("A. screenshot tie -2.25 / -1.75: Sharper -2.00/-1.50 wins the exact tie as the Closer Match; Softer -1.50/-1.00", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-2.25], [-1.75]);
  await settle();
  assert.deepEqual(choiceOrder(page.doc), ["sharper* Closer Match Recommended", "balanced Softer Option"]);
  assert.equal(text(page.doc, "oo-v52-midpoint-sharper-right"), "-2.00");
  assert.equal(text(page.doc, "oo-v52-midpoint-sharper-left"), "-1.50");
  assert.equal(text(page.doc, "oo-v52-midpoint-balanced-right"), "-1.50");
  assert.equal(text(page.doc, "oo-v52-midpoint-balanced-left"), "-1.00");
  // The tie is described truthfully: not "closer" to the underwater target.
  assert.equal(text(page.doc, "oo-v52-midpoint-alternative-copy"), "Equally close to your calculated underwater strength, and closer to your prescription.");
  assert.deepEqual(cardPairs(page.doc), ["R -2.00L -1.50"]);
  var explain = visibleText(page.doc, "#oo-v52-explain").replace(/\s+/g, " ");
  assert.ok(explain.indexOf("-2.00 distance 0.25 D") !== -1 && explain.indexOf("-1.50 distance 0.25 D") !== -1);
  assert.ok(explain.indexOf("-2.00 and -1.50 are equally close to your calculated underwater strength. -2.00 stays closer to your prescription, so it is recommended. -1.50 remains available as a softer option.") !== -1);
  assert.equal(/is the closer stocked match/.test(explain.split("Left Eye")[0]), false, "no false 'closer' claim on a tie");
  assert.deepEqual(page.journey, [], "automatic selection is not a product click");

  page.doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  var confirms = confirmCalls(page);
  assert.equal(confirms.length, 1);
  assert.deepEqual([confirms[0].body.recommendationStrategy, confirms[0].body.recommendedRight, confirms[0].body.recommendedLeft], ["sharper", -2, -1.5]);
});

test("A. screenshot tie: choosing Softer shows -1.50/-1.00 masks and saves balanced", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-2.25], [-1.75]);
  await settle();
  page.doc.getElementById("oo-v52-midpoint-balanced").click();
  await settle();
  assert.deepEqual(cardPairs(page.doc), ["R -1.50L -1.00"]);
  assert.equal(page.calls.length, 0, "switching cards never saves");
  assert.match(visibleText(page.doc, "#oo-v52-explain").replace(/\s+/g, " "), /while the Closer Match -2\.00 D is also 0\.25 D away and closer to your prescription/);
  page.doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  var confirms = confirmCalls(page);
  assert.deepEqual([confirms[0].body.recommendationStrategy, confirms[0].body.recommendedRight, confirms[0].body.recommendedLeft], ["balanced", -1.5, -1]);
});

test("UI: the results area has one heading, one short line, the cards, two collapsed accordions, then Your Matching Masks", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-2.25], [-1.75]);
  await settle();
  var result = page.doc.getElementById("oo-v52-result");
  var visible = function (node) {
    for (var n = node; n && n !== page.doc.body; n = n.parentElement) if (n.hidden) return false;
    return true;
  };
  var visibleText = Array.prototype.filter.call(page.doc.querySelectorAll(".oo-v52 *"), function (n) { return visible(n) && !n.children.length; })
    .map(function (n) { return n.textContent; }).join(" ");
  ["We recommend the first option", "Choose the lens option you'd like us to use", "About Your Recommendation", "ABOUT YOUR RECOMMENDATION",
    "Underwater, objects appear larger and closer through a dive mask", "See each step for each eye",
    "We’ve used your prescription values"].forEach(function (needle) {
    assert.equal(visibleText.indexOf(needle), -1, "still visible: " + needle);
  });
  assert.equal(page.doc.getElementById("oo-v52-guidance").hidden, true, "no standalone recommendation box for an ordinary result");
  assert.equal(result.querySelector("h2").textContent, "Suggested Lens Strength");
  assert.equal(visible(page.doc.getElementById("oo-v52-result-intro")), true);
  assert.equal(text(page.doc, "oo-v52-result-intro"), "Switch between the options to see which masks are available with each lens choice.");
  var summaries = Array.prototype.map.call(page.doc.querySelectorAll("#oo-v52-explain summary"), function (s) { return s.textContent.trim(); });
  assert.deepEqual(summaries, ["How we calculated your mask lens", "Why is my mask lens different from my SPH?"]);
  Array.prototype.forEach.call(page.doc.querySelectorAll("#oo-v52-explain details"), function (d) { assert.equal(d.open, false, "accordions start collapsed"); });
  assert.match(page.doc.getElementById("oo-v52-explain").textContent, /Objects appear larger and closer when viewed underwater/, "the underwater concept lives in the accordion");
  assert.equal(text(page.doc, "oo-v52-products-title"), "Your Matching Masks");
  assert.equal(page.doc.querySelector(".oo-v52-products__intro").textContent, "All of the masks below are available with your selected lens strength. Choose the style and colour you prefer.");

  // A single-result prescription has no options, so no "switch" line.
  page.doc.getElementById("oo-v52-edit").click();
  calculate(page, [-3.75, -0.75], [-3.75, -0.75]);
  await settle();
  assert.equal(page.doc.getElementById("oo-v52-result-intro").hidden, true);
  assert.equal(page.doc.getElementById("oo-v52-guidance").hidden, true);
});

test("UI: genuine warnings still show (manual review, higher astigmatism caveat)", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-0.25, -0.5], [-3]);
  await settle();
  assert.equal(page.doc.getElementById("oo-v52-guidance").hidden, false);
  assert.match(page.doc.getElementById("oo-v52-guidance").textContent, /We need to review your right-eye prescription/);
  var high = await loadCalculator();
  calculate(high, [-2.75, -3.25], [-2, -3]);
  await settle();
  assert.equal(high.doc.getElementById("oo-v52-high-cyl").hidden, false);
  assert.match(text(high.doc, "oo-v52-high-description"), /higher astigmatism/);
});

test("farsighted Closer to Your SPH: +3.00/-0.75 and +2.50/-0.50 offer +2.00/+2.00 then +3.00/+2.00 with an SE notice", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [3, -0.75], [2.5, -0.5]);
  await settle();
  assert.equal(text(page.doc, "oo-v52-midpoint-balanced-right"), "+2.00");
  assert.equal(text(page.doc, "oo-v52-midpoint-balanced-left"), "+2.00");
  assert.equal(text(page.doc, "oo-v52-midpoint-sharper-right"), "+3.00");
  assert.equal(text(page.doc, "oo-v52-midpoint-sharper-left"), "+2.00");
  assert.equal(page.doc.getElementById("oo-v52-midpoint-sharper").value, "closer_to_sph");
  assert.equal(text(page.doc, "oo-v52-midpoint-alternative-title"), "Closer to Your SPH");
  // F. The farsighted preference never becomes the default.
  assert.deepEqual(choiceOrder(page.doc), ["balanced* Comfort / Balanced Vision Recommended", "closer_to_sph Closer to Your SPH"]);
  assert.match(text(page.doc, "oo-v52-midpoint-alternative-copy"), /stronger than our calculated underwater recommendation/);
  var notice = page.doc.getElementById("oo-v52-midpoint-alternative-notice");
  assert.equal(notice.hidden, false);
  assert.match(notice.textContent, /right eye \(OD\).*stronger than the spherical-equivalent estimate/);
  assert.deepEqual(cardPairs(page.doc), ["R +2.00L +2.00"]);

  page.doc.getElementById("oo-v52-midpoint-sharper").click();
  await settle();
  assert.deepEqual(cardPairs(page.doc), ["R +3.00L +2.00"]);
  var explain = visibleText(page.doc, "#oo-v52-explain");
  assert.match(explain, /\+3\.00 \+ \(-0\.75 ÷ 2\) = \+2\.625 D/);
  assert.match(explain, /Underwater-adjusted strength\+2\.13 D/);
  assert.match(explain, /stronger than your underwater-adjusted strength \(\+2\.13 D\)/);
  assert.match(explain, /stronger than the spherical-equivalent estimate/);
  page.doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  assert.deepEqual(
    [confirmCalls(page)[0].body.recommendationStrategy, confirmCalls(page)[0].body.recommendedRight, confirmCalls(page)[0].body.recommendedLeft],
    ["closer_to_sph", 3, 2]
  );
});

test("explanation: per-eye steps show the SE equation, underwater adjustment and selected lens, without em dashes or 'median'", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-2.75, -3.25], [-2.75, -3.25]);
  await settle();
  var explain = page.doc.getElementById("oo-v52-explain");
  assert.equal(explain.hidden, false);
  var content = explain.textContent;
  ["How we calculated your mask lens", "Your glasses prescription", "Calculate your overall sphere-only strength",
    "Spherical Equivalent", "SPH + (CYL ÷ 2)", "-2.75 + (-3.25 ÷ 2) = -4.375 D", "-4.38 D", "Adjust for underwater viewing",
    "-4.38 → -3.88", "Select your mask lens", "Why is my mask lens different from my SPH?"].forEach(function (needle) {
    assert.ok(content.indexOf(needle) !== -1, "missing: " + needle);
  });
  var customerText = page.doc.querySelector(".oo-v52").textContent;
  assert.equal(/—/.test(customerText), false, "no em dashes in customer-facing copy");
  assert.equal(/median/i.test(customerText), false);
  assert.equal(/water adds 0\.50/i.test(customerText), false);
});

test("Edit Prescription after choosing Sharper: old option, pair and masks are cleared and cannot be saved", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-7, -0.75], [-7.75, -1.25]);
  await settle();
  page.doc.getElementById("oo-v52-midpoint-sharper").click();
  await settle();
  var staleCta = page.doc.querySelector(".oo-v52-product-card__customize");
  var edit = page.doc.getElementById("oo-v52-edit");
  assert.equal(edit.hidden, false);
  edit.click();
  setEye(page.doc, "right", -6);
  await settle();
  assert.equal(page.doc.getElementById("oo-v52-products").hidden, true);
  assert.equal(page.doc.getElementById("oo-v52-result").hidden, true);
  assert.equal(page.doc.getElementById("oo-v52-midpoint").hidden, true);
  assert.equal(page.doc.getElementById("oo-v52-explain").hidden, true);
  assert.equal(page.win.OOV52CalculatorUI.getActiveRecommendation(), null);
  staleCta.click();
  await settle();
  assert.equal(page.calls.length, 0, "the stale Sharper pair is never saved");

  // The other values are kept; only the edited one changed.
  var left = page.doc.querySelector('[data-eye="left"]');
  assert.equal(left.querySelector('.oo-v52__integer[data-field="sphere"]').value, "7");
  assert.equal(left.querySelector('.oo-v52__fraction[data-field="sphere"]').value, "75");

  page.doc.getElementById("oo-v52-form").dispatchEvent(new page.win.Event("submit", { cancelable: true }));
  await settle();
  // I. The default is recalculated from the NEW prescription: right -6.00
  // lands exactly on -5.50 stock (unchanged), left keeps its closer -8.00.
  assert.deepEqual(choiceOrder(page.doc), ["sharper* Closer Match Recommended", "balanced Softer Option"]);
  assert.equal(text(page.doc, "oo-v52-midpoint-sharper-right"), "-5.50");
  assert.equal(text(page.doc, "oo-v52-midpoint-sharper-left"), "-8.00");
  assert.deepEqual(cardPairs(page.doc), ["R -5.50L -8.00"]);
  page.doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  var confirms = confirmCalls(page);
  assert.equal(confirms.length, 1);
  assert.deepEqual(
    [confirms[0].body.recommendationStrategy, confirms[0].body.right.sph, confirms[0].body.recommendedRight, confirms[0].body.recommendedLeft],
    ["sharper", -6, -5.5, -8]
  );
});

test("L. Edit Prescription recalculates the default from the new prescription each time", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-3.75, -0.25], [-3.5, -0.75]);
  await settle();
  page.doc.getElementById("oo-v52-midpoint-balanced").click();
  await settle();
  assert.equal(page.win.OOV52CalculatorUI.getActiveRecommendation().recommendationStrategy, "balanced");
  // To a prescription with no Sharper candidate: Balanced only.
  page.doc.getElementById("oo-v52-edit").click();
  calculate(page, [-3.75, -0.75], [-3.75, -0.75]);
  await settle();
  assert.equal(page.doc.getElementById("oo-v52-midpoint").hidden, true);
  assert.equal(page.win.OOV52CalculatorUI.getActiveRecommendation().recommendationStrategy, "balanced");
  // To an exact tie: the earlier Softer choice is not carried over.
  page.doc.getElementById("oo-v52-edit").click();
  calculate(page, [-2.25], [-1.75]);
  await settle();
  assert.equal(page.win.OOV52CalculatorUI.getActiveRecommendation().recommendationStrategy, "sharper");
  assert.deepEqual(cardPairs(page.doc), ["R -2.00L -1.50"]);
});

test("multiple prescriptions: an unsaved preview survives Add prescription, keeps its option and name, and switching never saves", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  var doc = page.doc;
  doc.getElementById("oo-v52-rx-label").value = "James";
  calculate(page, [-7, -0.75], [-7.75, -1.25]);
  await settle();
  doc.getElementById("oo-v52-midpoint-sharper").click();
  await settle();
  assert.equal(doc.getElementById("oo-v52-profiles").hidden, false, "Add prescription is offered after calculating");

  doc.getElementById("oo-v52-add-prescription").click();
  await settle();
  assert.equal(doc.getElementById("oo-v52-products").hidden, true);
  doc.getElementById("oo-v52-rx-label").value = "Airies";
  calculate(page, [3, -0.75], [2.5, -0.5]);
  await settle();
  var tabs = Array.prototype.map.call(doc.querySelectorAll(".oo-v52-profiles__tab"), function (tab) { return tab.textContent; });
  assert.deepEqual(tabs, ["James", "Airies"]);
  assert.deepEqual(cardPairs(doc), ["R +2.00L +2.00"]);

  doc.querySelector('.oo-v52-profiles__tab[data-profile-id="prescription-1"]').click();
  await settle();
  assert.equal(doc.getElementById("oo-v52-midpoint-sharper").checked, true, "James keeps Sharper");
  assert.deepEqual(cardPairs(doc), ["R -7.00L -8.00"]);
  assert.equal(doc.getElementById("oo-v52-rx-label").value, "James");
  assert.equal(page.calls.length, 0, "switching prescriptions never saves");

  doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  var confirms = confirmCalls(page);
  assert.equal(confirms.length, 1);
  assert.deepEqual(
    [confirms[0].body.recommendationStrategy, confirms[0].body.recommendedRight, confirms[0].body.recommendedLeft, confirms[0].body.prescriptionLabel],
    ["sharper", -7, -8, "James"]
  );
  var profiles = page.win.OOV52CalculatorUI.getPrescriptionProfiles();
  assert.deepEqual(JSON.parse(JSON.stringify(profiles.map(function (p) { return [p.localId, p.status, p.displayLabel]; }))), [
    ["prescription-1", "ready", "James"],
    ["prescription-2", "preview", "Airies"]
  ]);

  doc.querySelector('.oo-v52-profiles__tab[data-profile-id="prescription-2"]').click();
  await settle();
  assert.equal(doc.getElementById("oo-v52-midpoint-balanced").checked, true);
  doc.getElementById("oo-v52-midpoint-sharper").click();
  await settle();
  assert.deepEqual(cardPairs(doc), ["R +3.00L +2.00"]);
  doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  confirms = confirmCalls(page);
  assert.equal(confirms.length, 2);
  assert.deepEqual(
    [confirms[1].body.recommendationStrategy, confirms[1].body.recommendedRight, confirms[1].body.recommendedLeft, confirms[1].body.prescriptionLabel],
    ["closer_to_sph", 3, 2, "Airies"]
  );
});

test("multiple prescriptions: a Softer choice on a Closer Match default is restored on switching back, not reset to the default", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  var doc = page.doc;
  doc.getElementById("oo-v52-rx-label").value = "Daniel";
  calculate(page, [-3.75, -0.25], [-3.5, -0.75]);
  await settle();
  doc.getElementById("oo-v52-midpoint-balanced").click();
  await settle();
  doc.getElementById("oo-v52-add-prescription").click();
  await settle();
  doc.getElementById("oo-v52-rx-label").value = "Second";
  calculate(page, [-7, -0.75], [-7.75, -1.25]);
  await settle();
  assert.equal(doc.getElementById("oo-v52-midpoint-sharper").checked, true, "the new prescription gets its own default");
  doc.querySelector('.oo-v52-profiles__tab[data-profile-id="prescription-1"]').click();
  await settle();
  assert.equal(doc.getElementById("oo-v52-midpoint-balanced").checked, true, "Daniel keeps Softer");
  assert.deepEqual(cardPairs(doc), ["R -3.00L -3.00"]);
  assert.equal(page.calls.length, 0);
  doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  assert.deepEqual(
    [confirmCalls(page)[0].body.recommendationStrategy, confirmCalls(page)[0].body.recommendedRight, confirmCalls(page)[0].body.prescriptionLabel],
    ["balanced", -3, "Daniel"]
  );
});

test("automatic mask rendering records no tool use; choosing a mask does", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-3.75, -0.75], [-3.75, -0.75]);
  await settle();
  assert.ok(page.doc.querySelectorAll(".oo-v52-product-card").length > 0);
  assert.deepEqual(page.journey, [], "rendering masks is not a product interaction");
  page.doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  assert.ok(page.journey.indexOf("lens_calculator_v53") !== -1);
});

test("no compatible mask: an explicit message is shown instead of an empty area", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-3], [3]);
  await settle();
  assert.equal(page.doc.getElementById("oo-v52-products").hidden, false);
  assert.equal(page.doc.getElementById("oo-v52-products-empty").hidden, false);
  assert.match(page.doc.getElementById("oo-v52-products-empty").textContent, /mixes nearsighted and farsighted/);
  assert.equal(page.doc.getElementById("oo-v52-midpoint").hidden, true, "mixed sign never offers a second option");
});
