"use strict";

// V5.3.8 low-plus per-eye Alternative (oo-lens-calculator-v53-midpoint.js).
//
// Balanced is unchanged and the engine is byte-for-byte 5.3.7 apart from its
// version banner. In an ordinary all-plus pair, an eye protected solely by the
// engine's low-plus guard (SE above 0 to +1.00, Balanced +1.00; reported by
// the choice layer as "plano_crossover") is frozen on its Balanced lens and no
// longer blocks the other, ordinary plus eye from offering the closer-to-SPH
// Alternative it already had. The low-plus eye never gets an Alternative of
// its own. Minus pairs, mixed-sign pairs, the quarter-CYL workflow, manual
// review, plano results and every other protection are unchanged.
// No dependencies.

var test = require("node:test");
var assert = require("node:assert/strict");
var crypto = require("node:crypto");
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

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(ASSETS, file))).digest("hex");
}

function fmt(n) { return (n > 0 ? "+" : n < 0 ? "-" : "") + Math.abs(n).toFixed(2); }

function eye(sphere, cylinder, axis) {
  var cyl = cylinder || 0;
  return V53.engine.calculateEyeRecommendationV53({ sphere: fmt(sphere), cylinder: cyl === 0 ? "0.00" : fmt(cyl), axis: cyl === 0 ? "" : String(axis || 90) }, "eye");
}

function choiceFor(right, left) {
  var preview = V53.highCyl.calculatePairAlternative(right, left);
  return V53.choice.calculatePairRecommendationChoice(right, left, {
    highCylinderTriggered: Boolean(preview && preview.triggered),
    highCylinderThreshold: V53.highCyl.QUARTER_CYL_ALTERNATIVE_THRESHOLD
  });
}

function summary(right, left) {
  var choice = choiceFor(right, left);
  return {
    balanced: right.recommendation + "/" + left.recommendation,
    kind: choice.available ? choice.alternativeStrategy : "single",
    alternative: choice.available ? choice.alternative.right + "/" + choice.alternative.left : null,
    reason: choice.reason,
    frozen: choice.lowPlusFrozenEye || null,
    reasons: choice.eyes ? [choice.eyes.right.reason, choice.eyes.left.reason] : null
  };
}

// The exact production fixture.
var OD = [2, -0.75, 88];
var OS = [1.25, -1.25, 30];

test("version 5.3.8; the engine is the 5.3.7 engine with only its banner and version changed; other modules are byte-identical", function () {
  assert.equal(V53.engine.VERSION, "5.3.8");
  assert.equal(eye(2, -0.75, 88).version, "5.3.8");
  assert.equal(sha256("oo-lens-calculator-v53-base.js"), "1ba53a8c6c8cda3c2f8f353a9d549dfb4c974010ab52a275e0b2dcf2ac0c2344");
  assert.equal(sha256("oo-lens-calculator-v53-high-cyl.js"), "e8d565362b084d1c8bbdf742f9c9db3ecce631357c432c2865014d6a59e8c02a");
  assert.equal(sha256("oo-lens-calculator-v53-products.js"), "ecb351988f4adbcb4b4b423f0056db8d62e87655e548b01ff2505730d0c5c75f");
  assert.equal(sha256("oo-lens-calculator-v53-rx.js"), "8aff5c1b3f9aa02b740b7ec92afd6209f7a99da92e41e77113389191ae171e5d");
  assert.equal(sha256("oo-lens-calculator-v53-ui.js"), "e24f3a2ac835f08a6585f2627d507573e9d2c63fe317c79d5f817234dd639d15");
  // Reverting only the 5.3.8 banner and version string restores the released
  // 5.3.7 engine (sha256 a6d1a146...), so no calculation changed.
  var engine = fs.readFileSync(path.join(ASSETS, "oo-lens-calculator-v53-engine.js"), "utf8");
  var banner = engine.indexOf(" * LOW-PLUS PER-EYE FREEZE (5.3.8");
  var versionLine = engine.indexOf(" * Version: 5.3.8");
  assert.ok(banner > 0 && versionLine > banner);
  var reverted = engine.slice(0, banner) + engine.slice(versionLine).replace(" * Version: 5.3.8", " * Version: 5.3.7").replace('version: "5.3.8",', 'version: "5.3.7",');
  assert.equal(crypto.createHash("sha256").update(reverted).digest("hex"), "a6d1a146db40149b642092877f072397f57f42008b384b9367d2840cb0c876ab");
});

