"use strict";

// V5.3.5 low-minus exact boundary, the mirror of 5.3.4. An SE of exactly -0.50
// has a continuous underwater target of exactly 0.00, so it selects plano
// instead of manual review. Every other minus, plus, high-CYL reference and
// mixed-sign result is unchanged. Runs the storefront assets exactly as
// Shopify loads them.

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
function eye(sphere, cylinder, axis) {
  return V53.calculateEyeRecommendationV53(raw(sphere, cylinder, axis), "Eye");
}
function values(from, to) {
  var out = [];
  for (var i = 0; i <= Math.round((to - from) / 0.25); i += 1) out.push(Number((from + i * 0.25).toFixed(2)));
  return out;
}

test("A. customer fixture OD -0.25 / -0.50 x065, OS -0.50 / -0.25 x050 (ADD +2.50): 0.00 / -1.00, no review", function () {
  var pair = V53.calculatePrescriptionPairV53(
    { sphere: "-0.25", cylinder: "-0.50", axis: "065", add: "+2.50" },
    { sphere: "-0.50", cylinder: "-0.25", axis: "050", add: "+2.50" }
  );
  assert.equal(V53.VERSION, "5.3.5");
  assert.equal(pair.valid, true);
  assert.equal(pair.right.sphericalEquivalent, -0.5);
  assert.equal(Math.abs(pair.right.preSnapTarget), 0); // -0: the minus side's zero target
  assert.equal(pair.left.sphericalEquivalent, -0.625);
  assert.equal(pair.left.preSnapTarget, -0.125);
  assert.deepEqual([pair.right.recommendation, pair.left.recommendation], ["0.00", "-1.00"]);
  assert.deepEqual([pair.right.stockStatus, pair.left.stockStatus], ["OK", "OK"]);
  assert.deepEqual([pair.right.manualReview, pair.left.manualReview], [false, false]);
  assert.equal(pair.right.warning, null);
  assert.equal(pair.left.stockRule, "low-minus-choice");
  assert.match(pair.right.ooAdjustment, /PLANO CROSSOVER \(RESOLVED\)/);
  assert.match(pair.right.ooAdjustment, /underwater target is exactly plano/);
  assert.equal(pair.mixedSignPlanoFallback.detected, false);
  assert.equal(V53.pairBuildableOnAnyCurrentMask(pair.right.finalStockPower, pair.left.finalStockPower), true);
  // ADD plays no part in the distance lens.
  var noAdd = V53.calculatePrescriptionPairV53(raw(-0.25, -0.5, 65), raw(-0.5, -0.25, 50));
  assert.deepEqual([noAdd.right.recommendation, noAdd.left.recommendation], ["0.00", "-1.00"]);
  // One Balanced result: the plano crossover eye is protected, so no Alternative.
  var choice = Choice.calculatePairRecommendationChoice(pair.right, pair.left);
  assert.equal(choice.available, false);
  assert.equal(choice.reason, "right_plano_crossover");
  assert.equal(HighCyl.calculatePairAlternative(pair.right, pair.left).triggered, false);
});

test("A. the fixture is identical to an existing SE -0.25 plano eye beside the same left eye", function () {
  var exact = V53.calculatePrescriptionPairV53(raw(-0.25, -0.5, 65), raw(-0.5, -0.25, 50));
  var lower = V53.calculatePrescriptionPairV53(raw(-0.25), raw(-0.5, -0.25, 50)); // right SE -0.25
  ["finalStockPower", "recommendation", "stockStatus", "stockRule", "manualReview", "lowMinusChoice", "preSnapTarget", "warning"].forEach(function (key) {
    assert.deepEqual(exact.right[key], lower.right[key], key);
  });
  assert.deepEqual(exact.softerAlternative, lower.softerAlternative);
  var a = Choice.calculatePairRecommendationChoice(exact.right, exact.left);
  var b = Choice.calculatePairRecommendationChoice(lower.right, lower.left);
  assert.deepEqual([a.available, a.reason], [b.available, b.reason]);
});

test("B. V5.3.4 plus fixture OD +1.25 / -1.50 x095, OS +1.75 / -1.00 x090 stays 0.00 / +1.00", function () {
  var pair = V53.calculatePrescriptionPairV53(raw(1.25, -1.5, 95), raw(1.75, -1, 90));
  assert.deepEqual([pair.right.recommendation, pair.left.recommendation], ["0.00", "+1.00"]);
  assert.deepEqual([pair.right.manualReview, pair.left.manualReview], [false, false]);
  assert.equal(V53.computeV53Recommendation(0.5).finalPower, 0);
});

test("C. boundary: SE -0.49 -> 0.00, SE -0.50 -> 0.00, SE -0.51 -> -1.00 (low-minus choice)", function () {
  [[-0.49, 0, 0, null], [-0.5, 0, 0, null], [-0.51, -0.01, -1, "low-minus-choice"]].forEach(function (row) {
    var rec = V53.computeV53Recommendation(row[0]);
    assert.ok(Math.abs(rec.preSnapTarget - row[1]) < 1e-9, "target for SE " + row[0]);
    assert.equal(rec.finalPower, row[2], "power for SE " + row[0]);
    assert.equal(rec.stockStatus, "OK", "status for SE " + row[0]);
  });
  assert.equal(V53.selectStockPower(-0.01, -0.51, V53.V53_CONFIG.myopiaAvailablePowers).rule, "low-minus-choice");
});

