"use strict";

// V5.3.2 nearest-stock regression fix. Ordinary eyes choose the stocked lens
// nearest the underwater target; only an exact midpoint is resolved toward the
// original spherical equivalent. Special low-minus / plano safety rules remain.
// Runs the storefront assets exactly as Shopify loads them.

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var vm = require("node:vm");

var ASSETS = path.join(__dirname, "base", "assets");
var sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
["base", "engine", "high-cyl", "midpoint"].forEach(function (name) {
  vm.runInContext(fs.readFileSync(path.join(ASSETS, "oo-lens-calculator-v53-" + name + ".js"), "utf8"), sandbox);
});
var V53 = sandbox.OOLensCalculatorV53;
var HighCyl = sandbox.OOV52HighCylinder;
var Choice = sandbox.OOV53RecommendationChoice;
var EPSILON = 1e-9;

function eye(sphere, cylinder, axis) {
  return V53.calculateEyeRecommendationV53({ sphere: String(sphere), cylinder: String(cylinder || 0), axis: cylinder ? String(axis || 90) : "" }, "Eye");
}
function plain(value) { return JSON.parse(JSON.stringify(value)); }

test("calculator version is 5.3.2 (snapshot schemaVersion is unaffected)", function () {
  assert.equal(V53.VERSION, "5.3.2");
  assert.equal(eye(-2).version, "5.3.2");
});

test("#336314 OD -2.00 / +0.50 x144, OS -2.50 / +0.75 x156: right tie -1.00 / -1.50 resolves to -1.50; Balanced and Alternative converge to -1.50 / -1.50", function () {
  var right = eye(-2, 0.5, 144);
  var left = eye(-2.5, 0.75, 156);
  assert.equal(right.sphericalEquivalent, -1.75);
  assert.equal(right.preSnapTarget, -1.25);
  assert.deepEqual(plain(right.tieCandidates.map(function (c) { return [c.power, c.distanceFromTarget, c.distanceFromSE]; })), [[-1, 0.25, 0.75], [-1.5, 0.25, 0.25]]);
  assert.equal(right.recommendation, "-1.50");
  assert.equal(right.stockRule, V53.EXACT_STOCK_TIE_RULE);
  assert.equal(left.sphericalEquivalent, -2.125);
  assert.equal(left.preSnapTarget, -1.625);
  assert.equal(left.recommendation, "-1.50", "no tie: -1.50 is 0.125 D away, -2.00 is 0.375 D away");
  assert.equal(left.tieCandidates, null);
  var choice = Choice.calculatePairRecommendationChoice(right, left, { highCylinderTriggered: false });
  assert.equal(choice.available, false, "converged: no meaningless second option");
  assert.equal(choice.reason, "exact_tie_resolved");
  assert.equal(HighCyl.calculatePairAlternative(right, left).triggered, false);
});

test("#336371 regression: OD midpoint resolves -1.50; OS non-tie chooses nearer -1.50; one converged result", function () {
  var right = eye(-1, -1.5, 94);
  var left = eye(-1, -1.75, 75);
  assert.deepEqual(plain({
    rawSphere: left.original.sphere,
    rawCylinder: left.original.cylinder,
    sphericalEquivalent: left.sphericalEquivalent,
    underwaterTarget: left.preSnapTarget,
    stockCandidates: left.stockCandidates,
    tieCandidates: left.tieCandidates,
    stockRule: left.stockRule,
    recommendation: left.recommendation
  }), {
    rawSphere: -1,
    rawCylinder: -1.75,
    sphericalEquivalent: -1.875,
    underwaterTarget: -1.375,
    stockCandidates: [{ power: -1.5, distanceFromTarget: 0.125 }, { power: -1, distanceFromTarget: 0.375 }],
    tieCandidates: null,
    stockRule: null,
    recommendation: "-1.50"
  });
  assert.equal(right.sphericalEquivalent, -1.75);
  assert.equal(right.preSnapTarget, -1.25);
  assert.equal(right.recommendation, "-1.50");
  assert.equal(right.stockRule, V53.EXACT_STOCK_TIE_RULE);
  var choice = Choice.calculatePairRecommendationChoice(right, left, { highCylinderTriggered: false });
  assert.equal(HighCyl.calculatePairAlternative(right, left).triggered, false, "both eyes are below the 3.00 D high-CYL threshold");
  assert.equal(choice.available, false, "Balanced and the former Alternative converge");
});

