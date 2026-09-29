"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var Products = require("./lens-calculator-v52-products.js");
var Rx = require("./lens-calculator-v52-rx.js");

var CONFIG_A = "28bf81b0-d4fb-4a51-a2db-d262dbf29cb8";
var CONFIG_B = "5b0f3c1e-7a2d-4c61-9e3f-0d8a1b2c3d4e";

function FakeNode(tag) {
  this.tagName = String(tag).toUpperCase();
  this.children = [];
  this.className = "";
  this.textContent = "";
  this.hidden = false;
  this.disabled = false;
  this.dataset = {};
  this.style = {};
  this.attributes = {};
  this.listeners = {};
  var node = this;
  this.classList = {
    toggle: function (name, force) {
      var list = node.className.split(/\s+/).filter(Boolean);
      var has = list.indexOf(name) >= 0;
      var want = force === undefined ? !has : Boolean(force);
      if (want && !has) list.push(name);
      if (!want && has) list.splice(list.indexOf(name), 1);
      node.className = list.join(" ");
      return want;
    },
    contains: function (name) { return node.className.split(/\s+/).indexOf(name) >= 0; }
  };
}
FakeNode.prototype.appendChild = function (child) { this.children.push(child); return child; };
FakeNode.prototype.setAttribute = function (name, value) { this.attributes[name] = String(value); };
FakeNode.prototype.getAttribute = function (name) { return this.attributes[name] || null; };
FakeNode.prototype.addEventListener = function (type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); };
FakeNode.prototype.click = function () { (this.listeners.click || []).forEach(function (fn) { fn({}); }); };
Object.defineProperty(FakeNode.prototype, "innerHTML", { set: function () { this.children = []; } });

function descendants(node) {
  return node.children.reduce(function (all, child) { return all.concat([child], descendants(child)); }, []);
}

function fakeDocument() {
  var ids = {};
  ["oo-v52-products", "oo-v52-products-title", "oo-v52-products-switcher", "oo-v52-products-grid", "oo-v52-products-empty", "oo-v52-benefits"].forEach(function (id) {
    ids[id] = new FakeNode("div");
  });
  var opened = [];
  var doc = {
    ids: ids,
    opened: opened,
    createElement: function (tag) { return new FakeNode(tag); },
    getElementById: function (id) { return ids[id] || null; },
    addEventListener: function () {},
    defaultView: {
      open: function (url, target) { opened.push({ url: url, target: target }); return { focus: function () {} }; }
    }
  };
  return doc;
}

function profile(overrides) {
  return Object.assign({
    localId: "rx-1",
    status: "ready",
    configId: CONFIG_A,
    label: "James",
    displayLabel: "James",
    recommendedRight: -2.5,
    recommendedLeft: -2
  }, overrides || {});
}

function renderCards(activeProfile) {
  var doc = fakeDocument();
  Products.mount(doc, {
    getActivePrescription: function () { return activeProfile; },
    getPrescriptionProfiles: function () { return [activeProfile]; },
    setActivePrescription: function () {}
  });
  var cards = doc.ids["oo-v52-products-grid"].children;
  return { doc: doc, cards: cards };
}

function byClass(node, className) {
  return descendants(node).filter(function (child) { return child.classList.contains(className); });
}

test("result cards render View Your Rx Match with the supporting copy and no Add Mask Only", function () {
  var rendered = renderCards(profile());
  assert.ok(rendered.cards.length > 0);
  rendered.cards.forEach(function (card) {
    var buttons = descendants(card).filter(function (node) { return node.tagName === "BUTTON" && /product-card__/.test(node.className); });
    assert.deepEqual(buttons.map(function (b) { return b.textContent; }), ["View Your Rx Match"]);
    assert.equal(byClass(card, "oo-v52-product-card__cart").length, 0);
    var notes = byClass(card, "oo-v52-product-card__carry-note");
    assert.equal(notes.length, 1);
    assert.equal(notes[0].textContent, "Your recommended lenses will be carried over.");
    assert.equal(descendants(card).some(function (n) { return /Customize & Add|Add Mask Only/.test(n.textContent); }), false);
  });
});

test("unsaved prescriptions keep the CTA disabled without the carry-over promise", function () {
  var rendered = renderCards(profile({ status: "unsaved", configId: null }));
  rendered.cards.forEach(function (card) {
    assert.equal(byClass(card, "oo-v52-product-card__customize")[0].disabled, true);
    assert.equal(byClass(card, "oo-v52-product-card__carry-note").length, 0);
  });
});

test("View Your Rx Match opens the selected variant with oo_rx and oo_source only", function () {
  var rendered = renderCards(profile());
  var card = rendered.cards[0];
  byClass(card, "oo-v52-product-card__customize")[0].click();
  assert.equal(rendered.doc.opened.length, 1);
  var url = new URL(rendered.doc.opened[0].url);
  assert.equal(rendered.doc.opened[0].target, "_blank");
  assert.equal(url.origin, "https://oceansoptics.com");
  assert.match(url.searchParams.get("variant"), /^\d+$/);
  assert.equal(url.searchParams.get("oo_rx"), CONFIG_A);
  assert.equal(url.searchParams.get("oo_source"), "lens_calculator_v53");
  assert.deepEqual(Array.from(url.searchParams.keys()).sort(), ["oo_rx", "oo_source", "variant"]);
  assert.doesNotMatch(url.search, /2\.50|2\.00|James/);
});

