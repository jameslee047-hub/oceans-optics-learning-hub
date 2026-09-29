"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var Handoff = require("./base/assets/oo-rx-product-handoff.js");

var CONFIG_ID = "7adf6f8a-1f62-4e2e-9d06-5f5348997a43";

function summary(overrides) {
  return Object.assign({
    configId: CONFIG_ID,
    status: "confirmed",
    recommendedRight: -2.5,
    recommendedLeft: -1.5,
    prescriptionAttached: true,
    prescriptionLabel: "James's"
  }, overrides || {});
}

function select(values, mirror) {
  var control = {
    value: "",
    options: values.map(function (value) { return { value: value, textContent: value }; }),
    ownerDocument: {
      defaultView: {
        Event: function Event(type, options) {
          this.type = type;
          this.bubbles = options && options.bubbles;
        }
      }
    },
    events: [],
    dispatchEvent: function (event) {
      this.events.push(event.type);
      if (event.type === "change" && mirror) mirror.value = this.value;
    }
  };
  return control;
}

function statefulClassList() {
  var values = new Set();
  return {
    toggle: function (name, enabled) {
      if (enabled) values.add(name);
      else values.delete(name);
    },
    contains: function (name) { return values.has(name); }
  };
}

function uploadWrapper() {
  var wrapper = {
    attrs: {},
    classList: statefulClassList(),
    setAttribute: function (name, value) { this.attrs[name] = value; },
    removeAttribute: function (name) { delete this.attrs[name]; }
  };
  return wrapper;
}

test("oo_rx parsing requires a valid opaque UUID", function () {
  assert.equal(Handoff.hasConfigParameter("?variant=123"), false);
  assert.equal(Handoff.readConfigId("?variant=123"), null);
  assert.equal(Handoff.readConfigId("?variant=123&oo_rx=" + CONFIG_ID.toUpperCase()), CONFIG_ID);
  assert.equal(Handoff.isUuid(CONFIG_ID), true);
  assert.equal(Handoff.isUuid("not-a-config"), false);
});

test("confirmed summaries are accepted and reduced to the public safe shape", function () {
  var safe = Handoff.validateSummary(Object.assign(summary(), {
    confirmedRx: { sph: "must not survive" },
    editToken: "must not survive",
    storagePath: "must not survive"
  }), CONFIG_ID);
  assert.deepEqual(safe, summary());
  assert.equal(Object.hasOwn(safe, "confirmedRx"), false);
  assert.equal(Object.hasOwn(safe, "editToken"), false);
  assert.equal(Object.hasOwn(safe, "storagePath"), false);
});

test("draft, mismatched, and missing summaries are rejected", function () {
  assert.throws(function () {
    Handoff.validateSummary(summary({ status: "draft" }), CONFIG_ID);
  }, /not confirmed/);
  assert.throws(function () {
    Handoff.validateSummary(summary(), "6e7a98b9-b12c-47d7-b39d-c30ed255190f");
  }, /does not match/);
  assert.throws(function () {
    Handoff.validateSummary(null, CONFIG_ID);
  }, /invalid/);
});

test("live Avis formats map numerically for all five product families", function () {
  var families = [
    { name: "Obsidian Near", values: ["", "-1.00", "-8.00", "0 (No correction)"], wanted: -8, expected: "-8.00" },
    { name: "Obsidian Far", values: ["", "0 [No Correction Needed]", "+2.00", "+4.00"], wanted: 4, expected: "+4.00" },
    { name: "Rover", values: ["", "-1.50", "-6.00", "0 [No Correction Needed]"], wanted: 0, expected: "0 [No Correction Needed]" },
    { name: "Lumix", values: ["", "-1.50", "-5.50", "0 [No Correction Needed]"], wanted: -5.5, expected: "-5.50" },
    { name: "Titan", values: ["", "-1.50", "-6.00", "0 (No correction)"], wanted: -2.5, expected: null }
  ];
  families[4].values.splice(2, 0, "-2.50");
  families[4].expected = "-2.50";

  families.forEach(function (family) {
    var option = Handoff.findPowerOption(select(family.values), family.wanted);
    assert.equal(option && option.value, family.expected, family.name);
  });
});

