"use strict";

// V5.3 Lens Calculator page flow: second recommendation options (broadened
// Sharper, Closer to Your SPH preference), the shared calculation
// explanation, Edit Prescription invalidation, save timing and multiple
// previewed prescriptions. Runs the real section and scripts in jsdom and is
// skipped when jsdom is not available
// (NODE_PATH=/path/to/node_modules node --test theme/).

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

var ASSETS = path.join(__dirname, "base", "assets");
var SECTION = path.join(__dirname, "base", "sections", "oo-lens-calculator-v53.liquid");
var CONFIG_ID = "7adf6f8a-1f62-4e2e-9d06-5f5348997a43";

var JSDOM = null;
try { JSDOM = require("jsdom").JSDOM; } catch (error) { JSDOM = null; }
var skipDom = JSDOM ? false : "jsdom is not installed";

function sectionHtml() {
  return fs.readFileSync(SECTION, "utf8")
    .replace(/\{%\s*schema\s*%\}[\s\S]*?\{%\s*endschema\s*%\}/, "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/\{%[^%]*%\}/g, "");
}

function loadCalculator() {
  var dom = new JSDOM("<!doctype html><body>" + sectionHtml() + "</body>", {
    runScripts: "outside-only",
    pretendToBeVisual: true,
    url: "https://oceansoptics.com/pages/lens-page"
  });
  var win = dom.window;
  var calls = [];
  var opened = [];
  var journey = [];
  var initCount = 0;
  win.HTMLElement.prototype.scrollIntoView = function () {};
  win.fetch = function (url, init) {
    var body = init && init.body ? JSON.parse(init.body) : null;
    calls.push({ url: String(url), body: body });
    var data = { ok: true };
    if (/\/manual\/init$/.test(url)) {
      initCount += 1;
      data = { configId: CONFIG_ID, editToken: "edit-" + initCount, labelEditToken: "label-" + initCount };
    }
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(data); } });
  };
  win.open = function () {
    var popup = { location: { href: "" }, close: function () { this.closed = true; }, focus: function () {} };
    opened.push(popup);
    return popup;
  };
  win.OOSourceJourney = { record: function (source) { journey.push(source); return null; } };
  ["base", "engine", "high-cyl", "midpoint", "ui", "rx", "products"].forEach(function (name) {
    win.eval(fs.readFileSync(path.join(ASSETS, "oo-lens-calculator-v53-" + name + ".js"), "utf8"));
  });
  var page = { win: win, doc: win.document, calls: calls, opened: opened, journey: journey };
  if (win.document.readyState !== "loading") return Promise.resolve(page);
  return new Promise(function (resolve) {
    win.document.addEventListener("DOMContentLoaded", function () { resolve(page); }, { once: true });
  });
}

function setEye(doc, side, sphere, cylinder, axisValue) {
  var eye = doc.querySelector('[data-eye="' + side + '"]');
  [["sphere", sphere], ["cylinder", cylinder || 0]].forEach(function (entry) {
    var field = entry[0];
    var value = entry[1];
    var magnitude = Math.abs(value);
    var sign = eye.querySelector('.oo-v52__sign[data-field="' + field + '"]');
    if (field === "sphere" || magnitude) {
      var want = value < 0 ? "-" : "+";
      while (sign.dataset.sign !== want) sign.click();
    }
    var integer = eye.querySelector('.oo-v52__integer[data-field="' + field + '"]');
    var fraction = eye.querySelector('.oo-v52__fraction[data-field="' + field + '"]');
    integer.value = String(Math.floor(magnitude));
    integer.dispatchEvent(new doc.defaultView.Event("change"));
    fraction.value = String(Math.round((magnitude % 1) * 100)).padStart(2, "0");
    fraction.dispatchEvent(new doc.defaultView.Event("change"));
  });
  if (cylinder) {
    var axis = eye.querySelector('.oo-v52__axis[data-field="axis"]');
    axis.value = String(axisValue || 90);
    axis.dispatchEvent(new doc.defaultView.Event("change"));
  }
}

function calculate(page, right, left) {
  setEye(page.doc, "right", right[0], right[1], right[2]);
  setEye(page.doc, "left", left[0], left[1], left[2]);
  page.doc.getElementById("oo-v52-form").dispatchEvent(new page.win.Event("submit", { cancelable: true }));
}

function settle() {
  return new Promise(function (resolve) { setTimeout(resolve, 20); });
}

function cardPairs(doc) {
  return Array.prototype.map.call(doc.querySelectorAll(".oo-v52-product-card__pair"), function (pair) {
    return pair.textContent;
  }).filter(function (value, index, all) { return all.indexOf(value) === index; });
}

function confirmCalls(page) {
  return page.calls.filter(function (call) { return /\/confirm$/.test(call.url); });
}

function text(doc, id) {
  return doc.getElementById(id).textContent.replace(/\s+/g, " ").trim();
}

function visibleText(doc, selector) {
  return Array.prototype.map.call(doc.querySelectorAll(selector), function (node) { return node.textContent; }).join(" ");
}

function choiceOrder(doc) {
  return Array.prototype.map.call(doc.querySelectorAll("#oo-v52-midpoint .oo-v52-high-cyl__choice"), function (choice) {
    var input = choice.querySelector("input");
    var title = choice.querySelector(".oo-v52-high-cyl__option-title").textContent.replace(/\s+/g, " ").trim();
    return input.value + (input.checked ? "*" : "") + " " + title;
  });
}

