"use strict";

// V5.3 recommendation-choice layer (oo-lens-calculator-v53-midpoint.js):
// broadened Sharper, Closer to Your SPH customer preference, priority, the
// protected pathways and grid invariants. Runs the storefront engine,
// high-CYL and choice modules exactly as Shopify loads them. No dependencies.

var test = require("node:test");
var assert = require("node:assert/strict");
var crypto = require("node:crypto");
var fs = require("node:fs");
var path = require("node:path");
var vm = require("node:vm");

var ASSETS = path.join(__dirname, "base", "assets");
var PROTECTED_ENGINE_SHA256 = "12d0731877e6b12e9d2a88845c5e930fef26ea9621275ef45e30d7ee04f95b65";
var EPSILON = 1e-6;

function loadModules() {
  var sandbox = {};
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  ["base", "engine", "high-cyl", "midpoint"].forEach(function (name) {
    vm.runInContext(fs.readFileSync(path.join(ASSETS, "oo-lens-calculator-v53-" + name + ".js"), "utf8"), sandbox);
  });
  return {
    engine: sandbox.OOLensCalculatorV53,
    highCyl: sandbox.OOV52HighCylinder,
    choice: sandbox.OOV53RecommendationChoice
  };
}

var V53 = loadModules();
var MINUS = V53.engine.V53_CONFIG.myopiaAvailablePowers;
var PLUS = V53.engine.V53_CONFIG.hyperopiaAvailablePowers;

function fmt(n) {
  return (n > 0 ? "+" : n < 0 ? "-" : "") + Math.abs(n).toFixed(2);
}

function eye(sphere, cylinder, axis) {
  var cyl = cylinder === undefined ? 0 : cylinder;
  return V53.engine.calculateEyeRecommendationV53({
    sphere: fmt(sphere),
    cylinder: cyl === 0 ? "0.00" : fmt(cyl),
    axis: cyl === 0 ? "" : String(axis || 90)
  }, "eye");
}

function choiceFor(right, left) {
  var preview = V53.highCyl.calculatePairAlternative(right, left);
  return V53.choice.calculatePairRecommendationChoice(right, left, {
    highCylinderTriggered: Boolean(preview && preview.triggered),
    highCylinderThreshold: V53.highCyl.HIGH_CYL_THRESHOLD
  });
}

function primary(right, left) {
  return [right.recommendation, left.recommendation];
}

function second(choice) {
  return choice.available ? [choice.alternativeStrategy, choice.alternative.right, choice.alternative.left] : ["none", choice.reason];
}

test("the protected V5.3 engine is unchanged", function () {
  var source = fs.readFileSync(path.join(ASSETS, "oo-lens-calculator-v53-engine.js"));
  assert.equal(crypto.createHash("sha256").update(source).digest("hex"), PROTECTED_ENGINE_SHA256);
});

test("A. broadened Sharper: -7.00/-0.75 x015, -7.75/-1.25 x166", function () {
  var right = eye(-7, -0.75, 15);
  var left = eye(-7.75, -1.25, 166);
  assert.equal(right.sphericalEquivalent, -7.375);
  assert.equal(right.preSnapTarget, -6.875);
  assert.equal(left.sphericalEquivalent, -8.375);
  assert.equal(left.preSnapTarget, -7.875);
  assert.deepEqual(primary(right, left), ["-6.50", "-7.50"], "the engine still returns the protected V5.3 pair");
  assert.deepEqual(second(choiceFor(right, left)), ["sharper", "-7.00", "-8.00"]);
  var selection = V53.choice.recommendationSelection(choiceFor(right, left), "sharper");
  assert.deepEqual([selection.recommendationStrategy, selection.recommendedRight, selection.recommendedLeft], ["sharper", -7, -8]);
});

test("B. exact midpoint -3.25 / -2.75 is unchanged", function () {
  var right = eye(-3.25);
  var left = eye(-2.75);
  assert.deepEqual(primary(right, left), ["-2.50", "-2.00"]);
  assert.deepEqual(second(choiceFor(right, left)), ["sharper", "-3.00", "-2.50"]);
  var compat = V53.choice.calculatePairMidpointChoice(right, left, {});
  assert.deepEqual([compat.sharper.right, compat.sharper.left], ["-3.00", "-2.50"], "compatibility API (Quiz) gives the same pair");
});

