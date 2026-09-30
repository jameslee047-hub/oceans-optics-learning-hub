"use strict";

// Run from theme/: node --test oo-product-rx-checker-v53.test.js
// Loads the real approved engine, high-CYL helper, catalog and Rx module from
// the standalone calculator source, plus the staged checker and handoff.

var test = require("node:test");
var assert = require("node:assert/strict");
var crypto = require("node:crypto");
var fs = require("node:fs");
var path = require("node:path");

var SOURCE_DIR = process.env.OO_V53_SOURCE || path.join(__dirname, "lens-calculator-v52-preview");
var Engine = require(path.join(SOURCE_DIR, "lens-calculator-v53.js"));
var HighCyl = require(path.join(SOURCE_DIR, "lens-calculator-v52-high-cyl.js"));
var Products = require(path.join(SOURCE_DIR, "lens-calculator-v52-products.js"));
var Rx = require(path.join(SOURCE_DIR, "lens-calculator-v52-rx.js"));
var Checker = require("./base/assets/oo-product-rx-checker-v53.js");
var Handoff = require("./base/assets/oo-rx-product-handoff.js");

var HANDLES = {
  "obsidian-nearsighted": "the-rx-obsidian-prescription-mask-for-scuba-dive-snorkeling",
  "obsidian-farsighted": "rx-obsidian-farsighted-prescription-snorkel-scuba-dive-mask",
  rover: "rx-rover-nearsighted-prescription-freediving-scuba-dive-mask",
  lumix: "professional-apollo-like-corrective-scuba-goggles-diving-aluminium-rx-optical-dive-mask-with-diopter-strength-from-1-5-to-6-0",
  titan: "the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask"
};

function eye(sphere, cylinder, axis) {
  return { sphere: String(sphere), cylinder: String(cylinder || 0), axis: cylinder ? String(axis || 90) : null };
}
function product(id) { return Checker.catalogProductForHandle(HANDLES[id], Products.CATALOG); }
function check(id, right, left, strategy) {
  var calc = Checker.calculate(Engine, HighCyl, { right: right, left: left });
  if (strategy) calc.activeRecommendation = Checker.selectStrategy(calc, HighCyl, strategy);
  return { calc: calc, build: Checker.buildability(product(id), calc.activeRecommendation, Products.supportsPower) };
}
function pair(calc) {
  return [Products.formatPower(calc.activeRecommendation.recommendedRight), Products.formatPower(calc.activeRecommendation.recommendedLeft)];
}

test("uses the approved V5.3 engine", function () {
  var hash = crypto.createHash("sha256").update(fs.readFileSync(path.join(SOURCE_DIR, "lens-calculator-v53.js"))).digest("hex");
  assert.equal(hash, "6304b04b25404d1ba84a58fc27cb98730af8d48a64a099413fd42187033938cd");
});

test("every active product handle, including white variants, maps to its catalog family", function () {
  Object.keys(HANDLES).forEach(function (id) { assert.equal(product(id).id, id); });
  assert.equal(Checker.catalogProductForHandle("white-rx-rover-nearsighted-prescription-dive-mask", Products.CATALOG).id, "rover");
  assert.equal(Checker.catalogProductForHandle("rx-lumix-optical-dive-mask-aluminum-white-series", Products.CATALOG).id, "lumix");
  assert.equal(Checker.catalogProductForHandle("prescription-scuba-dive-snorkel-mask-optical", Products.CATALOG).id, "obsidian-nearsighted");
  assert.equal(Checker.catalogProductForHandle("prescription-scuba-dive-snorkel-mask-optical", Products.CATALOG), product("obsidian-nearsighted"));
  assert.equal(Checker.catalogProductForHandle("whale-shark-long-sleeve-rashguard", Products.CATALOG), null);
  assert.equal(Checker.catalogProductForHandle("", Products.CATALOG), null);
});

test("recommendations come straight from the engine for each eye", function () {
  [[eye(-1, -0.75), "-1.00"], [eye(-0.75, 0), "0.00"], [eye(-1, 0), "-1.00"], [eye(2.75, 0), "+2.00"], [eye(-3.25, -0.5, 90), "-3.00"]].forEach(function (entry) {
    var calc = Checker.calculate(Engine, HighCyl, { right: entry[0], left: entry[0] });
    assert.equal(calc.rightResult.recommendation, Engine.calculateEyeRecommendationV53(Checker.engineInput(entry[0]), "E").recommendation);
    assert.equal(calc.rightResult.recommendation, entry[1]);
  });
});

