/*
 * ============================================================================
 * OCEANS OPTICS LENS CALCULATOR — MASTER SOURCE OF TRUTH
 * ============================================================================
 *
 * This file is the canonical implementation for:
 *   - prescription parsing
 *   - spherocylindrical normalization (transposition to minus-cylinder form)
 *   - CYL band classification
 *   - Oceans Optics empirical underwater lens recommendation logic
 *
 * Do not duplicate calculator logic in Shopify sections/components.
 * `sections/calculator.liquid` loads this file and must not reimplement
 * any of the functions below.
 *
 * Current methodology status:
 *   The Oceans Optics recommendation methodology in
 *   calculateEmpiricalRecommendation() / calcOne() below is OPERATIONAL
 *   METHODOLOGY, internally / empirically validated through real-world
 *   underwater testing with real users. It is preserved unchanged from
 *   James's confirmed live-site calculator behavior (2026-08-28) — see
 *   content-development/research/LENS-CALCULATOR-SOURCE-OF-TRUTH.md for
 *   the full derivation record. Do not describe these Oceans
 *   Optics-specific recommendation rules as universal optometric formulas,
 *   and do not "fix" or re-derive them against outside sources.
 *
 * What changed in this file relative to the two existing implementations
 * (sections/lens-calculator.liquid, sections/lens-calc-tool-product.liquid)
 * is NOT the recommendation methodology — it is what feeds into it. See
 * the "PRESCRIPTION NORMALIZATION" section below for the boundary between
 * normalization (new) and recommendation logic (preserved as-is).
 *
 * Version: 4.0.0
 * Initial master refactor: 2026-08-28
 * Status: DEVELOPMENT — not wired into any live or published Shopify theme.
 * ============================================================================
 */

