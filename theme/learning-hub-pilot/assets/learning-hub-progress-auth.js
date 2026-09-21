/**
 * Learning Hub Phase B, Checkpoint 1 -- secure storefront session handoff.
 *
 * Bridges the Customer Account OAuth flow (entirely on
 * oceans-optics-learning-progress.vercel.app) back into this storefront.
 * The Learning Progress JWT is never put in a URL, localStorage, a cookie,
 * or a Shopify line item/metafield -- only sessionStorage, and only after
 * being exchanged for a one-time opaque handoff code the OAuth callback
 * left in the URL fragment (which browsers never send to a server).
 *
 * This file intentionally does NOT touch existing Learning Hub JS, does not
 * render any UI (no My Learning page, no progress bars, no account menu
 * changes -- all deferred to later Phase B checkpoints), and does not force
 * an interactive login for anonymous visitors. It only establishes/restores
 * the session and exposes window.OOLearningProgress for later checkpoints
 * to build on.
 */
(function () {
  "use strict";

  var API_ORIGIN = "https://oceans-optics-learning-progress.vercel.app";
  var SESSION_STORAGE_KEY = "oo_learning_progress_session_v1";
  var HANDOFF_HASH_PARAM = "oo_lp_handoff";

  var state = {
    token: null,
    authenticated: false
  };

  function readStoredToken() {
    try {
      return window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    } catch (error) {
      // sessionStorage can throw in some private-browsing/embedded
      // contexts -- fail closed to anonymous rather than throwing out of
      // bootstrap and breaking the rest of the page.
      return null;
    }
  }

  function storeToken(token) {
    try {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, token);
    } catch (error) {
      // See readStoredToken -- nothing useful to do here either.
    }
  }

  function clearStoredToken() {
    try {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      // See readStoredToken.
    }
  }

  function dispatch(name, detail) {
    // detail must never carry the token -- later UI (quiz/progress
    // widgets) should subscribe to these events without needing, or being
    // able, to read the credential itself.
    document.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
  }

  // Pure: given a location.hash string, returns { code, remainingHash } --
  // does not touch window.location/history itself, so this parsing logic
  // can be reasoned about (and, if a frontend test harness is ever added
  // to this repo, unit-tested) independently of the DOM.
  function parseHandoffFromHash(hash) {
    if (!hash || hash.indexOf(HANDOFF_HASH_PARAM) === -1) {
      return { code: null, remainingHash: hash || "" };
    }

    var params = new URLSearchParams(hash.replace(/^#/, ""));
    var code = params.get(HANDOFF_HASH_PARAM);
    if (!code) {
      return { code: null, remainingHash: hash };
    }

    params.delete(HANDOFF_HASH_PARAM);
    var remaining = params.toString();
    return { code: code, remainingHash: remaining ? "#" + remaining : "" };
  }

  // Removes the handoff from the visible URL immediately, without a
  // reload, and without disturbing any other fragment content that might
  // already be there.
  function extractAndStripHandoffFromLocation() {
    var parsed = parseHandoffFromHash(window.location.hash);
    if (!parsed.code) return null;

    var newUrl = window.location.pathname + window.location.search + parsed.remainingHash;
    window.history.replaceState(null, "", newUrl);
    return parsed.code;
  }

  function exchangeHandoff(code) {
    return fetch(API_ORIGIN + "/api/customer-auth/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handoff: code })
    })
      .then(function (response) {
        if (!response.ok) return null;
        return response.json();
      })
      .then(function (data) {
        if (data && data.authenticated === true && typeof data.token === "string" && data.token.length > 0) {
          return data.token;
        }
        return null;
      })
      .catch(function () {
        return null;
      });
  }

  function requestProgress(token) {
    return fetch(API_ORIGIN + "/api/progress", {
      method: "GET",
      headers: { Authorization: "Bearer " + token }
    })
      .then(function (response) {
        if (response.status === 401) return { ok: false, expired: true, data: null };
        if (!response.ok) return { ok: false, expired: false, data: null };
        return response.json().then(function (data) {
          return { ok: true, expired: false, data: data };
        });
      })
      .catch(function () {
        return { ok: false, expired: false, data: null };
      });
  }

  function setAuthenticated(token) {
    state.token = token;
    state.authenticated = true;
    storeToken(token);
    dispatch("oo:learning-progress-authenticated");
  }

  function setAnonymous() {
    state.token = null;
    state.authenticated = false;
    clearStoredToken();
    dispatch("oo:learning-progress-anonymous");
  }

  // Builds the return_to used by authenticate(): the current relative path
  // (including query string, never a fragment) -- validated again
  // server-side by /api/customer-auth/start before it is ever trusted.
  function buildAuthenticateUrl() {
    var returnTo = window.location.pathname + window.location.search;
    return API_ORIGIN + "/api/customer-auth/start?return_to=" + encodeURIComponent(returnTo);
  }

  function bootstrap() {
    var handoffCode = extractAndStripHandoffFromLocation();

    if (handoffCode) {
      exchangeHandoff(handoffCode).then(function (token) {
        if (token) {
          setAuthenticated(token);
        } else {
          setAnonymous();
        }
        dispatch("oo:learning-progress-ready", { authenticated: state.authenticated });
      });
      return;
    }

    var existingToken = readStoredToken();
    if (!existingToken) {
      setAnonymous();
      dispatch("oo:learning-progress-ready", { authenticated: false });
      return;
    }

    requestProgress(existingToken).then(function (result) {
      if (result.ok) {
        state.token = existingToken;
        state.authenticated = true;
      } else {
        // Covers both an expired/invalid token (401) and any other
        // failure -- either way we do not know the session is good, so we
        // fail closed to anonymous rather than assuming it still works.
        setAnonymous();
      }
      dispatch("oo:learning-progress-ready", { authenticated: state.authenticated });
    });
  }

  window.OOLearningProgress = {
    getToken: function () {
      return state.token;
    },
    isAuthenticated: function () {
      return state.authenticated;
    },
    // Top-level navigation only -- no iframe, no popup, at this checkpoint.
    // Never called automatically; only in response to explicit user intent
    // from later UI.
    authenticate: function () {
      window.location.assign(buildAuthenticateUrl());
    },
    clearSession: function () {
      setAnonymous();
    },
    fetchProgress: function () {
      if (!state.token) return Promise.resolve({ ok: false, expired: false, data: null });
      return requestProgress(state.token).then(function (result) {
        if (!result.ok && result.expired) setAnonymous();
        return result;
      });
    }
  };

  bootstrap();
})();
