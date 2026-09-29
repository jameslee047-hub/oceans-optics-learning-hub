"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var V53 = require("./lens-calculator-v53.js");
var HighCyl = require("./lens-calculator-v52-high-cyl.js");
var Products = require("./lens-calculator-v52-products.js");

function eye(sphere, cylinder) {
  return V53.calculateEyeRecommendationV53({ sphere: String(sphere), cylinder: String(cylinder), axis: "90" }, "Test eye");
}

function highPair() {
  return HighCyl.calculatePairAlternative(eye(-4, -4), eye(-2, -5));
}

function deepFreeze(value) {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
  }
  return value;
}

["index.html", "lens-calculator-v52-preview.html"].forEach(function (file) {
  test(file + " high-CYL screen asks for the approach and explains the next step", function () {
    var html = fs.readFileSync(path.join(__dirname, file), "utf8");
    assert.doesNotMatch(html, /Choose one complete lens pair/);
    assert.doesNotMatch(html, /Use selected lens pair/);
    assert.match(html, /<legend>Choose the lens approach you'd like us to use<\/legend>\s+<p class="oo-v52-high-cyl__next" id="oo-v52-high-next">Next, we’ll show you the masks available with these lens strengths\.<\/p>/);
    assert.match(html, /aria-describedby="oo-v52-high-description oo-v52-high-next"/);
    assert.match(html, /<p class="oo-v52-high-cyl__summary" id="oo-v52-high-summary"><\/p>\s+<button class="oo-v52-high-cyl__use" id="oo-v52-high-use" type="button" aria-describedby="oo-v52-high-summary">See Matching Masks<\/button>/);
    assert.match(html, /Balanced \(Spherical Equivalent\)/);
    assert.match(html, /Closer to your SPH/);
    assert.match(html, /type="radio" id="oo-v52-high-balanced" name="oo-v52-high-strategy" value="balanced" checked/);
  });
});

test("selected summary reflects Balanced from the V5.3 strategy result", function () {
  var pair = highPair();
  var selection = HighCyl.recommendationSelection(pair, HighCyl.STRATEGY_BALANCED);
  assert.equal(HighCyl.selectionSummary(selection), "Selected: Balanced — R -5.50 / L -4.00");
  assert.equal(selection.displayRight, pair.balanced.right);
  assert.equal(selection.displayLeft, pair.balanced.left);
});

test("selected summary updates for Closer to your SPH with that strategy's own values", function () {
  var pair = highPair();
  var selection = HighCyl.recommendationSelection(pair, HighCyl.STRATEGY_CLOSER_TO_SPH);
  assert.equal(HighCyl.selectionSummary(selection), "Selected: Closer to your SPH — R -4.50 / L -2.50");
  assert.equal(selection.displayRight, pair.alternative.right);
  assert.equal(selection.displayLeft, pair.alternative.left);
});

test("summary formats the selection it is given and calculates nothing", function () {
  var fake = { recommendationStrategy: "balanced", recommendedRight: 99, recommendedLeft: 99, displayRight: "-8.00", displayLeft: "-7.00" };
  assert.equal(HighCyl.selectionSummary(fake), "Selected: Balanced — R -8.00 / L -7.00");
  assert.equal(HighCyl.selectionSummary(null), "");
  assert.equal(HighCyl.selectionSummary({ recommendationStrategy: "unknown", displayRight: "-1.00", displayLeft: "-1.00" }), "");
});

test("switching strategy back and forth never alters either pair's values", function () {
  var pair = deepFreeze(highPair());
  var before = JSON.stringify(pair);
  var first = HighCyl.recommendationSelection(pair, "balanced");
  HighCyl.recommendationSelection(pair, "closer_to_sph");
  var again = HighCyl.recommendationSelection(pair, "balanced");
  assert.deepEqual(again, first);
  assert.equal(JSON.stringify(pair), before);
});

test("product matching receives the selected existing pair", function () {
  var pair = highPair();
  ["balanced", "closer_to_sph"].forEach(function (strategy) {
    var selection = HighCyl.recommendationSelection(pair, strategy);
    var expected = Products.findCompatibleProducts(Number(selection.displayRight), Number(selection.displayLeft));
    var matched = Products.findCompatibleProducts(selection.recommendedRight, selection.recommendedLeft);
    assert.deepEqual(matched.products.map(function (p) { return p.id; }), expected.products.map(function (p) { return p.id; }), strategy);
  });
  var ui = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-ui.js"), "utf8");
  assert.match(ui, /selectHighCylinderStrategy\(selected\.value, false\);\s+pendingHighCylinderCalculation\.activeRecommendation = getActiveRecommendation\(\);/);
  assert.match(ui, /document\.dispatchEvent\(new CustomEvent\("oo:v52:calculated", \{ detail: calculation \}\)\);/);
});

test("UI renders the summary from the active selection and uses the new button label", function () {
  var ui = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-ui.js"), "utf8");
  assert.doesNotMatch(ui, /Use selected lens pair/);
  assert.match(ui, /var HIGH_CYL_USE_LABEL = "See Matching Masks";/);
  assert.match(ui, /useButton\.textContent = HIGH_CYL_USE_LABEL;/);
  assert.match(ui, /activeRecommendation = copyRecommendation\(recommendation\);\s+if \(currentHighCylinderPreview\) renderHighCylinderSummary\(activeRecommendation\);/);
  assert.match(ui, /summary\.textContent = window\.OOV52HighCylinder\.selectionSummary\(recommendation\);/);
  assert.match(ui, /currentHighCylinderPreview = preview;\s+selectHighCylinderStrategy\(window\.OOV52HighCylinder\.STRATEGY_BALANCED, false\);/);
});

test("single-strategy prescriptions keep the straightforward result with no strategy choice", function () {
  var pair = HighCyl.calculatePairAlternative(eye(-3, -0.5), eye(-2.5, 0));
  assert.equal(pair.triggered, false);
  assert.throws(function () { HighCyl.recommendationSelection(pair, "balanced"); });
  var ui = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-ui.js"), "utf8");
  assert.match(ui, /if \(!preview\.triggered \|\| !preview\.available\) return preview;/);
});

test("new high-CYL text styles are secondary and wrap on narrow screens", function () {
  var css = fs.readFileSync(path.join(__dirname, "lens-calculator-v52.css"), "utf8");
  assert.match(css, /\.oo-v52-high-cyl__next \{[^}]*color: #5f7283;[^}]*font-size: 13px;/);
  assert.match(css, /\.oo-v52-high-cyl__summary \{[^}]*overflow-wrap: anywhere;/);
  assert.match(css, /\.oo-v52-high-cyl__summary:empty \{\s+display: none;/);
});