test("the low-plus guard eye is reported by the choice layer as plano_crossover (an OK result with crossover candidates), Balanced +1.00", function () {
  var left = eye.apply(null, OS);
  assert.deepEqual([left.sphericalEquivalent, left.recommendation, left.stockStatus, left.manualReview], [0.625, "+1.00", "OK", false]);
  assert.ok(Array.isArray(left.planoCrossoverCandidates) && left.planoCrossoverCandidates.length === 2);
  var protectedEye = V53.choice.eyeCloserToSphPreference(left, { highCylinderThreshold: 2 });
  assert.deepEqual([protectedEye.protected, protectedEye.reason, protectedEye.alternativePower], [true, "plano_crossover", null]);
  assert.equal(V53.choice.lowPlusGuarded(protectedEye, left), true);
  // Not low-plus guarded: a plano crossover resolved to plano, a plus eye above +1.00, a minus eye.
  var plano = eye(0.25);
  assert.equal(V53.choice.lowPlusGuarded(V53.choice.eyeCloserToSphPreference(plano, { highCylinderThreshold: 2 }), plano), false);
  var ordinary = eye.apply(null, OD);
  assert.equal(V53.choice.lowPlusGuarded(V53.choice.eyeCloserToSphPreference(ordinary, { highCylinderThreshold: 2 }), ordinary), false);
  var minus = eye(-0.75);
  assert.equal(V53.choice.lowPlusGuarded(V53.choice.eyeCloserToSphPreference(minus, { highCylinderThreshold: 2 }), minus), false);
});

test("fixture OD +2.00/-0.75 x088, OS +1.25/-1.25 x030: Balanced +1.00/+1.00 Recommended; Alternative +2.00/+1.00 (left frozen on Balanced)", function () {
  var right = eye.apply(null, OD);
  var left = eye.apply(null, OS);
  assert.deepEqual([right.sphericalEquivalent, right.preSnapTarget, right.recommendation], [1.625, 1.125, "+1.00"]);
  var choice = choiceFor(right, left);
  assert.deepEqual(summary(right, left), {
    balanced: "+1.00/+1.00", kind: "closer_to_sph", alternative: "+2.00/+1.00", reason: "closer_to_sph", frozen: "left",
    reasons: ["closer_to_sph", "plano_crossover"]
  });
  assert.equal(choice.defaultStrategy, "balanced");
  assert.equal(choice.alternativeStrategy, "closer_to_sph");
  assert.equal(choice.alternativeMethod, undefined);
  assert.deepEqual([choice.eyes.right.lowPlusFrozen, choice.eyes.left.lowPlusFrozen], [false, true]);
  assert.deepEqual([choice.eyes.left.alternativePower, choice.eyes.left.balancedPower, choice.alternative.leftPower], [null, 1, 1]);
  assert.deepEqual([choice.eyes.right.alternativePower, choice.alternative.rightPower], [2, 2]);
  // Selection: Balanced by default, the Alternative only when asked.
  var selected = V53.choice.recommendationSelection(choice);
  assert.deepEqual([selected.recommendationStrategy, selected.recommendedRight, selected.recommendedLeft], ["balanced", 1, 1]);
  var alternative = V53.choice.recommendationSelection(choice, "closer_to_sph");
  assert.deepEqual([alternative.recommendationStrategy, alternative.recommendedRight, alternative.recommendedLeft, alternative.displayRight, alternative.displayLeft], ["closer_to_sph", 2, 1, "+2.00", "+1.00"]);
  // Customer copy: the shared titles and a true single-eye relation sentence.
  var entries = V53.choice.choiceEntries(choice, right, left);
  assert.deepEqual(JSON.parse(JSON.stringify(entries.map(function (entry) { return [entry.strategy, entry.title, entry.badge, entry.recommended]; }))),
    [["balanced", "Balanced", "Recommended", true], ["closer_to_sph", "Alternative", "", false]]);
  assert.equal(entries[1].copy, V53.choice.ALTERNATIVE_COPY + " The right lens is stronger than Balanced.");
  assert.deepEqual(JSON.parse(JSON.stringify(V53.choice.optionLabelsShown())), { balanced: "Balanced", closer_to_sph: "Alternative" });
});

test("mirrored fixture (low-plus eye on the RIGHT): Balanced +1.00/+1.00; Alternative +1.00/+2.00 (right frozen)", function () {
  var right = eye.apply(null, OS);
  var left = eye.apply(null, OD);
  var choice = choiceFor(right, left);
  assert.deepEqual(summary(right, left), {
    balanced: "+1.00/+1.00", kind: "closer_to_sph", alternative: "+1.00/+2.00", reason: "closer_to_sph", frozen: "right",
    reasons: ["plano_crossover", "closer_to_sph"]
  });
  assert.deepEqual([choice.eyes.right.lowPlusFrozen, choice.eyes.left.lowPlusFrozen], [true, false]);
  assert.equal(V53.choice.choiceEntries(choice, right, left)[1].copy, V53.choice.ALTERNATIVE_COPY + " The left lens is stronger than Balanced.");
});

