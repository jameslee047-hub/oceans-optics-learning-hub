"use strict";

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

function raw(sphere, cylinder, axis) {
  return { sphere: String(sphere), cylinder: String(cylinder), axis: cylinder ? String(axis || 90) : "" };
}

test("5.3.3 applies the all-or-nothing mixed-sign plano fallback", function () {
  var rightRaw = raw(-1, 0.5, 20);
  var leftRaw = raw(0.5, 0.5, 150);
  assert.deepEqual(
    [V53.calculateEyeRecommendationV53(rightRaw, "R").recommendation, V53.calculateEyeRecommendationV53(leftRaw, "L").recommendation],
    ["-1.00", "+1.00"],
    "normal per-eye calculation is unchanged"
  );

  var pair = V53.calculatePrescriptionPairV53(rightRaw, leftRaw);
  assert.deepEqual([pair.right.recommendation, pair.left.recommendation], ["0.00", "0.00"]);
  assert.equal(pair.mixedSignPlanoFallback.applied, true);
  assert.deepEqual(JSON.parse(JSON.stringify(pair.mixedSignPlanoFallback.normalPair)), { right: -1, left: 1 });
  assert.deepEqual(
    [pair.mixedSignPlanoFallback.comparisons.right.target, pair.mixedSignPlanoFallback.comparisons.left.target],
    [-0.25, 0.25]
  );
  assert.equal(pair.softerAlternative, null);
});

test("a mixed-sign pair stays unavailable when plano is not strictly closer for both eyes", function () {
  var pair = V53.calculatePrescriptionPairV53(raw(-1.75, 0, 0), raw(0.5, 0.5, 150));
  assert.deepEqual([pair.right.recommendation, pair.left.recommendation], ["-1.50", "+1.00"]);
  assert.equal(pair.mixedSignPlanoFallback.detected, true);
  assert.equal(pair.mixedSignPlanoFallback.applied, false);
  assert.equal(V53.pairBuildableOnAnyCurrentMask(pair.right.finalStockPower, pair.left.finalStockPower), false);
});
