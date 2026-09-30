/*
 * V5.3 EXPERIMENTAL recommendation engine - regression suite.
 *
 * V5.2 remains a separate historical module and is tested independently.
 * Run: node theme/learning-hub-pilot/tests/lens-calculator-v53.test.js
 */

var assert = require("node:assert/strict");
var test = require("node:test");
var V5 = require("../assets/lens-calculator-v5.js");
var V53 = require("../assets/lens-calculator-v53.js");

var EPSILON = 1e-9;
var HALF_STEP_STOCK = [];
for (var magnitude = 0; magnitude <= 9 + EPSILON; magnitude += 0.5) {
  HALF_STEP_STOCK.push(Math.round(magnitude * 100) / 100);
}

function eye(sphere, cylinder, axis) {
  return { sphere: String(sphere), cylinder: String(cylinder), axis: axis === null ? "" : String(axis) };
}

function signedHalfStepStock(sign) {
  return HALF_STEP_STOCK.map(function (power) { return sign * power; });
}

function expectedTowardZeroHalfStep(target) {
  var magnitude = Math.floor((Math.abs(target) + EPSILON) * 2) / 2;
  return target < 0 ? -magnitude : magnitude;
}

test("V5.3 is isolated from historical V5.2", function () {
  assert.equal(V5.VERSION, "5.2.0-experimental");
  assert.equal(V53.VERSION, "5.3.0-experimental");
  assert.notEqual(V53.calculateEyeRecommendationV53, V5.calculateEyeRecommendationV5);
});

test("documented myopia examples use directional stock snapping", function () {
  [
    { se: -7.875, target: -7.375, final: -7.0 },
    { se: -5.25, target: -4.75, final: -4.5 },
    { se: -5.75, target: -5.25, final: -5.0 },
    { se: -4.9, target: -4.4, final: -4.0 }
  ].forEach(function (example) {
    var result = V53.computeV53Recommendation(example.se);
    assert.equal(result.preSnapTarget, example.target, "target for SE " + example.se);
    assert.equal(result.finalPower, example.final, "final power for SE " + example.se);
    assert.ok(Math.abs(result.finalPower) <= Math.abs(result.preSnapTarget) + EPSILON);
  });
});

test("positive selector examples are sign-symmetric when those half-step powers are stocked", function () {
  var positiveStock = signedHalfStepStock(1);
  var first = V53.directionalStockPowerTowardZero(4.75, positiveStock);
  var second = V53.directionalStockPowerTowardZero(3.375, positiveStock);
  assert.equal(first.power, 4.5);
  assert.equal(second.power, 3.0);
  assert.deepEqual(first.rejectedStrongerCandidates.map(function (candidate) { return candidate.power; }), [5.0]);
  assert.deepEqual(second.rejectedStrongerCandidates.map(function (candidate) { return candidate.power; }), [3.5]);
});

test("screenshot prescription changes only the post-target stock selection", function () {
  var raw = eye(-6.5, -2.75, 180);
  var v5 = V5.calculateEyeRecommendationV5(raw, "Right (OD)");
  var v53 = V53.calculateEyeRecommendationV53(raw, "Right (OD)");

  assert.equal(v5.sphericalEquivalent, -7.875);
  assert.equal(v53.sphericalEquivalent, -7.875);
  assert.equal(v5.preSnapTarget, -7.375);
  assert.equal(v53.preSnapTarget, -7.375);
  assert.equal(v5.recommendation, "-7.50");
  assert.equal(v53.recommendation, "-7.00");
  assert.equal(v53.effectiveWeakeningFromReference, 0.875);
  assert.deepEqual(v53.stockCandidates.map(function (candidate) { return candidate.power; }), [-7.5, -7.0]);
  assert.deepEqual(v53.rejectedStrongerCandidates.map(function (candidate) { return candidate.power; }), [-7.5]);
});

test("exact stocked targets remain unchanged", function () {
  var result = V53.computeV53Recommendation(-5.0);
  assert.equal(result.preSnapTarget, -4.5);
  assert.equal(result.finalPower, -4.5);
  assert.deepEqual(result.stockCandidates, [{ power: -4.5, distanceFromTarget: 0, eligible: true }]);
  assert.deepEqual(result.rejectedStrongerCandidates, []);
});

test("broad half-step boundaries always snap toward zero for both signs", function () {
  var fractions = [0.01, 0.12, 0.24, 0.25, 0.26, 0.37, 0.49];

  fractions.forEach(function (fraction) {
    var magnitude = 4 + fraction;
    [1, -1].forEach(function (sign) {
      var target = sign * magnitude;
      var result = V53.directionalStockPowerTowardZero(target, signedHalfStepStock(sign));
      assert.equal(result.power, expectedTowardZeroHalfStep(target), "directional result for " + target);
      assert.ok(Math.abs(result.power) <= Math.abs(target) + EPSILON, "not stronger than target " + target);
    });

    var plus = V53.directionalStockPowerTowardZero(magnitude, signedHalfStepStock(1));
    var minus = V53.directionalStockPowerTowardZero(-magnitude, signedHalfStepStock(-1));
    assert.equal(plus.power, -minus.power, "plus/minus symmetry at magnitude " + magnitude);
  });
});