(function (root, factory) {
  var api = factory();
  if (typeof module !== "object" || module === null || typeof module.exports === "undefined") {
    root.OOLensCalculator = api;
  } else {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  var CYL_BAND_NONE = "none";
  var CYL_BAND_LOW = "low";
  var CYL_BAND_MEDIUM = "medium";
  var CYL_BAND_HIGH = "high";
  var CYL_BAND_VERY_HIGH = "very-high";

  var SPH_STEP = 0.25;
  var CYL_STEP = 0.25;
  var AXIS_MIN = 1;
  var AXIS_MAX = 180;

  var EPSILON = 1e-9;

  // ==========================================================================
  // PARSING
  // ==========================================================================

  /**
   * Parses raw form-field values for a single eye into a loosely-typed
   * "original" prescription object. Does not validate; use
   * validatePrescription() separately. Blank strings become `null`, never 0
   * — callers must not silently reinterpret a blank field as zero.
   *
   * @param {{sphere: string, cylinder: string, axis: string, add: string}} raw
   * @returns {{sphere: number|null, cylinder: number|null, axis: number|null, add: number|null, raw: object}}
   */
  function parsePrescription(raw) {
    raw = raw || {};
    return {
      sphere: parseSignedNumber(raw.sphere),
      cylinder: parseSignedNumber(raw.cylinder),
      axis: parseSignedNumber(raw.axis),
      add: parseSignedNumber(raw.add),
      raw: {
        sphere: raw.sphere,
        cylinder: raw.cylinder,
        axis: raw.axis,
        add: raw.add
      }
    };
  }

  /**
   * Parses a signed numeric string ("-3.00", "+1.50", "0.00", "180"). Returns
   * null for blank/whitespace-only input. Returns NaN for genuinely malformed
   * input (the caller's validation step is responsible for rejecting NaN with
   * a clear message — this function never silently coerces bad input to 0).
   *
   * @param {string|number|null|undefined} value
   * @returns {number|null}
   */
  function parseSignedNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return isFinite(value) ? value : NaN;
    var trimmed = String(value).trim();
    if (trimmed === "") return null;
    // Accept "+3", "-3", "3", "+3.00", "-3.00", with an optional leading sign.
    if (!/^[+-]?\d+(\.\d+)?$/.test(trimmed)) return NaN;
    return parseFloat(trimmed);
  }

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  /**
   * Validates one eye's parsed prescription.
   *
   * Rules (per the approved input design):
   *   - SPH is required.
   *   - CYL is required (customer must explicitly enter 0.00 for "none" —
   *     a blank CYL field is an error, not an implicit zero).
   *   - AXIS is required when CYL != 0.00, and must be an integer 1-180.
   *   - AXIS is optional (and ignored) when CYL == 0.00.
   *   - ADD is optional; if present it must be a valid number.
   *   - SPH/CYL must be valid multiples of 0.25 (matching how prescriptions
   *     are actually written); this is a soft check reported as an error,
   *     not silently rounded.
   *
   * @param {ReturnType<typeof parsePrescription>} parsed
   * @param {string} eyeLabel - "Right (OD)" or "Left (OS)", used in messages
   * @returns {{valid: boolean, errors: string[]}}
   */
  function validatePrescription(parsed, eyeLabel) {
    var errors = [];
    eyeLabel = eyeLabel || "eye";

    if (parsed.sphere === null) {
      errors.push(eyeLabel + ": SPH is required.");
    } else if (isNaN(parsed.sphere)) {
      errors.push(eyeLabel + ": SPH is not a valid number.");
    } else if (!isMultipleOfStep(parsed.sphere, SPH_STEP)) {
      errors.push(eyeLabel + ": SPH must be in 0.25 D increments, exactly as written on your prescription.");
    }

    if (parsed.cylinder === null) {
      errors.push(eyeLabel + ": CYL is required — enter 0.00 if your prescription has no astigmatism correction.");
    } else if (isNaN(parsed.cylinder)) {
      errors.push(eyeLabel + ": CYL is not a valid number.");
    } else if (!isMultipleOfStep(parsed.cylinder, CYL_STEP)) {
      errors.push(eyeLabel + ": CYL must be in 0.25 D increments, exactly as written on your prescription.");
    }

    var cylinderIsZero = parsed.cylinder !== null && !isNaN(parsed.cylinder) && Math.abs(parsed.cylinder) < EPSILON;

    if (!cylinderIsZero && parsed.cylinder !== null && !isNaN(parsed.cylinder)) {
      if (parsed.axis === null) {
        errors.push(eyeLabel + ": AXIS is required when CYL is not 0.00.");
      } else if (isNaN(parsed.axis) || !Number.isInteger(parsed.axis)) {
        errors.push(eyeLabel + ": AXIS must be a whole number from 1 to 180.");
      } else if (parsed.axis < AXIS_MIN || parsed.axis > AXIS_MAX) {
        errors.push(eyeLabel + ": AXIS must be between 1 and 180.");
      }
    }

    if (parsed.add !== null && isNaN(parsed.add)) {
      errors.push(eyeLabel + ": ADD is not a valid number.");
    }

    return { valid: errors.length === 0, errors: errors };
  }

  function isMultipleOfStep(value, step) {
    var scaled = value / step;
    return Math.abs(scaled - Math.round(scaled)) < 1e-6;
  }

  // ==========================================================================
  // PRESCRIPTION NORMALIZATION
  // ----------------------------------------------------------------------
  // Everything in this section converts a full, as-written prescription
  // into the canonical minus-cylinder form the recommendation engine
  // expects. NONE of this section decides what lens strength to
  // recommend — that is the sole responsibility of the next section,
  // "OCEANS OPTICS EMPIRICAL RECOMMENDATION LOGIC".
  // ==========================================================================

  /**
   * Wraps a raw axis value (which may be the result of a +90 transposition,
   * and so can fall outside 1-180 or even be negative/zero) into the
   * standard 1-180 axis range.
   *
   * @param {number} rawAxis
   * @returns {number}
   */
  function normalizeAxisValue(rawAxis) {
    var wrapped = ((rawAxis - 1) % 180 + 180) % 180 + 1;
    // Guard against floating-point results like 179.99999999999997.
    return Math.round(wrapped * 1e6) / 1e6;
  }

  /**
   * Transposes a validated, parsed prescription to minus-cylinder notation
   * using standard spherocylindrical transposition:
   *
   *   if CYL <= 0: unchanged
   *   if CYL > 0:
   *     normalizedSPH  = originalSPH + originalCYL
   *     normalizedCYL  = -originalCYL
   *     normalizedAXIS = wrap(originalAXIS + 90)
   *
   * AXIS is only meaningful (and only required) when CYL != 0; if CYL == 0,
   * axis is carried through as null.
   *
   * @param {{sphere: number, cylinder: number, axis: number|null}} original
   * @returns {{sphere: number, cylinder: number, axis: number|null}}
   */
  function transposeToMinusCylinder(original) {
    var sphere = original.sphere;
    var cylinder = original.cylinder;
    var axis = original.axis;

    if (Math.abs(cylinder) < EPSILON) {
      return { sphere: sphere, cylinder: 0, axis: null };
    }

    if (cylinder <= 0) {
      return { sphere: sphere, cylinder: cylinder, axis: axis };
    }

    // cylinder > 0: transpose.
    var normalizedSphere = sphere + cylinder;
    var normalizedCylinder = -cylinder;
    var normalizedAxis = axis === null ? null : normalizeAxisValue(axis + 90);

    return { sphere: roundTo(normalizedSphere, 2), cylinder: roundTo(normalizedCylinder, 2), axis: normalizedAxis };
  }

  function roundTo(value, decimals) {
    var factor = Math.pow(10, decimals);
    return Math.round((value + (value >= 0 ? EPSILON : -EPSILON)) * factor) / factor;
  }

  /**
   * Classifies the absolute value of a (post-transposition) CYL value into
   * the existing canonical Oceans Optics CYL bands. Boundaries are inclusive
   * on both ends of each named range, matching the confirmed live tool's
   * band definitions:
   *
   *   0.00            -> none
   *   0.25 - 0.75      -> low
   *   1.00 - 1.75      -> medium
   *   2.00 - 3.00      -> high
   *   3.25 and above   -> very-high
   *
   * @param {number} absCylinder - non-negative CYL magnitude
   * @returns {string}
   */
  function getCylinderBand(absCylinder) {
    var v = Math.abs(absCylinder);
    if (v < EPSILON) return CYL_BAND_NONE;
    if (v <= 0.75 + EPSILON) return CYL_BAND_LOW;
    if (v <= 1.75 + EPSILON) return CYL_BAND_MEDIUM;
    if (v <= 3.00 + EPSILON) return CYL_BAND_HIGH;
    return CYL_BAND_VERY_HIGH;
  }

  /**
   * Produces the full normalized prescription object for one eye: the
   * original as-entered values, plus the transposed minus-cylinder values
   * and the automatically-classified CYL band. This is the single entry
   * point normalization callers should use.
   *
   * Special case — TRUE PLANO: if the normalized sphere is 0.00 AND the
   * normalized cylinder is 0.00, the prescription is recorded as true
   * plano. The recommendation engine short-circuits this case directly to
   * "0.00" and does not run it through calcOne() — see
   * calculateEmpiricalRecommendation(). This is what prevents the old
   * "+0.00 -> +1.00" edge case from recurring.
   *
   * Special case — ZERO SPHERE WITH ASTIGMATISM: if the normalized sphere
   * is 0.00 but the normalized cylinder is NOT 0.00, this is NOT treated as
   * plano. The prescription is genuinely astigmatism-only. It is routed
   * through the nearsighted/minus branch of the recommendation engine
   * (documented in calculateEyeRecommendation() below), because (a) that is
   * the branch that correctly returns 0.00 for a bare zero rather than
   * forcing +1.00, and (b) after transposition the CYL sign is always zero
   * or negative, so "minus" is the only branch a zero-sphere,
   * nonzero-cylinder case can consistently mean going forward.
   *
   * @param {{sphere: number, cylinder: number, axis: number|null, add: number|null}} original
   * @returns {object} normalized prescription record, see module docstring at top of file for shape
   */
  function normalizePrescription(original) {
    var transposed = transposeToMinusCylinder(original);
    var band = getCylinderBand(transposed.cylinder);
    var isPlano = Math.abs(transposed.sphere) < EPSILON && Math.abs(transposed.cylinder) < EPSILON;

    return {
      original: {
        sphere: original.sphere,
        cylinder: original.cylinder,
        axis: original.axis,
        add: original.add
      },
      normalized: {
        sphere: transposed.sphere,
        cylinder: transposed.cylinder,
        axis: transposed.axis,
        add: original.add,
        cylinderBand: band,
        isPlano: isPlano
      }
    };
  }

  // ==========================================================================
  // OCEANS OPTICS EMPIRICAL RECOMMENDATION LOGIC
  // ----------------------------------------------------------------------
  // PRESERVED, NOT REDESIGNED. Every branch below is transcribed exactly
  // from James's confirmed current canonical live calculator behavior
  // (see content-development/research/LENS-CALCULATOR-SOURCE-OF-TRUTH.md).
  // This is Oceans Optics' own empirically validated methodology. Do not
  // alter these rules to "fix", "simplify", or "re-derive" them.
  //
  // IMPORTANT ARCHITECTURAL NOTE: because prescription normalization
  // (above) always produces a CYL value that is zero or negative, the
  // "plus CYL sign" branches below are unreachable when calcOne() is
  // invoked through the normal normalize -> recommend pipeline. They are
  // preserved verbatim (not deleted) so this file remains a faithful,
  // complete transcription of the confirmed algorithm, and so that a
  // caller who has independent reason to invoke calcOne() directly with a
  // positive CYL (e.g. a regression test proving nothing was altered) still
  // gets the original, unmodified behavior. This is an intentional
  // consequence of fixing the input-interpretation problem, not an
  // accidental behavior change — see "Equivalence Requirement" in the
  // accompanying test suite.
  // ==========================================================================

  /**
   * Snaps a non-negative value to the nearest half-diopter (0.5) step,
   * honoring a rounding bias. Transcribed exactly from the confirmed
   * calculator (both existing implementations agree on this function).
   *
   * @param {number} x
   * @param {"weaker"|"stronger"|"nearest"} bias
   * @returns {number}
   */
  function snapToHalf(x, bias) {
    var down = Math.floor(x * 2 + EPSILON) / 2;
    var up = Math.ceil(x * 2 - EPSILON) / 2;
    if (Math.abs(x - down) < EPSILON) return down;
    if (bias === "weaker") return down;
    if (bias === "stronger") return up;
    var dDown = Math.abs(x - down);
    var dUp = Math.abs(up - x);
    return dDown <= dUp ? down : up;
  }

  /**
   * The confirmed canonical per-eye empirical recommendation calculation.
   * Operates on a SPH magnitude, a farsighted/nearsighted flag, a CYL band,
   * and a CYL-sign flag — exactly the inputs the original calcOne()
   * implementations took, just supplied here from a normalized prescription
   * rather than from raw band/sign form controls.
   *
   * @param {number} sphereMagnitude - non-negative SPH magnitude
   * @param {boolean} isFar - true for farsighted (plus SPH), false for nearsighted (minus SPH)
   * @param {string} cylBand - one of the CYL_BAND_* constants
   * @param {boolean} isCylMinus - true if CYL sign is minus (always true post-normalization when cylBand != "none")
   * @returns {string} formatted recommendation, e.g. "+2.00", "-3.50", "0.00"
   */
  function calcOne(sphereMagnitude, isFar, cylBand, isCylMinus) {
    var val = Math.max(0, Number(sphereMagnitude || 0));

    if (isFar) {
      if (Math.abs(val - 0.50) < 1e-6 || Math.abs(val - 0.75) < 1e-6) {
        if (!isCylMinus && cylBand !== CYL_BAND_NONE) {
          return "+1.00";
        }
        return "0.00";
      }

      var result;

      if (cylBand === CYL_BAND_NONE || cylBand === CYL_BAND_LOW) {
        result = Math.floor(val + EPSILON);
        if (result === 0) result = 1;
      } else if (cylBand === CYL_BAND_MEDIUM) {
        result = isCylMinus ? Math.floor(val + EPSILON) : Math.ceil(val - EPSILON);
      } else if (cylBand === CYL_BAND_HIGH) {
        result = Math.round(val);
      } else {
        // very-high
        result = isCylMinus ? Math.round(Math.max(0, val - 0.75)) : Math.round(val + 0.75);
      }

      if (result > 5.00) result = 5.00;
      if (result > 0 && result < 1.00) result = 1.00;
      if (result === 0) return "0.00";
      return "+" + result.toFixed(2);
    }

    // Nearsighted / minus SPH.
    var targetAbs = val;
    var bias = "nearest";

    if (cylBand === CYL_BAND_NONE || cylBand === CYL_BAND_LOW) {
      var whole = Math.floor(val + EPSILON);
      var frac = Math.round((val - whole) * 100) / 100;
      var reduce = (Math.abs(frac - 0.25) < 1e-6 || Math.abs(frac - 0.75) < 1e-6) ? 0.25 : 0.50;
      targetAbs = Math.max(0, val - reduce);
      bias = "weaker";
    } else if (cylBand === CYL_BAND_MEDIUM) {
      if (isCylMinus) {
        targetAbs = val;
        bias = "nearest";
      } else {
        targetAbs = Math.max(0, val - 0.50);
        bias = "weaker";
      }
    } else if (cylBand === CYL_BAND_HIGH) {
      // Confirmed canonical (2026-08-28): sign-independent, always "nearest".
      targetAbs = val;
      bias = "nearest";
    } else {
      // very-high
      if (isCylMinus) {
        targetAbs = val + 0.75;
        bias = "nearest";
      } else {
        targetAbs = Math.max(0, val - 0.75);
        bias = "nearest";
      }
    }

    if ((cylBand === CYL_BAND_HIGH || cylBand === CYL_BAND_VERY_HIGH) && val <= 0.75 && val > 0) {
      return "-1.00";
    }

    var recAbs = snapToHalf(targetAbs, bias);
    if (recAbs > 9.00) recAbs = 9.00;
    if (recAbs > 0 && recAbs < 1.00) recAbs = 1.00;
    return recAbs === 0 ? "0.00" : "-" + recAbs.toFixed(2);
  }

  /**
   * Runs the empirical recommendation for one already-normalized eye,
   * including the TRUE PLANO short-circuit that bypasses calcOne()
   * entirely (see normalizePrescription() docstring).
   *
   * @param {object} normalizedEye - the `.normalized` object from normalizePrescription()
   * @returns {string} formatted recommendation
   */
  function calculateEmpiricalRecommendation(normalizedEye) {
    if (normalizedEye.isPlano) {
      return "0.00";
    }

    var sphere = normalizedEye.sphere;
    var isFar = sphere > 0;
    var sphereMagnitude = Math.abs(sphere);
    var cylBand = normalizedEye.cylinderBand;
    // Post-normalization CYL is always <= 0; "none" band has no sign to
    // speak of, and every other band is, by construction, minus.
    var isCylMinus = true;

    return calcOne(sphereMagnitude, isFar, cylBand, isCylMinus);
  }

  // ==========================================================================
  // PER-EYE / PER-PAIR ORCHESTRATION
  // ==========================================================================

  /**
   * Full pipeline for one eye: parse -> validate -> normalize -> recommend.
   *
   * @param {{sphere: string, cylinder: string, axis: string, add: string}} rawEyeInput
   * @param {string} eyeLabel
   * @returns {{valid: boolean, errors: string[], normalized: object|null, recommendation: string|null, addNotice: boolean}}
   */
  function calculateEyeRecommendation(rawEyeInput, eyeLabel) {
    var parsed = parsePrescription(rawEyeInput);
    var validation = validatePrescription(parsed, eyeLabel);

    if (!validation.valid) {
      return { valid: false, errors: validation.errors, normalized: null, recommendation: null, addNotice: false };
    }

    var prescription = normalizePrescription({
      sphere: parsed.sphere,
      cylinder: parsed.cylinder,
      axis: parsed.axis,
      add: parsed.add
    });

    var recommendation = calculateEmpiricalRecommendation(prescription.normalized);
    var addNotice = parsed.add !== null && !isNaN(parsed.add) && parsed.add !== 0;

    return {
      valid: true,
      errors: [],
      normalized: prescription.normalized,
      original: prescription.original,
      recommendation: recommendation,
      addNotice: addNotice
    };
  }

  /**
   * Full pipeline for both eyes. Each eye is calculated completely
   * independently — there is no mixed-sign (nearsighted + farsighted)
   * rejection at this layer, matching the confirmed canonical calculator's
   * behavior. Any product-catalog-availability check (whether a physical
   * mask SKU exists for a given pair of results) is a separate, later
   * concern outside this module's responsibility.
   *
   * @param {object} rawRightInput
   * @param {object} rawLeftInput
   * @returns {{right: ReturnType<typeof calculateEyeRecommendation>, left: ReturnType<typeof calculateEyeRecommendation>, valid: boolean, errors: string[]}}
   */
  function calculatePrescriptionPair(rawRightInput, rawLeftInput) {
    var right = calculateEyeRecommendation(rawRightInput, "Right (OD)");
    var left = calculateEyeRecommendation(rawLeftInput, "Left (OS)");
    var errors = [].concat(right.errors, left.errors);
    return { right: right, left: left, valid: right.valid && left.valid, errors: errors };
  }

  // ==========================================================================
  // FORMATTING
  // ==========================================================================

  /**
   * Formats a numeric lens-strength value as the standard signed string.
   * (calcOne() already returns pre-formatted strings; this helper exists
   * for callers formatting a raw number, e.g. in UI code or tests.)
   *
   * @param {number} value
   * @returns {string}
   */
  function formatLensStrength(value) {
    if (Math.abs(value) < EPSILON) return "0.00";
    var sign = value > 0 ? "+" : "-";
    return sign + Math.abs(value).toFixed(2);
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  return {
    VERSION: "4.0.0",
    CYL_BAND_NONE: CYL_BAND_NONE,
    CYL_BAND_LOW: CYL_BAND_LOW,
    CYL_BAND_MEDIUM: CYL_BAND_MEDIUM,
    CYL_BAND_HIGH: CYL_BAND_HIGH,
    CYL_BAND_VERY_HIGH: CYL_BAND_VERY_HIGH,

    parsePrescription: parsePrescription,
    validatePrescription: validatePrescription,
    normalizeAxisValue: normalizeAxisValue,
    transposeToMinusCylinder: transposeToMinusCylinder,
    getCylinderBand: getCylinderBand,
    normalizePrescription: normalizePrescription,
    snapToHalf: snapToHalf,
    calcOne: calcOne,
    calculateEmpiricalRecommendation: calculateEmpiricalRecommendation,
    calculateEyeRecommendation: calculateEyeRecommendation,
    calculatePrescriptionPair: calculatePrescriptionPair,
    formatLensStrength: formatLensStrength
  };
});
