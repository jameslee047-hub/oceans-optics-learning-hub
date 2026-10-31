"use strict";

// V5.3.4 low-plus exact boundary. An SE of exactly +0.50 has a continuous
// underwater target of exactly 0.00, so it selects plano instead of manual
// review. Every other low-plus, minus, high-CYL and mixed-sign result is
// unchanged. Runs the storefront assets exactly as Shopify loads them.

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
function power(se) {
  return V53.computeV53Recommendation(se).finalPower;
}

test("customer fixture OD +1.25 / -1.50 x095, OS +1.75 / -1.00 x090 (ADD +1.75): 0.00 / +1.00, no review", function () {
  var pair = V53.calculatePrescriptionPairV53(
    { sphere: "+1.25", cylinder: "-1.50", axis: "095", add: "+1.75" },
    { sphere: "+1.75", cylinder: "-1.00", axis: "090", add: "+1.75" }
  );
  assert.equal(pair.valid, true);
  assert.equal(pair.right.sphericalEquivalent, 0.5);
  assert.equal(pair.right.preSnapTarget, 0);
  assert.equal(pair.left.sphericalEquivalent, 1.25);
  assert.equal(pair.left.preSnapTarget, 0.75);
  assert.deepEqual([pair.right.recommendation, pair.left.recommendation], ["0.00", "+1.00"]);
  assert.deepEqual([pair.right.stockStatus, pair.left.stockStatus], ["OK", "OK"]);
  assert.deepEqual([pair.right.manualReview, pair.left.manualReview], [false, false]);
  assert.notEqual(pair.right.warning && pair.right.warning.level, "plano-crossover-review");
  assert.equal(pair.mixedSignPlanoFallback.detected, false);
  assert.equal(pair.softerAlternative, null);
  // ADD plays no part in the distance lens.
  var noAdd = V53.calculatePrescriptionPairV53(raw(1.25, -1.5, 95), raw(1.75, -1, 90));
  assert.deepEqual([noAdd.right.recommendation, noAdd.left.recommendation], ["0.00", "+1.00"]);
  // One Balanced result: the plano eye is protected, so no Alternative.
  var choice = Choice.calculatePairRecommendationChoice(pair.right, pair.left);
  assert.equal(choice.available, false);
  assert.equal(choice.reason, "right_plano_crossover");
  assert.equal(HighCyl.calculatePairAlternative(pair.right, pair.left).triggered, false);
});

test("SE +0.50 resolves exactly like a lower plano SE (same result shape)", function () {
  var exact = eye(1.25, -1.5, 95);
  var lower = eye(0.75, -0.75, 90); // SE +0.375
  assert.equal(lower.sphericalEquivalent, 0.375);
  ["finalStockPower", "recommendation", "stockStatus", "stockRule", "manualReview", "lowMinusChoice", "preSnapTarget"].forEach(function (key) {
    assert.deepEqual(exact[key], lower[key], key);
  });
  assert.ok(Array.isArray(exact.planoCrossoverCandidates) && exact.planoCrossoverCandidates.length === 2);
  assert.match(exact.ooAdjustment, /PLANO CROSSOVER \(RESOLVED\)/);
  assert.match(exact.ooAdjustment, /underwater target is exactly plano/);
});

test("boundary: SE +0.49 -> 0.00, SE +0.50 -> 0.00, SE +0.51 -> +1.00", function () {
  [[0.49, 0, 0], [0.5, 0, 0], [0.51, 0.01, 1]].forEach(function (row) {
    var rec = V53.computeV53Recommendation(row[0]);
    assert.ok(Math.abs(rec.preSnapTarget - row[1]) < 1e-9, "target for SE " + row[0]);
    assert.equal(rec.finalPower, row[2], "power for SE " + row[0]);
    assert.equal(rec.stockStatus, "OK", "status for SE " + row[0]);
  });
});

test("plus results are monotonic with no manual review from SE 0 to +3.00", function () {
  var previous = -1;
  for (var step = 1; step <= 6000; step += 1) {
    var se = step * 0.0005;
    var selected = power(se);
    assert.notEqual(selected, null, "SE " + se);
    assert.ok(selected >= previous, "SE " + se + " dropped from " + previous + " to " + selected);
    previous = selected;
  }
});