test("live Avis hierarchy uses the shared options root and stable product-info scope", function () {
  var upload = { closest: function () { return uploadPrompt; } };
  var file = { closest: function () { return filePrompt; } };
  var uploadPrompt = uploadWrapper();
  var filePrompt = uploadWrapper();
  var productInfo = {
    querySelector: function (selector) {
      if (selector === 'input[name="Upload"]') return upload;
      if (selector === 'input[type="file"].avp-file__input') return file;
      return null;
    }
  };
  var left = {};
  var avisRoot = {
    contains: function (node) { return node === left; },
    closest: function (selector) { return selector === "product-info" ? productInfo : null; }
  };
  var right = {
    closest: function (selector) {
      if (selector === ".avpoptions-container__v2") return avisRoot;
      return null;
    }
  };
  var variantInput = { value: "50148668899661" };
  var rightProperty = { value: "" };
  var leftProperty = { value: "" };
  var form = {
    getAttribute: function (name) { return name === "data-type" ? "add-to-cart-form" : null; },
    querySelector: function (selector) {
      if (selector === 'button[name="add"]') return {};
      if (selector === 'input[name="id"]') return variantInput;
      if (selector === 'input[name="properties[(OD) Right]"]') return rightProperty;
      if (selector === 'input[name="properties[(OS) Left]"]') return leftProperty;
      return null;
    }
  };
  var doc = {
    querySelector: function (selector) {
      if (/OD/.test(selector)) return right;
      if (/OS/.test(selector)) return left;
      return null;
    },
    querySelectorAll: function () { return [form]; }
  };

  var controls = Handoff.findAvisControls(doc);
  assert.equal(controls.root, avisRoot);
  assert.equal(controls.confirmedRoot, productInfo);
  assert.deepEqual(controls.uploadWrappers, [uploadPrompt, filePrompt]);
  assert.equal(controls.variantInput, variantInput);
});

test("Avis values visibly select and update its own Shopify property mirrors", function () {
  var rightProperty = { value: "" };
  var leftProperty = { value: "" };
  var right = select(["", "-2.50", "0 (No correction)"], rightProperty);
  var left = select(["", "-1.50", "0 (No correction)"], leftProperty);
  var variantInput = { value: "54202866401613" };
  var controls = {
    right: right,
    left: left,
    rightProperty: rightProperty,
    leftProperty: leftProperty,
    variantInput: variantInput
  };

  Handoff.applyAvisValues(controls, summary());
  assert.equal(right.value, "-2.50");
  assert.equal(left.value, "-1.50");
  assert.deepEqual(right.events, ["input", "change"]);
  assert.deepEqual(left.events, ["input", "change"]);
  assert.equal(rightProperty.value, "-2.50");
  assert.equal(leftProperty.value, "-1.50");
  assert.equal(variantInput.value, "54202866401613");
});

test("different eyes, plus values, and plano remain distinct", function () {
  var rightProperty = { value: "" };
  var leftProperty = { value: "" };
  var controls = {
    right: select(["", "0 [No Correction Needed]", "+2.00", "+4.00"], rightProperty),
    left: select(["", "0 [No Correction Needed]", "+2.00", "+4.00"], leftProperty),
    rightProperty: rightProperty,
    leftProperty: leftProperty,
    variantInput: { value: "53151486476621" }
  };
  Handoff.applyAvisValues(controls, summary({ recommendedRight: 0, recommendedLeft: 4 }));
  assert.equal(controls.right.value, "0 [No Correction Needed]");
  assert.equal(controls.left.value, "+4.00");
  assert.equal(Handoff.formatPower(0), "0.00");
  assert.equal(Handoff.formatPower(4), "+4.00");
});

