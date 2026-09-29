"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var Products = require("./lens-calculator-v52-products.js");

function names(result) {
  return result.products.map(function (product) { return product.name; });
}

test("catalog contains the existing four products plus approved Rx Titan", function () {
  assert.deepEqual(Products.CATALOG.map(function (product) { return product.name; }), [
    "Rx Obsidian Nearsighted",
    "Rx Obsidian Farsighted",
    "Rx Rover",
    "Rx Titan",
    "Rx Lumix"
  ]);
  var source = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-products.js"), "utf8");
  ["Carbon", "Mirage", "Action", "Mako"].forEach(function (excluded) {
    assert.doesNotMatch(source, new RegExp("Rx " + excluded));
  });
});

test("Obsidian near and far use the approved physical-mask images without changing variants", function () {
  var expectedImages = {
    "Aqua/Clear": "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-obsidian-prescription-diving-mask-medium-prescription-dive-mask-clear-medium-1-50-8-00-aqua-clear-1200392465.png?v=1790571202",
    "Black/Clear": "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-obsidian-prescription-diving-mask-medium-prescription-dive-mask-clear-medium-1-50-8-00-black-clear-1200392466.png?v=1790571194",
    "Pink/Clear": "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-obsidian-prescription-diving-mask-medium-prescription-dive-mask-clear-medium-1-50-8-00-pink-clear-1200392462.png?v=1790571206",
    "Red/Clear": "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-obsidian-prescription-diving-mask-medium-prescription-dive-mask-clear-medium-1-50-8-00-red-clear-1200392463.png?v=1790571183",
    "Yellow/Clear": "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-obsidian-prescription-diving-mask-medium-prescription-dive-mask-clear-medium-1-50-8-00-yellow-clear-1200392461.png?v=1790571188",
    "Red/Black": "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-obsidian-prescription-snorkel-dive-mask-medium-prescription-snorkel-mask-black-medium-diopter-1-50-8-00-red-with-black-1146123877.png?v=1790401444"
  };
  var blueClear = "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-obsidian-prescription-diving-mask-medium-prescription-dive-mask-clear-medium-1-50-8-00-blue-clear-1200392464.png?v=1790571163";
  var expectedVariants = {
    "obsidian-nearsighted": {
      path: "/products/the-rx-obsidian-prescription-mask-for-scuba-dive-snorkeling",
      variants: {
        "Red/Black": "50148669489485", "Aqua/Clear": "52697208193357",
        "Black/Clear": "52697208160589", "Blue/Clear": "52697208258893",
        "Pink/Clear": "52697208291661", "Red/Clear": "52697208226125",
        "Yellow/Clear": "52697208324429"
      }
    },
    "obsidian-farsighted": {
      path: "/products/rx-obsidian-farsighted-prescription-snorkel-scuba-dive-mask",
      variants: {
        "Red/Black": "53151486574925", "Aqua/Clear": "53151486640461",
        "Black/Clear": "53151486673229", "Blue/Clear": "53151486738765",
        "Pink/Clear": "53151486705997", "Red/Clear": "53151486804301",
        "Yellow/Clear": "53151486771533"
      }
    }
  };

  Object.keys(expectedVariants).forEach(function (productId) {
    var product = Products.CATALOG.find(function (candidate) { return candidate.id === productId; });
    var expectation = expectedVariants[productId];
    Object.keys(expectedImages).forEach(function (combination) {
      var parts = combination.split("/");
      assert.equal(Products.findVariant(product, parts[0], parts[1]).img, expectedImages[combination]);
    });
    assert.equal(Products.findVariant(product, "Blue", "Clear").img, blueClear);
    Object.keys(expectation.variants).forEach(function (combination) {
      var parts = combination.split("/");
      var url = new URL(Products.findVariant(product, parts[0], parts[1]).url);
      assert.equal(url.pathname, expectation.path);
      assert.equal(url.searchParams.get("variant"), expectation.variants[combination]);
    });
  });
});

test("negative pair uses exact selected powers and approved stock ranges", function () {
  assert.deepEqual(names(Products.findCompatibleProducts(-4, -4.5)), [
    "Rx Obsidian Nearsighted",
    "Rx Rover",
    "Rx Titan",
    "Rx Lumix"
  ]);
  assert.deepEqual(names(Products.findCompatibleProducts(-8.5, -8)), [
    "Rx Obsidian Nearsighted"
  ]);
  assert.deepEqual(names(Products.findCompatibleProducts(-6.5, -6.5)), [
    "Rx Obsidian Nearsighted"
  ]);
});

