"use strict";

// V5.3.7 ordinary minus Alternative (oo-lens-calculator-v53-midpoint.js).
//
// Balanced is unchanged. For an all-minus pair with |CYL| < 2.00 whose eyes are
// not in a protected pathway, an eye whose Balanced lens is stronger than its
// underwater adjusted starting point moves to the immediately adjacent stocked
// minus lens toward zero; an eye on its starting point, already softer, or
// whose step would enter plano keeps Balanced. Exact stock ties are included.
// If neither eye changes the result is single. Plus pairs, CYL >= 2.00 (the
// quarter-CYL workflow) and every protected pathway keep the 5.3.6 behaviour
// byte for byte. The strategy id stays closer_to_sph; the non-persisted
// alternativeMethod is "adjacent_softer". No dependencies.

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var vm = require("node:vm");

var ASSETS = path.join(__dirname, "base", "assets");
var EPSILON = 1e-6;

function loadModules() {
  var sandbox = {};
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  ["base", "engine", "high-cyl", "midpoint"].forEach(function (name) {
    vm.runInContext(fs.readFileSync(path.join(ASSETS, "oo-lens-calculator-v53-" + name + ".js"), "utf8"), sandbox);
  });
  return { engine: sandbox.OOLensCalculatorV53, highCyl: sandbox.OOV52HighCylinder, choice: sandbox.OOV53RecommendationChoice };
}

var V53 = loadModules();
var MINUS = V53.engine.V53_CONFIG.myopiaAvailablePowers;

function fmt(n) { return (n > 0 ? "+" : n < 0 ? "-" : "") + Math.abs(n).toFixed(2); }
function plain(value) { return JSON.parse(JSON.stringify(value)); }

function eye(sphere, cylinder, axis) {
  var cyl = cylinder || 0;
  return V53.engine.calculateEyeRecommendationV53({ sphere: fmt(sphere), cylinder: cyl === 0 ? "0.00" : fmt(cyl), axis: cyl === 0 ? "" : String(axis || 90) }, "eye");
}

function choiceFor(right, left) {
  var preview = V53.highCyl.calculatePairAlternative(right, left);
  return V53.choice.calculatePairRecommendationChoice(right, left, {
    highCylinderTriggered: Boolean(preview && preview.triggered),
    highCylinderThreshold: V53.highCyl.HIGH_CYL_THRESHOLD
  });
}

function summary(right, left) {
  var choice = choiceFor(right, left);
  return {
    balanced: right.recommendation + "/" + left.recommendation,
    kind: choice.available ? choice.alternativeStrategy : "single",
    method: choice.alternativeMethod || null,
    alternative: choice.available ? choice.alternative.right + "/" + choice.alternative.left : null,
    reasons: choice.eyes ? [choice.eyes.right.reason, choice.eyes.left.reason] : null
  };
}

test("version 5.3.7 with the new method id exported; strategy ids unchanged", function () {
  assert.equal(V53.engine.VERSION, "5.3.7");
  assert.equal(V53.choice.ALTERNATIVE_METHOD_ADJACENT_SOFTER, "adjacent_softer");
  assert.equal(V53.choice.STRATEGY_CLOSER_TO_SPH, "closer_to_sph");
  assert.equal(V53.choice.STRATEGY_BALANCED, "balanced");
});

test("fixture A: R -4.50/-0.50 x157, L -4.50/-0.75 x170 -> Balanced -4.50/-4.50, Alternative -4.00/-4.00", function () {
  var right = eye(-4.5, -0.5, 157);
  var left = eye(-4.5, -0.75, 170);
  assert.deepEqual([right.sphericalEquivalent, right.preSnapTarget, left.sphericalEquivalent, left.preSnapTarget], [-4.75, -4.25, -4.875, -4.375]);
  assert.deepEqual(summary(right, left), { balanced: "-4.50/-4.50", kind: "closer_to_sph", method: "adjacent_softer", alternative: "-4.00/-4.00", reasons: ["adjacent_softer", "adjacent_softer"] });
  var choice = choiceFor(right, left);
  assert.equal(choice.defaultStrategy, "balanced");
  assert.equal(choice.sharperStrictlyCloser, false);
  assert.deepEqual(plain(choice.closerToSph), plain(choice.alternative));
  var selected = V53.choice.recommendationSelection(choice, "closer_to_sph");
  assert.deepEqual([selected.recommendationStrategy, selected.recommendedRight, selected.recommendedLeft], ["closer_to_sph", -4, -4]);
  assert.equal(V53.choice.recommendationSelection(choice).recommendationStrategy, "balanced", "Balanced stays the default");
});

