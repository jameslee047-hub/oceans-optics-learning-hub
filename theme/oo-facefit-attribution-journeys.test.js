"use strict";

// FaceFit attribution rollout (facefit_v53): runs the REAL shared tool-attribution
// snippet (both scripts) in jsdom across consecutive page loads that share storage,
// and checks the journeys the rollout must support, the cart attributes it writes
// and which session the add-to-cart analytics event reports.

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var JSDOM = require("jsdom").JSDOM;
var Handoff = require("./base/assets/oo-rx-product-handoff.js");

var STORE = "https://oceansoptics.com";
var EVENT_ENDPOINT = "https://quiz.oceansoptics.com/api/quiz/shopify-event";
var snippet = fs.readFileSync(path.join(__dirname, "base/snippets/oo-quiz-attribution.liquid"), "utf8")
  .replace("{% if product %}{{ product.id | json }}{% else %}null{% endif %}", "987654")
  .replace("{% if product %}{{ product.title | json }}{% else %}null{% endif %}", '"Rx Obsidian"');

function settle() {
  return new Promise(function (resolve) { setTimeout(resolve, 20); });
}

// One storefront page load. `browser` carries localStorage / sessionStorage /
// the cart's attributes between loads, like one shopper's browser.
async function load(browser, search) {
  var calls = [];
  var dom = new JSDOM("<!doctype html><html><head></head><body><h1>Rx Obsidian</h1></body></html>", {
    url: STORE + "/products/rx-obsidian" + (search || ""),
    runScripts: "dangerously",
    beforeParse: function (window) {
      Object.keys(browser.local).forEach(function (k) { window.localStorage.setItem(k, browser.local[k]); });
      Object.keys(browser.session).forEach(function (k) { window.sessionStorage.setItem(k, browser.session[k]); });
      window.document.cookie = "cart=c1";
      window.fetch = function (url, init) {
        var body = init && init.body ? JSON.parse(init.body) : null;
        calls.push({ url: String(url), body: body });
        if (String(url) === "/cart/update.js") Object.assign(browser.cart, body.attributes);
        return Promise.resolve({
          ok: true,
          clone: function () { return { json: function () { return Promise.resolve({ id: 111, product_id: 987654, product_title: "Rx Obsidian", quantity: 1 }); } }; }
        });
      };
    }
  });
  var w = dom.window;
  var script = w.document.createElement("div");
  script.innerHTML = snippet;
  // innerHTML does not execute scripts: re-create each one so it runs.
  Array.from(script.querySelectorAll("script")).forEach(function (old) {
    var s = w.document.createElement("script");
    s.textContent = old.textContent;
    w.document.body.appendChild(s);
  });
  await settle();
  var page = {
    window: w,
    calls: calls,
    journey: w.OOSourceJourney,
    // quantity varies so two genuine adds are not merged by the snippet's 2.5 s duplicate guard
    addToCart: async function (quantity) {
      await w.fetch("/cart/add.js", { method: "POST", body: JSON.stringify({ id: 111, quantity: quantity || 1, product_id: 987654 }) });
      await settle();
      var events = calls.filter(function (c) { return c.url === EVENT_ENDPOINT; });
      return events.length ? events[events.length - 1].body : null;
    },
    save: function () {
      browser.local = {}; browser.session = {};
      for (var i = 0; i < w.localStorage.length; i++) { var k = w.localStorage.key(i); browser.local[k] = w.localStorage.getItem(k); }
      for (var j = 0; j < w.sessionStorage.length; j++) { var s = w.sessionStorage.key(j); browser.session[s] = w.sessionStorage.getItem(s); }
    }
  };
  return page;
}

function newBrowser() {
  return { local: {}, session: {}, cart: {} };
}

test("Quiz only: quiz_v53 journey, quiz session on the cart and on add-to-cart", async function () {
  var b = newBrowser();
  var p = await load(b, "?quiz_session_id=qs_quiz1&oo_source=quiz_v53");
  assert.equal(b.cart._oo_first_source, "quiz_v53");
  assert.equal(b.cart._oo_source_history, "quiz_v53");
  assert.equal(b.cart.quiz_session_id, "qs_quiz1");
  assert.equal(b.cart.facefit_session_id, undefined);
  var event = await p.addToCart();
  assert.equal(event.quiz_session_id, "qs_quiz1");
  assert.equal(event.facefit_session_id, undefined);
});

test("FaceFit only: facefit_v53 journey, ffrx_ session on the cart and on add-to-cart", async function () {
  var b = newBrowser();
  var p = await load(b, "?facefit_session_id=ffrx_abc123&oo_source=facefit_v53");
  assert.equal(b.cart._oo_first_source, "facefit_v53");
  assert.equal(b.cart._oo_source_history, "facefit_v53");
  assert.equal(b.cart.facefit_session_id, "ffrx_abc123");
  assert.equal(b.cart.quiz_session_id, undefined);
  var event = await p.addToCart();
  assert.equal(event.event, "add_to_cart");
  assert.equal(event.facefit_session_id, "ffrx_abc123");
  assert.equal(event.quiz_session_id, undefined);
});

