"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var V53 = require("./lens-calculator-v53.js");
var V5Historical = require("./lens-calculator-v5.js");
var HighCyl = require("./lens-calculator-v52-high-cyl.js");
var Rx = require("./lens-calculator-v52-rx.js");
var Products = require("./lens-calculator-v52-products.js");

function eye(sphere, cylinder, axis) {
  return { sphere: String(sphere), cylinder: String(cylinder), axis: String(axis || 90) };
}

function calculate(sphere, cylinder, axis) {
  var balanced = V53.calculateEyeRecommendationV53(eye(sphere, cylinder, axis), "Test eye");
  assert.equal(balanced.valid, true);
  return { balanced: balanced, alternative: HighCyl.calculateEyeAlternative(balanced) };
}

var matrix = [
  { sph: -4, cyl: -2.75, se: -5.375, balanced: "-4.50", base: null, target: null, alternative: "-4.50", difference: 0, triggered: false },
  { sph: -4, cyl: -3, se: -5.5, balanced: "-5.00", base: -4.75, target: -4.25, alternative: "-4.00", difference: 1, triggered: true },
  { sph: -1.5, cyl: -3.25, se: -3.125, balanced: "-2.50", base: -2.3125, target: -1.8125, alternative: "-1.50", difference: 1, triggered: true },
  { sph: -3, cyl: -3.5, se: -4.75, balanced: "-4.00", base: -3.875, target: -3.375, alternative: "-3.00", difference: 1, triggered: true },
  { sph: -2.75, cyl: -4, se: -4.75, balanced: "-4.00", base: -3.75, target: -3.25, alternative: "-3.00", difference: 1, triggered: true },
  { sph: -4.5, cyl: -4.5, se: -6.75, balanced: "-6.00", base: -5.625, target: -5.125, alternative: "-5.00", difference: 1, triggered: true },
  { sph: -2, cyl: -5, se: -4.5, balanced: "-4.00", base: -3.25, target: -2.75, alternative: "-2.50", difference: 1.5, triggered: true },
  { sph: -3, cyl: -6, se: -6, balanced: "-5.50", base: -4.5, target: -4, alternative: "-4.00", difference: 1.5, triggered: true },
  { sph: 5, cyl: -3.25, se: 3.375, balanced: "+3.00", base: 4.1875, target: 3.6875, alternative: "+4.00", difference: 1, triggered: true },
  { sph: 6, cyl: -4, se: 4, balanced: "+3.00", base: 5, target: 4.5, alternative: "+4.00", difference: 1, triggered: true },
  { sph: 8, cyl: -6, se: 5, balanced: "+4.00", base: 6.5, target: 6, alternative: "+5.00", difference: 1, triggered: true }
];

test("preview uses the same V5.3 implementation as the comparison harness", function () {
  var previewEngine = fs.readFileSync(path.join(__dirname, "lens-calculator-v53.js"), "utf8");
  var harnessEngine = fs.readFileSync(path.join(__dirname, "../learning-hub-pilot/assets/lens-calculator-v53.js"), "utf8");
  var uiSource = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-ui.js"), "utf8");
  var highCylinderSource = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-high-cyl.js"), "utf8");

  assert.equal(previewEngine, harnessEngine);
  assert.equal(V53.VERSION, "5.3.0-experimental");
  assert.equal(V5Historical.VERSION, "5.2.0-experimental");
  assert.match(uiSource, /OOLensCalculatorV53\.calculateEyeRecommendationV53/);
  assert.doesNotMatch(uiSource, /OOLensCalculatorV5\.calculateEyeRecommendationV5/);
  assert.match(highCylinderSource, /computeStrategyRecommendationsV53/);

  ["index.html", "lens-calculator-v52-preview.html"].forEach(function (filename) {
    var html = fs.readFileSync(path.join(__dirname, filename), "utf8");
    assert.match(html, /<script src="lens-calculator-v53\.js" defer><\/script>/);
    assert.doesNotMatch(html, /<script src="lens-calculator-v5\.js" defer><\/script>/);
  });
});

