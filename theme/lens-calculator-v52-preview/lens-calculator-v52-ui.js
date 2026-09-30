(function () {
  "use strict";

  var FRACTIONS = ["00", "25", "50", "75"];
  var SPHERE_MAX_INTEGER = 10;
  var CYLINDER_MAX_INTEGER = 9;
  var STANDARD_GUIDANCE =
    "We’ve used your prescription values to choose the closest practical underwater lens strength for each eye, helping give you a balanced overall correction underwater.";
  var BOTH_EYES_HIGH_CYL_GUIDANCE =
    "Your prescription includes higher astigmatism, so we’ve used a spherical-equivalent approach to balance your SPH and CYL values and choose the closest practical lens strength available.";
  var RIGHT_EYE_HIGH_CYL_GUIDANCE =
    "Your right-eye prescription includes higher astigmatism, so we’ve used a spherical-equivalent approach to balance its SPH and CYL values and choose the closest practical lens strength available.";
  var LEFT_EYE_HIGH_CYL_GUIDANCE =
    "Your left-eye prescription includes higher astigmatism, so we’ve used a spherical-equivalent approach to balance its SPH and CYL values and choose the closest practical lens strength available.";
  var HIGH_CYL_BENEFIT =
    "This gives you the best overall match from our available sphere-only corrective lenses.";
  var activeRecommendation = null;
  var currentHighCylinderPreview = null;
  var pendingHighCylinderCalculation = null;
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
    if (profile) {
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

  function formatPrescriptionEye(eye) {
    if (!eye) return "--";
    var cylinder = Number(eye.cyl);
    var cylinderValue = Math.abs(cylinder) < 1e-9
      ? "0.00"
      : (eye.cylSign === "+" ? "+" : "-") + Math.abs(cylinder).toFixed(2);
    var axis = Math.abs(cylinder) < 1e-9 || !eye.axis
      ? ""
      : " · Axis " + String(eye.axis).padStart(3, "0");
    return "SPH " + formatCalculationPower(eye.sph) + " · CYL " + cylinderValue + axis;
  }

  function sphereOnlyExplanation(usesAlternative) {
    return usesAlternative
      ? "This option uses a smaller portion of your CYL value, keeping the sphere-only starting strength closer to the SPH value on your prescription."
      : "This option uses your spherical equivalent — SPH plus half of your CYL.";
  }

  function stockExplanation(recommended, target) {
    if (target < 0 && target > -1) {
      return "There is no lens between 0.00 and -1.00 D. If the adjusted value needs less than 0.50 D of correction we use 0.00; if it needs 0.50 D or more we use -1.00.";
    }
    if (recommended < 0) {
      return "Our corrective lenses are available in 0.50 D steps, so we choose the closest available strength that stays at or closer to zero than the adjusted value.";
    }
    if (target > 0 && target < 1) {
      return recommended > 0
        ? "There is no lens between 0.00 and +1.00 D, so for this low farsighted prescription we use +1.00 rather than no correction."
        : "There is no lens between 0.00 and +1.00 D, and your adjusted value is small enough that no correction (0.00) is suggested.";
    }
    if (recommended > 0) {
      return "Our farsighted corrective lenses are available in 1.00 D steps, so we choose the closest available strength. If the adjusted value is exactly halfway between two strengths, we use the weaker one.";
    }
    return "We match the adjusted value to the closest suitable lens strength available.";
  }

  function calculationBreakdownFor(side, calculation) {
    var eyeResult = side === "right" ? calculation.rightResult : calculation.leftResult;
    var selected = calculation.activeRecommendation || activeRecommendation;
    var strategy = selected && selected.recommendationStrategy || "balanced";
    var highEye = calculation.highCylinderPreview && calculation.highCylinderPreview.eyes[side];
    var usesAlternative = strategy === "closer_to_sph" && highEye && highEye.triggered;
    var recommended = selected
      ? selected[side === "right" ? "recommendedRight" : "recommendedLeft"]
      : eyeResult.finalStockPower;

    return {
      prescription: formatPrescriptionEye(calculation.prescription[side]),
      reference: usesAlternative ? highEye.quarterCylinderBase : eyeResult.sphericalEquivalent,
      target: usesAlternative ? highEye.alternativeTarget : eyeResult.preSnapTarget,
      finalRecommendation: recommended,
      referenceExplanation: sphereOnlyExplanation(usesAlternative),
      stockExplanation: stockExplanation(recommended, usesAlternative ? highEye.alternativeTarget : eyeResult.preSnapTarget)
    };
  }

  function renderCalculationEye(side, breakdown) {
    setResultText("oo-v52-calc-" + side + "-prescription", breakdown.prescription);
    setResultText("oo-v52-calc-" + side + "-reference", formatCalculationPower(breakdown.reference));
    setResultText("oo-v52-calc-" + side + "-reference-copy", breakdown.referenceExplanation);
    setResultText("oo-v52-calc-" + side + "-target", formatCalculationPower(breakdown.target));
    setResultText("oo-v52-calc-" + side + "-stock-copy", breakdown.stockExplanation);
    setResultText("oo-v52-calc-" + side + "-final", formatCalculationPower(breakdown.finalRecommendation));
  }

  function renderCalculationDetails(calculation, resetDisclosure) {
    var details = document.getElementById("oo-v52-calc-details");
    if (!calculation || !calculation.successful) {
      details.hidden = true;
      return;
    }

    if (resetDisclosure) details.open = false;
    document.getElementById("oo-v52-calc-summary").setAttribute("aria-expanded", String(details.open));
    details.hidden = false;
    var isHighCylinder = Boolean(
      calculation.highCylinderPreview && calculation.highCylinderPreview.triggered &&
      calculation.highCylinderPreview.available
    );
    document.getElementById("oo-v52-calc-high").hidden = !isHighCylinder;
    if (isHighCylinder) {
      var strategy = calculation.activeRecommendation && calculation.activeRecommendation.recommendationStrategy;
      setResultText(
        "oo-v52-calc-selected-strategy",
        strategy === "closer_to_sph" ? "Closer to your SPH" : "Balanced (Spherical Equivalent)"
      );
      setResultText(
        "oo-v52-calc-strategy-copy",
        strategy === "closer_to_sph"
          ? "This option uses a smaller portion of your CYL value, keeping the result closer to the SPH value on your prescription."
          : "Balanced uses your spherical equivalent — SPH plus half of your CYL."
      );
    }

    renderCalculationEye("right", calculationBreakdownFor("right", calculation));
    renderCalculationEye("left", calculationBreakdownFor("left", calculation));
  }

  var HIGH_CYL_USE_LABEL = "See Matching Masks";
  function renderHighCylinderSummary(recommendation) {
    var summary = document.getElementById("oo-v52-high-summary");
    if (summary && window.OOV52HighCylinder) {
      summary.textContent = window.OOV52HighCylinder.selectionSummary(recommendation);
    }
  }

  function setActiveRecommendation(recommendation, announce) {
    activeRecommendation = copyRecommendation(recommendation);
    if (currentHighCylinderPreview) renderHighCylinderSummary(activeRecommendation);
    if (pendingHighCylinderCalculation) {
      pendingHighCylinderCalculation.activeRecommendation = getActiveRecommendation();
      renderCalculationDetails(pendingHighCylinderCalculation, false);
    }

    if (announce) {
      var strategyName = recommendation.recommendationStrategy === "closer_to_sph"
        ? "Closer to your SPH"
        : "Balanced (Spherical Equivalent)";
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

  function selectHighCylinderStrategy(strategy, announce) {
    if (!currentHighCylinderPreview || !window.OOV52HighCylinder) return null;
    var selection = window.OOV52HighCylinder.recommendationSelection(
      currentHighCylinderPreview,
      strategy
    );
    setActiveRecommendation(selection, announce !== false);
    return getActiveRecommendation();
  }

  function resetHighCylinderControls() {
    var balanced = document.getElementById("oo-v52-high-balanced");
    var alternative = document.getElementById("oo-v52-high-alternative");
    var useButton = document.getElementById("oo-v52-high-use");
    balanced.checked = true;
    balanced.disabled = false;
    alternative.checked = false;
    alternative.disabled = false;
    useButton.disabled = false;
    useButton.textContent = HIGH_CYL_USE_LABEL;
    document.getElementById("oo-v52-high-selection-status").textContent = "";
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

    setResultText("oo-v52-high-balanced-right", preview.balanced.right);
    setResultText("oo-v52-high-balanced-left", preview.balanced.left);
    setResultText("oo-v52-high-alternative-right", preview.alternative.right);
    setResultText("oo-v52-high-alternative-left", preview.alternative.left);
    setAlternativeNote("right", preview.eyes.right);
    setAlternativeNote("left", preview.eyes.left);
    resetHighCylinderControls();
    currentHighCylinderPreview = preview;
    selectHighCylinderStrategy(window.OOV52HighCylinder.STRATEGY_BALANCED, false);

    standard.hidden = true;
    comparison.hidden = false;
    return preview;
  }

  function showResults(rightResult, leftResult) {
    var result = document.getElementById("oo-v52-result");
    var guidance = document.getElementById("oo-v52-guidance");
    var rightState = showEyeStrength("right", rightResult);
    var leftState = showEyeStrength("left", leftResult);
    updatePlanoNote();
    var blocked = rightState.blocking || leftState.blocking;
    var highCylinderPreview = renderHighCylinderPreview(rightResult, leftResult, blocked);
    updatePlanoNote();
    var showingComparison = Boolean(highCylinderPreview && highCylinderPreview.triggered && highCylinderPreview.available && !blocked);

    result.hidden = rightState.blocking && leftState.blocking;
    result.classList.toggle("has-high-cyl", showingComparison);
    showGuidance(rightState, leftState, showingComparison);

    var focusTarget = result.hidden ? guidance : result;
    focusTarget.focus({ preventScroll: true });
    focusTarget.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return highCylinderPreview;
  }

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
    } else if (!rightState.blocking && !leftState.blocking) {
      appendGuidanceParagraph(content, STANDARD_GUIDANCE);
    }

    guidance.hidden = false;
  }

  function calculate(event) {
    event.preventDefault();
    clearError();
    pendingHighCylinderCalculation = null;

    if (!window.OOLensCalculatorV53) {
      showError("The calculator could not load. Please refresh and try again.");
      return;
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
      if (!showingHighCylinderSelection && successful) {
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
        activeRecommendation: getActiveRecommendation()
      };
      renderCalculationDetails(calculation, true);

      if (successful) lockCalculatedPrescription();
      else setPrescriptionLocked(false, { state: "editing" });

      if (showingHighCylinderSelection) {
        pendingHighCylinderCalculation = calculation;
      } else {
        document.dispatchEvent(new CustomEvent("oo:v52:calculated", { detail: calculation }));
      }
    } catch (error) {
      showError(error.message || "Please check your prescription and try again.");
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

  function markCalculationStale() {
    var form = document.getElementById("oo-v52-form");
    if (form.dataset.rxState !== "editing-calculated") return false;

    form.dataset.rxState = "editing";
    activeRecommendation = null;
    currentHighCylinderPreview = null;
    pendingHighCylinderCalculation = null;
    document.getElementById("oo-v52-result").hidden = true;
    document.getElementById("oo-v52-result").classList.remove("has-high-cyl");
    document.getElementById("oo-v52-guidance").hidden = true;
    document.getElementById("oo-v52-calc-details").open = false;
    document.getElementById("oo-v52-calc-details").hidden = true;
    document.getElementById("oo-v52-high-cyl").hidden = true;
    document.getElementById("oo-v52-result-values").hidden = false;
    resetHighCylinderControls();
    document.dispatchEvent(new CustomEvent("oo:v52:calculation-stale"));
    return true;
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
    clearError();
    activeRecommendation = null;
    currentHighCylinderPreview = null;
    pendingHighCylinderCalculation = null;
    document.getElementById("oo-v52-result").hidden = true;
    document.getElementById("oo-v52-guidance").hidden = true;
    document.getElementById("oo-v52-calc-details").hidden = true;
    document.getElementById("oo-v52-high-cyl").hidden = true;
    document.getElementById("oo-v52-result-values").hidden = false;
    resetHighCylinderControls();
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
    pendingHighCylinderCalculation = null;

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
      document.getElementById("oo-v52-calc-details").hidden = true;
    }
    setPrescriptionLocked(true, { state: "confirmed" });
    return true;
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
    markMissingFields: markMissingFields,
    resetForNewPrescription: resetForNewPrescription,
    restoreConfirmedProfile: restoreConfirmedProfile,
    setPrescriptionLocked: setPrescriptionLocked,
    setPrescriptionFinalizing: setPrescriptionFinalizing,
    selectHighCylinderStrategy: selectHighCylinderStrategy,
    setActivePrescription: setActivePrescription,
    setPrescriptionManager: setPrescriptionManager
  };

  document.querySelectorAll(".oo-v52__eye").forEach(initializeEye);
  var calculationDetails = document.getElementById("oo-v52-calc-details");
  var calculationSummary = document.getElementById("oo-v52-calc-summary");
  calculationDetails.addEventListener("toggle", function () {
    calculationSummary.setAttribute("aria-expanded", String(calculationDetails.open));
  });
  document.getElementById("oo-v52-form").addEventListener("submit", calculate);
  document.getElementById("oo-v52-edit").addEventListener("click", beginPrescriptionEdit);
  document.querySelectorAll('.oo-v52-high-cyl__input[name="oo-v52-high-strategy"]').forEach(function (input) {
    input.addEventListener("change", function () {
      if (input.checked) selectHighCylinderStrategy(input.value, true);
    });
  });
  document.getElementById("oo-v52-high-use").addEventListener("click", function () {
    if (!pendingHighCylinderCalculation) return;
    var selected = document.querySelector('.oo-v52-high-cyl__input[name="oo-v52-high-strategy"]:checked');
    if (!selected) return;

    try {
      var visiblePrescription = getConfirmedPrescription();
      if (JSON.stringify(visiblePrescription) !== JSON.stringify(pendingHighCylinderCalculation.prescription)) {
        pendingHighCylinderCalculation = null;
        showError("Your prescription changed. Find your lens strength again before choosing a pair.");
        return;
      }
    } catch (error) {
      showError(error.message || "Please check your prescription and calculate again.");
      return;
    }

    selectHighCylinderStrategy(selected.value, false);
    pendingHighCylinderCalculation.activeRecommendation = getActiveRecommendation();
    document.querySelectorAll('.oo-v52-high-cyl__input[name="oo-v52-high-strategy"]').forEach(function (input) {
      input.disabled = true;
    });
    var useButton = document.getElementById("oo-v52-high-use");
    useButton.disabled = true;
    useButton.textContent = "Lens pair selected";

    var calculation = pendingHighCylinderCalculation;
    pendingHighCylinderCalculation = null;
    document.dispatchEvent(new CustomEvent("oo:v52:calculated", { detail: calculation }));
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
