"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var Rx = require("./lens-calculator-v52-rx.js");
var V53 = require("./lens-calculator-v53.js");

function file(name, type, size) {
  return new File([new Uint8Array(size || 12)], name, { type: type });
}

function extraction(status, right, left) {
  return {
    configId: "28bf81b0-d4fb-4a51-a2db-d262dbf29cb8",
    readable: status !== "unreadable",
    status: status,
    parsedRx: status === "unreadable" ? null : { right: right, left: left }
  };
}

function fakeCalculatorUi(failed) {
  return {
    applied: null,
    marked: null,
    applyPrescription: function (prescription) {
      this.applied = prescription;
      return failed || [];
    },
    markMissingFields: function (fields) {
      this.marked = fields;
    }
  };
}

test("accepts JPEG selection", function () {
  assert.deepEqual(Rx.validateSelectedFile(file("rx.jpg", "image/jpeg")), {
    ok: true,
    mimeType: "image/jpeg"
  });
});

test("creates capped client-side crop output", async function () {
  var cropOptions;
  var cropper = {
    getCroppedCanvas: function (options) {
      cropOptions = options;
      return {
        toBlob: function (callback, mimeType) {
          callback(new Blob([new Uint8Array([1, 2, 3, 4])], { type: mimeType }));
        }
      };
    }
  };

  var approved = await Rx.approvedImageFromCrop(
    file("phone-photo.jpg", "image/jpeg", 1024),
    cropper,
    File
  );
  assert.equal(approved.name, "phone-photo-approved.jpg");
  assert.equal(approved.type, "image/jpeg");
  assert.equal(approved.size, 4);
  assert.equal(cropOptions.maxWidth, 3000);
  assert.equal(cropOptions.maxHeight, 3000);
  assert.equal(cropOptions.imageSmoothingQuality, "high");
});

test("rotation and reset delegate to the cropper", function () {
  var calls = [];
  var actions = Rx.cropActions({
    rotate: function (degrees) { calls.push(["rotate", degrees]); },
    reset: function () { calls.push(["reset"]); }
  });
  actions.rotateLeft();
  actions.rotateRight();
  actions.reset();
  assert.deepEqual(calls, [["rotate", -90], ["rotate", 90], ["reset"]]);
});