test("D. surrounding low-minus results are unchanged", function () {
  [[-0.25, 0], [-0.375, 0], [-0.625, -1], [-0.75, -1], [-0.875, -1], [-1, -1], [-1.125, -1]].forEach(function (row) {
    assert.equal(V53.computeV53Recommendation(row[0]).finalPower, row[1], "SE " + row[0]);
  });
  assert.equal(eye(-0.5, -0.25).recommendation, "-1.00"); // SE -0.625
  assert.equal(eye(-0.5, -0.25).lowMinusChoice, true);
  assert.equal(eye(-0.75).recommendation, "-1.00");
  assert.equal(eye(-1).recommendation, "-1.00");
  assert.equal(eye(-1.25).recommendation, "-1.00");
  assert.equal(eye(-1.25).stockRule, "plano-to-first-minus-gap");
  assert.equal(eye(-1.5).recommendation, "-1.00");
  assert.equal(eye(-2).recommendation, "-1.50");
  assert.equal(eye(-4.5).recommendation, "-4.00");
});

test("minus results are monotonic with no manual review from SE 0 to -3.00", function () {
  var previous = 1;
  for (var step = 1; step <= 6000; step += 1) {
    var se = -step * 0.0005;
    var selected = V53.computeV53Recommendation(se).finalPower;
    assert.notEqual(selected, null, "SE " + se);
    assert.ok(selected <= previous, "SE " + se + " rose from " + previous + " to " + selected);
    previous = selected;
  }
});

test("E. high CYL: a quarter-CYL reference of exactly -0.50 keeps its 5.3.4 review", function () {
  // OD +1.00 / -6.00: SE -2.00 -> Balanced -1.50; SPH + CYL/4 = -0.50.
  var right = eye(1, -6, 90);
  var left = eye(-2);
  assert.equal(right.recommendation, "-1.50");
  var strategies = V53.computeStrategyRecommendationsV53(right.normalized.sphere, right.normalized.cylinder);
  assert.equal(strategies.closerToSph.reference, -0.5);
  assert.equal(strategies.closerToSph.recommendation.finalPower, null);
  assert.equal(strategies.closerToSph.recommendation.stockStatus, "PLANO_CROSSOVER_REVIEW");
  var alt = HighCyl.calculatePairAlternative(right, left);
  assert.equal(alt.triggered, true);
  assert.equal(alt.available, false, "no Alternative introduced");
  // The same value on the spherical-equivalent path is plano.
  assert.equal(V53.computeV53Recommendation(-0.5).finalPower, 0);
  assert.equal(V53.computeV53Recommendation(-0.5, { exactLowMinusReview: true }).stockStatus, "PLANO_CROSSOVER_REVIEW");
});

test("E. high CYL: an SE -0.50 high-CYL eye is now plano; very high CYL keeps its own review", function () {
  var high = eye(1, -3, 90); // SE -0.50, CYL 3.00
  assert.equal(high.sphericalEquivalent, -0.5);
  assert.equal(high.recommendation, "0.00");
  assert.equal(high.manualReview, false);
  var veryHigh = eye(1.25, -3.5, 90); // SE -0.50, CYL 3.50
  assert.equal(veryHigh.recommendation, "0.00");
  assert.equal(veryHigh.manualReview, true);
  assert.equal(veryHigh.warning.level, "very-high");
});

test("F. mixed sign: an SE -0.50 eye is plano, so no mixed-sign detection; existing fallback unchanged", function () {
  var pair = V53.calculatePrescriptionPairV53(raw(-0.25, -0.5, 65), raw(1.5)); // left SE +1.50, target +1.00
  assert.deepEqual([pair.right.recommendation, pair.left.recommendation], ["0.00", "+1.00"]);
  assert.equal(pair.mixedSignPlanoFallback.detected, false);
  assert.equal(V53.pairBuildableOnAnyCurrentMask(pair.right.finalStockPower, pair.left.finalStockPower), true);
  var fallback = V53.calculatePrescriptionPairV53(raw(-1, 0.5, 20), raw(0.5, 0.5, 150));
  assert.deepEqual([fallback.right.recommendation, fallback.left.recommendation], ["0.00", "0.00"]);
  assert.equal(fallback.mixedSignPlanoFallback.applied, true);
});

test("grid: every SE -0.50 eye is plano and no valid eye is left without a lens", function () {
  var minusHalf = 0;
  values(-12, 8).forEach(function (sphere) {
    values(-6, 6).forEach(function (cylinder) {
      var result = V53.calculateEyeRecommendationV53(raw(sphere, cylinder, 90), "Grid eye");
      assert.equal(result.valid, true);
      assert.notEqual(result.recommendation, null, sphere + "/" + cylinder);
      assert.notEqual(result.stockStatus, "PLANO_CROSSOVER_REVIEW", sphere + "/" + cylinder);
      if (Math.abs(result.sphericalEquivalent + 0.5) < 1e-9) {
        minusHalf += 1;
        assert.deepEqual([result.finalStockPower, Math.abs(result.preSnapTarget), result.stockStatus], [0, 0, "OK"]);
      }
    });
  });
  assert.equal(minusHalf, 25);
});