test("V5.3 values flow unchanged into durable confirmation and product compatibility", function () {
  var right = V53.calculateEyeRecommendationV53(eye(-6.5, -2.75, 180), "Right (OD)");
  var left = V53.calculateEyeRecommendationV53(eye(-6.5, -2.75, 180), "Left (OS)");
  var selected = {
    recommendationStrategy: "balanced",
    recommendedRight: Number(right.recommendation),
    recommendedLeft: Number(left.recommendation),
    displayRight: right.recommendation,
    displayLeft: left.recommendation
  };
  var confirmedRx = {
    right: { sph: -6.5, cyl: 2.75, cylSign: "-", axis: 180 },
    left: { sph: -6.5, cyl: 2.75, cylSign: "-", axis: 180 }
  };
  var payload = Rx.buildConfirmationPayload(confirmedRx, {
    successful: true,
    rightResult: right,
    leftResult: left,
    activeRecommendation: selected
  });
  var compatible = Products.findCompatibleProducts(payload.recommendedRight, payload.recommendedLeft);

  assert.equal(right.preSnapTarget, -7.375);
  assert.equal(right.recommendation, "-7.00");
  assert.equal(payload.calculatorVersion, "5.3.0-experimental");
  assert.deepEqual([payload.recommendedRight, payload.recommendedLeft], [-7, -7]);
  assert.equal(payload.recommendationStrategy, "balanced");
  assert.ok(compatible.products.some(function (product) { return product.id === "obsidian-nearsighted"; }));
  assert.ok(compatible.products.every(function (product) {
    return Products.supportsPower(product, payload.recommendedRight) && Products.supportsPower(product, payload.recommendedLeft);
  }));
});

test("high-cylinder matrix exposes the full primary and alternative calculation", function () {
  matrix.forEach(function (expected) {
    var result = calculate(expected.sph, expected.cyl);
    var balanced = result.balanced;
    var alternative = result.alternative;

    assert.equal(balanced.original.sphere, expected.sph, "original SPH");
    assert.equal(balanced.original.cylinder, expected.cyl, "original signed CYL");
    assert.equal(alternative.normalized.sphere, expected.sph, "normalized SPH");
    assert.equal(alternative.normalized.cylinder, expected.cyl, "normalized CYL");
    assert.equal(alternative.sphericalEquivalent, expected.se, "spherical equivalent");
    assert.equal(alternative.balancedRecommendation, expected.balanced, "Balanced V5.3");
    assert.equal(alternative.quarterCylinderBase, expected.base, "quarter-cylinder base");
    assert.equal(alternative.alternativeTarget, expected.target, "alternative underwater target");
    assert.equal(alternative.alternativeRecommendation, expected.alternative, "alternative stock result");
    assert.equal(alternative.absoluteDifference, expected.difference, "difference");
    assert.equal(alternative.triggered, expected.triggered, "threshold state");

    if (expected.triggered && alternative.absoluteDifference > 0) {
      assert.ok(
        alternative.alternativeDistanceFromSphere < alternative.balancedDistanceFromSphere,
        "alternative is closer to normalized SPH"
      );
    }
  });
});

test("2.75 CYL does not trigger and does not run quarter-cylinder math", function () {
  var result = calculate(-4, -2.75).alternative;
  assert.equal(result.triggered, false);
  assert.equal(result.unchanged, true);
  assert.equal(result.quarterCylinderBase, null);
  assert.equal(result.alternativeTarget, null);
});

test("exactly 3.00 CYL triggers quarter-cylinder math", function () {
  var result = calculate(-4, -3).alternative;
  assert.equal(result.triggered, true);
  assert.equal(result.unchanged, false);
  assert.equal(result.quarterCylinderBase, -4.75);
  assert.equal(result.alternativeTarget, -4.25);
  assert.equal(result.alternativeRecommendation, "-4.00");
});

test("every requested CYL magnitude at or above 3.00 triggers", function () {
  [3, 3.25, 3.5, 4, 4.5, 5, 6].forEach(function (magnitude) {
    assert.equal(calculate(-2, -magnitude).alternative.triggered, true, "CYL " + magnitude);
  });
});

test("the documented -4.00 / -4.00 example returns -5.50 and -4.50", function () {
  var result = calculate(-4, -4);
  assert.equal(result.balanced.sphericalEquivalent, -6);
  assert.equal(result.alternative.quarterCylinderBase, -5);
  assert.equal(result.balanced.preSnapTarget, -5.5);
  assert.equal(result.alternative.alternativeTarget, -4.5);
  assert.equal(result.balanced.recommendation, "-5.50");
  assert.equal(result.alternative.alternativeRecommendation, "-4.50");
});

