"use strict";

// V5.3 Product Rx Checker page flow: shared second-option cards, product
// buildability, multiple named prescriptions, edit invalidation and save
// timing ("Use these lenses for this mask" is the only save). Runs the real
// section and scripts in jsdom and is skipped when jsdom is not available
// (NODE_PATH=/path/to/node_modules node --test theme/).

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

var ASSETS = path.join(__dirname, "base", "assets");
var SECTION = path.join(__dirname, "base", "sections", "oo-product-rx-checker-v53.liquid");
var CONFIG_ID = "7adf6f8a-1f62-4e2e-9d06-5f5348997a43";
var HANDLES = {
  obsidian: "the-rx-obsidian-prescription-mask-for-scuba-dive-snorkeling",
  farsighted: "rx-obsidian-farsighted-prescription-snorkel-scuba-dive-mask",
  lumix: "professional-apollo-like-corrective-scuba-goggles-diving-aluminium-rx-optical-dive-mask-with-diopter-strength-from-1-5-to-6-0"
};

var JSDOM = null;
try { JSDOM = require("jsdom").JSDOM; } catch (error) { JSDOM = null; }
var skipDom = JSDOM ? false : "jsdom is not installed";

function sectionHtml(handle) {
  return fs.readFileSync(SECTION, "utf8")
    .replace(/\{%\s*schema\s*%\}[\s\S]*?\{%\s*endschema\s*%\}/, "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace("{{ product.handle | escape }}", handle)
    .replace(/\{\{\s*section\.id\s*\}\}/g, "test")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/\{%[^%]*%\}/g, "");
}

function loadChecker(handle) {
  var dom = new JSDOM("<!doctype html><body>" + sectionHtml(handle) + "</body>", {
    runScripts: "outside-only",
    pretendToBeVisual: true,
    url: "https://oceansoptics.com/products/" + handle
  });
  var win = dom.window;
  var calls = [];
  var applied = [];
  var journey = [];
  var initCount = 0;
  win.HTMLElement.prototype.scrollIntoView = function () {};
  win.fetch = function (url, init) {
    var body = init && init.body ? JSON.parse(init.body) : null;
    calls.push({ url: String(url), body: body });
    var data = { ok: true };
    if (/\/manual\/init$/.test(url)) {
      initCount += 1;
      data = { configId: CONFIG_ID, editToken: "edit-" + initCount };
    }
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(data); } });
  };
  win.OOSourceJourney = { record: function (source) { journey.push(source); return null; } };
  win.OORxProductHandoff = {
    waitForAvisControls: function () { return Promise.resolve({}); },
    applyConfirmedHandoff: function (doc, controls, summary, source) { applied.push({ summary: summary, source: source }); return summary; }
  };
  ["base", "engine", "high-cyl", "midpoint", "rx", "products"].forEach(function (name) {
    win.eval(fs.readFileSync(path.join(ASSETS, "oo-lens-calculator-v53-" + name + ".js"), "utf8"));
  });
  win.eval(fs.readFileSync(path.join(ASSETS, "oo-product-rx-checker-v53.js"), "utf8"));
  var page = { win: win, doc: win.document, calls: calls, applied: applied, journey: journey };
  page.container = win.document.querySelector("[data-oo-product-rx-checker]");
  if (win.document.readyState !== "loading") return Promise.resolve(page);
  return new Promise(function (resolve) {
    win.document.addEventListener("DOMContentLoaded", function () { resolve(page); }, { once: true });
  });
}

function change(node) {
  node.dispatchEvent(new node.ownerDocument.defaultView.Event("change", { bubbles: true }));
}