test("B. -7.00/-0.75 and -7.75/-1.25: Balanced -6.50/-7.50 is Recommended and selected; Alternative -7.00/-8.00 stays visible and saves explicitly", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-7, -0.75], [-7.75, -1.25]);
  await settle();
  assert.equal(page.doc.getElementById("oo-v52-midpoint").hidden, false);
  assert.equal(text(page.doc, "oo-v52-midpoint-balanced-right"), "-6.50");
  assert.equal(text(page.doc, "oo-v52-midpoint-balanced-left"), "-7.50");
  assert.equal(text(page.doc, "oo-v52-midpoint-sharper-right"), "-7.00");
  assert.equal(text(page.doc, "oo-v52-midpoint-sharper-left"), "-8.00");
  assert.equal(page.doc.getElementById("oo-v52-midpoint-sharper").value, "sharper");
  assert.deepEqual(choiceOrder(page.doc), ["balanced* Balanced Recommended", "sharper Alternative"]);
  assert.equal(page.doc.getElementById("oo-v52-midpoint-alternative-notice").hidden, true, "no separate warning box");
  assert.deepEqual(cardPairs(page.doc), ["R -6.50L -7.50"], "masks follow the default Balanced pair straight away");
  assert.equal(page.win.OOV52CalculatorUI.getActiveRecommendation().recommendationStrategy, "balanced");

  page.doc.getElementById("oo-v52-midpoint-sharper").click();
  await settle();
  assert.deepEqual(cardPairs(page.doc), ["R -7.00L -8.00"]);
  assert.deepEqual(choiceOrder(page.doc), ["balanced Balanced Recommended", "sharper* Alternative"], "Balanced keeps its badge while the Alternative is selected");
  assert.equal(page.calls.length, 0, "switching cards never saves");
  page.doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  var confirms = confirmCalls(page);
  assert.equal(confirms.length, 1);
  assert.deepEqual(
    [confirms[0].body.recommendationStrategy, confirms[0].body.recommendedRight, confirms[0].body.recommendedLeft],
    ["closer_to_sph", -7, -8]
  );
  assert.equal(confirms[0].body.v53Snapshot.selectionEvidence, "customer_explicit");
  assert.deepEqual(confirms[0].body.right, { sph: -7, cyl: 0.75, cylSign: "-", axis: 90 });
  var url = new URL(page.opened[0].location.href);
  assert.equal(url.searchParams.get("oo_rx"), CONFIG_ID);
  assert.equal(url.searchParams.get("oo_source"), "lens_calculator_v53");
});

test("default selects Balanced for the #336254 and #336246 fixtures; the Alternative stays visible", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  var sharper = page.doc.getElementById("oo-v52-midpoint-sharper");
  var balanced = page.doc.getElementById("oo-v52-midpoint-balanced");

  calculate(page, [4, -0.75], [4.25, -0.75]);
  await settle();
  assert.equal(text(page.doc, "oo-v52-midpoint-sharper-right"), "+4.00");
  assert.equal(text(page.doc, "oo-v52-midpoint-sharper-left"), "+4.00");
  assert.equal(text(page.doc, "oo-v52-midpoint-balanced-right"), "+3.00");
  assert.equal(text(page.doc, "oo-v52-midpoint-balanced-left"), "+3.00");
  assert.equal(balanced.checked, true, "Balanced (Recommended) is checked on initial display");
  assert.equal(sharper.checked, false);
  assert.deepEqual(cardPairs(page.doc), ["R +3.00L +3.00"]);

  page.doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  var firstConfirm = confirmCalls(page)[0];
  assert.deepEqual(firstConfirm.body.v53Snapshot.optionsShown, {
    closer_to_sph: { right: "+4.00", left: "+4.00" },
    balanced: { right: "+3.00", left: "+3.00" }
  });
  assert.equal(firstConfirm.body.v53Snapshot.recommendedStrategy, "balanced");
  assert.deepEqual(firstConfirm.body.v53Snapshot.recommendedValues, { right: "+3.00", left: "+3.00" });
  assert.equal(firstConfirm.body.v53Snapshot.selectedStrategy, "balanced", JSON.stringify(firstConfirm.body.v53Snapshot));
  assert.equal(firstConfirm.body.v53Snapshot.selectionEvidence, "default_recommendation");

  var togglePage = await loadCalculator();
  calculate(togglePage, [4, -0.75], [4.25, -0.75]);
  await settle();
  var toggleBalanced = togglePage.doc.getElementById("oo-v52-midpoint-balanced");
  var toggleSharper = togglePage.doc.getElementById("oo-v52-midpoint-sharper");
  toggleSharper.click();
  await settle();
  assert.equal(toggleSharper.checked, true, "the Alternative can be selected");
  assert.equal(toggleBalanced.checked, false);
  assert.equal(togglePage.win.OOV52CalculatorUI.getActiveRecommendation().recommendationStrategy, "closer_to_sph");
  toggleBalanced.click();
  await settle();
  assert.equal(toggleBalanced.checked, true, "Balanced can be selected again");
  assert.equal(toggleSharper.checked, false);
  togglePage.doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  var explicitConfirm = confirmCalls(togglePage)[0];
  assert.equal(explicitConfirm.body.v53Snapshot.selectedStrategy, "balanced");
  assert.equal(explicitConfirm.body.v53Snapshot.selectionEvidence, "customer_explicit", "an interaction never reverts to default_recommendation");

  var page336246 = await loadCalculator();
  calculate(page336246, [-3.5, -2], [-5, -1.5]);
  await settle();
  assert.equal(text(page336246.doc, "oo-v52-midpoint-sharper-right"), "-4.00");
  assert.equal(text(page336246.doc, "oo-v52-midpoint-sharper-left"), "-5.50");
  assert.equal(text(page336246.doc, "oo-v52-midpoint-balanced-right"), "-4.00");
  assert.equal(text(page336246.doc, "oo-v52-midpoint-balanced-left"), "-5.00");
  assert.equal(page336246.doc.getElementById("oo-v52-midpoint-balanced").checked, true, "Balanced is the default for #336246 too");
  assert.equal(page336246.doc.getElementById("oo-v52-midpoint-sharper").checked, false);
  assert.equal(text(page336246.doc, "oo-v52-midpoint-alternative-copy"), "Another valid lens option calculated from your prescription. The left lens is stronger than Balanced.");
});

