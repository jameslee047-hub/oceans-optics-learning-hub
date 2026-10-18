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
  assert.equal(V53.choice.closerToSphRelation(choice), "It is stronger than Balanced.");
  assert.equal(V53.choice.alternativeRelation(right, left, choice.balanced, choice.alternative).sentence, "The right lens is stronger than Balanced.");
  assert.deepEqual(Array.from(V53.choice.eyesStrongerThanSE(right, left, choice.alternative)), ["right"]);
  var model = V53.choice.explainEye(right, { strategy: "closer_to_sph", selectedPower: 3, label: "Alternative mask lens" });
  assert.deepEqual([model.prescription, model.sphereOnly, model.underwaterTarget, model.lensLabel, model.lens],
    ["+3.00 / -0.75", "+2.63", "+2.13", "Alternative mask lens", "+3.00"]);
  assert.equal(model.strongerThanSE, true);
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

test("ranking A. Daniel -3.75/-0.25 x035, -3.50/-0.75 x175: Balanced -3.00/-3.00 is Recommended; Alternative -3.50/-3.50", function () {
  var right = eye(-3.75, -0.25, 35);
  var left = eye(-3.5, -0.75, 175);
  assert.deepEqual([right.sphericalEquivalent, left.sphericalEquivalent], [-3.875, -3.875]);
  assert.deepEqual([right.preSnapTarget, left.preSnapTarget], [-3.375, -3.375]);
  assert.deepEqual(primary(right, left), ["-3.00", "-3.00"], "the engine still returns balanced -3.00/-3.00");
  var choice = choiceFor(right, left);
  assert.equal(choice.sharperStrictlyCloser, true);
  assert.deepEqual(second(choice), ["sharper", "-3.50", "-3.50"], "the Sharper pair itself is unchanged");
  assert.deepEqual(defaultOf(right, left), ["balanced", "-3.00/-3.00", "balanced,sharper"]);
  var entries = V53.choice.choiceEntries(choice, right, left);
  assert.deepEqual(Array.from(entries, function (e) { return [e.title, e.badge, e.pair.right + "/" + e.pair.left]; }), [
    ["Balanced", "Recommended", "-3.00/-3.00"],
    ["Alternative", "", "-3.50/-3.50"]
  ]);
  assert.equal(entries[0].copy, "Our recommended all round option, adjusted for comfortable underwater vision.");
  assert.equal(entries[1].copy, "Another valid lens option calculated from your prescription. This gives a stronger correction than Balanced.");
  assert.equal(entries[1].notice, "", "no separate warning box");
  var sharper = V53.choice.recommendationSelection(choice, "sharper");
  assert.deepEqual([sharper.recommendationStrategy, sharper.recommendedRight, sharper.recommendedLeft], ["sharper", -3.5, -3.5]);

  var model = V53.choice.explanationModel({ rightResult: right, leftResult: left, recommendation: sharper, choice: choice });
  assert.equal(model.eyes[0].underwaterTarget, "-3.38");
  assert.equal(model.eyes[0].lens, "-3.50");
  assert.equal(model.eyes[0].lensLabel, "Alternative mask lens");
  assert.equal(model.expectation, "This gives a stronger correction than Balanced. Balanced remains our recommended all round option.");
  var balancedModel = V53.choice.explanationModel({ rightResult: right, leftResult: left, recommendation: V53.choice.recommendationSelection(choice), choice: choice });
  assert.equal(balancedModel.expectation, V53.choice.COPY.expectBalanced);
  assert.equal(balancedModel.eyes[0].lensLabel, "Closest available mask lens");
});

test("ranking B. -7.00/-0.75, -7.75/-1.25: Balanced -6.50/-7.50 default, Sharper -7.00/-8.00 alternative", function () {
  assert.deepEqual(defaultOf(eye(-7, -0.75, 15), eye(-7.75, -1.25, 166)), ["balanced", "-6.50/-7.50", "balanced,sharper"]);
  assert.deepEqual(second(choiceFor(eye(-7, -0.75, 15), eye(-7.75, -1.25, 166))), ["sharper", "-7.00", "-8.00"]);
});