test("alternative stock selection rejects stronger candidates and moves toward zero", function () {
  var negative = HighCyl.nearestStockTowardZero(
    -4.75,
    V53.V53_CONFIG.myopiaAvailablePowers
  );
  assert.equal(negative.power, -4.5);
  assert.deepEqual(negative.stockCandidates.map(function (candidate) { return candidate.power; }), [-5, -4.5]);
  assert.deepEqual(negative.rejectedStrongerCandidates.map(function (candidate) { return candidate.power; }), [-5]);

  var positive = HighCyl.nearestStockTowardZero(
    4.5,
    V53.V53_CONFIG.hyperopiaAvailablePowers
  );
  assert.equal(positive.power, 4);
  assert.deepEqual(positive.stockCandidates.map(function (candidate) { return candidate.power; }), [5, 4]);
  assert.deepEqual(positive.rejectedStrongerCandidates.map(function (candidate) { return candidate.power; }), [5]);
});

test("a real quarter-cylinder boundary uses the shared V5.3 direction", function () {
  var result = calculate(-2, -5);
  assert.equal(result.alternative.alternativeTarget, -2.75);
  assert.deepEqual(
    result.alternative.stockCandidates.map(function (candidate) { return candidate.power; }),
    [-3, -2.5]
  );
  assert.deepEqual(result.alternative.rejectedStrongerCandidates.map(function (candidate) { return candidate.power; }), [-3]);
  assert.equal(result.alternative.alternativePower, -2.5);
  assert.equal(result.alternative.balancedPower, -4);
});

test("the specified -2.75 / -4.00 boundary returns -3.00", function () {
  var result = calculate(-2.75, -4);
  assert.equal(result.alternative.quarterCylinderBase, -3.75);
  assert.equal(result.alternative.alternativeTarget, -3.25);
  assert.deepEqual(
    result.alternative.stockCandidates.map(function (candidate) { return candidate.power; }),
    [-3.5, -3]
  );
  assert.deepEqual(result.alternative.rejectedStrongerCandidates.map(function (candidate) { return candidate.power; }), [-3.5]);
  assert.equal(result.alternative.alternativeRecommendation, "-3.00");
});

test("plus-cylinder equivalents normalize and recommend identically", function () {
  matrix.filter(function (row) { return row.triggered; }).forEach(function (row) {
    var minus = calculate(row.sph, row.cyl, 90);
    var plusSphere = row.sph + row.cyl;
    var plus = calculate(plusSphere, Math.abs(row.cyl), 180);

    assert.equal(plus.balanced.original.sphere, plusSphere, "plus-form original SPH");
    assert.equal(plus.balanced.original.cylinder, Math.abs(row.cyl), "plus-form original CYL");
    assert.equal(plus.balanced.normalized.sphere, minus.balanced.normalized.sphere, "normalized SPH");
    assert.equal(plus.balanced.normalized.cylinder, minus.balanced.normalized.cylinder, "normalized CYL");
    assert.equal(plus.balanced.sphericalEquivalent, minus.balanced.sphericalEquivalent, "SE");
    assert.equal(plus.balanced.recommendation, minus.balanced.recommendation, "Balanced result");
    assert.equal(plus.alternative.quarterCylinderBase, minus.alternative.quarterCylinderBase, "quarter base");
    assert.equal(plus.alternative.alternativeTarget, minus.alternative.alternativeTarget, "alternative target");
    assert.equal(plus.alternative.alternativeRecommendation, minus.alternative.alternativeRecommendation, "alternative result");
  });
});

test("one high-cylinder eye reuses the normal eye's Balanced recommendation", function () {
  var right = calculate(-4, -4).balanced;
  var left = calculate(-3, 0).balanced;
  var pair = HighCyl.calculatePairAlternative(right, left);

  assert.equal(pair.triggered, true);
  assert.equal(pair.eyes.right.unchanged, false);
  assert.equal(pair.eyes.left.unchanged, true);
  assert.equal(pair.eyes.left.quarterCylinderBase, null);
  assert.equal(pair.balanced.right, "-5.50");
  assert.equal(pair.alternative.right, "-4.50");
  assert.equal(pair.balanced.left, "-2.50");
  assert.equal(pair.alternative.left, "-2.50");
});

