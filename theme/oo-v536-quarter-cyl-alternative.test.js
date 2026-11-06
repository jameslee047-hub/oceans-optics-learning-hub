"use strict";

// V5.3.6: the existing quarter-cylinder Alternative (SPH + CYL/4, then the
// unchanged 0.50 D underwater adjustment and stock selection) is offered from
// |CYL| >= 2.00 instead of >= 3.00. Balanced, the engine, the reference
// containment of the SE +/-0.50 rules, protections and buildability are
// unchanged; the higher-astigmatism guidance stays at 3.00. Runs the
// storefront assets exactly as Shopify loads them.

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var vm = require("node:vm");

var assets = path.join(__dirname, "base", "assets");
var sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
["base", "engine", "high-cyl", "midpoint"].forEach(function (name) {
  vm.runInContext(fs.readFileSync(path.join(assets, "oo-lens-calculator-v53-" + name + ".js"), "utf8"), sandbox);
});
var V53 = sandbox.OOLensCalculatorV53;
var HighCyl = sandbox.OOV52HighCylinder;
var Choice = sandbox.OOV53RecommendationChoice;

function raw(sphere, cylinder, axis) {
  return { sphere: String(sphere), cylinder: String(cylinder || 0), axis: cylinder ? String(axis || 90) : "" };
}

// What a customer is offered for a pair, exactly as the Lens Calculator and
// Product Rx Checker resolve it: the quarter-CYL comparison when triggered
// (only if it differs from Balanced), otherwise the ordinary choice layer.
function offer(right, left) {
  var pair = V53.calculatePrescriptionPairV53(right, left);
  var high = HighCyl.calculatePairAlternative(pair.right, pair.left);
  var balanced = pair.right.recommendation + "/" + pair.left.recommendation;
  if (high.triggered) {
    var distinct = high.available &&
      !(high.alternative.right === high.balanced.right && high.alternative.left === high.balanced.left);
    return {
      balanced: balanced,
      kind: distinct ? "quarter_cyl" : "single",
      alternative: distinct ? high.alternative.right + "/" + high.alternative.left : null,
      high: high
    };
  }
  var choice = Choice.calculatePairRecommendationChoice(pair.right, pair.left, {
    highCylinderTriggered: false,
    highCylinderThreshold: HighCyl.QUARTER_CYL_ALTERNATIVE_THRESHOLD
  });
  return {
    balanced: balanced,
    kind: choice.available ? choice.reason : "single",
    alternative: choice.available ? choice.alternative.right + "/" + choice.alternative.left : null,
    reason: choice.reason
  };
}

function eyeTrace(sphere, cylinder) {
  var result = V53.calculateEyeRecommendationV53(raw(sphere, cylinder), "Eye");
  var quarter = V53.computeStrategyRecommendationsV53(result.normalized.sphere, result.normalized.cylinder).closerToSph;
  var alternative = HighCyl.calculateEyeAlternative(result);
  return {
    se: result.sphericalEquivalent,
    start: result.preSnapTarget,
    balanced: result.recommendation,
    quarterReference: quarter.reference,
    quarterStart: quarter.recommendation.preSnapTarget,
    quarterLens: quarter.recommendation.finalPower,
    quarterStatus: quarter.recommendation.stockStatus,
    quarterRule: quarter.recommendation.stockRule || null,
    triggered: alternative.triggered,
    alternativeLens: alternative.alternativeRecommendation
  };
}