test("only the durable config and useful label are injected", function () {
  var inputs = [];
  var form = {
    querySelector: function (selector) {
      var match = selector.match(/name="([^"]+)"/);
      return match ? inputs.find(function (input) { return input.name === match[1]; }) || null : null;
    },
    appendChild: function (input) { inputs.push(input); }
  };
  var doc = {
    createElement: function () {
      return {
        setAttribute: function (name, value) { this[name] = value; }
      };
    }
  };
  Handoff.injectShopifyProperties(doc, form, summary());
  assert.deepEqual(inputs.map(function (input) { return [input.name, input.value]; }), [
    ["properties[_oo_rx_config]", CONFIG_ID],
    ["properties[Prescription]", "James's"]
  ]);
  assert.doesNotMatch(JSON.stringify(inputs), /confirmedRx|editToken|storagePath|signed|Upload|Anthropic/i);
});

test("blank labels are omitted and upload wrappers are only visually suppressed", function () {
  var inputs = [];
  var form = {
    querySelector: function () { return null; },
    appendChild: function (input) { inputs.push(input); }
  };
  var doc = {
    createElement: function () {
      return { setAttribute: function (name, value) { this[name] = value; } };
    }
  };
  var wrapper = {
    hidden: false,
    disabled: false,
    attrs: {},
    classList: { toggle: function (name, enabled) { wrapper.suppressed = name === "oo-rx-handoff-hidden" && enabled; } },
    setAttribute: function (name, value) { this.attrs[name] = value; },
    removeAttribute: function (name) { delete this.attrs[name]; }
  };

  Handoff.injectShopifyProperties(doc, form, summary({ prescriptionLabel: null }));
  assert.deepEqual(inputs.map(function (input) { return input.name; }), ["properties[_oo_rx_config]"]);
  Handoff.setUploadSuppressed({ uploadWrappers: [wrapper] }, true);
  assert.equal(wrapper.suppressed, true);
  assert.equal(wrapper.hidden, false);
  assert.equal(wrapper.disabled, false);
  Handoff.setUploadSuppressed({ uploadWrappers: [wrapper] }, false);
  assert.equal(wrapper.suppressed, false);
});

test("confirmed root state keeps late Avis upload rerenders suppressed", function () {
  var confirmedRoot = {
    querySelector: function () { return null; },
    classList: statefulClassList()
  };
  var controls = { root: {}, confirmedRoot: confirmedRoot, uploadWrappers: [] };
  Handoff.setUploadSuppressed(controls, true);
  assert.equal(confirmedRoot.classList.contains("oo-rx-handoff-confirmed"), true);
  Handoff.setUploadSuppressed(controls, false);
  assert.equal(confirmedRoot.classList.contains("oo-rx-handoff-confirmed"), false);
});

test("one scoped observer suppresses async Avis rerenders and disconnects on clear", function () {
  var observers = [];
  function MutationObserver(callback) {
    this.callback = callback;
    this.disconnected = false;
    observers.push(this);
  }
  MutationObserver.prototype.observe = function (target, options) {
    this.target = target;
    this.options = options;
  };
  MutationObserver.prototype.disconnect = function () { this.disconnected = true; };

  var currentUpload = uploadWrapper();
  var currentFile = uploadWrapper();
  var stateRoot = {
    classList: statefulClassList(),
    ownerDocument: { defaultView: { MutationObserver: MutationObserver } },
    querySelectorAll: function () {
      return [
        { closest: function () { return currentUpload; } },
        { closest: function () { return currentFile; } }
      ];
    },
    querySelector: function (selector) {
      var wrapper = selector.indexOf('name="Upload"') >= 0 ? currentUpload : currentFile;
      return { closest: function () { return wrapper; } };
    }
  };
  var controls = { confirmedRoot: stateRoot, uploadWrappers: [] };

  Handoff.setUploadSuppressed(controls, true);
  var firstObserver = Handoff.suppressLateUploadControls(controls);
  assert.equal(firstObserver.target, stateRoot);
  assert.deepEqual(firstObserver.options, { childList: true, subtree: true });
  assert.equal(currentUpload.classList.contains("oo-rx-handoff-hidden"), true);

  currentUpload = uploadWrapper();
  currentFile = uploadWrapper();
  firstObserver.callback();
  assert.equal(currentUpload.classList.contains("oo-rx-handoff-hidden"), true);
  assert.equal(currentFile.classList.contains("oo-rx-handoff-hidden"), true);

  var secondObserver = Handoff.suppressLateUploadControls(controls);
  assert.equal(firstObserver.disconnected, true);
  assert.equal(observers.length, 2);
  Handoff.setUploadSuppressed(controls, false);
  assert.equal(secondObserver.disconnected, true);
  assert.equal(stateRoot.classList.contains("oo-rx-handoff-confirmed"), false);
  assert.equal(currentUpload.classList.contains("oo-rx-handoff-hidden"), false);
});