test("both high-cylinder eyes receive independently calculated alternatives", function () {
  var right = calculate(-4, -4).balanced;
  var left = calculate(-2, -5).balanced;
  var pair = HighCyl.calculatePairAlternative(right, left);

  assert.equal(pair.eyes.right.triggered, true);
  assert.equal(pair.eyes.left.triggered, true);
  assert.deepEqual(pair.balanced, { right: "-5.50", left: "-4.00" });
  assert.deepEqual(pair.alternative, { right: "-4.50", left: "-2.50" });
});

test("the requested two-eye example produces distinct complete pairs", function () {
  var right = calculate(-2.75, -3).balanced;
  var left = calculate(-2.75, -4).balanced;
  var pair = HighCyl.calculatePairAlternative(right, left);

  assert.deepEqual(pair.balanced, { right: "-3.50", left: "-4.00" });
  assert.deepEqual(pair.alternative, { right: "-3.00", left: "-3.00" });
});

test("alternative recommendations respect both V5.3 stock limits", function () {
  var myopic = calculate(-12, -6).alternative;
  var hyperopic = calculate(12, -6).alternative;
  assert.equal(myopic.alternativePower, -9);
  assert.equal(hyperopic.alternativePower, 5);
  assert.ok(V53.V53_CONFIG.myopiaAvailablePowers.includes(myopic.alternativePower));
  assert.ok(V53.V53_CONFIG.hyperopiaAvailablePowers.includes(hyperopic.alternativePower));
});

test("stock limits report convergence without changing either result", function () {
  var result = calculate(-12, -6);
  assert.equal(result.balanced.recommendation, "-9.00");
  assert.equal(result.alternative.alternativeRecommendation, "-9.00");
  assert.equal(result.alternative.sameAsBalanced, true);
  assert.equal(result.alternative.alternativeNote, "Same lens");
});

test("an unresolved primary plano crossover cannot produce an alternative display", function () {
  var primary = V53.calculateEyeRecommendationV53(eye(1.5, -4, 90), "Test eye");
  var alternative = HighCyl.calculateEyeAlternative(primary);
  assert.equal(primary.stockStatus, "PLANO_CROSSOVER_REVIEW");
  assert.equal(primary.recommendation, null);
  assert.equal(alternative.triggered, true);
  assert.equal(alternative.available, false);
  assert.equal(alternative.alternativeRecommendation, null);
});

test("the helper does not mutate V5.3 results or stock catalogs", function () {
  var result = calculate(-4, -4).balanced;
  var resultBefore = JSON.stringify(result);
  var stockBefore = JSON.stringify(V53.V53_CONFIG);
  HighCyl.calculateEyeAlternative(result);
  assert.equal(JSON.stringify(result), resultBefore);
  assert.equal(JSON.stringify(V53.V53_CONFIG), stockBefore);
});

test("recommendation selection defaults to Balanced and switches complete pairs", function () {
  var right = calculate(-2.75, -3).balanced;
  var left = calculate(-2.75, -4).balanced;
  var preview = HighCyl.calculatePairAlternative(right, left);

  assert.deepEqual(HighCyl.recommendationSelection(preview), {
    recommendationStrategy: "balanced",
    recommendedRight: -3.5,
    recommendedLeft: -4,
    displayRight: "-3.50",
    displayLeft: "-4.00"
  });
  assert.deepEqual(HighCyl.recommendationSelection(preview, "closer_to_sph"), {
    recommendationStrategy: "closer_to_sph",
    recommendedRight: -3,
    recommendedLeft: -3,
    displayRight: "-3.00",
    displayLeft: "-3.00"
  });
});

