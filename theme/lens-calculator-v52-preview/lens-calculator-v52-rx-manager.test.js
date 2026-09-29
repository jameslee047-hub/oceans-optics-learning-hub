"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var Rx = require("./lens-calculator-v52-rx.js");
var Products = require("./lens-calculator-v52-products.js");

var CONFIG_A = "8d87cb67-254b-4377-a1f1-7a53e9f84482";
var CONFIG_B = "298b6d58-6366-4182-8d5a-97a920212834";
var rxSource = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-rx.js"), "utf8");

function profileInput(configId, label, right, left) {
  return { configId: configId, label: label, source: "manual", confirmedRx: {}, recommendationStrategy: "balanced", recommendedRight: right, recommendedLeft: left, labelEditToken: "token-" + configId };
}

["index.html", "lens-calculator-v52-preview.html"].forEach(function (file) {
  test(file + " has one Prescription Manager with heading, hint, tabs, add action and status", function () {
    var html = fs.readFileSync(path.join(__dirname, file), "utf8");
    assert.match(html, /<section class="oo-v52-profiles" id="oo-v52-profiles" aria-label="Your prescriptions" hidden>/);
    assert.match(html, /<div class="oo-v52-profiles__header" id="oo-v52-profiles-header" hidden>\s+<h2 class="oo-v52-profiles__title">Your prescriptions<\/h2>\s+<p class="oo-v52-profiles__hint">Rename them if it helps you tell them apart\.<\/p>/);
    assert.match(html, /<div class="oo-v52-profiles__row">\s+<div class="oo-v52-profiles__tabs" id="oo-v52-profile-tabs"><\/div>\s+<button class="oo-v52-profiles__add" id="oo-v52-add-prescription" type="button">\+ Add prescription<\/button>/);
    assert.match(html, /id="oo-v52-profiles-status" role="status" hidden/);
    assert.doesNotMatch(html, /Add another prescription/);
  });
});

