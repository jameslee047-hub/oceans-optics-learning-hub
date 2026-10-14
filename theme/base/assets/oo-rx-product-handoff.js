(function (root, factory) {
  "use strict";

  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (!root || !root.document) return;

  root.OORxProductHandoff = api;
  var mount = function () {
    api.start(root.document, {
      search: root.location.search,
      fetch: root.fetch.bind(root)
    });
  };
  if (root.document.readyState === "loading") {
    root.document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var BACKEND_URL = "https://oceans-optics-rx-test.vercel.app";
  var UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  var POWER_EPSILON = 1e-9;
  var UPLOAD_OBSERVER_PROPERTY = "__ooRxHandoffUploadObserver";
  // Per page (window): the confirmed handoff whose properties belong on this
  // product's add-to-cart line, and the one-time submit / history hooks.
  var ACTIVE_PROPERTY = "__ooRxHandoffActive";
  var HOOKS_PROPERTY = "__ooRxHandoffHooks";
  // Avis can render long after DOMContentLoaded on slow mobile connections;
  // giving up early left the customer choosing lenses with no saved config.
  var AVIS_WAIT_MS = 120000;
  // Retry delays for transient summary failures (network, 408, 429, 5xx).
  var SUMMARY_RETRY_DELAYS = [700, 2000];
  // Per tab: "<pathname>|<configId>" handoffs already added to the cart.
  // Opaque ids only; it never activates a handoff, it only stops a completed
  // one being attached to a later mask with different lenses.
  var ADDED_STORAGE_KEY = "oo_rx_handoff_added";
  var ADDED_LIMIT = 20;
  // Quiz attribution parameters kept beside oo_rx on this product's URL.
  var KEPT_PARAMETERS = ["quiz_session_id", "quiz_product_id", "_oo_v53_snapshot"];
  // Purchase sources that may become the hidden _oo_source line-item property.
  // Only these exact values are accepted, from the oo_source parameter or from
  // an on-page tool; quiz_v53 is the Quiz / Face Fit handoff. Reserved: face_fit.
  var ALLOWED_SOURCES = ["lens_calculator_v53", "product_rx_checker", "quiz_v53"];
  var FAILURE_MESSAGE = "We couldn't load your saved prescription. Please select your lens strengths or upload your prescription below.";

  function isUuid(value) {
    return UUID_PATTERN.test(String(value || "").trim());
  }

  function readConfigId(search) {
    var params = new URLSearchParams(search || "");
    if (!params.has("oo_rx")) return null;
    return String(params.get("oo_rx") || "").trim().toLowerCase();
  }

  function readSource(search) {
    var value = String(new URLSearchParams(search || "").get("oo_source") || "").trim();
    return ALLOWED_SOURCES.indexOf(value) >= 0 ? value : null;
  }

  function hasConfigParameter(search) {
    return new URLSearchParams(search || "").has("oo_rx");
  }

  function finitePower(value, fieldName) {
    if (typeof value !== "number" && typeof value !== "string") {
      throw new Error(fieldName + " is missing.");
    }
    if (typeof value === "string" && !value.trim()) {
      throw new Error(fieldName + " is missing.");
    }
    var power = Number(value);
    if (!Number.isFinite(power)) throw new Error(fieldName + " is invalid.");
    return Object.is(power, -0) ? 0 : power;
  }

  function validateSummary(payload, requestedId) {
    if (!payload || typeof payload !== "object") throw new Error("The saved prescription response is invalid.");
    var configId = String(payload.configId || "").trim().toLowerCase();
    if (!isUuid(configId) || configId !== String(requestedId || "").trim().toLowerCase()) {
      throw new Error("The saved prescription does not match this link.");
    }
    if (payload.status !== "confirmed") throw new Error("The saved prescription is not confirmed.");
    if (typeof payload.prescriptionAttached !== "boolean") {
      throw new Error("The saved prescription attachment state is invalid.");
    }
    var label = typeof payload.prescriptionLabel === "string"
      ? payload.prescriptionLabel.trim()
      : "";

    return {
      configId: configId,
      status: "confirmed",
      recommendedRight: finitePower(payload.recommendedRight, "Right lens"),
      recommendedLeft: finitePower(payload.recommendedLeft, "Left lens"),
      prescriptionAttached: payload.prescriptionAttached,
      prescriptionLabel: label || null
    };
  }

  function parseAvisPower(value) {
    var text = String(value === undefined || value === null ? "" : value).trim();
    if (!text) return null;
    if (/no correction/i.test(text)) return 0;
    var match = text.match(/[+-]?(?:\d+(?:\.\d+)?|\.\d+)/);
    if (!match) return null;
    var power = Number(match[0]);
    return Number.isFinite(power) ? power : null;
  }

  function findPowerOption(select, power) {
    var expected = finitePower(power, "Lens power");
    return Array.from(select && select.options ? select.options : []).find(function (option) {
      var parsed = parseAvisPower(option.value || option.textContent);
      return parsed !== null && Math.abs(parsed - expected) < POWER_EPSILON;
    }) || null;
  }

  function formatPower(power) {
    var value = finitePower(power, "Lens power");
    if (Math.abs(value) < POWER_EPSILON) return "0.00";
    return (value > 0 ? "+" : "") + value.toFixed(2);
  }

  function eventFor(select, type) {
    var view = select.ownerDocument && select.ownerDocument.defaultView;
    var EventConstructor = view && view.Event;
    if (typeof EventConstructor === "function") return new EventConstructor(type, { bubbles: true });
    return { type: type, bubbles: true };
  }

  function setSelectValue(select, option) {
    select.value = option.value;
    select.dispatchEvent(eventFor(select, "input"));
    select.dispatchEvent(eventFor(select, "change"));
  }

  function findProductForm(doc) {
    var forms = Array.from(doc.querySelectorAll('form[action*="/cart/add"]'));
    return forms.find(function (form) {
      return form.getAttribute("data-type") === "add-to-cart-form" && form.querySelector('button[name="add"]');
    }) || forms.find(function (form) {
      return form.querySelector('button[name="add"]') && !form.classList.contains("installment");
    }) || null;
  }

  function findAvisControls(doc) {
    var right = doc.querySelector('.app-avis-product-options-block select[name="(OD) Right"]') ||
      doc.querySelector('select[name="(OD) Right"]');
    var left = doc.querySelector('.app-avis-product-options-block select[name="(OS) Left"]') ||
      doc.querySelector('select[name="(OS) Left"]');
    if (!right || !left) return null;
    var root = right.closest(".avpoptions-container__v2") ||
      right.closest(".app-avis-product-options-block") ||
      right.parentElement;
    var form = findProductForm(doc);
    if (!root || !form || (typeof root.contains === "function" && !root.contains(left))) return null;
    var confirmedRoot = root.closest("product-info") ||
      root.closest(".product__info-container") ||
      root;
    var upload = confirmedRoot.querySelector('input[name="Upload"]');
    var file = confirmedRoot.querySelector('input[type="file"].avp-file__input');
    var wrappers = [
      upload && upload.closest(".avp-option"),
      file && file.closest(".avp-option")
    ].filter(function (wrapper, index, all) {
      return wrapper && all.indexOf(wrapper) === index;
    });

    return {
      root: root,
      confirmedRoot: confirmedRoot,
      right: right,
      left: left,
      form: form,
      variantInput: form.querySelector('input[name="id"]'),
      rightProperty: form.querySelector('input[name="properties[(OD) Right]"]'),
      leftProperty: form.querySelector('input[name="properties[(OS) Left]"]'),
      uploadWrappers: wrappers
    };
  }

  function waitForAvisControls(doc, timeoutMs) {
    var timeout = typeof timeoutMs === "number" ? timeoutMs : 15000;
    var existing = findAvisControls(doc);
    if (existing) return Promise.resolve(existing);

    return new Promise(function (resolve, reject) {
      var view = doc.defaultView;
      var finished = false;
      var observer = null;
      var interval = null;
      var timer = null;

      function finish(error, controls) {
        if (finished) return;
        finished = true;
        if (observer) observer.disconnect();
        if (interval) (view || globalThis).clearInterval(interval);
        if (timer) (view || globalThis).clearTimeout(timer);
        if (error) reject(error);
        else resolve(controls);
      }

      function inspect() {
        var controls = findAvisControls(doc);
        if (controls) finish(null, controls);
      }

      if (view && typeof view.MutationObserver === "function") {
        observer = new view.MutationObserver(inspect);
        observer.observe(doc.documentElement, { childList: true, subtree: true });
      } else {
        interval = (view || globalThis).setInterval(inspect, 100);
      }
      timer = (view || globalThis).setTimeout(function () {
        finish(new Error("Avis prescription controls did not load."));
      }, timeout);
      inspect();
    });
  }

  function verifyAvisProperty(input, expected, eye) {
    if (!input) throw new Error("Avis did not create the " + eye + " Shopify property.");
    var actual = parseAvisPower(input.value);
    if (actual === null || Math.abs(actual - expected) >= POWER_EPSILON) {
      throw new Error("Avis did not accept the " + eye + " lens strength.");
    }
  }

  function applyAvisValues(controls, summary) {
    var rightOption = findPowerOption(controls.right, summary.recommendedRight);
    var leftOption = findPowerOption(controls.left, summary.recommendedLeft);
    if (!rightOption || !leftOption) {
      throw new Error("This mask does not offer both saved lens strengths.");
    }

    var originalRight = controls.right.value;
    var originalLeft = controls.left.value;
    var originalVariant = controls.variantInput && controls.variantInput.value;
    var rolledBack = false;

    function rollback() {
      if (rolledBack) return;
      rolledBack = true;
      setSelectValue(controls.right, { value: originalRight });
      setSelectValue(controls.left, { value: originalLeft });
    }

    try {
      setSelectValue(controls.right, rightOption);
      setSelectValue(controls.left, leftOption);
      verifyAvisProperty(controls.rightProperty, summary.recommendedRight, "right-eye");
      verifyAvisProperty(controls.leftProperty, summary.recommendedLeft, "left-eye");
      if (controls.variantInput && controls.variantInput.value !== originalVariant) {
        throw new Error("The selected mask colour changed while loading the prescription.");
      }
      return { rollback: rollback, rightOption: rightOption, leftOption: leftOption };
    } catch (error) {
      rollback();
      throw error;
    }
  }

  function upsertHiddenProperty(doc, form, name, value) {
    var selector = 'input[name="' + name + '"]';
    var input = form.querySelector(selector);
    if (!input) {
      input = doc.createElement("input");
      input.type = "hidden";
      input.name = name;
      form.appendChild(input);
    }
    input.value = value;
    input.setAttribute("data-oo-rx-handoff-property", "true");
    return input;
  }

  function viewOf(node) {
    var doc = node && (node.ownerDocument || (node.defaultView ? node : null));
    return doc && doc.defaultView ? doc.defaultView : null;
  }

  function removeInjectedProperties(form) {
    Array.from(form.querySelectorAll('input[data-oo-rx-handoff-property="true"]')).forEach(function (input) {
      input.remove();
    });
    // A failed or cleared handoff must never be re-applied at submit time.
    var view = viewOf(form);
    if (view) view[ACTIVE_PROPERTY] = null;
  }

  // The shared storefront journey (window.OOSourceJourney, defined in the
  // oo-quiz-attribution snippet), when the page has it.
  function sourceJourney(doc) {
    var view = doc && doc.defaultView;
    var journey = view && view.OOSourceJourney;
    return journey && typeof journey.record === "function" ? journey : null;
  }

  // The hidden line-item properties for a confirmed handoff, in order.
  function handoffProperties(doc, summary, source) {
    var properties = [["properties[_oo_rx_config]", summary.configId]];
    if (ALLOWED_SOURCES.indexOf(source) >= 0) {
      // _oo_source stays the tool that applied this config (conversion
      // source). The journey first records that tool, so earlier tools are
      // kept in the first-source and history properties alongside it.
      properties.push(["properties[_oo_source]", source]);
      var journey = sourceJourney(doc);
      if (journey) {
        var view = journey.record(source);
        if (view && view.first_source) {
          properties.push(["properties[_oo_first_source]", view.first_source]);
        }
        if (view && view.source_history_text) {
          properties.push(["properties[_oo_source_history]", view.source_history_text]);
        }
      }
    }
    if (summary.prescriptionLabel) {
      properties.push(["properties[Prescription]", summary.prescriptionLabel]);
    }
    // The calculator/quiz creates this immutable historical snapshot before
    // navigating to the mask. Keep it on the line item; final lens selectors
    // remain the ordinary (OD)/(OS) properties supplied by the product form.
    var view = doc && doc.defaultView;
    var snapshot = new URLSearchParams(view && view.location ? view.location.search || "" : "").get("_oo_v53_snapshot");
    if (snapshot && snapshot.length <= 4000) {
      try {
        var parsed = JSON.parse(snapshot);
        if (parsed && /^5\.3(?:\.|$)/.test(String(parsed.calculatorVersion || ""))) {
          properties.push(["properties[_oo_v53_snapshot]", snapshot]);
        }
      } catch (error) {}
    }
    return properties;
  }

  function isInjected(input) {
    return input.getAttribute("data-oo-rx-handoff-property") === "true";
  }

  // Writes exactly this handoff's properties: one input per name, and no
  // property left over from an earlier handoff on the same form (a config
  // with no label must not keep the previous config's Prescription label).
  // Safe to repeat; a second call changes nothing.
  function writeProperties(doc, form, properties) {
    var names = properties.map(function (entry) { return entry[0]; });
    Array.from(form.querySelectorAll('input[data-oo-rx-handoff-property="true"]')).forEach(function (input) {
      if (names.indexOf(input.name) === -1) input.remove();
    });
    properties.forEach(function (entry) {
      var input = upsertHiddenProperty(doc, form, entry[0], entry[1]);
      Array.from(form.querySelectorAll('input[name="' + entry[0] + '"]')).forEach(function (other) {
        if (other !== input && (isInjected(other) || /^properties\[_oo_/.test(other.name))) other.remove();
      });
    });
  }

  // Removes every OO handoff property from the form, keeping the handoff.
  function clearProperties(form) {
    Array.from(form.querySelectorAll("input")).forEach(function (input) {
      if (isInjected(input) || /^properties\[_oo_/.test(input.name)) input.remove();
    });
  }

  // The lens pair the form will submit, from Avis' property mirrors (the last
  // input wins, as in the cart request). null for an eye with no value.
  function formLensPair(form) {
    function read(name) {
      var inputs = Array.from(form.querySelectorAll('input[name="properties[' + name + ']"]'));
      return inputs.length ? parseAvisPower(inputs[inputs.length - 1].value) : null;
    }
    return { right: read("(OD) Right"), left: read("(OS) Left") };
  }

  function differs(actual, expected) {
    return actual !== null && Math.abs(actual - expected) >= POWER_EPSILON;
  }

  function pairDiffers(pair, active) {
    return differs(pair.right, active.right) || differs(pair.left, active.left);
  }

  // Whether the active handoff belongs on this submission. Until this config
  // has been added to the cart from this product, it always does (the
  // customer arrived with it, even if they adjust a lens). Once it has been
  // added, it only follows the same lenses again: a different pair is a
  // different mask, and must not inherit the completed handoff.
  function handoffAppliesTo(form, active) {
    if (!active) return false;
    if (!active.added) return true;
    return !pairDiffers(formLensPair(form), active);
  }

  function addedKey(pathname, configId) {
    return String(pathname) + "|" + String(configId);
  }

  function readAdded(view) {
    try {
      var list = JSON.parse(view.sessionStorage.getItem(ADDED_STORAGE_KEY) || "[]");
      return Array.isArray(list) ? list.filter(function (item) { return typeof item === "string"; }) : [];
    } catch (error) {
      return [];
    }
  }

  function wasAdded(view, pathname, configId) {
    return readAdded(view).indexOf(addedKey(pathname, configId)) !== -1;
  }

  function markAdded(view, active) {
    if (!view || !active) return;
    active.added = true;
    try {
      var key = addedKey(active.pathname, active.configId);
      var list = readAdded(view).filter(function (item) { return item !== key; });
      list.push(key);
      view.sessionStorage.setItem(ADDED_STORAGE_KEY, JSON.stringify(list.slice(-ADDED_LIMIT)));
    } catch (error) {
      // Storage unavailable: the in-page state still applies.
    }
  }

  function isCartAddUrl(view, input) {
    var raw = typeof input === "string" ? input : (input && input.url) || "";
    try {
      var url = new view.URL(String(raw), view.location.href);
      return url.origin === view.location.origin && /^\/cart\/add(\.js)?$/.test(url.pathname);
    } catch (error) {
      return false;
    }
  }

  // The config a cart-add request carries, when the request is a FormData
  // POST (the theme and Avis product form path).
  function requestConfigId(view, input, init) {
    if (!isCartAddUrl(view, input)) return null;
    var body = init && init.body;
    if (!body || typeof body.get !== "function") return null;
    var value = body.get("properties[_oo_rx_config]");
    return typeof value === "string" ? value : null;
  }

  function injectShopifyProperties(doc, form, summary, source) {
    var properties = handoffProperties(doc, summary, source);
    writeProperties(doc, form, properties);
    return properties;
  }

  function productIdOf(form) {
    var input = form && typeof form.querySelector === "function" ? form.querySelector('input[name="product-id"]') : null;
    return input ? String(input.value || "") : null;
  }

  // Whether a submitted form is this product's own add-to-cart form (never a
  // quick-add or recommendation form for another product).
  function isActiveProductForm(doc, form, active) {
    if (!form || !active || form.tagName !== "FORM") return false;
    if (!/\/cart\/add/.test(String(form.getAttribute("action") || ""))) return false;
    var productId = productIdOf(form);
    if (active.productId) return productId === active.productId;
    return form === findProductForm(doc);
  }

  // Keeps oo_rx / oo_source on this product's URL. The theme rewrites the URL
  // to "?variant=<id>" when the colour changes, which dropped the handoff, so
  // a reload, back/forward or restored tab came back without it and the
  // customer's re-selected lenses were added with no durable config. Only the
  // URL is kept; the summary is fetched and validated again on every load.
  function withHandoffParameters(view, url) {
    var active = view[ACTIVE_PROPERTY];
    if (!active || url === undefined || url === null) return url;
    try {
      var next = new view.URL(String(url), view.location.href);
      if (next.origin !== view.location.origin || next.pathname !== active.pathname) return url;
      if (next.searchParams.has("oo_rx")) return url;
      next.searchParams.set("oo_rx", active.configId);
      if (active.source) next.searchParams.set("oo_source", active.source);
      Object.keys(active.keptParameters || {}).forEach(function (name) {
        if (!next.searchParams.has(name)) next.searchParams.set(name, active.keptParameters[name]);
      });
      return next.pathname + next.search + next.hash;
    } catch (error) {
      return url;
    }
  }

  function installHooks(doc) {
    var view = doc && doc.defaultView;
    if (!view || view[HOOKS_PROPERTY]) return;
    view[HOOKS_PROPERTY] = true;
    // Capture phase on the document runs before the theme's own submit
    // handler builds FormData from the form, so the exact form being sent
    // carries the properties even if Avis or the theme re-rendered it.
    doc.addEventListener("submit", function (event) {
      var active = view[ACTIVE_PROPERTY];
      if (!isActiveProductForm(doc, event.target, active)) return;
      if (handoffAppliesTo(event.target, active)) writeProperties(doc, event.target, active.properties);
      else clearProperties(event.target);
    }, true);
    // A lens change after this config was added to the cart: say whether the
    // saved prescription will follow these lenses. Avis updates its mirrors
    // in its own change handler, so read them after it.
    doc.addEventListener("change", function (event) {
      var name = event.target && event.target.name;
      if (name !== "(OD) Right" && name !== "(OS) Left") return;
      view.setTimeout(function () { refreshStatus(doc); }, 0);
    }, true);
    // Records a confirmed cart add of this config (response OK). A failed or
    // interrupted add keeps the handoff exactly as it was for the retry.
    if (typeof view.fetch === "function") {
      var originalFetch = view.fetch;
      view.fetch = function (input, init) {
        var result = originalFetch.apply(this, arguments);
        try {
          var active = view[ACTIVE_PROPERTY];
          var configId = active && requestConfigId(view, input, init);
          if (configId && configId === active.configId && result && typeof result.then === "function") {
            result.then(function (response) {
              if (response && response.ok && view[ACTIVE_PROPERTY] === active) markAdded(view, active);
            }, function () {});
          }
        } catch (error) {
          // Never interfere with the request itself.
        }
        return result;
      };
    }
    var history = view.history;
    if (!history) return;
    ["replaceState", "pushState"].forEach(function (method) {
      var original = history[method];
      if (typeof original !== "function") return;
      history[method] = function (state, title, url) {
        return original.call(this, state, title, withHandoffParameters(view, url));
      };
    });
  }

  function keptParameters(search) {
    var params = new URLSearchParams(search || "");
    var kept = {};
    KEPT_PARAMETERS.forEach(function (name) {
      var value = params.get(name);
      if (value) kept[name] = value;
    });
    return kept;
  }

  // fromUrl: the handoff came from this page's oo_rx (arrival, reload,
  // back/forward). If this tab already added that config from this product,
  // it resumes as added. An on-page apply (Product Rx Checker) is always a
  // fresh, explicit handoff.
  function activateHandoff(doc, form, summary, source, properties, fromUrl) {
    var view = doc && doc.defaultView;
    if (!view || !view.location) return;
    view[ACTIVE_PROPERTY] = {
      configId: summary.configId,
      source: ALLOWED_SOURCES.indexOf(source) >= 0 ? source : null,
      properties: properties,
      productId: productIdOf(form),
      pathname: view.location.pathname,
      right: summary.recommendedRight,
      left: summary.recommendedLeft,
      summary: summary,
      keptParameters: keptParameters(view.location.search),
      added: Boolean(fromUrl) && wasAdded(view, view.location.pathname, summary.configId)
    };
    installHooks(doc);
    if (view.history && typeof view.history.replaceState === "function") {
      view.history.replaceState(view.history.state, "", view.location.pathname + view.location.search + view.location.hash);
    }
  }

  function refreshUploadWrappers(controls) {
    var scope = controls.confirmedRoot || controls.root;
    if (!scope || typeof scope.querySelector !== "function") {
      return controls.uploadWrappers || [];
    }
    var inputs = typeof scope.querySelectorAll === "function"
      ? Array.from(scope.querySelectorAll('input[name="Upload"], input[type="file"].avp-file__input'))
      : [
        scope.querySelector('input[name="Upload"]'),
        scope.querySelector('input[type="file"].avp-file__input')
      ].filter(Boolean);
    controls.uploadWrappers = inputs.map(function (input) {
      return input.closest(".avp-option");
    }).filter(function (wrapper, index, all) {
      return wrapper && all.indexOf(wrapper) === index;
    });
    return controls.uploadWrappers;
  }

  function disconnectUploadObserver(controls) {
    var stateRoot = controls.confirmedRoot || controls.root;
    var observer = controls.uploadObserver || (stateRoot && stateRoot[UPLOAD_OBSERVER_PROPERTY]);
    if (observer && typeof observer.disconnect === "function") observer.disconnect();
    controls.uploadObserver = null;
    if (stateRoot && stateRoot[UPLOAD_OBSERVER_PROPERTY] === observer) {
      stateRoot[UPLOAD_OBSERVER_PROPERTY] = null;
    }
  }

  function setUploadSuppressed(controls, suppressed) {
    var stateRoot = controls.confirmedRoot || controls.root;
    if (stateRoot && stateRoot.classList) {
      stateRoot.classList.toggle("oo-rx-handoff-confirmed", suppressed);
    }
    refreshUploadWrappers(controls).forEach(function (wrapper) {
      wrapper.classList.toggle("oo-rx-handoff-hidden", suppressed);
      if (suppressed) wrapper.setAttribute("aria-hidden", "true");
      else wrapper.removeAttribute("aria-hidden");
    });
    if (!suppressed) disconnectUploadObserver(controls);
  }

  function suppressLateUploadControls(controls) {
    var stateRoot = controls.confirmedRoot || controls.root;
    var view = stateRoot && stateRoot.ownerDocument && stateRoot.ownerDocument.defaultView;
    if (!view || typeof view.MutationObserver !== "function") return null;
    disconnectUploadObserver(controls);
    setUploadSuppressed(controls, true);
    var observer = new view.MutationObserver(function () {
      setUploadSuppressed(controls, true);
    });
    observer.observe(stateRoot, { childList: true, subtree: true });
    controls.uploadObserver = observer;
    stateRoot[UPLOAD_OBSERVER_PROPERTY] = observer;
    return observer;
  }

  var SOURCE_NOTES = {
    lens_calculator_v53: "Prescription entered in the Lens Calculator.",
    quiz_v53: "Prescription entered in the Quiz.",
    product_rx_checker: "Prescription entered on this page."
  };
  var PENDING_MESSAGE = "Loading your saved prescription…";
  var NOT_ATTACHED_MESSAGE = "Your saved prescription is already in your cart with different lens strengths, so it won't be added to this mask. Choose the saved strengths again to use it.";

  function statusModel(summary, source) {
    return {
      title: summary.prescriptionAttached ? "Prescription already attached" : "Prescription loaded",
      label: summary.prescriptionLabel ? "Prescription loaded: " + summary.prescriptionLabel : null,
      right: formatPower(summary.recommendedRight),
      left: formatPower(summary.recommendedLeft),
      note: summary.prescriptionAttached
        ? "Your prescription file is already attached. No need to upload it again."
        : SOURCE_NOTES[source] || SOURCE_NOTES.lens_calculator_v53
    };
  }

  function ensureStatus(doc, controls) {
    var existing = doc.getElementById("oo-rx-handoff-status");
    if (existing) return existing;
    var status = doc.createElement("section");
    status.id = "oo-rx-handoff-status";
    status.className = "oo-rx-handoff-status";
    status.setAttribute("aria-live", "polite");
    var anchor = controls.right.closest(".avp-option") || controls.root.firstChild;
    var parent = anchor && anchor.parentNode ? anchor.parentNode : controls.root;
    parent.insertBefore(status, anchor || null);
    return status;
  }

  function renderMessage(doc, controls, className, role, message) {
    var status = ensureStatus(doc, controls);
    status.className = "oo-rx-handoff-status " + className;
    status.setAttribute("role", role);
    status.textContent = message;
    return status;
  }

  function renderPending(doc, controls) {
    renderMessage(doc, controls, "is-pending", "status", PENDING_MESSAGE);
  }

  // After an add of this config, keeps the status honest about whether the
  // current lens choice will carry the saved prescription.
  function refreshStatus(doc) {
    var view = doc && doc.defaultView;
    var active = view && view[ACTIVE_PROPERTY];
    var status = doc.getElementById("oo-rx-handoff-status");
    if (!active || !active.added || !status) return;
    var controls = findAvisControls(doc) || active.controls;
    if (!controls) return;
    var pair = { right: parseAvisPower(controls.right.value), left: parseAvisPower(controls.left.value) };
    var released = pairDiffers(pair, active);
    if (released && !status.classList.contains("is-released")) {
      renderMessage(doc, controls, "is-released", "status", NOT_ATTACHED_MESSAGE);
    } else if (!released && status.classList.contains("is-released")) {
      renderSuccess(doc, controls, active.summary, active.source);
    }
  }

  function renderSuccess(doc, controls, summary, source) {
    var model = statusModel(summary, source);
    var status = ensureStatus(doc, controls);
    status.className = "oo-rx-handoff-status is-success";
    status.setAttribute("role", "status");
    status.textContent = "";

    var title = doc.createElement("p");
    title.className = "oo-rx-handoff-status__title";
    title.textContent = model.title + " \u2713";
    status.appendChild(title);
    if (model.label) {
      var label = doc.createElement("p");
      label.className = "oo-rx-handoff-status__label";
      label.textContent = model.label;
      status.appendChild(label);
    }
    var lenses = doc.createElement("dl");
    lenses.className = "oo-rx-handoff-status__lenses";
    [["Right lens", model.right], ["Left lens", model.left]].forEach(function (entry) {
      var item = doc.createElement("div");
      var term = doc.createElement("dt");
      var value = doc.createElement("dd");
      term.textContent = entry[0];
      value.textContent = entry[1];
      item.appendChild(term);
      item.appendChild(value);
      lenses.appendChild(item);
    });
    status.appendChild(lenses);
    var note = doc.createElement("p");
    note.className = "oo-rx-handoff-status__note";
    note.textContent = model.note;
    status.appendChild(note);
  }

  function renderFailure(doc, controls) {
    renderMessage(doc, controls, "is-error", "alert", FAILURE_MESSAGE);
  }

  // options.fromUrl: applied from this page's oo_rx link (see activateHandoff).
  function applyConfirmedHandoff(doc, controls, summary, source, options) {
    var safeSummary = validateSummary(summary, summary && summary.configId);
    var selection = applyAvisValues(controls, safeSummary);
    try {
      var properties = injectShopifyProperties(doc, controls.form, safeSummary, source);
      activateHandoff(doc, controls.form, safeSummary, source, properties, Boolean(options && options.fromUrl));
      var view = doc.defaultView;
      if (view && view[ACTIVE_PROPERTY]) view[ACTIVE_PROPERTY].controls = controls;
      setUploadSuppressed(controls, true);
      suppressLateUploadControls(controls);
      renderSuccess(doc, controls, safeSummary, source);
      return safeSummary;
    } catch (error) {
      selection.rollback();
      removeInjectedProperties(controls.form);
      setUploadSuppressed(controls, false);
      throw error;
    }
  }

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function isTransientStatus(status) {
    return status === 408 || status === 429 || status >= 500;
  }

  // Transient failures (network, 408, 429, 5xx) are retried; a definitive
  // answer (404, draft, mismatched id) is not.
  async function fetchSummary(fetchImpl, configId, backendUrl, retryDelays) {
    var delays = Array.isArray(retryDelays) ? retryDelays : SUMMARY_RETRY_DELAYS;
    var url = String(backendUrl || BACKEND_URL).replace(/\/$/, "") +
      "/api/rx-config/" + encodeURIComponent(configId) + "/summary";
    for (var attempt = 0; ; attempt += 1) {
      var response = null;
      var transient = false;
      try {
        response = await fetchImpl(url, {
          method: "GET",
          headers: { Accept: "application/json" },
          credentials: "omit",
          cache: "no-store"
        });
        transient = !response || (!response.ok && isTransientStatus(response.status));
      } catch (error) {
        transient = true;
      }
      if (response && response.ok) return validateSummary(await response.json(), configId);
      if (!transient || attempt >= delays.length) throw new Error("The saved prescription could not be loaded.");
      await delay(delays[attempt]);
    }
  }

  async function start(doc, options) {
    var settings = options || {};
    var search = settings.search || "";
    if (!hasConfigParameter(search)) return { state: "idle" };
    var configId = readConfigId(search);
    var source = readSource(search);
    var controls;
    // The summary loads while Avis renders, instead of after it.
    var settled = false;
    var summaryRequest = isUuid(configId)
      ? fetchSummary(settings.fetch, configId, settings.backendUrl, settings.retryDelays)
      : Promise.reject(new Error("The saved prescription link is invalid."));
    summaryRequest.then(function () { settled = true; }, function () { settled = true; });

    try {
      controls = await waitForAvisControls(doc, typeof settings.timeoutMs === "number" ? settings.timeoutMs : AVIS_WAIT_MS);
      if (!settled) renderPending(doc, controls);
      var summary = await summaryRequest;
      applyConfirmedHandoff(doc, controls, summary, source, { fromUrl: true });
      return { state: "confirmed", summary: summary, source: source };
    } catch (error) {
      if (controls) {
        removeInjectedProperties(controls.form);
        setUploadSuppressed(controls, false);
        renderFailure(doc, controls);
      }
      return { state: "fallback", error: error };
    }
  }

  return {
    BACKEND_URL: BACKEND_URL,
    FAILURE_MESSAGE: FAILURE_MESSAGE,
    ALLOWED_SOURCES: ALLOWED_SOURCES.slice(),
    readSource: readSource,
    isUuid: isUuid,
    readConfigId: readConfigId,
    hasConfigParameter: hasConfigParameter,
    validateSummary: validateSummary,
    parseAvisPower: parseAvisPower,
    findPowerOption: findPowerOption,
    formatPower: formatPower,
    findProductForm: findProductForm,
    findAvisControls: findAvisControls,
    waitForAvisControls: waitForAvisControls,
    applyAvisValues: applyAvisValues,
    injectShopifyProperties: injectShopifyProperties,
    handoffProperties: handoffProperties,
    isActiveProductForm: isActiveProductForm,
    withHandoffParameters: withHandoffParameters,
    sourceJourney: sourceJourney,
    removeInjectedProperties: removeInjectedProperties,
    writeProperties: writeProperties,
    formLensPair: formLensPair,
    handoffAppliesTo: handoffAppliesTo,
    wasAdded: wasAdded,
    ADDED_STORAGE_KEY: ADDED_STORAGE_KEY,
    AVIS_WAIT_MS: AVIS_WAIT_MS,
    NOT_ATTACHED_MESSAGE: NOT_ATTACHED_MESSAGE,
    PENDING_MESSAGE: PENDING_MESSAGE,
    setUploadSuppressed: setUploadSuppressed,
    suppressLateUploadControls: suppressLateUploadControls,
    statusModel: statusModel,
    applyConfirmedHandoff: applyConfirmedHandoff,
    fetchSummary: fetchSummary,
    start: start
  };
});
