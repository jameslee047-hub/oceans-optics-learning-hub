"use strict";

// Main Calculator vs Product Rx Checker parity for the V5.3 customer
// experience: the same option values, Recommended strategy, initial selected
// strategy, customer-facing labels and copy, selection evidence and handoff
// pair, from the real sections and scripts in jsdom. The Quiz holds itself to
// the same shared module (oceans-optics-face-fit v53CustomerExperienceParity).

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

var ASSETS = path.join(__dirname, "base", "assets");
var CONFIG_ID = "7adf6f8a-1f62-4e2e-9d06-5f5348997a43";
var JSDOM = null;
try { JSDOM = require("jsdom").JSDOM; } catch (error) { JSDOM = null; }
var skipDom = JSDOM ? false : "jsdom is not installed";

function section(file, replacements) {
  var html = fs.readFileSync(path.join(__dirname, "base", "sections", file), "utf8")
    .replace(/\{%\s*schema\s*%\}[\s\S]*?\{%\s*endschema\s*%\}/, "")
    .replace(/<script[\s\S]*?<\/script>/g, "");
  (replacements || []).forEach(function (r) { html = html.replace(r[0], r[1]); });
  return html.replace(/\{\{[^}]*\}\}/g, "").replace(/\{%[^%]*%\}/g, "");
}

function load(html, url, scripts, extra) {
  var dom = new JSDOM("<!doctype html><body>" + html + "</body>", { runScripts: "outside-only", pretendToBeVisual: true, url: url });
  var win = dom.window;
  var calls = [];
  var applied = [];
  var opened = [];
  win.HTMLElement.prototype.scrollIntoView = function () {};
  win.fetch = function (requestUrl, init) {
    var body = init && init.body ? JSON.parse(init.body) : null;
    calls.push({ url: String(requestUrl), body: body });
    var data = /\/manual\/init$/.test(requestUrl) ? { configId: CONFIG_ID, editToken: "edit", labelEditToken: "label" } : { ok: true };
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(data); } });
  };
  win.open = function () { var popup = { location: { href: "" }, close: function () {}, focus: function () {} }; opened.push(popup); return popup; };
  win.OOSourceJourney = { record: function () { return null; } };
  win.OORxProductHandoff = {
    waitForAvisControls: function () { return Promise.resolve({}); },
    applyConfirmedHandoff: function (doc, controls, summary) { applied.push(summary); return summary; }
  };
  scripts.forEach(function (file) { win.eval(fs.readFileSync(path.join(ASSETS, file), "utf8")); });
  var page = { win: win, doc: win.document, calls: calls, applied: applied, opened: opened };
  return new Promise(function (resolve) {
    if (win.document.readyState !== "loading") resolve(page);
    else win.document.addEventListener("DOMContentLoaded", function () { resolve(page); }, { once: true });
  });
}

var CORE = ["base", "engine", "high-cyl", "midpoint"].map(function (n) { return "oo-lens-calculator-v53-" + n + ".js"; });

function loadMain() {
  return load(section("oo-lens-calculator-v53.liquid"), "https://oceansoptics.com/pages/lens-page",
    CORE.concat(["oo-lens-calculator-v53-ui.js", "oo-lens-calculator-v53-rx.js", "oo-lens-calculator-v53-products.js"]));
}

function loadChecker(handle) {
  return load(section("oo-product-rx-checker-v53.liquid", [["{{ product.handle | escape }}", handle], [/\{\{\s*section\.id\s*\}\}/g, "test"]]),
    "https://oceansoptics.com/products/" + handle,
    CORE.concat(["oo-lens-calculator-v53-rx.js", "oo-lens-calculator-v53-products.js", "oo-product-rx-checker-v53.js"]));
}

function settle() { return new Promise(function (resolve) { setTimeout(resolve, 20); }); }
function change(node) { node.dispatchEvent(new node.ownerDocument.defaultView.Event("change", { bubbles: true })); }
function clean(text) { return text.replace(/\s+/g, " ").trim(); }

function setMainEye(doc, side, sphere, cylinder, axis) {
  var eye = doc.querySelector('[data-eye="' + side + '"]');
  [["sphere", sphere], ["cylinder", cylinder || 0]].forEach(function (entry) {
    var magnitude = Math.abs(entry[1]);
    var sign = eye.querySelector('.oo-v52__sign[data-field="' + entry[0] + '"]');
    if (entry[0] === "sphere" || magnitude) { var want = entry[1] < 0 ? "-" : "+"; while (sign.dataset.sign !== want) sign.click(); }
    var integer = eye.querySelector('.oo-v52__integer[data-field="' + entry[0] + '"]');
    var fraction = eye.querySelector('.oo-v52__fraction[data-field="' + entry[0] + '"]');
    integer.value = String(Math.floor(magnitude)); change(integer);
    fraction.value = String(Math.round((magnitude % 1) * 100)).padStart(2, "0"); change(fraction);
  });
  if (cylinder) { var a = eye.querySelector('.oo-v52__axis[data-field="axis"]'); a.value = String(axis || 90); change(a); }
}