test("both eyes low-plus: single Balanced +1.00/+1.00, gate reason unchanged", function () {
  assert.deepEqual(summary(eye(1.25, -1.25, 30), eye(1, -0.5, 30)), {
    balanced: "+1.00/+1.00", kind: "single", alternative: null, reason: "right_plano_crossover", frozen: null,
    reasons: ["plano_crossover", "plano_crossover"]
  });
  assert.equal(V53.choice.calculatePairLowPlusFrozenAlternative(
    V53.choice.calculatePairCloserToSphPreference(eye(1.25, -1.25, 30), eye(1, -0.5, 30), { highCylinderThreshold: 2 }),
    eye(1.25, -1.25, 30), eye(1, -0.5, 30), { highCylinderTriggered: false }), null);
});

test("low-plus eye + ordinary plus eye with no Alternative: single Balanced, gate reason unchanged (no duplicate Alternative)", function () {
  // +1.25 sphere: SE 1.25, start 0.75, Balanced +1.00; the printed SPH +1.25 rounds back to +1.00 (same_as_primary).
  assert.deepEqual(summary(eye(1.25, -1.25, 30), eye(1.25)), {
    balanced: "+1.00/+1.00", kind: "single", alternative: null, reason: "right_plano_crossover", frozen: null,
    reasons: ["plano_crossover", "same_as_primary"]
  });
  // +3.00 sphere: SE 3.00, start 2.50, Balanced +3.00 (stronger tie); SPH +3.00 is the primary.
  assert.deepEqual(summary(eye(1.25, -1.25, 30), eye(3)).kind, "single");
});

test("two ordinary plus eyes are unchanged: +2.00/-1.00 x115, +2.00/-0.75 x068 and +4.00/-1.75 x075, +3.00/-1.25 x110", function () {
  assert.deepEqual(summary(eye(2, -1, 115), eye(2, -0.75, 68)), {
    balanced: "+1.00/+1.00", kind: "closer_to_sph", alternative: "+2.00/+2.00", reason: "closer_to_sph", frozen: null,
    reasons: ["closer_to_sph", "closer_to_sph"]
  });
  assert.deepEqual(summary(eye(4, -1.75, 75), eye(3, -1.25, 110)), {
    balanced: "+3.00/+2.00", kind: "closer_to_sph", alternative: "+4.00/+3.00", reason: "closer_to_sph", frozen: null,
    reasons: ["closer_to_sph", "closer_to_sph"]
  });
  // Plus pair with no Alternative stays single: +2.50 / +2.25 (#336481).
  assert.deepEqual(summary(eye(2.5), eye(2.25)), {
    balanced: "+2.00/+2.00", kind: "single", alternative: null, reason: "no_alternative", frozen: null,
    reasons: ["same_as_primary", "same_as_primary"]
  });
});

test("minus regression (5.3.7 adjacent softer, byte-for-byte): fixture A, #336483, plain -2.00, exact tie, low-minus/plano", function () {
  assert.deepEqual(summary(eye(-4.5, -0.5, 157), eye(-4.5, -0.75, 170)), {
    balanced: "-4.50/-4.50", kind: "closer_to_sph", alternative: "-4.00/-4.00", reason: "closer_to_sph", frozen: null,
    reasons: ["adjacent_softer", "adjacent_softer"]
  });
  assert.deepEqual(summary(eye(-1.25, -1.5, 180), eye(-1.5, -1.75, 175)), {
    balanced: "-1.50/-2.00", kind: "closer_to_sph", alternative: "-1.50/-1.50", reason: "closer_to_sph", frozen: null,
    reasons: ["exact_start", "adjacent_softer"]
  });
  assert.deepEqual(summary(eye(-2), eye(-2)), {
    balanced: "-1.50/-1.50", kind: "single", alternative: null, reason: "no_alternative", frozen: null,
    reasons: ["exact_start", "exact_start"]
  });
  assert.deepEqual(summary(eye(-2.25), eye(-1.75)), {
    balanced: "-2.00/-1.50", kind: "closer_to_sph", alternative: "-1.50/-1.00", reason: "closer_to_sph", frozen: null,
    reasons: ["adjacent_softer", "adjacent_softer"]
  });
  // #336314: right exact tie resolves to -1.50 and softens; left is its exact start.
  assert.deepEqual(summary(eye(-2, 0.5, 144), eye(-2.5, 0.75, 156)).alternative, "-1.00/-1.50");
  // Low-minus / plano protections: 0.00 / -1.00 stays single.
  var lowMinus = summary(eye(-0.25, -0.5, 65), eye(-0.5, -0.25, 50));
  assert.deepEqual([lowMinus.balanced, lowMinus.kind, lowMinus.frozen], ["0.00/-1.00", "single", null]);
  var choice = choiceFor(eye(-0.25, -0.5, 65), eye(-0.5, -0.25, 50));
  assert.equal(choice.available, false);
  assert.ok(/plano|low_minus/.test(choice.reason), choice.reason);
});