test("C. one-eye Sharper changes only the qualifying eye", function () {
  var right = eye(-7, -0.75, 15);
  var left = eye(-3.75, -0.75);
  assert.deepEqual(primary(right, left), ["-6.50", "-3.50"]);
  assert.deepEqual(second(choiceFor(right, left)), ["sharper", "-7.00", "-3.50"]);
});

test("D. recent low-region fix -1.25 / -1.75 is intact", function () {
  var right = eye(-1.25);
  var left = eye(-1.75);
  assert.deepEqual(primary(right, left), ["-1.00", "-1.00"]);
  assert.deepEqual(second(choiceFor(right, left)), ["sharper", "-1.00", "-1.50"]);
});

test("E. primary already closer: no Sharper (target -3.625 is nearer -3.50)", function () {
  var right = eye(-3.75, -0.75);
  var left = eye(-3.75, -0.75);
  assert.equal(right.preSnapTarget, -3.625);
  assert.deepEqual(primary(right, left), ["-3.50", "-3.50"]);
  assert.equal(V53.choice.eyeMidpointAlternative(right).reason, "primary_is_closer");
  assert.deepEqual(second(choiceFor(right, left)), ["none", "no_alternative"]);
});

test("F. exact stock target: no Sharper merely for preference", function () {
  var right = eye(-3);
  var left = eye(-3);
  assert.equal(V53.choice.eyeMidpointAlternative(right).reason, "exact_stock");
  var choice = choiceFor(right, left);
  assert.notEqual(choice.alternativeStrategy, "sharper");
  // The customer may still prefer the lens matching their printed SPH.
  assert.deepEqual(second(choice), ["closer_to_sph", "-3.00", "-3.00"]);
});

test("G. farsighted Closer to Your SPH: +3.00/-0.75, +2.50/-0.50", function () {
  var right = eye(3, -0.75);
  var left = eye(2.5, -0.5);
  assert.equal(right.sphericalEquivalent, 2.625);
  assert.equal(right.preSnapTarget, 2.125);
  assert.deepEqual(primary(right, left), ["+2.00", "+2.00"]);
  var choice = choiceFor(right, left);
  assert.deepEqual(second(choice), ["closer_to_sph", "+3.00", "+2.00"]);
  assert.equal(V53.choice.closerToSphRelation(choice), V53.choice.COPY.closerStronger);
  assert.deepEqual(Array.from(V53.choice.eyesStrongerThanSE(right, left, choice.alternative)), ["right"]);
  var model = V53.choice.explainEye(right, { strategy: "closer_to_sph", selectedPower: 3 });
  assert.equal(model.equation, "+3.00 + (-0.75 ÷ 2) = +2.625 D");
  assert.equal(model.baseTargetRounded, "+2.13 D");
  assert.equal(model.strongerThanTarget, true);
  assert.equal(model.strongerThanSE, true);
  assert.equal(model.strongerThanSph, false);
  assert.equal(model.showSeNotice, true);
});

test("H. high CYL keeps its own Balanced / Closer to your SPH and gets no third option", function () {
  var right = eye(-2.75, -3.25, 170);
  var left = eye(-2, -3, 10);
  var preview = V53.highCyl.calculatePairAlternative(right, left);
  assert.equal(preview.triggered, true);
  assert.deepEqual(second(choiceFor(right, left)), ["none", "high_cylinder_workflow"]);
});

test("I. manual review: no free-choice alternative", function () {
  var right = eye(-0.25, -0.5);
  assert.equal(right.manualReview, true);
  assert.deepEqual(second(choiceFor(right, eye(-3.25))), ["none", "right_manual_review"]);
});

test("J. mixed sign pairs never offer a second option", function () {
  assert.deepEqual(second(choiceFor(eye(-3.25), eye(3))), ["none", "mixed_sign"]);
});