function setEye(page, side, sphere, cylinder, axis) {
  var scope = page.doc.querySelector('[data-eye="' + side + '"]');
  var sphereSign = scope.querySelector("[data-sphere-sign]");
  var magnitude = Math.abs(sphere);
  var want = sphere < 0 ? "-" : "+";
  if (magnitude) while (sphereSign.dataset.sign !== want) sphereSign.click();
  var whole = scope.querySelector("[data-sphere-int]");
  var fraction = scope.querySelector("[data-sphere-frac]");
  whole.value = String(Math.floor(magnitude));
  change(whole);
  fraction.value = String(Math.round((magnitude % 1) * 100)).padStart(2, "0");
  change(fraction);
  var cyl = cylinder || 0;
  var cylMag = scope.querySelector("[data-cyl-mag]");
  cylMag.value = Math.abs(cyl).toFixed(2);
  change(cylMag);
  if (cyl) {
    var cylSign = scope.querySelector("[data-cyl-sign]");
    var wantCyl = cyl < 0 ? "-" : "+";
    while (cylSign.dataset.sign !== wantCyl) cylSign.click();
    var axisSelect = scope.querySelector('[data-field="axis"]');
    axisSelect.value = String(axis || 90);
    change(axisSelect);
  }
}

function check(page, right, left) {
  setEye(page, "right", right[0], right[1], right[2]);
  setEye(page, "left", left[0], left[1], left[2]);
  page.doc.querySelector("[data-checker-form]").dispatchEvent(new page.win.Event("submit", { cancelable: true }));
}

function settle() {
  return new Promise(function (resolve) { setTimeout(resolve, 20); });
}

function cards(page) {
  return Array.prototype.map.call(page.container.querySelectorAll(".oo-rx-checker__choice"), function (card) {
    var values = Array.prototype.map.call(card.querySelectorAll(".oo-rx-checker__choice-eye-value"), function (node) { return node.textContent; });
    return card.dataset.strategy + " " + values.join("/");
  });
}

// The selected option card (or the single recommendation card) is the only
// place the recommended pair is shown.
function shownPair(page) {
  var checked = page.container.querySelector(".oo-rx-checker__choice-input:checked");
  var card = checked ? checked.parentNode : page.container.querySelector(".oo-rx-checker__choice-card--single");
  if (!card) return "";
  return Array.prototype.map.call(card.querySelectorAll(".oo-rx-checker__choice-eye-value"), function (node) { return node.textContent; }).join("/");
}

function choose(page, strategy) {
  page.container.querySelector('.oo-rx-checker__choice[data-strategy="' + strategy + '"] input').click();
}

function confirms(page) {
  return page.calls.filter(function (call) { return /\/confirm$/.test(call.url); });
}

function apply(page) {
  page.container.querySelector(".oo-rx-checker__apply").click();
}

function checkedStrategy(page) {
  var input = page.container.querySelector(".oo-rx-checker__choice-input:checked");
  return input ? input.value : null;
}

// Result first: option cards, then "What to expect underwater", then the two
// collapsed accordions ("Why ...", then "See how we calculated this").
function assertResultFirstOrder(root, cardsSelector) {
  var cards = root.querySelector(cardsSelector);
  var expect = root.querySelector(".oo-rx-expect");
  var accordions = Array.prototype.slice.call(root.querySelectorAll(".oo-rx-explain details"));
  assert.ok(cards, "cards rendered");
  assert.deepEqual(accordions.map(function (d) { return d.querySelector("summary").textContent.trim(); }),
    ["Why are my mask lenses different from my glasses?", "See how we calculated this"]);
  accordions.forEach(function (d) { assert.equal(d.open, false, "accordions start collapsed"); });
  var sequence = [cards, expect].concat(accordions).filter(Boolean);
  for (var i = 1; i < sequence.length; i += 1) {
    assert.ok(sequence[i - 1].compareDocumentPosition(sequence[i]) & 4, "information order " + i);
  }
  var whyBody = Array.prototype.map.call(accordions[0].querySelectorAll(".oo-rx-explain__copy"), function (p) { return p.textContent; });
  assert.deepEqual(whyBody, [
    "Underwater, your mask and the water make things look bigger and closer, a little like zooming in.",
    "Because of this, you usually do not need quite as much prescription correction as you do on land.",
    "We adjust your prescription for this underwater effect, then choose the closest available lens for your mask."
  ]);
  return { cards: cards, expect: expect, accordions: accordions };
}