test("version 5.3.6; the quarter-CYL Alternative threshold (2.00) is separate from the 3.00 guidance threshold", function () {
  assert.equal(V53.VERSION, "5.3.6");
  assert.equal(HighCyl.QUARTER_CYL_ALTERNATIVE_THRESHOLD, 2);
  assert.equal(HighCyl.HIGH_CYL_WARNING_THRESHOLD, 3);
  assert.equal(HighCyl.HIGH_CYL_THRESHOLD, 2, "compatibility name follows the Alternative workflow threshold");
  assert.equal(Choice.QUARTER_CYL_ALTERNATIVE_THRESHOLD, 2);
  assert.equal(Choice.HIGH_CYL_THRESHOLD, 2);
  // The engine's very-high-cylinder manual review is its own CYL band, untouched.
  assert.equal(V53.getCylinderBandV53(2.5), V53.CYL_BAND_HIGH);
  assert.equal(V53.calculateEyeRecommendationV53(raw(-3, -2.5), "Eye").manualReview, false);
  var ui = fs.readFileSync(path.join(assets, "oo-lens-calculator-v53-ui.js"), "utf8");
  assert.match(ui, /var HIGH_CYL_GUIDANCE_THRESHOLD = 3;/);
  assert.match(ui, /cylinderMagnitude\) >= HIGH_CYL_GUIDANCE_THRESHOLD/);
  assert.match(ui, /OOV52HighCylinder\.QUARTER_CYL_ALTERNATIVE_THRESHOLD/);
  var checker = fs.readFileSync(path.join(assets, "oo-product-rx-checker-v53.js"), "utf8");
  assert.match(checker, /highCyl\.QUARTER_CYL_ALTERNATIVE_THRESHOLD/);
});

test("boundary: a normalized |CYL| just below 2.00 stays ordinary; exactly 2.00 and above use quarter-CYL", function () {
  var base = V53.calculateEyeRecommendationV53(raw(-3, -2), "Eye");
  [[-1.75, false], [-1.99, false], [-1.999999, false], [-2, true], [-2.0000001, true], [-2.25, true], [-2.75, true], [-3, true]].forEach(function (entry) {
    var synthetic = Object.assign({}, base, {
      normalized: Object.assign({}, base.normalized, { cylinder: entry[0] }),
      cylinderMagnitude: Math.abs(entry[0])
    });
    assert.equal(HighCyl.calculateEyeAlternative(synthetic).triggered, entry[1], "CYL " + entry[0]);
  });
  // Choice-layer protection uses the same threshold by default.
  assert.equal(Choice.protectedReason(Object.assign({}, base, { cylinderMagnitude: 1.99 }), 2), null);
  assert.equal(Choice.eyeCloserToSphPreference(base).reason, "high_cylinder");
});

test("boundary table SPH -3.00 (both eyes): 1.75 ordinary; 2.00 to 2.75 new quarter-CYL; 3.00 unchanged", function () {
  var expected = {
    "-1.75": { se: -3.875, start: -3.375, balanced: "-3.50", quarterReference: -3.4375, quarterStart: -2.9375, triggered: false, kind: "closer_to_sph", alternative: "-3.00/-3.00" },
    "-2": { se: -4, start: -3.5, balanced: "-3.50", quarterReference: -3.5, quarterStart: -3, triggered: true, kind: "quarter_cyl", alternative: "-3.00/-3.00" },
    "-2.25": { se: -4.125, start: -3.625, balanced: "-3.50", quarterReference: -3.5625, quarterStart: -3.0625, triggered: true, kind: "quarter_cyl", alternative: "-3.00/-3.00" },
    "-2.5": { se: -4.25, start: -3.75, balanced: "-4.00", quarterReference: -3.625, quarterStart: -3.125, triggered: true, kind: "quarter_cyl", alternative: "-3.00/-3.00" },
    "-2.75": { se: -4.375, start: -3.875, balanced: "-4.00", quarterReference: -3.6875, quarterStart: -3.1875, triggered: true, kind: "quarter_cyl", alternative: "-3.00/-3.00" },
    "-3": { se: -4.5, start: -4, balanced: "-4.00", quarterReference: -3.75, quarterStart: -3.25, triggered: true, kind: "quarter_cyl", alternative: "-3.50/-3.50" }
  };
  Object.keys(expected).forEach(function (cyl) {
    var want = expected[cyl];
    var trace = eyeTrace(-3, Number(cyl));
    ["se", "start", "balanced", "quarterReference", "quarterStart", "triggered"].forEach(function (key) {
      assert.equal(trace[key], want[key], "CYL " + cyl + " " + key);
    });
    var result = offer(raw(-3, Number(cyl)), raw(-3, Number(cyl)));
    assert.equal(result.balanced, want.balanced + "/" + want.balanced, "CYL " + cyl + " Balanced unchanged");
    assert.equal(result.kind, want.kind, "CYL " + cyl + " kind");
    assert.equal(result.alternative, want.alternative, "CYL " + cyl + " Alternative");
  });
});