test("fixture B: #336483 -> Balanced -1.50/-2.00, Alternative -1.50/-1.50", function () {
  var right = eye(-1.25, -1.5, 180);
  var left = eye(-1.5, -1.75, 175);
  // OD SE -2.00, start -1.50 = Balanced (exact start); OS SE -2.375, start -1.875 < Balanced -2.00.
  assert.deepEqual(summary(right, left), { balanced: "-1.50/-2.00", kind: "closer_to_sph", method: "adjacent_softer", alternative: "-1.50/-1.50", reasons: ["exact_start", "adjacent_softer"] });
});

test("fixture C: plain -2.00 is single (start -1.50 is exactly Balanced)", function () {
  assert.deepEqual(summary(eye(-2), eye(-2)), { balanced: "-1.50/-1.50", kind: "single", method: "adjacent_softer", alternative: null, reasons: ["exact_start", "exact_start"] });
  assert.equal(choiceFor(eye(-2), eye(-2)).reason, "no_alternative");
});

// Frozen V5.3.6 choice objects, captured from the released 5.3.6 assets
// (midpoint sha256 4ea944c0...). Plus and high-CYL pairs must be identical.
var FROZEN_536 = {
  "336481": { rx: [[2.5], [2.25]], choice: { available: false, reason: "no_alternative", eyes: { right: { balancedPower: 2, alternativePower: null, protected: false, reason: "same_as_primary", sphere: 2.5 }, left: { balancedPower: 2, alternativePower: null, protected: false, reason: "same_as_primary", sphere: 2.25 } } } },
  "336437": { rx: [[2, -1, 115], [2, -0.75, 68]], choice: { available: true, reason: "closer_to_sph", alternativeStrategy: "closer_to_sph", defaultStrategy: "balanced", sharperStrictlyCloser: false, eyes: { right: { balancedPower: 1, alternativePower: 2, protected: false, reason: "closer_to_sph", sphere: 2, stockSteps: 1 }, left: { balancedPower: 1, alternativePower: 2, protected: false, reason: "closer_to_sph", sphere: 2, stockSteps: 1 } }, balanced: { rightPower: 1, leftPower: 1, right: "+1.00", left: "+1.00" }, alternative: { rightPower: 2, leftPower: 2, right: "+2.00", left: "+2.00" }, closerToSph: { rightPower: 2, leftPower: 2, right: "+2.00", left: "+2.00" } } },
  "336284": { rx: [[3, -0.5, 110], [3.25, -0.75, 70]], choice: { available: true, reason: "closer_to_sph", alternativeStrategy: "closer_to_sph", defaultStrategy: "balanced", sharperStrictlyCloser: false, eyes: { right: { balancedPower: 2, alternativePower: 3, protected: false, reason: "closer_to_sph", sphere: 3, stockSteps: 1 }, left: { balancedPower: 2, alternativePower: 3, protected: false, reason: "closer_to_sph", sphere: 3.25, stockSteps: 1 } }, balanced: { rightPower: 2, leftPower: 2, right: "+2.00", left: "+2.00" }, alternative: { rightPower: 3, leftPower: 3, right: "+3.00", left: "+3.00" }, closerToSph: { rightPower: 3, leftPower: 3, right: "+3.00", left: "+3.00" } } },
  "336195": { rx: [[3, -0.75, 113], [2.5, -0.5, 76]], choice: { available: true, reason: "closer_to_sph", alternativeStrategy: "closer_to_sph", defaultStrategy: "balanced", sharperStrictlyCloser: false, eyes: { right: { balancedPower: 2, alternativePower: 3, protected: false, reason: "closer_to_sph", sphere: 3, stockSteps: 1 }, left: { balancedPower: 2, alternativePower: null, protected: false, reason: "same_as_primary", sphere: 2.5 } }, balanced: { rightPower: 2, leftPower: 2, right: "+2.00", left: "+2.00" }, alternative: { rightPower: 3, leftPower: 2, right: "+3.00", left: "+2.00" }, closerToSph: { rightPower: 3, leftPower: 2, right: "+3.00", left: "+2.00" } } },
  "336496": { rx: [[-3.25, -2.25, 145], [-2.25, -0.75, 116]], choice: { available: false, reason: "high_cylinder_workflow", eyes: { right: { balancedPower: -4, alternativePower: null, protected: true, reason: "high_cylinder" }, left: { balancedPower: -2, alternativePower: null, protected: false, reason: "same_as_primary", sphere: -2.25 } } } }
};