function setCheckerEye(page, side, sphere, cylinder, axis) {
  var scope = page.doc.querySelector('[data-eye="' + side + '"]');
  var sign = scope.querySelector("[data-sphere-sign]");
  var magnitude = Math.abs(sphere);
  if (magnitude) { var want = sphere < 0 ? "-" : "+"; while (sign.dataset.sign !== want) sign.click(); }
  var whole = scope.querySelector("[data-sphere-int]"); whole.value = String(Math.floor(magnitude)); change(whole);
  var frac = scope.querySelector("[data-sphere-frac]"); frac.value = String(Math.round((magnitude % 1) * 100)).padStart(2, "0"); change(frac);
  var mag = scope.querySelector("[data-cyl-mag]"); mag.value = Math.abs(cylinder || 0).toFixed(2); change(mag);
  if (cylinder) {
    var cylSign = scope.querySelector("[data-cyl-sign]"); var wantCyl = cylinder < 0 ? "-" : "+";
    while (cylSign.dataset.sign !== wantCyl) cylSign.click();
    var axisSelect = scope.querySelector('[data-field="axis"]'); axisSelect.value = String(axis || 90); change(axisSelect);
  }
}

// Customer-visible state of each surface, normalised to the same shape.
function mainState(page) {
  var cards = Array.prototype.map.call(page.doc.querySelectorAll("#oo-v52-midpoint .oo-v52-high-cyl__choice"), function (choice) {
    var input = choice.querySelector("input");
    var strategy = input.value === "balanced" ? "balanced" : "closer_to_sph";
    var prefix = input.value === "balanced" ? "balanced" : "sharper";
    return {
      strategy: strategy,
      checked: input.checked,
      title: clean(choice.querySelector(".oo-v52-high-cyl__option-title").childNodes[0].textContent),
      badge: clean((choice.querySelector(".oo-v52-high-cyl__badge") || { textContent: "" }).textContent),
      copy: clean(choice.querySelector(".oo-v52-high-cyl__copy").textContent),
      pair: [page.doc.getElementById("oo-v52-midpoint-" + prefix + "-right").textContent, page.doc.getElementById("oo-v52-midpoint-" + prefix + "-left").textContent]
    };
  });
  return { cards: cards, expectation: clean(page.doc.querySelector("#oo-v52-explain .oo-rx-expect__copy").textContent), why: clean(page.doc.getElementById("oo-v52-why").textContent) };
}

function checkerState(page) {
  var container = page.doc.querySelector("[data-oo-product-rx-checker]");
  var cards = Array.prototype.map.call(container.querySelectorAll(".oo-rx-checker__choice"), function (card) {
    var title = card.querySelector(".oo-rx-checker__choice-title");
    return {
      strategy: card.dataset.strategy === "balanced" ? "balanced" : "closer_to_sph",
      checked: card.querySelector("input").checked,
      title: clean(title.childNodes[0].textContent),
      badge: clean((title.querySelector(".oo-rx-checker__choice-badge") || { textContent: "" }).textContent),
      copy: clean(card.querySelector(".oo-rx-checker__choice-copy").textContent),
      pair: Array.prototype.map.call(card.querySelectorAll(".oo-rx-checker__choice-eye-value"), function (n) { return n.textContent; })
    };
  });
  return { cards: cards, expectation: clean(container.querySelector(".oo-rx-expect__copy").textContent), why: clean(container.querySelector(".oo-rx-why").textContent) };
}

var FIXTURES = [
  { name: "exact fixture +4.00/-2.00 x075, +3.00/-1.25 x110", right: [4, -2, 75], left: [3, -1.25, 110], handle: "rx-obsidian-farsighted-prescription-snorkel-scuba-dive-mask", balanced: ["+3.00", "+2.00"], alternative: ["+4.00", "+3.00"] },
  { name: "#336262", right: [-1, -0.75, 170], left: [-1.75, 0], handle: "the-rx-obsidian-prescription-mask-for-scuba-dive-snorkeling", balanced: ["-1.00", "-1.00"], alternative: ["-1.00", "-1.50"] },
  { name: "#336254", right: [4, -0.75, 100], left: [4.25, -0.75, 105], handle: "rx-obsidian-farsighted-prescription-snorkel-scuba-dive-mask", balanced: ["+3.00", "+3.00"], alternative: ["+4.00", "+4.00"] },
  { name: "#336246", right: [-3.5, -2, 10], left: [-5, -1.5, 175], handle: "the-rx-obsidian-prescription-mask-for-scuba-dive-snorkeling", balanced: ["-4.00", "-5.00"], alternative: ["-4.00", "-5.50"] }
];