test("#336483 (CYL 1.50 / 1.75) is unchanged: Balanced -1.50/-2.00, Alternative -1.00/-1.50", function () {
  var result = offer(raw(-1.25, -1.5, 180), raw(-1.5, -1.75, 175));
  assert.deepEqual([result.balanced, result.kind, result.alternative], ["-1.50/-2.00", "closer_to_sph", "-1.00/-1.50"]);
});

test("SPH -3.00 / CYL -3.00 is unchanged from 5.3.5: SE -4.50, start -4.00, Balanced -4.00, reference -3.75, start -3.25, Alternative -3.50", function () {
  var trace = eyeTrace(-3, -3);
  assert.deepEqual([trace.se, trace.start, trace.balanced, trace.quarterReference, trace.quarterStart, trace.quarterLens, trace.alternativeLens],
    [-4.5, -4, "-4.00", -3.75, -3.25, -3.5, "-3.50"]);
  assert.equal(trace.quarterRule, "exact-stock-tie-closer-to-se", "-3.25 is an exact tie, resolved toward the reference -3.75");
});

test("CYL 2.00 to 2.75 real orders: previously single prescriptions gain the quarter-CYL Alternative", function () {
  [
    { name: "#336409", right: raw(-2.25, -2.5), left: raw(-2.75, -2.5), balanced: "-3.00/-3.50", alternative: "-2.50/-3.00" },
    { name: "#336398", right: raw(-2.5, -2), left: raw(-2.75, -2), balanced: "-3.00/-3.50", alternative: "-2.50/-3.00" },
    { name: "#336370", right: raw(-4.75, -2.25), left: raw(-4.25, -2.25), balanced: "-5.50/-5.00", alternative: "-5.00/-4.50" },
    { name: "#336246", right: raw(-3.5, -2, 10), left: raw(-5, -1.5, 175), balanced: "-4.00/-5.50", alternative: "-3.50/-5.50" }
  ].forEach(function (fixture) {
    var result = offer(fixture.right, fixture.left);
    assert.deepEqual([result.balanced, result.kind, result.alternative], [fixture.balanced, "quarter_cyl", fixture.alternative], fixture.name);
  });
});

test("one CYL >= 2.00 eye and one ordinary eye: only the threshold eye changes; the ordinary eye keeps Balanced", function () {
  // Right -2.25/-2.50 (quarter-CYL), left -3.00 sphere (ordinary). 5.3.5 offered
  // the ordinary closer_to_sph pair -3.00/-3.00; 5.3.6 uses the existing
  // quarter-CYL pair logic, which never softens or moves the ordinary eye.
  var result = offer(raw(-2.25, -2.5), raw(-3, 0));
  assert.deepEqual([result.balanced, result.kind, result.alternative], ["-3.00/-2.50", "quarter_cyl", "-2.50/-2.50"]);
  assert.equal(result.high.eyes.left.triggered, false);
  assert.equal(result.high.eyes.left.alternativeRecommendation, result.high.eyes.left.balancedRecommendation);
});

test("when the quarter-CYL lens equals Balanced there is no Alternative (existing workflow), never a one-step-softer substitute", function () {
  // +4.00/-2.00 x075, +3.00/-1.25 x110: the right reference +3.50 starts at
  // +3.00, the Balanced lens. 5.3.5 offered the ordinary pair +4.00/+3.00.
  var result = offer(raw(4, -2, 75), raw(3, -1.25, 110));
  assert.deepEqual([result.balanced, result.kind, result.alternative], ["+3.00/+2.00", "single", null]);
  // CYL 2.00 references in the low-minus zone: -0.75 -> low-minus choice
  // -1.00, -1.00 -> -1.00, both equal to Balanced.
  assert.equal(offer(raw(-0.25, -2), raw(-0.25, -2)).kind, "single");
  assert.equal(offer(raw(-0.5, -2), raw(-0.5, -2)).kind, "single");
});