test("ranking A2. screenshot tie -2.25 / -1.75: Balanced -1.50/-1.00 default; Alternative -2.00/-1.50", function () {
  var right = eye(-2.25);
  var left = eye(-1.75);
  assert.deepEqual([right.preSnapTarget, left.preSnapTarget], [-1.75, -1.25]);
  assert.deepEqual(primary(right, left), ["-1.50", "-1.00"], "the engine pair is unchanged");
  var choice = choiceFor(right, left);
  assert.equal(choice.sharperStrictlyCloser, false, "an exact tie");
  assert.deepEqual(second(choice), ["sharper", "-2.00", "-1.50"]);
  assert.deepEqual(defaultOf(right, left), ["balanced", "-1.50/-1.00", "balanced,sharper"]);
  var entries = V53.choice.choiceEntries(choice, right, left);
  assert.deepEqual(Array.from(entries, function (e) { return [e.title, e.badge]; }), [["Balanced", "Recommended"], ["Alternative", ""]]);
  var model = V53.choice.explanationModel({ rightResult: right, leftResult: left, recommendation: V53.choice.recommendationSelection(choice, "sharper"), choice: choice });
  assert.equal(model.expectation, "This gives a stronger correction than Balanced. Balanced remains our recommended all round option.");
});

test("ranking C. exact midpoint -3.25 / -2.75: Balanced default, the stronger valid pair stays offered", function () {
  var right = eye(-3.25);
  var left = eye(-2.75);
  assert.deepEqual([right.preSnapTarget, left.preSnapTarget], [-2.75, -2.25]);
  assert.equal(choiceFor(right, left).sharperStrictlyCloser, false);
  assert.deepEqual(defaultOf(right, left), ["balanced", "-2.50/-2.00", "balanced,sharper"]);
  assert.deepEqual(second(choiceFor(right, left)), ["sharper", "-3.00", "-2.50"]);
});