test("uploaded and manual status wording are accurate", function () {
  var uploaded = Handoff.statusModel(summary({ prescriptionAttached: true }));
  var manual = Handoff.statusModel(summary({ prescriptionAttached: false }));
  assert.equal(uploaded.title, "Prescription already attached");
  assert.match(uploaded.note, /file is already attached/);
  assert.equal(manual.title, "Prescription loaded");
  assert.match(manual.note, /entered in the Lens Calculator/);
  assert.doesNotMatch(manual.note, /file is already attached/);
});

test("public summary fetch uses no credentials or authentication header", async function () {
  var request;
  var safe = await Handoff.fetchSummary(async function (url, options) {
    request = { url: url, options: options };
    return { ok: true, json: async function () { return summary(); } };
  }, CONFIG_ID);
  assert.equal(safe.status, "confirmed");
  assert.match(request.url, new RegExp(CONFIG_ID + "/summary$"));
  assert.equal(request.options.credentials, "omit");
  assert.deepEqual(request.options.headers, { Accept: "application/json" });
  assert.equal(Object.hasOwn(request.options.headers, "Authorization"), false);
});

test("API failures reject without manufacturing prescription data", async function () {
  await assert.rejects(function () {
    return Handoff.fetchSummary(async function () { return { ok: false, status: 404 }; }, CONFIG_ID);
  }, /could not be loaded/);
  assert.match(Handoff.FAILURE_MESSAGE, /select your lens strengths or upload/);
});

function propertyForm() {
  var inputs = [];
  return {
    inputs: inputs,
    form: {
      querySelector: function (selector) {
        var match = selector.match(/name="([^"]+)"/);
        return match ? inputs.find(function (input) { return input.name === match[1]; }) || null : null;
      },
      querySelectorAll: function () {
        return inputs.filter(function (input) { return input["data-oo-rx-handoff-property"] === "true"; });
      },
      appendChild: function (input) {
        input.remove = function () { inputs.splice(inputs.indexOf(input), 1); };
        inputs.push(input);
      }
    },
    doc: {
      createElement: function () {
        return { setAttribute: function (name, value) { this[name] = value; } };
      }
    }
  };
}

test("oo_source accepts only the exact allowlisted calculator value", function () {
  assert.deepEqual(Handoff.ALLOWED_SOURCES, ["lens_calculator_v53", "product_rx_checker", "quiz_v53"]);
  assert.equal(Handoff.readSource("?oo_source=product_rx_checker"), "product_rx_checker");
  assert.equal(Handoff.readSource("?oo_source=quiz_v53"), "quiz_v53");
  assert.equal(Handoff.readSource("?oo_rx=" + CONFIG_ID + "&oo_source=lens_calculator_v53"), "lens_calculator_v53");
  assert.equal(Handoff.readSource("?oo_source=%20lens_calculator_v53%20"), "lens_calculator_v53");
  [
    "?oo_rx=" + CONFIG_ID,
    "?oo_source=",
    "?oo_source=anything-i-want",
    "?oo_source=LENS_CALCULATOR_V53",
    "?oo_source=lens_calculator_v53x",
    "?oo_source=QUIZ_V53",
    "?oo_source=quiz_v5",
    "?oo_source=face_fit",
    "?oo_source=lens_calculator_v53%3Cscript%3E"
  ].forEach(function (search) {
    assert.equal(Handoff.readSource(search), null, search);
  });
});