test("#336262 -1.00/-0.75 x170, -1.75: the default Balanced -1.00/-1.00 saves without a click; Alternative and Balanced again save as explicit", { skip: skipDom }, async function () {
  function choiceState(page) {
    return {
      sharper: page.doc.getElementById("oo-v52-midpoint-sharper").checked,
      balanced: page.doc.getElementById("oo-v52-midpoint-balanced").checked,
      sharperRight: text(page.doc, "oo-v52-midpoint-sharper-right"),
      sharperLeft: text(page.doc, "oo-v52-midpoint-sharper-left"),
      balancedRight: text(page.doc, "oo-v52-midpoint-balanced-right"),
      balancedLeft: text(page.doc, "oo-v52-midpoint-balanced-left")
    };
  }
  async function chooseMask(page) {
    page.doc.querySelector(".oo-v52-product-card__customize").click();
    await settle();
    await settle();
    var confirms = confirmCalls(page);
    assert.equal(confirms.length, 1, "the selected pair is confirmed once");
    assert.equal(page.opened.length, 1);
    assert.notEqual(page.opened[0].closed, true, "the product window stays open");
    var url = new URL(page.opened[0].location.href);
    assert.equal(url.searchParams.get("oo_rx"), CONFIG_ID);
    assert.equal(url.searchParams.get("oo_source"), "lens_calculator_v53");
    assert.doesNotMatch(page.doc.body.textContent, /couldn't save this prescription yet/);
    return confirms[0].body;
  }
  var options = {
    closer_to_sph: { right: "-1.00", left: "-1.50" },
    balanced: { right: "-1.00", left: "-1.00" }
  };

  var page = await loadCalculator();
  calculate(page, [-1, -0.75, 170], [-1.75, 0]);
  await settle();
  assert.deepEqual(choiceState(page), {
    sharper: false, balanced: true,
    sharperRight: "-1.00", sharperLeft: "-1.50", balancedRight: "-1.00", balancedLeft: "-1.00"
  }, "Balanced (Recommended) is selected on first display");
  assert.deepEqual(cardPairs(page.doc), ["R -1.00L -1.00"]);
  assert.equal(page.calls.length, 0, "nothing saves before a mask is chosen");
  var body = await chooseMask(page);
  assert.deepEqual([body.recommendationStrategy, body.recommendedRight, body.recommendedLeft], ["balanced", -1, -1]);
  assert.deepEqual(body.right, { sph: -1, cyl: 0.75, cylSign: "-", axis: 170 });
  assert.deepEqual(body.v53Snapshot.optionsShown, options);
  assert.equal(body.v53Snapshot.recommendedStrategy, "balanced");
  assert.equal(body.v53Snapshot.selectedStrategy, "balanced");
  assert.equal(body.v53Snapshot.selectionEvidence, "default_recommendation");
  assert.deepEqual([Number(body.v53Snapshot.selectedRecommendation.right), Number(body.v53Snapshot.selectedRecommendation.left)], [-1, -1]);
  var snapshot = JSON.parse(new URL(page.opened[0].location.href).searchParams.get("_oo_v53_snapshot"));
  assert.equal(snapshot.selectionEvidence, "default_recommendation");

  var altPage = await loadCalculator();
  calculate(altPage, [-1, -0.75, 170], [-1.75, 0]);
  await settle();
  altPage.doc.getElementById("oo-v52-midpoint-sharper").click();
  await settle();
  assert.deepEqual(cardPairs(altPage.doc), ["R -1.00L -1.50"]);
  body = await chooseMask(altPage);
  assert.deepEqual([body.recommendationStrategy, body.recommendedRight, body.recommendedLeft], ["closer_to_sph", -1, -1.5]);
  assert.equal(body.v53Snapshot.selectedStrategy, "closer_to_sph");
  assert.equal(body.v53Snapshot.selectionEvidence, "customer_explicit");
  assert.deepEqual(body.v53Snapshot.optionsShown, options, "both options are still recorded");

  var againPage = await loadCalculator();
  calculate(againPage, [-1, -0.75, 170], [-1.75, 0]);
  await settle();
  againPage.doc.getElementById("oo-v52-midpoint-sharper").click();
  await settle();
  againPage.doc.getElementById("oo-v52-midpoint-balanced").click();
  await settle();
  assert.equal(choiceState(againPage).balanced, true);
  assert.deepEqual(cardPairs(againPage.doc), ["R -1.00L -1.00"]);
  body = await chooseMask(againPage);
  assert.deepEqual([body.recommendationStrategy, body.recommendedRight, body.recommendedLeft], ["balanced", -1, -1]);
  assert.equal(body.v53Snapshot.selectedStrategy, "balanced");
  assert.equal(body.v53Snapshot.selectionEvidence, "customer_explicit");
});

test("#336254 and #336246 defaults save the Balanced pair without a click", { skip: skipDom }, async function () {
  var cases = [
    [[4, -0.75], [4.25, -0.75], "R +3.00L +3.00", 3, 3],
    [[-3.5, -2], [-5, -1.5], "R -4.00L -5.00", -4, -5]
  ];
  for (var i = 0; i < cases.length; i += 1) {
    var page = await loadCalculator();
    calculate(page, cases[i][0], cases[i][1]);
    await settle();
    assert.equal(page.doc.getElementById("oo-v52-midpoint-balanced").checked, true);
    assert.equal(page.doc.getElementById("oo-v52-midpoint").hidden, false, "the Alternative card stays visible");
    assert.deepEqual(cardPairs(page.doc), [cases[i][2]]);
    page.doc.querySelector(".oo-v52-product-card__customize").click();
    await settle();
    await settle();
    var confirms = confirmCalls(page);
    assert.equal(confirms.length, 1, cases[i][2]);
    assert.deepEqual([confirms[0].body.recommendationStrategy, confirms[0].body.recommendedRight, confirms[0].body.recommendedLeft], ["balanced", cases[i][3], cases[i][4]]);
    assert.equal(confirms[0].body.v53Snapshot.selectionEvidence, "default_recommendation");
  }
});

test("exact fixture +4.00/-2.00 x075, +3.00/-1.25 x110: Balanced +3/+2 selected, Alternative +4/+3 visible, explanation follows the selection", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [4, -2, 75], [3, -1.25, 110]);
  await settle();
  assert.deepEqual(choiceOrder(page.doc), ["balanced* Balanced Recommended", "closer_to_sph Alternative"]);
  assert.deepEqual([text(page.doc, "oo-v52-midpoint-balanced-right"), text(page.doc, "oo-v52-midpoint-balanced-left")], ["+3.00", "+2.00"]);
  assert.deepEqual([text(page.doc, "oo-v52-midpoint-sharper-right"), text(page.doc, "oo-v52-midpoint-sharper-left")], ["+4.00", "+3.00"]);
  assert.deepEqual(cardPairs(page.doc), ["R +3.00L +2.00"]);
  var why = page.doc.getElementById("oo-v52-why");
  assert.equal(why.hidden, false);
  assert.equal(why.querySelector(".oo-rx-why__title").textContent, "Why are my mask lenses different from my glasses?");
  var explain = function () { return visibleText(page.doc, "#oo-v52-explain").replace(/\s+/g, " "); };
  assert.match(explain(), /What to expect underwater\s*This is our recommended all round option\./);
  ["Right eye", "Glasses prescription:+4.00 / -2.00", "Sphere only strength:+3.00", "Underwater adjusted strength:+2.50", "Closest available mask lens:+3.00",
    "Left eye", "Glasses prescription:+3.00 / -1.25", "Sphere only strength:+2.38", "Underwater adjusted strength:+1.88", "Closest available mask lens:+2.00",
    "Prescription mask lenses come in fixed strengths, so the final lens may not exactly match the calculated number."].forEach(function (needle) {
    assert.ok(explain().indexOf(needle) !== -1, "missing: " + needle);
  });
  assert.equal(page.doc.querySelector("#oo-v52-explain details").open, false, "the maths starts collapsed");
  assert.equal(page.doc.querySelectorAll("#oo-v52-explain details").length, 1, "one optional maths section");

  page.doc.getElementById("oo-v52-midpoint-sharper").click();
  await settle();
  assert.deepEqual(choiceOrder(page.doc), ["balanced Balanced Recommended", "closer_to_sph* Alternative"]);
  assert.deepEqual(cardPairs(page.doc), ["R +4.00L +3.00"]);
  assert.match(explain(), /What to expect underwater\s*This gives a stronger correction than Balanced\. Balanced remains our recommended all round option\./);
  assert.ok(explain().indexOf("Alternative mask lens:+4.00") !== -1 && explain().indexOf("Alternative mask lens:+3.00") !== -1);
  assert.equal(/our recommended all round option\. It is designed/.test(explain()), false, "only the selected option is explained");

  page.doc.getElementById("oo-v52-midpoint-balanced").click();
  await settle();
  assert.deepEqual(cardPairs(page.doc), ["R +3.00L +2.00"]);
  assert.match(explain(), /This is our recommended all round option\./);
  page.doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  var body = confirmCalls(page)[0].body;
  assert.deepEqual([body.recommendationStrategy, body.recommendedRight, body.recommendedLeft], ["balanced", 3, 2]);
  assert.deepEqual(body.v53Snapshot.optionsShown, { closer_to_sph: { right: "+4.00", left: "+3.00" }, balanced: { right: "+3.00", left: "+2.00" } });
  assert.equal(body.v53Snapshot.recommendedStrategy, "balanced");
  assert.equal(body.v53Snapshot.selectedStrategy, "balanced");
  assert.equal(body.v53Snapshot.selectionEvidence, "customer_explicit");
  // Signed lens values and the hidden "--" placeholders are numbers, not copy.
  var customerText = page.doc.querySelector(".oo-v52__result").textContent.replace(/[+-]\d+\.\d\d/g, "").replace(/--/g, "");
  assert.equal(/[–—]/.test(customerText), false, "no en or em dashes in customer copy");
  var hyphen = customerText.match(/.{0,30}(?:\D-\D|[a-z]-[a-z]).{0,30}/i);
  assert.equal(hyphen, null, "no hyphens in customer copy: " + (hyphen && hyphen[0]));
});

