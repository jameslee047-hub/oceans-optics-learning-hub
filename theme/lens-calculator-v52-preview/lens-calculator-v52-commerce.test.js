"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var Products = require("./lens-calculator-v52-products.js");

var CONFIG_ID = "28bf81b0-d4fb-4a51-a2db-d262dbf29cb8";

function product(id) {
  return Products.CATALOG.find(function (candidate) { return candidate.id === id; });
}

function confirmedProfile(overrides) {
  return Object.assign({
    status: "ready",
    configId: CONFIG_ID,
    label: "James",
    displayLabel: "James",
    recommendedRight: -2.5,
    recommendedLeft: -1.5,
    recommendationStrategy: "balanced",
    confirmedRx: { private: "must-not-enter-cart" },
    editToken: "must-not-enter-cart",
    labelEditToken: "must-not-enter-cart"
  }, overrides || {});
}

function submissionFor(productId, profile, frame, seal) {
  var selectedProduct = product(productId);
  var variant = frame
    ? Products.findVariant(selectedProduct, frame, seal)
    : Products.defaultVariant(selectedProduct);
  return Products.prepareCartSubmission(profile, selectedProduct, variant);
}

test("all five product families use their selected approved Shopify variant", function () {
  var cases = [
    ["obsidian-nearsighted", confirmedProfile()],
    ["obsidian-farsighted", confirmedProfile({ recommendedRight: 2, recommendedLeft: 3 })],
    ["rover", confirmedProfile()],
    ["lumix", confirmedProfile()],
    ["titan", confirmedProfile()]
  ];

  cases.forEach(function (entry) {
    var selectedProduct = product(entry[0]);
    var variant = Products.defaultVariant(selectedProduct);
    var result = Products.prepareCartSubmission(entry[1], selectedProduct, variant);
    assert.equal(result.fields.id, new URL(variant.url).searchParams.get("variant"), entry[0]);
  });
});

test("selected frame and seal resolve the exact mapped variant", function () {
  var titan = product("titan");
  var selected = Products.findVariant(titan, "Red", "Clear");
  var result = Products.prepareCartSubmission(confirmedProfile(), titan, selected);
  assert.equal(result.fields.id, "54203206041933");
});

test("every declared frame and seal combination resolves an approved variant ID", function () {
  Products.CATALOG.forEach(function (selectedProduct) {
    selectedProduct.frameColors.forEach(function (frame) {
      selectedProduct.sealColors.forEach(function (seal) {
        var variant = Products.findVariant(selectedProduct, frame, seal);
        assert.ok(variant, selectedProduct.name + " " + frame + "/" + seal);
        assert.match(
          String(new URL(variant.url).searchParams.get("variant") || ""),
          /^\d+$/,
          selectedProduct.name + " " + frame + "/" + seal
        );
      });
    });
  });
});

test("cart payload preserves different R/L powers and farsighted plus signs", function () {
  var near = submissionFor("obsidian-nearsighted", confirmedProfile({
    recommendedRight: -2.5,
    recommendedLeft: -1.5
  }));
  var far = submissionFor("obsidian-farsighted", confirmedProfile({
    recommendedRight: 2,
    recommendedLeft: 3
  }));

  assert.equal(near.fields["properties[(OD) Right]"], "-2.50");
  assert.equal(near.fields["properties[(OS) Left]"], "-1.50");
  assert.equal(far.fields["properties[(OD) Right]"], "+2.00");
  assert.equal(far.fields["properties[(OS) Left]"], "+3.00");
});

test("plano is formatted as 0.00 without losing the corrected fellow eye", function () {
  var result = submissionFor("rover", confirmedProfile({
    recommendedRight: 0,
    recommendedLeft: -2
  }));
  assert.equal(result.fields["properties[(OD) Right]"], "0.00");
  assert.equal(result.fields["properties[(OS) Left]"], "-2.00");
});

test("approved Shopify properties are complete and private data is excluded", function () {
  var result = submissionFor("obsidian-nearsighted", confirmedProfile());
  assert.equal(result.action, "https://oceansoptics.com/cart/add");
  assert.equal(result.method, "post");
  assert.deepEqual(result.fields, {
    id: result.fields.id,
    quantity: "1",
    return_to: "/cart",
    "properties[(OD) Right]": "-2.50",
    "properties[(OS) Left]": "-1.50",
    "properties[_oo_rx_config]": CONFIG_ID,
    "properties[_oo_source]": "lens_calculator_v53",
    "properties[_has_apo]": "true",
    "properties[Prescription]": "James"
  });
  assert.doesNotMatch(JSON.stringify(result), /Upload|Uploaded|_apo_options|_apo_addons|editToken|labelEditToken|confirmedRx|must-not-enter-cart|signedUrl|storagePath|Anthropic/i);
});

test("blank prescription labels are omitted", function () {
  var result = submissionFor("obsidian-nearsighted", confirmedProfile({ label: "   " }));
  assert.equal(Object.hasOwn(result.fields, "properties[Prescription]"), false);
});

test("unconfirmed or malformed durable configurations cannot add", function () {
  var selectedProduct = product("obsidian-nearsighted");
  var variant = Products.defaultVariant(selectedProduct);
  assert.throws(function () {
    Products.prepareCartSubmission(confirmedProfile({ status: "unsaved", configId: null }), selectedProduct, variant);
  }, /Save this prescription/);
  assert.throws(function () {
    Products.prepareCartSubmission(confirmedProfile({ configId: "not-a-uuid" }), selectedProduct, variant);
  }, /Save this prescription/);
  assert.throws(function () {
    Products.prepareProductPageUrl(confirmedProfile({ status: "unsaved" }), selectedProduct, variant);
  }, /Save this prescription/);
});