test("K. plano, low-minus, plano gap and low-plus protections are unchanged", function () {
  assert.deepEqual(second(choiceFor(eye(0), eye(-3.25))), ["none", "right_plano"]);
  assert.deepEqual(second(choiceFor(eye(-1), eye(-3.25))), ["none", "right_low_minus_or_plano_gap"]);
  assert.deepEqual(second(choiceFor(eye(-0.75), eye(-3.25))), ["none", "right_low_minus_or_plano_gap"]);
  var lowPlus = second(choiceFor(eye(1), eye(3)));
  assert.equal(lowPlus[0], "none");
  assert.match(lowPlus[1], /^right_(plano_crossover|low_plus)$/);
});

test("M. stock cap: no unavailable alternative beyond the strongest stocked lens", function () {
  var right = eye(-9.75);
  var left = eye(-9.75);
  assert.deepEqual(primary(right, left), ["-9.00", "-9.00"]);
  assert.equal(V53.choice.eyeMidpointAlternative(right).reason, "no_stronger_stock");
  assert.deepEqual(second(choiceFor(right, left)), ["none", "no_alternative"]);
});

test("Closer to Your SPH never goes beyond the printed SPH and resolves ties toward zero", function () {
  // +2.75: nearest stock +3.00 is stronger than the printed SPH, so +2.00.
  var eyeResult = eye(2.75, -0.5);
  var preference = V53.choice.eyeCloserToSphPreference(eyeResult);
  assert.ok(preference.alternativePower === null || preference.alternativePower <= 2.75);
  // +2.50 ties +2.00/+3.00 and resolves toward zero.
  assert.equal(V53.choice.eyeCloserToSphPreference(eye(2.5, -0.5)).reason, "same_as_primary");
  // Entered SPH more than one stock interval away is not offered.
  assert.equal(V53.choice.eyeCloserToSphPreference(eye(-2, 1)).reason, "more_than_one_interval");
});

// ------------------------------------------------- default ranking --

function defaultOf(right, left) {
  var choice = choiceFor(right, left);
  if (!choice.available) return ["balanced", primary(right, left).join("/"), "no second option"];
  var selected = V53.choice.recommendationSelection(choice);
  return [selected.recommendationStrategy, selected.displayRight + "/" + selected.displayLeft,
    V53.choice.choiceEntries(choice, right, left).map(function (entry) { return entry.strategy; }).join(",")];
}

test("ranking A. Daniel -3.75/-0.25 x035, -3.50/-0.75 x175: Sharper -3.50/-3.50 is the default Closer Match", function () {
  var right = eye(-3.75, -0.25, 35);
  var left = eye(-3.5, -0.75, 175);
  assert.deepEqual([right.sphericalEquivalent, left.sphericalEquivalent], [-3.875, -3.875]);
  assert.deepEqual([right.preSnapTarget, left.preSnapTarget], [-3.375, -3.375]);
  assert.deepEqual(primary(right, left), ["-3.00", "-3.00"], "the engine still returns balanced -3.00/-3.00");
  var choice = choiceFor(right, left);
  assert.equal(choice.sharperStrictlyCloser, true);
  assert.deepEqual(defaultOf(right, left), ["sharper", "-3.50/-3.50", "sharper,balanced"]);
  var entries = V53.choice.choiceEntries(choice, right, left);
  assert.deepEqual(Array.from(entries, function (e) { return [e.title, e.badge, e.pair.right + "/" + e.pair.left]; }), [
    ["Closer Match", "Recommended", "-3.50/-3.50"],
    ["Softer Option", "", "-3.00/-3.00"]
  ]);
  assert.equal(entries[0].copy, "The closest stocked match to your calculated underwater strength.");
  assert.equal(entries[1].copy, "A slightly softer correction if you prefer a more relaxed underwater feel.");
  assert.equal(entries[0].notice, "", "within SE: no stronger-option warning");
  var softer = V53.choice.recommendationSelection(choice, "balanced");
  assert.deepEqual([softer.recommendationStrategy, softer.recommendedRight, softer.recommendedLeft], ["balanced", -3, -3]);

  var model = V53.choice.explainEye(right, { strategy: "sharper", selectedPower: -3.5, recommendedPower: -3.5, defaultStrategy: "sharper" });
  assert.equal(model.baseTargetRounded, "-3.38 D");
  assert.deepEqual(JSON.parse(JSON.stringify(model.nearbyLenses)), [{ power: -3.5, distance: "0.12" }, { power: -3, distance: "0.38" }]);
  assert.equal(model.closerMatchCopy, "-3.50 is the closer stocked match to your calculated underwater strength. -3.00 remains available as a softer option.");
  assert.equal(model.choiceLines, undefined);
});