test("high-CYL, mixed-sign, plano and manual-review pairs never relax, even with a low-plus eye", function () {
  // Quarter-CYL workflow (|CYL| >= 2.00): the ordinary choice is suppressed.
  assert.deepEqual(summary(eye(1.25, -1.25, 30), eye(3, -2, 90)).reason, "high_cylinder_workflow");
  var preview = V53.highCyl.calculatePairAlternative(eye(1.25, -1.25, 30), eye(3, -2, 90));
  assert.equal(preview.triggered, true);
  // #336246 (CYL 2.00) keeps the quarter-CYL Alternative -3.50/-5.50.
  var p246 = V53.highCyl.calculatePairAlternative(eye(-3.5, -2, 10), eye(-5, -1.5, 175));
  assert.deepEqual([p246.triggered, p246.available, p246.balanced.right, p246.balanced.left, p246.alternative.right, p246.alternative.left], [true, true, "-4.00", "-5.50", "-3.50", "-5.50"]);
  // Mixed sign with a low-plus eye: unavailable with the unchanged gate reason.
  assert.deepEqual(summary(eye(1.25, -1.25, 30), eye(-3, -0.5, 90)), {
    balanced: "+1.00/-3.00", kind: "single", alternative: null, reason: "right_plano_crossover", frozen: null,
    reasons: ["plano_crossover", "same_as_primary"]
  });
  // A plano eye (SE +0.25 resolves to 0.00) never relaxes: the pair is not all-plus.
  assert.deepEqual(summary(eye(0.25), eye.apply(null, OD)), {
    balanced: "0.00/+1.00", kind: "single", alternative: null, reason: "right_plano_crossover", frozen: null,
    reasons: ["plano_crossover", "closer_to_sph"]
  });
  // Manual review on the other eye blocks the pair as before.
  var review = null;
  for (var s = 1; s <= 8 && !review; s += 0.25) {
    for (var c = 0; c >= -1.75 && !review; c -= 0.25) {
      var candidate = eye(s, c, 90);
      if (candidate.valid && candidate.manualReview === true) review = candidate;
    }
  }
  if (review) {
    var withReview = choiceFor(review, eye.apply(null, OS));
    assert.equal(withReview.available, false);
    assert.equal(withReview.reason, "right_manual_review");
  }
});

test("the frozen pair is only offered when it can be built: a mixed-sign construction is rejected", function () {
  var right = eye.apply(null, OD);
  var left = eye.apply(null, OS);
  var closer = V53.choice.calculatePairCloserToSphPreference(right, left, { highCylinderThreshold: 2 });
  assert.equal(closer.available, false);
  assert.equal(closer.reason, "left_plano_crossover");
  var frozen = V53.choice.calculatePairLowPlusFrozenAlternative(closer, right, left, { highCylinderTriggered: false });
  assert.deepEqual([frozen.available, frozen.closerToSph.right, frozen.closerToSph.left, frozen.lowPlusFrozenEye], [true, "+2.00", "+1.00", "left"]);
  assert.equal(V53.engine.pairBuildableOnAnyCurrentMask(2, 1), true);
  // High-CYL workflow flag, an available closer result, or a non-low-plus gate reason: never relaxes.
  assert.equal(V53.choice.calculatePairLowPlusFrozenAlternative(closer, right, left, { highCylinderTriggered: true }), null);
  assert.equal(V53.choice.calculatePairLowPlusFrozenAlternative(Object.assign({}, closer, { available: true }), right, left, {}), null);
  assert.equal(V53.choice.calculatePairLowPlusFrozenAlternative(Object.assign({}, closer, { reason: "left_manual_review" }), right, left, {}), null);
  // A fabricated minus Alternative on the ordinary eye is not buildable with a plus frozen eye.
  var unbuildable = JSON.parse(JSON.stringify(closer));
  unbuildable.eyes.right.alternativePower = -1;
  assert.equal(V53.choice.calculatePairLowPlusFrozenAlternative(unbuildable, right, left, {}), null);
});