function cardTitles(page) {
  return Array.prototype.map.call(page.container.querySelectorAll(".oo-rx-checker__choice-title"), function (node) {
    return node.textContent.replace(/\s+/g, " ").trim();
  });
}

test("J. checker -7 case: nearest Balanced -7.00/-8.00 leads; printed-SPH Alternative -7.00/-7.50 remains optional", { skip: skipDom }, async function () {
  var page = await loadChecker(HANDLES.obsidian);
  check(page, [-7, -0.75, 15], [-7.75, -1.25, 166]);
  await settle();
  assert.deepEqual(cards(page), ["balanced -7.00/-8.00", "closer_to_sph -7.00/-7.50"]);
  assert.deepEqual(cardTitles(page), ["BalancedRecommended", "Alternative"]);
  assert.equal(checkedStrategy(page), "balanced");
  assert.equal(shownPair(page), "-7.00/-8.00");
  choose(page, "closer_to_sph");
  await settle();
  assert.equal(shownPair(page), "-7.00/-7.50");
  assert.deepEqual(cardTitles(page), ["BalancedRecommended", "Alternative"], "Balanced keeps its badge while the Alternative is selected");
  choose(page, "balanced");
  await settle();
  choose(page, "closer_to_sph");
  await settle();
  assert.equal(page.calls.length, 0, "switching options never saves");
  apply(page);
  await settle();
  var saved = confirms(page);
  assert.equal(saved.length, 1);
  assert.deepEqual([saved[0].body.recommendationStrategy, saved[0].body.recommendedRight, saved[0].body.recommendedLeft], ["closer_to_sph", -7, -7.5]);
  assert.equal(page.applied.length, 1);
  assert.equal(page.applied[0].source, "product_rx_checker");
  assert.equal(page.applied[0].summary.recommendedRight, -7);
  assert.equal(page.applied[0].summary.recommendedLeft, -7.5);
  assert.deepEqual(page.journey, ["product_rx_checker"]);
  assert.match(page.container.querySelector(".oo-rx-explain").textContent, /See how we calculated this/);
});

test("J. checker Daniel converges on nearest Balanced -3.50/-3.50", { skip: skipDom }, async function () {
  var page = await loadChecker(HANDLES.obsidian);
  check(page, [-3.75, -0.25, 35], [-3.5, -0.75, 175]);
  await settle();
  assert.deepEqual(cards(page), []);
  assert.equal(checkedStrategy(page), null);
  assert.equal(shownPair(page), "-3.50/-3.50");
  var explain = page.container.querySelector(".oo-rx-explain").textContent;
  assert.doesNotMatch(explain, /This is our recommended all round option\./);
  assert.equal(page.calls.length, 0);
  assert.deepEqual(page.journey, [], "automatic default selection is not a product click");
  apply(page);
  await settle();
  var saved = confirms(page);
  assert.equal(saved.length, 1);
  assert.deepEqual([saved[0].body.recommendationStrategy, saved[0].body.recommendedRight, saved[0].body.recommendedLeft], ["balanced", -3.5, -3.5]);
  assert.deepEqual(page.journey, ["product_rx_checker"]);
});

test("J. checker two-option minus case confirms its printed-SPH Alternative", { skip: skipDom }, async function () {
  var page = await loadChecker(HANDLES.obsidian);
  check(page, [-7, -0.75, 15], [-7.75, -1.25, 166]);
  await settle();
  choose(page, "closer_to_sph");
  await settle();
  assert.equal(shownPair(page), "-7.00/-7.50");
  apply(page);
  await settle();
  assert.deepEqual([confirms(page)[0].body.recommendationStrategy, confirms(page)[0].body.recommendedRight, confirms(page)[0].body.recommendedLeft], ["closer_to_sph", -7, -7.5]);
});

