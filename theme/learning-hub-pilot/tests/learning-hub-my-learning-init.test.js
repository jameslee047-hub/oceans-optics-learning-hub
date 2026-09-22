/*
 * Regression tests for the My Learning dashboard's initialization race:
 * window.OOLearningProgress.isReady() can already be true (an anonymous
 * visitor's bootstrap dispatches oo:learning-progress-ready SYNCHRONOUSLY,
 * before this later <script defer> even starts executing) by the time
 * learning-hub-my-learning.js runs. The dashboard must detect that
 * immediately rather than only listening for an event that already fired
 * and is gone, AND must not double-initialize if both paths somehow fire.
 *
 * Runs the real, unmodified asset file (via the Function constructor, same
 * technique as learning-hub-catalogue-data.test.js) against a minimal
 * fake window/document -- just enough surface for this file's actual
 * DOM calls (getElementById, querySelectorAll, addEventListener,
 * readyState), not a full DOM/jsdom dependency.
 *
 * Run: node --test theme/learning-hub-pilot/tests/
 */
var test = require("node:test").test;
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

var SOURCE = fs.readFileSync(path.join(__dirname, "..", "assets", "learning-hub-my-learning.js"), "utf8");

var STATE_IDS = ["MyLearningLoading", "MyLearningLoggedOut", "MyLearningError", "MyLearningDashboard"];

function createFakeDom() {
  var elements = {};
  STATE_IDS.forEach(function (id) {
    elements[id] = { id: id, hidden: id !== "MyLearningLoading", innerHTML: "" };
  });

  var listeners = {};
  var doc = {
    readyState: "complete",
    getElementById: function (id) {
      return elements[id] || null;
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

  return { doc: doc, elements: elements, fireReady: function () { doc.dispatchEvent({ type: "oo:learning-progress-ready" }); } };
}

function runDashboardScript(win, doc) {
  var run = new Function("window", "document", SOURCE); // eslint-disable-line no-new-func
  run(win, doc);
}

function flushMicrotasks() {
  return new Promise(function (resolve) {
    setTimeout(resolve, 0);
  });
}

test("initializes immediately when isReady() is already true (the anonymous fast-path race)", function () {
  var fetchProgressCalls = 0;
  var win = {
    OOLearningProgress: {
      isReady: function () {
        return true;
      },
      isAuthenticated: function () {
        return false;
      },
      authenticate: function () {},
      fetchProgress: function () {
        fetchProgressCalls += 1;
        return Promise.resolve({ ok: false, expired: false, data: null });
      }
    }
  };
  var dom = createFakeDom();

  runDashboardScript(win, dom.doc);

  assert.equal(dom.elements.MyLearningLoading.hidden, true);
  assert.equal(dom.elements.MyLearningLoggedOut.hidden, false);
  assert.equal(fetchProgressCalls, 0, "an anonymous visitor must never trigger fetchProgress");
});

test("waits for oo:learning-progress-ready and initializes once it fires, when isReady() starts false", function () {
  var ready = false;
  var win = {
    OOLearningProgress: {
      isReady: function () {
        return ready;
      },
      isAuthenticated: function () {
        return false;
      },
      authenticate: function () {}
    }
  };
  var dom = createFakeDom();

  runDashboardScript(win, dom.doc);

  // Not ready yet at script-load time -- must still be on the loading state.
  assert.equal(dom.elements.MyLearningLoading.hidden, false);
  assert.equal(dom.elements.MyLearningLoggedOut.hidden, true);

  ready = true;
  dom.fireReady();

  assert.equal(dom.elements.MyLearningLoading.hidden, true);
  assert.equal(dom.elements.MyLearningLoggedOut.hidden, false);
});

test("never remains on the loading state for a logged-out visitor either way", function () {
  ["immediate", "event"].forEach(function (path) {
    var ready = path === "immediate";
    var win = {
      OOLearningProgress: {
        isReady: function () {
          return ready;
        },
        isAuthenticated: function () {
          return false;
        },
        authenticate: function () {}
      }
    };
    var dom = createFakeDom();
    runDashboardScript(win, dom.doc);
    if (path === "event") dom.fireReady();

    assert.equal(dom.elements.MyLearningLoading.hidden, true, path + ": must leave the loading state");
  });
});

test("does not double-initialize when isReady() is true immediately AND the ready event also fires", function () {
  var isAuthenticatedCalls = 0;
  var win = {
    OOLearningProgress: {
      isReady: function () {
        return true;
      },
      isAuthenticated: function () {
        isAuthenticatedCalls += 1;
        return false;
      },
      authenticate: function () {}
    }
  };
  var dom = createFakeDom();

  runDashboardScript(win, dom.doc);
  assert.equal(isAuthenticatedCalls, 1);

  // Simulate a leftover/duplicate dispatch -- must be a no-op.
  dom.fireReady();
  assert.equal(isAuthenticatedCalls, 1, "a second ready dispatch must not re-run dashboard initialization");
});

test("an authenticated visitor with a working session lands on the dashboard state", async function () {
  var catalogue = { categories: [], lessons: [] };
  var Core = require("../assets/learning-hub-my-learning-core.js");
  var win = {
    OOLearningHubMyLearningCore: Core,
    OOLearningHubCatalogueData: catalogue,
    OOLearningProgress: {
      isReady: function () {
        return true;
      },
      isAuthenticated: function () {
        return true;
      },
      authenticate: function () {},
      fetchProgress: function () {
        return Promise.resolve({ ok: true, expired: false, data: { lessons: [], quizzes: [] } });
      }
    }
  };
  var dom = createFakeDom();

  runDashboardScript(win, dom.doc);
  await flushMicrotasks();

  assert.equal(dom.elements.MyLearningDashboard.hidden, false);
  assert.equal(dom.elements.MyLearningLoading.hidden, true);
  assert.ok(dom.elements.MyLearningDashboard.innerHTML.length > 0);
});

test("an expired session falls back to the logged-out state, not an error", async function () {
  var win = {
    OOLearningProgress: {
      isReady: function () {
        return true;
      },
      isAuthenticated: function () {
        return true;
      },
      authenticate: function () {},
      fetchProgress: function () {
        return Promise.resolve({ ok: false, expired: true, data: null });
      }
    }
  };
  var dom = createFakeDom();

  runDashboardScript(win, dom.doc);
  await flushMicrotasks();

  assert.equal(dom.elements.MyLearningLoggedOut.hidden, false);
  assert.equal(dom.elements.MyLearningError.hidden, true);
});

test("a genuine fetch failure while authenticated shows the error/retry state, not logged-out", async function () {
  var win = {
    OOLearningProgress: {
      isReady: function () {
        return true;
      },
      isAuthenticated: function () {
        return true;
      },
      authenticate: function () {},
      fetchProgress: function () {
        return Promise.resolve({ ok: false, expired: false, data: null });
      }
    }
  };
  var dom = createFakeDom();

  runDashboardScript(win, dom.doc);
  await flushMicrotasks();

  assert.equal(dom.elements.MyLearningError.hidden, false);
  assert.equal(dom.elements.MyLearningLoggedOut.hidden, true);
});