test("A. Daniel -3.75/-0.25, -3.50/-0.75: Balanced -3.00/-3.00 is the default; the Alternative -3.50/-3.50 saves as closer_to_sph", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-3.75, -0.25], [-3.5, -0.75]);
  await settle();
  assert.deepEqual(choiceOrder(page.doc), ["balanced* Balanced Recommended", "sharper Alternative"]);
  assert.equal(text(page.doc, "oo-v52-midpoint-sharper-right"), "-3.50");
  assert.equal(text(page.doc, "oo-v52-midpoint-sharper-left"), "-3.50");
  assert.equal(text(page.doc, "oo-v52-midpoint-balanced-right"), "-3.00");
  assert.equal(text(page.doc, "oo-v52-midpoint-balanced-left"), "-3.00");
  assert.equal(text(page.doc, "oo-v52-midpoint-alternative-copy"), "Another valid lens option calculated from your prescription. This gives a stronger correction than Balanced.");
  var balancedCopy = page.doc.getElementById("oo-v52-midpoint-balanced").parentNode.querySelector(".oo-v52-high-cyl__copy").textContent;
  assert.equal(balancedCopy, "Our recommended all round option, adjusted for comfortable underwater vision.");
  assert.deepEqual(cardPairs(page.doc), ["R -3.00L -3.00"]);
  assert.deepEqual(page.journey, [], "automatic default selection is not a product click");

  page.doc.getElementById("oo-v52-midpoint-sharper").click();
  await settle();
  assert.match(text(page.doc, "oo-v52-midpoint-selection-status"), /^Alternative selected\. Right -3\.50, left -3\.50\.$/);
  page.doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  var confirms = confirmCalls(page);
  assert.equal(confirms.length, 1);
  assert.deepEqual(
    [confirms[0].body.recommendationStrategy, confirms[0].body.recommendedRight, confirms[0].body.recommendedLeft],
    ["closer_to_sph", -3.5, -3.5]
  );
  assert.ok(page.journey.indexOf("lens_calculator_v53") !== -1);
});

