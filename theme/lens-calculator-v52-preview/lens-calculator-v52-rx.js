(function (root, factory) {
  "use strict";

  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (!root) return;

  root.OOV52RxUpload = api;
  if (root.document) {
    var mount = function () {
      api.mount(root.document, {
        root: root,
        calculatorUi: root.OOV52CalculatorUI,
        Cropper: root.Cropper
      });
    };
    if (root.document.readyState === "loading") {
      root.document.addEventListener("DOMContentLoaded", mount, { once: true });
    } else {
      mount();
    }
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var MAX_FILE_SIZE = 8 * 1024 * 1024;
  var MAX_OUTPUT_DIMENSION = 3000;
  var ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf"
  ];
  var TEST_BACKEND_URL = "https://oceans-optics-rx-test.vercel.app";
  var MAX_PRESCRIPTION_LABEL_LENGTH = 60;

  function inferredMimeType(filename) {
    var extension = String(filename || "").toLowerCase().split(".").pop();
    return {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
      pdf: "application/pdf"
    }[extension] || "";
  }

  function canonicalMimeType(file) {
    var type = String(file && file.type || "").toLowerCase();
    if (type === "image/jpg" || type === "image/pjpeg") return "image/jpeg";
    return type || inferredMimeType(file && file.name);
  }

  function isHeic(file) {
    var name = String(file && file.name || "").toLowerCase();
    var type = String(file && file.type || "").toLowerCase();
    return /\.(heic|heif)$/.test(name) || type === "image/heic" || type === "image/heif";
  }

  function validateSelectedFile(file) {
    if (!file) return { ok: false, error: "Choose a prescription image or PDF." };
    if (isHeic(file)) {
      return {
        ok: false,
        error: "HEIC and HEIF files are not supported yet. Choose a JPG, PNG, WebP, GIF, or PDF."
      };
    }

    var mimeType = canonicalMimeType(file);
    if (ALLOWED_TYPES.indexOf(mimeType) === -1) {
      return {
        ok: false,
        error: "Choose a JPG, PNG, WebP, GIF, or PDF prescription file."
      };
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      return { ok: false, error: "This file is empty. Choose another prescription file." };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { ok: false, error: "This file is larger than 8 MiB. Choose a smaller file." };
    }
    return { ok: true, mimeType: mimeType };
  }

  function normalizedFile(file, mimeType, FileCtor) {
    if (file.type === mimeType) return file;
    return new FileCtor([file], file.name, {
      type: mimeType,
      lastModified: file.lastModified || Date.now()
    });
  }

  function reviewModeFor(file) {
    return canonicalMimeType(file) === "application/pdf" ? "pdf" : "image";
  }

  function outputTypeFor(file) {
    var type = canonicalMimeType(file);
    if (type === "image/png" || type === "image/webp") return type;
    return "image/jpeg";
  }

  function extensionForMimeType(mimeType) {
    return {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp"
    }[mimeType] || "jpg";
  }

  function approvedFilename(filename, mimeType) {
    var base = String(filename || "prescription")
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "prescription";
    return base + "-approved." + extensionForMimeType(mimeType);
  }

  function canvasToBlob(canvas, mimeType) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error("The approved image could not be prepared."));
      }, mimeType, 0.94);
    });
  }

  async function approvedImageFromCrop(file, cropper, FileCtor) {
    if (!cropper || typeof cropper.getCroppedCanvas !== "function") {
      throw new Error("The image review tool is not ready. Try choosing the image again.");
    }

    var outputType = outputTypeFor(file);
    var canvas = cropper.getCroppedCanvas({
      maxWidth: MAX_OUTPUT_DIMENSION,
      maxHeight: MAX_OUTPUT_DIMENSION,
      fillColor: outputType === "image/jpeg" ? "#ffffff" : "transparent",
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high"
    });
    if (!canvas) throw new Error("The approved image could not be prepared.");

    var blob = await canvasToBlob(canvas, outputType);
    var actualType = ALLOWED_TYPES.indexOf(blob.type) === -1 ? outputType : blob.type;
    var approved = new FileCtor([blob], approvedFilename(file.name, actualType), {
      type: actualType,
      lastModified: Date.now()
    });
    var validation = validateSelectedFile(approved);
    if (!validation.ok) throw new Error(validation.error);
    return approved;
  }

  function cropActions(cropper) {
    return {
      rotateLeft: function () { cropper.rotate(-90); },
      rotateRight: function () { cropper.rotate(90); },
      reset: function () { cropper.reset(); }
    };
  }

  function unique(values) {
    return values.filter(function (value, index) { return values.indexOf(value) === index; });
  }

  function missingFieldsForExtraction(prescription) {
    var missing = [];
    ["right", "left"].forEach(function (side) {
      var eye = prescription && prescription[side];
      if (!eye || eye.sph === null || eye.sph === undefined || !Number.isFinite(Number(eye.sph))) {
        missing.push(side + ".sphere");
      }
      if (!eye || eye.cyl === null || eye.cyl === undefined || !Number.isFinite(Number(eye.cyl))) {
        missing.push(side + ".cylinder");
        return;
      }
      if (Number(eye.cyl) !== 0) {
        if (eye.cylSign !== "+" && eye.cylSign !== "-") missing.push(side + ".cylinder");
        var axis = Number(eye.axis);
        if (!Number.isInteger(axis) || axis < 1 || axis > 180) missing.push(side + ".axis");
      }
    });
    return unique(missing);
  }

  function friendlyField(key) {
    var parts = key.split(".");
    var eye = parts[0] === "right" ? "right eye" : "left eye";
    var field = parts[1] === "sphere" ? "SPH" : parts[1] === "cylinder" ? "CYL" : "AXIS";
    return field + " for your " + eye;
  }

  function partialMessage(missing) {
    if (missing.length === 1) {
      return "We couldn't clearly read the " + friendlyField(missing[0]) + ". Enter it below, or adjust your image and try again.";
    }
    return "We couldn't clearly read " + missing.map(friendlyField).join(", ") + ". Enter the highlighted values below, or adjust your image and try again.";
  }

  function applyProcessResult(calculatorUi, result) {
    if (!result || result.status === "unreadable" || !result.readable || !result.parsedRx) {
      calculatorUi.markMissingFields([]);
      return {
        kind: "unreadable",
        title: "We couldn't read enough of this prescription",
        message: "Try another image, or enter the prescription manually."
      };
    }

    var failed = calculatorUi.applyPrescription(result.parsedRx) || [];
    var missing = unique(missingFieldsForExtraction(result.parsedRx).concat(failed));
    calculatorUi.markMissingFields(missing);
    if (result.status === "complete" && missing.length === 0) {
      return {
        kind: "complete",
        title: "Prescription found",
        message: "Please check the values below before continuing.",
        missing: []
      };
    }
    return {
      kind: "partial",
      title: "We found most of your prescription",
      message: partialMessage(missing),
      missing: missing
    };
  }

  function recommendationNumber(result, label) {
    var rawValue = result && result.recommendation;
    if (rawValue === null || rawValue === undefined || rawValue === "") {
      throw new Error("A valid " + label + " recommendation is required.");
    }
    var value = Number(rawValue);
    if (!Number.isFinite(value)) throw new Error("A valid " + label + " recommendation is required.");
    return value;
  }

  function normalizePrescriptionLabel(value) {
    var label = typeof value === "string" ? value.trim() : "";
    if (Array.from(label).length > MAX_PRESCRIPTION_LABEL_LENGTH) {
      throw new Error("Prescription label must not exceed 60 characters.");
    }
    return label || null;
  }

  function withOptionalPrescriptionLabel(payload, value) {
    var label = normalizePrescriptionLabel(value);
    if (label) payload.prescriptionLabel = label;
    return payload;
  }

  function createPendingResultProfile(payload, calculation, options) {
    options = options || {};
    var label = normalizePrescriptionLabel(payload && payload.prescriptionLabel);
    var number = Number(options.number) || 1;
    return {
      localId: "pending-prescription-" + number,
      configId: null,
      label: label,
      displayLabel: label || "Prescription " + number,
      source: options.source || "manual",
      status: "unsaved",
      confirmedRx: copyPrescription(payload && { right: payload.right, left: payload.left }),
      recommendationStrategy: payload.recommendationStrategy,
      recommendedRight: Number(payload.recommendedRight),
      recommendedLeft: Number(payload.recommendedLeft),
      prescriptionAttached: false,
      calculation: calculation || null
    };
  }

  function formatPower(value) {
    var power = Number(value);
    if (!Number.isFinite(power)) return "--";
    if (power === 0) return "0.00";
    return (power > 0 ? "+" : "") + power.toFixed(2);
  }

  function formatRxEyeSummary(label, eye) {
    if (!eye || typeof eye !== "object") return label + ": prescription not read";
    var parts = [];
    var sphere = Number(eye.sph);
    if (eye.sph === null || eye.sph === undefined || !Number.isFinite(sphere)) {
      parts.push("SPH not read");
    } else {
      parts.push("SPH " + formatPower(sphere));
    }

    var cylinder = Number(eye.cyl);
    if (eye.cyl === null || eye.cyl === undefined || !Number.isFinite(cylinder)) {
      parts.push("CYL not read");
    } else if (Math.abs(cylinder) < 1e-9) {
      parts.push("CYL 0.00");
    } else {
      var cylinderSign = eye.cylSign === "+" || eye.cylSign === "-" ? eye.cylSign : null;
      parts.push(cylinderSign
        ? "CYL " + cylinderSign + Math.abs(cylinder).toFixed(2)
        : "CYL " + Math.abs(cylinder).toFixed(2) + " (sign not read)");
      var axis = Number(eye.axis);
      parts.push(Number.isInteger(axis) && axis >= 1 && axis <= 180
        ? "×" + String(axis).padStart(3, "0")
        : "AXIS not read");
    }
    return label + ": " + parts.join(" / ");
  }

  function copyPrescription(value) {
    return value ? {
      right: Object.assign({}, value.right),
      left: Object.assign({}, value.left)
    } : null;
  }

  function copyPrescriptionPreview(value) {
    return value ? {
      kind: value.kind,
      filename: value.filename,
      url: value.url || null
    } : null;
  }

  function publicProfile(profile) {
    return profile ? {
      localId: profile.localId,
      configId: profile.configId,
      label: profile.label,
      displayLabel: profile.displayLabel,
      source: profile.source,
      status: profile.status,
      confirmedRx: copyPrescription(profile.confirmedRx),
      recommendationStrategy: profile.recommendationStrategy,
      recommendedRight: profile.recommendedRight,
      recommendedLeft: profile.recommendedLeft,
      prescriptionAttached: profile.prescriptionAttached
    } : null;
  }

  function createProfileStore() {
    var profiles = [];
    var activePrescriptionId = null;

    function add(profile) {
      var label = normalizePrescriptionLabel(profile.label);
      var number = profiles.length + 1;
      var record = {
        localId: profile.localId || "prescription-" + number,
        configId: profile.configId,
        label: label,
        displayLabel: label || "Prescription " + number,
        source: profile.source,
        status: "ready",
        confirmedRx: copyPrescription(profile.confirmedRx),
        recommendationStrategy: profile.recommendationStrategy,
        recommendedRight: Number(profile.recommendedRight),
        recommendedLeft: Number(profile.recommendedLeft),
        prescriptionAttached: Boolean(profile.prescriptionAttached),
        labelEditToken: profile.labelEditToken || null,
        calculation: profile.calculation || null,
        prescriptionPreview: copyPrescriptionPreview(profile.prescriptionPreview)
      };
      profiles.push(record);
      activePrescriptionId = record.localId;
      return publicProfile(record);
    }

    function setActive(id) {
      var profile = profiles.find(function (candidate) { return candidate.localId === id; });
      if (!profile) return null;
      activePrescriptionId = profile.localId;
      return publicProfile(profile);
    }

    function rename(id, value) {
      var profile = profiles.find(function (candidate) { return candidate.localId === id; });
      if (!profile) return null;
      var label = normalizePrescriptionLabel(value);
      var number = profiles.indexOf(profile) + 1;
      profile.label = label;
      profile.displayLabel = label || "Prescription " + number;
      return publicProfile(profile);
    }

    return {
      add: add,
      clearActive: function () { activePrescriptionId = null; },
      getActive: function () {
        return publicProfile(profiles.find(function (profile) {
          return profile.localId === activePrescriptionId;
        }));
      },
      getActiveRecord: function () {
        return profiles.find(function (profile) { return profile.localId === activePrescriptionId; }) || null;
      },
      getAll: function () { return profiles.map(publicProfile); },
      getRecord: function (id) {
        return profiles.find(function (profile) { return profile.localId === id; }) || null;
      },
      disposePreviews: function (revokeObjectUrl) {
        profiles.forEach(function (profile) {
          if (profile.prescriptionPreview && profile.prescriptionPreview.url) {
            revokeObjectUrl(profile.prescriptionPreview.url);
            profile.prescriptionPreview.url = null;
          }
        });
      },
      rename: rename,
      setActive: setActive
    };
  }

  function buildConfirmationPayload(prescription, calculation, prescriptionLabel) {
    var active = calculation && calculation.activeRecommendation;
    var recommendationStrategy = active ? active.recommendationStrategy : "balanced";
    if (recommendationStrategy !== "balanced" && recommendationStrategy !== "closer_to_sph") {
      throw new Error("A valid recommendation strategy is required.");
    }
    var recommendedRight = active
      ? recommendationNumber({ recommendation: active.recommendedRight }, "right-eye")
      : recommendationNumber(calculation.rightResult, "right-eye");
    var recommendedLeft = active
      ? recommendationNumber({ recommendation: active.recommendedLeft }, "left-eye")
      : recommendationNumber(calculation.leftResult, "left-eye");

    return withOptionalPrescriptionLabel({
      right: prescription.right,
      left: prescription.left,
      recommendedRight: recommendedRight,
      recommendedLeft: recommendedLeft,
      calculatorVersion: String(calculation.rightResult.version || "5.3.0-experimental"),
      recommendationStrategy: recommendationStrategy
    }, prescriptionLabel);
  }

  function shouldConfirm(state, calculation) {
    return Boolean(
      state && state.configId && state.editToken && !state.confirmed &&
      calculation && calculation.successful
    );
  }

  function signedUploadUrl(upload) {
    var value = upload && upload.signedUrl;
    var parsed;
    try {
      if (typeof value !== "string" || !value || value !== value.trim()) throw new Error();
      parsed = new URL(value);
    } catch (error) {
      throw new RequestError("The secure upload address was unavailable. Please try again.", 0);
    }
    if (
      parsed.protocol !== "https:" ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      parsed.pathname.indexOf("/storage/v1/object/upload/sign/") === -1 ||
      !parsed.searchParams.get("token")
    ) {
      throw new RequestError("The secure upload address was unavailable. Please try again.", 0);
    }
    return value;
  }

  function RequestError(message, status) {
    this.name = "RequestError";
    this.message = message;
    this.status = status || 0;
  }
  RequestError.prototype = Object.create(Error.prototype);

  function createTransport(options) {
    var fetchImpl = options.fetchImpl;
    var FormDataCtor = options.FormDataCtor;
    var backendUrl = String(options.backendUrl).replace(/\/$/, "");

    async function jsonRequest(url, init, fallbackMessage) {
      var response;
      try {
        response = await fetchImpl(url, init);
      } catch (error) {
        throw new RequestError("The connection was interrupted. Please try again.", 0);
      }
      var data = null;
      try { data = await response.json(); } catch (error) { data = null; }
      if (!response.ok) throw new RequestError(data && data.error || fallbackMessage, response.status);
      return data;
    }

    return {
      init: function (file, prescriptionLabel) {
        var body = withOptionalPrescriptionLabel({
          filename: file.name,
          mimeType: file.type,
          fileSize: file.size,
          source: "calculator",
          quizSessionId: null
        }, prescriptionLabel);
        return jsonRequest(backendUrl + "/api/rx-config/upload/init", {
          method: "POST",
          credentials: "omit",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
      }, "We couldn't prepare the prescription upload. Please try again.");
      },
      manualInit: function (prescriptionLabel) {
        var body = withOptionalPrescriptionLabel({ source: "calculator" }, prescriptionLabel);
        return jsonRequest(backendUrl + "/api/rx-config/manual/init", {
          method: "POST",
          credentials: "omit",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        }, "We couldn't prepare the manual prescription. Please try again.");
      },
      upload: async function (upload, file) {
        var targetUrl = signedUploadUrl(upload);
        var body = new FormDataCtor();
        body.append("cacheControl", "3600");
        body.append("", file, file.name);
        var response;
        try {
          response = await fetchImpl(targetUrl, {
            method: "PUT",
            credentials: "omit",
            headers: { "x-upsert": "false" },
            body: body
          });
        } catch (error) {
          throw new RequestError("The upload was interrupted. Please try again.", 0);
        }
        if (!response.ok) throw new RequestError("The prescription could not be uploaded. Please try again.", response.status);
      },
      process: function (configId, editToken) {
        return jsonRequest(backendUrl + "/api/rx-config/" + encodeURIComponent(configId) + "/process", {
          method: "POST",
          credentials: "omit",
          cache: "no-store",
          headers: { Authorization: "Bearer " + editToken }
        }, "We couldn't read the prescription right now. Please try again.");
      },
      confirm: function (configId, editToken, payload) {
        return jsonRequest(backendUrl + "/api/rx-config/" + encodeURIComponent(configId) + "/confirm", {
          method: "POST",
          credentials: "omit",
          cache: "no-store",
          headers: {
            Authorization: "Bearer " + editToken,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }, "The prescription could not be attached. Please try again.");
      },
      rename: function (configId, labelEditToken, prescriptionLabel) {
        var normalizedLabel = normalizePrescriptionLabel(prescriptionLabel);
        return jsonRequest(backendUrl + "/api/rx-config/" + encodeURIComponent(configId) + "/label", {
          method: "PATCH",
          credentials: "omit",
          cache: "no-store",
          headers: {
            Authorization: "Bearer " + labelEditToken,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ prescriptionLabel: normalizedLabel || "" })
        }, "The prescription name could not be updated. Please try again.");
      }
    };
  }

  // Upload processing stages, in the order the real work happens:
  // create the secure upload, send the file to private storage, then read it.
  var PROCESSING_STAGES = {
    prepare: {
      title: "Preparing your prescription\u2026",
      copy: "Creating a secure, private upload."
    },
    upload: {
      title: "Uploading your prescription\u2026",
      copy: "Sending your file to private storage."
    },
    read: {
      title: "Reading your prescription\u2026",
      copy: "Reading the values from your prescription. This can take a few seconds."
    }
  };

  function processingStage(stage) {
    return Object.prototype.hasOwnProperty.call(PROCESSING_STAGES, stage) ? PROCESSING_STAGES[stage] : null;
  }

  // The optical processing indicator shows only while an uploaded
  // prescription is actively being processed. Manual saves keep the plain
  // busy status, and every non-busy state (success, notice, error) clears it.
  function showsProcessingIndicator(kind, stage) {
    return kind === "busy" && Boolean(processingStage(stage));
  }

  var PROCESSING_MARKUP =
    '<svg class="oo-v52-rx__processing-eyes" viewBox="0 0 120 48" focusable="false" aria-hidden="true">' +
      '<g class="oo-v52-rx__processing-lens oo-v52-rx__processing-lens--right">' +
        '<circle class="oo-v52-rx__processing-rim" cx="36" cy="24" r="17"></circle>' +
        '<circle class="oo-v52-rx__processing-ring" cx="36" cy="24" r="11"></circle>' +
        '<circle class="oo-v52-rx__processing-pupil" cx="36" cy="24" r="4.5"></circle>' +
      '</g>' +
      '<g class="oo-v52-rx__processing-lens oo-v52-rx__processing-lens--left">' +
        '<circle class="oo-v52-rx__processing-rim" cx="84" cy="24" r="17"></circle>' +
        '<circle class="oo-v52-rx__processing-ring" cx="84" cy="24" r="11"></circle>' +
        '<circle class="oo-v52-rx__processing-pupil" cx="84" cy="24" r="4.5"></circle>' +
      '</g>' +
      '<path class="oo-v52-rx__processing-bridge" d="M53 22 Q60 17 67 22"></path>' +
    '</svg>' +
    '<div class="oo-v52-rx__processing-bar" role="progressbar" aria-label="Processing your prescription">' +
      '<span class="oo-v52-rx__processing-bar-fill"></span>' +
    '</div>';

  function mount(doc, options) {
    options = options || {};
    var root = options.root || (typeof window !== "undefined" ? window : null);
    var calculatorUi = options.calculatorUi;
    var CropperCtor = options.Cropper;
    var runtimeConfig = root && root.OOV52_RX_CONFIG || {};
    var FileCtor = options.FileCtor || root && root.File;
    var URLApi = options.URLApi || root && root.URL;
    var transport = options.transport || createTransport({
      fetchImpl: options.fetchImpl || root.fetch.bind(root),
      FormDataCtor: options.FormDataCtor || root.FormData,
      backendUrl: runtimeConfig.backendUrl || TEST_BACKEND_URL
    });

    if (!calculatorUi || !FileCtor || !URLApi) return null;

    function byId(id) { return doc.getElementById(id); }
    var elements = {
      calculator: doc.querySelector(".oo-v52__calculator"),
      entry: byId("oo-v52-rx-entry"),
      upload: byId("oo-v52-rx-upload"),
      file: byId("oo-v52-rx-file"),
      fileError: byId("oo-v52-rx-file-error"),
      review: byId("oo-v52-rx-review"),
      reviewError: byId("oo-v52-rx-review-error"),
      crop: byId("oo-v52-rx-crop"),
      image: byId("oo-v52-rx-image"),
      pdf: byId("oo-v52-rx-pdf"),
      pdfName: byId("oo-v52-rx-pdf-name"),
      tools: byId("oo-v52-rx-tools"),
      rotateLeft: byId("oo-v52-rx-rotate-left"),
      rotateRight: byId("oo-v52-rx-rotate-right"),
      reset: byId("oo-v52-rx-reset"),
      chooseAnother: byId("oo-v52-rx-choose-another"),
      use: byId("oo-v52-rx-use"),
      status: byId("oo-v52-rx-status"),
      statusTitle: byId("oo-v52-rx-status-title"),
      statusCopy: byId("oo-v52-rx-status-copy"),
      retry: byId("oo-v52-rx-retry"),
      adjust: byId("oo-v52-rx-adjust"),
      manualStatus: byId("oo-v52-rx-manual-status"),
      form: byId("oo-v52-form"),
      attached: byId("oo-v52-rx-attached"),
      labelField: byId("oo-v52-rx-label-field"),
      labelDraft: byId("oo-v52-rx-label-draft"),
      label: byId("oo-v52-rx-label"),
      labelHint: byId("oo-v52-rx-label-hint"),
      labelConfirmed: byId("oo-v52-rx-label-confirmed"),
      labelDisplay: byId("oo-v52-rx-label-display"),
      labelDisplayText: byId("oo-v52-rx-label-display-text"),
      labelPencil: byId("oo-v52-rx-label-pencil"),
      labelEditor: byId("oo-v52-rx-label-editor"),
      labelEditInput: byId("oo-v52-rx-label-edit"),
      labelSave: byId("oo-v52-rx-label-save"),
      labelCancel: byId("oo-v52-rx-label-cancel"),
      labelStatus: byId("oo-v52-rx-label-status"),
      profileManager: byId("oo-v52-profiles"),
      profileHeader: byId("oo-v52-profiles-header"),
      profileStatus: byId("oo-v52-profiles-status"),
      profileTabs: byId("oo-v52-profile-tabs"),
      addAnother: byId("oo-v52-add-prescription"),
      profileSummary: byId("oo-v52-profile-summary"),
      profileSummaryLabel: byId("oo-v52-profile-summary-label"),
      profileSummaryRight: byId("oo-v52-profile-summary-right"),
      profileSummaryLeft: byId("oo-v52-profile-summary-left"),
      profileSummaryStrategy: byId("oo-v52-profile-summary-strategy"),
      checkLayout: byId("oo-v52-rx-check-layout"),
      approved: byId("oo-v52-rx-approved"),
      approvedTitle: byId("oo-v52-rx-approved-title"),
      approvedView: byId("oo-v52-rx-approved-view"),
      approvedImage: byId("oo-v52-rx-approved-image"),
      approvedPdf: byId("oo-v52-rx-approved-pdf"),
      approvedPdfName: byId("oo-v52-rx-approved-pdf-name"),
      approvedLarger: byId("oo-v52-rx-approved-larger"),
      approvedAdjust: byId("oo-v52-rx-approved-adjust"),
      approvedAnother: byId("oo-v52-rx-approved-another"),
      expanded: byId("oo-v52-rx-expanded"),
      expandedTitle: byId("oo-v52-rx-expanded-title"),
      expandedImage: byId("oo-v52-rx-expanded-image"),
      expandedClose: byId("oo-v52-rx-expanded-close"),
      readSummary: byId("oo-v52-rx-read-summary"),
      readRight: byId("oo-v52-rx-read-right"),
      readLeft: byId("oo-v52-rx-read-left")
    };
    if (!elements.entry || !elements.file || !elements.review || !elements.status) return null;

    var state = {
      selectedFile: null,
      approvedFile: null,
      cropper: null,
      cropActions: null,
      objectUrl: null,
      configId: null,
      editToken: null,
      labelEditToken: null,
      upload: null,
      source: null,
      prescriptionPreview: null,
      extractedRx: null,
      confirmed: false,
      labelEditing: false,
      tabEditingId: null,
      tabSaving: false,
      labelSaving: false,
      retryAction: null,
      lastConfirmPayload: null,
      inputMode: "manual",
      pendingProfile: null
    };
    var profileStore = createProfileStore();
    var renderedPreview = null;

    function currentLabel() {
      return normalizePrescriptionLabel(elements.label && elements.label.value);
    }

    function nextPrescriptionNumber() {
      return profileStore.getAll().length + 1;
    }

    function activePrescription() {
      return profileStore.getActive() || state.pendingProfile;
    }

    function updateDraftLabelPrompt() {
      var number = nextPrescriptionNumber();
      var example = number === 2 ? "Airies" : number === 3 ? "Mum" : "Name";
      elements.label.placeholder = number === 1
        ? "e.g. James"
        : "e.g. " + example + " — or leave blank for Prescription " + number;
      if (elements.labelHint) {
        elements.labelHint.hidden = number === 1;
        elements.labelHint.textContent = "Adding more than one? A name makes it easier to tell them apart.";
      }
    }

    function collapseExpandedPreview() {
      elements.expanded.hidden = true;
      elements.expandedImage.removeAttribute("src");
      elements.approvedLarger.textContent = "View larger";
      elements.approvedLarger.setAttribute("aria-expanded", "false");
    }

    function previewTitle(preview, profile) {
      var kind = preview && preview.kind === "pdf" ? "Prescription PDF" : "Prescription image";
      if (!profile) {
        var draftLabel = currentLabel();
        return draftLabel
          ? draftLabel + " — " + kind
          : "Prescription " + nextPrescriptionNumber() + (preview && preview.kind === "pdf" ? " PDF" : " image");
      }
      return profile.label
        ? profile.label + " — " + kind
        : profile.displayLabel + (preview && preview.kind === "pdf" ? " PDF" : " image");
    }

    function hideReadSummary() {
      elements.readSummary.hidden = true;
      elements.readRight.textContent = "";
      elements.readLeft.textContent = "";
    }

    function renderReadSummary(prescription) {
      if (!prescription || !prescription.right || !prescription.left) {
        hideReadSummary();
        return;
      }
      elements.readRight.textContent = formatRxEyeSummary("Right", prescription.right);
      elements.readLeft.textContent = formatRxEyeSummary("Left", prescription.left);
      elements.readSummary.hidden = false;
    }

    function hideApprovedPreview() {
      collapseExpandedPreview();
      renderedPreview = null;
      elements.approved.hidden = true;
      elements.approvedView.hidden = true;
      elements.approvedPdf.hidden = true;
      elements.approvedImage.removeAttribute("src");
      elements.approvedPdfName.textContent = "";
      elements.checkLayout.classList.remove("has-approved-preview", "has-locked-preview");
      elements.calculator.classList.remove("has-rx-review-preview");
    }

    function renderApprovedPreview(preview, locked, profile) {
      if (!preview || (preview.kind === "image" && !preview.url)) {
        hideApprovedPreview();
        return;
      }

      renderedPreview = preview;
      var isImage = preview.kind === "image";
      elements.approved.hidden = false;
      elements.approvedView.hidden = !isImage;
      elements.approvedPdf.hidden = isImage;
      elements.approvedLarger.hidden = !isImage;
      elements.approvedAdjust.hidden = Boolean(locked) || !isImage;
      elements.approvedAnother.hidden = Boolean(locked);
      elements.approvedTitle.textContent = previewTitle(preview, profile);
      if (isImage) {
        elements.approvedImage.src = preview.url;
        elements.approvedPdfName.textContent = "";
      } else {
        elements.approvedImage.removeAttribute("src");
        elements.approvedPdfName.textContent = preview.filename;
      }
      elements.checkLayout.classList.add("has-approved-preview");
      elements.checkLayout.classList.toggle("has-locked-preview", Boolean(locked));
      elements.calculator.classList.add("has-rx-review-preview");
    }

    function revokePreview(preview) {
      if (preview && preview.url) URLApi.revokeObjectURL(preview.url);
    }

    function clearDraftPreview() {
      revokePreview(state.prescriptionPreview);
      state.prescriptionPreview = null;
      hideApprovedPreview();
    }

    function setDraftPreview(file) {
      revokePreview(state.prescriptionPreview);
      var kind = reviewModeFor(file);
      state.prescriptionPreview = {
        kind: kind,
        filename: file.name,
        url: kind === "image" ? URLApi.createObjectURL(file) : null
      };
      renderApprovedPreview(state.prescriptionPreview, false);
    }

    function openLargerPreview() {
      if (!renderedPreview || renderedPreview.kind !== "image" || !renderedPreview.url) return;
      if (!elements.expanded.hidden) {
        collapseExpandedPreview();
        return;
      }
      var profile = profileStore.getActive();
      elements.expandedTitle.textContent = previewTitle(renderedPreview, profile);
      elements.expandedImage.src = renderedPreview.url;
      elements.expanded.hidden = false;
      elements.approvedLarger.textContent = "Collapse larger view";
      elements.approvedLarger.setAttribute("aria-expanded", "true");
    }

    function emitPrescriptionChanged() {
      doc.dispatchEvent(new CustomEvent("oo:v52:prescription-changed", {
        detail: activePrescription()
      }));
    }

    // The Prescription Manager (heading, tabs with inline rename) appears only
    // once there are two or more prescriptions; a single prescription keeps
    // the simple flow with just the add action.
    function isManagingPrescriptions() {
      return profileStore.getAll().length >= 2;
    }

    function setProfileStatus(message) {
      if (!elements.profileStatus) return;
      elements.profileStatus.textContent = message || "";
      elements.profileStatus.hidden = !message;
    }

    function profileElement(id, className) {
      return Array.from(elements.profileTabs.querySelectorAll("." + className)).find(function (node) {
        return node.dataset.profileId === id;
      }) || null;
    }

    function renderProfileTab(profile, active) {
      var internal = profileStore.getRecord(profile.localId);
      var isActive = Boolean(active && active.localId === profile.localId);
      var group = doc.createElement("div");
      group.className = "oo-v52-profiles__tab-group" + (isActive ? " is-active" : "");
      group.dataset.profileId = profile.localId;

      if (state.tabEditingId === profile.localId) {
        var editor = doc.createElement("div");
        editor.className = "oo-v52-profiles__editor";
        var input = doc.createElement("input");
        input.type = "text";
        input.maxLength = 60;
        input.autocomplete = "off";
        input.className = "oo-v52-profiles__editor-input";
        input.dataset.profileId = profile.localId;
        input.value = profile.label || "";
        input.placeholder = "Prescription " + (profileStore.getAll().findIndex(function (candidate) {
          return candidate.localId === profile.localId;
        }) + 1);
        input.setAttribute("aria-label", "Name for " + profile.displayLabel);
        input.disabled = state.tabSaving;
        input.addEventListener("keydown", function (event) {
          if (event.key === "Enter") {
            event.preventDefault();
            saveTabRename(profile.localId);
          } else if (event.key === "Escape") {
            event.preventDefault();
            cancelTabRename(profile.localId);
          }
        });
        var save = doc.createElement("button");
        save.type = "button";
        save.className = "oo-v52-profiles__editor-save";
        save.textContent = "Save";
        save.disabled = state.tabSaving;
        save.addEventListener("click", function () { saveTabRename(profile.localId); });
        var cancel = doc.createElement("button");
        cancel.type = "button";
        cancel.className = "oo-v52-profiles__editor-cancel";
        cancel.textContent = "Cancel";
        cancel.disabled = state.tabSaving;
        cancel.addEventListener("click", function () { cancelTabRename(profile.localId); });
        editor.appendChild(input);
        editor.appendChild(save);
        editor.appendChild(cancel);
        group.appendChild(editor);
        return group;
      }

      var button = doc.createElement("button");
      button.type = "button";
      button.className = "oo-v52-profiles__tab";
      button.textContent = profile.displayLabel;
      button.title = profile.displayLabel;
      button.dataset.profileId = profile.localId;
      button.setAttribute("aria-pressed", String(isActive));
      button.addEventListener("click", function () { activateProfile(profile.localId); });
      group.appendChild(button);

      if (internal && internal.labelEditToken) {
        var rename = doc.createElement("button");
        rename.type = "button";
        rename.className = "oo-v52-profiles__rename";
        rename.dataset.profileId = profile.localId;
        rename.setAttribute("aria-label", "Rename " + profile.displayLabel);
        rename.title = "Rename " + profile.displayLabel;
        rename.innerHTML = '<span aria-hidden="true">\u270E</span>';
        rename.disabled = state.tabSaving;
        rename.addEventListener("click", function () { beginTabRename(profile.localId); });
        group.appendChild(rename);
      }
      return group;
    }

    function renderProfileTabs() {
      var profiles = profileStore.getAll();
      var active = profileStore.getActive();
      var managed = profiles.length >= 2;
      elements.profileManager.hidden = profiles.length === 0;
      elements.profileManager.classList.toggle("is-managing", managed);
      if (elements.profileHeader) elements.profileHeader.hidden = !managed;
      elements.profileTabs.hidden = !managed;
      elements.profileTabs.innerHTML = "";
      if (!managed) {
        state.tabEditingId = null;
        return;
      }
      profiles.forEach(function (profile) {
        elements.profileTabs.appendChild(renderProfileTab(profile, active));
      });
    }

    function focusProfileControl(id, className) {
      var target = profileElement(id, className) || profileElement(id, "oo-v52-profiles__tab");
      if (target) target.focus({ preventScroll: true });
    }

    function beginTabRename(id) {
      var internal = profileStore.getRecord(id);
      if (!internal || !internal.labelEditToken || state.tabSaving) return;
      state.tabEditingId = id;
      setProfileStatus("");
      renderProfileTabs();
      var input = profileElement(id, "oo-v52-profiles__editor-input");
      if (input) {
        input.focus({ preventScroll: true });
        input.select();
      }
    }

    function cancelTabRename(id) {
      if (state.tabSaving) return;
      state.tabEditingId = null;
      renderProfileTabs();
      focusProfileControl(id, "oo-v52-profiles__rename");
    }

    async function saveTabRename(id) {
      if (state.tabSaving || state.tabEditingId !== id) return false;
      var internal = profileStore.getRecord(id);
      var input = profileElement(id, "oo-v52-profiles__editor-input");
      if (!internal || !internal.labelEditToken || !input) return false;

      var nextLabel;
      try {
        nextLabel = normalizePrescriptionLabel(input.value);
      } catch (error) {
        setProfileStatus(error.message);
        input.focus({ preventScroll: true });
        return false;
      }
      if (nextLabel === internal.label) {
        cancelTabRename(id);
        return false;
      }

      state.tabSaving = true;
      renderProfileTabs();
      setProfileStatus("Saving name...");
      try {
        await transport.rename(internal.configId, internal.labelEditToken, nextLabel);
        var renamed = profileStore.rename(id, nextLabel);
        state.tabSaving = false;
        state.tabEditingId = null;
        var active = profileStore.getActive();
        if (active && active.localId === id) showConfirmedProfile();
        else renderProfileTabs();
        setProfileStatus("Name updated to " + renamed.displayLabel);
        focusProfileControl(id, "oo-v52-profiles__rename");
        emitPrescriptionChanged();
        return true;
      } catch (error) {
        state.tabSaving = false;
        renderProfileTabs();
        setProfileStatus(error.message || "The prescription name could not be updated.");
        var retry = profileElement(id, "oo-v52-profiles__editor-input");
        if (retry) {
          retry.value = input.value;
          retry.focus({ preventScroll: true });
        }
        return false;
      }
    }

    function renderProfileSummary(profile) {
      elements.profileSummaryLabel.textContent = profile.displayLabel;
      elements.profileSummaryRight.textContent = "R " + formatPower(profile.recommendedRight);
      elements.profileSummaryLeft.textContent = "L " + formatPower(profile.recommendedLeft);
      elements.profileSummaryStrategy.textContent = profile.recommendationStrategy === "closer_to_sph"
        ? "Closer to your SPH"
        : "Balanced (Spherical Equivalent)";
      elements.profileSummary.hidden = false;
    }

    function closeConfirmedLabelEditor(focusDisplay) {
      state.labelEditing = false;
      state.labelSaving = false;
      elements.labelEditor.hidden = true;
      elements.labelDisplay.hidden = false;
      elements.labelEditInput.disabled = false;
      elements.labelSave.disabled = false;
      elements.labelCancel.disabled = false;
      if (focusDisplay) elements.labelDisplay.focus({ preventScroll: true });
    }

    function configureConfirmedLabel(internal, profile) {
      elements.labelDraft.hidden = true;
      // With two or more prescriptions the name and rename action live in the
      // Prescription Manager tabs, so the separate heading is not repeated.
      elements.labelConfirmed.hidden = isManagingPrescriptions();
      elements.labelDisplayText.textContent = profile.displayLabel;
      elements.labelDisplay.disabled = !internal.labelEditToken;
      elements.labelPencil.hidden = !internal.labelEditToken;
      elements.labelDisplay.setAttribute(
        "aria-label",
        internal.labelEditToken
          ? "Edit prescription name, currently " + profile.displayLabel
          : "Prescription name: " + profile.displayLabel
      );
      elements.labelEditInput.value = profile.label || "";
      closeConfirmedLabelEditor(false);
      elements.labelStatus.hidden = true;
      elements.labelStatus.textContent = "";
      if (elements.labelHint) elements.labelHint.hidden = true;
    }

    function beginConfirmedLabelEdit() {
      var internal = profileStore.getActiveRecord();
      var profile = profileStore.getActive();
      if (!internal || !profile || !internal.labelEditToken || state.labelSaving) return;
      state.labelEditing = true;
      elements.labelEditInput.value = profile.label || "";
      elements.labelDisplay.hidden = true;
      elements.labelEditor.hidden = false;
      elements.labelStatus.hidden = true;
      elements.labelStatus.textContent = "";
      elements.labelEditInput.focus({ preventScroll: true });
      elements.labelEditInput.select();
    }

    function cancelConfirmedLabelEdit(focusDisplay) {
      var profile = profileStore.getActive();
      if (state.labelSaving) return;
      if (profile) elements.labelEditInput.value = profile.label || "";
      closeConfirmedLabelEditor(focusDisplay);
      elements.labelStatus.hidden = true;
      elements.labelStatus.textContent = "";
    }

    async function saveConfirmedLabel() {
      if (!state.labelEditing || state.labelSaving) return false;
      var internal = profileStore.getActiveRecord();
      var profile = profileStore.getActive();
      if (!internal || !profile || !internal.labelEditToken) return false;

      var nextLabel;
      try {
        nextLabel = normalizePrescriptionLabel(elements.labelEditInput.value);
      } catch (error) {
        elements.labelStatus.textContent = error.message;
        elements.labelStatus.hidden = false;
        return false;
      }
      if (nextLabel === profile.label) {
        cancelConfirmedLabelEdit(true);
        return false;
      }

      state.labelSaving = true;
      elements.labelEditInput.disabled = true;
      elements.labelSave.disabled = true;
      elements.labelCancel.disabled = true;
      elements.labelStatus.textContent = "Saving name...";
      elements.labelStatus.hidden = false;
      try {
        await transport.rename(internal.configId, internal.labelEditToken, nextLabel);
        profileStore.rename(internal.localId, nextLabel);
        var active = profileStore.getActive();
        if (active) showConfirmedProfile();
        else {
          state.labelEditing = false;
          state.labelSaving = false;
          renderProfileTabs();
        }
        if (active && active.localId === internal.localId) {
          elements.labelStatus.textContent = "Name updated";
          elements.labelStatus.hidden = false;
        }
        emitPrescriptionChanged();
        return true;
      } catch (error) {
        state.labelSaving = false;
        elements.labelEditInput.disabled = false;
        elements.labelSave.disabled = false;
        elements.labelCancel.disabled = false;
        elements.labelStatus.textContent = error.message || "The prescription name could not be updated.";
        elements.labelStatus.hidden = false;
        elements.labelEditInput.focus({ preventScroll: true });
        return false;
      }
    }

    function showConfirmedProfile() {
      var internal = profileStore.getActiveRecord();
      var profile = profileStore.getActive();
      if (!internal || !profile) return null;
      destroyCropper();
      elements.entry.hidden = true;
      elements.review.hidden = true;
      elements.status.hidden = true;
      elements.form.hidden = false;
      elements.labelField.hidden = false;
      elements.attached.hidden = false;
      calculatorUi.restoreConfirmedProfile(internal);
      configureConfirmedLabel(internal, profile);
      renderApprovedPreview(internal.prescriptionPreview, true, profile);
      renderReadSummary(internal.confirmedRx);
      elements.profileSummary.hidden = true;
      if (isManagingPrescriptions() && !state.labelSaving) elements.labelField.hidden = true;
      renderProfileTabs();
      return profile;
    }

    function activateProfile(id) {
      var profile = profileStore.setActive(id);
      if (!profile) return null;
      setProfileStatus("");
      showConfirmedProfile();
      emitPrescriptionChanged();
      return profile;
    }

    function beginAnotherPrescription() {
      destroyCropper();
      clearDraftPreview();
      clearDraftState();
      profileStore.clearActive();
      setProfileStatus("");
      state.selectedFile = null;
      state.approvedFile = null;
      elements.file.value = "";
      elements.label.value = "";
      elements.labelDraft.hidden = false;
      elements.labelConfirmed.hidden = true;
      elements.labelStatus.hidden = true;
      state.labelEditing = false;
      state.labelSaving = false;
      state.inputMode = "manual";
      elements.review.hidden = true;
      elements.status.hidden = true;
      elements.entry.hidden = false;
      elements.form.hidden = false;
      elements.labelField.hidden = false;
      elements.profileSummary.hidden = true;
      elements.attached.hidden = true;
      calculatorUi.resetForNewPrescription();
      hideReadSummary();
      updateDraftLabelPrompt();
      renderProfileTabs();
      emitPrescriptionChanged();
      elements.entry.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    calculatorUi.setPrescriptionManager({
      getPrescriptionProfiles: function () { return profileStore.getAll(); },
      getActivePrescription: activePrescription,
      setActivePrescription: activateProfile
    });

    function clearReviewError() {
      elements.reviewError.textContent = "";
      elements.reviewError.hidden = true;
    }

    function showReviewError(message) {
      elements.reviewError.textContent = message;
      elements.reviewError.hidden = false;
    }

    function clearFileError() {
      elements.fileError.textContent = "";
      elements.fileError.hidden = true;
    }

    function showFileError(message) {
      elements.fileError.textContent = message;
      elements.fileError.hidden = false;
      elements.entry.hidden = false;
    }

    function destroyCropper() {
      if (state.cropper) state.cropper.destroy();
      state.cropper = null;
      state.cropActions = null;
      if (state.objectUrl) URLApi.revokeObjectURL(state.objectUrl);
      state.objectUrl = null;
      elements.image.removeAttribute("src");
    }

    function clearDraftState(options) {
      options = options || {};
      state.configId = null;
      state.editToken = null;
      state.labelEditToken = null;
      state.upload = null;
      state.source = null;
      state.extractedRx = null;
      state.confirmed = false;
      state.lastConfirmPayload = null;
      if (!options.preserveResult) state.pendingProfile = null;
      elements.attached.hidden = true;
      hideReadSummary();
    }

    function processingIndicator() {
      var existing = elements.status.querySelector(".oo-v52-rx__processing");
      if (existing) return existing;
      var indicator = doc.createElement("div");
      indicator.className = "oo-v52-rx__processing";
      indicator.hidden = true;
      indicator.innerHTML = PROCESSING_MARKUP;
      elements.status.insertBefore(indicator, elements.statusTitle);
      return indicator;
    }

    function setProcessingStage(stage) {
      var active = showsProcessingIndicator("busy", stage);
      if (!active && !elements.status.querySelector(".oo-v52-rx__processing")) return;
      var indicator = processingIndicator();
      indicator.hidden = !active;
      if (active) elements.status.dataset.processing = stage;
      else delete elements.status.dataset.processing;
    }

    function setProcessingStatus(stage) {
      var model = processingStage(stage);
      setStatus("busy", model.title, model.copy, { processing: stage });
    }

    function setStatus(kind, title, message, actions) {
      actions = actions || {};
      setProcessingStage(kind === "busy" ? actions.processing : null);
      elements.status.dataset.state = kind;
      elements.statusTitle.textContent = title;
      elements.statusCopy.textContent = message;
      elements.status.hidden = false;
      elements.status.setAttribute("aria-busy", kind === "busy" ? "true" : "false");
      elements.retry.hidden = !actions.retry;
      elements.adjust.hidden = !actions.adjust;
      elements.manualStatus.hidden = !actions.manual;
      state.retryAction = actions.retry || null;
    }

    function openFilePicker() {
      elements.file.value = "";
      elements.file.click();
    }

    function showManualEntry() {
      destroyCropper();
      elements.review.hidden = true;
      elements.status.hidden = true;
      elements.entry.hidden = false;
      state.inputMode = "manual";
      calculatorUi.setPrescriptionLocked(false);
      elements.form.scrollIntoView({ behavior: "smooth", block: "start" });
      var firstControl = elements.form.querySelector('[data-eye="right"] .oo-v52__sign[data-field="sphere"]');
      if (firstControl) firstControl.focus({ preventScroll: true });
    }

    function showPdfReview(file) {
      destroyCropper();
      hideApprovedPreview();
      elements.entry.hidden = true;
      elements.status.hidden = true;
      elements.review.hidden = false;
      elements.crop.hidden = true;
      elements.tools.hidden = true;
      elements.pdf.hidden = false;
      elements.pdfName.textContent = file.name;
      elements.use.textContent = "Use this prescription";
      elements.use.disabled = false;
      clearReviewError();
    }

    function showImageReview(file) {
      if (!CropperCtor) {
        showFileError("The image review tool could not load. Refresh the page or enter the prescription manually.");
        return;
      }
      destroyCropper();
      hideApprovedPreview();
      elements.entry.hidden = true;
      elements.status.hidden = true;
      elements.review.hidden = false;
      elements.crop.hidden = false;
      elements.tools.hidden = false;
      elements.pdf.hidden = true;
      elements.use.textContent = "Use this image";
      elements.use.disabled = true;
      clearReviewError();

      state.objectUrl = URLApi.createObjectURL(file);
      elements.image.onload = function () {
        state.cropper = new CropperCtor(elements.image, {
          viewMode: 1,
          dragMode: "move",
          autoCropArea: 1,
          responsive: true,
          restore: false,
          background: false,
          guides: true,
          center: true,
          highlight: true,
          cropBoxMovable: true,
          cropBoxResizable: true,
          movable: true,
          zoomable: true,
          rotatable: true,
          scalable: false,
          toggleDragModeOnDblclick: false,
          checkOrientation: true,
          ready: function () { elements.use.disabled = false; }
        });
        state.cropActions = cropActions(state.cropper);
      };
      elements.image.onerror = function () {
        showReviewError("This image could not be opened. Choose another file.");
      };
      elements.image.src = state.objectUrl;
    }

    function selectFile(file) {
      clearFileError();
      var validation = validateSelectedFile(file);
      if (!validation.ok) {
        showFileError(validation.error);
        return;
      }

      clearDraftPreview();
      clearDraftState();
      calculatorUi.markMissingFields([]);
      state.selectedFile = normalizedFile(file, validation.mimeType, FileCtor);
      state.inputMode = "upload-review";
      if (reviewModeFor(state.selectedFile) === "pdf") showPdfReview(state.selectedFile);
      else showImageReview(state.selectedFile);
    }

    async function processUpload() {
      setProcessingStatus("read");
      try {
        var result = await transport.process(state.configId, state.editToken);
        state.extractedRx = result && result.parsedRx || null;
        renderReadSummary(state.extractedRx);
        var model = applyProcessResult(calculatorUi, result);
        state.inputMode = model.kind === "unreadable" ? "upload-pending" : "upload-populated";
        if (model.kind === "complete") {
          setStatus("success", model.title, model.message);
        } else if (model.kind === "partial") {
          setStatus("notice", model.title, model.message, { adjust: true });
        } else {
          setStatus("notice", model.title, model.message, { retry: processUpload, adjust: true, manual: true });
        }
        elements.form.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (error) {
        state.inputMode = "upload-pending";
        setStatus(
          "error",
          "We couldn't read the prescription right now",
          error.message || "Please try again, choose another file, or enter the values manually.",
          { retry: processUpload, adjust: true, manual: true }
        );
      }
    }

    async function uploadFile() {
      setProcessingStatus("upload");
      try {
        await transport.upload(state.upload, state.approvedFile);
        state.upload = null;
        await processUpload();
      } catch (error) {
        setStatus(
          "error",
          "The upload didn't finish",
          error.message || "Please check your connection and try again.",
          { retry: uploadFile, adjust: true, manual: true }
        );
      }
    }

    async function initializeUpload() {
      setProcessingStatus("prepare");
      try {
        var initialized = await transport.init(state.approvedFile, currentLabel());
        state.configId = initialized.configId;
        state.editToken = initialized.editToken;
        state.labelEditToken = initialized.labelEditToken || null;
        state.upload = initialized.upload;
        state.source = "uploaded";
        await uploadFile();
      } catch (error) {
        clearDraftState();
        setStatus(
          "error",
          "The upload couldn't be started",
          error.message || "Please check your connection and try again.",
          { retry: initializeUpload, adjust: true, manual: true }
        );
      }
    }

    async function useSelectedFile() {
      clearReviewError();
      elements.use.disabled = true;
      setProcessingStatus("prepare");
      try {
        state.approvedFile = reviewModeFor(state.selectedFile) === "pdf"
          ? state.selectedFile
          : await approvedImageFromCrop(state.selectedFile, state.cropper, FileCtor);
        setDraftPreview(state.approvedFile);
        state.inputMode = "upload-pending";
        destroyCropper();
        elements.review.hidden = true;
        await initializeUpload();
      } catch (error) {
        setProcessingStage(null);
        elements.status.hidden = true;
        showReviewError(error.message || "The approved image could not be prepared.");
        elements.use.disabled = false;
      }
    }

    function chooseAnother() {
      destroyCropper();
      clearDraftPreview();
      clearDraftState();
      state.selectedFile = null;
      state.approvedFile = null;
      state.inputMode = "manual";
      elements.review.hidden = true;
      elements.status.hidden = true;
      elements.entry.hidden = false;
      openFilePicker();
    }

    function adjustOrChooseAnother() {
      clearDraftPreview();
      clearDraftState();
      elements.status.hidden = true;
      if (state.selectedFile && reviewModeFor(state.selectedFile) === "image") {
        state.inputMode = "upload-review";
        showImageReview(state.selectedFile);
        return;
      }
      chooseAnother();
    }

    async function confirmPrescription(payload, calculation) {
      setStatus("busy", "Saving your prescription...", "Saving the values you checked with your V5.3 experimental result.");
      try {
        await transport.confirm(state.configId, state.editToken, payload);
        var profile = profileStore.add({
          configId: state.configId,
          label: payload.prescriptionLabel,
          source: state.source,
          confirmedRx: { right: payload.right, left: payload.left },
          recommendationStrategy: payload.recommendationStrategy,
          recommendedRight: payload.recommendedRight,
          recommendedLeft: payload.recommendedLeft,
          prescriptionAttached: state.source === "uploaded",
          labelEditToken: state.labelEditToken,
          calculation: calculation,
          prescriptionPreview: state.prescriptionPreview
        });
        state.prescriptionPreview = null;
        state.pendingProfile = null;
        state.editToken = null;
        state.labelEditToken = null;
        state.upload = null;
        state.approvedFile = null;
        state.selectedFile = null;
        state.confirmed = true;
        state.lastConfirmPayload = null;
        state.retryAction = null;
        showConfirmedProfile();
        emitPrescriptionChanged();
        return profile;
      } catch (error) {
        setStatus(
          "error",
          "Your lens result is ready",
          "Your lens result is ready, but we couldn't save this prescription yet. Try again before continuing to checkout.",
          { retry: function () { return confirmPrescription(payload, calculation); }, adjust: true, manual: true }
        );
      }
    }

    async function initializeManualPrescription(payload, calculation) {
      setStatus("busy", "Saving your prescription...", "Creating a secure prescription record.");
      try {
        var initialized = await transport.manualInit(currentLabel());
        state.configId = initialized.configId;
        state.editToken = initialized.editToken;
        state.labelEditToken = initialized.labelEditToken || null;
        state.source = "manual";
        await confirmPrescription(payload, calculation);
      } catch (error) {
        clearDraftState({ preserveResult: true });
        setStatus(
          "error",
          "Your lens result is ready",
          "Your lens result is ready, but we couldn't save this prescription yet. Try again before continuing to checkout.",
          { retry: function () { return initializeManualPrescription(payload, calculation); }, manual: true }
        );
      }
    }

    elements.upload.addEventListener("click", openFilePicker);
    elements.manualStatus.addEventListener("click", showManualEntry);
    elements.chooseAnother.addEventListener("click", chooseAnother);
    elements.adjust.addEventListener("click", adjustOrChooseAnother);
    elements.retry.addEventListener("click", function () {
      if (state.retryAction) state.retryAction();
    });
    elements.file.addEventListener("change", function () {
      if (elements.file.files && elements.file.files[0]) selectFile(elements.file.files[0]);
    });
    elements.rotateLeft.addEventListener("click", function () {
      if (state.cropActions) state.cropActions.rotateLeft();
    });
    elements.rotateRight.addEventListener("click", function () {
      if (state.cropActions) state.cropActions.rotateRight();
    });
    elements.reset.addEventListener("click", function () {
      if (state.cropActions) state.cropActions.reset();
    });
    elements.use.addEventListener("click", useSelectedFile);
    elements.addAnother.addEventListener("click", beginAnotherPrescription);
    elements.approvedView.addEventListener("click", openLargerPreview);
    elements.approvedLarger.addEventListener("click", openLargerPreview);
    elements.approvedAdjust.addEventListener("click", adjustOrChooseAnother);
    elements.approvedAnother.addEventListener("click", chooseAnother);
    elements.expandedClose.addEventListener("click", collapseExpandedPreview);

    elements.form.addEventListener("submit", function (event) {
      if (state.inputMode !== "upload-pending") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setStatus(
        "error",
        "Prescription not read yet",
        "Try reading the approved prescription again, or choose Enter prescription manually before calculating.",
        { retry: state.retryAction || initializeUpload, adjust: true, manual: true }
      );
      elements.status.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, true);

    elements.labelDisplay.addEventListener("click", beginConfirmedLabelEdit);
    elements.labelSave.addEventListener("click", saveConfirmedLabel);
    elements.labelCancel.addEventListener("click", function () {
      cancelConfirmedLabelEdit(true);
    });
    elements.labelEditInput.addEventListener("keydown", function (event) {
      if (event.isComposing) return;
      if (event.key === "Enter") {
        event.preventDefault();
        saveConfirmedLabel();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancelConfirmedLabelEdit(true);
      }
    });

    function handleOutsideLabelPointer(event) {
      if (!state.labelEditing || state.labelSaving || elements.labelEditor.contains(event.target)) return;
      var profile = profileStore.getActive();
      var nextLabel;
      try {
        nextLabel = normalizePrescriptionLabel(elements.labelEditInput.value);
      } catch (error) {
        saveConfirmedLabel();
        return;
      }
      if (profile && nextLabel === profile.label) cancelConfirmedLabelEdit(false);
      else saveConfirmedLabel();
    }
    doc.addEventListener("pointerdown", handleOutsideLabelPointer, true);

    doc.addEventListener("oo:v52:calculated", function (event) {
      var calculation = event.detail;
      if (!calculation || !calculation.successful) return;
      try {
        state.lastConfirmPayload = buildConfirmationPayload(
          calculatorUi.getConfirmedPrescription(),
          calculation,
          currentLabel()
        );
        calculatorUi.setPrescriptionFinalizing();
        state.pendingProfile = createPendingResultProfile(state.lastConfirmPayload, calculation, {
          number: nextPrescriptionNumber(),
          source: state.source || (state.approvedFile ? "uploaded" : "manual")
        });
        emitPrescriptionChanged();
        if (shouldConfirm(state, calculation)) {
          confirmPrescription(state.lastConfirmPayload, calculation);
        } else {
          initializeManualPrescription(state.lastConfirmPayload, calculation);
        }
      } catch (error) {
        setStatus("error", "Please check your prescription", error.message, { manual: true });
      }
    });

    function destroy() {
      destroyCropper();
      clearDraftPreview();
      profileStore.disposePreviews(function (url) { URLApi.revokeObjectURL(url); });
      collapseExpandedPreview();
      doc.removeEventListener("pointerdown", handleOutsideLabelPointer, true);
    }

    return {
      selectFile: selectFile,
      state: state,
      profileStore: profileStore,
      beginAnotherPrescription: beginAnotherPrescription,
      destroy: destroy
    };
  }

  return {
    ALLOWED_TYPES: ALLOWED_TYPES,
    MAX_FILE_SIZE: MAX_FILE_SIZE,
    MAX_OUTPUT_DIMENSION: MAX_OUTPUT_DIMENSION,
    TEST_BACKEND_URL: TEST_BACKEND_URL,
    MAX_PRESCRIPTION_LABEL_LENGTH: MAX_PRESCRIPTION_LABEL_LENGTH,
    validateSelectedFile: validateSelectedFile,
    reviewModeFor: reviewModeFor,
    approvedImageFromCrop: approvedImageFromCrop,
    cropActions: cropActions,
    missingFieldsForExtraction: missingFieldsForExtraction,
    applyProcessResult: applyProcessResult,
    normalizePrescriptionLabel: normalizePrescriptionLabel,
    withOptionalPrescriptionLabel: withOptionalPrescriptionLabel,
    createPendingResultProfile: createPendingResultProfile,
    formatRxEyeSummary: formatRxEyeSummary,
    createProfileStore: createProfileStore,
    buildConfirmationPayload: buildConfirmationPayload,
    shouldConfirm: shouldConfirm,
    signedUploadUrl: signedUploadUrl,
    createTransport: createTransport,
    PROCESSING_STAGES: PROCESSING_STAGES,
    processingStage: processingStage,
    showsProcessingIndicator: showsProcessingIndicator,
    mount: mount
  };
});