test("Obsidian Near: standard minus, plano, mixed plano and too-strong pairs", function () {
  assert.deepEqual(pair(check("obsidian-nearsighted", eye(-3, 0), eye(-2.5, 0)).calc), ["-2.50", "-2.00"]);
  assert.equal(check("obsidian-nearsighted", eye(-3, 0), eye(-2.5, 0)).build.buildable, true);
  assert.equal(check("obsidian-nearsighted", eye(-0.75, 0), eye(-0.75, 0)).build.buildable, true);
  assert.equal(check("obsidian-nearsighted", eye(-0.75, 0), eye(-1.25, 0)).build.buildable, true);
  // The engine caps at the strongest stocked lens (-9.00), which Obsidian Near builds.
  assert.deepEqual(pair(check("obsidian-nearsighted", eye(-10, 0), eye(-10, 0)).calc), ["-9.00", "-9.00"]);
  assert.equal(check("obsidian-nearsighted", eye(-10, 0), eye(-10, 0)).build.buildable, true);
  assert.equal(check("obsidian-nearsighted", eye(2.75, 0), eye(2.75, 0)).build.buildable, false);
});

test("Obsidian clear-seal alias uses the Obsidian Near stock, including -8.50", function () {
  var clear = Checker.catalogProductForHandle("prescription-scuba-dive-snorkel-mask-optical", Products.CATALOG);
  var build = function (r, l) {
    var calc = Checker.calculate(Engine, HighCyl, { right: r, left: l });
    return { calc: calc, build: Checker.buildability(clear, calc.activeRecommendation, Products.supportsPower) };
  };
  var eight50 = build(eye(-9.5, 0), eye(-9.25, 0));
  assert.deepEqual(pair(eight50.calc).indexOf("-8.50") >= 0, true, JSON.stringify(pair(eight50.calc)));
  assert.equal(eight50.build.buildable, true);
  assert.equal(build(eye(-3, 0), eye(-2.5, 0)).build.buildable, true);
  assert.equal(build(eye(-0.75, 0), eye(-0.75, 0)).build.buildable, true);
  assert.equal(build(eye(-0.75, 0), eye(-3, 0)).build.buildable, true);
  assert.equal(build(eye(2.75, 0), eye(2.75, 0)).build.buildable, false);
  // Live Avis labels on this product (trailing spaces, bracketed plano) parse.
  ["-3.00 ", "-1.50 ", "-8.50", "0 [No Correction]"].forEach(function (label) {
    assert.ok(Number.isFinite(Handoff.parseAvisPower(label)), label);
  });
  assert.equal(Handoff.parseAvisPower("0 [No Correction]"), 0);
});

test("Obsidian Far: standard plus, plano and minus pairs", function () {
  assert.deepEqual(pair(check("obsidian-farsighted", eye(2.75, 0), eye(3.5, 0)).calc), ["+2.00", "+3.00"]);
  assert.equal(check("obsidian-farsighted", eye(2.75, 0), eye(3.5, 0)).build.buildable, true);
  assert.equal(check("obsidian-farsighted", eye(2.75, 0), eye(-0.75, 0)).build.buildable, true);
  assert.equal(check("obsidian-farsighted", eye(-0.75, 0), eye(-0.75, 0)).build.buildable, true);
  assert.equal(check("obsidian-farsighted", eye(-3, 0), eye(-3, 0)).build.buildable, false);
});

test("Rover, Lumix and Titan: -1.50 to -6.00 plus plano", function () {
  ["rover", "lumix", "titan"].forEach(function (id) {
    assert.equal(check(id, eye(-3, 0), eye(-2.5, 0)).build.buildable, true, id + " standard");
    assert.equal(check(id, eye(-0.75, 0), eye(-0.75, 0)).build.buildable, true, id + " 0.00/0.00");
    assert.equal(check(id, eye(-0.75, 0), eye(-3, 0)).build.buildable, true, id + " 0.00/-2.50");
    assert.equal(check(id, eye(-3, 0), eye(-0.75, 0)).build.buildable, true, id + " -2.50/0.00");
    var incompatible = check(id, eye(-0.75, 0), eye(-1.25, 0));
    assert.deepEqual(pair(incompatible.calc), ["0.00", "-1.00"]);
    assert.equal(incompatible.build.buildable, false, id + " 0.00/-1.00");
    assert.equal(check(id, eye(-7, 0), eye(-7, 0)).build.buildable, false, id + " -6.50");
    assert.equal(check(id, eye(2.75, 0), eye(2.75, 0)).build.buildable, false, id + " plus");
  });
});