test("A/J. checker exact ties -2.25 / -1.75 (5.3.1): both resolve toward SE, one pair -2.00/-1.50, saved as balanced with no choice evidence", { skip: skipDom }, async function () {
  var page = await loadChecker(HANDLES.obsidian);
  check(page, [-2.25], [-1.75]);
  await settle();
  assert.deepEqual(cards(page), [], "converged: no option cards");
  assert.equal(shownPair(page), "-2.00/-1.50");
  apply(page);
  await settle();
  var body = confirms(page)[0].body;
  assert.deepEqual([body.recommendationStrategy, body.recommendedRight, body.recommendedLeft], ["balanced", -2, -1.5]);
  assert.equal(body.calculatorVersion, "5.3.2");
  var snapshot = JSON.parse(JSON.stringify(page.applied[0].summary.v53Snapshot));
  assert.deepEqual([snapshot.calculatorVersion, snapshot.optionsShown, snapshot.selectedStrategy, snapshot.selectionEvidence], ["5.3.2", null, null, null]);
});

test("UI: checker result has the heading, the why block, the cards, what to expect and one collapsed maths section", { skip: skipDom }, async function () {
  var page = await loadChecker(HANDLES.obsidian);
  check(page, [-7, -0.75, 15], [-7.75, -1.25, 166]);
  await settle();
  var result = page.container.querySelector("[data-checker-result]");
  var text = result.textContent;
  assert.equal(result.querySelector(".oo-rx-checker__suggested-title").textContent, "Suggested Lens Strength");
  assertResultFirstOrder(result, ".oo-rx-checker__choices");
  assert.ok(result.querySelector(".oo-rx-checker__suggested-title").compareDocumentPosition(result.querySelector(".oo-rx-checker__choices")) & 4, "cards follow the heading directly");
  assert.equal(result.querySelector(".oo-rx-why"), null, "no explanation block above the cards");
  assert.equal(result.querySelector(".oo-rx-checker__choice-intro"), null);
  assert.equal(result.querySelector(".oo-rx-checker__summary"), null, "no duplicate summary box");
  ["Your recommended lenses", "We recommend the first option", "How we calculated your lens strength",
    "Why is my mask lens different from my SPH?", "Closer Match", "Softer Option", "Sharper", "Comfort"].forEach(function (needle) {
    assert.equal(text.indexOf(needle), -1, "still rendered: " + needle);
  });
  var summaries = Array.prototype.map.call(result.querySelectorAll(".oo-rx-explain summary"), function (s) { return s.textContent.trim(); });
  assert.deepEqual(summaries, ["Why are my mask lenses different from my glasses?", "See how we calculated this"]);
  assert.equal(result.querySelectorAll(".oo-rx-expect").length, 1);
  assert.equal(result.querySelectorAll(".oo-rx-checker__choice-notice").length, 0, "no warning boxes");
  assert.equal(result.querySelector(".oo-rx-checker__strategy").getAttribute("aria-label"), "Choose the lens option you'd like us to use");

  // One option: a single recommendation card, no radio, no duplicate box.
  var single = await loadChecker(HANDLES.obsidian);
  check(single, [-3.75, -0.75, 90], [-3.75, -0.75, 90]);
  await settle();
  var singleResult = single.container.querySelector("[data-checker-result]");
  assert.equal(singleResult.querySelectorAll(".oo-rx-checker__choice-card--single").length, 1);
  assert.equal(singleResult.querySelectorAll(".oo-rx-checker__choice-input").length, 0);
  assert.equal(singleResult.querySelector(".oo-rx-checker__summary"), null);
  assert.equal(singleResult.querySelectorAll(".oo-rx-expect").length, 0, "nothing to choose, so no selected-option text");
  assert.equal(shownPair(single), "-3.50/-3.50");
  assert.match(singleResult.querySelector(".oo-rx-checker__choice-card--single").textContent, /Recommended/);
});