test("non-tie ordinary results use nearest stock while protected rules remain", function () {
  // Minus, one stocked lens clearly closer: target -3.375 -> -3.50.
  assert.equal(eye(-3.75, -0.25).recommendation, "-3.50");
  assert.equal(eye(-3.75, -0.25).stockRule, null);
  assert.equal(eye(-4.125 + 0.125, -0.25).recommendation, "-3.50"); // SE -4.125, target -3.625 -> -3.50
  // Plus, one stocked lens clearly closer (target +2.125 -> +2.00).
  assert.equal(eye(3, -0.75).recommendation, "+2.00");
  // Plus exact tie keeps the stronger lens, which is the one closer to SE (target +2.50 -> +3.00).
  assert.equal(eye(3).recommendation, "+3.00");
  // Farsighted whole diopter stock and low plus guard.
  assert.equal(eye(5).recommendation, "+5.00");
  assert.equal(eye(0.75).recommendation, "+1.00");
  assert.equal(eye(0.25).recommendation, "0.00");
  assert.equal(eye(0.5).recommendation, null, "SE +0.50 stays manual review");
  // Plano and plano to first minus gap.
  assert.equal(eye(0).recommendation, "0.00");
  assert.equal(eye(-0.25).recommendation, "0.00");
  assert.equal(eye(-1.25).recommendation, "-1.00");
  assert.equal(eye(-1.25).stockRule, "plano-to-first-minus-gap");
  assert.equal(eye(-1.5).recommendation, "-1.00", "target -1.00 is exact stock");
  // Low minus choice and SE -0.50 manual review.
  assert.equal(eye(-0.75).recommendation, "-1.00");
  assert.equal(eye(-0.75).lowMinusChoice, true);
  assert.equal(eye(-0.5).recommendation, null);
  // Exact stock targets.
  assert.equal(eye(-4.5).recommendation, "-4.00");
});

test("high CYL keeps its workflow; both strategies use nearest stock and the same tie rule", function () {
  var right = eye(-2.75, -3.25, 170);
  var left = eye(-2, -3, 10);
  var preview = HighCyl.calculatePairAlternative(right, left);
  assert.equal(preview.triggered, true);
  assert.deepEqual(plain([preview.balanced.right, preview.balanced.left]), ["-4.00", "-3.00"]);
  // Left Alternative: SPH + CYL/4 = -2.75 -> target -2.25, an exact tie between
  // -2.00 and -2.50; -2.50 is closer to that reference (was -2.00 before 5.3.1).
  assert.equal(preview.eyes.left.quarterCylinderBase, -2.75);
  assert.equal(preview.eyes.left.alternativeTarget, -2.25);
  assert.deepEqual(plain([preview.alternative.right, preview.alternative.left]), ["-3.00", "-2.50"]);
});

test("mixed sign and manual review pairs never offer a choice", function () {
  assert.equal(Choice.calculatePairRecommendationChoice(eye(-3.25), eye(2.5), {}).available, false);
  assert.equal(Choice.calculatePairRecommendationChoice(eye(-0.5), eye(-1.75), {}).available, false);
});

test("full eye grid: every ordinary buildable result is nearest stock; only exact ties resolve toward SE", function () {
  var categories = { A: 0, B: 0, C: 0, D: 0 };
  for (var s = -12; s <= 8 + EPSILON; s += 0.25) {
    for (var c = -6; c <= 6 + EPSILON; c += 0.25) {
      var result = eye(Math.round(s * 100) / 100, Math.round(c * 100) / 100, 90);
      if (!result.valid || result.finalStockPower === null) { categories.C += 1; continue; }
      var target = result.preSnapTarget;
      var se = result.sphericalEquivalent;
      assert.equal(target, se < 0 ? -Math.max(Math.abs(se) - 0.5, 0) : Math.max(Math.abs(se) - 0.5, 0), "the 0.50 D adjustment is unchanged");
      var protectedRule = result.lowMinusChoice || result.stockRule === "plano-to-first-minus-gap" ||
        (Array.isArray(result.planoCrossoverCandidates) && result.planoCrossoverCandidates.length);
      if (protectedRule) { categories.C += 1; continue; }
      var stock = se < 0 ? V53.V53_CONFIG.myopiaAvailablePowers : V53.V53_CONFIG.hyperopiaAvailablePowers;
      var minDistance = Math.min.apply(Math, stock.map(function (power) { return Math.abs(power - target); }));
      var nearest = stock.filter(function (power) { return Math.abs(Math.abs(power - target) - minDistance) < EPSILON; });
      if (nearest.length > 1) {
        categories.B += 1;
        var towardSE = nearest.slice().sort(function (a, b) { return Math.abs(a - se) - Math.abs(b - se); })[0];
        assert.equal(result.finalStockPower, towardSE);
      } else if (result.finalStockPower === nearest[0]) {
        categories.A += 1;
      } else {
        categories.D += 1;
      }
    }
  }
  assert.deepEqual(categories, { A: 2981, B: 499, C: 489, D: 0 });
  assert.deepEqual(plain(V53.V53_CONFIG.myopiaAvailablePowers), [0, -1, -1.5, -2, -2.5, -3, -3.5, -4, -4.5, -5, -5.5, -6, -6.5, -7, -7.5, -8, -8.5, -9]);
  assert.deepEqual(plain(V53.V53_CONFIG.hyperopiaAvailablePowers), [0, 1, 2, 3, 4, 5]);
  assert.equal(V53.V53_CONFIG.underwaterAdjustmentD, 0.5);
});

test("resolveExactStockTie: only a genuine tie changes the choice; a double tie keeps the existing lens", function () {
  assert.deepEqual(plain(V53.resolveExactStockTie(-1, -1.5, -1.25, -1.75).power), -1.5);
  assert.deepEqual(plain(V53.resolveExactStockTie(-1, -1.5, -1.24, -1.74).power), -1, "0.01 D off the midpoint is not a tie");
  assert.deepEqual(plain(V53.resolveExactStockTie(2, 3, 2.5, 2.5).power), 2, "equally close to SE too: deterministic fallback keeps the existing choice");
  assert.deepEqual(plain(V53.resolveExactStockTie(2, 3, 2.5, 3).power), 3);
});