test("manager appears only with two or more prescriptions; one prescription stays simple", function () {
  assert.match(rxSource, /function isManagingPrescriptions\(\) \{\s+return profileStore\.getAll\(\)\.length >= 2;/);
  assert.match(rxSource, /var managed = profiles\.length >= 2;\s+elements\.profileManager\.hidden = profiles\.length === 0;/);
  assert.match(rxSource, /elements\.profileHeader\.hidden = !managed;\s+elements\.profileTabs\.hidden = !managed;/);
  assert.match(rxSource, /if \(!managed\) \{\s+state\.tabEditingId = null;\s+return;/);
});

test("rename lives in each tab and the duplicate confirmed heading is hidden when managing", function () {
  assert.match(rxSource, /rename\.setAttribute\("aria-label", "Rename " \+ profile\.displayLabel\);/);
  assert.match(rxSource, /if \(internal && internal\.labelEditToken\) \{/);
  assert.match(rxSource, /elements\.labelConfirmed\.hidden = isManagingPrescriptions\(\);/);
  assert.match(rxSource, /button\.setAttribute\("aria-pressed", String\(isActive\)\);/);
  assert.doesNotMatch(rxSource, /Add another prescription/);
});

test("inline rename saves through the durable label endpoint and supports keyboard save and cancel", function () {
  assert.match(rxSource, /save\.textContent = "Save";/);
  assert.match(rxSource, /cancel\.textContent = "Cancel";/);
  assert.match(rxSource, /input\.maxLength = 60;/);
  assert.match(rxSource, /if \(event\.key === "Enter"\) \{\s+event\.preventDefault\(\);\s+saveTabRename\(profile\.localId\);/);
  assert.match(rxSource, /else if \(event\.key === "Escape"\) \{\s+event\.preventDefault\(\);\s+cancelTabRename\(profile\.localId\);/);
  assert.match(rxSource, /nextLabel = normalizePrescriptionLabel\(input\.value\);/);
  assert.match(rxSource, /await transport\.rename\(internal\.configId, internal\.labelEditToken, nextLabel\);\s+var renamed = profileStore\.rename\(id, nextLabel\);/);
  assert.match(rxSource, /input\.focus\(\{ preventScroll: true \}\);\s+input\.select\(\);/);
  assert.match(rxSource, /focusProfileControl\(id, "oo-v52-profiles__rename"\);\s+emitPrescriptionChanged\(\);/);
});

test("store keeps independent configs and labels; blank names fall back to Prescription N", function () {
  var store = Rx.createProfileStore();
  var a = store.add(profileInput(CONFIG_A, "", -2, -1.5));
  var b = store.add(profileInput(CONFIG_B, "", -3.5, -3));
  var c = store.add(profileInput("11111111-2222-4333-8444-555555555555", "", -1, -1));
  assert.deepEqual(store.getAll().map(function (p) { return p.displayLabel; }), ["Prescription 1", "Prescription 2", "Prescription 3"]);
  store.rename(a.localId, "  My Rx  ");
  store.rename(b.localId, "Partner Rx");
  assert.deepEqual(store.getAll().map(function (p) { return [p.displayLabel, p.configId]; }), [["My Rx", CONFIG_A], ["Partner Rx", CONFIG_B], ["Prescription 3", c.configId]]);
  store.rename(a.localId, "   ");
  assert.equal(store.getRecord(a.localId).displayLabel, "Prescription 1");
  assert.equal(store.getRecord(a.localId).label, null);
  assert.equal(store.getRecord(b.localId).configId, CONFIG_B);
  assert.throws(function () { store.rename(b.localId, "x".repeat(61)); });
  assert.equal(store.getRecord(b.localId).displayLabel, "Partner Rx");
});

function FakeNode(tag) {
  this.tagName = String(tag).toUpperCase(); this.children = []; this.className = ""; this.textContent = ""; this.hidden = false; this.disabled = false;
  this.dataset = {}; this.style = {}; this.attributes = {}; this.listeners = {};
  var node = this;
  this.classList = {
    toggle: function (name, force) { var l = node.className.split(/\s+/).filter(Boolean); var has = l.indexOf(name) >= 0; var want = force === undefined ? !has : Boolean(force); if (want && !has) l.push(name); if (!want && has) l.splice(l.indexOf(name), 1); node.className = l.join(" "); return want; },
    contains: function (name) { return node.className.split(/\s+/).indexOf(name) >= 0; }
  };
}
FakeNode.prototype.appendChild = function (c) { this.children.push(c); return c; };
FakeNode.prototype.setAttribute = function (n, v) { this.attributes[n] = String(v); };
FakeNode.prototype.getAttribute = function (n) { return this.attributes[n] || null; };
FakeNode.prototype.addEventListener = function (t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); };
FakeNode.prototype.click = function () { (this.listeners.click || []).forEach(function (f) { f({}); }); };
Object.defineProperty(FakeNode.prototype, "innerHTML", { set: function () { this.children = []; } });
function all(node) { return node.children.reduce(function (a, c) { return a.concat([c], all(c)); }, []); }

test("recommendations use saved labels and 'View mask matches for:' switches the active prescription", function () {
  var ids = {};
  ["oo-v52-products", "oo-v52-products-title", "oo-v52-products-switcher", "oo-v52-products-grid", "oo-v52-products-empty", "oo-v52-benefits"].forEach(function (id) { ids[id] = new FakeNode("div"); });
  var doc = { createElement: function (t) { return new FakeNode(t); }, getElementById: function (id) { return ids[id] || null; }, addEventListener: function () {}, defaultView: { open: function () { return { focus: function () {} }; } } };
  var profiles = [
    { localId: "prescription-1", status: "ready", configId: CONFIG_A, label: "My Rx", displayLabel: "My Rx", recommendedRight: -2, recommendedLeft: -1.5 },
    { localId: "prescription-2", status: "ready", configId: CONFIG_B, label: "Partner Rx", displayLabel: "Partner Rx", recommendedRight: -3.5, recommendedLeft: -3 }
  ];
  var active = profiles[1];
  var requested = [];
  Products.mount(doc, {
    getActivePrescription: function () { return active; },
    getPrescriptionProfiles: function () { return profiles; },
    setActivePrescription: function (id) { requested.push(id); }
  });
  assert.equal(ids["oo-v52-products-title"].textContent, "Recommended masks for Partner Rx");
  var switcher = ids["oo-v52-products-switcher"];
  assert.equal(switcher.hidden, false);
  var nodes = all(switcher);
  assert.equal(nodes[0].textContent, "View mask matches for:");
  assert.equal(nodes.some(function (n) { return n.textContent === "Recommendations for:"; }), false);
  var buttons = nodes.filter(function (n) { return n.tagName === "BUTTON"; });
  assert.deepEqual(buttons.map(function (b) { return [b.textContent, b.getAttribute("aria-pressed")]; }), [["My Rx", "false"], ["Partner Rx", "true"]]);
  buttons[0].click();
  assert.deepEqual(requested, ["prescription-1"]);
});

test("product handoff for each prescription carries its own config", function () {
  var near = Products.CATALOG.find(function (p) { return p.id === "obsidian-nearsighted"; });
  var v = Products.defaultVariant(near);
  var a = new URL(Products.prepareProductPageUrl({ status: "ready", configId: CONFIG_A, recommendedRight: -2, recommendedLeft: -1.5 }, near, v));
  var b = new URL(Products.prepareProductPageUrl({ status: "ready", configId: CONFIG_B, recommendedRight: -3.5, recommendedLeft: -3 }, near, v));
  assert.equal(a.searchParams.get("oo_rx"), CONFIG_A);
  assert.equal(b.searchParams.get("oo_rx"), CONFIG_B);
});

test("manager styles wrap on narrow screens and mark the active tab beyond colour", function () {
  var css = fs.readFileSync(path.join(__dirname, "lens-calculator-v52.css"), "utf8");
  assert.match(css, /\.oo-v52-profiles__row \{\s+display: flex;\s+flex-wrap: wrap;/);
  assert.match(css, /\.oo-v52-profiles__tab\[aria-pressed="true"\]::before \{\s+content: "\\2713\\00a0";/);
  assert.match(css, /\.oo-v52-profiles__tab-group \.oo-v52-profiles__tab \{[^}]*text-overflow: ellipsis;/);
  assert.match(css, /\.oo-v52-profiles__add \{[^}]*border: 1\.5px solid var\(--oo-orange\);/);
});