test("checker: the mask's own stock decides whether the second option is offered", { skip: skipDom }, async function () {
  // Lumix stocks -1.50 to -6.00. Nearest-stock Balanced is exact -6.00 here.
  var lumix = await loadChecker(HANDLES.lumix);
  check(lumix, [-6, -0.75, 90], [-6, -0.75, 90]);
  await settle();
  assert.deepEqual(cards(lumix), []);
  assert.equal(shownPair(lumix), "-6.00/-6.00");

  // -6.25/-6.25 (target -5.75) is an exact tie: 5.3.1 resolves it to -6.00,
  // which converges and is still buildable on Lumix.
  var tie = await loadChecker(HANDLES.lumix);
  check(tie, [-6.25], [-6.25]);
  await settle();
  assert.deepEqual(cards(tie), []);
  assert.equal(shownPair(tie), "-6.00/-6.00");
  assert.ok(tie.container.querySelector(".oo-rx-checker__apply"));

  // -6.75/-6.75 (target -6.25) is an exact tie that now resolves to -6.50,
  // beyond Lumix stock: the checker says so and offers masks that can build it.
  var capped = await loadChecker(HANDLES.lumix);
  check(capped, [-6.75], [-6.75]);
  await settle();
  assert.deepEqual(cards(capped), []);
  assert.equal(shownPair(capped), "-6.50/-6.50");
  assert.equal(capped.container.querySelector(".oo-rx-checker__apply"), null);
  assert.equal(capped.container.querySelector(".oo-rx-checker__notice").dataset.reason, "range");
  assert.ok(capped.container.querySelector('[data-catalog-product="obsidian-nearsighted"]'), "Obsidian (to -9.00) is offered instead");

  // +0.75 CYL gives SE -6.375 / target -5.875: Balanced -6.00 is buildable,
  // while the printed-SPH preference -6.50 is outside this mask's stock.
  var unbuildable = await loadChecker(HANDLES.lumix);
  check(unbuildable, [-6.75, 0.75, 90], [-6.75, 0.75, 90]);
  await settle();
  assert.deepEqual(cards(unbuildable), []);
  assert.equal(shownPair(unbuildable), "-6.00/-6.00");
  apply(unbuildable);
  await settle();
  assert.deepEqual([confirms(unbuildable)[0].body.recommendationStrategy, confirms(unbuildable)[0].body.recommendedRight], ["balanced", -6]);
});

test("checker: exact fixture +4.00/-2.00 x075, +3.00/-1.25 x110 on the farsighted mask: Balanced +3/+2 default, Alternative +4/+3, evidence and handoff follow the selection", { skip: skipDom }, async function () {
  var page = await loadChecker(HANDLES.farsighted);
  check(page, [4, -2, 75], [3, -1.25, 110]);
  await settle();
  assert.deepEqual(cards(page), ["balanced +3.00/+2.00", "closer_to_sph +4.00/+3.00"]);
  assert.deepEqual(cardTitles(page), ["BalancedRecommended", "Alternative"]);
  assert.equal(checkedStrategy(page), "balanced");
  var calc = function () { return page.container.ooRxChecker.state.calculation; };
  assert.equal(calc().selectionEvidence, "default_recommendation");
  var text = function () { return page.container.querySelector("[data-checker-result]").textContent.replace(/\s+/g, " "); };
  assert.match(text(), /This is our recommended all round option\./);
  ["Glasses prescription:+4.00 / -2.00", "Sphere only strength:+3.00", "Underwater adjusted strength:+2.50", "Closest available mask lens:+3.00",
    "Glasses prescription:+3.00 / -1.25", "Sphere only strength:+2.38", "Underwater adjusted strength:+1.88", "Closest available mask lens:+2.00"].forEach(function (needle) {
    assert.ok(text().indexOf(needle) !== -1, "missing: " + needle);
  });

  choose(page, "closer_to_sph");
  await settle();
  assert.equal(shownPair(page), "+4.00/+3.00");
  assert.deepEqual(cardTitles(page), ["BalancedRecommended", "Alternative"]);
  assert.equal(calc().selectionEvidence, "customer_explicit");
  assert.match(text(), /This gives a stronger correction than Balanced\. Balanced remains our recommended all round option\./);
  assert.ok(text().indexOf("Alternative mask lens:+4.00") !== -1);
  choose(page, "balanced");
  await settle();
  assert.equal(shownPair(page), "+3.00/+2.00");
  assert.equal(calc().selectionEvidence, "customer_explicit", "never reverts to default_recommendation");
  choose(page, "closer_to_sph");
  await settle();
  apply(page);
  await settle();
  assert.deepEqual([confirms(page)[0].body.recommendationStrategy, confirms(page)[0].body.recommendedRight, confirms(page)[0].body.recommendedLeft], ["closer_to_sph", 4, 3]);
  assert.deepEqual([page.applied[0].summary.recommendedRight, page.applied[0].summary.recommendedLeft], [4, 3], "handoff uses the current selected pair");
});