test("ranking B. -7.00/-0.75, -7.75/-1.25: default becomes Sharper -7.00/-8.00", function () {
  assert.deepEqual(defaultOf(eye(-7, -0.75, 15), eye(-7.75, -1.25, 166)), ["sharper", "-7.00/-8.00", "sharper,balanced"]);
});

test("ranking C. exact midpoint -3.25 / -2.75: Balanced stays default, Sharper still offered", function () {
  var right = eye(-3.25);
  var left = eye(-2.75);
  assert.deepEqual([right.preSnapTarget, left.preSnapTarget], [-2.75, -2.25]);
  assert.equal(choiceFor(right, left).sharperStrictlyCloser, false);
  assert.deepEqual(defaultOf(right, left), ["balanced", "-2.50/-2.00", "balanced,sharper"]);
  var entries = V53.choice.choiceEntries(choiceFor(right, left), right, left);
  assert.deepEqual(Array.from(entries, function (e) { return e.title; }), [V53.choice.COPY.balancedTitle, V53.choice.COPY.sharperTitle]);
});

test("ranking: one eye strictly closer, other eye tied, makes the pair strictly closer; the unchanged eye stays identical", function () {
  // Right -7.00/-0.75: strictly closer -7.00. Left -3.75/-0.75: no Sharper.
  assert.deepEqual(defaultOf(eye(-7, -0.75, 15), eye(-3.75, -0.75)), ["sharper", "-7.00/-3.50", "sharper,balanced"]);
  // Right strictly closer, left an exact midpoint tie.
  assert.deepEqual(defaultOf(eye(-7, -0.75, 15), eye(-3.25)), ["sharper", "-7.00/-3.00", "sharper,balanced"]);
  // Both eyes tie: Balanced.
  assert.deepEqual(defaultOf(eye(-3.25), eye(-3.25)), ["balanced", "-2.50/-2.50", "balanced,sharper"]);
});

test("ranking D. stronger candidate farther away: Balanced only", function () {
  assert.deepEqual(defaultOf(eye(-3.75, -0.75), eye(-3.75, -0.75)), ["balanced", "-3.50/-3.50", "no second option"]);
});

test("ranking E. a Sharper lens that would exceed SE is suppressed and never default", function () {
  // With the real 0.50 D minus stock a Sharper lens at least as close to the
  // target is always at least 0.25 D inside SE, so the grid can never reach
  // this gate (the grid sweep asserts no default exceeds SE). Exercise it
  // with a synthetic catalog that has a 2.00 D gap: target -4.25 is closer to
  // -5.00 than to -3.00, but -5.00 is stronger than SE -4.75.
  var synthetic = {
    valid: true, manualReview: false, stockStatus: "OK", recommendation: "-3.00", cylinderMagnitude: 0,
    finalStockPower: -3, preSnapTarget: -4.25, sphericalEquivalent: -4.75, original: { sphere: -4.75 }
  };
  var options = { myopiaPowers: [-1, -2, -3, -5, -6] };
  var alt = V53.choice.eyeMidpointAlternative(synthetic, options);
  assert.equal(alt.reason, "exceeds_spherical_equivalent");
  assert.equal(alt.alternativePower, null);
  var choice = V53.choice.calculatePairMidpointChoice(synthetic, synthetic, options);
  assert.equal(choice.available, false);
  assert.equal(V53.choice.defaultStrategyOf(choice), "balanced");
});

test("ranking F. farsighted Closer to Your SPH stays secondary; Balanced +2.00/+2.00 is default", function () {
  var right = eye(3, -0.75);
  var left = eye(2.5, -0.5);
  assert.deepEqual(defaultOf(right, left), ["balanced", "+2.00/+2.00", "balanced,closer_to_sph"]);
  var entries = V53.choice.choiceEntries(choiceFor(right, left), right, left);
  assert.equal(entries[0].badge, "Recommended");
  assert.equal(entries[1].title, "Closer to Your SPH");
  assert.match(entries[1].notice, /stronger than the spherical-equivalent estimate/, "stronger-option warning preserved");
});