test("A. Daniel: choosing Balanced again announces it and saves balanced", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-3.75, -0.25], [-3.5, -0.75]);
  await settle();
  page.doc.getElementById("oo-v52-midpoint-sharper").click();
  await settle();
  page.doc.getElementById("oo-v52-midpoint-balanced").click();
  await settle();
  assert.deepEqual(cardPairs(page.doc), ["R -3.00L -3.00"]);
  assert.equal(page.calls.length, 0);
  assert.match(text(page.doc, "oo-v52-midpoint-selection-status"), /^Balanced selected\. Right -3\.00, left -3\.00\.$/);
  var explain = visibleText(page.doc, "#oo-v52-explain").replace(/\s+/g, " ");
  assert.ok(explain.indexOf("Closest available mask lens:-3.00") !== -1);
});

test("A. screenshot tie -2.25 / -1.75: Balanced -1.50/-1.00 default; Alternative -2.00/-1.50 visible", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-2.25], [-1.75]);
  await settle();
  assert.deepEqual(choiceOrder(page.doc), ["balanced* Balanced Recommended", "sharper Alternative"]);
  assert.equal(text(page.doc, "oo-v52-midpoint-sharper-right"), "-2.00");
  assert.equal(text(page.doc, "oo-v52-midpoint-sharper-left"), "-1.50");
  assert.equal(text(page.doc, "oo-v52-midpoint-balanced-right"), "-1.50");
  assert.equal(text(page.doc, "oo-v52-midpoint-balanced-left"), "-1.00");
  assert.deepEqual(cardPairs(page.doc), ["R -1.50L -1.00"]);
  assert.deepEqual(page.journey, [], "automatic selection is not a product click");
  page.doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  var confirms = confirmCalls(page);
  assert.equal(confirms.length, 1);
  assert.deepEqual([confirms[0].body.recommendationStrategy, confirms[0].body.recommendedRight, confirms[0].body.recommendedLeft], ["balanced", -1.5, -1]);
});

test("A. screenshot tie: choosing the Alternative shows -2.00/-1.50 masks and saves closer_to_sph", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-2.25], [-1.75]);
  await settle();
  page.doc.getElementById("oo-v52-midpoint-sharper").click();
  await settle();
  assert.deepEqual(cardPairs(page.doc), ["R -2.00L -1.50"]);
  assert.equal(page.calls.length, 0, "switching cards never saves");
  page.doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  var confirms = confirmCalls(page);
  assert.deepEqual([confirms[0].body.recommendationStrategy, confirms[0].body.recommendedRight, confirms[0].body.recommendedLeft], ["closer_to_sph", -2, -1.5]);
});