test("Quiz → FaceFit: history kept, FaceFit becomes the active session; the stale qs_ never wins", async function () {
  var b = newBrowser();
  var quiz = await load(b, "?quiz_session_id=qs_old&oo_source=quiz_v53");
  quiz.save();
  var ff = await load(b, "?facefit_session_id=ffrx_new&oo_source=facefit_v53");
  assert.equal(b.cart._oo_first_source, "quiz_v53");
  assert.equal(b.cart._oo_source_history, "quiz_v53,facefit_v53");
  assert.equal(b.cart.facefit_session_id, "ffrx_new");
  var event = await ff.addToCart();
  assert.equal(event.facefit_session_id, "ffrx_new");
  assert.equal(event.quiz_session_id, undefined, "stale Quiz session must not be reported for a FaceFit add");
  // a later plain page (no URL attribution) still reports the active FaceFit session
  ff.save();
  var later = await load(b, "");
  var again = await later.addToCart(2);
  assert.equal(again.facefit_session_id, "ffrx_new");
  assert.equal(again.quiz_session_id, undefined);
  assert.equal(later.journey.snapshot().source_history_text, "quiz_v53,facefit_v53");
});

test("FaceFit → Lens Calculator: calculator use is appended, FaceFit stays first", async function () {
  var b = newBrowser();
  var ff = await load(b, "?facefit_session_id=ffrx_lc&oo_source=facefit_v53");
  ff.save();
  var calc = await load(b, "");
  var view = calc.journey.record("lens_calculator_v53");
  await settle();
  assert.equal(view.first_source, "facefit_v53");
  assert.equal(view.source_history_text, "facefit_v53,lens_calculator_v53");
  assert.equal(b.cart._oo_source_history, "facefit_v53,lens_calculator_v53");
});

test("Quiz → FaceFit → Product Rx Checker: three tools in order, none removed", async function () {
  var b = newBrowser();
  var q = await load(b, "?quiz_session_id=qs_a&oo_source=quiz_v53");
  q.save();
  var f = await load(b, "?facefit_session_id=ffrx_b&oo_source=facefit_v53");
  f.save();
  var c = await load(b, "");
  var view = c.journey.record("product_rx_checker");
  await settle();
  assert.equal(view.first_source, "quiz_v53");
  assert.equal(view.source_history_text, "quiz_v53,facefit_v53,product_rx_checker");
  assert.equal(b.cart._oo_first_source, "quiz_v53");
  assert.equal(b.cart._oo_source_history, "quiz_v53,facefit_v53,product_rx_checker");
});

test("FaceFit → Quiz again: the newer Quiz arrival becomes active, history is not reordered", async function () {
  var b = newBrowser();
  var f = await load(b, "?facefit_session_id=ffrx_first&oo_source=facefit_v53");
  f.save();
  var q = await load(b, "?quiz_session_id=qs_second&oo_source=quiz_v53");
  var event = await q.addToCart();
  assert.equal(event.quiz_session_id, "qs_second");
  assert.equal(event.facefit_session_id, undefined);
  assert.equal(q.journey.snapshot().source_history_text, "facefit_v53,quiz_v53");
});

test("the live product handoff writes facefit_v53 as _oo_source with the shared journey", async function () {
  var b = newBrowser();
  var q = await load(b, "?quiz_session_id=qs_h&oo_source=quiz_v53");
  q.save();
  var p = await load(b, "?facefit_session_id=ffrx_h&oo_source=facefit_v53&oo_rx=28bf81b0-d4fb-4a51-a2db-d262dbf29cb8");
  assert.equal(Handoff.readSource(p.window.location.search), "facefit_v53");
  var form = p.window.document.createElement("form");
  form.setAttribute("action", "/cart/add");
  p.window.document.body.appendChild(form);
  Handoff.injectShopifyProperties(p.window.document, form, { configId: "28bf81b0-d4fb-4a51-a2db-d262dbf29cb8", recommendedRight: -2.5, recommendedLeft: -1.5, prescriptionLabel: null }, "facefit_v53");
  var values = {};
  Array.from(form.querySelectorAll("input")).forEach(function (i) { values[i.name] = i.value; });
  assert.equal(values["properties[_oo_source]"], "facefit_v53");
  assert.equal(values["properties[_oo_first_source]"], "quiz_v53");
  assert.equal(values["properties[_oo_source_history]"], "quiz_v53,facefit_v53");
  assert.ok(values["properties[_oo_rx_handoff]"], "durable handoff slot is still written");
});