FIXTURES.forEach(function (fixture) {
  test("parity " + fixture.name + ": Main Calculator and Product Calculator show the same cards, default, copy, evidence and handoff pair", { skip: skipDom }, async function () {
    var main = await loadMain();
    setMainEye(main.doc, "right", fixture.right[0], fixture.right[1], fixture.right[2]);
    setMainEye(main.doc, "left", fixture.left[0], fixture.left[1], fixture.left[2]);
    main.doc.getElementById("oo-v52-form").dispatchEvent(new main.win.Event("submit", { cancelable: true }));
    await settle();

    var checker = await loadChecker(fixture.handle);
    setCheckerEye(checker, "right", fixture.right[0], fixture.right[1], fixture.right[2]);
    setCheckerEye(checker, "left", fixture.left[0], fixture.left[1], fixture.left[2]);
    checker.doc.querySelector("[data-checker-form]").dispatchEvent(new checker.win.Event("submit", { cancelable: true }));
    await settle();

    var m = mainState(main);
    var c = checkerState(checker);
    assert.deepEqual(m.cards.map(function (card) { return [card.strategy, card.checked, card.title, card.badge, card.pair]; }), [
      ["balanced", true, "Balanced", "Recommended", fixture.balanced],
      ["closer_to_sph", false, "Alternative", "", fixture.alternative]
    ]);
    assert.deepEqual(c.cards, m.cards, "the Product Calculator matches the Main Calculator exactly");
    assert.equal(c.expectation, m.expectation);
    assert.equal(c.why, m.why);

    // Switch both to the Alternative and back.
    main.doc.getElementById("oo-v52-midpoint-sharper").click();
    checker.doc.querySelector('.oo-rx-checker__choice:not([data-strategy="balanced"]) input').click();
    await settle();
    m = mainState(main);
    c = checkerState(checker);
    assert.deepEqual(m.cards.map(function (card) { return [card.checked, card.badge]; }), [[false, "Recommended"], [true, ""]]);
    assert.deepEqual(c.cards, m.cards);
    assert.equal(c.expectation, m.expectation);
    assert.equal(checker.doc.querySelector("[data-oo-product-rx-checker]").ooRxChecker.state.calculation.selectionEvidence, "customer_explicit");

    main.doc.getElementById("oo-v52-midpoint-balanced").click();
    checker.doc.querySelector('.oo-rx-checker__choice[data-strategy="balanced"] input').click();
    await settle();
    assert.deepEqual(checkerState(checker).cards, mainState(main).cards);
    assert.equal(checker.doc.querySelector("[data-oo-product-rx-checker]").ooRxChecker.state.calculation.selectionEvidence, "customer_explicit");

    main.doc.getElementById("oo-v52-midpoint-sharper").click();
    checker.doc.querySelector('.oo-rx-checker__choice:not([data-strategy="balanced"]) input').click();
    await settle();
    main.doc.querySelector(".oo-v52-product-card__customize").click();
    checker.doc.querySelector(".oo-rx-checker__apply").click();
    await settle();
    await settle();
    var mainConfirm = main.calls.filter(function (call) { return /\/confirm$/.test(call.url); })[0].body;
    var checkerConfirm = checker.calls.filter(function (call) { return /\/confirm$/.test(call.url); })[0].body;
    var alternative = fixture.alternative.map(Number);
    assert.deepEqual([mainConfirm.recommendationStrategy, mainConfirm.recommendedRight, mainConfirm.recommendedLeft], ["closer_to_sph"].concat(alternative));
    assert.deepEqual([checkerConfirm.recommendationStrategy, checkerConfirm.recommendedRight, checkerConfirm.recommendedLeft], ["closer_to_sph"].concat(alternative));
    assert.deepEqual([checker.applied[0].recommendedRight, checker.applied[0].recommendedLeft], alternative, "the product handoff uses the selected pair");
    assert.deepEqual(mainConfirm.v53Snapshot.optionsShown, {
      closer_to_sph: { right: fixture.alternative[0], left: fixture.alternative[1] },
      balanced: { right: fixture.balanced[0], left: fixture.balanced[1] }
    });
    assert.equal(mainConfirm.v53Snapshot.recommendedStrategy, "balanced");
    assert.equal(mainConfirm.v53Snapshot.selectedStrategy, "closer_to_sph");
    assert.equal(mainConfirm.v53Snapshot.selectionEvidence, "customer_explicit");
  });
});