test("low-minus / plano protections stay authoritative on the quarter-CYL reference path", function () {
  // Reference exactly -0.50 (SPH 0, CYL -2): the reference keeps the 5.3.4
  // review (exactLowMinusReview), so no Alternative is offered.
  var minusHalf = eyeTrace(0, -2);
  assert.deepEqual([minusHalf.se, minusHalf.balanced, minusHalf.quarterReference, minusHalf.quarterLens, minusHalf.quarterStatus], [-1, "-1.00", -0.5, null, "PLANO_CROSSOVER_REVIEW"]);
  assert.equal(offer(raw(0, -2), raw(0, -2)).kind, "single");
  // Reference exactly +0.50 (SPH +1.00, CYL -2.00): reference keeps the 5.3.3 review.
  var plusHalf = eyeTrace(1, -2);
  assert.deepEqual([plusHalf.se, plusHalf.balanced, plusHalf.quarterReference, plusHalf.quarterLens, plusHalf.quarterStatus], [0, "0.00", 0.5, null, "PLANO_CROSSOVER_REVIEW"]);
  assert.equal(offer(raw(1, -2), raw(1, -2)).kind, "single");
  // Low-minus choice on the reference (-0.75): -1.00, the Balanced lens.
  var lowMinus = eyeTrace(-0.25, -2);
  assert.deepEqual([lowMinus.quarterReference, lowMinus.quarterLens, lowMinus.quarterRule], [-0.75, -1, "low-minus-choice"]);
  // 0.00 / -1.00 boundary: reference -1.00 -> -1.00, the Balanced lens.
  var boundary = eyeTrace(-0.5, -2);
  assert.deepEqual([boundary.quarterReference, boundary.quarterStart, boundary.quarterLens, boundary.quarterRule], [-1, -0.5, -1, "low-minus-choice"]);
  // First-minus gap on the reference (-1.25, start -0.75 -> -1.00).
  var gap = eyeTrace(-0.75, -2);
  assert.deepEqual([gap.balanced, gap.quarterReference, gap.quarterStart, gap.quarterLens, gap.quarterRule], ["-1.50", -1.25, -0.75, -1, "plano-to-first-minus-gap"]);
  assert.deepEqual([offer(raw(-0.75, -2), raw(-0.75, -2)).kind, offer(raw(-0.75, -2), raw(-0.75, -2)).alternative], ["quarter_cyl", "-1.00/-1.00"]);
  // Plano Balanced (SE +0.25) with a +0.75 reference: the existing low-plus
  // guard gives +1.00 (as already happens for CYL >= 3.00 in 5.3.5). Plano and
  // +1.00 are on the same mask family; no sign crossing.
  var planoPlus = eyeTrace(1.25, -2);
  assert.deepEqual([planoPlus.se, planoPlus.balanced, planoPlus.quarterReference, planoPlus.quarterLens], [0.25, "0.00", 0.75, 1]);
  assert.deepEqual([offer(raw(1.25, -2), raw(1.25, -2)).kind, offer(raw(1.25, -2), raw(1.25, -2)).alternative], ["quarter_cyl", "+1.00/+1.00"]);
});

test("plus prescriptions with CYL >= 2.00: plus stock (1.00 D steps), same sign, nearest-stock rule", function () {
  var strong = eyeTrace(5, -2.5);
  assert.deepEqual([strong.se, strong.start, strong.balanced, strong.quarterReference, strong.quarterStart, strong.quarterLens], [3.75, 3.25, "+3.00", 4.375, 3.875, 4]);
  assert.deepEqual([offer(raw(5, -2.5), raw(5, -2.5)).kind, offer(raw(5, -2.5), raw(5, -2.5)).alternative], ["quarter_cyl", "+4.00/+4.00"]);
  var low = eyeTrace(2.5, -2);
  assert.deepEqual([low.balanced, low.quarterReference, low.quarterLens], ["+1.00", 2, 2]);
  assert.deepEqual([offer(raw(3, -2.75), raw(3, -2.75)).alternative], ["+2.00/+2.00"]);
  // Plus-cylinder notation is normalized before the reference is built.
  assert.deepEqual([offer(raw(-5, 2), raw(-5, 2)).balanced, offer(raw(-5, 2), raw(-5, 2)).alternative], ["-3.50/-3.50", "-3.00/-3.00"]);
});