test("UI: the results area has one heading, the why block, the cards, what to expect, one collapsed maths section, then Your Matching Masks", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-2.25], [-1.75]);
  await settle();
  var result = page.doc.getElementById("oo-v52-result");
  var visible = function (node) {
    for (var n = node; n && n !== page.doc.body; n = n.parentElement) if (n.hidden) return false;
    return true;
  };
  var visibleText = Array.prototype.filter.call(page.doc.querySelectorAll(".oo-v52 *"), function (n) { return visible(n) && !n.children.length; })
    .map(function (n) { return n.textContent; }).join(" ");
  ["We recommend the first option", "Choose the lens option you'd like us to use", "About Your Recommendation",
    "Switch between the options", "How we calculated your mask lens", "Why is my mask lens different from my SPH?",
    "Closer Match", "Softer Option", "Sharper"].forEach(function (needle) {
    assert.equal(visibleText.indexOf(needle), -1, "still visible: " + needle);
  });
  assert.equal(page.doc.getElementById("oo-v52-guidance").hidden, true, "no standalone recommendation box for an ordinary result");
  assert.equal(result.querySelector("h2").textContent, "Suggested Lens Strength");
  assert.equal(page.doc.getElementById("oo-v52-result-intro").hidden, true);
  assert.equal(visible(page.doc.getElementById("oo-v52-why")), true);
  assert.equal(page.doc.querySelectorAll("#oo-v52-why .oo-rx-why__copy").length, 3);
  var summaries = Array.prototype.map.call(page.doc.querySelectorAll("#oo-v52-explain summary"), function (s) { return s.textContent.trim(); });
  assert.deepEqual(summaries, ["See how we calculated this"]);
  Array.prototype.forEach.call(page.doc.querySelectorAll("#oo-v52-explain details"), function (d) { assert.equal(d.open, false, "the maths starts collapsed"); });
  assert.equal(page.doc.querySelectorAll("#oo-v52-explain .oo-rx-expect").length, 1, "one selected-option explanation");
  assert.equal(page.doc.querySelectorAll(".oo-rx-explain__warning").length, 0, "no warning boxes");
  assert.equal(text(page.doc, "oo-v52-products-title"), "Your Matching Masks");
  assert.equal(page.doc.querySelector(".oo-v52-products__intro").textContent, "All of the masks below are available with your selected lens strength. Choose the style and colour you prefer.");

  // A single-result prescription has no options: the why block and maths
  // remain, but no "What to expect" choice text.
  page.doc.getElementById("oo-v52-edit").click();
  calculate(page, [-3.75, -0.75], [-3.75, -0.75]);
  await settle();
  assert.equal(page.doc.getElementById("oo-v52-why").hidden, false);
  assert.equal(page.doc.querySelectorAll("#oo-v52-explain .oo-rx-expect").length, 0);
  assert.equal(page.doc.getElementById("oo-v52-guidance").hidden, true);
});

test("UI: genuine warnings still show (manual review); high CYL shows Balanced selected with the why block", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-0.25, -0.5], [-3]);
  await settle();
  assert.equal(page.doc.getElementById("oo-v52-guidance").hidden, false);
  assert.match(page.doc.getElementById("oo-v52-guidance").textContent, /We need to review your right-eye prescription/);
  var high = await loadCalculator();
  calculate(high, [-2.75, -3.25], [-2, -3]);
  await settle();
  assert.equal(high.doc.getElementById("oo-v52-high-cyl").hidden, false);
  assert.equal(high.doc.getElementById("oo-v52-why").hidden, false);
  assert.equal(high.doc.getElementById("oo-v52-high-balanced").checked, true, "Balanced is selected automatically");
  assert.equal(high.doc.getElementById("oo-v52-high-alternative").checked, false);
  assert.match(high.doc.getElementById("oo-v52-high-balanced").parentNode.textContent, /Balanced\s*Recommended/);
  assert.match(high.doc.getElementById("oo-v52-high-alternative").parentNode.textContent, /Alternative/);
  assert.match(high.doc.getElementById("oo-v52-high-alternative").parentNode.textContent, /This gives a softer correction than Balanced\./);
  assert.equal(high.win.OOV52CalculatorUI.getActiveRecommendation().recommendationStrategy, "balanced");
  high.doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  var body = confirmCalls(high)[0].body;
  assert.equal(body.recommendationStrategy, "balanced");
  assert.equal(body.v53Snapshot.recommendedStrategy, "balanced");
  assert.equal(body.v53Snapshot.selectedStrategy, "balanced");
  assert.equal(body.v53Snapshot.selectionEvidence, "default_recommendation");
});

test("farsighted alternative: +3.00/-0.75 and +2.50/-0.50 offer Balanced +2.00/+2.00 then Alternative +3.00/+2.00", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [3, -0.75], [2.5, -0.5]);
  await settle();
  assert.equal(text(page.doc, "oo-v52-midpoint-balanced-right"), "+2.00");
  assert.equal(text(page.doc, "oo-v52-midpoint-balanced-left"), "+2.00");
  assert.equal(text(page.doc, "oo-v52-midpoint-sharper-right"), "+3.00");
  assert.equal(text(page.doc, "oo-v52-midpoint-sharper-left"), "+2.00");
  assert.equal(page.doc.getElementById("oo-v52-midpoint-sharper").value, "closer_to_sph");
  assert.equal(text(page.doc, "oo-v52-midpoint-alternative-title"), "Alternative");
  assert.deepEqual(choiceOrder(page.doc), ["balanced* Balanced Recommended", "closer_to_sph Alternative"]);
  assert.equal(text(page.doc, "oo-v52-midpoint-alternative-copy"), "Another valid lens option calculated from your prescription. The right lens is stronger than Balanced.");
  assert.equal(page.doc.getElementById("oo-v52-midpoint-alternative-notice").hidden, true, "no separate warning box");
  assert.deepEqual(cardPairs(page.doc), ["R +2.00L +2.00"]);

  page.doc.getElementById("oo-v52-midpoint-sharper").click();
  await settle();
  assert.deepEqual(cardPairs(page.doc), ["R +3.00L +2.00"]);
  var explain = visibleText(page.doc, "#oo-v52-explain").replace(/\s+/g, " ");
  assert.ok(explain.indexOf("Sphere only strength:+2.63") !== -1);
  assert.ok(explain.indexOf("Underwater adjusted strength:+2.13") !== -1);
  assert.ok(explain.indexOf("The right lens is stronger than Balanced. Balanced remains our recommended all round option.") !== -1);
  page.doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  assert.deepEqual(
    [confirmCalls(page)[0].body.recommendationStrategy, confirmCalls(page)[0].body.recommendedRight, confirmCalls(page)[0].body.recommendedLeft],
    ["closer_to_sph", 3, 2]
  );
});