test("high CYL offers Balanced and Closer to your SPH from the engine helper", function () {
  var balanced = check("titan", eye(-6.75, 3, 130), eye(-5.25, 0.5, 60));
  assert.ok(balanced.calc.highCylinderPreview);
  var preview = balanced.calc.highCylinderPreview;
  assert.deepEqual(pair(balanced.calc), [preview.balanced.right, preview.balanced.left]);
  var closer = check("titan", eye(-6.75, 3, 130), eye(-5.25, 0.5, 60), "closer_to_sph");
  assert.equal(closer.calc.activeRecommendation.recommendationStrategy, "closer_to_sph");
  assert.deepEqual(pair(closer.calc), [preview.alternative.right, preview.alternative.left]);
  assert.equal(check("titan", eye(-4, -2.75, 90), eye(-4, -2.75, 90)).calc.highCylinderPreview, null);
});

test("missing AXIS is required only when CYL is not zero; SE -0.50 needs review", function () {
  assert.deepEqual(Checker.validateEntry({ right: { sphere: "-2", cylinder: "-0.75", axis: null }, left: eye(-2, 0) }), ["Right AXIS is required when CYL is not 0.00."]);
  assert.deepEqual(Checker.validateEntry({ right: eye(-2, 0), left: eye(-2, 0) }), []);
  assert.deepEqual(Checker.validateEntry({ right: { sphere: "", cylinder: "0" }, left: eye(-2, 0) }), ["Right SPH is required."]);
  var review = Checker.calculate(Engine, HighCyl, { right: eye(-0.5, 0), left: eye(-0.5, 0) });
  assert.equal(review.successful, false);
  assert.equal(review.review, true);
});

test("the confirmation payload and handoff summary match the shared backend and handoff contracts", function () {
  var entry = { right: eye(-0.75, 0), left: eye(-3, -0.5, 170) };
  var calc = Checker.calculate(Engine, HighCyl, entry);
  var prescription = { right: Checker.confirmedEye(entry.right), left: Checker.confirmedEye(entry.left) };
  var payload = Rx.buildConfirmationPayload(prescription, calc, "Partner Rx");
  assert.deepEqual(payload.right, { sph: -0.75, cyl: 0, cylSign: "+", axis: null });
  assert.deepEqual(payload.left, { sph: -3, cyl: 0.5, cylSign: "-", axis: 170 });
  assert.equal(payload.recommendedRight, 0);
  assert.equal(payload.recommendedLeft, -2.5);
  assert.equal(payload.recommendationStrategy, "balanced");
  assert.equal(payload.prescriptionLabel, "Partner Rx");
  var configId = "7adf6f8a-1f62-4e2e-9d06-5f5348997a43";
  var summary = Checker.handoffSummary(configId, calc.activeRecommendation, "Partner Rx", false);
  var safe = Handoff.validateSummary(summary, configId);
  assert.equal(safe.recommendedRight, 0);
  assert.equal(safe.recommendedLeft, -2.5);
});

test("the checker writes _oo_source = product_rx_checker, distinct from the full calculator", function () {
  assert.equal(Checker.SOURCE, "product_rx_checker");
  assert.deepEqual(Handoff.ALLOWED_SOURCES, ["lens_calculator_v53", "product_rx_checker", "quiz_v53"]);
  assert.equal(Handoff.readSource("?oo_source=product_rx_checker"), "product_rx_checker");
  assert.equal(Handoff.readSource("?oo_source=quiz_v53"), "quiz_v53");
  assert.equal(Handoff.readSource("?oo_source=face_fit"), null);
  assert.equal(Handoff.readSource("?oo_source=anything-i-want"), null);
  var inputs = [];
  var form = {
    querySelector: function (sel) { var m = sel.match(/name="([^"]+)"/); return m ? inputs.find(function (i) { return i.name === m[1]; }) || null : null; },
    appendChild: function (i) { inputs.push(i); }
  };
  var doc = { createElement: function () { return { setAttribute: function (n, v) { this[n] = v; } }; } };
  Handoff.injectShopifyProperties(doc, form, { configId: "7adf6f8a-1f62-4e2e-9d06-5f5348997a43", prescriptionLabel: null }, Checker.SOURCE);
  assert.deepEqual(inputs.map(function (i) { return [i.name, i.value]; }), [
    ["properties[_oo_rx_config]", "7adf6f8a-1f62-4e2e-9d06-5f5348997a43"],
    ["properties[_oo_source]", "product_rx_checker"]
  ]);
});