test("ranking: one eye strictly closer, other eye tied: Balanced is default; the unchanged eye stays identical in Sharper", function () {
  [[eye(-7, -0.75, 15), eye(-3.75, -0.75), "-6.50/-3.50", "-7.00", "-3.50"],
   [eye(-7, -0.75, 15), eye(-3.25), "-6.50/-2.50", "-7.00", "-3.00"],
   [eye(-3.25), eye(-3.25), "-2.50/-2.50", "-3.00", "-3.00"],
   [eye(-3.25), eye(-3.75, -0.75), "-2.50/-3.50", "-3.00", "-3.50"]].forEach(function (c) {
    assert.deepEqual(defaultOf(c[0], c[1]), ["balanced", c[2], "balanced,sharper"]);
    assert.deepEqual(second(choiceFor(c[0], c[1])), ["sharper", c[3], c[4]]);
  });
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

test("ranking F. farsighted closer-to-SPH alternative is shown as Alternative; Balanced +2.00/+2.00 is default", function () {
  var right = eye(3, -0.75);
  var left = eye(2.5, -0.5);
  assert.deepEqual(defaultOf(right, left), ["balanced", "+2.00/+2.00", "balanced,closer_to_sph"]);
  var entries = V53.choice.choiceEntries(choiceFor(right, left), right, left);
  assert.equal(entries[0].title, "Balanced");
  assert.equal(entries[0].badge, "Recommended");
  assert.equal(entries[1].title, "Alternative");
  assert.equal(entries[1].badge, "");
  assert.equal(entries[1].notice, "", "no separate warning box");
  assert.equal(entries[1].copy, "Another valid lens option calculated from your prescription. The right lens is stronger than Balanced.");
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

test("customer copy has no hyphens, en dashes or em dashes, no 'median' and no fixed 0.50 D water claim", function () {
  var all = JSON.stringify(V53.choice.COPY);
  assert.equal(/[-\u2013\u2014]/.test(all), false);
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

  // Default: Balanced always leads; Sharper is never farther from the targets
  // than Balanced, and sharperStrictlyCloser is reported unchanged.
  var distance = function (pair) {
    return Math.abs(pair.rightPower - right.preSnapTarget) + Math.abs(pair.leftPower - left.preSnapTarget);
  };
  var strictlyCloser = choice.alternativeStrategy === "sharper" && distance(choice.alternative) < distance(choice.balanced) - EPSILON;
  if (choice.alternativeStrategy === "sharper") {
    // Closest wins; an exact tie goes to the stronger valid (Sharper) pair.
    assert.ok(distance(choice.alternative) <= distance(choice.balanced) + EPSILON, "Sharper is never farther");
    assert.equal(choice.sharperStrictlyCloser, strictlyCloser);
  }
  assert.equal(choice.defaultStrategy, "balanced");
  assert.equal(V53.choice.recommendationSelection(choice).recommendationStrategy, "balanced");
  var entries = V53.choice.choiceEntries(choice, right, left);
  assert.deepEqual([entries[0].strategy, entries[0].badge, entries[1].title], ["balanced", "Recommended", "Alternative"]);
  if (choice.alternativeStrategy === "sharper") {
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
  var balancedDefault = 0;
  myopic.forEach(function (r) {
    var choice = checkPair(r, r, stats);
    if (choice.available && choice.alternativeStrategy === "sharper") {
      sharper += 1;
      if (choice.defaultStrategy === "balanced") balancedDefault += 1;
      if (choice.sharperStrictlyCloser) strict += 1;
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
    balancedDefault: balancedDefault,
    strictCloser: strict,
    strictCloserPct: +(100 * strict / total).toFixed(1),
    exactTiesPromotedToSharper: tie,
    exactTiesPct: +(100 * tie / total).toFixed(1),
    maxStockSteps: maxSteps,
    protectedEyesSuppressed: protectedEyes.length
  };
  if (process.env.OO_SWEEP_REPORT) console.log(JSON.stringify(report));
  assert.ok(sharper > 0 && strict > 0 && tie > 0);
  assert.equal(strict + tie, sharper);
  assert.equal(balancedDefault, sharper, "Balanced is the default for every offered Sharper pair");
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

// ------------------------------------------------- unified customer copy --

test("relation sentence describes only what the actual pair does", function () {
  var rel = function (b, a) {
    return V53.choice.alternativeRelation(null, null, { rightPower: b[0], leftPower: b[1] }, { rightPower: a[0], leftPower: a[1] });
  };
  assert.equal(rel([3, 2], [4, 3]).sentence, "This gives a stronger correction than Balanced.");
  assert.equal(rel([-9, -9], [-8.5, -8.5]).sentence, "This gives a softer correction than Balanced.");
  assert.equal(rel([-3, -3], [-3.5, -2.5]).sentence, "This uses a different balance of lens strengths than Balanced.");
  assert.equal(rel([-1, -1], [-1, -1.5]).sentence, "The left lens is stronger than Balanced.");
  assert.equal(rel([-3.5, -3], [-3, -3]).sentence, "The right lens is softer than Balanced.");
});

test("exact fixture OD +4.00/-2.00 x075, OS +3.00/-1.25 x110: Balanced +3/+2 Recommended, Alternative +4/+3, compact pathway", function () {
  var right = eye(4, -2, 75);
  var left = eye(3, -1.25, 110);
  var choice = choiceFor(right, left);
  assert.deepEqual(defaultOf(right, left), ["balanced", "+3.00/+2.00", "balanced,closer_to_sph"]);
  assert.deepEqual(second(choice), ["closer_to_sph", "+4.00", "+3.00"]);
  var entries = V53.choice.choiceEntries(choice, right, left);
  assert.deepEqual(Array.from(entries, function (e) { return [e.title, e.badge, e.pair.right + "/" + e.pair.left]; }), [
    ["Balanced", "Recommended", "+3.00/+2.00"], ["Alternative", "", "+4.00/+3.00"]
  ]);
  var balanced = V53.choice.explanationModel({ rightResult: right, leftResult: left, recommendation: V53.choice.recommendationSelection(choice), choice: choice });
  assert.equal(balanced.whyTitle, "Why are my mask lenses different from my glasses?");
  assert.equal(balanced.expectation, V53.choice.COPY.expectBalanced);
  assert.deepEqual(JSON.parse(JSON.stringify(balanced.eyes.map(function (e) { return [e.title, e.prescription, e.sphereOnly, e.underwaterTarget, e.lensLabel, e.lens]; }))), [
    ["Right eye", "+4.00 / -2.00", "+3.00", "+2.50", "Closest available mask lens", "+3.00"],
    ["Left eye", "+3.00 / -1.25", "+2.38", "+1.88", "Closest available mask lens", "+2.00"]
  ]);
  assert.equal(balanced.note, "Prescription mask lenses come in fixed strengths, so the final lens may not exactly match the calculated number.");
  var alternative = V53.choice.explanationModel({ rightResult: right, leftResult: left, recommendation: V53.choice.recommendationSelection(choice, "closer_to_sph"), choice: choice });
  assert.equal(alternative.expectation, "This gives a stronger correction than Balanced. Balanced remains our recommended all round option.");
  assert.deepEqual(JSON.parse(JSON.stringify(alternative.eyes.map(function (e) { return e.lensLabel + " " + e.lens; }))), ["Alternative mask lens +4.00", "Alternative mask lens +3.00"]);
});

test("high CYL: Balanced is the default; the alternative is titled Alternative with truthful softer copy", function () {
  var right = eye(-2.75, -3.25, 170);
  var left = eye(-2, -3, 10);
  var preview = V53.highCyl.calculatePairAlternative(right, left);
  var entries = V53.choice.choiceEntries(null, right, left, { balanced: preview.balanced, alternative: preview.alternative, alternativeStrategy: "closer_to_sph" });
  assert.deepEqual(Array.from(entries, function (e) { return [e.strategy, e.title, e.badge]; }), [["balanced", "Balanced", "Recommended"], ["closer_to_sph", "Alternative", ""]]);
  assert.equal(entries[1].copy, "Another valid lens option calculated from your prescription. This gives a softer correction than Balanced.");
});