test("explanation: compact per-eye pathway, one maths section, no repeated definitions, no dashes in customer copy", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-2.75, -3.25], [-2.75, -3.25]);
  await settle();
  var explain = page.doc.getElementById("oo-v52-explain");
  assert.equal(explain.hidden, false);
  var content = explain.textContent;
  ["See how we calculated this", "Glasses prescription:", "-2.75 / -3.25", "Sphere only strength:", "-4.38",
    "Underwater adjusted strength:", "-3.88", "Closest available mask lens:",
    "Prescription mask lenses come in fixed strengths"].forEach(function (needle) {
    assert.ok(content.indexOf(needle) !== -1, "missing: " + needle);
  });
  ["Spherical Equivalent", "SPH + (CYL ÷ 2)", "Adjust for underwater viewing", "sphere-only", "Your chosen option"].forEach(function (needle) {
    assert.equal(content.indexOf(needle), -1, "repeated technical copy: " + needle);
  });
  assert.equal((content.match(/Prescription mask lenses come in fixed strengths/g) || []).length, 1, "one short note");
  var customerText = page.doc.querySelector(".oo-v52__result").textContent;
  assert.equal(/[–—]/.test(customerText), false, "no en or em dashes in customer-facing copy");
  assert.equal(/median/i.test(customerText), false);
  assert.equal(/water adds 0\.50/i.test(customerText), false);
});

test("Edit Prescription after choosing the Alternative: old option, pair and masks are cleared and cannot be saved", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-7, -0.75], [-7.75, -1.25]);
  await settle();
  page.doc.getElementById("oo-v52-midpoint-sharper").click();
  await settle();
  var staleCta = page.doc.querySelector(".oo-v52-product-card__customize");
  var edit = page.doc.getElementById("oo-v52-edit");
  assert.equal(edit.hidden, false);
  edit.click();
  setEye(page.doc, "right", -6);
  await settle();
  assert.equal(page.doc.getElementById("oo-v52-products").hidden, true);
  assert.equal(page.doc.getElementById("oo-v52-result").hidden, true);
  assert.equal(page.doc.getElementById("oo-v52-midpoint").hidden, true);
  assert.equal(page.doc.getElementById("oo-v52-explain").hidden, true);
  assert.equal(page.doc.getElementById("oo-v52-why").hidden, true);
  assert.equal(page.win.OOV52CalculatorUI.getActiveRecommendation(), null);
  staleCta.click();
  await settle();
  assert.equal(page.calls.length, 0, "the stale Alternative pair is never saved");

  var left = page.doc.querySelector('[data-eye="left"]');
  assert.equal(left.querySelector('.oo-v52__integer[data-field="sphere"]').value, "7");
  assert.equal(left.querySelector('.oo-v52__fraction[data-field="sphere"]').value, "75");

  page.doc.getElementById("oo-v52-form").dispatchEvent(new page.win.Event("submit", { cancelable: true }));
  await settle();
  // The default is recalculated from the NEW prescription: Balanced again,
  // with the new Alternative pair visible.
  assert.deepEqual(choiceOrder(page.doc), ["balanced* Balanced Recommended", "sharper Alternative"]);
  assert.equal(text(page.doc, "oo-v52-midpoint-sharper-right"), "-5.50");
  assert.equal(text(page.doc, "oo-v52-midpoint-sharper-left"), "-8.00");
  assert.equal(text(page.doc, "oo-v52-midpoint-balanced-right"), "-5.50");
  assert.equal(text(page.doc, "oo-v52-midpoint-balanced-left"), "-7.50");
  assert.deepEqual(cardPairs(page.doc), ["R -5.50L -7.50"]);
  page.doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  var confirms = confirmCalls(page);
  assert.equal(confirms.length, 1);
  assert.deepEqual(
    [confirms[0].body.recommendationStrategy, confirms[0].body.right.sph, confirms[0].body.recommendedRight, confirms[0].body.recommendedLeft],
    ["balanced", -6, -5.5, -7.5]
  );
  assert.equal(confirms[0].body.v53Snapshot.selectionEvidence, "default_recommendation", "a new calculation starts from the default again");
});

test("L. Edit Prescription recalculates the default from the new prescription each time", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-3.75, -0.25], [-3.5, -0.75]);
  await settle();
  page.doc.getElementById("oo-v52-midpoint-sharper").click();
  await settle();
  assert.equal(page.win.OOV52CalculatorUI.getActiveRecommendation().recommendationStrategy, "sharper");
  page.doc.getElementById("oo-v52-edit").click();
  calculate(page, [-3.75, -0.75], [-3.75, -0.75]);
  await settle();
  assert.equal(page.doc.getElementById("oo-v52-midpoint").hidden, true);
  assert.equal(page.win.OOV52CalculatorUI.getActiveRecommendation().recommendationStrategy, "balanced");
  // To an exact tie: the earlier Alternative choice is not carried over.
  page.doc.getElementById("oo-v52-edit").click();
  calculate(page, [-2.25], [-1.75]);
  await settle();
  assert.equal(page.win.OOV52CalculatorUI.getActiveRecommendation().recommendationStrategy, "balanced");
  assert.deepEqual(cardPairs(page.doc), ["R -1.50L -1.00"]);
});

