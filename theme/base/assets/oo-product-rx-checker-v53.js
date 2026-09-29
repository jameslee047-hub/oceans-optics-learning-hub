(function (root, factory) {
  "use strict";

  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (!root || !root.document) return;

  root.OOProductRxChecker = api;
  var mount = function () {
    Array.prototype.forEach.call(root.document.querySelectorAll("[data-oo-product-rx-checker]"), function (container) {
      api.mount(container, {
        root: root,
        engine: root.OOLensCalculatorV53,
        highCyl: root.OOV52HighCylinder,
        products: root.OOV52Products,
        rx: root.OOV52RxUpload,
        handoff: root.OORxProductHandoff
      });
    });
  };
  if (root.document.readyState === "loading") {
    root.document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  // Product-page prescription checker. It never calculates lens powers itself:
  // recommendations come from the approved V5.3 engine, buildability from the
  // shared product catalog, durable saving from the shared Rx transport, and the
  // Avis/Shopify handoff from the shared product-page handoff module.

  var SOURCE = "product_rx_checker";
  var FULL_CALCULATOR_URL = "https://oceansoptics.com/pages/prescription-lenses-calculator-tool";
  var BACKEND_URL = "https://oceans-optics-rx-test.vercel.app";
  var NOT_BUILDABLE_MESSAGE = "This mask isn't available with both of your recommended lens strengths.";
  var BUILDABLE_MESSAGE = "This mask supports your recommended lenses.";
  var EPSILON = 1e-9;
  var PDF_ERROR = "This PDF couldn't be opened. Choose another file, use a photo of your prescription, or enter it manually.";
  var PDF_RENDER_LONGEST_SIDE = 2400;

  // Same crop settings as the full V5.3 calculator's upload review.
  function CROPPER_OPTIONS(onReady) {
    return {
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
      ready: onReady
    };
  }

  // Render a PDF page with its longest side near 2400px (never below 1x, max 4x).
  function pdfRenderScale(width, height) {
    var longest = Math.max(Number(width) || 0, Number(height) || 0);
    if (!(longest > 0)) return 1;
    return Math.max(1, Math.min(4, PDF_RENDER_LONGEST_SIDE / longest));
  }

  function pdfPageFilename(name, pageNumber) {
    var base = String(name || "prescription").replace(/\.pdf$/i, "").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "prescription";
    return base + "-page-" + pageNumber + ".jpg";
  }

  function steps(from, to, step) {
    var values = [];
    for (var v = from; v <= to + EPSILON; v += step) values.push(Math.round(v * 100) / 100);
    return values;
  }

  var SPHERE_VALUES = steps(-20, 20, 0.25);
  var CYLINDER_VALUES = steps(-6, 6, 0.25);

  function formatPower(value) {
    var n = Number(value);
    if (!Number.isFinite(n)) return "--";
    if (Math.abs(n) < EPSILON) return "0.00";
    return (n > 0 ? "+" : "-") + Math.abs(n).toFixed(2);
  }

  function formatLensLabel(value) {
    var n = Number(value);
    return Number.isFinite(n) && Math.abs(n) < EPSILON ? "Plano (0.00)" : formatPower(value);
  }

  function handleFromUrl(url) {
    var match = String(url || "").match(/\/products\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]).toLowerCase() : null;
  }

  // The catalog product whose variant URLs point at this Shopify product handle.
  // Product pages sold with exactly an existing family's lens stock, audited
  // against live Avis OD/OS options. They reuse that family's definition.
  var HANDLE_ALIASES = {
    // Rx Obsidian clear seal (Medium): OD/OS 0.00, -1.00 to -9.00 = Obsidian Near.
    "prescription-scuba-dive-snorkel-mask-optical": "obsidian-nearsighted"
  };

  function catalogProductForHandle(handle, catalog) {
    var wanted = String(handle || "").trim().toLowerCase();
    if (!wanted) return null;
    if (Object.prototype.hasOwnProperty.call(HANDLE_ALIASES, wanted)) {
      var aliasId = HANDLE_ALIASES[wanted];
      return (catalog || []).find(function (product) { return product.id === aliasId; }) || null;
    }
    return (catalog || []).find(function (product) {
      return (product.variantMap || []).some(function (variant) { return handleFromUrl(variant.url) === wanted; });
    }) || null;
  }

  // Confirmed-prescription shape shared with the full calculator and backend.
  function confirmedEye(eye) {
    var cylinder = Number(eye.cylinder);
    var axis = eye.axis === null || eye.axis === undefined || eye.axis === "" ? null : Number(eye.axis);
    return {
      sph: Number(eye.sphere),
      cyl: Math.abs(cylinder),
      cylSign: cylinder < 0 ? "-" : "+",
      axis: Math.abs(cylinder) < EPSILON ? null : axis
    };
  }

  function engineInput(eye) {
    var cylinder = Number(eye.cylinder);
    return {
      sphere: String(eye.sphere),
      cylinder: String(Math.abs(cylinder) < EPSILON ? 0 : cylinder),
      axis: Math.abs(cylinder) < EPSILON || eye.axis === null || eye.axis === undefined ? "" : String(eye.axis)
    };
  }

  function validateEntry(entry) {
    var errors = [];
    ["right", "left"].forEach(function (side) {
      var eye = entry && entry[side];
      var name = side === "right" ? "Right" : "Left";
      if (!eye || eye.sphere === "" || eye.sphere === null || !Number.isFinite(Number(eye.sphere))) errors.push(name + " SPH is required.");
      var cylinder = eye ? Number(eye.cylinder || 0) : 0;
      if (Math.abs(cylinder) > EPSILON) {
        var axis = Number(eye.axis);
        if (!Number.isInteger(axis) || axis < 1 || axis > 180) errors.push(name + " AXIS is required when CYL is not 0.00.");
      }
    });
    return errors;
  }

  // Runs the approved V5.3 engine for both eyes and, when high CYL is present,
  // the existing high-CYL helper for the Closer to your SPH alternative.
  function calculate(engine, highCyl, entry) {
    var rightResult = engine.calculateEyeRecommendationV53(engineInput(entry.right), "Right eye");
    var leftResult = engine.calculateEyeRecommendationV53(engineInput(entry.left), "Left eye");
    var calculation = {
      successful: false,
      rightResult: rightResult,
      leftResult: leftResult,
      review: false,
      highCylinderPreview: null,
      activeRecommendation: null
    };
    if (!rightResult.valid || !leftResult.valid) {
      calculation.errors = [].concat(rightResult.errors || [], leftResult.errors || []);
      return calculation;
    }
    if (!rightResult.recommendation || !leftResult.recommendation) {
      calculation.review = true;
      return calculation;
    }
    var preview = highCyl ? highCyl.calculatePairAlternative(rightResult, leftResult) : null;
    calculation.highCylinderPreview = preview && preview.triggered && preview.available ? preview : null;
    calculation.activeRecommendation = selectStrategy(calculation, highCyl, "balanced");
    calculation.successful = true;
    return calculation;
  }

  function selectStrategy(calculation, highCyl, strategy) {
    if (calculation.highCylinderPreview && highCyl) {
      return highCyl.recommendationSelection(calculation.highCylinderPreview, strategy);
    }
    return {
      recommendationStrategy: "balanced",
      recommendedRight: Number(calculation.rightResult.finalStockPower),
      recommendedLeft: Number(calculation.leftResult.finalStockPower),
      displayRight: calculation.rightResult.recommendation,
      displayLeft: calculation.leftResult.recommendation
    };
  }

  function buildability(product, recommendation, supportsPower) {
    if (!product) return { buildable: false, reason: "unknown-product" };
    var right = supportsPower(product, recommendation.recommendedRight);
    var left = supportsPower(product, recommendation.recommendedLeft);
    return { buildable: right && left, right: right, left: left, reason: right && left ? "ok" : "unsupported-power" };
  }

  // The summary object the product-page handoff validates and applies to Avis.
  function handoffSummary(configId, recommendation, label, prescriptionAttached) {
    return {
      configId: String(configId).toLowerCase(),
      status: "confirmed",
      recommendedRight: recommendation.recommendedRight,
      recommendedLeft: recommendation.recommendedLeft,
      prescriptionAttached: Boolean(prescriptionAttached),
      prescriptionLabel: label || null
    };
  }

  // ---------------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------------

  function el(doc, tag, className, text) {
    var node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function option(doc, value, label) {
    var node = doc.createElement("option");
    node.value = value;
    node.textContent = label;
    return node;
  }

  function mount(container, deps) {
    if (!container || container.dataset.ooCheckerMounted === "true") return null;
    var doc = container.ownerDocument;
    var root = deps.root;
    var engine = deps.engine, highCyl = deps.highCyl, products = deps.products, rx = deps.rx, handoff = deps.handoff;
    if (!engine || !products || !rx) {
      container.hidden = true;
      return null;
    }
    var product = catalogProductForHandle(container.dataset.productHandle, products.CATALOG);
    if (!product) {
      // Not one of the active Rx mask families: never show a lens checker here.
      container.hidden = true;
      return null;
    }
    container.dataset.ooCheckerMounted = "true";
    container.dataset.catalogProduct = product.id;
    var transport = rx.createTransport({
      fetchImpl: root.fetch.bind(root),
      FormDataCtor: root.FormData,
      backendUrl: (root.OOV52_RX_CONFIG && root.OOV52_RX_CONFIG.backendUrl) || BACKEND_URL
    });
    var state = { upload: null, configId: null, editToken: null, source: "manual", calculation: null, busy: false, file: null };

    var q = function (selector) { return container.querySelector(selector); };
    var status = q("[data-checker-status]");
    var form = q("[data-checker-form]");
    var fileInput = q("[data-checker-file]");
    var checkButton = q("[data-checker-check]");
    var result = q("[data-checker-result]");
    var labelInput = q("[data-checker-label]");

    ["right", "left"].forEach(function (side) {
      var sph = q('[data-eye="' + side + '"] [data-field="sphere"]');
      var cyl = q('[data-eye="' + side + '"] [data-field="cylinder"]');
      var axis = q('[data-eye="' + side + '"] [data-field="axis"]');
      sph.appendChild(option(doc, "", "SPH"));
      SPHERE_VALUES.forEach(function (v) { sph.appendChild(option(doc, String(v), formatPower(v))); });
      CYLINDER_VALUES.forEach(function (v) { cyl.appendChild(option(doc, String(v), formatPower(v))); });
      cyl.value = "0";
      axis.appendChild(option(doc, "", "AXIS"));
      for (var a = 1; a <= 180; a += 1) axis.appendChild(option(doc, String(a), String(a).padStart(3, "0")));
      var syncAxis = function () {
        var needsAxis = Math.abs(Number(cyl.value)) > EPSILON;
        axis.disabled = !needsAxis;
        if (!needsAxis) axis.value = "";
      };
      cyl.addEventListener("change", syncAxis);
      syncAxis();
    });

    function setStatus(kind, message) {
      status.dataset.state = kind || "";
      status.textContent = message || "";
      status.hidden = !message;
    }

    function setBusy(busy) {
      state.busy = busy;
      container.setAttribute("aria-busy", busy ? "true" : "false");
      [checkButton, fileInput].forEach(function (node) { if (node) node.disabled = busy; });
    }

    function readEntry() {
      var entry = {};
      ["right", "left"].forEach(function (side) {
        entry[side] = {
          sphere: q('[data-eye="' + side + '"] [data-field="sphere"]').value,
          cylinder: q('[data-eye="' + side + '"] [data-field="cylinder"]').value || "0",
          axis: q('[data-eye="' + side + '"] [data-field="axis"]').value || null
        };
      });
      return entry;
    }

    function applyExtracted(parsed) {
      ["right", "left"].forEach(function (side) {
        var eye = parsed && parsed[side];
        if (!eye) return;
        var sph = Number(eye.sph);
        var cylMagnitude = Math.abs(Number(eye.cyl || 0));
        var signedCyl = eye.cylSign === "+" ? cylMagnitude : -cylMagnitude;
        var set = function (field, value) {
          var select = q('[data-eye="' + side + '"] [data-field="' + field + '"]');
          var wanted = String(Math.round(value * 100) / 100);
          if (Array.prototype.some.call(select.options, function (o) { return o.value === wanted; })) select.value = wanted;
          select.dispatchEvent(new root.Event("change", { bubbles: true }));
        };
        if (Number.isFinite(sph)) set("sphere", sph);
        if (Number.isFinite(signedCyl)) set("cylinder", signedCyl);
        var axis = q('[data-eye="' + side + '"] [data-field="axis"]');
        if (eye.axis && Math.abs(signedCyl) > EPSILON) axis.value = String(Number(eye.axis));
      });
    }

    // Upload review: images and PDFs are previewed and cropped on this device;
    // only the cropped prescription image is uploaded and read. PDFs are
    // rendered locally (one chosen page) and never uploaded as the original.
    var review = q("[data-checker-review]");
    var cropImage = q("[data-checker-crop-image]");
    var pageField = q("[data-checker-pages]");
    var pageSelect = q("[data-checker-page]");
    var useButton = q("[data-checker-use]");
    var cropper = null;
    var cropTools = null;
    var sourceFile = null;
    var objectUrl = null;
    var pdfDoc = null;
    var pdfName = "prescription.pdf";

    function destroyCropper() {
      if (cropper) cropper.destroy();
      cropper = null;
      cropTools = null;
      if (objectUrl) root.URL.revokeObjectURL(objectUrl);
      objectUrl = null;
      cropImage.removeAttribute("src");
    }

    function closeReview() {
      destroyCropper();
      if (pdfDoc && typeof pdfDoc.destroy === "function") pdfDoc.destroy();
      pdfDoc = null;
      sourceFile = null;
      review.hidden = true;
      pageField.hidden = true;
      useButton.disabled = true;
      fileInput.value = "";
    }

    function resetUploadState() {
      state.upload = null;
      state.configId = null;
      state.editToken = null;
      state.file = null;
      state.source = "manual";
    }

    function showInCropper(file) {
      destroyCropper();
      sourceFile = file;
      objectUrl = root.URL.createObjectURL(file);
      useButton.disabled = true;
      return new Promise(function (resolve, reject) {
        cropImage.onload = function () {
          if (typeof root.Cropper !== "function") {
            reject(new Error("The crop tool couldn't load. Refresh the page or enter your prescription manually."));
            return;
          }
          cropper = new root.Cropper(cropImage, CROPPER_OPTIONS(function () {
            useButton.disabled = false;
            resolve();
          }));
          cropTools = rx.cropActions(cropper);
        };
        cropImage.onerror = function () {
          reject(new Error("This file could not be opened. Choose another file."));
        };
        cropImage.src = objectUrl;
      });
    }

    function loadPdfJs() {
      if (root.pdfjsLib) return Promise.resolve(root.pdfjsLib);
      return new Promise(function (resolve, reject) {
        var script = doc.createElement("script");
        script.src = container.dataset.pdfjsSrc;
        script.async = true;
        script.onload = function () {
          if (!root.pdfjsLib) return reject(new Error(PDF_ERROR));
          root.pdfjsLib.GlobalWorkerOptions.workerSrc = container.dataset.pdfjsWorker;
          resolve(root.pdfjsLib);
        };
        script.onerror = function () { reject(new Error(PDF_ERROR)); };
        doc.head.appendChild(script);
      });
    }

    async function renderPdfPage(number) {
      var page = await pdfDoc.getPage(number);
      var base = page.getViewport({ scale: 1 });
      var viewport = page.getViewport({ scale: pdfRenderScale(base.width, base.height) });
      var canvas = doc.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      var context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport: viewport }).promise;
      var blob = await new Promise(function (resolve, reject) {
        canvas.toBlob(function (b) { if (b) resolve(b); else reject(new Error(PDF_ERROR)); }, "image/jpeg", 0.92);
      });
      return new root.File([blob], pdfPageFilename(pdfName, number), { type: "image/jpeg", lastModified: Date.now() });
    }

    fileInput.addEventListener("change", async function () {
      var file = fileInput.files && fileInput.files[0];
      resetUploadState();
      result.hidden = true;
      if (!file) return;
      var validation = rx.validateSelectedFile(file);
      if (!validation.ok) {
        closeReview();
        setStatus("error", validation.error);
        return;
      }
      setStatus("", "");
      review.hidden = false;
      pageField.hidden = true;
      try {
        if (rx.reviewModeFor(file) === "pdf") {
          setStatus("busy", "Opening your PDF on this device…");
          var pdfjs = await loadPdfJs();
          pdfName = file.name || "prescription.pdf";
          pdfDoc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
          pageSelect.innerHTML = "";
          for (var n = 1; n <= pdfDoc.numPages; n += 1) pageSelect.appendChild(option(doc, String(n), "Page " + n + " of " + pdfDoc.numPages));
          pageField.hidden = pdfDoc.numPages < 2;
          await showInCropper(await renderPdfPage(1));
          setStatus("", "");
        } else {
          await showInCropper(file);
        }
      } catch (error) {
        var isPdf = rx.reviewModeFor(file) === "pdf";
        closeReview();
        setStatus("error", isPdf ? PDF_ERROR : ((error && error.message) || "This file could not be opened. Choose another file."));
      }
    });

    pageSelect.addEventListener("change", async function () {
      if (!pdfDoc) return;
      try {
        await showInCropper(await renderPdfPage(Number(pageSelect.value) || 1));
      } catch (error) {
        closeReview();
        setStatus("error", PDF_ERROR);
      }
    });

    q("[data-checker-rotate-left]").addEventListener("click", function () { if (cropTools) cropTools.rotateLeft(); });
    q("[data-checker-rotate-right]").addEventListener("click", function () { if (cropTools) cropTools.rotateRight(); });
    q("[data-checker-reset]").addEventListener("click", function () { if (cropTools) cropTools.reset(); });
    q("[data-checker-choose-another]").addEventListener("click", function () {
      closeReview();
      setStatus("", "");
      fileInput.click();
    });
    q("[data-checker-cancel]").addEventListener("click", function () {
      closeReview();
      setStatus("", "");
    });

    useButton.addEventListener("click", async function () {
      if (!cropper || !sourceFile || state.busy) return;
      useButton.disabled = true;
      try {
        var approved = await rx.approvedImageFromCrop(sourceFile, cropper, root.File);
        closeReview();
        await readPrescription(approved);
      } catch (error) {
        useButton.disabled = false;
        setStatus("error", (error && error.message) || "The selected area could not be prepared. Try again.");
      }
    });

    async function readPrescription(approvedFile) {
      setBusy(true);
      result.hidden = true;
      var stages = rx.PROCESSING_STAGES || {};
      try {
        setStatus("busy", (stages.prepare && stages.prepare.title) || "Preparing your prescription…");
        var initialized = await transport.init(approvedFile, labelInput.value.trim() || null);
        state.configId = initialized.configId;
        state.editToken = initialized.editToken;
        state.source = "uploaded";
        setStatus("busy", (stages.upload && stages.upload.title) || "Uploading your prescription…");
        await transport.upload(initialized.upload, approvedFile);
        setStatus("busy", (stages.read && stages.read.title) || "Reading your prescription…");
        var processed = await transport.process(state.configId, state.editToken);
        if (!processed || !processed.readable || !processed.parsedRx) {
          setStatus("error", "We couldn't read enough of this prescription. Check the values below or enter them manually, then check this mask.");
          return;
        }
        applyExtracted(processed.parsedRx);
        setStatus("success", "Prescription read. Please check the values below, then check this mask.");
      } catch (error) {
        resetUploadState();
        setStatus("error", (error && error.message) || "The upload didn't finish. Try again or enter your prescription manually.");
      } finally {
        setBusy(false);
      }
    }

    function renderResult(calculation) {
      result.innerHTML = "";
      result.hidden = false;
      var rec = calculation.activeRecommendation;
      result.appendChild(el(doc, "h3", "oo-rx-checker__result-title", "Your recommended lenses"));
      var pair = el(doc, "p", "oo-rx-checker__pair");
      pair.appendChild(el(doc, "span", "", "Right: " + formatLensLabel(rec.recommendedRight)));
      pair.appendChild(el(doc, "span", "", "Left: " + formatLensLabel(rec.recommendedLeft)));
      result.appendChild(pair);

      if (calculation.highCylinderPreview) {
        var fieldset = el(doc, "fieldset", "oo-rx-checker__strategy");
        fieldset.appendChild(el(doc, "legend", "", "Choose the lens approach you'd like us to use"));
        [["balanced", "Balanced (Spherical Equivalent)", calculation.highCylinderPreview.balanced],
         ["closer_to_sph", "Closer to your SPH", calculation.highCylinderPreview.alternative]].forEach(function (entry) {
          var label = el(doc, "label", "oo-rx-checker__strategy-option");
          var input = doc.createElement("input");
          input.type = "radio";
          input.name = "oo-rx-checker-strategy-" + container.id;
          input.value = entry[0];
          input.checked = rec.recommendationStrategy === entry[0];
          input.addEventListener("change", function () {
            calculation.activeRecommendation = selectStrategy(calculation, highCyl, entry[0]);
            renderResult(calculation);
          });
          label.appendChild(input);
          label.appendChild(el(doc, "span", "", entry[1] + " — R " + entry[2].right + " / L " + entry[2].left));
          fieldset.appendChild(label);
        });
        result.appendChild(fieldset);
      }

      var build = buildability(product, rec, products.supportsPower);
      if (!build.buildable) {
        var notice = el(doc, "p", "oo-rx-checker__notice", NOT_BUILDABLE_MESSAGE);
        notice.setAttribute("role", "alert");
        result.appendChild(notice);
        var link = el(doc, "a", "oo-rx-checker__compatible", "See Compatible Masks");
        link.href = FULL_CALCULATOR_URL;
        result.appendChild(link);
        return;
      }
      var ok = el(doc, "p", "oo-rx-checker__ok", BUILDABLE_MESSAGE);
      result.appendChild(ok);
      var apply = el(doc, "button", "oo-rx-checker__apply", "Use these lenses for this mask");
      apply.type = "button";
      apply.addEventListener("click", function () { useLenses(calculation, apply); });
      result.appendChild(apply);
    }

    async function useLenses(calculation, button) {
      if (state.busy) return;
      setBusy(true);
      button.disabled = true;
      var label = labelInput.value.trim() || null;
      try {
        setStatus("busy", "Saving your prescription…");
        var entry = readEntry();
        var prescription = { right: confirmedEye(entry.right), left: confirmedEye(entry.left) };
        var payload = rx.buildConfirmationPayload(prescription, calculation, label);
        if (!state.configId || !state.editToken) {
          var initialized = await transport.manualInit(label);
          state.configId = initialized.configId;
          state.editToken = initialized.editToken;
          state.source = "manual";
        }
        await transport.confirm(state.configId, state.editToken, payload);
        var summary = handoffSummary(state.configId, calculation.activeRecommendation, label, state.source === "uploaded");
        setStatus("busy", "Adding your lenses to this mask…");
        var handoffApi = handoff || root.OORxProductHandoff;
        if (!handoffApi) throw new Error("This page couldn't apply your lenses. Please refresh and try again.");
        var controls = await handoffApi.waitForAvisControls(doc);
        handoffApi.applyConfirmedHandoff(doc, controls, summary, SOURCE);
        state.editToken = null;
        setStatus("success", "Your lenses are set on this mask. Choose any accessories, then add to cart.");
        button.textContent = "Lenses added to this mask";
        container.dataset.checkerState = "applied";
      } catch (error) {
        button.disabled = false;
        setStatus("error", (error && error.message) || "We couldn't save your prescription. Please try again.");
      } finally {
        setBusy(false);
        if (container.dataset.checkerState === "applied") button.disabled = true;
      }
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (state.busy) return;
      var entry = readEntry();
      var errors = validateEntry(entry);
      if (errors.length) {
        result.hidden = true;
        setStatus("error", errors.join(" "));
        return;
      }
      var calculation = calculate(engine, highCyl, entry);
      if (!calculation.successful) {
        result.hidden = true;
        setStatus("error", calculation.review
          ? "Your prescription needs a quick check by our team before we can suggest a lens. Please contact us."
          : ((calculation.errors || []).join(" ") || "Please check your prescription values."));
        return;
      }
      state.calculation = calculation;
      setStatus("", "");
      renderResult(calculation);
    });

    return { product: product, state: state };
  }

  return {
    SOURCE: SOURCE,
    FULL_CALCULATOR_URL: FULL_CALCULATOR_URL,
    NOT_BUILDABLE_MESSAGE: NOT_BUILDABLE_MESSAGE,
    BUILDABLE_MESSAGE: BUILDABLE_MESSAGE,
    SPHERE_VALUES: SPHERE_VALUES,
    CYLINDER_VALUES: CYLINDER_VALUES,
    formatLensLabel: formatLensLabel,
    PDF_ERROR: PDF_ERROR,
    pdfRenderScale: pdfRenderScale,
    pdfPageFilename: pdfPageFilename,
    handleFromUrl: handleFromUrl,
    catalogProductForHandle: catalogProductForHandle,
    confirmedEye: confirmedEye,
    engineInput: engineInput,
    validateEntry: validateEntry,
    calculate: calculate,
    selectStrategy: selectStrategy,
    buildability: buildability,
    handoffSummary: handoffSummary,
    mount: mount
  };
});
