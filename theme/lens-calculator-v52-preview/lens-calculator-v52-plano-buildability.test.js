"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var crypto = require("node:crypto");
var V53 = require("./lens-calculator-v53.js");
var Products = require("./lens-calculator-v52-products.js");

function ids(right, left) {
  return Products.findCompatibleProducts(right, left).products.map(function (p) { return p.id; });
}
function product(id) {
  return Products.CATALOG.find(function (p) { return p.id === id; });
}

test("0.00 is buildable in every active mask family", function () {
  ["obsidian-nearsighted", "obsidian-farsighted", "rover", "lumix", "titan"].forEach(function (id) {
    assert.equal(Products.supportsPower(product(id), 0), true, id);
    assert.equal(Products.supportsPower(product(id), "0.00"), true, id);
  });
});

test("prescription ranges are unchanged apart from plano", function () {
  ["rover", "lumix", "titan"].forEach(function (id) {
    assert.equal(Products.supportsPower(product(id), -1), false, id + " -1.00");
    assert.equal(Products.supportsPower(product(id), -1.5), true, id + " -1.50");
    assert.equal(Products.supportsPower(product(id), -6), true, id + " -6.00");
    assert.equal(Products.supportsPower(product(id), -6.5), false, id + " -6.50");
  });
  assert.equal(Products.supportsPower(product("obsidian-nearsighted"), -1), true);
  assert.equal(Products.supportsPower(product("obsidian-nearsighted"), -9), true);
  assert.equal(Products.supportsPower(product("obsidian-farsighted"), 3), true);
  assert.equal(Products.supportsPower(product("obsidian-farsighted"), 2.5), false);
});

test("all-plano pairs route to one Obsidian path plus Rover, Titan and Lumix", function () {
  var result = Products.findCompatibleProducts(0, 0);
  assert.equal(result.type, "plano");
  assert.deepEqual(ids(0, 0), ["obsidian-nearsighted", "rover", "titan", "lumix"]);
  var obsidianCards = result.products.filter(function (p) { return /Obsidian/.test(p.name); });
  assert.equal(obsidianCards.length, 1);
  assert.equal(obsidianCards[0].id, "obsidian-nearsighted");
  assert.equal(Products.findCompatibleProducts("0.00", "-0.00").type, "plano");
});

test("mixed plano / Rx pairs route by the non-plano eye", function () {
  assert.deepEqual(ids(0, -1), ["obsidian-nearsighted"]);
  assert.deepEqual(ids(0, -1.5), ["obsidian-nearsighted", "rover", "titan", "lumix"]);
  assert.deepEqual(ids(0, -2.5), ["obsidian-nearsighted", "rover", "titan", "lumix"]);
  assert.deepEqual(ids(-3, 0), ["obsidian-nearsighted", "rover", "titan", "lumix"]);
  assert.deepEqual(ids(0, -6), ["obsidian-nearsighted", "rover", "titan", "lumix"]);
  assert.deepEqual(ids(0, -6.5), ["obsidian-nearsighted"]);
  assert.deepEqual(ids(2, 0), ["obsidian-farsighted"]);
  assert.deepEqual(ids(0, 2), ["obsidian-farsighted"]);
  assert.deepEqual(ids(0, -9.5), []);
  assert.equal(Products.findCompatibleProducts(-2, 2).type, "mixed");
});

test("SPH -0.25 stays 0.00 in the engine and shows compatible plano masks", function () {
  var eye = V53.calculateEyeRecommendationV53({ sphere: "-0.25", cylinder: "0", axis: "" }, "Right");
  assert.equal(eye.recommendation, "0.00");
  assert.equal(eye.lowMinusChoice, false);
  assert.deepEqual(ids(eye.finalStockPower, eye.finalStockPower), ["obsidian-nearsighted", "rover", "titan", "lumix"]);
});

test("SPH -0.75 is a low-minus choice: -1.00 primary, 0.00 softer alternative", function () {
  var eye = V53.calculateEyeRecommendationV53({ sphere: "-0.75", cylinder: "0", axis: "" }, "Right");
  assert.equal(eye.recommendation, "-1.00");
  assert.equal(eye.stockRule, "low-minus-choice");
  assert.equal(eye.lowMinusChoice, true);
  assert.equal(eye.alternativePower, 0);
  assert.deepEqual(ids(eye.finalStockPower, eye.finalStockPower), ["obsidian-nearsighted"]);
  assert.deepEqual(ids(eye.alternativePower, eye.alternativePower), ["obsidian-nearsighted", "rover", "titan", "lumix"]);
});

test("plano is presented as Plano (0.00), not as an error", function () {
  assert.equal(Products.formatLensLabel(0), "Plano (0.00)");
  assert.equal(Products.formatLensLabel(-0), "Plano (0.00)");
  assert.equal(Products.formatLensLabel(-2.5), "-2.50");
  assert.equal(Products.PLANO_INTRO, "Your calculated underwater correction falls within the standard lens range, so you can choose from our compatible mask styles.");
  var source = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-products.js"), "utf8");
  assert.match(source, /if \(intro\) intro\.textContent = result\.type === "plano" \? PLANO_INTRO : defaultIntro;/);
  assert.match(source, /"R " \+ formatLensLabel\(profile\.recommendedRight\)/);
  var ui = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-ui.js"), "utf8");
  assert.match(ui, /Plano \(0\.00\) means no correction for that eye: the mask's standard lens stays in place\./);
  assert.match(ui, /note\.hidden = planoEyes\.length === 0 \|\| values\.hidden;/);
});

test("plano handoff URLs keep the selected variant, config and source", function () {
  var profile = { status: "ready", configId: "28bf81b0-d4fb-4a51-a2db-d262dbf29cb8", recommendedRight: 0, recommendedLeft: 0 };
  ["obsidian-nearsighted", "rover", "titan", "lumix"].forEach(function (id) {
    var url = new URL(Products.prepareProductPageUrl(profile, product(id), Products.defaultVariant(product(id))));
    assert.match(url.searchParams.get("variant"), /^\d+$/, id);
    assert.equal(url.searchParams.get("oo_rx"), profile.configId, id);
    assert.equal(url.searchParams.get("oo_source"), "lens_calculator_v53", id);
  });
  var mixed = { status: "ready", configId: "28bf81b0-d4fb-4a51-a2db-d262dbf29cb8", recommendedRight: 0, recommendedLeft: -2.5 };
  assert.ok(Products.prepareProductPageUrl(mixed, product("rover"), Products.defaultVariant(product("rover"))));
});

test("the V5.3 engine file is the approved midpoint-rule engine", function () {
  var hash = crypto.createHash("sha256").update(fs.readFileSync(path.join(__dirname, "lens-calculator-v53.js"))).digest("hex");
  assert.equal(hash, "a658483de3a1ba7f2237ef1f8f89afcc3a71fd9d46b6ea73e049f7be42aca6fa");
});