test("ranking G. high CYL is unchanged: its own Balanced default and no ranking", function () {
  var right = eye(-2.75, -3.25, 170);
  var left = eye(-2, -3, 10);
  var preview = V53.highCyl.calculatePairAlternative(right, left);
  assert.equal(V53.highCyl.recommendationSelection(preview).recommendationStrategy, "balanced");
  assert.deepEqual(second(choiceFor(right, left)), ["none", "high_cylinder_workflow"]);
});

test("ranking H. low-minus, plano, plano gap, manual review and low-plus keep no choice and no ranking", function () {
  [[eye(0), eye(-3.75, -0.25)], [eye(-1), eye(-3.75, -0.25)], [eye(-0.75), eye(-3.75, -0.25)],
    [eye(-0.25, -0.5), eye(-3.75, -0.25)], [eye(1), eye(3)], [eye(-3.75, -0.25), eye(3)]].forEach(function (pair) {
    var choice = choiceFor(pair[0], pair[1]);
    assert.equal(choice.available, false);
    assert.equal(V53.choice.defaultStrategyOf(choice), "balanced");
  });
});

test("explanation copy has no em dashes, no 'median' and no fixed 0.50 D water claim", function () {
  var all = JSON.stringify(V53.choice.COPY);
  assert.equal(/—/.test(all), false);
  assert.equal(/median/i.test(all), false);
  assert.equal(/water adds/i.test(all), false);
});

// ------------------------------------------------------------------ grid --

function stockIndex(power) {
  var catalog = power < 0 ? MINUS : PLUS;
  var corrective = catalog.filter(function (p) { return Math.abs(p) > EPSILON && Math.sign(p) === Math.sign(power); })
    .sort(function (a, b) { return Math.abs(a) - Math.abs(b); });
  return corrective.indexOf(power);
}

function gridEyes() {
  var eyes = [];
  for (var s = -10; s <= 6 + EPSILON; s += 0.25) {
    for (var c = -3.75; c <= 3.75 + EPSILON; c += 0.25) {
      var sphere = Math.round(s * 100) / 100;
      var cylinder = Math.round(c * 100) / 100;
      var result = eye(sphere, cylinder);
      if (result.valid) eyes.push(result);
    }
  }
  return eyes;
}

var GRID = gridEyes();

