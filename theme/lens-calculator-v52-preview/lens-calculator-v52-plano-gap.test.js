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
  assert.match(ui, /usesAlternative \? highEye\.alternativeTarget : eyeResult\.preSnapTarget,/);
  assert.match(ui, /: eyeResult\.lowMinusChoice === true/);
});

test("screenshot regression: R -1.00 -0.50 x125 / L -1.00 gives -1.00 / -1.00 under the 0.50 D midpoint rule", function () {
  var right = V53.calculateEyeRecommendationV53({ sphere: "-1.00", cylinder: "-0.50", axis: "125" }, "Right");
  var left = V53.calculateEyeRecommendationV53({ sphere: "-1.00", cylinder: "0", axis: "" }, "Left");
  assert.equal(right.preSnapTarget, -0.75);
  assert.equal(left.preSnapTarget, -0.5);
  assert.equal(right.recommendation, "-1.00");
  assert.equal(left.recommendation, "-1.00");
  // SE -1.00 (left) is a low-minus choice: primary -1.00, softer 0.00; the right
  // eye (SE -1.25) uses the unchanged plano-to-first-minus gap rule.
  assert.equal(left.stockRule, "low-minus-choice");
  assert.equal(left.alternativePower, 0);
  assert.equal(right.stockRule, "plano-to-first-minus-gap");
  assert.equal(right.lowMinusChoice, false);
  var ids = Products.findCompatibleProducts(right.finalStockPower, left.finalStockPower).products.map(function (p) { return p.id; });
  assert.deepEqual(ids, ["obsidian-nearsighted"]);
});

test("midpoint boundaries: the target-level gap rule is unchanged", function () {
  var myopia = V53.V53_CONFIG.myopiaAvailablePowers;
  [[-0.25, 0], [-0.49, 0], [-0.5, -1], [-0.51, -1], [-0.625, -1], [-0.75, -1], [-0.875, -1]].forEach(function (entry) {
    assert.equal(V53.planoToFirstMinusGapSelection(entry[0], myopia).power, entry[1], "target " + entry[0]);
  });
});

test("low-minus choice on SE: -0.25 plano, -0.50 review, beyond -0.50 to -1.00 is -1.00 with 0.00 softer, -1.125 normal", function () {
  [[-0.25, 0, false], [-0.625, -1, true], [-0.75, -1, true], [-0.875, -1, true], [-1.0, -1, true], [-1.125, -1, false], [-1.5, -1, false]].forEach(function (entry) {
    var result = V53.computeV53Recommendation(entry[0]);
    assert.equal(result.finalPower, entry[1], "SE " + entry[0]);
    assert.equal(result.lowMinusChoice, entry[2], "choice for SE " + entry[0]);
    assert.equal(result.alternativePower, entry[2] ? 0 : null, "alternative for SE " + entry[0]);
  });
  assert.equal(V53.computeV53Recommendation(-0.5).stockStatus, "PLANO_CROSSOVER_REVIEW");
});

test("Russ #336107: primary -1.00 / -1.00, softer alternative 0.00 / -1.00", function () {
  var pair = V53.calculatePrescriptionPairV53({ sphere: "-0.50", cylinder: "-0.75", axis: "2" }, { sphere: "-0.50", cylinder: "-1.25", axis: "167" });
  assert.deepEqual([pair.right.sphericalEquivalent, pair.right.preSnapTarget], [-0.875, -0.375]);
  assert.deepEqual([pair.left.sphericalEquivalent, pair.left.preSnapTarget], [-1.125, -0.625]);
  assert.deepEqual([pair.right.recommendation, pair.left.recommendation], ["-1.00", "-1.00"]);
  assert.deepEqual([pair.right.lowMinusChoice, pair.left.lowMinusChoice], [true, false]);
  assert.deepEqual(pair.softerAlternative, { right: 0, left: -1 });
  var both = V53.calculatePrescriptionPairV53({ sphere: "-0.75", cylinder: "0", axis: "" }, { sphere: "-1.00", cylinder: "0", axis: "" });
  assert.deepEqual(both.softerAlternative, { right: 0, left: 0 });
  assert.equal(V53.calculatePrescriptionPairV53({ sphere: "-3", cylinder: "0", axis: "" }, { sphere: "-2.5", cylinder: "0", axis: "" }).softerAlternative, null);
});

test("low-minus choice explanation is neutral and keeps -1.00 as the recommendation", function () {
  var ui = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-ui.js"), "utf8");
  assert.match(ui, /We recommend -1\.00: it keeps some correction and may give slightly crisper distance vision, although it may feel a little stronger underwater\. 0\.00 is a softer option with less correction; contact us if you'd prefer it\./);
  assert.doesNotMatch(ui, /overcorrect/i);
});

test("farsighted stock explanation describes the nearest-stock rule; minus wording is unchanged", function () {
  var ui = require("node:fs").readFileSync(require("node:path").join(__dirname, "lens-calculator-v52-ui.js"), "utf8");
  assert.match(ui, /There is no lens between 0\.00 and \+1\.00 D, so for this low farsighted prescription we use \+1\.00 rather than no correction\./);
  assert.match(ui, /There is no lens between 0\.00 and \+1\.00 D, and your adjusted value is small enough that no correction \(0\.00\) is suggested\./);
  assert.match(ui, /Our farsighted corrective lenses are available in 1\.00 D steps, so we choose the closest available strength\.";/);
  assert.match(ui, /The calculated underwater strength falls exactly between two available farsighted lens powers\. In this case we use the stronger of the two options to retain more of the prescription correction\./);
  assert.doesNotMatch(ui, /we use the weaker one|comfort/i);
  assert.doesNotMatch(ui, /farsighted corrective lenses are available in 1\.00 D steps, so we choose the closest available strength that stays at or closer to zero/);
  assert.match(ui, /Our corrective lenses are available in 0\.50 D steps, so we choose the closest available strength that stays at or closer to zero than the adjusted value\./);
  assert.match(ui, /There is no lens between 0\.00 and -1\.00 D\. If the adjusted value needs less than 0\.50 D of correction we use 0\.00; if it needs 0\.50 D or more we use -1\.00\./);
});