test("every ordinary minus result is no stronger than its continuous target", function () {
  [-8.99, -8.51, -7.875, -6.26, -5.01, -4.49, -3.37, -2.12, -1.01].forEach(function (se) {
    var result = V53.computeV53Recommendation(se);
    // The approved plano-to-first-minus gap rule is the one place a minus
    // stock power may be stronger than the target; it is tested separately below.
    if (result.stockStatus === "OK" && result.stockRule !== "plano-to-first-minus-gap") {
      assert.ok(Math.abs(result.finalPower) <= Math.abs(result.preSnapTarget) + EPSILON, "configured result for SE " + se);
    }
  });
});

test("farsighted results use the nearest stocked plus power, exact ties toward zero, never stronger than SE", function () {
  var plus = V53.V53_CONFIG.hyperopiaAvailablePowers;
  [1.01, 2.12, 3.37, 4.49, 5.01, 1.125, 1.625, 2.625, 3.125, 3.75].forEach(function (se) {
    var result = V53.computeV53Recommendation(se);
    assert.equal(result.stockRule, V53.PLUS_NEAREST_STOCK_RULE, "SE " + se);
    assert.equal(result.finalPower, V53.nearestAvailablePowerTowardZero(result.preSnapTarget, plus).power, "nearest for SE " + se);
    assert.ok(result.finalPower <= se + EPSILON, "never stronger than SE " + se);
  });
  [[1.25, 1], [1.5, 1], [1.625, 2], [1.75, 2], [2.25, 2], [2.5, 2], [2.625, 3], [2.75, 3], [3.5, 3], [3.75, 4], [4.5, 4], [4.625, 5], [6, 5]].forEach(function (entry) {
    assert.equal(V53.plusNearestStockSelection(entry[0], entry[0] + 0.5, plus).power, entry[1], "target +" + entry[0]);
  });
});

test("farsighted recommendation never weakens as SE increases (outside the SE +0.50 review)", function () {
  var previous = null;
  for (var i = 1; i <= 80; i += 1) {
    var se = i * 0.125;
    var result = V53.computeV53Recommendation(se);
    if (Math.abs(se - 0.5) < EPSILON) {
      assert.equal(result.stockStatus, "PLANO_CROSSOVER_REVIEW");
      continue;
    }
    if (previous !== null) assert.ok(result.finalPower >= previous - EPSILON, "SE +" + se);
    previous = result.finalPower;
  }
});

test("low-plus guard on SE: below +0.50 plano, above +0.50 up to +1.00 gives +1.00", function () {
  [[0.25, 0], [0.375, 0], [0.625, 1], [0.75, 1], [0.875, 1], [1.0, 1], [1.125, 1], [1.25, 1], [1.375, 1], [1.5, 1], [1.625, 1], [2.125, 2], [2.25, 2]].forEach(function (entry) {
    var result = V53.computeV53Recommendation(entry[0]);
    assert.equal(result.finalPower, entry[1], "SE +" + entry[0]);
    assert.equal(result.stockStatus, "OK");
  });
});

test("named farsighted order R +3.25/-0.25 x075, L +3.25/-1.00 x100 gives +3.00 / +2.00", function () {
  var right = V53.calculateEyeRecommendationV53({ sphere: "3.25", cylinder: "-0.25", axis: "75" }, "Right");
  var left = V53.calculateEyeRecommendationV53({ sphere: "3.25", cylinder: "-1.00", axis: "100" }, "Left");
  assert.deepEqual([right.sphericalEquivalent, right.preSnapTarget, right.recommendation], [3.125, 2.625, "+3.00"]);
  assert.deepEqual([left.sphericalEquivalent, left.preSnapTarget, left.recommendation], [2.75, 2.25, "+2.00"]);
});

test("Balanced and Closer-to-SPH references use the identical V5.3 stock policy", function () {
  var sph = -2.75;
  var cyl = -4.0;
  var strategies = V53.computeStrategyRecommendationsV53(sph, cyl);
  var balancedReference = strategies.balanced.reference;
  var closerReference = strategies.closerToSph.reference;
  var balanced = strategies.balanced.recommendation;
  var closer = strategies.closerToSph.recommendation;

  assert.equal(balancedReference, -4.75);
  assert.equal(closerReference, -3.75);
  assert.equal(balanced.preSnapTarget, -4.25);
  assert.equal(closer.preSnapTarget, -3.25);
  assert.equal(balanced.finalPower, -4.0);
  assert.equal(closer.finalPower, -3.0);
  assert.ok(Math.abs(balanced.finalPower) <= Math.abs(balanced.preSnapTarget) + EPSILON);
  assert.ok(Math.abs(closer.finalPower) <= Math.abs(closer.preSnapTarget) + EPSILON);
});

test("transposition invariance remains intact", function () {
  var minusForm = V53.calculateEyeRecommendationV53(eye(-6.5, -2.75, 180), "Right (OD)");
  var plusForm = V53.calculateEyeRecommendationV53(eye(-9.25, 2.75, 90), "Right (OD)");

  assert.equal(minusForm.sphericalEquivalent, plusForm.sphericalEquivalent);
  assert.equal(minusForm.preSnapTarget, plusForm.preSnapTarget);
  assert.equal(minusForm.recommendation, plusForm.recommendation);
  assert.equal(minusForm.warning.level, plusForm.warning.level);
});

