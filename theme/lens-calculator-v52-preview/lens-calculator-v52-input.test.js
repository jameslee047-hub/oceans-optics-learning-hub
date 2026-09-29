"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var vm = require("node:vm");

function classList() {
  var values = new Set();
  return {
    add: function (value) { values.add(value); },
    remove: function (value) { values.delete(value); },
    contains: function (value) { return values.has(value); },
    toggle: function (value, force) {
      if (force === true) values.add(value);
      else if (force === false) values.delete(value);
      else if (values.has(value)) values.delete(value);
      else values.add(value);
    }
  };
}

function select(value, disabled) {
  var control = {
    value: value,
    disabled: Boolean(disabled),
    options: [],
    appendChild: function (option) {
      this.options.push(option);
      if (this.options.length === 1) this.value = option.value;
    }
  };
  Object.defineProperty(control, "innerHTML", {
    get: function () { return ""; },
    set: function () {
      control.options = [];
      control.value = "";
    }
  });
  return control;
}

function sign(field) {
  return {
    dataset: { field: field, sign: "", selected: "false" },
    disabled: false,
    textContent: "+/-",
    attributes: { "aria-pressed": "false" },
    setAttribute: function (name, value) { this.attributes[name] = value; }
  };
}

function eye(side) {
  var controls = {
    sphereSign: sign("sphere"),
    sphereInteger: select("0"),
    sphereFraction: select("00"),
    cylinderSign: sign("cylinder"),
    cylinderInteger: select("0"),
    cylinderFraction: select("00"),
    axis: select("", true)
  };

  return {
    dataset: { eye: side },
    controls: controls,
    querySelector: function (selector) {
      if (selector === ".oo-v52__field.is-rx-missing") return null;
      if (selector.includes("oo-v52__field")) return null;
      if (selector.includes("oo-v52__sign") && selector.includes('data-field="sphere"')) return controls.sphereSign;
      if (selector.includes("oo-v52__sign") && selector.includes('data-field="cylinder"')) return controls.cylinderSign;
      if (selector.includes("oo-v52__integer") && selector.includes('data-field="sphere"')) return controls.sphereInteger;
      if (selector.includes("oo-v52__fraction") && selector.includes('data-field="sphere"')) return controls.sphereFraction;
      if (selector.includes("oo-v52__integer") && selector.includes('data-field="cylinder"')) return controls.cylinderInteger;
      if (selector.includes("oo-v52__fraction") && selector.includes('data-field="cylinder"')) return controls.cylinderFraction;
      if (selector.includes("oo-v52__axis")) return controls.axis;
      return null;
    }
  };
}

function chooseSign(button, value) {
  button.dataset.sign = value;
  button.dataset.selected = "true";
  button.textContent = value;
  button.setAttribute("aria-pressed", "true");
}

function setMagnitude(target, field, integer, fraction) {
  target.controls[field + "Integer"].value = String(integer);
  target.controls[field + "Fraction"].value = String(fraction).padStart(2, "0");
}

function loadUi() {
  var right = eye("right");
  var left = eye("left");
  var submit = { hidden: false };
  var edit = { hidden: true };
  var allControls = [right, left].flatMap(function (target) {
    return Object.values(target.controls);
  });
  var form = {
    classList: classList(),
    dataset: { rxState: "editing" },
    querySelectorAll: function () { return allControls; },
    querySelector: function (selector) {
      return selector === ".oo-v52__submit" ? submit : null;
    }
  };
  var document = {
    createElement: function () { return { value: "", textContent: "" }; },
    querySelector: function (selector) {
      if (selector === '[data-eye="right"]') return right;
      if (selector === '[data-eye="left"]') return left;
      return null;
    },
    querySelectorAll: function (selector) {
      return selector === ".oo-v52__eye" ? [right, left] : [];
    },
    getElementById: function (id) {
      if (id === "oo-v52-form") return form;
      if (id === "oo-v52-edit") return edit;
      return null;
    }
  };
  var window = {};
  var filename = path.join(__dirname, "lens-calculator-v52-ui.js");
  var source = fs.readFileSync(filename, "utf8");
  var initialization = '  document.querySelectorAll(".oo-v52__eye").forEach(initializeEye);';
  source = source.slice(0, source.indexOf(initialization)) + "\n})();\n";
  vm.runInNewContext(source, { window: window, document: document, console: console }, { filename: filename });

  return {
    ui: window.OOV52CalculatorUI,
    right: right,
    left: left,
    form: form,
    submit: submit,
    edit: edit,
    allControls: allControls
  };
}

test("SPH sign can be selected before magnitude and survives magnitude changes", function () {
  var harness = loadUi();
  chooseSign(harness.right.controls.sphereSign, "-");
  chooseSign(harness.left.controls.sphereSign, "+");
  setMagnitude(harness.right, "sphere", 6, 75);
  setMagnitude(harness.left, "sphere", 3, 0);

  var prescription = harness.ui.getConfirmedPrescription();
  assert.equal(prescription.right.sph, -6.75);
  assert.equal(prescription.left.sph, 3);
  assert.equal(harness.right.controls.sphereSign.dataset.sign, "-");
  assert.equal(harness.left.controls.sphereSign.dataset.sign, "+");
});