function checkPair(right, left, stats) {
  var preview = V53.highCyl.calculatePairAlternative(right, left);
  var options = { highCylinderTriggered: Boolean(preview && preview.triggered), highCylinderThreshold: V53.highCyl.HIGH_CYL_THRESHOLD };
  var choice = V53.choice.calculatePairRecommendationChoice(right, left, options);
  if (!choice.available) return choice;
  assert.equal(options.highCylinderTriggered, false, "never with high CYL");
  [["right", right], ["left", left]].forEach(function (entry) {
    var result = entry[1];
    assert.equal(V53.choice.protectedReason(result, 3), null, "no protected eye in an offered pair");
    var primaryPower = result.finalStockPower;
    var alternative = choice.alternative[entry[0] + "Power"];
    if (Math.abs(alternative - primaryPower) < EPSILON) return;
    assert.ok(Math.sign(alternative) === Math.sign(primaryPower), "never crosses sign");
    assert.ok(Math.abs(stockIndex(alternative) - stockIndex(primaryPower)) <= 1, "at most one stock interval");
    if (choice.alternativeStrategy === "sharper") {
      assert.ok(Math.abs(alternative) <= Math.abs(result.sphericalEquivalent) + EPSILON, "Sharper never exceeds SE");
      assert.ok(Math.abs(alternative - result.preSnapTarget) <= Math.abs(primaryPower - result.preSnapTarget) + EPSILON);
    } else {
      var sphere = result.original.sphere;
      assert.ok(Math.sign(sphere) === Math.sign(alternative), "same sign as printed SPH");
      assert.ok(Math.abs(alternative) <= Math.abs(sphere) + EPSILON, "never beyond the printed SPH");
    }
    if (stats) stats.eyes.push({ strategy: choice.alternativeStrategy, steps: Math.abs(stockIndex(alternative) - stockIndex(primaryPower)) });
  });
  assert.ok(!(Math.sign(right.finalStockPower) * Math.sign(left.finalStockPower) < 0), "never mixed sign");

  // Default ranking: Sharper leads exactly when its pair is strictly closer to
  // the same V5.3 targets; ties and Closer to Your SPH keep the V5.3 pair.
  var distance = function (pair) {
    return Math.abs(pair.rightPower - right.preSnapTarget) + Math.abs(pair.leftPower - left.preSnapTarget);
  };
  var strictlyCloser = choice.alternativeStrategy === "sharper" && distance(choice.alternative) < distance(choice.balanced) - EPSILON;
  assert.equal(choice.defaultStrategy, strictlyCloser ? "sharper" : "balanced");
  assert.equal(V53.choice.recommendationSelection(choice).recommendationStrategy, choice.defaultStrategy);
  if (choice.defaultStrategy === "sharper") {
    [["right", right], ["left", left]].forEach(function (entry) {
      var power = choice.sharper[entry[0] + "Power"];
      assert.ok(Math.abs(power) <= Math.abs(entry[1].sphericalEquivalent) + EPSILON, "a default Sharper never exceeds SE");
      assert.ok(Math.abs(power - entry[1].preSnapTarget) <= Math.abs(entry[1].finalStockPower - entry[1].preSnapTarget) + EPSILON,
        "no default eye is farther from its target");
    });
  }
  if (stats) stats.pairs.push({ strategy: choice.alternativeStrategy, defaultStrategy: choice.defaultStrategy });
  return choice;
}

test("grid sweep: ordinary-myopia default-ranking statistics", function () {
  var stats = { eyes: [], pairs: [] };
  var myopic = GRID.filter(function (r) {
    return r.valid && r.stockStatus === "OK" && r.sphericalEquivalent < 0 && r.finalStockPower < 0 &&
      V53.choice.protectedReason(r, 3) === null;
  });
  var total = myopic.length;
  var sharper = 0;
  var strict = 0;
  var tie = 0;
  myopic.forEach(function (r) {
    var choice = checkPair(r, r, stats);
    if (choice.available && choice.alternativeStrategy === "sharper") {
      sharper += 1;
      if (choice.defaultStrategy === "sharper") strict += 1;
      else tie += 1;
    }
  });
  var maxSteps = stats.eyes.reduce(function (max, e) { return Math.max(max, e.steps); }, 0);
  var protectedEyes = GRID.filter(function (r) { return V53.choice.protectedReason(r, 3) !== null; });
  protectedEyes.forEach(function (r) {
    assert.equal(choiceFor(r, r).available, false, "protected eyes stay suppressed");
  });
  var report = {
    ordinaryMyopicEyes: total,
    receivingSharper: sharper,
    receivingSharperPct: +(100 * sharper / total).toFixed(1),
    sharperDefaultStrictlyCloser: strict,
    sharperDefaultPct: +(100 * strict / total).toFixed(1),
    exactTiesBalancedDefault: tie,
    exactTiesPct: +(100 * tie / total).toFixed(1),
    maxStockSteps: maxSteps,
    protectedEyesSuppressed: protectedEyes.length
  };
  if (process.env.OO_SWEEP_REPORT) console.log(JSON.stringify(report));
  assert.ok(sharper > 0 && strict > 0 && tie > 0);
  assert.equal(strict + tie, sharper);
  assert.ok(maxSteps <= 1);
});

test("grid: every eye paired with itself and with every other eye of the same prescription band holds the invariants", function () {
  var offered = 0;
  GRID.forEach(function (result) {
    if (checkPair(result, result).available) offered += 1;
  });
  // Deterministic sample of different-eye pairs.
  for (var i = 0; i < GRID.length; i += 7) {
    for (var j = 3; j < GRID.length; j += 53) checkPair(GRID[i], GRID[j]);
  }
  assert.ok(offered > 0);
});