test("mixed sign: Balanced and the mixed-sign plano fallback are unchanged; the Alternative never bypasses buildability", function () {
  var mixed = V53.calculatePrescriptionPairV53(raw(-2, -2), raw(2.5, -2));
  assert.deepEqual([mixed.right.recommendation, mixed.left.recommendation], ["-2.50", "+1.00"]);
  assert.equal(mixed.mixedSignPlanoFallback.detected, true);
  assert.equal(mixed.mixedSignPlanoFallback.applied, false);
  var high = HighCyl.calculatePairAlternative(mixed.right, mixed.left);
  assert.equal(high.triggered, true);
  assert.equal(high.balancedBuildable, false);
  assert.equal(high.available, false, "no partial or mixed pair is offered");
  // A plano Balanced eye whose quarter-CYL lens is +1.00 next to a minus eye
  // would make a minus/plus pair: unavailable, no compromise.
  var crossing = V53.calculatePrescriptionPairV53(raw(1.25, -2), raw(-1.5, 0));
  var crossingHigh = HighCyl.calculatePairAlternative(crossing.right, crossing.left);
  assert.deepEqual([crossing.right.recommendation, crossing.left.recommendation], ["0.00", "-1.00"]);
  assert.equal(crossingHigh.alternativeBuildable, false);
  assert.equal(crossingHigh.available, false);
});

test("explanation: the quarter-CYL Alternative shows its own reference rows, never as the spherical equivalent", function () {
  var pair = V53.calculatePrescriptionPairV53(raw(-3, -2.5), raw(-3, -2.5));
  var high = HighCyl.calculatePairAlternative(pair.right, pair.left);
  var alternative = Choice.explanationModel({
    rightResult: pair.right,
    leftResult: pair.left,
    recommendation: { recommendationStrategy: "closer_to_sph", recommendedRight: -3, recommendedLeft: -3 },
    highCylinderPreview: high
  });
  assert.deepEqual([alternative.eyes[0].sphereOnlyLabel, alternative.eyes[0].sphereOnly, alternative.eyes[0].underwaterLabel, alternative.eyes[0].underwaterStartingPoint, alternative.eyes[0].lensLabel, alternative.eyes[0].lens],
    ["Alternative sphere only reference", "-3.63", "Alternative underwater adjusted starting point", "-3.13", "Alternative mask lens", "-3.00"]);
  var balanced = Choice.explanationModel({
    rightResult: pair.right,
    leftResult: pair.left,
    recommendation: { recommendationStrategy: "balanced", recommendedRight: -4, recommendedLeft: -4 },
    highCylinderPreview: high
  });
  assert.deepEqual([balanced.eyes[0].sphereOnlyLabel, balanced.eyes[0].sphereOnly, balanced.eyes[0].underwaterLabel, balanced.eyes[0].underwaterStartingPoint, balanced.eyes[0].lensLabel, balanced.eyes[0].lens],
    ["Sphere only strength", "-4.25", "Underwater adjusted starting point", "-3.75", "Recommended mask lens", "-4.00"]);
  assert.equal(balanced.note, "The underwater adjusted starting point is the calculated value before we choose a lens. Prescription mask lenses come in fixed strengths, so the final lens may not exactly match it.");
  // Customer copy rules: no hyphens or dashes, no retired claims.
  // Customer-visible strings only (object keys are internal identifiers).
  function strings(value) {
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.reduce(function (all, item) { return all.concat(strings(item)); }, []);
    if (value && typeof value === "object") return Object.keys(value).reduce(function (all, key) { return all.concat(strings(value[key])); }, []);
    return [];
  }
  var copy = strings([Choice.COPY, alternative.eyes.map(function (e) { return [e.sphereOnlyLabel, e.underwaterLabel, e.lensLabel]; }), balanced.note]).join(" ");
  ["Closer to your SPH", "Sharper", "under-correct", "under correct", "underwater target", "fully corrects"].forEach(function (phrase) {
    assert.equal(copy.toLowerCase().indexOf(phrase.toLowerCase()), -1, phrase);
  });
  Object.keys(Choice.COPY).forEach(function (key) {
    var value = Choice.COPY[key];
    (Array.isArray(value) ? value : [value]).forEach(function (text) {
      assert.doesNotMatch(String(text), /[‐-―]| - /, key);
    });
  });
});