test("magnitude can be selected before sign with the same signed result", function () {
  var harness = loadUi();
  setMagnitude(harness.right, "sphere", 4, 25);
  setMagnitude(harness.right, "cylinder", 1, 75);
  harness.ui.setPrescriptionLocked(false, { state: "editing" });
  chooseSign(harness.right.controls.sphereSign, "-");
  chooseSign(harness.right.controls.cylinderSign, "+");
  harness.right.controls.axis.value = "120";

  chooseSign(harness.left.controls.sphereSign, "+");
  var prescription = harness.ui.getConfirmedPrescription();
  assert.equal(prescription.right.sph, -4.25);
  assert.equal(prescription.right.cyl, 1.75);
  assert.equal(prescription.right.cylSign, "+");
  assert.equal(prescription.right.axis, 120);
});

test("CYL sign selected at zero survives magnitude changes and zero crossings", function () {
  var harness = loadUi();
  chooseSign(harness.right.controls.sphereSign, "-");
  chooseSign(harness.left.controls.sphereSign, "+");
  chooseSign(harness.right.controls.cylinderSign, "-");
  chooseSign(harness.left.controls.cylinderSign, "+");

  harness.ui.setPrescriptionLocked(false, { state: "editing" });
  assert.equal(harness.right.controls.cylinderSign.disabled, false);
  assert.equal(harness.right.controls.cylinderSign.dataset.sign, "-");
  assert.equal(harness.right.controls.axis.disabled, true);

  setMagnitude(harness.right, "cylinder", 3, 50);
  setMagnitude(harness.left, "cylinder", 2, 25);
  harness.ui.setPrescriptionLocked(false, { state: "editing" });
  harness.right.controls.axis.value = "90";
  harness.left.controls.axis.value = "80";
  harness.right.controls.axis.value = "120";
  assert.equal(harness.right.controls.cylinderSign.dataset.sign, "-");

  var prescription = harness.ui.getConfirmedPrescription();
  assert.equal(JSON.stringify(prescription.right), JSON.stringify({ sph: 0, cyl: 3.5, cylSign: "-", axis: 120 }));
  assert.equal(JSON.stringify(prescription.left), JSON.stringify({ sph: 0, cyl: 2.25, cylSign: "+", axis: 80 }));

  setMagnitude(harness.right, "cylinder", 0, 0);
  harness.ui.setPrescriptionLocked(false, { state: "editing" });
  assert.equal(harness.right.controls.cylinderSign.dataset.sign, "-");
  assert.equal(harness.right.controls.axis.disabled, true);

  setMagnitude(harness.right, "cylinder", 3, 50);
  harness.ui.setPrescriptionLocked(false, { state: "editing" });
  assert.equal(harness.right.controls.cylinderSign.dataset.sign, "-");
});

test("signed zero remains optically zero while preserving the chosen CYL sign", function () {
  var harness = loadUi();
  chooseSign(harness.right.controls.sphereSign, "-");
  chooseSign(harness.left.controls.sphereSign, "+");
  chooseSign(harness.right.controls.cylinderSign, "-");
  chooseSign(harness.left.controls.cylinderSign, "+");
  harness.ui.setPrescriptionLocked(false, { state: "editing" });

  var prescription = harness.ui.getConfirmedPrescription();
  assert.equal(prescription.right.sph, 0);
  assert.equal(Object.is(prescription.right.sph, -0), false);
  assert.equal(prescription.right.cyl, 0);
  assert.equal(prescription.right.cylSign, "-");
  assert.equal(prescription.right.axis, null);
  assert.equal(harness.right.controls.axis.disabled, true);
});

test("AI population sets SPH and CYL signs, including zero CYL", function () {
  var harness = loadUi();
  var failed = harness.ui.applyPrescription({
    right: { sph: -2.75, cyl: 0, cylSign: "-", axis: null },
    left: { sph: 3, cyl: 2.25, cylSign: "+", axis: 80 }
  });

  assert.deepEqual(Array.from(failed), []);
  assert.equal(harness.right.controls.sphereSign.dataset.sign, "-");
  assert.equal(harness.right.controls.cylinderSign.dataset.sign, "-");
  assert.equal(harness.right.controls.axis.disabled, true);
  assert.equal(harness.left.controls.sphereSign.dataset.sign, "+");
  assert.equal(harness.left.controls.cylinderSign.dataset.sign, "+");
  assert.equal(harness.left.controls.axis.value, "80");
});

test("calculation lock, edit unlock, and confirmed immutability still govern signs", function () {
  var harness = loadUi();
  chooseSign(harness.right.controls.cylinderSign, "-");

  harness.ui.setPrescriptionLocked(true, { state: "calculated", allowEdit: true });
  assert.equal(harness.right.controls.cylinderSign.disabled, true);
  assert.equal(harness.edit.hidden, false);

  harness.ui.setPrescriptionLocked(false, { state: "editing-calculated" });
  assert.equal(harness.right.controls.cylinderSign.disabled, false);
  assert.equal(harness.right.controls.cylinderSign.dataset.sign, "-");
  assert.equal(harness.right.controls.axis.disabled, true);

  harness.ui.setPrescriptionLocked(true, { state: "confirmed" });
  assert.equal(harness.allControls.every(function (control) { return control.disabled; }), true);
  assert.equal(harness.edit.hidden, true);
});

test("editable HTML does not initially disable CYL sign controls", function () {
  ["index.html", "lens-calculator-v52-preview.html"].forEach(function (filename) {
    var html = fs.readFileSync(path.join(__dirname, filename), "utf8");
    var buttons = html.match(/<button class="oo-v52__sign"[^>]*data-field="cylinder"[^>]*>/g) || [];
    assert.equal(buttons.length, 2);
    buttons.forEach(function (button) { assert.doesNotMatch(button, /\sdisabled(?:\s|>)/); });
  });
});