test("submission guard prevents duplicate cart posts", function () {
  var calls = 0;
  var submit = Products.createSubmissionGuard(function () { calls += 1; });
  assert.equal(submit(), true);
  assert.equal(submit(), false);
  assert.equal(calls, 1);
});

test("form submission uses hidden inputs and supports a named new context", function () {
  var submitted = 0;
  var appendedForm = null;
  var doc = {
    body: { appendChild: function (node) { appendedForm = node; } },
    createElement: function (tag) {
      if (tag === "form") {
        return {
          children: [],
          appendChild: function (child) { this.children.push(child); },
          submit: function () { submitted += 1; }
        };
      }
      return {};
    }
  };
  var submission = submissionFor("obsidian-nearsighted", confirmedProfile());
  var form = Products.submitCartForm(doc, submission);
  assert.equal(appendedForm, form);
  assert.equal(form.action, "https://oceansoptics.com/cart/add");
  assert.equal(form.method, "post");
  assert.equal(form.target, undefined);
  assert.equal(submitted, 1);
  assert.equal(form.children.length, Object.keys(submission.fields).length);

  Products.submitCartForm(doc, submission, "oo-cart-target");
  assert.equal(appendedForm.target, "oo-cart-target");
});

test("product details preserve variant and append the confirmed oo_rx handoff", function () {
  var variant = Products.defaultVariant(product("titan"));
  var details = new URL(Products.buildProductDetailsUrl(variant.url, CONFIG_ID));
  assert.equal(details.searchParams.get("variant"), new URL(variant.url).searchParams.get("variant"));
  assert.equal(details.searchParams.get("oo_rx"), CONFIG_ID);
});

test("product URL construction preserves existing query parameters and fragments", function () {
  var source = "https://oceansoptics.com/products/example?variant=123&campaign=calculator#options";
  var details = new URL(Products.buildProductDetailsUrl(source, CONFIG_ID));
  assert.equal(details.searchParams.get("variant"), "123");
  assert.equal(details.searchParams.get("campaign"), "calculator");
  assert.equal(details.searchParams.get("oo_rx"), CONFIG_ID);
  assert.equal(details.hash, "#options");
});

test("View Your Rx Match opens the exact variant handoff in a new context", function () {
  var variant = Products.findVariant(product("obsidian-nearsighted"), "Red", "Clear");
  var destination = Products.prepareProductPageUrl(
    confirmedProfile(),
    product("obsidian-nearsighted"),
    variant
  );
  var calls = [];
  var focused = 0;
  var locationBefore = "https://oceans-optics-lens-v52-test.vercel.app/";
  var win = {
    location: { href: locationBefore },
    open: function (url, target) {
      calls.push({ url: url, target: target });
      return { focus: function () { focused += 1; } };
    }
  };

  Products.openNewContext(win, destination);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].target, "_blank");
  assert.equal(new URL(calls[0].url).searchParams.get("variant"), "52697208226125");
  assert.equal(new URL(calls[0].url).searchParams.get("oo_rx"), CONFIG_ID);
  assert.equal(win.location.href, locationBefore);
  assert.equal(focused, 1);
});

test("Add Mask Only posts into the synchronously opened blank context", function () {
  var submitted = 0;
  var opened = { name: "", focus: function () {}, close: function () {} };
  var calls = [];
  var appendedForm;
  var win = {
    open: function (url, target) {
      calls.push({ url: url, target: target });
      return opened;
    }
  };
  var doc = {
    body: { appendChild: function (node) { appendedForm = node; } },
    createElement: function (tag) {
      if (tag === "form") {
        return {
          children: [],
          appendChild: function (child) { this.children.push(child); },
          submit: function () { submitted += 1; }
        };
      }
      return {};
    }
  };

  var result = Products.submitCartInNewContext(
    win,
    doc,
    submissionFor("obsidian-nearsighted", confirmedProfile())
  );
  assert.deepEqual(calls, [{ url: "", target: "_blank" }]);
  assert.match(result.target, /^oo-v52-cart-/);
  assert.equal(opened.name, result.target);
  assert.equal(appendedForm.target, result.target);
  assert.equal(submitted, 1);
});

test("blocked pop-ups fail safely without navigating the calculator", function () {
  var win = { open: function () { return null; }, location: { href: "calculator" } };
  assert.throws(function () {
    Products.openNewContext(win, "https://oceansoptics.com/products/example");
  }, /blocked/);
  assert.equal(win.location.href, "calculator");
});

test("product card presents View Your Rx Match and keeps Add Mask Only unrendered", function () {
  var source = fs.readFileSync(require.resolve("./lens-calculator-v52-products.js"), "utf8");
  assert.equal(Products.PRIMARY_CTA_LABEL, "View Your Rx Match");
  assert.equal(Products.SHOW_MASK_ONLY_CTA, false);
  assert.equal(source.includes('"Customize & Add"'), false);
  assert.match(source, /SHOW_MASK_ONLY_CTA \? renderMaskOnlyButton/);
  assert.equal(source.includes('"Add mask to cart"'), false);
  assert.equal(source.includes('"View product details"'), false);
});
