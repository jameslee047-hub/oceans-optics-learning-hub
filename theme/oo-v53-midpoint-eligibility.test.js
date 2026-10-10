"use strict";

// V5.3 exact-midpoint (Comfort / Sharper) eligibility, run against the
// storefront engine, high-CYL and midpoint modules exactly as Shopify loads
// them. No dependencies.

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var vm = require("node:vm");

var ASSETS = path.join(__dirname, "base", "assets");

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
    midpoint: sandbox.OOV53MidpointChoice
  };
}

var V53 = loadModules();

function eye(sphere, cylinder, axis) {
  var cyl = cylinder || "0.00";
  return V53.engine.calculateEyeRecommendationV53({
    sphere: sphere,
    cylinder: cyl,
    cylinderSign: cyl.charAt(0) === "-" ? "-" : "+",
    axis: Number(cyl) === 0 ? "" : String(axis || 90)
  }, "eye");
}

// Same call the calculator UI and the Product Rx Checker make.
function pairChoice(right, left) {
  var preview = V53.highCyl.calculatePairAlternative(right, left);
  return V53.midpoint.calculatePairMidpointChoice(right, left, {
    highCylinderTriggered: Boolean(preview && preview.triggered),
    highCylinderThreshold: V53.highCyl.HIGH_CYL_THRESHOLD
  });
}

function offered(choice) {
  assert.equal(choice.available, true, "expected a Comfort / Sharper choice, got " + choice.reason);
  return {
    comfort: [choice.balanced.right, choice.balanced.left],
    sharper: [choice.sharper.right, choice.sharper.left]
  };
}

test("1. -1.25 / -1.75: the SE -1.25 eye does not block the other eye's midpoint", function () {
  var right = eye("-1.25");
  var left = eye("-1.75");
  // Normal V5.3 pathway for both eyes (SE stronger than -1.00).
  assert.equal(right.lowMinusChoice, false);
  assert.equal(right.recommendation, "-1.00");
  assert.equal(left.recommendation, "-1.00");
  var choice = pairChoice(right, left);
  assert.deepEqual(offered(choice), { comfort: ["-1.00", "-1.00"], sharper: ["-1.00", "-1.50"] });
  assert.equal(choice.eyes.right.alternativePower, null, "the -1.25 eye keeps its own lens");
});

test("1b. the same pair mirrored: -1.75 / -1.25", function () {
  assert.deepEqual(offered(pairChoice(eye("-1.75"), eye("-1.25"))), { comfort: ["-1.00", "-1.00"], sharper: ["-1.50", "-1.00"] });
});

test("2. existing one-eye midpoint -3.25 / -3.00 is unchanged", function () {
  assert.deepEqual(offered(pairChoice(eye("-3.25"), eye("-3.00"))), { comfort: ["-2.50", "-2.50"], sharper: ["-3.00", "-2.50"] });
});

test("3. existing two-eye midpoint -3.25 / -2.75 is unchanged", function () {
  assert.deepEqual(offered(pairChoice(eye("-3.25"), eye("-2.75"))), { comfort: ["-2.50", "-2.00"], sharper: ["-3.00", "-2.50"] });
});

test("4. genuine protected low-minus (SE -1.00 to -0.50) still suppresses Sharper", function () {
  ["-0.75", "-1.00", "-0.50+-0.50"].forEach(function (value) {
    var parts = value.split("+");
    var right = parts.length === 2 ? eye(parts[0], parts[1]) : eye(value);
    assert.equal(right.lowMinusChoice, true, value + " is in the low-minus pathway");
    var choice = pairChoice(right, eye("-1.75"));
    assert.equal(choice.available, false);
    assert.equal(choice.reason, "right_low_minus_or_plano_gap");
  });
});

test("5. SE exactly -0.50 keeps manual review and no Sharper", function () {
  var choice = pairChoice(eye("-0.50"), eye("-1.75"));
  assert.equal(choice.available, false);
  assert.equal(choice.reason, "right_manual_review");
  assert.equal(pairChoice(eye("-0.50"), eye("-0.50")).available, false);
});

test("6. genuine plano results never offer Sharper", function () {
  assert.equal(pairChoice(eye("0.00"), eye("-1.75")).reason, "right_plano");
  assert.equal(pairChoice(eye("-0.25"), eye("-0.25")).available, false);
  assert.equal(pairChoice(eye("+0.25"), eye("+1.25")).available, false);
});

test("7. high CYL keeps its own workflow and never shows a midpoint choice", function () {
  assert.equal(pairChoice(eye("-3.00", "-3.50"), eye("-3.00", "-3.50")).available, false);
  var withMidpointSe = pairChoice(eye("-1.50", "-3.50"), eye("-1.00", "-3.50"));
  assert.equal(withMidpointSe.available, false);
  assert.equal(withMidpointSe.reason, "high_cylinder_workflow");
});

test("8. farsighted behaviour is unchanged", function () {
  [["+3.25", "+2.75"], ["+1.25", "+1.75"], ["+2.50", "+2.50"]].forEach(function (pair) {
    var choice = pairChoice(eye(pair[0]), eye(pair[1]));
    assert.equal(choice.available, false);
    assert.equal(choice.reason, "no_midpoint_alternative");
  });
});

test("no Sharper lens ever exceeds its eye's SE, and no protected eye appears in an offered pair", function () {
  var eyes = [];
  for (var hundredths = -1000; hundredths <= 600; hundredths += 25) {
    ["0.00", "-0.50", "-1.00", "-1.50", "-2.00"].forEach(function (cyl) {
      var sphere = (hundredths > 0 ? "+" : "") + (hundredths / 100).toFixed(2);
      var result = eye(sphere, cyl);
      if (result.valid) eyes.push(result);
    });
  }
  var offeredPairs = 0;
  eyes.forEach(function (right) {
    eyes.forEach(function (left) {
      var choice = pairChoice(right, left);
      if (!choice.available) return;
      offeredPairs += 1;
      [[right, "right"], [left, "left"]].forEach(function (entry) {
        var result = entry[0];
        var sharper = choice.sharper[entry[1] + "Power"];
        assert.ok(Math.abs(sharper) <= Math.abs(result.sphericalEquivalent) + 1e-6);
        assert.notEqual(result.lowMinusChoice, true);
        assert.notEqual(result.manualReview, true);
        assert.notEqual(Number(result.finalStockPower), 0);
        if (result.stockRule === "plano-to-first-minus-gap") {
          assert.ok(result.sphericalEquivalent < -1, "gap eye with SE -1.00 or weaker must stay protected");
          assert.equal(sharper, choice.balanced[entry[1] + "Power"], "a gap eye keeps its lens");
        }
      });
    });
  });
  assert.ok(offeredPairs > 0);
});
