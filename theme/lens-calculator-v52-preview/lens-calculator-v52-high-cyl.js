/*
 * Experimental high-cylinder comparison for the isolated preview.
 * Consumes V5.3 results and delegates both strategy calculations to V5.3's
 * shared recommendation pipeline. Historical V5.2 remains untouched.
 */
(function (root, factory) {
  "use strict";

  var v53 = typeof module === "object" && module.exports
    ? require("./lens-calculator-v53.js")
    : root.OOLensCalculatorV53;
  if (!v53) throw new Error("The high-cylinder preview requires the V5.3 calculator.");

  var api = factory(v53);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.OOV52HighCylinder = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (V53) {
  "use strict";

  var EPSILON = 1e-9;
  var HIGH_CYL_THRESHOLD = 3;
  var STRATEGY_BALANCED = "balanced";
  var STRATEGY_CLOSER_TO_SPH = "closer_to_sph";

  function formatPower(power) {
    if (Math.abs(power) < EPSILON) return "0.00";
    return (power > 0 ? "+" : "-") + Math.abs(power).toFixed(2);
  }

  function balancedPowerFor(result) {
    var rawPower = result && result.finalStockPower;
    var power = rawPower === null || rawPower === undefined ? NaN : Number(rawPower);
    var rawRecommendation = result && result.recommendation;
    if (!Number.isFinite(power)) {
      power = rawRecommendation === null || rawRecommendation === undefined
        ? NaN
        : Number(rawRecommendation);
    }
    return Number.isFinite(power) ? power : null;
  }

  function continuousTargetTowardZero(base) {
    return V53.computeContinuousTarget(base);
  }

  function stockPowersFor(base, balancedPower) {
    var refractiveSide = Math.abs(base) < EPSILON ? balancedPower : base;
    return refractiveSide < 0
      ? V53.V53_CONFIG.myopiaAvailablePowers
      : V53.V53_CONFIG.hyperopiaAvailablePowers;
  }

  function nearestStockTowardZero(target, availablePowers) {
    return V53.directionalStockPowerTowardZero(target, availablePowers);
  }

  function unchangedEye(result) {
    var balancedPower = balancedPowerFor(result);
    return {
      triggered: false,
      unchanged: true,
      available: balancedPower !== null,
      original: result && result.original || null,
      normalized: result && result.normalized || null,
      sphericalEquivalent: result && result.sphericalEquivalent,
      cylinderMagnitude: result && result.cylinderMagnitude,
      balancedPower: balancedPower,
      balancedRecommendation: result && result.recommendation || null,
      quarterCylinderBase: null,
      alternativeTarget: null,
      alternativePower: balancedPower,
      alternativeRecommendation: result && result.recommendation || null,
      differenceFromBalanced: 0,
      absoluteDifference: 0,
      sameAsBalanced: true,
      alternativeNote: "Unchanged",
      tieCandidates: null
    };
  }

  function calculateEyeAlternative(result) {
    if (!result || !result.valid || !result.normalized) return unchangedEye(result);

    var cylinderMagnitude = Math.abs(Number(result.normalized.cylinder));
    if (cylinderMagnitude < HIGH_CYL_THRESHOLD - EPSILON) return unchangedEye(result);

    var balancedPower = balancedPowerFor(result);
    if (balancedPower === null) {
      var unavailable = unchangedEye(result);
      unavailable.triggered = true;
      unavailable.unchanged = false;
      unavailable.available = false;
      return unavailable;
    }

    var normalizedSphere = Number(result.normalized.sphere);
    var normalizedCylinder = Number(result.normalized.cylinder);
    var strategies = V53.computeStrategyRecommendationsV53(normalizedSphere, normalizedCylinder);
    var closerToSph = strategies.closerToSph;
    var quarterCylinderBase = closerToSph.reference;
    var alternativeResult = closerToSph.recommendation;
    var alternativeTarget = alternativeResult.preSnapTarget;
    var alternativePower = alternativeResult.finalPower;
    if (alternativePower === null || alternativePower === undefined) {
      var unresolved = unchangedEye(result);
      unresolved.triggered = true;
      unresolved.unchanged = false;
      unresolved.available = false;
      unresolved.quarterCylinderBase = quarterCylinderBase;
      unresolved.alternativeTarget = alternativeTarget;
      unresolved.alternativePower = null;
      unresolved.alternativeRecommendation = null;
      unresolved.stockStatus = alternativeResult.stockStatus;
      return unresolved;
    }

    var difference = alternativePower - balancedPower;
    var sameAsBalanced = Math.abs(difference) < EPSILON;

    return {
      triggered: true,
      unchanged: false,
      available: true,
      original: result.original,
      normalized: result.normalized,
      sphericalEquivalent: result.sphericalEquivalent,
      cylinderMagnitude: cylinderMagnitude,
      balancedPower: balancedPower,
      balancedRecommendation: result.recommendation,
      quarterCylinderBase: quarterCylinderBase,
      alternativeTarget: alternativeTarget,
      alternativePower: alternativePower,
      alternativeRecommendation: formatPower(alternativePower),
      differenceFromBalanced: difference,
      absoluteDifference: Math.abs(difference),
      sameAsBalanced: sameAsBalanced,
      alternativeNote: sameAsBalanced ? "Same lens" : null,
      tieCandidates: null,
      stockCandidates: alternativeResult.stockCandidates,
      rejectedStrongerCandidates: alternativeResult.rejectedStrongerCandidates,
      balancedDistanceFromSphere: Math.abs(balancedPower - normalizedSphere),
      alternativeDistanceFromSphere: Math.abs(alternativePower - normalizedSphere)
    };
  }

  function calculatePairAlternative(rightResult, leftResult) {
    var right = calculateEyeAlternative(rightResult);
    var left = calculateEyeAlternative(leftResult);
    var triggered = right.triggered || left.triggered;

    return {
      triggered: triggered,
      available: triggered && right.available && left.available,
      eyes: { right: right, left: left },
      balanced: {
        right: right.balancedRecommendation,
        left: left.balancedRecommendation
      },
      alternative: {
        right: right.alternativeRecommendation,
        left: left.alternativeRecommendation
      }
    };
  }

  function recommendationSelection(pair, strategy) {
    if (!pair || !pair.available) throw new Error("A complete high-cylinder comparison is required.");
    var selectedStrategy = strategy || STRATEGY_BALANCED;
    if (selectedStrategy !== STRATEGY_BALANCED && selectedStrategy !== STRATEGY_CLOSER_TO_SPH) {
      throw new Error("Unknown recommendation strategy.");
    }

    var selectedPair = selectedStrategy === STRATEGY_CLOSER_TO_SPH
      ? pair.alternative
      : pair.balanced;
    var right = Number(selectedPair.right);
    var left = Number(selectedPair.left);
    if (!Number.isFinite(right) || !Number.isFinite(left)) {
      throw new Error("The selected lens pair is unavailable.");
    }

    return {
      recommendationStrategy: selectedStrategy,
      recommendedRight: right,
      recommendedLeft: left,
      displayRight: selectedPair.right,
      displayLeft: selectedPair.left
    };
  }

  var STRATEGY_SUMMARY_NAMES = {};
  STRATEGY_SUMMARY_NAMES[STRATEGY_BALANCED] = "Balanced";
  STRATEGY_SUMMARY_NAMES[STRATEGY_CLOSER_TO_SPH] = "Closer to your SPH";

  // Customer-facing summary of a recommendationSelection() result. Formatting
  // only: it uses the selection's own display values and calculates nothing.
  function selectionSummary(selection) {
    if (!selection || !Object.prototype.hasOwnProperty.call(STRATEGY_SUMMARY_NAMES, selection.recommendationStrategy)) return "";
    return "Selected: " + STRATEGY_SUMMARY_NAMES[selection.recommendationStrategy] +
      " \u2014 R " + selection.displayRight + " / L " + selection.displayLeft;
  }

  return {
    HIGH_CYL_THRESHOLD: HIGH_CYL_THRESHOLD,
    STRATEGY_BALANCED: STRATEGY_BALANCED,
    STRATEGY_CLOSER_TO_SPH: STRATEGY_CLOSER_TO_SPH,
    continuousTargetTowardZero: continuousTargetTowardZero,
    nearestStockTowardZero: nearestStockTowardZero,
    calculateEyeAlternative: calculateEyeAlternative,
    calculatePairAlternative: calculatePairAlternative,
    recommendationSelection: recommendationSelection,
    selectionSummary: selectionSummary
  };
});