test("existing low-plus above +0.50 through +1.00 stays +1.00", function () {
  [0.51, 0.625, 0.75, 0.875, 1].forEach(function (se) {
    assert.equal(power(se), 1, "SE " + se);
  });
  assert.equal(eye(1, -0.75).recommendation, "+1.00"); // SE +0.625
  assert.equal(eye(0.75).recommendation, "+1.00");
  assert.equal(eye(1.25, -0.75).recommendation, "+1.00"); // SE +0.875
  assert.equal(eye(1).recommendation, "+1.00");
  assert.equal(eye(1.5).recommendation, "+1.00");
  assert.equal(eye(1.5).stockRule, "plus-nearest-stock");
});

test("minus is unchanged, including the SE -0.50 manual review", function () {
  assert.equal(eye(-0.5).recommendation, null);
  assert.equal(eye(-0.5).manualReview, true);
  assert.equal(eye(-0.5).stockStatus, "PLANO_CROSSOVER_REVIEW");
  assert.equal(eye(-0.25).recommendation, "0.00");
  assert.equal(eye(-0.75).recommendation, "-1.00");
  assert.equal(eye(-0.75).lowMinusChoice, true);
  assert.equal(eye(-1.25).recommendation, "-1.00");
  assert.equal(eye(-1.25).stockRule, "plano-to-first-minus-gap");
  assert.equal(eye(-1.875 + 0.375, -0.75).recommendation, "-1.50"); // SE -1.875, target -1.375
  assert.equal(eye(-4.5).recommendation, "-4.00");
});

test("high CYL Balanced is unchanged; an SE +0.50 high-CYL eye now resolves to plano", function () {
  var minusHigh = eye(-2.75, -3.25, 170);
  assert.equal(minusHigh.recommendation, "-4.00");
  var plusHigh = eye(2, -3, 90); // SE +0.50, CYL 3.00
  assert.equal(plusHigh.sphericalEquivalent, 0.5);
  assert.equal(plusHigh.recommendation, "0.00");
  assert.equal(plusHigh.manualReview, false);
  var alt = HighCyl.calculatePairAlternative(plusHigh, eye(1.5));
  assert.equal(alt.triggered, true);
  assert.deepEqual([alt.alternative.right, alt.alternative.left], ["+1.00", "+1.00"], "quarter-CYL reference +1.25 -> +1.00");
  // Very high CYL keeps its manual review whatever the SE.
  var veryHigh = eye(2.25, -3.5, 90); // SE +0.50, CYL 3.50
  assert.equal(veryHigh.recommendation, "0.00");
  assert.equal(veryHigh.manualReview, true);
});

test("mixed sign: an SE +0.50 eye is plano, so no new mixed-sign detection; existing fallback unchanged", function () {
  var pair = V53.calculatePrescriptionPairV53(raw(1.25, -1.5, 95), raw(-2));
  assert.deepEqual([pair.right.recommendation, pair.left.recommendation], ["0.00", "-1.50"]);
  assert.equal(pair.mixedSignPlanoFallback.detected, false);
  assert.equal(V53.pairBuildableOnAnyCurrentMask(pair.right.finalStockPower, pair.left.finalStockPower), true);
  var fallback = V53.calculatePrescriptionPairV53(raw(-1, 0.5, 20), raw(0.5, 0.5, 150));
  assert.deepEqual([fallback.right.recommendation, fallback.left.recommendation], ["0.00", "0.00"]);
  assert.equal(fallback.mixedSignPlanoFallback.applied, true);
});

test("high CYL Alternative: a quarter-CYL reference of exactly +0.50 keeps its 5.3.3 review", function () {
  // OD +2.00 / -6.00: SE -1.00 -> Balanced -1.00; SPH + CYL/4 = +0.50.
  var right = eye(2, -6, 90);
  var left = eye(-2);
  assert.equal(right.recommendation, "-1.00");
  var strategies = V53.computeStrategyRecommendationsV53(right.normalized.sphere, right.normalized.cylinder);
  assert.equal(strategies.closerToSph.reference, 0.5);
  assert.equal(strategies.closerToSph.recommendation.finalPower, null);
  assert.equal(strategies.closerToSph.recommendation.stockStatus, "PLANO_CROSSOVER_REVIEW");
  var alt = HighCyl.calculatePairAlternative(right, left);
  assert.equal(alt.triggered, true);
  assert.equal(alt.available, false, "no Alternative introduced");
  // The same reference on the spherical-equivalent path is plano.
  assert.equal(V53.computeV53Recommendation(0.5).finalPower, 0);
  assert.equal(strategies.balanced.recommendation.finalPower, -1);
});