test("oo_source is added only with a valid durable config and only for the allowlisted value", function () {
  var base = "https://oceansoptics.com/products/example?variant=123#options";
  var withSource = new URL(Products.buildProductDetailsUrl(base, CONFIG_A, "lens_calculator_v53"));
  assert.equal(withSource.searchParams.get("oo_source"), "lens_calculator_v53");
  assert.equal(withSource.hash, "#options");
  assert.equal(new URL(Products.buildProductDetailsUrl(base, CONFIG_A)).searchParams.get("oo_source"), null);
  assert.equal(new URL(Products.buildProductDetailsUrl(base, CONFIG_A, "anything-i-want")).searchParams.get("oo_source"), null);
  assert.equal(new URL(Products.buildProductDetailsUrl(base, "not-a-uuid", "lens_calculator_v53")).searchParams.get("oo_source"), null);
});

test("swatch selection is preserved into the outbound variant", function () {
  var near = Products.CATALOG.find(function (p) { return p.id === "obsidian-nearsighted"; });
  var red = Products.findVariant(near, "Red", "Clear");
  var url = new URL(Products.prepareProductPageUrl(profile(), near, red));
  assert.equal(url.searchParams.get("variant"), "52697208226125");
  assert.equal(url.searchParams.get("oo_source"), "lens_calculator_v53");
});

test("each confirmed prescription carries its own independent config UUID", function () {
  var near = Products.CATALOG.find(function (p) { return p.id === "obsidian-nearsighted"; });
  var variant = Products.defaultVariant(near);
  var a = new URL(Products.prepareProductPageUrl(profile(), near, variant));
  var b = new URL(Products.prepareProductPageUrl(profile({ configId: CONFIG_B }), near, variant));
  assert.equal(a.searchParams.get("oo_rx"), CONFIG_A);
  assert.equal(b.searchParams.get("oo_rx"), CONFIG_B);
  assert.notEqual(a.searchParams.get("oo_rx"), b.searchParams.get("oo_rx"));
});

test("processing stages follow the real upload work in order with no numeric progress", function () {
  assert.deepEqual(Object.keys(Rx.PROCESSING_STAGES), ["prepare", "upload", "read"]);
  assert.equal(Rx.processingStage("prepare").title, "Preparing your prescription…");
  assert.equal(Rx.processingStage("upload").title, "Uploading your prescription…");
  assert.equal(Rx.processingStage("read").title, "Reading your prescription…");
  assert.equal(Rx.processingStage("confirm"), null);
  Object.values(Rx.PROCESSING_STAGES).forEach(function (stage) {
    assert.doesNotMatch(stage.title + stage.copy, /\d+\s*%/);
  });
});

test("processing indicator shows only while busy with an upload stage", function () {
  assert.equal(Rx.showsProcessingIndicator("busy", "read"), true);
  assert.equal(Rx.showsProcessingIndicator("busy", undefined), false);
  ["success", "notice", "error"].forEach(function (kind) {
    assert.equal(Rx.showsProcessingIndicator(kind, "read"), false, kind);
  });
});

test("upload steps use the processing stages and manual saving does not", function () {
  var source = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-rx.js"), "utf8");
  assert.match(source, /async function initializeUpload\(\) \{\s+setProcessingStatus\("prepare"\)/);
  assert.match(source, /async function uploadFile\(\) \{\s+setProcessingStatus\("upload"\)/);
  assert.match(source, /async function processUpload\(\) \{\s+setProcessingStatus\("read"\)/);
  assert.match(source, /async function confirmPrescription\(payload, calculation\) \{\s+setStatus\("busy", "Saving your prescription\.\.\."/);
  assert.match(source, /setStatus\(kind, title, message, actions\) \{\s+actions = actions \|\| \{\};\s+setProcessingStage\(kind === "busy" \? actions\.processing : null\);/);
  assert.doesNotMatch(source, /Uploading securely/);
  assert.match(source, /role="progressbar" aria-label="Processing your prescription"/);
  assert.doesNotMatch(source, /aria-valuenow/);
  assert.match(source, /class="oo-v52-rx__processing-eyes"[^>]*aria-hidden="true"/);
});

test("crop preparation failures clear the processing state", function () {
  var source = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-rx.js"), "utf8");
  assert.match(source, /catch \(error\) \{\s+setProcessingStage\(null\);\s+elements\.status\.hidden = true;\s+showReviewError/);
});

test("reduced motion removes lens spinning and keeps non-moving progress feedback", function () {
  var css = fs.readFileSync(path.join(__dirname, "lens-calculator-v52.css"), "utf8");
  var block = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(block, /\.oo-v52-rx__processing-ring,\s+\.oo-v52-rx__processing-pupil \{\s+animation: none;/);
  assert.match(block, /\.oo-v52-rx__processing-bar-fill \{[^}]*animation: oo-v53-progress-pulse/);
  assert.doesNotMatch(block, /progress-slide|lens-focus|converge/);
});