test("multiple prescriptions: an unsaved preview survives Add prescription, keeps its option and name, and switching never saves", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  var doc = page.doc;
  doc.getElementById("oo-v52-rx-label").value = "James";
  calculate(page, [-7, -0.75], [-7.75, -1.25]);
  await settle();
  doc.getElementById("oo-v52-midpoint-sharper").click();
  await settle();
  assert.equal(doc.getElementById("oo-v52-profiles").hidden, false, "Add prescription is offered after calculating");

  doc.getElementById("oo-v52-add-prescription").click();
  await settle();
  assert.equal(doc.getElementById("oo-v52-products").hidden, true);
  doc.getElementById("oo-v52-rx-label").value = "Airies";
  calculate(page, [3, -0.75], [2.5, -0.5]);
  await settle();
  var tabs = Array.prototype.map.call(doc.querySelectorAll(".oo-v52-profiles__tab"), function (tab) { return tab.textContent; });
  assert.deepEqual(tabs, ["James", "Airies"]);
  assert.deepEqual(cardPairs(doc), ["R +2.00L +2.00"]);

  doc.querySelector('.oo-v52-profiles__tab[data-profile-id="prescription-1"]').click();
  await settle();
  assert.equal(doc.getElementById("oo-v52-midpoint-sharper").checked, true, "James keeps the Alternative");
  assert.deepEqual(cardPairs(doc), ["R -7.00L -8.00"]);
  assert.equal(doc.getElementById("oo-v52-rx-label").value, "James");
  assert.equal(page.calls.length, 0, "switching prescriptions never saves");

  doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  var confirms = confirmCalls(page);
  assert.equal(confirms.length, 1);
  assert.deepEqual(
    [confirms[0].body.recommendationStrategy, confirms[0].body.recommendedRight, confirms[0].body.recommendedLeft, confirms[0].body.prescriptionLabel],
    ["closer_to_sph", -7, -8, "James"]
  );
  var profiles = page.win.OOV52CalculatorUI.getPrescriptionProfiles();
  assert.deepEqual(JSON.parse(JSON.stringify(profiles.map(function (p) { return [p.localId, p.status, p.displayLabel]; }))), [
    ["prescription-1", "ready", "James"],
    ["prescription-2", "preview", "Airies"]
  ]);

  doc.querySelector('.oo-v52-profiles__tab[data-profile-id="prescription-2"]').click();
  await settle();
  assert.equal(doc.getElementById("oo-v52-midpoint-balanced").checked, true);
  doc.getElementById("oo-v52-midpoint-sharper").click();
  await settle();
  assert.deepEqual(cardPairs(doc), ["R +3.00L +2.00"]);
  doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  confirms = confirmCalls(page);
  assert.equal(confirms.length, 2);
  assert.deepEqual(
    [confirms[1].body.recommendationStrategy, confirms[1].body.recommendedRight, confirms[1].body.recommendedLeft, confirms[1].body.prescriptionLabel],
    ["closer_to_sph", 3, 2, "Airies"]
  );
});

test("multiple prescriptions: an Alternative choice is restored on switching back, not reset to the Balanced default", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  var doc = page.doc;
  doc.getElementById("oo-v52-rx-label").value = "Daniel";
  calculate(page, [-3.75, -0.25], [-3.5, -0.75]);
  await settle();
  doc.getElementById("oo-v52-midpoint-sharper").click();
  await settle();
  doc.getElementById("oo-v52-add-prescription").click();
  await settle();
  doc.getElementById("oo-v52-rx-label").value = "Second";
  calculate(page, [-7, -0.75], [-7.75, -1.25]);
  await settle();
  assert.equal(doc.getElementById("oo-v52-midpoint-balanced").checked, true, "the new prescription gets its own Balanced default");
  doc.querySelector('.oo-v52-profiles__tab[data-profile-id="prescription-1"]').click();
  await settle();
  assert.equal(doc.getElementById("oo-v52-midpoint-sharper").checked, true, "Daniel keeps the Alternative");
  assert.deepEqual(cardPairs(doc), ["R -3.50L -3.50"]);
  assert.equal(page.calls.length, 0);
  doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  assert.deepEqual(
    [confirmCalls(page)[0].body.recommendationStrategy, confirmCalls(page)[0].body.recommendedRight, confirmCalls(page)[0].body.prescriptionLabel],
    ["closer_to_sph", -3.5, "Daniel"]
  );
});

test("automatic mask rendering records no tool use; choosing a mask does", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-3.75, -0.75], [-3.75, -0.75]);
  await settle();
  assert.ok(page.doc.querySelectorAll(".oo-v52-product-card").length > 0);
  assert.deepEqual(page.journey, [], "rendering masks is not a product interaction");
  page.doc.querySelector(".oo-v52-product-card__customize").click();
  await settle();
  assert.ok(page.journey.indexOf("lens_calculator_v53") !== -1);
});

test("no compatible mask: an explicit message is shown instead of an empty area", { skip: skipDom }, async function () {
  var page = await loadCalculator();
  calculate(page, [-3], [3]);
  await settle();
  assert.equal(page.doc.getElementById("oo-v52-products").hidden, false);
  assert.equal(page.doc.getElementById("oo-v52-products-empty").hidden, false);
  assert.match(page.doc.getElementById("oo-v52-products-empty").textContent, /mixes nearsighted and farsighted/);
  assert.equal(page.doc.getElementById("oo-v52-midpoint").hidden, true, "mixed sign never offers a second option");
});