test("checker: farsighted alternative +3.00/-0.75, +2.50/-0.50 on the farsighted mask", { skip: skipDom }, async function () {
  var page = await loadChecker(HANDLES.farsighted);
  check(page, [3, -0.75, 90], [2.5, -0.5, 90]);
  await settle();
  assert.deepEqual(cards(page), ["balanced +2.00/+2.00", "closer_to_sph +3.00/+2.00"]);
  assert.equal(checkedStrategy(page), "balanced");
  var closer = page.container.querySelector('.oo-rx-checker__choice[data-strategy="closer_to_sph"]');
  assert.match(closer.textContent, /The right lens is stronger than Balanced\./);
  assert.equal(closer.querySelector(".oo-rx-checker__choice-notice"), null, "no separate warning box");
  choose(page, "closer_to_sph");
  await settle();
  apply(page);
  await settle();
  assert.deepEqual([confirms(page)[0].body.recommendationStrategy, confirms(page)[0].body.recommendedRight, confirms(page)[0].body.recommendedLeft], ["closer_to_sph", 3, 2]);
});

test("checker: high CYL shows Balanced (Recommended, selected) and Alternative", { skip: skipDom }, async function () {
  var page = await loadChecker(HANDLES.obsidian);
  check(page, [-3, -3.5, 90], [-3, -3.5, 90]);
  await settle();
  var options = cards(page);
  assert.equal(options.length, 2);
  assert.match(options[0], /^balanced /);
  assert.match(options[1], /^closer_to_sph /);
  assert.deepEqual(cardTitles(page), ["BalancedRecommended", "Alternative"]);
  assert.equal(checkedStrategy(page), "balanced");
});

test("checker: editing a checked prescription clears its result and option until it is checked again", { skip: skipDom }, async function () {
  var page = await loadChecker(HANDLES.obsidian);
  check(page, [-7, -0.75, 15], [-7.75, -1.25, 166]);
  await settle();
  choose(page, "closer_to_sph");
  await settle();
  setEye(page, "right", -6);
  await settle();
  assert.equal(page.container.querySelector("[data-checker-result]").hidden, true);
  assert.match(page.container.querySelector("[data-checker-status]").textContent, /changed/);
  page.doc.querySelector("[data-checker-form]").dispatchEvent(new page.win.Event("submit", { cancelable: true }));
  await settle();
  // The default is recalculated from the new prescription: Balanced again.
  assert.deepEqual(cards(page), ["balanced -5.50/-8.00", "closer_to_sph -6.00/-7.50"]);
  assert.equal(checkedStrategy(page), "balanced");
  apply(page);
  await settle();
  assert.equal(confirms(page).length, 1);
  assert.deepEqual([confirms(page)[0].body.recommendationStrategy, confirms(page)[0].body.right.sph, confirms(page)[0].body.recommendedRight, confirms(page)[0].body.recommendedLeft], ["balanced", -6, -5.5, -8]);
});