test("plano is labelled Plano (0.00) and incompatible pairs point to the full calculator", function () {
  assert.equal(Checker.formatLensLabel(0), "Plano (0.00)");
  assert.equal(Checker.formatLensLabel(-2.5), "-2.50");
  assert.equal(Checker.NOT_BUILDABLE_MESSAGE, "This mask isn't available with both of your recommended lens strengths.");
  assert.equal(Checker.FULL_CALCULATOR_URL, "https://oceansoptics.com/pages/prescription-lenses-calculator-tool");
  var source = fs.readFileSync(path.join(__dirname, "base/assets/oo-product-rx-checker-v53.js"), "utf8");
  assert.match(source, /"See Compatible Masks"/);
  assert.doesNotMatch(source, /computeContinuousTarget|underwaterAdjustmentD|snapToHalf|calcOne/);
});

test("PDF pages are rendered locally at a readable size with safe filenames", function () {
  // Shared with the full calculator: the checker has no PDF code of its own.
  assert.equal(Rx.pdfRenderScale(595, 842), 2400 / 842);
  assert.equal(Rx.pdfRenderScale(3000, 4000), 1);
  assert.equal(Rx.pdfRenderScale(100, 100), 4);
  assert.equal(Rx.pdfRenderScale(0, 0), 1);
  assert.equal(Rx.pdfPageFilename("My Rx (2024).PDF", 2), "My-Rx-2024-page-2.jpg");
  assert.equal(Rx.pdfPageFilename("", 1), "prescription-page-1.jpg");
  var source = fs.readFileSync(path.join(__dirname, "base/assets/oo-product-rx-checker-v53.js"), "utf8");
  assert.match(source, /rx\.loadPdfJs\(root, doc, container\.dataset\.pdfjsSrc, container\.dataset\.pdfjsWorker\)/);
  assert.match(source, /rx\.openPdfDocument\(pdfjs, file\)/);
  assert.match(source, /rx\.renderPdfPage\(doc, pdfDoc, number, pdfName, root\.File\)/);
  assert.doesNotMatch(source, /getDocument|toBlob|PDF_RENDER_LONGEST_SIDE/);
});

test("uploads only ever send the approved crop, never the chosen file", function () {
  var source = fs.readFileSync(path.join(__dirname, "base/assets/oo-product-rx-checker-v53.js"), "utf8");
  assert.match(source, /rx\.approvedImageFromCrop\(sourceFile, cropper, root\.File\)/);
  assert.doesNotMatch(source, /transport\.init\((file|state\.file|sourceFile)\b/);
  assert.doesNotMatch(source, /transport\.upload\([^)]*,\s*(file|state\.file|sourceFile)\)/);
  assert.match(source, /transport\.init\(approvedFile,/);
  assert.match(fs.readFileSync(path.join(SOURCE_DIR, "lens-calculator-v52-rx.js"), "utf8"), /isEvalSupported: false/);
  var section = fs.readFileSync(path.join(__dirname, "base/sections/oo-product-rx-checker-v53.liquid"), "utf8");
  assert.match(section, /data-pdfjs-src="\{\{ 'oo-pdfjs-3\.11\.174\.min\.js' \| asset_url \}\}"/);
  assert.match(section, /data-pdfjs-worker="\{\{ 'oo-pdfjs-3\.11\.174\.worker\.min\.js' \| asset_url \}\}"/);
  // pdf.js is lazy-loaded only when a PDF is chosen, never as a page script.
  assert.doesNotMatch(section, /<script[^>]+oo-pdfjs/);
  ["data-checker-rotate-left", "data-checker-rotate-right", "data-checker-reset", "data-checker-choose-another", "data-checker-cancel", "data-checker-use", "data-checker-page"].forEach(function (attr) {
    assert.ok(section.indexOf(attr) >= 0, attr);
  });
});

test("checker durable records use backend source product_rx_checker; the cart source is unchanged", async function () {
  assert.equal(Checker.BACKEND_SOURCE, "product_rx_checker");
  assert.equal(Checker.SOURCE, "product_rx_checker");
  var source = fs.readFileSync(path.join(__dirname, "base/assets/oo-product-rx-checker-v53.js"), "utf8");
  assert.match(source, /rx\.createTransport\(\{\s+source: BACKEND_SOURCE,/);
  var bodies = [];
  var transport = Rx.createTransport({
    source: Checker.BACKEND_SOURCE,
    FormDataCtor: FormData,
    backendUrl: "https://rx.test",
    fetchImpl: async function (url, init) { bodies.push(JSON.parse(init.body)); return new Response("{}", { status: 200 }); }
  });
  await transport.init(new File([new Uint8Array(4)], "rx-approved.jpg", { type: "image/jpeg" }), null);
  await transport.manualInit(null);
  assert.deepEqual(bodies.map(function (b) { return b.source; }), ["product_rx_checker", "product_rx_checker"]);
});
