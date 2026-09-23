/*
 * Tests for learning-hub-progress-tracking.js's page-view event detection
 * and wiring -- runs the real, unmodified asset file (via the Function
 * constructor, same technique as learning-hub-my-learning-init.test.js)
 * against a minimal fake window/document, with the global `fetch` this
 * script calls directly (not via a window.fetch reference) stubbed out so
 * no real network call happens.
 *
 * Run: node --test theme/learning-hub-pilot/tests/
 */
var test = require("node:test").test;
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

var SOURCE = fs.readFileSync(path.join(__dirname, "..", "assets", "learning-hub-progress-tracking.js"), "utf8");

function createFakeDoc() {
  var listeners = {};
  return {
    querySelector: function () {
      return null; // no lesson article on homepage/category/my-learning pages
    },
    querySelectorAll: function () {
      return [];
    },
    addEventListener: function (name, handler) {
      listeners[name] = listeners[name] || [];
      listeners[name].push(handler);
    },
    dispatchEvent: function (event) {
      (listeners[event.type] || []).forEach(function (handler) {
        handler(event);
      });
    }
  };
}

function createFakeProgress(token) {
  return {
    isAuthenticated: function () {
      return !!token;
    },
    getToken: function () {
      return token;
    }
  };
}

function runTrackingScript(win, doc) {
  var run = new Function("window", "document", SOURCE); // eslint-disable-line no-new-func
  run(win, doc);
}

function withStubbedFetch(fn) {
  var calls = [];
  var originalFetch = globalThis.fetch;
  globalThis.fetch = function (url, init) {
    calls.push({ url: url, init: init });
    return Promise.resolve({ ok: true, json: function () { return Promise.resolve({}); } });
  };
  try {
    return fn(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("fires learning_hub_viewed on the Learning Hub homepage path", function () {
  withStubbedFetch(function (calls) {
    var doc = createFakeDoc();
    var win = { location: { pathname: "/pages/learn" }, OOLearningProgress: createFakeProgress("tok") };
    runTrackingScript(win, doc);
    doc.dispatchEvent({ type: "oo:learning-progress-ready" });

    var eventCall = calls.find(function (c) { return c.url.indexOf("/api/learning-event") !== -1; });
    assert.ok(eventCall, "must POST to /api/learning-event");
    var body = JSON.parse(eventCall.init.body);
    assert.equal(body.event_type, "learning_hub_viewed");
  });
});

test("fires category_viewed with the category handle parsed from the URL", function () {
  withStubbedFetch(function (calls) {
    var doc = createFakeDoc();
    var win = { location: { pathname: "/pages/learn-category/gear-masks-vision" }, OOLearningProgress: createFakeProgress("tok") };
    runTrackingScript(win, doc);
    doc.dispatchEvent({ type: "oo:learning-progress-ready" });

    var eventCall = calls.find(function (c) { return c.url.indexOf("/api/learning-event") !== -1; });
    var body = JSON.parse(eventCall.init.body);
    assert.equal(body.event_type, "category_viewed");
    assert.equal(body.category_handle, "gear-masks-vision");
  });
});

test("fires progress_dashboard_viewed on the My Learning Progress page", function () {
  withStubbedFetch(function (calls) {
    var doc = createFakeDoc();
    var win = { location: { pathname: "/pages/my-learning" }, OOLearningProgress: createFakeProgress("tok") };
    runTrackingScript(win, doc);
    doc.dispatchEvent({ type: "oo:learning-progress-ready" });

    var eventCall = calls.find(function (c) { return c.url.indexOf("/api/learning-event") !== -1; });
    var body = JSON.parse(eventCall.init.body);
    assert.equal(body.event_type, "progress_dashboard_viewed");
  });
});

test("does not fire any page-view event on a lesson page (tracked separately via /api/lesson/viewed)", function () {
  withStubbedFetch(function (calls) {
    var doc = createFakeDoc();
    var win = { location: { pathname: "/pages/learn/choosing-a-mask" }, OOLearningProgress: createFakeProgress("tok") };
    runTrackingScript(win, doc);
    doc.dispatchEvent({ type: "oo:learning-progress-ready" });

    var eventCall = calls.find(function (c) { return c.url.indexOf("/api/learning-event") !== -1; });
    assert.equal(eventCall, undefined);
  });
});

test("does not fire a page-view event for an anonymous visitor", function () {
  withStubbedFetch(function (calls) {
    var doc = createFakeDoc();
    var win = { location: { pathname: "/pages/learn" }, OOLearningProgress: createFakeProgress(null) };
    runTrackingScript(win, doc);
    doc.dispatchEvent({ type: "oo:learning-progress-ready" });

    assert.equal(calls.length, 0);
  });
});

test("only fires once per page load even if oo:learning-progress-ready dispatches more than once", function () {
  withStubbedFetch(function (calls) {
    var doc = createFakeDoc();
    var win = { location: { pathname: "/pages/learn" }, OOLearningProgress: createFakeProgress("tok") };
    runTrackingScript(win, doc);
    doc.dispatchEvent({ type: "oo:learning-progress-ready" });
    doc.dispatchEvent({ type: "oo:learning-progress-ready" });

    var eventCalls = calls.filter(function (c) { return c.url.indexOf("/api/learning-event") !== -1; });
    assert.equal(eventCalls.length, 1, "the client-side per-page-load guard must prevent firing twice on the same load");
  });
});

test("an unrecognized path fires no page-view event", function () {
  withStubbedFetch(function (calls) {
    var doc = createFakeDoc();
    var win = { location: { pathname: "/pages/some-other-page" }, OOLearningProgress: createFakeProgress("tok") };
    runTrackingScript(win, doc);
    doc.dispatchEvent({ type: "oo:learning-progress-ready" });

    var eventCall = calls.find(function (c) { return c.url.indexOf("/api/learning-event") !== -1; });
    assert.equal(eventCall, undefined);
  });
});