test("durable confirmation uses each selected high-CYL pair and strategy without changing confirmed Rx", function () {
  var right = calculate(-2.75, -3).balanced;
  var left = calculate(-2.75, -4).balanced;
  var preview = HighCyl.calculatePairAlternative(right, left);
  var confirmedRx = {
    right: { sph: -2.75, cyl: 3, cylSign: "-", axis: 90 },
    left: { sph: -2.75, cyl: 4, cylSign: "-", axis: 80 }
  };
  [
    { strategy: "balanced", recommendedRight: -3.5, recommendedLeft: -4 },
    { strategy: "closer_to_sph", recommendedRight: -3, recommendedLeft: -3 }
  ].forEach(function (expected) {
    var payload = Rx.buildConfirmationPayload({
      right: confirmedRx.right,
      left: confirmedRx.left
    }, {
      successful: true,
      rightResult: right,
      leftResult: left,
      highCylinderPreview: preview,
      activeRecommendation: HighCyl.recommendationSelection(preview, expected.strategy)
    });

    assert.deepEqual(payload.right, confirmedRx.right);
    assert.deepEqual(payload.left, confirmedRx.left);
    assert.equal(payload.recommendationStrategy, expected.strategy);
    assert.equal(payload.recommendedRight, expected.recommendedRight);
    assert.equal(payload.recommendedLeft, expected.recommendedLeft);
  });
});

test("high-cylinder markup uses native whole-card radios and a visible selected state", function () {
  var html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  var css = fs.readFileSync(path.join(__dirname, "lens-calculator-v52.css"), "utf8");

  assert.match(html, /type="radio"[^>]+value="balanced" checked/);
  assert.match(html, /<label class="oo-v52-high-cyl__option" for="oo-v52-high-balanced">/);
  assert.match(html, /<label class="oo-v52-high-cyl__option" for="oo-v52-high-alternative">/);
  assert.match(html, /id="oo-v52-high-use"[^>]*>See Matching Masks<\/button>/);
  assert.match(css, /\.oo-v52-high-cyl__input:checked \+ \.oo-v52-high-cyl__option/);
  assert.match(css, /\.oo-v52-high-cyl__input:focus-visible \+ \.oo-v52-high-cyl__option/);
});

test("calculation helper is collapsed, personalized, and driven by engine result fields", function () {
  var html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  var source = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-ui.js"), "utf8");
  var css = fs.readFileSync(path.join(__dirname, "lens-calculator-v52.css"), "utf8");

  assert.match(html, /<details class="oo-v52-calc-details" id="oo-v52-calc-details" hidden>/);
  assert.doesNotMatch(html, /id="oo-v52-calc-details"[^>]* open/);
  assert.match(html, /Why is my mask lens different from my glasses prescription\?/);
  assert.match(html, /See how we calculated this/);
  assert.match(html, /id="oo-v52-calc-summary" aria-expanded="false"/);
  assert.match(html, /Your glasses prescription/);
  assert.match(html, /Convert to a sphere-only lens/);
  assert.match(html, /Adjust for underwater use/);
  assert.match(html, /Match to an available mask lens/);
  assert.doesNotMatch(html, /Sphere-only reference|Underwater target|Stocked lens|Final recommendation/);
  assert.match(html, /Your selected approach:/);
  assert.match(source, /spherical equivalent — SPH plus half of your CYL/);
  assert.match(source, /uses a smaller portion of your CYL value/);
  assert.match(source, /eyeResult\.sphericalEquivalent/);
  assert.match(source, /eyeResult\.preSnapTarget/);
  assert.match(source, /highEye\.quarterCylinderBase/);
  assert.match(source, /highEye\.alternativeTarget/);
  assert.match(source, /calculationDetails\.addEventListener\("toggle"/);
  assert.match(source, /setAttribute\("aria-expanded", String\(calculationDetails\.open\)\)/);
  assert.match(css, /\.oo-v52-calc-details summary:hover/);
  assert.match(css, /\.oo-v52-calc-details summary:focus-visible/);
});

test("high-cylinder result keeps one concise lead-in and customer-facing strategy labels", function () {
  var html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  var source = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-ui.js"), "utf8");
  var css = fs.readFileSync(path.join(__dirname, "lens-calculator-v52.css"), "utf8");

  assert.match(html, /Your prescription has higher astigmatism, so you can choose between two sphere-only approaches\./);
  assert.equal((html.match(/oo-v52-high-cyl__shared/g) || []).length, 0);
  assert.match(html, /Balanced \(Spherical Equivalent\)/);
  assert.match(html, /Uses your spherical equivalent — SPH plus half of your CYL\./);
  assert.match(html, /Uses a smaller portion of your CYL, keeping the result closer to the SPH value on your prescription\./);
  assert.match(source, /Balanced \(Spherical Equivalent\)/);
  assert.match(css, /\.oo-v52__result\.has-high-cyl > \.oo-v52__result-intro[\s\S]*?display:\s*none/);
});
