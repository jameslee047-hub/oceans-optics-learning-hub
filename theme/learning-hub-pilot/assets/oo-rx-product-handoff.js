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
  // Purchase sources accepted from the oo_source parameter. Only these exact
  // values become the hidden _oo_source line-item property.
  var ALLOWED_SOURCES = ["lens_calculator_v53"];
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

  function removeInjectedProperties(form) {
    Array.from(form.querySelectorAll('input[data-oo-rx-handoff-property="true"]')).forEach(function (input) {
      input.remove();
    });
  }

  function injectShopifyProperties(doc, form, summary, source) {
    upsertHiddenProperty(doc, form, "properties[_oo_rx_config]", summary.configId);
    if (ALLOWED_SOURCES.indexOf(source) >= 0) {
      upsertHiddenProperty(doc, form, "properties[_oo_source]", source);
    }
    if (summary.prescriptionLabel) {
      upsertHiddenProperty(doc, form, "properties[Prescription]", summary.prescriptionLabel);
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

  function statusModel(summary) {
    return {
      title: summary.prescriptionAttached ? "Prescription already attached" : "Prescription loaded",
      label: summary.prescriptionLabel ? "Prescription loaded: " + summary.prescriptionLabel : null,
      right: formatPower(summary.recommendedRight),
      left: formatPower(summary.recommendedLeft),
      note: summary.prescriptionAttached
        ? "Your prescription file is already attached. No need to upload it again."
        : "Prescription entered in the Lens Calculator."
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

  function renderSuccess(doc, controls, summary) {
    var model = statusModel(summary);
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
    var status = ensureStatus(doc, controls);
    status.className = "oo-rx-handoff-status is-error";
    status.setAttribute("role", "alert");
    status.textContent = FAILURE_MESSAGE;
  }

  function applyConfirmedHandoff(doc, controls, summary, source) {
    var safeSummary = validateSummary(summary, summary && summary.configId);
    var selection = applyAvisValues(controls, safeSummary);
    try {
      injectShopifyProperties(doc, controls.form, safeSummary, source);
      setUploadSuppressed(controls, true);
      suppressLateUploadControls(controls);
      renderSuccess(doc, controls, safeSummary);
      return safeSummary;
    } catch (error) {
      selection.rollback();
      removeInjectedProperties(controls.form);
      setUploadSuppressed(controls, false);
      throw error;
    }
  }

  async function fetchSummary(fetchImpl, configId, backendUrl) {
    var response = await fetchImpl(
      String(backendUrl || BACKEND_URL).replace(/\/$/, "") +
        "/api/rx-config/" + encodeURIComponent(configId) + "/summary",
      {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "omit",
        cache: "no-store"
      }
    );
    if (!response || !response.ok) throw new Error("The saved prescription could not be loaded.");
    return validateSummary(await response.json(), configId);
  }

  async function start(doc, options) {
    var settings = options || {};
    var search = settings.search || "";
    if (!hasConfigParameter(search)) return { state: "idle" };
    var configId = readConfigId(search);
    var source = readSource(search);
    var controls;

    try {
      controls = await waitForAvisControls(doc, settings.timeoutMs);
      if (!isUuid(configId)) throw new Error("The saved prescription link is invalid.");
      var summary = await fetchSummary(settings.fetch, configId, settings.backendUrl);
      applyConfirmedHandoff(doc, controls, summary, source);
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
    removeInjectedProperties: removeInjectedProperties,
    setUploadSuppressed: setUploadSuppressed,
    suppressLateUploadControls: suppressLateUploadControls,
    statusModel: statusModel,
    applyConfirmedHandoff: applyConfirmedHandoff,
    fetchSummary: fetchSummary,
    start: start
  };
});