test("positive pair shows only the farsighted product at valid stock powers", function () {
  assert.deepEqual(names(Products.findCompatibleProducts(2, 3)), [
    "Rx Obsidian Farsighted"
  ]);
  assert.deepEqual(names(Products.findCompatibleProducts(1.5, 2)), []);
  assert.deepEqual(names(Products.findCompatibleProducts(6, 5)), []);
});

test("Titan uses the approved minus stock range for each eye", function () {
  var titan = Products.CATALOG.find(function (product) { return product.id === "titan"; });
  assert.ok(titan);
  assert.equal(titan.lensType, "minus");
  assert.equal(titan.allowsDifferentEyes, true);
  assert.deepEqual([titan.diopterMin, titan.diopterMax, titan.diopterStep], [-1.5, -6, 0.5]);
  assert.equal(names(Products.findCompatibleProducts(-2.5, -1.5)).includes("Rx Titan"), true);
  assert.equal(names(Products.findCompatibleProducts(-6, -6)).includes("Rx Titan"), true);
  assert.equal(names(Products.findCompatibleProducts(-6.5, -5.5)).includes("Rx Titan"), false);
  assert.equal(names(Products.findCompatibleProducts(2, 3)).includes("Rx Titan"), false);
  assert.equal(names(Products.findCompatibleProducts(-2.5, 2)).includes("Rx Titan"), false);
});

test("zero in one eye follows the other eye, while plano and mixed signs fail safely", function () {
  assert.deepEqual(names(Products.findCompatibleProducts(0, -2)), [
    "Rx Obsidian Nearsighted",
    "Rx Rover",
    "Rx Titan",
    "Rx Lumix"
  ]);
  assert.deepEqual(names(Products.findCompatibleProducts(0, 2)), [
    "Rx Obsidian Farsighted"
  ]);
  assert.equal(Products.findCompatibleProducts(0, 0).type, "plano");
  assert.equal(Products.findCompatibleProducts(-2, 2).type, "mixed");
  assert.deepEqual(Products.findCompatibleProducts(-2, 2).products, []);
});

test("compatibility module does not invoke a legacy or V5 calculation engine", function () {
  var source = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-products.js"), "utf8");
  assert.doesNotMatch(source, /calculateEyeRecommendation|calcOne|snapToHalf|OOLensCalculator/);
  assert.match(source, /profile\.recommendedRight/);
  assert.match(source, /profile\.recommendedLeft/);
});

test("product handoff keeps a top-level direct form behind the primary PDP journey", function () {
  var source = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-products.js"), "utf8");
  assert.match(source, /View Your Rx Match/);
  assert.match(source, /Add Mask Only/);
  assert.match(source, /https:\/\/oceansoptics\.com\/cart\/add/);
  assert.match(source, /doc\.createElement\("form"\)/);
  assert.match(source, /form\.submit\(\)/);
  assert.doesNotMatch(source, /fetch\([^)]*cart\/add|XMLHttpRequest/);
  assert.match(source, /browserWindow\.open\(url, "_blank"\)/);
  assert.match(source, /prepareProductPageUrl/);
  assert.match(source, /form\.target = target/);
});

test("catalog reuses approved quick notes and complete product variant maps", function () {
  var expectedCounts = {
    "obsidian-nearsighted": 12,
    "obsidian-farsighted": 12,
    rover: 10,
    titan: 10,
    lumix: 10
  };
  Products.CATALOG.forEach(function (product) {
    assert.ok(product.quickNote.length > 20, product.name + " quick note");
    assert.equal(product.variantMap.length, expectedCounts[product.id]);
    assert.ok(Products.defaultVariant(product));
  });
});

test("swatch selection resolves image and destination URL from the variant map", function () {
  Products.CATALOG.forEach(function (product) {
    var initial = Products.defaultVariant(product);
    var nextFrame = product.frameColors.find(function (color) { return color !== initial.frame; });
    var changed = Products.selectVariant(product, initial, "frame", nextFrame);
    assert.equal(changed.frame, nextFrame, product.name + " frame");
    assert.notEqual(changed.img, initial.img, product.name + " image");
    assert.notEqual(changed.url, initial.url, product.name + " URL");
    assert.equal(Products.findVariant(product, changed.frame, changed.seal), changed);
  });
});