test("rejects oversized files before backend init", function () {
  var result = Rx.validateSelectedFile({
    name: "rx.png",
    type: "image/png",
    size: Rx.MAX_FILE_SIZE + 1
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /8 MiB/);
});

test("rejects unsupported and HEIC files clearly", function () {
  assert.equal(Rx.validateSelectedFile(file("rx.txt", "text/plain")).ok, false);
  assert.match(Rx.validateSelectedFile(file("rx.heic", "image/heic")).error, /HEIC/);
});

test("PDF bypasses image cropping", function () {
  var pdf = file("prescription.pdf", "application/pdf");
  assert.equal(Rx.validateSelectedFile(pdf).ok, true);
  assert.equal(Rx.reviewModeFor(pdf), "pdf");
});

test("complete AI extraction populates the visible calculator fields", function () {
  var right = { sph: -2.75, cyl: 2, cylSign: "-", axis: 90 };
  var left = { sph: -2.5, cyl: 0, cylSign: "+", axis: null };
  var ui = fakeCalculatorUi();
  var result = Rx.applyProcessResult(ui, extraction("complete", right, left));

  assert.equal(result.kind, "complete");
  assert.deepEqual(ui.applied, { right: right, left: left });
  assert.deepEqual(ui.marked, []);
});

test("partial extraction preserves readable fields and highlights only missing AXIS", function () {
  var right = { sph: -2.75, cyl: 2, cylSign: "-", axis: null };
  var left = { sph: -2.75, cyl: 2, cylSign: "-", axis: 80 };
  var ui = fakeCalculatorUi();
  var result = Rx.applyProcessResult(ui, extraction("partial", right, left));

  assert.equal(result.kind, "partial");
  assert.deepEqual(ui.applied.right, right);
  assert.deepEqual(ui.marked, ["right.axis"]);
  assert.match(result.message, /AXIS for your right eye/);
});

test("zero CYL does not require AXIS", function () {
  var prescription = {
    right: { sph: -1.5, cyl: 0, cylSign: "+", axis: null },
    left: { sph: -1.25, cyl: 0, cylSign: "-", axis: null }
  };
  assert.deepEqual(Rx.missingFieldsForExtraction(prescription), []);
});

test("extracted Rx summaries preserve signs, pad AXIS, and describe partial fields", function () {
  assert.equal(
    Rx.formatRxEyeSummary("Right", { sph: -4.25, cyl: 2, cylSign: "-", axis: 10 }),
    "Right: SPH -4.25 / CYL -2.00 / ×010"
  );
  assert.equal(
    Rx.formatRxEyeSummary("Left", { sph: 2, cyl: 0, cylSign: "+", axis: null }),
    "Left: SPH +2.00 / CYL 0.00"
  );
  assert.equal(
    Rx.formatRxEyeSummary("Right", { sph: -2.75, cyl: 2, cylSign: "-", axis: null }),
    "Right: SPH -2.75 / CYL -2.00 / AXIS not read"
  );
});

test("unreadable extraction offers fallback without changing fields", function () {
  var ui = fakeCalculatorUi();
  var result = Rx.applyProcessResult(ui, extraction("unreadable"));
  assert.equal(result.kind, "unreadable");
  assert.equal(ui.applied, null);
  assert.deepEqual(ui.marked, []);
});

test("manual calculation starts without a needless draft", function () {
  assert.equal(Rx.shouldConfirm(
    { configId: null, editToken: null, confirmed: false },
    { successful: true }
  ), false);

  var result = V53.calculateEyeRecommendationV53({
    sphere: "-4.00",
    cylinder: "0.00",
    axis: ""
  }, "Right (OD)");
  assert.equal(result.valid, true);
  assert.equal(result.recommendation, "-3.50");
});

test("prescription labels are optional, trimmed, Unicode-safe, and capped at 60 characters", function () {
  assert.equal(Rx.normalizePrescriptionLabel(undefined), null);
  assert.equal(Rx.normalizePrescriptionLabel("   "), null);
  assert.equal(Rx.normalizePrescriptionLabel("  Airies  "), "Airies");
  assert.equal(Rx.normalizePrescriptionLabel("😀".repeat(60)), "😀".repeat(60));
  assert.throws(function () {
    Rx.normalizePrescriptionLabel("😀".repeat(61));
  }, /60 characters/);
});

test("optional label payload helper omits blanks and includes trimmed names", function () {
  assert.deepEqual(Rx.withOptionalPrescriptionLabel({ source: "calculator" }, "  "), {
    source: "calculator"
  });
  assert.deepEqual(Rx.withOptionalPrescriptionLabel({ source: "calculator" }, " James "), {
    source: "calculator",
    prescriptionLabel: "James"
  });
});

test("manual init uses the durable endpoint and normalized label without an upload", async function () {
  var requests = [];
  var transport = Rx.createTransport({
    backendUrl: "https://backend.example/",
    FormDataCtor: FormData,
    fetchImpl: async function (url, options) {
      requests.push({ url: url, options: options });
      return {
        ok: true,
        status: 201,
        json: async function () { return { configId: "manual-config", editToken: "secret" }; }
      };
    }
  });

  var result = await transport.manualInit("  Mum  ");
  assert.deepEqual(result, { configId: "manual-config", editToken: "secret" });
  assert.equal(requests[0].url, "https://backend.example/api/rx-config/manual/init");
  assert.equal(requests[0].options.method, "POST");
  var body = JSON.parse(requests[0].options.body);
  assert.deepEqual(body, {
    source: "calculator",
    prescriptionLabel: "Mum"
  });
  assert.equal("storagePath" in body, false);
  assert.equal("upload" in body, false);
});

test("blank labels are omitted from upload init and manual init requests", async function () {
  var requests = [];
  var transport = Rx.createTransport({
    backendUrl: "https://backend.example",
    FormDataCtor: FormData,
    fetchImpl: async function (url, options) {
      requests.push({ url: url, body: JSON.parse(options.body) });
      return {
        ok: true,
        status: 201,
        json: async function () { return { configId: "config", editToken: "secret" }; }
      };
    }
  });

  await transport.init(file("rx.jpg", "image/jpeg"), "   ");
  await transport.manualInit("");

  assert.equal(requests[0].url.endsWith("/api/rx-config/upload/init"), true);
  assert.equal(requests[1].url.endsWith("/api/rx-config/manual/init"), true);
  assert.equal("prescriptionLabel" in requests[0].body, false);
  assert.equal("prescriptionLabel" in requests[1].body, false);
});

test("runtime profiles preserve independent uploaded and manual prescriptions", function () {
  var store = Rx.createProfileStore();
  var previewUrl = "blob:https://calculator.example/approved-crop";
  var firstRx = {
    right: { sph: -4, cyl: 0, cylSign: "+", axis: null },
    left: { sph: -4.5, cyl: 0, cylSign: "+", axis: null }
  };
  var secondRx = {
    right: { sph: -2.75, cyl: 4, cylSign: "-", axis: 90 },
    left: { sph: -2.75, cyl: 4, cylSign: "-", axis: 80 }
  };
  var first = store.add({
    configId: "uploaded-config",
    label: " James ",
    source: "uploaded",
    confirmedRx: firstRx,
    recommendationStrategy: "balanced",
    recommendedRight: -3.5,
    recommendedLeft: -4,
    prescriptionAttached: true,
    labelEditToken: "label-secret-one",
    prescriptionPreview: {
      kind: "image",
      filename: "approved-crop.jpg",
      url: previewUrl
    },
    editToken: "must-not-survive"
  });
  var second = store.add({
    configId: "manual-config",
    label: "",
    source: "manual",
    confirmedRx: secondRx,
    recommendationStrategy: "closer_to_sph",
    recommendedRight: -3,
    recommendedLeft: -3,
    prescriptionAttached: false,
    editToken: "must-not-survive-either"
  });

  assert.equal(first.displayLabel, "James");
  assert.equal(second.displayLabel, "Prescription 2");
  assert.equal(store.getActive().configId, "manual-config");
  assert.equal(store.getActive().recommendationStrategy, "closer_to_sph");
  assert.deepEqual(store.getActive().confirmedRx, secondRx);

  store.setActive(first.localId);
  assert.equal(store.getActive().configId, "uploaded-config");
  assert.equal(store.getActive().recommendedRight, -3.5);
  assert.deepEqual(store.getActive().confirmedRx, firstRx);
  assert.equal("prescriptionPreview" in store.getActive(), false);
  assert.equal(store.getActiveRecord().prescriptionPreview.url, previewUrl);
  assert.equal(store.getAll().length, 2);
  assert.equal("editToken" in store.getActive(), false);
  assert.equal("editToken" in store.getActiveRecord(), false);
  assert.equal("labelEditToken" in store.getActive(), false);
  assert.equal(store.getActiveRecord().labelEditToken, "label-secret-one");

  assert.equal(store.rename(first.localId, " Airies ").displayLabel, "Airies");
  assert.equal(store.getActive().label, "Airies");
  assert.equal(store.rename(first.localId, " ").displayLabel, "Prescription 1");

  var revoked = [];
  store.disposePreviews(function (url) { revoked.push(url); });
  assert.deepEqual(revoked, [previewUrl]);
  assert.equal(store.getActiveRecord().prescriptionPreview.url, null);
});

test("blank first label falls back to Prescription 1 without persisting the fallback", function () {
  var store = Rx.createProfileStore();
  var profile = store.add({
    configId: "config-1",
    label: null,
    source: "manual",
    confirmedRx: { right: {}, left: {} },
    recommendationStrategy: "balanced",
    recommendedRight: -2,
    recommendedLeft: -2,
    prescriptionAttached: false
  });
  assert.equal(profile.label, null);
  assert.equal(profile.displayLabel, "Prescription 1");
});

test("multiple blank profiles receive stable numbered display labels", function () {
  var store = Rx.createProfileStore();
  var base = {
    label: null,
    source: "manual",
    confirmedRx: { right: {}, left: {} },
    recommendationStrategy: "balanced",
    recommendedRight: -2.5,
    recommendedLeft: -1.5
  };
  assert.equal(store.add(Object.assign({ configId: "one" }, base)).displayLabel, "Prescription 1");
  assert.equal(store.add(Object.assign({ configId: "two" }, base)).displayLabel, "Prescription 2");
  assert.equal(store.setActive("prescription-1").displayLabel, "Prescription 1");
  assert.equal(store.setActive("prescription-2").displayLabel, "Prescription 2");
});

test("confirmation payload keeps reviewed Rx unchanged and preserves each selected strategy pair", function () {
  var reviewed = {
    right: { sph: -2.75, cyl: 4, cylSign: "-", axis: 90 },
    left: { sph: -2.75, cyl: 4, cylSign: "-", axis: 80 }
  };
  var balanced = Rx.buildConfirmationPayload(reviewed, {
    rightResult: { recommendation: "-4.00", version: "5.3.0-experimental" },
    leftResult: { recommendation: "-4.00", version: "5.3.0-experimental" },
    activeRecommendation: {
      recommendationStrategy: "balanced",
      recommendedRight: -4,
      recommendedLeft: -4
    }
  }, "James");
  var alternative = Rx.buildConfirmationPayload(reviewed, {
    rightResult: { recommendation: "-4.00", version: "5.3.0-experimental" },
    leftResult: { recommendation: "-4.00", version: "5.3.0-experimental" },
    activeRecommendation: {
      recommendationStrategy: "closer_to_sph",
      recommendedRight: -3,
      recommendedLeft: -3
    }
  }, "James");

  assert.deepEqual(balanced.right, reviewed.right);
  assert.deepEqual(alternative.right, reviewed.right);
  assert.equal(balanced.recommendationStrategy, "balanced");
  assert.equal(alternative.recommendationStrategy, "closer_to_sph");
  assert.deepEqual([balanced.recommendedRight, balanced.recommendedLeft], [-4, -4]);
  assert.deepEqual([alternative.recommendedRight, alternative.recommendedLeft], [-3, -3]);
  assert.equal(alternative.prescriptionLabel, "James");
});

test("blank confirmation omits the optional label and creates a local fallback result", function () {
  var reviewed = {
    right: { sph: -3, cyl: 0, cylSign: "+", axis: null },
    left: { sph: -2, cyl: 0, cylSign: "+", axis: null }
  };
  var calculation = {
    rightResult: { recommendation: "-2.50", version: "5.3.0-experimental" },
    leftResult: { recommendation: "-1.50", version: "5.3.0-experimental" }
  };
  var payload = Rx.buildConfirmationPayload(reviewed, calculation, " ");
  var pending = Rx.createPendingResultProfile(payload, calculation, { number: 1, source: "manual" });

  assert.equal("prescriptionLabel" in payload, false);
  assert.equal(pending.configId, null);
  assert.equal(pending.label, null);
  assert.equal(pending.displayLabel, "Prescription 1");
  assert.deepEqual([pending.recommendedRight, pending.recommendedLeft], [-2.5, -1.5]);
});

test("confirmation payload uses customer-edited visible values", function () {
  var edited = {
    right: { sph: -3, cyl: 1.25, cylSign: "-", axis: 95 },
    left: { sph: -2.5, cyl: 0, cylSign: "+", axis: null }
  };
  var payload = Rx.buildConfirmationPayload(edited, {
    rightResult: { recommendation: "-3.00", version: "5.3.0-experimental" },
    leftResult: { recommendation: "-2.00", version: "5.3.0-experimental" }
  });
  assert.deepEqual(payload.right, edited.right);
  assert.deepEqual(payload.left, edited.left);
  assert.equal(payload.recommendedRight, -3);
  assert.equal(payload.recommendedLeft, -2);
  assert.equal(payload.calculatorVersion, "5.3.0-experimental");
  assert.equal(payload.recommendationStrategy, "balanced");
});

test("malformed active recommendation cannot silently fall back to Balanced", function () {
  var confirmedRx = {
    right: { sph: -2.75, cyl: 3, cylSign: "-", axis: 90 },
    left: { sph: -2.75, cyl: 4, cylSign: "-", axis: 80 }
  };

  assert.throws(function () {
    Rx.buildConfirmationPayload(confirmedRx, {
      rightResult: { recommendation: "-3.50", version: "5.3.0-experimental" },
      leftResult: { recommendation: "-4.00", version: "5.3.0-experimental" },
      activeRecommendation: {
        recommendationStrategy: "closer_to_sph",
        recommendedRight: null,
        recommendedLeft: -3
      }
    });
  }, /valid right-eye recommendation/);

  assert.throws(function () {
    Rx.buildConfirmationPayload(confirmedRx, {
      activeRecommendation: {
        recommendationStrategy: "not_a_strategy",
        recommendedRight: -3,
        recommendedLeft: -3
      }
    });
  }, /valid recommendation strategy/);
});

test("uses the backend-provided signed upload URL exactly", async function () {
  var requests = [];
  var signedUrl = "https://backend-selected-project.supabase.co/storage/v1/object/upload/sign/rx-prescriptions/config-id/prescription.jpg?token=storage-token%2Evalue&mode=test";
  var transport = Rx.createTransport({
    backendUrl: "https://backend.example",
    FormDataCtor: FormData,
    fetchImpl: async function (url, options) {
      requests.push({ url: url, options: options });
      return {
        ok: true,
        status: 200,
        json: async function () { return {}; }
      };
    }
  });
  await transport.upload({
    bucket: "rx-prescriptions",
    path: "config-id/prescription.jpg",
    token: "legacy-storage-token",
    signedUrl: signedUrl
  }, file("approved.jpg", "image/jpeg"));

  assert.equal(requests[0].url, signedUrl);
  assert.doesNotMatch(requests[0].url, /backend\.example/);
  assert.doesNotMatch(requests[0].url, /legacy-storage-token/);
  assert.equal(requests[0].options.method, "PUT");
});

test("missing or malformed signed upload URLs fail before fetch without fallback construction", async function () {
  var fetchCalls = 0;
  var transport = Rx.createTransport({
    backendUrl: "https://backend.example",
    FormDataCtor: FormData,
    fetchImpl: async function () {
      fetchCalls += 1;
      return { ok: true, status: 200 };
    }
  });
  var legacyFields = {
    bucket: "rx-prescriptions",
    path: "config-id/prescription.jpg",
    token: "legacy-storage-token"
  };

  await assert.rejects(
    transport.upload(legacyFields, file("approved.jpg", "image/jpeg")),
    /secure upload address was unavailable/
  );
  await assert.rejects(
    transport.upload({
      bucket: legacyFields.bucket,
      path: legacyFields.path,
      token: legacyFields.token,
      signedUrl: "/storage/v1/object/upload/sign/rx-prescriptions/file?token=storage-token"
    }, file("approved.jpg", "image/jpeg")),
    /secure upload address was unavailable/
  );
  assert.equal(fetchCalls, 0);
});

test("edit token is sent only as a bearer header", async function () {
  var request;
  var transport = Rx.createTransport({
    backendUrl: "https://backend.example",
    FormDataCtor: FormData,
    fetchImpl: async function (url, options) {
      request = { url: url, options: options };
      return {
        ok: true,
        status: 200,
        json: async function () { return { status: "confirmed" }; }
      };
    }
  });
  var token = "temporary-secret-token";
  await transport.confirm("config-id", token, {
    right: { sph: -2, cyl: 0, cylSign: "+", axis: null },
    left: { sph: -2, cyl: 0, cylSign: "+", axis: null },
    recommendedRight: -1.5,
    recommendedLeft: -1.5,
    calculatorVersion: "5.2"
  });

  assert.equal(request.options.headers.Authorization, "Bearer " + token);
  assert.equal(request.url.includes(token), false);
  assert.equal(request.options.body.includes(token), false);
});

test("label edit token is sent only to the narrow PATCH endpoint", async function () {
  var request;
  var transport = Rx.createTransport({
    backendUrl: "https://backend.example",
    FormDataCtor: FormData,
    fetchImpl: async function (url, options) {
      request = { url: url, options: options };
      return {
        ok: true,
        status: 200,
        json: async function () { return { prescriptionLabel: "Airies" }; }
      };
    }
  });
  var token = "label-only-secret";

  await transport.rename("config-id", token, " Airies ");

  assert.equal(request.url, "https://backend.example/api/rx-config/config-id/label");
  assert.equal(request.options.method, "PATCH");
  assert.equal(request.options.headers.Authorization, "Bearer " + token);
  assert.deepEqual(JSON.parse(request.options.body), { prescriptionLabel: "Airies" });
  assert.equal(request.url.includes(token), false);
  assert.equal(request.options.body.includes(token), false);

  await transport.rename("config-id", token, "   ");
  assert.deepEqual(JSON.parse(request.options.body), { prescriptionLabel: "" });
});

test("Rx controller contains no browser persistence or console logging", function () {
  var source = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-rx.js"), "utf8");
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
  assert.doesNotMatch(source, /console\s*\./);
  assert.doesNotMatch(source, /https:\/\/[a-z0-9-]+\.supabase\.co/i);
  assert.doesNotMatch(source, /TEST_SUPABASE_URL|supabaseUrl/);
  assert.doesNotMatch(source, /storageBase|encodeStoragePath/);
});

test("multi-prescription controls remain progressive and compact in both preview documents", function () {
  ["index.html", "lens-calculator-v52-preview.html"].forEach(function (filename) {
    var html = fs.readFileSync(path.join(__dirname, filename), "utf8");
    assert.match(html, /id="oo-v52-profiles"[^>]*hidden/);
    assert.match(html, /Who is this prescription for\? <span>\(optional\)<\/span>/);
    assert.match(html, /Adding more than one\? A name makes it easier to tell them apart\./);
    assert.match(html, /\+ Add prescription<\/button>/);
    assert.doesNotMatch(html, /Add another prescription/);
    assert.match(html, /id="oo-v52-profile-summary"[^>]*hidden/);
    assert.match(html, /Prescription saved/);
    assert.match(html, /lens-calculator-v52-products\.js/);
  });
});

test("approved upload review offers inline image comparison and PDF treatment", function () {
  var source = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-rx.js"), "utf8");
  var css = fs.readFileSync(path.join(__dirname, "lens-calculator-v52.css"), "utf8");

  ["index.html", "lens-calculator-v52-preview.html"].forEach(function (filename) {
    var html = fs.readFileSync(path.join(__dirname, filename), "utf8");
    assert.match(html, /id="oo-v52-rx-approved"[^>]*hidden/);
    assert.match(html, /id="oo-v52-rx-approved-larger"[^>]*>View larger<\/button>/);
    assert.match(html, /id="oo-v52-rx-approved-adjust"[^>]*>Adjust image<\/button>/);
    assert.match(html, /id="oo-v52-rx-approved-another"[^>]*>Choose another<\/button>/);
    assert.match(html, /id="oo-v52-rx-approved-pdf"[^>]*hidden/);
    assert.match(html, /id="oo-v52-rx-expanded"[^>]*aria-labelledby="oo-v52-rx-expanded-title"[^>]*hidden/);
    assert.doesNotMatch(html, /<dialog|oo-v52-rx-lightbox/);
  });

  assert.match(source, /setDraftPreview\(state\.approvedFile\)/);
  assert.match(source, /URLApi\.createObjectURL\(file\)/);
  assert.match(source, /URLApi\.revokeObjectURL/);
  assert.match(source, /renderApprovedPreview\(internal\.prescriptionPreview, true, profile\)/);
  assert.doesNotMatch(source, /prescriptionPreview[\s\S]{0,120}(?:localStorage|sessionStorage)/);
  assert.match(css, /\.oo-v52-rx__check-layout\.has-approved-preview[\s\S]*?grid-template-columns:\s*minmax\(210px, 0\.8fr\)/);
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.oo-v52-rx__check-layout\.has-approved-preview[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
});

test("calculation CTA remains centered in the prescription-values column", function () {
  var html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  var css = fs.readFileSync(path.join(__dirname, "lens-calculator-v52.css"), "utf8");
  var valuesStart = html.indexOf('<div class="oo-v52-rx__values">');
  var submit = html.indexOf('<button class="oo-v52__submit"');
  var valuesEnd = html.indexOf("</div>\n          </div>", valuesStart);

  assert.ok(valuesStart >= 0 && submit > valuesStart && submit < valuesEnd);
  assert.match(css, /\.oo-v52-rx__values\s*\{[\s\S]*?min-width:\s*0/);
  assert.match(css, /\.oo-v52-rx__values form\s*\{[\s\S]*?display:\s*grid[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /\.oo-v52-rx__check-layout\.has-approved-preview\s*\{[\s\S]*?grid-template-areas:\s*"preview values"/);
  assert.match(css, /\.oo-v52-rx__check-layout\.has-approved-preview > \.oo-v52-rx__values\s*\{[\s\S]*?grid-area:\s*values/);
  assert.match(css, /\.oo-v52__submit\s*\{[\s\S]*?margin:\s*16px auto 0/);
});

test("name field precedes the comparison and confirmed profiles keep a locked calculator visible", function () {
  var html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  var source = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-rx.js"), "utf8");
  var ui = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-ui.js"), "utf8");
  assert.ok(html.indexOf('id="oo-v52-rx-label-field"') < html.indexOf('id="oo-v52-rx-check-layout"'));
  assert.match(source, /elements\.form\.hidden = false;/);
  assert.match(ui, /setPrescriptionLocked\(true, \{ state: "confirmed" \}\)/);
  assert.match(ui, /form\.querySelectorAll\("\.oo-v52__sign, \.oo-v52__eye select"\)/);
});

test("successful calculations use an explicit editable-draft view state", function () {
  var ui = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-ui.js"), "utf8");
  var rx = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-rx.js"), "utf8");
  var css = fs.readFileSync(path.join(__dirname, "lens-calculator-v52.css"), "utf8");

  ["index.html", "lens-calculator-v52-preview.html"].forEach(function (filename) {
    var html = fs.readFileSync(path.join(__dirname, filename), "utf8");
    assert.match(html, /id="oo-v52-edit"[^>]*type="button"[^>]*hidden>Edit prescription<\/button>/);
  });

  assert.match(ui, /if \(successful\) lockCalculatedPrescription\(\)/);
  assert.match(ui, /setPrescriptionLocked\(true, \{ state: "calculated", allowEdit: true \}\)/);
  assert.match(ui, /form\.querySelectorAll\("\.oo-v52__sign, \.oo-v52__eye select"\)[\s\S]*?control\.disabled = Boolean\(locked\)/);
  assert.match(ui, /form\.querySelector\("\.oo-v52__submit"\)\.hidden = Boolean\(locked\)/);
  assert.match(ui, /editButton\.hidden = !\(locked && options\.allowEdit\)/);
  assert.match(ui, /form\.dataset\.rxState !== "calculated"/);
  assert.match(ui, /setPrescriptionLocked\(false, \{ state: "editing-calculated" \}\)/);
  assert.match(rx, /calculatorUi\.setPrescriptionFinalizing\(\)/);
  assert.match(css, /#oo-v52-form\.is-locked select:disabled[\s\S]*?opacity:\s*1[\s\S]*?background:\s*#fff/);
});

test("editing invalidates stale results while confirmed profiles remain immutable", function () {
  var ui = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-ui.js"), "utf8");
  var products = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-products.js"), "utf8");

  assert.match(ui, /form\.dataset\.rxState !== "editing-calculated"/);
  assert.match(ui, /getElementById\("oo-v52-result"\)\.hidden = true/);
  assert.match(ui, /new CustomEvent\("oo:v52:calculation-stale"\)/);
  assert.match(products, /addEventListener\("oo:v52:calculation-stale"[\s\S]*?section\.hidden = true[\s\S]*?grid\.innerHTML = ""/);
  assert.match(ui, /setPrescriptionLocked\(true, \{ state: "confirmed" \}\)/);
  assert.match(ui, /editButton\.hidden = !\(locked && options\.allowEdit\)/);
});

test("all Rx selects drop focus on wheel without intercepting page scroll or changing values", function () {
  var ui = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-ui.js"), "utf8");
  var wheelHandler = ui.match(/function protectSelectFromWheel\(select\) \{([\s\S]*?)\n  \}/);

  assert.ok(wheelHandler);
  assert.match(wheelHandler[1], /document\.activeElement === select/);
  assert.match(wheelHandler[1], /select\.blur\(\)/);
  assert.match(wheelHandler[1], /passive: true/);
  assert.doesNotMatch(wheelHandler[1], /preventDefault|selectedIndex|dispatchEvent/);
  assert.match(ui, /eye\.querySelectorAll\("select"\)\.forEach/);
});

test("confirmed prescription names use an accessible inline editor", function () {
  var source = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-rx.js"), "utf8");
  ["index.html", "lens-calculator-v52-preview.html"].forEach(function (filename) {
    var html = fs.readFileSync(path.join(__dirname, filename), "utf8");
    assert.match(html, /id="oo-v52-rx-label-draft"/);
    assert.match(html, /id="oo-v52-rx-label-confirmed"[^>]*hidden/);
    assert.match(html, /id="oo-v52-rx-label-display"[^>]*type="button"/);
    assert.match(html, /id="oo-v52-rx-label-edit"[^>]*maxlength="60"[^>]*autofocus/);
    assert.match(html, /id="oo-v52-rx-label-save"[^>]*aria-label="Save prescription name"/);
    assert.match(html, /id="oo-v52-rx-label-cancel"[^>]*aria-label="Cancel name editing"/);
    assert.doesNotMatch(html, />Add name<|>Save name</);
  });

  assert.match(source, /elements\.labelDisplay\.addEventListener\("click", beginConfirmedLabelEdit\)/);
  assert.match(source, /event\.key === "Enter"[\s\S]*?saveConfirmedLabel\(\)/);
  assert.match(source, /event\.key === "Escape"[\s\S]*?cancelConfirmedLabelEdit\(true\)/);
  assert.match(source, /doc\.addEventListener\("pointerdown", handleOutsideLabelPointer, true\)/);
  assert.doesNotMatch(source, /labelEditInput\.addEventListener\("input"/);
});

test("successful inline renames update profile-aware titles without exposing label tokens", function () {
  var source = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-rx.js"), "utf8");
  assert.match(source, /profile\.label \+ " — " \+ kind/);
  assert.match(source, /profile\.displayLabel \+ \(preview && preview\.kind === "pdf" \? " PDF" : " image"\)/);
  assert.match(source, /transport\.rename\(internal\.configId, internal\.labelEditToken, nextLabel\)/);
  assert.match(source, /profileStore\.rename\(internal\.localId, nextLabel\)/);
  assert.match(source, /nextLabel === profile\.label/);
  assert.match(source, /emitPrescriptionChanged\(\)/);
  assert.doesNotMatch(source, /textContent\s*=\s*[^;]*labelEditToken/);
  assert.match(source, /"Prescription " \+ nextPrescriptionNumber\(\)/);
});

test("upload failure keeps retry and manual paths and blocks premature field validation", function () {
  var source = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-rx.js"), "utf8");
  assert.match(source, /state\.inputMode !== "upload-pending"/);
  assert.match(source, /event\.stopImmediatePropagation\(\)/);
  assert.match(source, /Prescription not read yet/);
  assert.match(source, /state\.retryAction \|\| initializeUpload/);
  assert.match(source, /clearDraftState\(\{ preserveResult: true \}\)/);
  assert.match(source, /Your lens result is ready, but we couldn't save this prescription yet/);
  assert.match(source, /state\.pendingProfile = createPendingResultProfile/);
});

test("Suggested Lens Strength and approved benefit strip copy are present", function () {
  var html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  assert.match(html, /<h2>Suggested Lens Strength<\/h2>/);
  assert.match(html, /Based on the prescription above, these are the sphere-only mask lens strengths/);
  assert.match(html, /Underwater, light bends differently and can make your usual prescription feel too strong/);
  [
    "Tempered glass lenses",
    "Hypoallergenic silicone",
    "Rated to 100ft",
    "Free Rx check"
  ].forEach(function (claim) { assert.match(html, new RegExp(claim)); });
});

test("preview uses centred full prescription field labels in both eye cards", function () {
  var html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  assert.equal((html.match(/>Sphere \(SPH\)<\/label>/g) || []).length, 2);
  assert.equal((html.match(/>Cylinder \(CYL\)<\/label>/g) || []).length, 2);
  assert.equal((html.match(/>Axis<\/label>/g) || []).length, 2);
});

test("field help tooltips open beside the trigger with responsive side selection", function () {
  var css = fs.readFileSync(path.join(__dirname, "lens-calculator-v52.css"), "utf8");
  var ui = fs.readFileSync(path.join(__dirname, "lens-calculator-v52-ui.js"), "utf8");

  assert.match(css, /--oo-tooltip-gap:\s*10px/);
  assert.match(css, /left:\s*calc\(100% \+ var\(--oo-tooltip-gap\)\)/);
  assert.match(css, /data-tooltip-side="left"/);
  assert.match(css, /\.oo-v52__help-wrap\.is-open\s*\{[\s\S]*?z-index:\s*30/);
  assert.match(ui, /spaceRight >= preferredWidth \|\| spaceRight >= spaceLeft/);
  assert.match(ui, /data-tooltip-side/);
  assert.match(ui, /--oo-tooltip-max-width/);
});

test("upload guidance starts collapsed and reuses de-identified Quiz examples", function () {
  var html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  assert.match(html, /<details class="oo-v52-rx__photo-help">/);
  assert.doesNotMatch(html, /<details class="oo-v52-rx__photo-help" open>/);
  assert.match(html, /Tips for a clear prescription photo/);
  assert.match(html, /Good_Rx_2\.png/);
  assert.match(html, /Bad_Rx_2\.png/);
});

test("manual-entry divider is static guidance rather than a link-like button", function () {
  var html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  var css = fs.readFileSync(path.join(__dirname, "lens-calculator-v52.css"), "utf8");
  var guidanceStyles = css.match(/\.oo-v52-rx__manual-guidance \{([^}]*)\}/);
  assert.match(html, /<p class="oo-v52-rx__manual-guidance">or enter your prescription below/);
  assert.doesNotMatch(html, /id="oo-v52-rx-manual"/);
  assert.ok(guidanceStyles);
  assert.doesNotMatch(guidanceStyles[1], /text-decoration:\s*underline/);
});

test("cropper handle styles provide large touch targets and visible tabs", function () {
  var css = fs.readFileSync(path.join(__dirname, "lens-calculator-v52.css"), "utf8");
  assert.match(css, /\.point-nw,[\s\S]*width: 42px;[\s\S]*height: 42px;/);
  assert.match(css, /\.point-n::after,[\s\S]*width: 52px;[\s\S]*height: 14px;/);
  assert.match(css, /\.point-e::after,[\s\S]*width: 14px;[\s\S]*height: 52px;/);
});

test("uses the permanent isolated Rx test backend with no temporary Preview fallback", function () {
  assert.equal(
    Rx.TEST_BACKEND_URL,
    "https://oceans-optics-rx-test.vercel.app"
  );

  var files = fs.readdirSync(__dirname).filter(function (filename) {
    return /\.(?:css|html|js)$/.test(filename);
  });
  var temporaryBackendPattern = new RegExp(["oceans", "optics", "face"].join("-") + "-");
  files.forEach(function (filename) {
    var source = fs.readFileSync(path.join(__dirname, filename), "utf8");
    assert.doesNotMatch(source, temporaryBackendPattern);
  });
});