Object.keys(FROZEN_536).forEach(function (order) {
  test("fixture D/E: #" + order + " choice object is identical to frozen V5.3.6", function () {
    var fixture = FROZEN_536[order];
    var right = eye.apply(null, fixture.rx[0]);
    var left = eye.apply(null, fixture.rx[1]);
    assert.deepEqual(plain(choiceFor(right, left)), fixture.choice);
  });
});

test("fixture E: #336496 keeps the quarter-CYL workflow -4.00/-2.00 -> -3.50/-2.00", function () {
  var right = eye(-3.25, -2.25, 145);
  var left = eye(-2.25, -0.75, 116);
  var preview = V53.highCyl.calculatePairAlternative(right, left);
  assert.equal(preview.triggered, true);
  assert.deepEqual(plain([preview.balanced.right, preview.balanced.left, preview.alternative.right, preview.alternative.left]), ["-4.00", "-2.00", "-3.50", "-2.00"]);
  assert.equal(choiceFor(right, left).alternativeMethod, undefined, "the high-CYL path never carries the minus method tag");
});

test("exact ties are included: no exact_tie_resolved convergence for minus pairs", function () {
  // -3.25 / -2.75: targets -2.75 / -2.25 are exact ties resolved toward SE (-3.00 / -2.50).
  var right = eye(-3.25);
  var left = eye(-2.75);
  assert.deepEqual([right.stockRule, left.stockRule], ["exact-stock-tie-closer-to-se", "exact-stock-tie-closer-to-se"]);
  var choice = choiceFor(right, left);
  assert.deepEqual(summary(right, left).alternative, "-2.50/-2.00");
  assert.deepEqual([choice.eyes.right.exactTie, choice.eyes.left.exactTie], [true, true]);
  assert.notEqual(choice.reason, "exact_tie_resolved");
});

test("per-eye rules: exact start and already softer keep Balanced; a plano step keeps Balanced while the other eye may change", function () {
  assert.equal(V53.choice.eyeAdjacentSofter(eye(-3)).reason, "exact_start");
  assert.equal(V53.choice.eyeAdjacentSofter(eye(-3.75, -0.75)).reason, "already_softer");
  var gap = V53.choice.eyeAdjacentSofter(eye(-1.25));
  assert.deepEqual([gap.reason, gap.alternativePower], ["would_enter_plano", null]);
  assert.deepEqual(summary(eye(-1.25), eye(-1.75)), { balanced: "-1.00/-1.50", kind: "closer_to_sph", method: "adjacent_softer", alternative: "-1.00/-1.00", reasons: ["would_enter_plano", "adjacent_softer"] });
  assert.equal(summary(eye(-1.25), eye(-1.25)).kind, "single", "neither eye changes: single");
  var step = V53.choice.eyeAdjacentSofter(eye(-7, -0.75, 15));
  assert.deepEqual([step.reason, step.balancedPower, step.alternativePower], ["adjacent_softer", -7, -6.5]);
});

test("the step uses actual stock: the next stocked lens toward zero, never an unstocked value", function () {
  var options = { myopiaPowers: [-1, -2, -3.5, -5] };
  var synthetic = { valid: true, manualReview: false, stockStatus: "OK", recommendation: "-3.50", cylinderMagnitude: 0, finalStockPower: -3.5, preSnapTarget: -3, sphericalEquivalent: -3.5, original: { sphere: -3.5 } };
  var result = V53.choice.eyeAdjacentSofter(synthetic, options);
  assert.deepEqual([result.reason, result.alternativePower], ["adjacent_softer", -2]);
});

test("protected pathways keep 5.3.6: CYL >= 2.00, low minus, plano, manual review and mixed sign carry no minus method", function () {
  [[eye(-3, -2, 90), eye(-3, -0.5, 90)], [eye(-0.75), eye(-3.25)], [eye(0), eye(-3.25)], [eye(-0.25, -0.5), eye(-3.25)], [eye(-3.25), eye(2.5)]].forEach(function (pair) {
    var choice = choiceFor(pair[0], pair[1]);
    assert.equal(choice.alternativeMethod, undefined, JSON.stringify([pair[0].recommendation, pair[1].recommendation]));
  });
  assert.equal(choiceFor(eye(-0.75), eye(-3.25)).available, false);
});