test("grid: every relaxed pair is an all-plus pair with one low-plus eye frozen on Balanced and the other eye's existing Alternative; nothing else relaxes", function () {
  var eyes = [];
  for (var s = -10; s <= 8 + EPSILON; s += 0.5) {
    for (var c = -6; c <= 6 + EPSILON; c += 0.5) {
      var result = eye(Math.round(s * 100) / 100, Math.round(c * 100) / 100, 90);
      if (result.valid) eyes.push(result);
    }
  }
  var relaxed = 0;
  var expected = 0;
  eyes.forEach(function (right) {
    eyes.forEach(function (left) {
      var preview = V53.highCyl.calculatePairAlternative(right, left);
      var options = { highCylinderTriggered: Boolean(preview && preview.triggered), highCylinderThreshold: 2 };
      var choice = V53.choice.calculatePairRecommendationChoice(right, left, options);
      var closer = V53.choice.calculatePairCloserToSphPreference(right, left, options);
      var rightEye = closer.eyes.right;
      var leftEye = closer.eyes.left;
      var guarded = [V53.choice.lowPlusGuarded(rightEye, right), V53.choice.lowPlusGuarded(leftEye, left)];
      var allPlus = Number(right.finalStockPower) > EPSILON && Number(left.finalStockPower) > EPSILON;
      var shouldRelax = !options.highCylinderTriggered && allPlus && guarded[0] !== guarded[1] &&
        !(guarded[0] ? leftEye : rightEye).protected && (guarded[0] ? leftEye : rightEye).alternativePower !== null &&
        right.stockRule !== "exact-stock-tie-closer-to-se" && left.stockRule !== "exact-stock-tie-closer-to-se";
      if (shouldRelax) expected += 1;
      if (!choice.lowPlusFrozenEye) {
        assert.equal(shouldRelax, false, "a pair that qualifies is relaxed: " + right.recommendation + "/" + left.recommendation);
        return;
      }
      relaxed += 1;
      var frozenSide = choice.lowPlusFrozenEye;
      var frozenResult = frozenSide === "right" ? right : left;
      var other = frozenSide === "right" ? "left" : "right";
      var otherResult = frozenSide === "right" ? left : right;
      assert.equal(shouldRelax, true);
      assert.equal(options.highCylinderTriggered, false, "never in the quarter-CYL workflow");
      assert.ok(allPlus, "all-plus pair only");
      assert.ok(Math.abs(Number(right.cylinderMagnitude)) < 2 - EPSILON && Math.abs(Number(left.cylinderMagnitude)) < 2 - EPSILON);
      assert.equal(choice.alternativeStrategy, "closer_to_sph");
      assert.equal(choice.alternativeMethod, undefined);
      // 1. the frozen eye is protected solely by the low-plus guard
      assert.ok(V53.choice.lowPlusGuarded(choice.eyes[frozenSide], frozenResult));
      assert.deepEqual([frozenResult.stockStatus, frozenResult.manualReview], ["OK", false]);
      assert.ok(frozenResult.sphericalEquivalent > EPSILON && frozenResult.sphericalEquivalent <= 1 + EPSILON);
      // 2. it stays exactly on its Balanced lens
      assert.ok(Math.abs(choice.alternative[frozenSide + "Power"] - Number(frozenResult.finalStockPower)) < EPSILON);
      assert.ok(Math.abs(choice.balanced[frozenSide + "Power"] - Number(frozenResult.finalStockPower)) < EPSILON);
      // 3. the other eye offers its existing ordinary closer-to-SPH Alternative
      var existing = V53.choice.eyeCloserToSphPreference(otherResult, { highCylinderThreshold: 2 });
      assert.deepEqual([existing.protected, existing.reason], [false, "closer_to_sph"]);
      assert.ok(Math.abs(existing.alternativePower - choice.alternative[other + "Power"]) < EPSILON);
      // 4. the pair is valid and buildable (all plus)
      assert.ok(choice.alternative.rightPower > EPSILON && choice.alternative.leftPower > EPSILON);
      assert.ok(V53.engine.pairBuildableOnAnyCurrentMask(choice.alternative.rightPower, choice.alternative.leftPower));
      // 5. without the freeze the unchanged gate blocked the pair on that eye
      assert.equal(closer.available, false);
      assert.ok(closer.reason === frozenSide + "_plano_crossover" || closer.reason === frozenSide + "_low_plus", closer.reason);
      // Balanced is untouched.
      assert.deepEqual([choice.balanced.right, choice.balanced.left], [right.recommendation, left.recommendation]);
    });
  });
  assert.ok(relaxed > 0);
  assert.equal(relaxed, expected);
});