test("allowlisted source is injected alongside the durable config without replacing it", function () {
  var fixture = propertyForm();
  Handoff.injectShopifyProperties(fixture.doc, fixture.form, summary(), "lens_calculator_v53");
  assert.deepEqual(fixture.inputs.map(function (input) { return [input.name, input.value, input.type]; }), [
    ["properties[_oo_rx_config]", CONFIG_ID, "hidden"],
    ["properties[_oo_source]", "lens_calculator_v53", "hidden"],
    ["properties[Prescription]", "James's", "hidden"]
  ]);
});

test("quiz_v53 is recorded as its own source, distinct from the full calculator", function () {
  var fixture = propertyForm();
  Handoff.injectShopifyProperties(fixture.doc, fixture.form, summary(), "quiz_v53");
  assert.deepEqual(fixture.inputs.map(function (input) { return [input.name, input.value]; }).slice(0, 2), [
    ["properties[_oo_rx_config]", CONFIG_ID],
    ["properties[_oo_source]", "quiz_v53"]
  ]);
});

test("missing or non-allowlisted sources never create _oo_source", function () {
  [undefined, null, "", "anything-i-want", "LENS_CALCULATOR_V53", "QUIZ_V53", "face_fit"].forEach(function (source) {
    var fixture = propertyForm();
    Handoff.injectShopifyProperties(fixture.doc, fixture.form, summary(), source);
    assert.equal(fixture.inputs.some(function (input) { return input.name === "properties[_oo_source]"; }), false, String(source));
    assert.equal(fixture.inputs[0].name, "properties[_oo_rx_config]");
  });
});

test("failed or cleared handoffs remove the injected source with the durable config", function () {
  var fixture = propertyForm();
  Handoff.injectShopifyProperties(fixture.doc, fixture.form, summary(), "lens_calculator_v53");
  assert.equal(fixture.inputs.length, 3);
  Handoff.removeInjectedProperties(fixture.form);
  assert.equal(fixture.inputs.length, 0);
});

test("direct product visits without oo_rx never classify traffic as calculator-origin", async function () {
  var touched = false;
  var result = await Handoff.start({ get defaultView() { touched = true; return null; } }, {
    search: "?variant=50148668899661&oo_source=lens_calculator_v53",
    fetch: function () { throw new Error("must not fetch"); }
  });
  assert.equal(result.state, "idle");
  assert.equal(touched, false);
});

test("source is applied only inside the confirmed handoff path", function () {
  var source = require("node:fs").readFileSync(require.resolve("./base/assets/oo-rx-product-handoff.js"), "utf8");
  assert.match(source, /var summary = await fetchSummary\(settings\.fetch, configId, settings\.backendUrl\);\s+applyConfirmedHandoff\(doc, controls, summary, source\);/);
  assert.match(source, /injectShopifyProperties\(doc, controls\.form, safeSummary, source\);\s+setUploadSuppressed/);
  assert.match(source, /catch \(error\) \{\s+selection\.rollback\(\);\s+removeInjectedProperties\(controls\.form\);/);
});

test("both live Avis plano formats select the plano option for a 0.00 eye", function () {
  ["0 (No correction)", "0 [No Correction Needed]"].forEach(function (planoLabel) {
    var options = ["", "-1.50", "-2.00", "-2.50", planoLabel].map(function (value) { return { value: value, textContent: value }; });
    var chosen = Handoff.findPowerOption({ options: options }, 0);
    assert.ok(chosen, planoLabel);
    assert.equal(chosen.value, planoLabel);
    assert.equal(Handoff.findPowerOption({ options: options }, -2.5).value, "-2.50");
    assert.equal(Handoff.findPowerOption({ options: options }, -1), null, "no silent substitution for an unstocked power");
  });
});
