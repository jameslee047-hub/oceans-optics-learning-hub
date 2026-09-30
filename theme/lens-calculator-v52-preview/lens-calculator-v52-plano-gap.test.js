"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var V53 = require("./lens-calculator-v53.js");
var HighCyl = require("./lens-calculator-v52-high-cyl.js");
var Products = require("./lens-calculator-v52-products.js");

function eye(sphere, cylinder, axis) {
  return V53.calculateEyeRecommendationV53({ sphere: String(sphere), cylinder: String(cylinder), axis: cylinder ? String(axis || 90) : "" }, "Eye");
}

test("#335852 (-1.00 -0.75 x90 / -1.25 -0.25 x100) now recommends -1.00 / -1.00", function () {
  var right = eye(-1, -0.75, 90);
  var left = eye(-1.25, -0.25, 100);
  assert.equal(right.preSnapTarget, -0.875);
  assert.equal(left.preSnapTarget, -0.875);
  assert.equal(right.recommendation, "-1.00");
  assert.equal(left.recommendation, "-1.00");
  var pair = HighCyl.calculatePairAlternative(right, left);
  assert.equal(pair.triggered, false);
});

test("#336069 right eye (-0.75 -0.75 x105) uses the plano gap; left stays -1.00", function () {
  assert.equal(eye(-0.75, -0.75, 105).recommendation, "-1.00");
  assert.equal(eye(-1, -1.5, 43).recommendation, "-1.00");
});

test("product matching receives the new result and buildability stays with product ranges", function () {
  var ids = Products.findCompatibleProducts(-1, -1).products.map(function (p) { return p.id; });
  assert.deepEqual(ids, ["obsidian-nearsighted"]);
  assert.equal(Products.findCompatibleProducts(0, 0).type, "plano");
  var near = Products.CATALOG.find(function (p) { return p.id === "obsidian-nearsighted"; });
  var rover = Products.CATALOG.find(function (p) { return p.id === "rover"; });
  assert.equal(Products.supportsPower(near, -1), true);
  assert.equal(Products.supportsPower(rover, -1), false);
});

test("Closer-to-SPH alternatives use the same gap selection without changing their targets", function () {
  // #334827 Ryan: right SPH 0.00 CYL -2.75 (below the high-CYL threshold,
  // SE -1.375, target -0.875); left SPH -0.25 CYL -4.00 triggers Closer to
  // your SPH with its own unchanged target of -0.75.
  var right = eye(0, -2.75, 8);
  var left = eye(-0.25, -4, 167);
  var pair = HighCyl.calculatePairAlternative(right, left);
  assert.equal(pair.triggered, true);
  assert.equal(right.recommendation, "-1.00");
  assert.equal(pair.eyes.right.triggered, false);
  assert.equal(pair.eyes.left.triggered, true);
  assert.equal(pair.eyes.left.alternativeTarget, -0.75);
  assert.deepEqual(pair.balanced, { right: "-1.00", left: "-1.50" });
  assert.deepEqual(pair.alternative, { right: "-1.00", left: "-1.00" });
});

test("calculation helper explains the plano gap without claiming the lens is weaker than the target", function () {
  var ui = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-ui.js"), "utf8");
  assert.match(ui, /if \(target < 0 && target > -1\) \{\s+return "There is no lens between 0\.00 and -1\.00 D\. If the adjusted value needs less than 0\.50 D of correction we use 0\.00; if it needs 0\.50 D or more we use -1\.00\.";/);
  assert.match(ui, /stockExplanation\(recommended, usesAlternative \? highEye\.alternativeTarget : eyeResult\.preSnapTarget\)/);
});

test("screenshot regression: R -1.00 -0.50 x125 / L -1.00 gives -1.00 / -1.00 under the 0.50 D midpoint rule", function () {
  var right = V53.calculateEyeRecommendationV53({ sphere: "-1.00", cylinder: "-0.50", axis: "125" }, "Right");
  var left = V53.calculateEyeRecommendationV53({ sphere: "-1.00", cylinder: "0", axis: "" }, "Left");
  assert.equal(right.preSnapTarget, -0.75);
  assert.equal(left.preSnapTarget, -0.5);
  assert.equal(right.recommendation, "-1.00");
  assert.equal(left.recommendation, "-1.00");
  assert.equal(left.stockRule, "plano-to-first-minus-gap");
  var ids = Products.findCompatibleProducts(right.finalStockPower, left.finalStockPower).products.map(function (p) { return p.id; });
  assert.deepEqual(ids, ["obsidian-nearsighted"]);
});

test("midpoint boundaries: less than 0.50 D of minus uses plano, 0.50 D or more uses -1.00", function () {
  var myopia = V53.V53_CONFIG.myopiaAvailablePowers;
  [[-0.25, 0], [-0.49, 0], [-0.5, -1], [-0.51, -1], [-0.625, -1], [-0.75, -1], [-0.875, -1]].forEach(function (entry) {
    assert.equal(V53.selectStockPower(entry[0], entry[0] - 0.5, myopia).power, entry[1], "target " + entry[0]);
  });
});

test("farsighted stock explanation describes the nearest-stock rule; minus wording is unchanged", function () {
  var ui = require("node:fs").readFileSync(require("node:path").join(__dirname, "lens-calculator-v52-ui.js"), "utf8");
  assert.match(ui, /There is no lens between 0\.00 and \+1\.00 D, so for this low farsighted prescription we use \+1\.00 rather than no correction\./);
  assert.match(ui, /There is no lens between 0\.00 and \+1\.00 D, and your adjusted value is small enough that no correction \(0\.00\) is suggested\./);
  assert.match(ui, /Our farsighted corrective lenses are available in 1\.00 D steps, so we choose the closest available strength\. If the adjusted value is exactly halfway between two strengths, we use the weaker one\./);
  assert.doesNotMatch(ui, /farsighted corrective lenses are available in 1\.00 D steps, so we choose the closest available strength that stays at or closer to zero/);
  assert.match(ui, /Our corrective lenses are available in 0\.50 D steps, so we choose the closest available strength that stays at or closer to zero than the adjusted value\./);
  assert.match(ui, /There is no lens between 0\.00 and -1\.00 D\. If the adjusted value needs less than 0\.50 D of correction we use 0\.00; if it needs 0\.50 D or more we use -1\.00\./);
});