test("plus-side plano crossover (low-plus guard) and exact-zero targets are unchanged from V5.2", function () {
  // SE -0.50 and -0.25 give a target of exactly 0.00 (not inside the minus
  // gap), so the V5.2 crossover still decides them, including manual review.
  // Below SE +1.00 the plus side keeps the same SE-based crossover.
  [-0.5, -0.25, 0.25, 0.5, 0.75].forEach(function (se) {
    var v5 = V5.computeV5Recommendation(se);
    var v53 = V53.computeV53Recommendation(se);
    assert.equal(v53.finalPower, v5.finalPower, "crossover final power for SE " + se);
    assert.equal(v53.stockStatus, v5.stockStatus, "crossover status for SE " + se);
    assert.deepEqual(v53.planoCrossoverCandidates, v5.planoCrossoverCandidates, "crossover candidates for SE " + se);
    assert.equal(v53.stockRule, null, "no stock rule for SE " + se);
  });
  // SE exactly +1.00 is inside the guard: +1.00 (production's directional rule gave 0.00).
  assert.equal(V53.computeV53Recommendation(1.0).finalPower, 1);
});

test("plano-to-first-minus gap: less than 0.50 D of minus uses plano, 0.50 D or more uses -1.00", function () {
  var myopia = V53.V53_CONFIG.myopiaAvailablePowers;
  [
    [-0.25, 0], [-0.49, 0], [-0.5, -1], [-0.51, -1], [-0.625, -1], [-0.75, -1], [-0.875, -1]
  ].forEach(function (entry) {
    var selection = V53.planoToFirstMinusGapSelection(entry[0], myopia);
    assert.ok(selection, "rule applies to target " + entry[0]);
    assert.equal(selection.power, entry[1], "target " + entry[0]);
    assert.equal(selection.stockStatus, "OK");
    assert.equal(selection.rule, "plano-to-first-minus-gap");
    assert.match(selection.reason, /less than 0\.50 D of minus correction use plano; targets with 0\.50 D or more use -1\.00/);
  });
  // Outside the open interval (0.00, -1.00), or on the plus side, the rule never applies.
  [0, -0, -1, -1.25, -3, 0.25, 0.75].forEach(function (target) {
    var catalog = target > 0 ? V53.V53_CONFIG.hyperopiaAvailablePowers : myopia;
    assert.equal(V53.planoToFirstMinusGapSelection(target, catalog), null, "target " + target);
  });
  assert.equal(V53.selectStockPower(-1, -1.5, myopia).power, -1);
});

test("approved gap cases: SE -1.00 or stronger (inside the gap) gives -1.00, weaker gives plano", function () {
  var cases = [
    [-1.375, -0.875, -1], [-1.25, -0.75, -1], [-1.125, -0.625, -1], [-1.01, -0.51, -1],
    [-1.0, -0.5, -1], [-0.99, -0.49, 0], [-0.875, -0.375, 0], [-0.75, -0.25, 0]
  ];
  cases.forEach(function (entry) {
    var result = V53.computeV53Recommendation(entry[0]);
    assert.ok(Math.abs(result.preSnapTarget - entry[1]) < EPSILON, "target for SE " + entry[0]);
    assert.equal(result.finalPower, entry[2], "final for SE " + entry[0]);
    assert.equal(result.stockRule, "plano-to-first-minus-gap");
    assert.equal(result.planoCrossoverCandidates, null);
    assert.match(result.ooAdjustment, /Plano-to-first-minus gap: targets with less than 0\.50 D/);
  });
  var eye = V53.calculateEyeRecommendationV53({ sphere: "-1.00", cylinder: "-0.75", axis: "90" }, "Right");
  assert.equal(eye.recommendation, "-1.00");
  assert.equal(eye.stockRule, "plano-to-first-minus-gap");
});

test("normalization, 0.50 D adjustment, CYL bands and warnings remain V5.2-equivalent", function () {
  [
    eye(-4.0, 0, null),
    eye(-4.0, -0.75, 20),
    eye(-4.0, -1.75, 80),
    eye(-4.0, -3.0, 120),
    eye(-4.0, -3.25, 170),
    eye(-6.75, 3.0, 130)
  ].forEach(function (raw) {
    var v5 = V5.calculateEyeRecommendationV5(raw, "Right (OD)");
    var v53 = V53.calculateEyeRecommendationV53(raw, "Right (OD)");
    assert.deepEqual(v53.normalized, v5.normalized);
    assert.equal(v53.sphericalEquivalent, v5.sphericalEquivalent);
    assert.equal(v53.preSnapTarget, v5.preSnapTarget);
    assert.equal(v53.underwaterAdjustmentApplied, v5.underwaterAdjustmentApplied);
    assert.equal(v53.cylinderBand, v5.cylinderBand);
    assert.deepEqual(v53.warning, v5.warning);
  });
});