test("Titan swatches use only approved variants and switch image and URL", function () {
  var titan = Products.CATALOG.find(function (product) { return product.id === "titan"; });
  var initial = Products.defaultVariant(titan);
  var changed = Products.selectVariant(titan, initial, "frame", "Black");

  assert.deepEqual([initial.frame, initial.seal], ["Blue", "Black"]);
  assert.deepEqual([changed.frame, changed.seal], ["Black", "Black"]);
  assert.notEqual(changed.img, initial.img);
  assert.notEqual(changed.url, initial.url);
  assert.equal(Products.findVariant(titan, changed.frame, changed.seal), changed);
  assert.equal(Products.findVariant(titan, "Aqua", "Black"), null);
  assert.equal(titan.variantMap.length, titan.frameColors.length * titan.sealColors.length);
});

test("a sparse variant map never resolves an invalid colour combination", function () {
  var product = {
    defaultFrame: "Black",
    defaultSeal: "Black",
    variantMap: [
      { frame: "Black", seal: "Black", url: "black", img: "black.png" },
      { frame: "Blue", seal: "Clear", url: "blue", img: "blue.png" }
    ]
  };
  var selected = Products.selectVariant(product, product.variantMap[0], "frame", "Blue");
  assert.deepEqual(selected, product.variantMap[1]);
  assert.equal(Products.findVariant(product, selected.frame, selected.seal), selected);
});

test("prepared commerce state contains profile and selected variant data but no tokens", function () {
  var profile = {
    configId: "config-id",
    label: "James",
    displayLabel: "James",
    recommendedRight: -4,
    recommendedLeft: -4.5,
    recommendationStrategy: "balanced",
    editToken: "must-not-leak",
    labelEditToken: "must-not-leak"
  };
  var product = Products.CATALOG[0];
  var variant = Products.defaultVariant(product);
  var state = Products.preparedCommerceState(profile, product, variant);
  assert.deepEqual(state, {
    configId: "config-id",
    prescriptionLabel: "James",
    prescriptionDisplayLabel: "James",
    recommendedRight: -4,
    recommendedLeft: -4.5,
    recommendationStrategy: "balanced",
    productKey: product.id,
    selectedFrame: variant.frame,
    selectedSeal: variant.seal,
    shopifyVariantId: new URL(variant.url).searchParams.get("variant"),
    selectedVariantUrl: variant.url
  });
  assert.doesNotMatch(JSON.stringify(state), /must-not-leak|Token/);
});

test("product section is centered and swatches expose active button state", function () {
  var html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  var source = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-products.js"), "utf8");
  var css = fs.readFileSync(path.join(__dirname, "lens-calculator-v52.css"), "utf8");
  assert.match(html, /class="oo-v52-products__intro"/);
  assert.match(source, /swatch\.setAttribute\("aria-pressed"/);
  assert.match(source, /swatch\.classList\.toggle\("is-active"/);
  assert.match(source, /"Recommended masks for " \+ active\.displayLabel/);
  assert.match(css, /\.oo-v52-products__intro[\s\S]*?text-align:\s*center/);
  assert.match(css, /\.oo-v52-products__grid\s*\{[\s\S]*?display:\s*flex[\s\S]*?flex-wrap:\s*wrap[\s\S]*?justify-content:\s*center/);
  assert.match(css, /\.oo-v52-product-card\s*\{[\s\S]*?flex:\s*0 1 340px[\s\S]*?max-width:\s*340px/);
  assert.match(css, /\.oo-v52-products__swatch\.is-active/);
});

test("product cards show the active profile lens pair in one compact recommendation block", function () {
  var source = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-products.js"), "utf8");
  var css = fs.readFileSync(path.join(__dirname, "lens-calculator-v52.css"), "utf8");

  assert.match(source, /"oo-v52-product-card__suggested-label", "Your suggested lenses"/);
  assert.match(source, /"R " \+ formatLensLabel\(profile\.recommendedRight\)/);
  assert.match(source, /"L " \+ formatLensLabel\(profile\.recommendedLeft\)/);
  assert.match(source, /doc\.addEventListener\("oo:v52:prescription-changed", render\)/);
  assert.match(css, /\.oo-v52-product-card__suggested-label[\s\S]*?text-transform:\s*uppercase/);
  assert.match(css, /\.oo-v52-product-card__pair[\s\S]*?display:\s*flex/);
});

test("stale prescription edits suppress product recommendations until recalculation", function () {
  var source = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-products.js"), "utf8");
  assert.match(source, /addEventListener\("oo:v52:calculation-stale"/);
  assert.match(source, /section\.hidden = true/);
  assert.match(source, /grid\.innerHTML = ""/);
  assert.match(source, /benefits\.hidden = true/);
});
