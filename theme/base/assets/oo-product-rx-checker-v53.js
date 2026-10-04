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
  var BACKEND_URL = "https://oceans-optics-rx-test.vercel.app";
  var BUILDABLE_MESSAGE = "This mask supports your recommended lenses.";
  var ALTERNATIVES_TITLE = "Available for your prescription";
  var NO_ALTERNATIVES_MESSAGE = "None of our current prescription masks stock this exact lens combination. Email info@oceansoptics.com and we'll help you find an option.";
  var RX_CONFIG_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  var EPSILON = 1e-9;
  // Backend record source for checker uploads and manual prescriptions; the
  // Shopify line item keeps _oo_source = product_rx_checker (SOURCE).
  var BACKEND_SOURCE = "product_rx_checker";

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

  function steps(from, to, step) {
    var values = [];
    for (var v = from; v <= to + EPSILON; v += step) values.push(Math.round(v * 100) / 100);
    return values;
  }

  // Manual-entry input caps (UI only; the V5.3 engine and stock are unchanged).
  var SPHERE_LIMIT = 12;
  var SPHERE_VALUES = steps(-SPHERE_LIMIT, SPHERE_LIMIT, 0.25);
  var CYLINDER_VALUES = steps(-6, 6, 0.25);
  var SPHERE_FRACTIONS = ["00", "25", "50", "75"];

  // Legacy product-calculator sphere picker: sign button + whole number + decimal.
  // Returns "" until the value is complete (a non-zero value needs a sign).
  function sphereFromPicker(sign, whole, fraction) {
    if (whole === "" || whole === null || whole === undefined) return "";
    var magnitude = Number(whole) + Number(fraction || 0) / 100;
    if (!Number.isFinite(magnitude) || magnitude > SPHERE_LIMIT + EPSILON) return "";
    if (magnitude < EPSILON) return "0";
    if (sign !== "-" && sign !== "+") return "";
    return String(sign === "-" ? -magnitude : magnitude);
  }

  function pickerFromSphere(value) {
    var n = Number(value);
    if (value === "" || value === null || value === undefined || !Number.isFinite(n)) return null;
    var magnitude = Math.round(Math.abs(n) * 4) / 4;
    if (magnitude > SPHERE_LIMIT + EPSILON) return null;
    var whole = Math.floor(magnitude + EPSILON);
    return {
      sign: magnitude < EPSILON ? "" : (n < 0 ? "-" : "+"),
      whole: String(whole),
      fraction: String(Math.round((magnitude - whole) * 100)).padStart(2, "0")
    };
  }

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
      if (!eye || eye.sphere === "" || eye.sphere === null || !Number.isFinite(Number(eye.sphere))) errors.push(name + " SPH is required (choose + or − and the value).");
      if (eye && eye.cylinder === "") { errors.push(name + " CYL needs a + or − sign."); return; }
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

  function lensKind(power) {
    var n = Number(power);
    if (Math.abs(n) < EPSILON) return "zero";
    return n < 0 ? "minus" : "plus";
  }

  var KIND_WORDS = {
    minus: { customer: "nearsighted (−)", lenses: "nearsighted" },
    plus: { customer: "farsighted (+)", lenses: "farsighted" }
  };

  function lensRangeText(product) {
    var low = Math.min(Math.abs(product.diopterMin), Math.abs(product.diopterMax));
    var high = Math.max(Math.abs(product.diopterMin), Math.abs(product.diopterMax));
    var sign = product.lensType === "plus" ? "+" : "-";
    return sign + low.toFixed(2) + " to " + sign + high.toFixed(2);
  }

  // Why this mask can't build the recommended pair. Uses only the shared
  // catalogue definition (lensType, diopter range, step) of the current mask.
  // displayName: how to refer to the mask being viewed (alias pages such as
  // Obsidian Clear say "This mask" rather than the catalogue family name).
  function incompatibilityReason(product, recommendation, supportsPower, displayName) {
    var name = displayName || product.name;
    var build = buildability(product, recommendation, supportsPower);
    if (build.buildable) return { kind: "ok", message: BUILDABLE_MESSAGE };
    var right = Number(recommendation.recommendedRight);
    var left = Number(recommendation.recommendedLeft);
    var rightKind = lensKind(right);
    var leftKind = lensKind(left);
    if (rightKind !== "zero" && leftKind !== "zero" && rightKind !== leftKind) {
      return {
        kind: "mixed",
        message: "Your recommended lenses are one nearsighted (−) and one farsighted (+) lens. " + name + " can't combine them in one mask."
      };
    }
    var kind = rightKind !== "zero" ? rightKind : leftKind;
    if (kind !== "zero" && kind !== product.lensType) {
      return {
        kind: "lens-type",
        message: "Your prescription is " + KIND_WORDS[kind].customer + ". " + name + " is available with " + KIND_WORDS[product.lensType].lenses + " prescription lenses only."
      };
    }
    var low = Math.min(Math.abs(product.diopterMin), Math.abs(product.diopterMax));
    var high = Math.max(Math.abs(product.diopterMin), Math.abs(product.diopterMax));
    // Only a genuine power limit (stronger than this mask's strongest stock)
    // is "outside the range". A weaker lens next to plano (e.g. Rover
    // plano / -1.00) or a step gap is described as an unavailable combination.
    var outside = [right, left].some(function (power) {
      return lensKind(power) !== "zero" && Math.abs(power) > high + EPSILON;
    });
    if (outside) {
      return {
        kind: "range",
        message: "Your recommended lens strengths are outside the available range for this mask (" + lensRangeText(product) + ", or plano)."
      };
    }
    return { kind: "combination", message: "This exact lens combination isn't available in " + (displayName ? displayName.toLowerCase() : name) + "." };
  }

  // Other masks that can build the recommended pair, from the same shared
  // catalogue routing the full V5.3 calculator uses (no second table).
  function compatibleAlternatives(products, currentProduct, recommendation) {
    var routed = products.findCompatibleProducts(recommendation.recommendedRight, recommendation.recommendedLeft);
    return (routed.products || []).filter(function (candidate) {
      return !currentProduct || candidate.id !== currentProduct.id;
    });
  }

  // Product link carrying only the opaque confirmed configuration and source.
  function alternativeProductUrl(products, product, configId) {
    var variant = products.defaultVariant(product);
    var url = new URL(variant ? variant.url : product.variantMap[0].url);
    if (RX_CONFIG_ID_PATTERN.test(String(configId || "").trim())) {
      url.searchParams.set("oo_rx", String(configId).trim().toLowerCase());
      url.searchParams.set("oo_source", SOURCE);
    }
    return url.toString();
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
    var isAliasPage = Object.prototype.hasOwnProperty.call(HANDLE_ALIASES, String(container.dataset.productHandle || "").trim().toLowerCase());
    var productDisplayName = isAliasPage ? "This mask" : null;
    var transport = rx.createTransport({
      source: BACKEND_SOURCE,
      fetchImpl: root.fetch.bind(root),
      FormDataCtor: root.FormData,
      backendUrl: (root.OOV52_RX_CONFIG && root.OOV52_RX_CONFIG.backendUrl) || BACKEND_URL
    });
    var state = { upload: null, configId: null, editToken: null, source: "manual", calculation: null, busy: false, file: null, confirmedKey: null, confirmedId: null };

    var q = function (selector) { return container.querySelector(selector); };
    var status = q("[data-checker-status]");
    var form = q("[data-checker-form]");
    var fileInput = q("[data-checker-file]");
    var checkButton = q("[data-checker-check]");
    var result = q("[data-checker-result]");
    var labelInput = q("[data-checker-label]");

    var eyes = {};
    ["right", "left"].forEach(function (side) {
      var scope = q('[data-eye="' + side + '"]');
      var eye = {
        sphere: scope.querySelector('[data-field="sphere"]'),
        sphereSign: scope.querySelector("[data-sphere-sign]"),
        whole: scope.querySelector("[data-sphere-int]"),
        fraction: scope.querySelector("[data-sphere-frac]"),
        cylinder: scope.querySelector('[data-field="cylinder"]'),
        cylSign: scope.querySelector("[data-cyl-sign]"),
        cylMag: scope.querySelector("[data-cyl-mag]"),
        axis: scope.querySelector('[data-field="axis"]')
      };
      eyes[side] = eye;
      // Untouched SPH reads "+/-  0 . 00": plano needs no sign, any non-zero
      // value still needs + or − (see sphereFromPicker).
      for (var w = 0; w <= SPHERE_LIMIT; w += 1) eye.whole.appendChild(option(doc, String(w), String(w)));
      eye.whole.value = "0";
      eye.fraction.value = "00";
      SPHERE_FRACTIONS.forEach(function (f) { eye.fraction.appendChild(option(doc, f, f)); });
      CYLINDER_VALUES.filter(function (v) { return v >= 0; }).forEach(function (v) { eye.cylMag.appendChild(option(doc, v.toFixed(2), v.toFixed(2))); });
      eye.axis.appendChild(option(doc, "", "–"));
      for (var a = 1; a <= 180; a += 1) eye.axis.appendChild(option(doc, String(a), String(a).padStart(3, "0")));
      var sync = function () {
        // +12.00 is the cap, so 12 only allows .00.
        var atCap = eye.whole.value === String(SPHERE_LIMIT);
        Array.prototype.forEach.call(eye.fraction.options, function (o) { o.disabled = atCap && o.value !== "00"; });
        if (atCap) eye.fraction.value = "00";
        eye.sphere.value = sphereFromPicker(eye.sphereSign.dataset.sign, eye.whole.value, eye.fraction.value);
        var magnitude = Number(eye.cylMag.value) || 0;
        var cylSign = eye.cylSign.dataset.sign;
        eye.cylinder.value = magnitude < EPSILON ? "0" : (cylSign === "+" ? String(magnitude) : cylSign === "-" ? String(-magnitude) : "");
        var needsAxis = magnitude > EPSILON;
        eye.axis.disabled = !needsAxis;
        if (!needsAxis) eye.axis.value = "";
        eye.cylSign.disabled = !needsAxis;
      };
      var toggle = function (button) {
        button.dataset.sign = button.dataset.sign === "-" ? "+" : "-";
        button.textContent = button.dataset.sign === "-" ? "−" : "+";
        button.classList.add("is-set");
        sync();
      };
      eye.sphereSign.addEventListener("click", function () { toggle(eye.sphereSign); });
      eye.cylSign.addEventListener("click", function () { toggle(eye.cylSign); });
      [eye.whole, eye.fraction, eye.cylMag].forEach(function (node) { node.addEventListener("change", sync); });
      eye.setSign = function (button, sign) {
        button.dataset.sign = sign || "";
        button.textContent = sign === "-" ? "−" : sign === "+" ? "+" : "+/-";
        button.classList.toggle("is-set", Boolean(sign));
      };
      eye.sync = sync;
      eye.cylMag.value = "0.00";
      sync();
    });

    // Legacy help tooltips: hover on desktop, tap to toggle, tap elsewhere or
    // Escape to close. Each bubble is nudged to stay inside the viewport.
    var tips = Array.prototype.slice.call(container.querySelectorAll("[data-checker-tip]"));
    function placeTip(tip) {
      var bubble = tip.querySelector(".oo-rx-checker__tip-text");
      bubble.style.setProperty("--oo-tip-shift", "0px");
      var rect = bubble.getBoundingClientRect();
      var viewport = doc.documentElement.clientWidth || root.innerWidth;
      var margin = 8;
      var shift = 0;
      if (rect.right > viewport - margin) shift = viewport - margin - rect.right;
      if (rect.left + shift < margin) shift = margin - rect.left;
      bubble.style.setProperty("--oo-tip-shift", Math.round(shift) + "px");
    }
    function closeTips(except) {
      tips.forEach(function (tip) {
        if (tip === except) return;
        tip.classList.remove("is-open");
        tip.querySelector(".oo-rx-checker__tip-button").setAttribute("aria-expanded", "false");
      });
    }
    tips.forEach(function (tip) {
      var button = tip.querySelector(".oo-rx-checker__tip-button");
      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var open = !tip.classList.contains("is-open");
        closeTips(tip);
        tip.classList.toggle("is-open", open);
        button.setAttribute("aria-expanded", String(open));
        if (open) placeTip(tip);
      });
      tip.addEventListener("mouseenter", function () { placeTip(tip); });
    });
    doc.addEventListener("click", function (event) {
      if (!event.target.closest || !event.target.closest("[data-checker-tip]")) closeTips(null);
    });
    doc.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeTips(null);
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
          cylinder: q('[data-eye="' + side + '"] [data-field="cylinder"]').value,
          axis: q('[data-eye="' + side + '"] [data-field="axis"]').value || null
        };
      });
      return entry;
    }

    function applyExtracted(parsed) {
      var skipped = [];
      ["right", "left"].forEach(function (side) {
        var extracted = parsed && parsed[side];
        var eye = eyes[side];
        if (!extracted) return;
        var picker = pickerFromSphere(extracted.sph);
        if (picker) {
          eye.setSign(eye.sphereSign, picker.sign);
          eye.whole.value = picker.whole;
          eye.fraction.value = picker.fraction;
        } else if (extracted.sph !== null && extracted.sph !== undefined) {
          skipped.push(side === "right" ? "Right" : "Left");
        }
        var cylMagnitude = Math.round(Math.abs(Number(extracted.cyl || 0)) * 4) / 4;
        if (Array.prototype.some.call(eye.cylMag.options, function (o) { return o.value === cylMagnitude.toFixed(2); })) {
          eye.cylMag.value = cylMagnitude.toFixed(2);
          eye.setSign(eye.cylSign, cylMagnitude > EPSILON ? (extracted.cylSign === "+" ? "+" : "-") : "");
        }
        eye.sync();
        if (extracted.axis && cylMagnitude > EPSILON) eye.axis.value = String(Number(extracted.axis));
      });
      return skipped;
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
      state.confirmedKey = null;
      state.confirmedId = null;
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

    // PDF helpers are shared with the full calculator (OOV52RxUpload).
    function renderPage(number) {
      return rx.renderPdfPage(doc, pdfDoc, number, pdfName, root.File);
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
          var pdfjs = await rx.loadPdfJs(root, doc, container.dataset.pdfjsSrc, container.dataset.pdfjsWorker);
          pdfName = file.name || "prescription.pdf";
          pdfDoc = await rx.openPdfDocument(pdfjs, file);
          pageSelect.innerHTML = "";
          for (var n = 1; n <= pdfDoc.numPages; n += 1) pageSelect.appendChild(option(doc, String(n), "Page " + n + " of " + pdfDoc.numPages));
          pageField.hidden = pdfDoc.numPages < 2;
          await showInCropper(await renderPage(1));
          setStatus("", "");
        } else {
          await showInCropper(file);
        }
      } catch (error) {
        var isPdf = rx.reviewModeFor(file) === "pdf";
        closeReview();
        setStatus("error", isPdf ? rx.PDF_ERROR : ((error && error.message) || "This file could not be opened. Choose another file."));
      }
    });

    pageSelect.addEventListener("change", async function () {
      if (!pdfDoc) return;
      try {
        await showInCropper(await renderPage(Number(pageSelect.value) || 1));
      } catch (error) {
        closeReview();
        setStatus("error", rx.PDF_ERROR);
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
        var skipped = applyExtracted(processed.parsedRx);
        if (skipped.length) {
          setStatus("error", skipped.join(" and ") + " SPH is beyond ±" + SPHERE_LIMIT.toFixed(2) + ". Please email info@oceansoptics.com and we'll help.");
          return;
        }
        setStatus("success", "Prescription read. Please check the values below, then check this mask.");
      } catch (error) {
        resetUploadState();
        setStatus("error", (error && error.message) || "The upload didn't finish. Try again or enter your prescription manually.");
      } finally {
        setBusy(false);
      }
    }

    function resultEye(label, value) {
      var eye = el(doc, "div", "oo-rx-checker__result-eye");
      eye.appendChild(el(doc, "span", "oo-rx-checker__result-eye-label", label));
      eye.appendChild(el(doc, "span", "oo-rx-checker__result-eye-value", formatLensLabel(value)));
      return eye;
    }

    function renderResult(calculation) {
      result.innerHTML = "";
      result.hidden = false;
      var rec = calculation.activeRecommendation;
      var summary = el(doc, "div", "oo-rx-checker__summary");
      summary.appendChild(el(doc, "div", "oo-rx-checker__result-title", "Your recommended lenses"));
      var values = el(doc, "div", "oo-rx-checker__result-values");
      values.appendChild(resultEye("Right (OD)", rec.recommendedRight));
      values.appendChild(el(doc, "span", "oo-rx-checker__result-divider", "|"));
      values.appendChild(resultEye("Left (OS)", rec.recommendedLeft));
      summary.appendChild(values);
      result.appendChild(summary);

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

      var reason = incompatibilityReason(product, rec, products.supportsPower, productDisplayName);
      if (reason.kind === "ok") {
        result.appendChild(el(doc, "p", "oo-rx-checker__ok", BUILDABLE_MESSAGE));
        var apply = el(doc, "button", "oo-rx-checker__apply", "Use these lenses for this mask");
        apply.type = "button";
        apply.addEventListener("click", function () { useLenses(calculation, apply); });
        result.appendChild(apply);
        return;
      }

      var notice = el(doc, "p", "oo-rx-checker__notice", reason.message);
      notice.dataset.reason = reason.kind;
      notice.setAttribute("role", "alert");
      result.appendChild(notice);
      renderAlternatives(calculation, compatibleAlternatives(products, product, rec));
    }

    // Masks that can build the same recommended lenses, shown right here. The
    // link carries the customer's confirmed prescription (oo_rx), so the next
    // product page sets the lenses without asking for the prescription again.
    function renderAlternatives(calculation, alternatives) {
      var section = el(doc, "div", "oo-rx-checker__alternatives");
      section.dataset.checkerAlternatives = "";
      section.appendChild(el(doc, "h3", "oo-rx-checker__alternatives-title", ALTERNATIVES_TITLE));
      if (!alternatives.length) {
        section.appendChild(el(doc, "p", "oo-rx-checker__alternatives-empty", NO_ALTERNATIVES_MESSAGE));
        result.appendChild(section);
        return;
      }
      var rec = calculation.activeRecommendation;
      alternatives.forEach(function (candidate) {
        var card = el(doc, "div", "oo-rx-checker__alt");
        card.dataset.catalogProduct = candidate.id;
        var variant = products.defaultVariant(candidate);
        if (variant && variant.img) {
          var img = doc.createElement("img");
          img.className = "oo-rx-checker__alt-image";
          img.src = variant.img;
          img.alt = candidate.name;
          img.width = 72;
          img.height = 72;
          img.loading = "lazy";
          card.appendChild(img);
        }
        var body = el(doc, "div", "oo-rx-checker__alt-body");
        body.appendChild(el(doc, "p", "oo-rx-checker__alt-name", candidate.name));
        body.appendChild(el(doc, "p", "oo-rx-checker__alt-lenses", "Right (OD) " + formatLensLabel(rec.recommendedRight) + " · Left (OS) " + formatLensLabel(rec.recommendedLeft)));
        if (candidate.quickNote) body.appendChild(el(doc, "p", "oo-rx-checker__alt-note", candidate.quickNote));
        card.appendChild(body);
        var link = el(doc, "a", "oo-rx-checker__alt-cta", "View Product");
        link.href = alternativeProductUrl(products, candidate, null);
        link.addEventListener("click", function (event) {
          event.preventDefault();
          openAlternative(calculation, candidate, link);
        });
        card.appendChild(link);
        section.appendChild(card);
      });
      result.appendChild(section);
    }

    async function openAlternative(calculation, candidate, link) {
      if (state.busy) return;
      setBusy(true);
      link.setAttribute("aria-disabled", "true");
      link.textContent = "Opening…";
      try {
        setStatus("busy", "Saving your prescription for " + candidate.name + "…");
        var configId = await ensureConfirmed(calculation);
        root.location.assign(alternativeProductUrl(products, candidate, configId));
      } catch (error) {
        link.removeAttribute("aria-disabled");
        link.textContent = "View Product";
        setStatus("error", ((error && error.message) || "We couldn't save your prescription.") + " You can still open the mask and choose your lens strengths there.");
      } finally {
        setBusy(false);
      }
    }

    // Confirms the customer's reviewed prescription once per prescription and
    // lens approach. A confirmed record is never changed; a different entry or
    // approach gets a new record.
    async function ensureConfirmed(calculation) {
      var label = labelInput.value.trim() || null;
      var entry = readEntry();
      var key = JSON.stringify([entry, calculation.activeRecommendation.recommendationStrategy, label]);
      if (state.confirmedKey === key && state.confirmedId) return state.confirmedId;
      var prescription = { right: confirmedEye(entry.right), left: confirmedEye(entry.left) };
      var payload = rx.buildConfirmationPayload(prescription, calculation, label);
      if (!state.configId || !state.editToken) {
        var initialized = await transport.manualInit(label);
        state.configId = initialized.configId;
        state.editToken = initialized.editToken;
        state.source = "manual";
      }
      await transport.confirm(state.configId, state.editToken, payload);
      state.editToken = null;
      state.confirmedKey = key;
      state.confirmedId = state.configId;
      return state.configId;
    }

    async function useLenses(calculation, button) {
      if (state.busy) return;
      setBusy(true);
      button.disabled = true;
      var label = labelInput.value.trim() || null;
      try {
        setStatus("busy", "Saving your prescription…");
        var configId = await ensureConfirmed(calculation);
        var summary = handoffSummary(configId, calculation.activeRecommendation, label, state.source === "uploaded");
        setStatus("busy", "Adding your lenses to this mask…");
        var handoffApi = handoff || root.OORxProductHandoff;
        if (!handoffApi) throw new Error("This page couldn't apply your lenses. Please refresh and try again.");
        var controls = await handoffApi.waitForAvisControls(doc);
        handoffApi.applyConfirmedHandoff(doc, controls, summary, SOURCE);
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
    BACKEND_SOURCE: BACKEND_SOURCE,
    BUILDABLE_MESSAGE: BUILDABLE_MESSAGE,
    ALTERNATIVES_TITLE: ALTERNATIVES_TITLE,
    NO_ALTERNATIVES_MESSAGE: NO_ALTERNATIVES_MESSAGE,
    SPHERE_LIMIT: SPHERE_LIMIT,
    SPHERE_VALUES: SPHERE_VALUES,
    sphereFromPicker: sphereFromPicker,
    pickerFromSphere: pickerFromSphere,
    incompatibilityReason: incompatibilityReason,
    compatibleAlternatives: compatibleAlternatives,
    alternativeProductUrl: alternativeProductUrl,
    CYLINDER_VALUES: CYLINDER_VALUES,
    formatLensLabel: formatLensLabel,
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