test("checker: multiple named prescriptions keep independent values and selections; switching never saves", { skip: skipDom }, async function () {
  var page = await loadChecker(HANDLES.obsidian);
  var label = page.container.querySelector("[data-checker-label]");
  label.value = "James";
  label.dispatchEvent(new page.win.Event("input"));
  check(page, [-7, -0.75, 15], [-7.75, -1.25, 166]);
  await settle();
  assert.equal(checkedStrategy(page), "balanced", "James defaults to Balanced");
  choose(page, "closer_to_sph");
  await settle();
  var bar = page.container.querySelector("[data-checker-profiles]");
  assert.equal(bar.hidden, false, "Add another prescription is offered after a result");

  page.container.querySelector("[data-checker-add]").click();
  await settle();
  assert.equal(page.container.querySelector("[data-checker-result]").hidden, true);
  assert.equal(label.value, "");
  label.value = "Airies";
  label.dispatchEvent(new page.win.Event("input"));
  check(page, [-3, 0, 90], [-3, 0, 90]);
  await settle();
  assert.deepEqual(cards(page), ["balanced -2.50/-2.50", "closer_to_sph -3.00/-3.00"]);
  assert.equal(checkedStrategy(page), "balanced");
  var tabs = Array.prototype.map.call(page.container.querySelectorAll(".oo-rx-checker__profile-tab"), function (tab) { return tab.textContent; });
  assert.deepEqual(tabs, ["James", "Airies"]);

  page.container.querySelector('.oo-rx-checker__profile-tab[data-prescription-id="rx-1"]').click();
  await settle();
  assert.equal(label.value, "James");
  assert.equal(shownPair(page), "-7.00/-7.50", "James keeps his Alternative choice");
  assert.equal(page.container.querySelector(".oo-rx-checker__suggested-title").textContent, "Suggested Lens Strength for James");
  label.value = "James R";
  label.dispatchEvent(new page.win.Event("input"));
  assert.equal(page.container.querySelector(".oo-rx-checker__suggested-title").textContent, "Suggested Lens Strength for James R");
  label.value = "James";
  label.dispatchEvent(new page.win.Event("input"));
  assert.equal(checkedStrategy(page), "closer_to_sph");
  assert.equal(page.calls.length, 0, "switching prescriptions never saves");

  page.container.querySelector('.oo-rx-checker__profile-tab[data-prescription-id="rx-2"]').click();
  await settle();
  assert.equal(shownPair(page), "-2.50/-2.50", "Airies keeps Balanced");
  apply(page);
  await settle();
  var saved = confirms(page);
  assert.equal(saved.length, 1);
  assert.deepEqual([saved[0].body.recommendationStrategy, saved[0].body.recommendedRight, saved[0].body.recommendedLeft, saved[0].body.prescriptionLabel], ["balanced", -2.5, -2.5, "Airies"]);
  assert.equal(page.applied[0].summary.prescriptionLabel, "Airies");

  page.container.querySelector('.oo-rx-checker__profile-remove[data-prescription-id="rx-2"]').click();
  await settle();
  assert.equal(page.container.querySelectorAll(".oo-rx-checker__profile-tab").length, 0);
  assert.equal(label.value, "James");
  assert.equal(shownPair(page), "-7.00/-7.50");
});

test("checker: customer-facing copy has no hyphens, en dashes or em dashes", { skip: skipDom }, async function () {
  var page = await loadChecker(HANDLES.obsidian);
  check(page, [-3, -3.5, 90], [-3, -3.5, 90]);
  await settle();
  var resultCopy = page.container.querySelector("[data-checker-result]").textContent.replace(/[+-]\d+\.\d\d/g, "");
  assert.equal(/[\u2013\u2014]/.test(resultCopy), false);
  var hyphen = resultCopy.match(/.{0,30}[A-Za-z]-[A-Za-z].{0,30}/);
  assert.equal(hyphen, null, "hyphen in result copy: " + (hyphen && hyphen[0]));
  var midpoint = await loadChecker(HANDLES.obsidian);
  check(midpoint, [-7, -0.75, 15], [-7.75, -1.25, 166]);
  await settle();
  assert.equal(/—/.test(midpoint.container.textContent), false);
  assert.equal(/median/i.test(midpoint.container.textContent), false);
});
