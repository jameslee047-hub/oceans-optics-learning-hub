(function () {
  "use strict";

  var FRACTIONS = ["00", "25", "50", "75"];
  var SPHERE_MAX_INTEGER = 10;
  var CYLINDER_MAX_INTEGER = 9;
  var BOTH_EYES_HIGH_CYL_GUIDANCE =
    "Your prescription includes higher astigmatism, so we’ve used a spherical-equivalent approach to balance your SPH and CYL values and choose the closest practical lens strength available.";
  var RIGHT_EYE_HIGH_CYL_GUIDANCE =
    "Your right-eye prescription includes higher astigmatism, so we’ve used a spherical-equivalent approach to balance its SPH and CYL values and choose the closest practical lens strength available.";
  var LEFT_EYE_HIGH_CYL_GUIDANCE =
    "Your left-eye prescription includes higher astigmatism, so we’ve used a spherical-equivalent approach to balance its SPH and CYL values and choose the closest practical lens strength available.";
  var HIGH_CYL_BENEFIT =
    "This gives you the best overall match from our available sphere-only corrective lenses.";
  var activeRecommendation = null;
  var customerStrategySelected = false;
  var strategySelectionEvidence = null;
  var currentHighCylinderPreview = null;
  // Optional second recommendation (Sharper or Closer to Your SPH) from the
  // shared choice layer; never shown with high CYL.
  var currentMidpointChoice = null;
  // Every successful calculation is previewed (matching masks shown, nothing
  // saved) until the customer chooses a mask (commitPreviewedRecommendation).
  var pendingCalculation = null;
  var prescriptionManager = null;

  function appendOption(select, value, label) {
    var option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }

  function fillIntegerSelect(select, maximum) {
    for (var value = 0; value <= maximum; value += 1) {
      appendOption(select, String(value), String(value));
    }
  }

  function fillFractionSelect(select, allowAll) {
    select.innerHTML = "";
    FRACTIONS.forEach(function (fraction) {
      if (allowAll === false && fraction !== "00") return;
      appendOption(select, fraction, fraction);
    });
  }

  function fillAxisSelect(select) {
    select.innerHTML = "";
    appendOption(select, "", "Select");
    for (var axis = 1; axis <= 180; axis += 1) {
      var formatted = String(axis).padStart(3, "0");
      appendOption(select, String(axis), formatted);
    }
  }

  function magnitudeFor(eye, fieldName) {
    var integer = eye.querySelector('.oo-v52__integer[data-field="' + fieldName + '"]').value;
    var fraction = eye.querySelector('.oo-v52__fraction[data-field="' + fieldName + '"]').value;
    return Number(integer + "." + fraction);
  }

  function signFor(eye, fieldName) {
    var button = eye.querySelector('.oo-v52__sign[data-field="' + fieldName + '"]');
    return button.dataset.sign || "";
  }

  function updateCylinderState(eye) {
    var cylinderIsZero = magnitudeFor(eye, "cylinder") === 0;
    var axisSelect = eye.querySelector('.oo-v52__axis[data-field="axis"]');

    if (cylinderIsZero) {
      axisSelect.innerHTML = "";
      appendOption(axisSelect, "", "Not required");
      axisSelect.disabled = true;
      return;
    }

    if (axisSelect.disabled) {
      var axisValue = axisSelect.value;
      if (axisSelect.options.length <= 1) fillAxisSelect(axisSelect);
      axisSelect.disabled = false;
      if (axisValue) axisSelect.value = axisValue;
    }
  }

  function toggleSign(button) {
    var nextSign = button.dataset.sign === "-" ? "+" : "-";
    button.dataset.sign = nextSign;
    button.dataset.selected = "true";
    button.textContent = nextSign;
    button.setAttribute("aria-pressed", "true");
  }

  function setSign(button, sign) {
    if (sign !== "+" && sign !== "-") return false;
    button.dataset.sign = sign;
    button.dataset.selected = "true";
    button.textContent = sign;
    button.setAttribute("aria-pressed", "true");
    return true;
  }

  function magnitudeParts(value, maximum) {
    var magnitude = Math.abs(Number(value));
    var hundredths = Math.round(magnitude * 100);
    var fraction = String(hundredths % 100).padStart(2, "0");
    var integer = Math.floor(hundredths / 100);

    if (!Number.isFinite(magnitude) || Math.abs(magnitude * 100 - hundredths) > 0.001) return null;
    if (integer > maximum || FRACTIONS.indexOf(fraction) === -1) return null;
    if (integer === maximum && fraction !== "00") return null;
    return { integer: String(integer), fraction: fraction };
  }

  function setMagnitude(eye, fieldName, value) {
    var maximum = fieldName === "sphere" ? SPHERE_MAX_INTEGER : CYLINDER_MAX_INTEGER;
    var parts = magnitudeParts(value, maximum);
    if (!parts) return false;

    var integer = eye.querySelector('.oo-v52__integer[data-field="' + fieldName + '"]');
    var fraction = eye.querySelector('.oo-v52__fraction[data-field="' + fieldName + '"]');
    integer.value = parts.integer;

    if (fieldName === "cylinder") {
      fillFractionSelect(fraction, Number(parts.integer) < CYLINDER_MAX_INTEGER);
    }
    fraction.value = parts.fraction;
    return integer.value === parts.integer && fraction.value === parts.fraction;
  }

  function clearMissingField(eye, fieldName) {
    var field = eye.querySelector('.oo-v52__field[data-rx-field="' + fieldName + '"]');
    if (field) field.classList.remove("is-rx-missing");
  }

  function protectSelectFromWheel(select) {
    select.addEventListener(
      "wheel",
      function () {
        if (document.activeElement === select) select.blur();
      },
      { passive: true }
    );
  }

  function initializeEye(eye) {
    var sphereInteger = eye.querySelector('.oo-v52__integer[data-field="sphere"]');
    var sphereFraction = eye.querySelector('.oo-v52__fraction[data-field="sphere"]');
    var cylinderInteger = eye.querySelector('.oo-v52__integer[data-field="cylinder"]');
    var cylinderFraction = eye.querySelector('.oo-v52__fraction[data-field="cylinder"]');

    fillIntegerSelect(sphereInteger, SPHERE_MAX_INTEGER);
    fillFractionSelect(sphereFraction, true);
    fillIntegerSelect(cylinderInteger, CYLINDER_MAX_INTEGER);
    fillFractionSelect(cylinderFraction, true);

    eye.querySelectorAll(".oo-v52__sign").forEach(function (button) {
      button.addEventListener("click", function () {
        toggleSign(button);
        clearMissingField(eye, button.dataset.field);
        markCalculationStale();
      });
    });

    [cylinderInteger, cylinderFraction].forEach(function (select) {
      select.addEventListener("pointerdown", function () {
        clearMissingField(eye, "cylinder");
      });
      select.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") clearMissingField(eye, "cylinder");
      });
      select.addEventListener("change", function () {
        if (select === cylinderInteger) {
          var previousFraction = cylinderFraction.value;
          var allowsFractions = Number(cylinderInteger.value) < CYLINDER_MAX_INTEGER;
          fillFractionSelect(cylinderFraction, allowsFractions);
          if (allowsFractions && FRACTIONS.indexOf(previousFraction) !== -1) {
            cylinderFraction.value = previousFraction;
          }
        }
        updateCylinderState(eye);
        clearMissingField(eye, "cylinder");
      });
    });

    eye.querySelector('.oo-v52__axis[data-field="axis"]').addEventListener("change", function () {
      clearMissingField(eye, "axis");
    });

    eye.querySelectorAll("select").forEach(function (select) {
      protectSelectFromWheel(select);
      select.addEventListener("change", markCalculationStale);
    });
    updateCylinderState(eye);
  }

  function rawPrescriptionFor(eye) {
    var side = eye.dataset.eye === "right" ? "Right (OD)" : "Left (OS)";
    var sphereMagnitude = magnitudeFor(eye, "sphere");
    var sphereSign = signFor(eye, "sphere");
    var cylinderMagnitude = magnitudeFor(eye, "cylinder");
    var cylinderSign = signFor(eye, "cylinder");
    var axis = eye.querySelector('.oo-v52__axis[data-field="axis"]').value;

    var unresolved = eye.querySelector(".oo-v52__field.is-rx-missing");
    if (unresolved) {
      var unresolvedName = (unresolved.dataset.rxField || "prescription field").toUpperCase();
      throw new Error("Please confirm " + unresolvedName + " for " + side + ".");
    }

    if (!sphereSign) {
      throw new Error("Please select + or - for " + side + " SPH.");
    }
    if (cylinderMagnitude !== 0 && !cylinderSign) {
      throw new Error("Please select + or - for " + side + " CYL.");
    }
    if (cylinderMagnitude !== 0 && !axis) {
      throw new Error("Please select an AXIS for " + side + ".");
    }

    return {
      sphere: sphereMagnitude === 0 ? "0.00" : sphereSign + sphereMagnitude.toFixed(2),
      cylinder: cylinderMagnitude === 0 ? "0.00" : cylinderSign + cylinderMagnitude.toFixed(2),
      cylinderSign: cylinderSign || "+",
      axis: cylinderMagnitude === 0 ? "" : axis
    };
  }

  function showError(message) {
    var error = document.getElementById("oo-v52-error");
    error.textContent = message;
    error.hidden = false;
    document.getElementById("oo-v52-result").hidden = true;
    document.getElementById("oo-v52-guidance").hidden = true;
  }

  function clearError() {
    var error = document.getElementById("oo-v52-error");
    error.textContent = "";
    error.hidden = true;
  }

  function setResultText(id, value) {
    document.getElementById(id).textContent = value;
  }

  function copyRecommendation(recommendation) {
    return recommendation ? {
      recommendationStrategy: recommendation.recommendationStrategy,
      recommendedRight: recommendation.recommendedRight,
      recommendedLeft: recommendation.recommendedLeft,
      displayRight: recommendation.displayRight,
      displayLeft: recommendation.displayLeft
    } : null;
  }

  function getActiveRecommendation() {
    var profile = prescriptionManager && prescriptionManager.getActivePrescription();
    // A previewed midpoint pair mirrors this selection; it never overrides it.
    if (profile && profile.status !== "preview") {
      return copyRecommendation({
        recommendationStrategy: profile.recommendationStrategy,
        recommendedRight: profile.recommendedRight,
        recommendedLeft: profile.recommendedLeft,
        displayRight: formatCalculationPower(profile.recommendedRight),
        displayLeft: formatCalculationPower(profile.recommendedLeft)
      });
    }
    return copyRecommendation(activeRecommendation);
  }

  function formatCalculationPower(value) {
    var power = Number(value);
    if (!Number.isFinite(power)) return "--";
    if (Math.abs(power) < 1e-9) return "0.00";
    return (power > 0 ? "+" : "-") + Math.abs(power).toFixed(2);
  }

  function choiceModule() {
    return window.OOV53RecommendationChoice || window.OOV53MidpointChoice || null;
  }

  // Shared "How we calculated your mask lens" / "Why is my mask lens
  // different from my SPH?" panels (oo-lens-calculator-v53-midpoint.js).
  function renderCalculationDetails(calculation, resetDisclosure) {
    var container = document.getElementById("oo-v52-explain");
    var module = choiceModule();
    if (!container) return;
    if (!calculation || !calculation.successful || !module || typeof module.renderExplanation !== "function") {
      container.hidden = true;
      container.innerHTML = "";
      return;
    }
    var wasOpen = Array.prototype.map.call(container.querySelectorAll("details"), function (details) {
      return details.open;
    });
    var selected = calculation.activeRecommendation || activeRecommendation;
    var explanation = module.renderExplanation(document, {
      rightResult: calculation.rightResult,
      leftResult: calculation.leftResult,
      strategy: selected && selected.recommendationStrategy || "balanced",
      recommendation: selected,
      choice: calculation.midpointChoice || null,
      highCylinderPreview: calculation.highCylinderPreview &&
        calculation.highCylinderPreview.triggered && calculation.highCylinderPreview.available
        ? calculation.highCylinderPreview
        : null
    });
    container.innerHTML = "";
    container.appendChild(explanation);
    if (!resetDisclosure) {
      Array.prototype.forEach.call(container.querySelectorAll("details"), function (details, index) {
        details.open = Boolean(wasOpen[index]);
      });
    }
    container.hidden = false;
  }

  function renderHighCylinderSummary(recommendation) {
    var summary = document.getElementById("oo-v52-high-summary");
    if (!summary) return;
    if (!recommendation) {
      summary.textContent = "";
      return;
    }
    var name = recommendation.recommendationStrategy === "closer_to_sph" ? "Sharper" : "Balanced";
    summary.textContent = "Selected: " + name + ". Right " + recommendation.displayRight + ", left " + recommendation.displayLeft + ".";
  }

  function setActiveRecommendation(recommendation, announce) {
    activeRecommendation = copyRecommendation(recommendation);
    if (currentHighCylinderPreview) renderHighCylinderSummary(activeRecommendation);
    if (pendingCalculation) {
      pendingCalculation.activeRecommendation = getActiveRecommendation();
      renderCalculationDetails(pendingCalculation, false);
    }

    if (announce && currentHighCylinderPreview && recommendation) {
      var strategyName = recommendation.recommendationStrategy === "closer_to_sph" ? "Sharper" : "Balanced";
      document.getElementById("oo-v52-high-selection-status").textContent =
        strategyName + " selected. Right " + recommendation.displayRight +
        ", left " + recommendation.displayLeft + ".";
    }

    document.dispatchEvent(new CustomEvent("oo:v52:recommendation-changed", {
      detail: getActiveRecommendation()
    }));
  }

  function setAlternativeNote(side, eyePreview) {
    var note = document.getElementById("oo-v52-high-alternative-" + side + "-note");
    note.textContent = eyePreview.alternativeNote || "";
    note.hidden = !eyePreview.alternativeNote;
  }

  // Choosing Balanced or Closer to Your SPH switches the previewed pair, and
  // its matching masks are shown straight away. Nothing is saved until the
  // customer chooses a mask (commitPreviewedRecommendation).
  function selectHighCylinderStrategy(strategy, announce) {
    if (!currentHighCylinderPreview || !window.OOV52HighCylinder) return null;
    var selection = window.OOV52HighCylinder.recommendationSelection(
      currentHighCylinderPreview,
      strategy
    );
    setActiveRecommendation(selection, announce !== false);
    customerStrategySelected = true;
    syncHighCylinderControls(selection.recommendationStrategy);
    previewSelection();
    return getActiveRecommendation();
  }

  function syncHighCylinderControls(strategy) {
    var balanced = document.getElementById("oo-v52-high-balanced");
    var alternative = document.getElementById("oo-v52-high-alternative");
    alternative.checked = strategy === "closer_to_sph";
    balanced.checked = !alternative.checked;
  }

  function resetHighCylinderControls() {
    var balanced = document.getElementById("oo-v52-high-balanced");
    var alternative = document.getElementById("oo-v52-high-alternative");
    balanced.checked = false;
    balanced.disabled = false;
    alternative.checked = false;
    alternative.disabled = false;
    document.getElementById("oo-v52-high-selection-status").textContent = "";
    var notice = document.getElementById("oo-v52-high-alternative-notice");
    if (notice) {
      notice.textContent = "";
      notice.hidden = true;
    }
  }

  function setNotice(id, text) {
    var notice = document.getElementById(id);
    if (!notice) return;
    notice.textContent = text || "";
    notice.hidden = !text;
  }

  function renderHighCylinderPreview(rightResult, leftResult, blocked) {
    var standard = document.getElementById("oo-v52-result-values");
    var comparison = document.getElementById("oo-v52-high-cyl");
    currentHighCylinderPreview = null;
    standard.hidden = false;
    comparison.hidden = true;

    if (blocked || !window.OOV52HighCylinder) return null;
    var preview = window.OOV52HighCylinder.calculatePairAlternative(rightResult, leftResult);
    if (!preview.triggered || !preview.available) return preview;
    if (String(preview.balanced.right) === String(preview.alternative.right) && String(preview.balanced.left) === String(preview.alternative.left)) return null;

    setResultText("oo-v52-high-balanced-right", preview.balanced.right);
    setResultText("oo-v52-high-balanced-left", preview.balanced.left);
    setResultText("oo-v52-high-alternative-right", preview.alternative.right);
    setResultText("oo-v52-high-alternative-left", preview.alternative.left);
    setAlternativeNote("right", preview.eyes.right);
    setAlternativeNote("left", preview.eyes.left);
    resetHighCylinderControls();
    var module = choiceModule();
    if (module && typeof module.eyesStrongerThanSE === "function") {
      setNotice("oo-v52-high-alternative-notice", module.seNoticeFor(module.eyesStrongerThanSE(rightResult, leftResult, {
        rightPower: Number(preview.alternative.right),
        leftPower: Number(preview.alternative.left)
      })));
    }
    currentHighCylinderPreview = preview;
    setActiveRecommendation(window.OOV52HighCylinder.recommendationSelection(preview, window.OOV52HighCylinder.STRATEGY_CLOSER_TO_SPH), false);

    standard.hidden = true;
    comparison.hidden = false;
    return preview;
  }

  // Customer-facing option titles live with the shared choice module.
  function choiceTitle(strategy) {
    var module = choiceModule();
    if (!module) return "";
    if (typeof module.strategyTitle === "function") return module.strategyTitle(currentMidpointChoice, strategy);
    if (strategy === module.STRATEGY_SHARPER) return module.COPY.sharperTitle;
    if (strategy === module.STRATEGY_CLOSER_TO_SPH) return module.COPY.closerTitle;
    return module.COPY.balancedTitle;
  }

  function syncMidpointControls(strategy) {
    var balanced = document.getElementById("oo-v52-midpoint-balanced");
    var alternative = document.getElementById("oo-v52-midpoint-sharper");
    if (!balanced || !alternative) return;
    alternative.checked = strategy !== "balanced" && strategy === alternative.value;
    balanced.checked = !alternative.checked;
  }

  // The selected pair, offered as a preview: products show it, but no
  // prescription record is confirmed.
  function previewSelection() {
    if (!pendingCalculation) return;
    pendingCalculation.activeRecommendation = getActiveRecommendation();
    document.dispatchEvent(new CustomEvent("oo:v52:previewed", { detail: pendingCalculation }));
  }

  function selectMidpointStrategy(strategy, announce) {
    var module = choiceModule();
    if (!currentMidpointChoice || !module) return null;
    var selection = module.recommendationSelection(currentMidpointChoice, strategy);
    setActiveRecommendation(selection, false);
    customerStrategySelected = true;
    strategySelectionEvidence = "customer_explicit";
    syncMidpointControls(selection.recommendationStrategy);
    if (announce) {
      document.getElementById("oo-v52-midpoint-selection-status").textContent =
        choiceTitle(selection.recommendationStrategy) +
        " selected. Right " + selection.displayRight + ", left " + selection.displayLeft + ".";
    }
    previewSelection();
    return getActiveRecommendation();
  }

  // Restores a strategy on the panel that is showing (profile switching).
  // A strategy that is no longer offered falls back to the primary pair.
  function selectStrategy(strategy) {
    if (currentHighCylinderPreview && strategy === "closer_to_sph") return selectHighCylinderStrategy(strategy, false);
    if (currentMidpointChoice && (strategy === "balanced" || strategy === (currentMidpointChoice.alternativeStrategy || "sharper"))) {
      return selectMidpointStrategy(strategy, false);
    }
    previewSelection();
    return getActiveRecommendation();
  }

  function resetMidpointControls() {
    var balanced = document.getElementById("oo-v52-midpoint-balanced");
    var alternative = document.getElementById("oo-v52-midpoint-sharper");
    if (!balanced || !alternative) return;
    balanced.disabled = false;
    alternative.disabled = false;
    balanced.checked = false;
    alternative.checked = false;
    document.getElementById("oo-v52-midpoint-selection-status").textContent = "";
    setNotice("oo-v52-midpoint-alternative-notice", "");
  }

  function samePower(a, b) {
    return Number.isFinite(Number(a)) && Math.abs(Number(a) - Number(b)) < 1e-9;
  }

  // Called when the customer chooses a mask from a previewed pair. Confirms
  // exactly the selected strategy and OD/OS pair through the existing
  // oo:v52:calculated save, once. Resolves to the saved profile, or null when
  // nothing was saved (stale preview, changed prescription, or a failed save,
  // which the Rx status already reports with a retry).
  function commitPreviewedRecommendation(expected) {
    if (!pendingCalculation) return Promise.resolve(null);
    if ((currentMidpointChoice || (currentHighCylinderPreview && currentHighCylinderPreview.available)) && !customerStrategySelected) return Promise.resolve(null);
    var active = getActiveRecommendation();
    if (
      !active || !expected ||
      active.recommendationStrategy !== expected.recommendationStrategy ||
      !samePower(active.recommendedRight, expected.recommendedRight) ||
      !samePower(active.recommendedLeft, expected.recommendedLeft)
    ) {
      return Promise.resolve(null);
    }

    try {
      var visiblePrescription = getConfirmedPrescription();
      if (JSON.stringify(visiblePrescription) !== JSON.stringify(pendingCalculation.prescription)) {
        pendingCalculation = null;
        showError("Your prescription changed. Find your lens strength again before choosing a pair.");
        return Promise.resolve(null);
      }
    } catch (error) {
      showError(error.message || "Please check your prescription and calculate again.");
      return Promise.resolve(null);
    }

    pendingCalculation.activeRecommendation = active;
    var high = pendingCalculation.highCylinderPreview;
    var midpoint = pendingCalculation.midpointChoice;
    var pairText = function (right, left) { return { right: String(right), left: String(left) }; };
    var optionsShown = null;
    var midpointSharper = midpoint && (midpoint.alternative || midpoint.sharper);
    if (midpoint && midpoint.balanced && midpointSharper) {
      optionsShown = { closer_to_sph: pairText(midpointSharper.right, midpointSharper.left), balanced: pairText(midpoint.balanced.right, midpoint.balanced.left) };
    } else if (high && high.available) {
      optionsShown = { closer_to_sph: pairText(high.alternative.right, high.alternative.left), balanced: pairText(high.balanced.right, high.balanced.left) };
    }
    var choiceRequired = Boolean(optionsShown &&
      (optionsShown.closer_to_sph.right !== optionsShown.balanced.right || optionsShown.closer_to_sph.left !== optionsShown.balanced.left));
    var selectedStrategy = choiceRequired ? (active.recommendationStrategy === "balanced" ? "balanced" : "closer_to_sph") : null;
    pendingCalculation.v53Snapshot = {
      schemaVersion: "1",
      calculatorVersion: String((window.OOLensCalculatorV53 && window.OOLensCalculatorV53.VERSION) || "5.3"),
      source: "calculator",
      optionsShown: optionsShown,
      recommendedStrategy: optionsShown ? "closer_to_sph" : (active.recommendationStrategy === "balanced" ? "balanced" : "closer_to_sph"),
      recommendedValues: optionsShown ? optionsShown.closer_to_sph : pairText(active.recommendedRight, active.recommendedLeft),
      selectedStrategy: selectedStrategy,
      selectedRecommendation: selectedStrategy ? pairText(active.recommendedRight, active.recommendedLeft) : null,
      selectionEvidence: selectedStrategy ? (strategySelectionEvidence || "customer_explicit") : null,
      finalProductSelection: null,
      manualOverride: false
    };
    document.querySelectorAll(".oo-v52-high-cyl__input").forEach(function (input) {
      input.disabled = true;
    });

    var calculation = pendingCalculation;
    pendingCalculation = null;
    document.dispatchEvent(new CustomEvent("oo:v52:calculated", { detail: calculation }));
    var saving = prescriptionManager && typeof prescriptionManager.lastSave === "function"
      ? prescriptionManager.lastSave()
      : null;
    return Promise.resolve(saving || null);
  }

  function hideMidpointChoice() {
    currentMidpointChoice = null;
    var panel = document.getElementById("oo-v52-midpoint");
    if (panel) panel.hidden = true;
    resetMidpointControls();
  }

  // Shown only when no eye is blocked or in a protected pathway, the high-CYL
  // workflow is not showing, the pair is not mixed sign, and the shared
  // choice layer finds a Sharper or Closer to Your SPH pair.
  function renderMidpointChoice(rightResult, leftResult, blocked, highCylinderPreview) {
    hideMidpointChoice();
    var module = choiceModule();
    if (blocked || !module) return null;
    var options = {
      highCylinderTriggered: Boolean(highCylinderPreview && highCylinderPreview.triggered),
      highCylinderThreshold: window.OOV52HighCylinder ? window.OOV52HighCylinder.HIGH_CYL_THRESHOLD : undefined
    };
    var choice = typeof module.calculatePairRecommendationChoice === "function"
      ? module.calculatePairRecommendationChoice(rightResult, leftResult, options)
      : module.calculatePairMidpointChoice(rightResult, leftResult, options);
    if (!choice.available) return choice;
    var strategy = choice.alternativeStrategy || module.STRATEGY_SHARPER;
    var alternative = choice.alternative || choice.sharper;

    setResultText("oo-v52-midpoint-balanced-right", choice.balanced.right);
    setResultText("oo-v52-midpoint-balanced-left", choice.balanced.left);
    setResultText("oo-v52-midpoint-sharper-right", alternative.right);
    setResultText("oo-v52-midpoint-sharper-left", alternative.left);
    var alternativeInput = document.getElementById("oo-v52-midpoint-sharper");
    alternativeInput.value = strategy;
    resetMidpointControls();
    currentMidpointChoice = choice;
    renderMidpointCards(module, choice, rightResult, leftResult);
    document.getElementById("oo-v52-result-values").hidden = true;
    document.getElementById("oo-v52-midpoint").hidden = false;
    return choice;
  }

  // Titles, badge, copy and order of the two option cards: the recommended
  // (default) card comes first. A strictly closer Sharper pair leads as the
  // Closer Match, with the V5.3 pair second as the Softer Option.
  function renderMidpointCards(module, choice, rightResult, leftResult) {
    var balancedInput = document.getElementById("oo-v52-midpoint-balanced");
    var alternativeInput = document.getElementById("oo-v52-midpoint-sharper");
    var entries = typeof module.choiceEntries === "function" ? module.choiceEntries(choice, rightResult, leftResult) : null;
    if (!entries) {
      var strategy = alternativeInput.value;
      setResultText("oo-v52-midpoint-alternative-title", choiceTitle(strategy));
      var copy = strategy === module.STRATEGY_CLOSER_TO_SPH
        ? module.COPY.closerCopy + " " + module.closerToSphRelation(choice)
        : module.COPY.sharperCopy;
      setResultText("oo-v52-midpoint-alternative-copy", copy.trim());
      setNotice("oo-v52-midpoint-alternative-notice", module.seNoticeFor(module.eyesStrongerThanSE(rightResult, leftResult, choice.alternative || choice.sharper)));
      return;
    }
    // The candidate calculation decides validity and values. The storefront
    // recommendation is stable: when two distinct pairs exist, Sharper is the
    // highlighted option, while neither radio is selected until interaction.
    entries.sort(function (a, b) {
      return a.strategy === "balanced" ? 1 : (b.strategy === "balanced" ? -1 : 0);
    });
    entries.forEach(function (entry, index) {
      entry.title = entry.strategy === "balanced" ? "Balanced" : "Sharper";
      entry.recommended = index === 0;
      entry.badge = index === 0 ? "Recommended" : "";
    });
    entries.forEach(function (entry) {
      var input = entry.strategy === "balanced" ? balancedInput : alternativeInput;
      var label = input.parentNode.querySelector(".oo-v52-high-cyl__option");
      var title = label.querySelector(".oo-v52-high-cyl__option-title");
      title.textContent = entry.title;
      if (entry.badge) {
        var badge = document.createElement("span");
        badge.className = "oo-v52-high-cyl__badge";
        badge.textContent = entry.badge;
        title.appendChild(document.createTextNode(" "));
        title.appendChild(badge);
      }
      var copyNode = label.querySelector(".oo-v52-high-cyl__copy");
      if (copyNode) copyNode.textContent = entry.copy;
      if (entry.strategy !== "balanced") setNotice("oo-v52-midpoint-alternative-notice", entry.notice);
    });
    var first = (entries[0].strategy === "balanced" ? balancedInput : alternativeInput).parentNode;
    if (first.parentNode.firstElementChild !== first) first.parentNode.insertBefore(first, first.parentNode.firstElementChild);
  }

  function showResults(rightResult, leftResult) {
    var result = document.getElementById("oo-v52-result");
    var guidance = document.getElementById("oo-v52-guidance");
    var rightState = showEyeStrength("right", rightResult);
    var leftState = showEyeStrength("left", leftResult);
    updatePlanoNote();
    var blocked = rightState.blocking || leftState.blocking;
    var highCylinderPreview = renderHighCylinderPreview(rightResult, leftResult, blocked);
    var midpointChoice = renderMidpointChoice(rightResult, leftResult, blocked, highCylinderPreview);
    updatePlanoNote();
    var showingComparison = Boolean(highCylinderPreview && highCylinderPreview.triggered && highCylinderPreview.available && !blocked);
    var showingMidpoint = Boolean(midpointChoice && midpointChoice.available);
    var resultIntro = document.getElementById("oo-v52-result-intro");
    if (resultIntro) resultIntro.hidden = !(showingMidpoint && !showingComparison);

    result.hidden = rightState.blocking && leftState.blocking;
    result.classList.toggle("has-high-cyl", showingComparison || showingMidpoint);
    showGuidance(rightState, leftState, showingComparison);

    var focusTarget = result.hidden ? guidance : result;
    focusTarget.focus({ preventScroll: true });
    focusTarget.scrollIntoView({ behavior: "smooth", block: "nearest" });
    lastMidpointChoice = midpointChoice;
    return highCylinderPreview;
  }

  var lastMidpointChoice = null;

  function isBlockingReview(eyeResult) {
    return (
      !eyeResult.valid ||
      eyeResult.stockStatus === "PLANO_CROSSOVER_REVIEW" ||
      !eyeResult.recommendation
    );
  }

  // Plano (0.00) keeps the mask's standard lens. When a displayed eye is
  // plano, say so under the result instead of leaving a bare 0.00.
  var PLANO_NOTE = "Plano (0.00) means no correction for that eye: the mask's standard lens stays in place.";

  function isPlanoText(text) {
    return /^[+-]?0(?:\.0+)?$/.test(String(text || "").trim());
  }

  function updatePlanoNote() {
    var values = document.getElementById("oo-v52-result-values");
    if (!values) return;
    var note = document.getElementById("oo-v52-result-plano-note");
    if (!note) {
      note = document.createElement("p");
      note.id = "oo-v52-result-plano-note";
      note.className = "oo-v52__result-plano-note";
      values.parentNode.insertBefore(note, values.nextSibling);
    }
    var planoEyes = ["right", "left"].filter(function (side) {
      var value = document.getElementById("oo-v52-result-" + side);
      return value && !value.hidden && isPlanoText(value.textContent);
    });
    note.textContent = planoEyes.length ? PLANO_NOTE : "";
    note.hidden = planoEyes.length === 0 || values.hidden;
  }

  function showEyeStrength(side, eyeResult) {
    var value = document.getElementById("oo-v52-result-" + side);
    var blocking = isBlockingReview(eyeResult);

    value.hidden = blocking;
    if (!blocking) value.textContent = eyeResult.recommendation;

    return {
      side: side,
      blocking: blocking,
      higherCylinder: !blocking && Number(eyeResult.cylinderMagnitude) >= 3
    };
  }

  function appendGuidanceParagraph(container, text) {
    var paragraph = document.createElement("p");
    paragraph.textContent = text;
    container.appendChild(paragraph);
  }

  function appendReviewParagraph(container, eyeName) {
    var paragraph = document.createElement("p");
    var subject = eyeName ? "your " + eyeName + " prescription" : "your prescription";
    paragraph.appendChild(document.createTextNode("We need to review " + subject + " before recommending a lens strength. Please email your prescription to "));

    var link = document.createElement("a");
    link.href = "mailto:info@oceansoptics.com";
    link.textContent = "info@oceansoptics.com";
    paragraph.appendChild(link);
    paragraph.appendChild(document.createTextNode("."));
    container.appendChild(paragraph);
  }

  function showGuidance(rightState, leftState, showingComparison) {
    var guidance = document.getElementById("oo-v52-guidance");
    var content = document.getElementById("oo-v52-guidance-content");
    content.innerHTML = "";

    if (showingComparison) {
      guidance.hidden = true;
      return;
    }

    if (rightState.blocking && leftState.blocking) {
      appendReviewParagraph(content, "");
    } else if (rightState.blocking) {
      appendReviewParagraph(content, "right-eye");
    } else if (leftState.blocking) {
      appendReviewParagraph(content, "left-eye");
    }

    if (rightState.higherCylinder && leftState.higherCylinder) {
      appendGuidanceParagraph(content, BOTH_EYES_HIGH_CYL_GUIDANCE);
      appendGuidanceParagraph(content, HIGH_CYL_BENEFIT);
    } else if (rightState.higherCylinder) {
      appendGuidanceParagraph(content, RIGHT_EYE_HIGH_CYL_GUIDANCE);
      appendGuidanceParagraph(content, HIGH_CYL_BENEFIT);
    } else if (leftState.higherCylinder) {
      appendGuidanceParagraph(content, LEFT_EYE_HIGH_CYL_GUIDANCE);
      appendGuidanceParagraph(content, HIGH_CYL_BENEFIT);
    }

    // Only genuine review / higher-astigmatism guidance is shown; the
    // recommendation itself is explained by the cards and the accordion.
    guidance.hidden = !content.childNodes.length;
  }

  // Calculates the prescription in the form. Every successful result is
  // previewed: the primary pair is selected, its matching masks are shown
  // straight away, and nothing is saved until the customer chooses a mask.
  // options.strategy restores a previously selected option (profile switch).
  function calculate(event, options) {
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    options = options || {};
    clearError();
    pendingCalculation = null;
    customerStrategySelected = false;
    strategySelectionEvidence = null;

    if (!window.OOLensCalculatorV53) {
      showError("The calculator could not load. Please refresh and try again.");
      return null;
    }

    try {
      var rightInput = rawPrescriptionFor(document.querySelector('[data-eye="right"]'));
      var leftInput = rawPrescriptionFor(document.querySelector('[data-eye="left"]'));

      var rightResult = window.OOLensCalculatorV53.calculateEyeRecommendationV53(rightInput, "Right (OD)");
      var leftResult = window.OOLensCalculatorV53.calculateEyeRecommendationV53(leftInput, "Left (OS)");

      var highCylinderPreview = showResults(rightResult, leftResult);
      var showingHighCylinderSelection = Boolean(
        highCylinderPreview && highCylinderPreview.triggered && highCylinderPreview.available &&
        !isBlockingReview(rightResult) && !isBlockingReview(leftResult)
      );

      var successful = !isBlockingReview(rightResult) && !isBlockingReview(leftResult);
      var midpointChoice = lastMidpointChoice && lastMidpointChoice.available ? lastMidpointChoice : null;
      var showingMidpointSelection = Boolean(midpointChoice && successful && !showingHighCylinderSelection);
      if (showingMidpointSelection) {
        // The choice's default: Sharper when strictly closer, else balanced.
        var defaultSelection = choiceModule().recommendationSelection(midpointChoice, midpointChoice.alternativeStrategy || "sharper");
        setActiveRecommendation(defaultSelection, false);
        resetMidpointControls();
        syncMidpointControls(defaultSelection.recommendationStrategy);
        customerStrategySelected = true;
        strategySelectionEvidence = "default_recommendation";
      } else if (!showingHighCylinderSelection && successful) {
        setActiveRecommendation({
          recommendationStrategy: "balanced",
          recommendedRight: Number(rightResult.recommendation),
          recommendedLeft: Number(leftResult.recommendation),
          displayRight: rightResult.recommendation,
          displayLeft: leftResult.recommendation
        }, false);
      } else if (!successful) {
        setActiveRecommendation(null, false);
      }

      var calculation = {
        successful: successful,
        prescription: confirmedPrescriptionFromRaw(rightInput, leftInput),
        rightResult: rightResult,
        leftResult: leftResult,
        highCylinderPreview: highCylinderPreview,
        midpointChoice: showingMidpointSelection ? midpointChoice : null,
        activeRecommendation: getActiveRecommendation()
      };
      renderCalculationDetails(calculation, true);

      if (successful) lockCalculatedPrescription();
      else setPrescriptionLocked(false, { state: "editing" });

      if (successful) {
        pendingCalculation = calculation;
        if (options.strategy && options.strategy !== getActiveRecommendation().recommendationStrategy) {
          selectStrategy(options.strategy);
        } else {
          previewSelection();
        }
      }
      return calculation;
    } catch (error) {
      showError(error.message || "Please check your prescription and try again.");
      return null;
    }
  }

  function confirmedEyeFromRaw(raw) {
    var signedCylinder = Number(raw.cylinder);
    return {
      sph: Number(raw.sphere),
      cyl: Math.abs(signedCylinder),
      cylSign: raw.cylinderSign === "-" || raw.cylinderSign === "+"
        ? raw.cylinderSign
        : (signedCylinder < 0 ? "-" : "+"),
      axis: raw.axis ? Number(raw.axis) : null
    };
  }

  function confirmedPrescriptionFromRaw(right, left) {
    return {
      right: confirmedEyeFromRaw(right),
      left: confirmedEyeFromRaw(left)
    };
  }

  function applyEyePrescription(eye, data) {
    var failed = [];
    if (!data || typeof data !== "object") return ["sphere", "cylinder"];

    if (data.sph !== null && data.sph !== undefined) {
      if (!setMagnitude(eye, "sphere", data.sph)) {
        failed.push("sphere");
      } else {
        setSign(eye.querySelector('.oo-v52__sign[data-field="sphere"]'), Number(data.sph) < 0 ? "-" : "+");
      }
    }

    if (data.cyl !== null && data.cyl !== undefined) {
      if (!setMagnitude(eye, "cylinder", data.cyl)) {
        failed.push("cylinder");
      } else {
        updateCylinderState(eye);
        var cylinderSignSet = setSign(
          eye.querySelector('.oo-v52__sign[data-field="cylinder"]'),
          data.cylSign
        );
        if (Number(data.cyl) !== 0 && !cylinderSignSet) {
          failed.push("cylinder");
        }
      }
    }

    if (data.axis !== null && data.axis !== undefined && Number(data.cyl) !== 0) {
      var axis = eye.querySelector('.oo-v52__axis[data-field="axis"]');
      var axisValue = Number(data.axis);
      if (Number.isInteger(axisValue) && axisValue >= 1 && axisValue <= 180) {
        axis.value = String(axisValue);
      } else {
        failed.push("axis");
      }
    }

    return failed;
  }

  function applyPrescription(prescription) {
    var failed = [];
    ["right", "left"].forEach(function (side) {
      var eye = document.querySelector('[data-eye="' + side + '"]');
      applyEyePrescription(eye, prescription && prescription[side]).forEach(function (fieldName) {
        failed.push(side + "." + fieldName);
      });
    });
    return failed;
  }

  function markMissingFields(keys) {
    document.querySelectorAll(".oo-v52__field.is-rx-missing").forEach(function (field) {
      field.classList.remove("is-rx-missing");
    });
    keys.forEach(function (key) {
      var parts = key.split(".");
      var eye = document.querySelector('[data-eye="' + parts[0] + '"]');
      var field = eye && eye.querySelector('.oo-v52__field[data-rx-field="' + parts[1] + '"]');
      if (field) field.classList.add("is-rx-missing");
    });
  }

  function getConfirmedPrescription() {
    var right = rawPrescriptionFor(document.querySelector('[data-eye="right"]'));
    var left = rawPrescriptionFor(document.querySelector('[data-eye="left"]'));
    return confirmedPrescriptionFromRaw(right, left);
  }

  function setPrescriptionLocked(locked, options) {
    options = options || {};
    var form = document.getElementById("oo-v52-form");
    var editButton = document.getElementById("oo-v52-edit");
    form.classList.toggle("is-locked", Boolean(locked));
    form.dataset.rxState = options.state || (locked ? "locked" : "editing");
    form.querySelectorAll(".oo-v52__sign, .oo-v52__eye select").forEach(function (control) {
      control.disabled = Boolean(locked);
    });
    form.querySelector(".oo-v52__submit").hidden = Boolean(locked);
    editButton.hidden = !(locked && options.allowEdit);

    if (!locked) {
      document.querySelectorAll(".oo-v52__eye").forEach(updateCylinderState);
    }
  }

  function lockCalculatedPrescription() {
    setPrescriptionLocked(true, { state: "calculated", allowEdit: true });
  }

  function setPrescriptionFinalizing() {
    var form = document.getElementById("oo-v52-form");
    if (form.dataset.rxState === "confirmed") return;
    setPrescriptionLocked(true, { state: "finalizing" });
  }

  function beginPrescriptionEdit() {
    var form = document.getElementById("oo-v52-form");
    if (form.dataset.rxState !== "calculated") return false;
    setPrescriptionLocked(false, { state: "editing-calculated" });
    return true;
  }

  function hideExplanation() {
    var container = document.getElementById("oo-v52-explain");
    if (!container) return;
    container.hidden = true;
    container.innerHTML = "";
  }

  // Any change to a calculated prescription invalidates its recommendation,
  // its selected option and its mask matches; only a new calculation can be
  // handed to a product.
  function markCalculationStale() {
    var form = document.getElementById("oo-v52-form");
    if (form.dataset.rxState !== "editing-calculated") return false;

    form.dataset.rxState = "editing";
    activeRecommendation = null;
    currentHighCylinderPreview = null;
    pendingCalculation = null;
    hideMidpointChoice();
    document.getElementById("oo-v52-result").hidden = true;
    document.getElementById("oo-v52-result").classList.remove("has-high-cyl");
    document.getElementById("oo-v52-guidance").hidden = true;
    hideExplanation();
    document.getElementById("oo-v52-high-cyl").hidden = true;
    document.getElementById("oo-v52-result-values").hidden = false;
    resetHighCylinderControls();
    renderHighCylinderSummary(null);
    document.dispatchEvent(new CustomEvent("oo:v52:calculation-stale"));
    return true;
  }

  function clearResults() {
    clearError();
    activeRecommendation = null;
    currentHighCylinderPreview = null;
    pendingCalculation = null;
    hideMidpointChoice();
    document.getElementById("oo-v52-result").hidden = true;
    document.getElementById("oo-v52-result").classList.remove("has-high-cyl");
    document.getElementById("oo-v52-guidance").hidden = true;
    hideExplanation();
    document.getElementById("oo-v52-high-cyl").hidden = true;
    document.getElementById("oo-v52-result-values").hidden = false;
    resetHighCylinderControls();
    renderHighCylinderSummary(null);
  }

  function resetForNewPrescription() {
    setPrescriptionLocked(false);
    document.querySelectorAll(".oo-v52__eye").forEach(function (eye) {
      ["sphere", "cylinder"].forEach(function (fieldName) {
        var sign = eye.querySelector('.oo-v52__sign[data-field="' + fieldName + '"]');
        var integer = eye.querySelector('.oo-v52__integer[data-field="' + fieldName + '"]');
        var fraction = eye.querySelector('.oo-v52__fraction[data-field="' + fieldName + '"]');
        sign.dataset.sign = "";
        sign.dataset.selected = "false";
        sign.setAttribute("aria-pressed", "false");
        sign.textContent = "+/-";
        integer.value = "0";
        if (fieldName === "cylinder") fillFractionSelect(fraction, true);
        fraction.value = "00";
      });
      updateCylinderState(eye);
    });

    markMissingFields([]);
    clearResults();
  }

  // Shows a previewed (not yet saved) prescription again: its values go back
  // into the form and it is recalculated with its selected option.
  function restorePreviewProfile(profile) {
    if (!profile || !profile.confirmedRx) return null;
    resetForNewPrescription();
    applyPrescription(profile.confirmedRx);
    if (profile.stale) {
      setPrescriptionLocked(false, { state: "editing" });
      return null;
    }
    return calculate(null, { strategy: profile.recommendationStrategy });
  }

  function restoreConfirmedProfile(profile) {
    if (!profile || !profile.confirmedRx) return false;
    markMissingFields([]);
    applyPrescription(profile.confirmedRx);
    activeRecommendation = copyRecommendation({
      recommendationStrategy: profile.recommendationStrategy,
      recommendedRight: profile.recommendedRight,
      recommendedLeft: profile.recommendedLeft,
      displayRight: formatCalculationPower(profile.recommendedRight),
      displayLeft: formatCalculationPower(profile.recommendedLeft)
    });
    currentHighCylinderPreview = null;
    pendingCalculation = null;
    hideMidpointChoice();
    renderHighCylinderSummary(null);

    setResultText("oo-v52-result-right", formatCalculationPower(profile.recommendedRight));
    setResultText("oo-v52-result-left", formatCalculationPower(profile.recommendedLeft));
    document.getElementById("oo-v52-result-right").hidden = false;
    document.getElementById("oo-v52-result-left").hidden = false;
    updatePlanoNote();
    document.getElementById("oo-v52-result-values").hidden = false;
    document.getElementById("oo-v52-high-cyl").hidden = true;
    document.getElementById("oo-v52-result").hidden = false;
    document.getElementById("oo-v52-result").classList.remove("has-high-cyl");
    document.getElementById("oo-v52-guidance").hidden = true;

    if (profile.calculation) {
      profile.calculation.activeRecommendation = copyRecommendation(activeRecommendation);
      renderCalculationDetails(profile.calculation, true);
    } else {
      hideExplanation();
    }
    setPrescriptionLocked(true, { state: "confirmed" });
    return true;
  }

  // The prescription currently in the form, or null while it is incomplete.
  function readPrescriptionDraft() {
    try {
      return getConfirmedPrescription();
    } catch (error) {
      return null;
    }
  }

  function hasPendingPreview() {
    return Boolean(pendingCalculation);
  }

  function setPrescriptionManager(manager) {
    prescriptionManager = manager || null;
  }

  function getPrescriptionProfiles() {
    return prescriptionManager ? prescriptionManager.getPrescriptionProfiles() : [];
  }

  function getActivePrescription() {
    return prescriptionManager ? prescriptionManager.getActivePrescription() : null;
  }

  function setActivePrescription(id) {
    return prescriptionManager ? prescriptionManager.setActivePrescription(id) : null;
  }

  window.OOV52CalculatorUI = {
    applyPrescription: applyPrescription,
    getActiveRecommendation: getActiveRecommendation,
    getPrescriptionProfiles: getPrescriptionProfiles,
    getActivePrescription: getActivePrescription,
    getConfirmedPrescription: getConfirmedPrescription,
    readPrescriptionDraft: readPrescriptionDraft,
    hasPendingPreview: hasPendingPreview,
    markMissingFields: markMissingFields,
    resetForNewPrescription: resetForNewPrescription,
    restoreConfirmedProfile: restoreConfirmedProfile,
    restorePreviewProfile: restorePreviewProfile,
    setPrescriptionLocked: setPrescriptionLocked,
    setPrescriptionFinalizing: setPrescriptionFinalizing,
    selectHighCylinderStrategy: selectHighCylinderStrategy,
    selectMidpointStrategy: selectMidpointStrategy,
    commitPreviewedRecommendation: commitPreviewedRecommendation,
    setActivePrescription: setActivePrescription,
    setPrescriptionManager: setPrescriptionManager
  };

  document.querySelectorAll(".oo-v52__eye").forEach(initializeEye);
  document.getElementById("oo-v52-form").addEventListener("submit", calculate);
  document.getElementById("oo-v52-edit").addEventListener("click", beginPrescriptionEdit);
  document.querySelectorAll('.oo-v52-high-cyl__input[name="oo-v52-high-strategy"]').forEach(function (input) {
    input.addEventListener("change", function () {
      if (input.checked && pendingCalculation && currentHighCylinderPreview) selectHighCylinderStrategy(input.value, true);
    });
  });

  document.querySelectorAll('.oo-v52-high-cyl__input[name="oo-v52-midpoint-strategy"]').forEach(function (input) {
    input.addEventListener("change", function () {
      if (input.checked && pendingCalculation && currentMidpointChoice) selectMidpointStrategy(input.value, true);
    });
  });

  function closeTooltips(except) {
    document.querySelectorAll(".oo-v52__help-wrap.is-open").forEach(function (wrapper) {
      if (wrapper === except) return;
      wrapper.classList.remove("is-open");
      wrapper.querySelector(".oo-v52__help").setAttribute("aria-expanded", "false");
    });
  }

  function clampTooltip(wrapper) {
    var tooltip = wrapper.querySelector(".oo-v52__tooltip");
    var trigger = wrapper.querySelector(".oo-v52__help").getBoundingClientRect();
    var wrapperStyles = window.getComputedStyle(wrapper);
    var gap = parseFloat(wrapperStyles.getPropertyValue("--oo-tooltip-gap")) || 10;
    var preferredWidth = 240;
    var padding = 12;
    var spaceRight = Math.max(0, window.innerWidth - padding - trigger.right - gap);
    var spaceLeft = Math.max(0, trigger.left - padding - gap);
    var opensRight = spaceRight >= preferredWidth || spaceRight >= spaceLeft;
    var availableWidth = opensRight ? spaceRight : spaceLeft;

    wrapper.setAttribute("data-tooltip-side", opensRight ? "right" : "left");
    tooltip.style.setProperty("--oo-tooltip-max-width", Math.min(preferredWidth, availableWidth) + "px");
    tooltip.style.setProperty("--oo-tooltip-shift", "0px");
    var bounds = tooltip.getBoundingClientRect();
    var shift = 0;

    if (bounds.left < padding) shift = padding - bounds.left;
    if (bounds.right > window.innerWidth - padding) shift = window.innerWidth - padding - bounds.right;
    tooltip.style.setProperty("--oo-tooltip-shift", shift + "px");
  }

  document.querySelectorAll(".oo-v52__help-wrap").forEach(function (wrapper) {
    var button = wrapper.querySelector(".oo-v52__help");

    button.addEventListener("click", function (event) {
      event.stopPropagation();
      var willOpen = !wrapper.classList.contains("is-open");
      closeTooltips(wrapper);
      wrapper.classList.toggle("is-open", willOpen);
      button.setAttribute("aria-expanded", String(willOpen));
      if (willOpen) requestAnimationFrame(function () { clampTooltip(wrapper); });
    });

    wrapper.addEventListener("mouseenter", function () {
      requestAnimationFrame(function () { clampTooltip(wrapper); });
    });
  });

  document.addEventListener("click", function () {
    closeTooltips();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeTooltips();
  });

  window.addEventListener("resize", function () {
    document.querySelectorAll(".oo-v52__help-wrap.is-open").forEach(clampTooltip);
  });
})();