test("plus pairs never use the minus method", function () {
  for (var s = 0.25; s <= 6 + EPSILON; s += 0.25) {
    for (var c = -1.75; c <= 0 + EPSILON; c += 0.25) {
      var r = eye(Math.round(s * 100) / 100, Math.round(c * 100) / 100, 90);
      if (!r.valid || !(r.finalStockPower > 0)) continue;
      assert.equal(choiceFor(r, r).alternativeMethod, undefined);
    }
  }
});

// ------------------------------------------------------------------ grid --

function minusIndex(power) {
  var corrective = MINUS.filter(function (p) { return p < -EPSILON; }).sort(function (a, b) { return b - a; });
  return { list: corrective, index: corrective.findIndex(function (p) { return Math.abs(p - power) < EPSILON; }) };
}

test("ordinary minus grid: each eye is Balanced or exactly one stocked step softer, only when stronger than its start", function () {
  var eyes = [];
  for (var s = -10; s <= 0 + EPSILON; s += 0.25) {
    for (var c = -1.75; c <= 0 + EPSILON; c += 0.25) {
      var r = eye(Math.round(s * 100) / 100, Math.round(c * 100) / 100, 90);
      if (r.valid && r.finalStockPower < 0) eyes.push(r);
    }
  }
  var stats = { pairs: 0, two: 0, single: 0 };
  eyes.forEach(function (right) {
    eyes.forEach(function (left) {
      stats.pairs += 1;
      var choice = choiceFor(right, left);
      [["right", right], ["left", left]].forEach(function (entry) {
        var result = entry[1];
        var verdict = V53.choice.eyeAdjacentSofter(result);
        if (verdict.protected) return;
        var stronger = Math.abs(result.finalStockPower) > Math.abs(result.preSnapTarget) + EPSILON;
        var position = minusIndex(result.finalStockPower);
        if (verdict.alternativePower === null) {
          assert.ok(!stronger || position.index === 0, "keeps Balanced only when not stronger or at the first minus lens");
        } else {
          assert.ok(stronger);
          assert.equal(verdict.alternativePower, position.list[position.index - 1], "the adjacent stocked lens toward zero");
          assert.ok(verdict.alternativePower < 0, "never plano");
        }
        if (choice.available) {
          var shown = choice.alternative[entry[0] + "Power"];
          assert.equal(shown, verdict.alternativePower !== null ? verdict.alternativePower : result.finalStockPower);
          assert.ok(Math.abs(shown) <= Math.abs(result.finalStockPower) + EPSILON, "never stronger than Balanced");
        }
      });
      if (choice.available) {
        stats.two += 1;
        assert.equal(choice.alternativeMethod, "adjacent_softer");
        assert.equal(choice.alternativeStrategy, "closer_to_sph");
        assert.ok(choice.alternative.right !== choice.balanced.right || choice.alternative.left !== choice.balanced.left, "never a duplicate of Balanced");
      } else {
        stats.single += 1;
      }
    });
  });
  assert.ok(stats.two > 0 && stats.single > 0);
});

// The adjacent-softer method depends only on SE, the starting point and the
// Balanced lens, so a minus pair is notation invariant. (Paths kept from 5.3.6,
// such as the printed-SPH diagnostics of a mixed or plus pair, are unchanged.)
test("notation invariance: plus-cylinder and minus-cylinder forms give the same minus choice", function () {
  var checked = 0;
  for (var s = -8; s <= 4 + EPSILON; s += 0.25) {
    for (var c = -1.75; c <= -0.25 + EPSILON; c += 0.25) {
      var sphere = Math.round(s * 100) / 100;
      var cyl = Math.round(c * 100) / 100;
      var minusForm = eye(sphere, cyl, 30);
      var plusForm = eye(Math.round((sphere + cyl) * 100) / 100, -cyl, 120);
      if (!minusForm.valid || !plusForm.valid || !(minusForm.finalStockPower < 0)) continue;
      [eye(-4.5, -0.75, 170), eye(-2.25), eye(-1.75), eye(-7.75, -1.25, 166)].forEach(function (other) {
        assert.deepEqual(plain(choiceFor(plusForm, other)), plain(choiceFor(minusForm, other)), sphere + "/" + cyl);
      });
      checked += 1;
    }
  }
  assert.ok(checked > 150);
});

test("the module is product agnostic: product stock is applied downstream, only the any-current-mask build check applies here", function () {
  var source = fs.readFileSync(path.join(ASSETS, "oo-lens-calculator-v53-midpoint.js"), "utf8");
  assert.doesNotMatch(source, /lumix|obsidian|titan/i);
  assert.match(source, /pairBuildableOnAnyCurrentMask\(altRight, altLeft\)/);
});
