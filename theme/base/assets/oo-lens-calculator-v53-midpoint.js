/*
 * V5.3 recommendation-choice layer (file name kept for compatibility; it is
 * no longer midpoint-only).
 *
 * NOT a prescription formula. It reads the existing V5.3 per-eye results
 * unchanged and may offer ONE optional second lens pair next to the V5.3
 * primary ("balanced") pair:
 *
 *   sharper        For a myopic eye, the immediately adjacent stronger stocked
 *                  lens when it is at least as close to the SAME V5.3
 *                  underwater-adjusted value as the primary lens and is not
 *                  stronger than the eye's spherical equivalent. (The old
 *                  exact-midpoint case is the "equally close" instance.)
 *   closer_to_sph  Customer preference: per eye, the stocked lens closest to
 *                  the SPH the customer entered, never stronger than that SPH,
 *                  same sign as the primary lens and at most one stock
 *                  interval from it. Offered only when no Sharper pair exists.
 *
 * Sharper always takes priority; never more than two choices are offered.
 *
 * Default ranking (choice layer only; the V5.3 "balanced" result itself is
 * unchanged): the stocked option closest to the same V5.3 underwater-adjusted
 * values is recommended; on an exact tie the stronger valid lens wins because
 * it stays closer to the customer's prescription. Sharper is only offered when
 * it is at least as close as the primary pair, so a valid Sharper pair is
 * always presented first and selected by default as the "Closer Match", with
 * the primary pair offered as the "Softer Option". sharperStrictlyCloser only
 * changes the wording. Closer to your SPH and the high-CYL workflow always
 * default to the primary pair.
 *
 * The
 * high-CYL workflow (lens-calculator-v52-high-cyl.js) keeps its own Balanced /
 * Closer to your SPH pair and suppresses this layer. Every protected V5.3
 * pathway (invalid, manual review, plano crossover, plano gap at SE -1.00 or
 * weaker, low-minus choice, low-plus guard, any 0.00 result, high CYL) and a
 * mixed-sign pair suppress the choice for the whole OD/OS pair.
 *
 * The engine (lens-calculator-v53.js) is not modified and nothing here
 * recalculates a target, an adjustment, or a stock rule.
 *
 * The explanation helpers at the end build the shared "How we calculated your
 * mask lens" content (data + DOM) for both the Lens Calculator and the Product
 * Rx Checker, so the two surfaces never disagree.
 */
(function (root, factory) {
  "use strict";
  var v53 = typeof module === "object" && module.exports
    ? require("./lens-calculator-v53.js")
    : root.OOLensCalculatorV53;
  if (!v53) throw new Error("The V5.3 recommendation choice requires the V5.3 calculator.");
  var api = factory(v53);
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.OOV53MidpointChoice = api;
    root.OOV53RecommendationChoice = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (V53) {
  "use strict";

  var EPSILON = 1e-6;
  var STRATEGY_BALANCED = "balanced";
  var STRATEGY_SHARPER = "sharper";
  var STRATEGY_CLOSER_TO_SPH = "closer_to_sph";
  // Same threshold as the existing high-CYL Balanced / Closer to your SPH
  // workflow (lens-calculator-v52-high-cyl.js); either eye at or above it
  // keeps that workflow and never shows this choice.
  var HIGH_CYL_THRESHOLD = 3;
  var LOW_MINUS_CHOICE_RULE = "low-minus-choice";
  var PLANO_GAP_RULE = "plano-to-first-minus-gap";
  // The engine's protected low-minus zone ends at an SE of -1.00 (its weakest
  // minus lens). An eye with a stronger SE that lands in the plano-to-first-
  // minus gap (e.g. SE -1.25, target -0.75 -> -1.00) follows the normal V5.3
  // rule: it keeps its own lens and does not block the other eye's choice.
  var LOW_MINUS_SE_LIMIT = -1;
  // The engine's low-plus guard decides SE up to +1.00 (its weakest plus lens).
  var LOW_PLUS_SE_LIMIT = 1;

  function formatPower(power) {
    if (Math.abs(power) < EPSILON) return "0.00";
    return (power > 0 ? "+" : "-") + Math.abs(power).toFixed(2);
  }

  function finite(value) {
    var number = value === null || value === undefined || value === "" ? NaN : Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function sign(value) {
    if (Math.abs(value) < EPSILON) return 0;
    return value < 0 ? -1 : 1;
  }

  function catalogFor(se, options) {
    var settings = options || {};
    if (se < 0) return settings.myopiaPowers || V53.V53_CONFIG.myopiaAvailablePowers;
    return settings.hyperopiaPowers || V53.V53_CONFIG.hyperopiaAvailablePowers;
  }

  // Corrective (non-zero) stock powers on one side of zero, weakest first.
  function correctiveStock(catalog, side) {
    return catalog
      .filter(function (power) { return sign(power) === side; })
      .slice()
      .sort(function (a, b) { return Math.abs(a) - Math.abs(b); });
  }

  // Why an eye's existing result must stay exactly as it is (null = ordinary).
  function protectedReason(result, highCylinderThreshold) {
    if (!result || result.valid !== true) return "invalid";
    if (result.manualReview === true) return "manual_review";
    if (result.stockStatus !== "OK" || !result.recommendation) return "review";
    if (Number(result.cylinderMagnitude) >= highCylinderThreshold - EPSILON) return "high_cylinder";
    if (result.lowMinusChoice === true || result.stockRule === LOW_MINUS_CHOICE_RULE) return "low_minus_or_plano_gap";
    var se = finite(result.sphericalEquivalent);
    if (result.stockRule === PLANO_GAP_RULE) {
      if (se === null || se >= LOW_MINUS_SE_LIMIT - EPSILON) return "low_minus_or_plano_gap";
    }
    if (Array.isArray(result.planoCrossoverCandidates) && result.planoCrossoverCandidates.length) return "plano_crossover";
    if (se !== null && se > EPSILON && se <= LOW_PLUS_SE_LIMIT + EPSILON) return "low_plus";
    var power = finite(result.finalStockPower);
    if (power === null) return "review";
    if (Math.abs(power) < EPSILON) return "plano";
    return null;
  }

  /**
   * One eye, Sharper. Uses only the existing result's preSnapTarget,
   * finalStockPower, sphericalEquivalent and the stock catalog for that side.
   * (Name kept for compatibility with existing callers.)
   */
  function eyeMidpointAlternative(result, options) {
    var threshold = options && options.highCylinderThreshold || HIGH_CYL_THRESHOLD;
    var balancedPower = finite(result && result.finalStockPower);
    var base = { balancedPower: balancedPower, alternativePower: null, midpoint: false };
    var reason = protectedReason(result, threshold);
    if (reason) return Object.assign(base, { protected: true, reason: reason });

    var target = finite(result.preSnapTarget);
    var se = finite(result.sphericalEquivalent);
    if (target === null || se === null) return Object.assign(base, { protected: true, reason: "review" });
    // Farsighted primaries already use nearest stock with a stronger-lens tie.
    if (!(balancedPower < 0) || !(se < 0)) return Object.assign(base, { protected: false, reason: "not_myopic" });

    var primaryDistance = Math.abs(balancedPower - target);
    if (primaryDistance < EPSILON) return Object.assign(base, { protected: false, reason: "exact_stock" });

    // The immediately adjacent stronger stocked lens (actual stock, not +/-0.50).
    var stronger = correctiveStock(catalogFor(se, options), -1).filter(function (power) {
      return Math.abs(power) > Math.abs(balancedPower) + EPSILON;
    })[0];
    if (stronger === undefined) return Object.assign(base, { protected: false, reason: "no_stronger_stock" });

    var strongerDistance = Math.abs(stronger - target);
    var equallyClose = Math.abs(strongerDistance - primaryDistance) < EPSILON;
    if (strongerDistance > primaryDistance + EPSILON) {
      return Object.assign(base, { protected: false, reason: "primary_is_closer" });
    }
    if (Math.abs(stronger) > Math.abs(se) + EPSILON) {
      return Object.assign(base, { protected: false, midpoint: equallyClose, reason: "exceeds_spherical_equivalent" });
    }
    return Object.assign(base, {
      protected: false,
      midpoint: equallyClose,
      reason: equallyClose ? "midpoint" : "closer_to_target",
      alternativePower: stronger,
      primaryDistance: primaryDistance,
      alternativeDistance: strongerDistance
    });
  }

  function primaryPowers(rightResult, leftResult) {
    return [finite(rightResult && rightResult.finalStockPower), finite(leftResult && leftResult.finalStockPower)];
  }

  function isMixedSign(rightResult, leftResult) {
    var powers = primaryPowers(rightResult, leftResult);
    return powers[0] !== null && powers[1] !== null && sign(powers[0]) * sign(powers[1]) < 0;
  }

  function pairOf(rightPower, leftPower) {
    return {
      rightPower: rightPower,
      leftPower: leftPower,
      right: formatPower(rightPower),
      left: formatPower(leftPower)
    };
  }

  // Shared pair-level gate. Returns the unavailable reason, or null.
  function pairGate(right, left, rightResult, leftResult, settings) {
    if (settings.highCylinderTriggered === true) return "high_cylinder_workflow";
    if (right.protected) return "right_" + right.reason;
    if (left.protected) return "left_" + left.reason;
    if (isMixedSign(rightResult, leftResult)) return "mixed_sign";
    return null;
  }

  /**
   * Whole OD/OS pair, Sharper. Available only when no eye is in a protected
   * pathway, the high-CYL workflow is not triggered, the pair is not mixed
   * sign, and at least one eye has a valid Sharper lens. An eye without one
   * keeps its primary value. (Name kept for compatibility.)
   */
  function calculatePairMidpointChoice(rightResult, leftResult, options) {
    var settings = options || {};
    var right = eyeMidpointAlternative(rightResult, settings);
    var left = eyeMidpointAlternative(leftResult, settings);
    var unavailable = function (reason) {
      return { available: false, reason: reason, eyes: { right: right, left: left } };
    };
    var gate = pairGate(right, left, rightResult, leftResult, settings);
    if (gate) return unavailable(gate);
    if (right.alternativePower === null && left.alternativePower === null) return unavailable("no_midpoint_alternative");

    var sharperRight = right.alternativePower !== null ? right.alternativePower : right.balancedPower;
    var sharperLeft = left.alternativePower !== null ? left.alternativePower : left.balancedPower;
    // Every Sharper eye is at least as close as its primary lens and an eye
    // without one is unchanged, so the pair is strictly closer exactly when
    // one Sharper eye is strictly closer; otherwise it is an exact tie, which
    // the stronger (closer to prescription) pair also wins.
    var strictlyCloser = right.reason === "closer_to_target" || left.reason === "closer_to_target";
    return {
      available: true,
      reason: "sharper",
      eyes: { right: right, left: left },
      balanced: pairOf(right.balancedPower, left.balancedPower),
      sharper: pairOf(sharperRight, sharperLeft),
      sharperStrictlyCloser: strictlyCloser,
      defaultStrategy: STRATEGY_SHARPER
    };
  }

  /**
   * One eye, Closer to your SPH (customer preference). The stocked lens closest
   * to the SPH the customer entered, chosen only from lenses that are the same
   * sign as the primary lens and not stronger than that SPH (so an exact tie
   * can never resolve away from zero). Unchanged when the entered SPH is plano
   * or the opposite sign, or when the lens is more than one stock interval from
   * the primary lens.
   */
  function eyeCloserToSphPreference(result, options) {
    var threshold = options && options.highCylinderThreshold || HIGH_CYL_THRESHOLD;
    var balancedPower = finite(result && result.finalStockPower);
    var base = { balancedPower: balancedPower, alternativePower: null };
    var reason = protectedReason(result, threshold);
    if (reason) return Object.assign(base, { protected: true, reason: reason });

    var se = finite(result.sphericalEquivalent);
    var sphere = finite(result.original && result.original.sphere);
    if (se === null || sphere === null) return Object.assign(base, { protected: true, reason: "review" });
    var side = sign(balancedPower);
    if (sign(sphere) !== side) return Object.assign(base, { protected: false, reason: "sph_other_sign", sphere: sphere });

    var stock = correctiveStock(catalogFor(se, options), side);
    var eligible = stock.filter(function (power) { return Math.abs(power) <= Math.abs(sphere) + EPSILON; });
    if (!eligible.length) return Object.assign(base, { protected: false, reason: "no_stock_within_sph", sphere: sphere });
    var closest = eligible.reduce(function (best, power) {
      var distance = Math.abs(power - sphere);
      var bestDistance = Math.abs(best - sphere);
      if (distance < bestDistance - EPSILON) return power;
      if (Math.abs(distance - bestDistance) < EPSILON && Math.abs(power) < Math.abs(best)) return power;
      return best;
    });
    if (Math.abs(closest - balancedPower) < EPSILON) {
      return Object.assign(base, { protected: false, reason: "same_as_primary", sphere: sphere });
    }
    var steps = Math.abs(stock.indexOf(closest) - stock.indexOf(balancedPower));
    if (stock.indexOf(balancedPower) === -1 || steps > 1) {
      return Object.assign(base, { protected: false, reason: "more_than_one_interval", sphere: sphere, candidatePower: closest });
    }
    return Object.assign(base, {
      protected: false,
      reason: "closer_to_sph",
      sphere: sphere,
      alternativePower: closest,
      stockSteps: steps
    });
  }

  function calculatePairCloserToSphPreference(rightResult, leftResult, options) {
    var settings = options || {};
    var right = eyeCloserToSphPreference(rightResult, settings);
    var left = eyeCloserToSphPreference(leftResult, settings);
    var unavailable = function (reason) {
      return { available: false, reason: reason, eyes: { right: right, left: left } };
    };
    var gate = pairGate(right, left, rightResult, leftResult, settings);
    if (gate) return unavailable(gate);
    if (right.alternativePower === null && left.alternativePower === null) return unavailable("no_closer_to_sph_alternative");
    var altRight = right.alternativePower !== null ? right.alternativePower : right.balancedPower;
    var altLeft = left.alternativePower !== null ? left.alternativePower : left.balancedPower;
    return {
      available: true,
      reason: "closer_to_sph",
      eyes: { right: right, left: left },
      balanced: pairOf(right.balancedPower, left.balancedPower),
      closerToSph: pairOf(altRight, altLeft)
    };
  }

  /**
   * The one optional second recommendation for an ordinary (non-high-CYL)
   * pair: Sharper when available, otherwise Closer to your SPH, otherwise none.
   */
  function calculatePairRecommendationChoice(rightResult, leftResult, options) {
    var settings = options || {};
    var sharper = calculatePairMidpointChoice(rightResult, leftResult, settings);
    if (sharper.available) {
      return {
        available: true,
        reason: "sharper",
        alternativeStrategy: STRATEGY_SHARPER,
        defaultStrategy: sharper.defaultStrategy,
        sharperStrictlyCloser: sharper.sharperStrictlyCloser,
        eyes: sharper.eyes,
        balanced: sharper.balanced,
        alternative: sharper.sharper,
        sharper: sharper.sharper
      };
    }
    var closer = calculatePairCloserToSphPreference(rightResult, leftResult, settings);
    if (closer.available) {
      return {
        available: true,
        reason: "closer_to_sph",
        alternativeStrategy: STRATEGY_CLOSER_TO_SPH,
        defaultStrategy: STRATEGY_BALANCED,
        sharperStrictlyCloser: false,
        eyes: closer.eyes,
        balanced: closer.balanced,
        alternative: closer.closerToSph,
        closerToSph: closer.closerToSph
      };
    }
    return { available: false, reason: closer.reason === "no_closer_to_sph_alternative" ? "no_alternative" : closer.reason, eyes: closer.eyes };
  }

  // The strategy presented first and selected by default for a choice.
  function defaultStrategyOf(choice) {
    return choice && choice.available && choice.defaultStrategy === STRATEGY_SHARPER
      ? STRATEGY_SHARPER
      : STRATEGY_BALANCED;
  }

  // Same shape as the high-CYL recommendationSelection(). Accepts a Sharper
  // (midpoint) choice or a calculatePairRecommendationChoice() result. With no
  // strategy it returns the choice's default (Sharper when strictly closer).
  function recommendationSelection(choice, strategy) {
    if (!choice || !choice.available) throw new Error("A valid recommendation choice is required.");
    var alternativeStrategy = choice.alternativeStrategy || STRATEGY_SHARPER;
    var selected = strategy || defaultStrategyOf(choice);
    if (selected !== STRATEGY_BALANCED && selected !== alternativeStrategy) {
      throw new Error("Unknown recommendation strategy.");
    }
    var alternative = choice.alternative || choice.sharper;
    var pair = selected === STRATEGY_BALANCED ? choice.balanced : alternative;
    return {
      recommendationStrategy: selected,
      recommendedRight: pair.rightPower,
      recommendedLeft: pair.leftPower,
      displayRight: pair.right,
      displayLeft: pair.left
    };
  }

  // --------------------------------------------------------------------------
  // CUSTOMER-FACING COPY (no em dashes; shared by both storefront surfaces).
  // --------------------------------------------------------------------------

  var COPY = {
    recommendedBadge: "Recommended",
    balancedTitle: "Comfort / Balanced Vision",
    balancedCopy: "Designed around our calculated underwater-adjusted strength. This option prioritises comfortable, balanced underwater vision.",
    sharperTitle: "Sharper / Closer to Your Prescription",
    sharperCopy: "This stocked lens sits closer to your calculated underwater-adjusted strength than the softer option. It may provide more distance detail while remaining within your overall calculated prescription strength.",
    // Sharper strictly closer: presented first and selected by default.
    closerMatchTitle: "Closer Match",
    closerMatchCopy: "The closest stocked match to your calculated underwater strength.",
    closerMatchTieCopy: "Equally close to your calculated underwater strength, and closer to your prescription.",
    softerTitle: "Softer Option",
    softerCopy: "A slightly softer correction if you prefer a more relaxed underwater feel.",
    closerTitle: "Closer to Your SPH",
    closerCopy: "This option stays closer to the SPH number printed on your prescription.",
    closerStronger: "It is stronger than our calculated underwater recommendation.",
    closerWeaker: "It is weaker than our calculated underwater recommendation.",
    closerMixed: "It is stronger than our calculated underwater recommendation for one eye and weaker for the other.",
    strongerThanSeNotice: "This option is also stronger than the spherical-equivalent estimate for this eye. It may feel over-corrected or cause visual fatigue for some people, particularly during longer dives or snorkelling sessions.",
    suggestedTitle: "Suggested Lens Strength",
    singleTitle: "Your lens strength",
    choiceIntro: "Switch between the options to see which masks are available with each lens choice.",
    checkerChoiceIntro: "Choose the option you'd like us to use for this mask.",
    highCylIntro: "Your prescription has higher astigmatism. A sphere-only mask lens cannot reproduce SPH, CYL and Axis separately, so there are two practical ways we can approximate your prescription. Choose the approach you prefer.",
    highCylBalancedTitle: "Balanced",
    highCylBalancedCopy: "Uses your SPH and CYL together to estimate your overall prescription strength.",
    highCylCloserTitle: "Closer to Your SPH",
    highCylCloserCopy: "Stays closer to the SPH number printed on your prescription, using less of the CYL adjustment.",
    explainerTitle: "How we calculated your mask lens",
    checkerExplainerTitle: "How we calculated your lens strength",
    explainerIntro: "Your glasses prescription can correct Sphere (SPH), Cylinder (CYL) and Axis. Prescription mask lenses are sphere-only, so we work out a sphere-only strength, adjust it for underwater viewing and then select a stocked lens.",
    whyTitle: "Why is my mask lens different from my SPH?",
    whyBody: [
      "Your SPH is only one part of your prescription. We also account for your CYL to calculate an overall sphere-only correction, then adjust that value for the magnification effect experienced underwater.",
      "This gives us an underwater-adjusted strength that we can match to the prescription lenses available for your mask.",
      "Rather than simply copying the SPH from your glasses prescription, we account for SPH, CYL and underwater viewing to find the most suitable mask lens."
    ],
    step1Title: "Your glasses prescription",
    step2Title: "Calculate your overall sphere-only strength",
    step2Label: "Spherical Equivalent",
    step2Formula: "SPH + (CYL ÷ 2)",
    step2Copy: "Your prescription includes both SPH and CYL. Because prescription mask lenses are sphere-only, we calculate the spherical equivalent by adding half of your CYL to your SPH. This gives us a practical sphere-only starting point.",
    step2NoCylCopy: "Your prescription has no CYL for this eye, so your overall sphere-only strength is simply your SPH.",
    step2Tooltip: "Technically, the spherical equivalent is the midpoint between the two principal focusing powers of your prescription.",
    step2QuarterTitle: "Calculate a sphere-only strength closer to your SPH",
    step2QuarterLabel: "Closer to Your SPH approach",
    step2QuarterFormula: "SPH + (CYL ÷ 4)",
    step2QuarterCopy: "You chose the approach that stays closer to your SPH, so we add a quarter of your CYL to your SPH instead of half.",
    step3Title: "Adjust for underwater viewing",
    step3Label: "Underwater-adjusted strength",
    step3Copy: "We then move the calculated strength 0.50 D toward zero for underwater use.",
    step3Why: "Objects appear larger and closer when viewed underwater through a dive mask, so using the full dry-land spherical equivalent can feel stronger than necessary.",
    step4Title: "Select your mask lens",
    step4Copy: "Our prescription lenses come in fixed strengths, so we select the appropriate stocked lens from your underwater-adjusted strength using our lens-selection rules.",
    step4Calculated: "Calculated underwater strength",
    step4Selected: "Selected mask lens",
    step4Recommended: "Recommended mask lens",
    step4Nearby: "Available nearby lenses",
    stepChoiceTitle: "Your chosen option"
  };

  // --------------------------------------------------------------------------
  // EXPLANATION DATA (pure; numbers come only from the engine results).
  // --------------------------------------------------------------------------

  // Exact value for equations: up to three decimals, at least two.
  function formatExact(value) {
    if (Math.abs(value) < EPSILON) return "0.00";
    var text = Math.abs(value).toFixed(3).replace(/0$/, "");
    return (value > 0 ? "+" : "-") + text;
  }

  function formatRounded(value) {
    if (Math.abs(value) < 0.005) return "0.00";
    return (value > 0 ? "+" : "-") + Math.abs(value).toFixed(2);
  }

  // Distance from a stock lens to the underwater strength AS DISPLAYED (two
  // decimals), so the figures a customer sees add up (-3.38 to -3.50 = 0.12).
  function distanceText(power, target) {
    return Math.abs(power - Number(formatRounded(target))).toFixed(2);
  }

  // Printed-value style for SPH/CYL in an equation, keeping the sign visible.
  function formatEquationTerm(value) {
    return formatRounded(value);
  }

  function stockRuleCopy(result) {
    var target = finite(result.preSnapTarget);
    var power = finite(result.finalStockPower);
    var se = finite(result.sphericalEquivalent);
    if (result.lowMinusChoice === true || result.stockRule === LOW_MINUS_CHOICE_RULE) {
      return "There is no lens between 0.00 and -1.00 D. For your underwater-adjusted strength we recommend -1.00, which keeps some correction. 0.00 is a softer option with less correction; contact us if you would prefer it.";
    }
    if (result.stockRule === PLANO_GAP_RULE || (target !== null && target < 0 && target > -1)) {
      return "There is no lens between 0.00 and -1.00 D. If the underwater-adjusted strength needs less than 0.50 D of correction we use 0.00; if it needs 0.50 D or more we use -1.00.";
    }
    if (se !== null && se > 0 && se <= LOW_PLUS_SE_LIMIT + EPSILON) {
      return power > 0
        ? "There is no lens between 0.00 and +1.00 D, so for this low farsighted prescription we use +1.00 rather than no correction."
        : "There is no lens between 0.00 and +1.00 D, and your calculated strength is small enough that no correction (0.00) is suggested.";
    }
    if (power !== null && target !== null && Math.abs(power - target) < EPSILON) {
      return "Your underwater-adjusted strength matches a stocked lens exactly, so we use that lens.";
    }
    if (power !== null && power < 0) {
      return "Nearsighted lenses come in 0.50 D steps. We select the closest stocked lens that is not stronger than your underwater-adjusted strength.";
    }
    if (power !== null && power > 0) {
      if (target !== null && Math.abs(Math.abs(power - target) - 0.5) < EPSILON) {
        return "Farsighted lenses come in 1.00 D steps. Your underwater-adjusted strength falls exactly halfway between two of them, so we use the stronger lens to retain more of your correction.";
      }
      return "Farsighted lenses come in 1.00 D steps, so we select the closest stocked lens.";
    }
    return "We select the stocked lens that best matches your underwater-adjusted strength.";
  }

  function strongerThan(power, reference) {
    return power !== null && reference !== null && sign(power) === sign(reference) &&
      Math.abs(power) > Math.abs(reference) + EPSILON;
  }

  /**
   * Per-eye explanation model.
   * context: { strategy, selectedPower, highCylinderEye (from the high-CYL
   *   pair, optional), choiceEye (from the recommendation choice, optional) }
   */
  function explainEye(result, context) {
    var settings = context || {};
    if (!result || result.valid !== true) return null;
    var original = result.original || {};
    var normalized = result.normalized || {};
    var sphere = finite(original.sphere);
    var cylinder = finite(original.cylinder) || 0;
    var axis = finite(original.axis);
    var se = finite(result.sphericalEquivalent);
    var target = finite(result.preSnapTarget);
    var primary = finite(result.finalStockPower);
    var strategy = settings.strategy || STRATEGY_BALANCED;
    var selected = finite(settings.selectedPower);
    if (selected === null) selected = primary;
    var highEye = settings.highCylinderEye;
    var quarter = strategy === STRATEGY_CLOSER_TO_SPH && highEye && highEye.triggered === true &&
      finite(highEye.quarterCylinderBase) !== null;

    var model = {
      sphere: sphere,
      cylinder: cylinder,
      axis: Math.abs(cylinder) < EPSILON ? null : axis,
      hasCylinder: Math.abs(cylinder) > EPSILON,
      prescriptionText: "SPH " + formatRounded(sphere) +
        (Math.abs(cylinder) > EPSILON ? "  CYL " + formatRounded(cylinder) + (axis ? "  Axis " + String(axis).padStart(3, "0") : "") : "  CYL 0.00"),
      method: quarter ? "quarter_cyl" : "spherical_equivalent",
      sphericalEquivalent: se,
      underwaterTarget: target,
      primaryPower: primary,
      selectedPower: selected,
      strategy: strategy,
      stockCopy: result.recommendation ? stockRuleCopy(result) : null
    };

    if (quarter) {
      var base = Number(highEye.quarterCylinderBase);
      var altTarget = finite(highEye.alternativeTarget);
      var nSphere = finite(normalized.sphere);
      var nCylinder = finite(normalized.cylinder);
      model.base = base;
      model.baseTarget = altTarget;
      model.equation = formatEquationTerm(nSphere) + " + (" + formatRounded(nCylinder) + " ÷ 4) = " + formatExact(base) + " D";
      model.transposed = Math.abs(nSphere - sphere) > EPSILON;
      model.normalizedText = "SPH " + formatRounded(nSphere) + "  CYL " + formatRounded(nCylinder);
    } else {
      model.base = se;
      model.baseTarget = target;
      model.equation = model.hasCylinder
        ? formatEquationTerm(sphere) + " + (" + formatRounded(cylinder) + " ÷ 2) = " + formatExact(se) + " D"
        : formatRounded(sphere) + " D";
    }
    model.baseRounded = formatRounded(model.base) + " D";
    model.baseTargetRounded = model.baseTarget === null ? null : formatRounded(model.baseTarget) + " D";
    model.underwaterStep = model.baseTarget === null ? null : formatRounded(model.base) + " → " + formatRounded(model.baseTarget);

    // The lens presented first for this eye: the Closer Match (Sharper) when
    // the choice defaults to it, otherwise the V5.3 primary lens.
    var recommended = finite(settings.recommendedPower);
    if (recommended === null || quarter) recommended = primary;
    var closerMatch = primary !== null && Math.abs(recommended - primary) > EPSILON && target !== null;
    model.recommendedPower = recommended;
    model.closerMatch = closerMatch;
    if (closerMatch) {
      model.nearbyLenses = [recommended, primary].map(function (power) {
        return { power: power, distance: distanceText(power, target) };
      });
      model.closerMatchTie = Math.abs(Math.abs(recommended - target) - Math.abs(primary - target)) < EPSILON;
      model.closerMatchCopy = model.closerMatchTie
        ? formatPower(recommended) + " and " + formatPower(primary) + " are equally close to your calculated underwater strength. " +
          formatPower(recommended) + " stays closer to your prescription, so it is recommended. " +
          formatPower(primary) + " remains available as a softer option."
        : formatPower(recommended) + " is the closer stocked match to your calculated underwater strength. " +
          formatPower(primary) + " remains available as a softer option.";
    }

    var differs = selected !== null && primary !== null && Math.abs(selected - primary) > EPSILON && !quarter;
    var differsFromRecommended = selected !== null && Math.abs(selected - recommended) > EPSILON && !quarter;
    model.differsFromPrimary = differs;
    model.differsFromRecommended = differsFromRecommended;
    model.strongerThanTarget = strongerThan(selected, quarter ? model.baseTarget : target);
    model.strongerThanSE = strongerThan(selected, se);
    model.strongerThanSph = strongerThan(selected, sphere);
    var defaultStrategy = settings.defaultStrategy || STRATEGY_BALANCED;
    if (differsFromRecommended) {
      var stronger = Math.abs(selected) > Math.abs(recommended);
      var choiceLines = [];
      if (strategy === STRATEGY_BALANCED && closerMatch) {
        choiceLines.push(
          "You chose the Softer Option. " + formatPower(selected) + " D is the next weaker stocked lens. It is " +
          distanceText(selected, target) + " D from your calculated underwater strength (" + formatRounded(target) +
          " D), while the Closer Match " + formatPower(recommended) + " D is " +
          (model.closerMatchTie ? "also " + distanceText(recommended, target) + " D away and closer to your prescription"
            : distanceText(recommended, target) + " D away") +
          ", so it gives a slightly softer correction."
        );
      } else if (strategy === STRATEGY_SHARPER) {
        choiceLines.push(
          "You chose the Sharper option. " + formatPower(selected) + " D is the next stronger stocked lens. It is " +
          distanceText(selected, target) + " D from your underwater-adjusted strength (" + formatRounded(target) +
          " D), while " + formatPower(primary) + " D is " + distanceText(primary, target) +
          " D away, and it is not stronger than your spherical equivalent (" + formatRounded(se) + " D)."
        );
      } else if (strategy === STRATEGY_CLOSER_TO_SPH) {
        choiceLines.push(
          "You chose Closer to Your SPH. " + formatPower(selected) + " D is the stocked lens closest to the SPH on your prescription (" +
          formatRounded(sphere) + ") without going beyond it."
        );
        choiceLines.push(stronger
          ? "It is stronger than your underwater-adjusted strength (" + formatRounded(target) + " D) and our recommended lens (" + formatPower(primary) + " D)."
          : "It is weaker than our recommended lens (" + formatPower(primary) + " D).");
      }
      model.choiceLines = choiceLines;
    } else if (selected !== null && primary !== null && strategy !== defaultStrategy && !quarter) {
      model.choiceLines = ["This eye keeps the same lens in the option you chose (" + formatPower(selected) + " D)."];
    }
    model.showSeNotice = model.strongerThanSE && (differs || quarter);
    return model;
  }

  // Short relation copy for an alternative card (pair level).
  function closerToSphRelation(choice) {
    if (!choice || !choice.eyes) return "";
    var directions = ["right", "left"].map(function (side) {
      var eye = choice.eyes[side];
      if (!eye || eye.alternativePower === null || eye.alternativePower === undefined) return 0;
      return Math.abs(eye.alternativePower) > Math.abs(eye.balancedPower) ? 1 : -1;
    }).filter(function (direction) { return direction !== 0; });
    if (!directions.length) return "";
    var stronger = directions.indexOf(1) !== -1;
    var weaker = directions.indexOf(-1) !== -1;
    if (stronger && weaker) return COPY.closerMixed;
    return stronger ? COPY.closerStronger : COPY.closerWeaker;
  }

  // Eyes for which the given pair is stronger than that eye's SE.
  function eyesStrongerThanSE(rightResult, leftResult, pair) {
    var sides = [];
    if (!pair) return sides;
    [["right", rightResult, pair.rightPower], ["left", leftResult, pair.leftPower]].forEach(function (entry) {
      var result = entry[1];
      var primary = finite(result && result.finalStockPower);
      var power = finite(entry[2]);
      if (primary !== null && power !== null && Math.abs(power - primary) > EPSILON &&
        strongerThan(power, finite(result.sphericalEquivalent))) sides.push(entry[0]);
    });
    return sides;
  }

  function seNoticeFor(sides) {
    if (!sides || !sides.length) return "";
    var who = sides.length === 2 ? "both eyes" : (sides[0] === "right" ? "your right eye (OD)" : "your left eye (OS)");
    return "For " + who + ": " + COPY.strongerThanSeNotice;
  }

  // Customer-facing title of one strategy within a choice.
  function strategyTitle(choice, strategy) {
    var closerMatch = defaultStrategyOf(choice) === STRATEGY_SHARPER;
    if (strategy === STRATEGY_SHARPER) return closerMatch ? COPY.closerMatchTitle : COPY.sharperTitle;
    if (strategy === STRATEGY_CLOSER_TO_SPH) return COPY.closerTitle;
    return closerMatch ? COPY.softerTitle : COPY.balancedTitle;
  }

  /**
   * The two option cards for an ordinary choice, recommended/default first.
   * Each: { strategy, title, badge (recommended only), copy, notice, pair,
   * recommended }. Shared by the Lens Calculator and the Product Rx Checker.
   */
  function choiceEntries(choice, rightResult, leftResult) {
    if (!choice || !choice.available) return [];
    var alternativeStrategy = choice.alternativeStrategy || STRATEGY_SHARPER;
    var alternative = choice.alternative || choice.sharper;
    var closerMatch = defaultStrategyOf(choice) === STRATEGY_SHARPER;
    var balancedCopy = closerMatch ? COPY.softerCopy : COPY.balancedCopy;
    var alternativeCopy = alternativeStrategy === STRATEGY_CLOSER_TO_SPH
      ? (COPY.closerCopy + " " + closerToSphRelation(choice)).trim()
      : (closerMatch ? (choice.sharperStrictlyCloser ? COPY.closerMatchCopy : COPY.closerMatchTieCopy) : COPY.sharperCopy);
    var balanced = {
      strategy: STRATEGY_BALANCED,
      title: strategyTitle(choice, STRATEGY_BALANCED),
      copy: balancedCopy,
      notice: "",
      pair: choice.balanced
    };
    var second = {
      strategy: alternativeStrategy,
      title: strategyTitle(choice, alternativeStrategy),
      copy: alternativeCopy,
      notice: seNoticeFor(eyesStrongerThanSE(rightResult, leftResult, alternative)),
      pair: alternative
    };
    var entries = closerMatch ? [second, balanced] : [balanced, second];
    entries[0].recommended = true;
    entries[0].badge = COPY.recommendedBadge;
    entries[1].recommended = false;
    entries[1].badge = "";
    return entries;
  }

  // --------------------------------------------------------------------------
  // EXPLANATION DOM (shared renderer; classes styled by each surface's CSS).
  // --------------------------------------------------------------------------

  function node(doc, tag, className, text) {
    var element = doc.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = text;
    return element;
  }

  function stepItem(doc, number, title, extraClass) {
    var item = node(doc, "li", "oo-rx-explain__step" + (extraClass ? " " + extraClass : ""));
    item.appendChild(node(doc, "span", "oo-rx-explain__number", String(number)));
    var body = node(doc, "div", "oo-rx-explain__step-body");
    body.appendChild(node(doc, "h4", "oo-rx-explain__step-title", title));
    item.appendChild(body);
    return { item: item, body: body };
  }

  function valueRow(doc, label, value) {
    var row = node(doc, "p", "oo-rx-explain__value");
    row.appendChild(node(doc, "span", "oo-rx-explain__value-label", label));
    row.appendChild(node(doc, "strong", "oo-rx-explain__value-number", value));
    return row;
  }

  function renderEyeExplanation(doc, title, model) {
    var section = node(doc, "section", "oo-rx-explain__eye");
    section.appendChild(node(doc, "h3", "oo-rx-explain__eye-title", title));
    var list = node(doc, "ol", "oo-rx-explain__steps");

    var one = stepItem(doc, 1, COPY.step1Title);
    one.body.appendChild(node(doc, "strong", "oo-rx-explain__rx", model.prescriptionText));
    list.appendChild(one.item);

    var quarter = model.method === "quarter_cyl";
    var two = stepItem(doc, 2, quarter ? COPY.step2QuarterTitle : COPY.step2Title);
    two.body.appendChild(node(doc, "p", "oo-rx-explain__label", quarter ? COPY.step2QuarterLabel : COPY.step2Label));
    if (model.hasCylinder || quarter) {
      two.body.appendChild(node(doc, "p", "oo-rx-explain__formula", quarter ? COPY.step2QuarterFormula : COPY.step2Formula));
      two.body.appendChild(node(doc, "p", "oo-rx-explain__equation", model.equation));
    }
    two.body.appendChild(valueRow(doc, quarter ? "Sphere-only strength" : "Spherical equivalent", model.baseRounded));
    if (quarter && model.transposed) {
      two.body.appendChild(node(doc, "p", "oo-rx-explain__copy", "Written in minus-cylinder form, your prescription for this eye is " + model.normalizedText + "."));
    }
    two.body.appendChild(node(doc, "p", "oo-rx-explain__copy",
      quarter ? COPY.step2QuarterCopy : (model.hasCylinder ? COPY.step2Copy : COPY.step2NoCylCopy)));
    if (model.hasCylinder && !quarter) two.body.appendChild(node(doc, "p", "oo-rx-explain__note", COPY.step2Tooltip));
    list.appendChild(two.item);

    if (model.baseTarget !== null) {
      var three = stepItem(doc, 3, COPY.step3Title);
      three.body.appendChild(valueRow(doc, COPY.step3Label, model.baseTargetRounded));
      three.body.appendChild(node(doc, "p", "oo-rx-explain__equation", model.underwaterStep));
      three.body.appendChild(node(doc, "p", "oo-rx-explain__copy", COPY.step3Copy));
      three.body.appendChild(node(doc, "p", "oo-rx-explain__copy", COPY.step3Why));
      list.appendChild(three.item);
    }

    var four = stepItem(doc, 4, COPY.step4Title, "oo-rx-explain__step--final");
    if (model.baseTarget !== null) four.body.appendChild(valueRow(doc, COPY.step4Calculated, model.baseTargetRounded));
    if (model.closerMatch) {
      four.body.appendChild(node(doc, "p", "oo-rx-explain__label", COPY.step4Nearby));
      var nearby = node(doc, "ul", "oo-rx-explain__nearby");
      model.nearbyLenses.forEach(function (lens) {
        var row = node(doc, "li", "oo-rx-explain__nearby-lens");
        row.appendChild(node(doc, "strong", "", formatPower(lens.power)));
        row.appendChild(doc.createTextNode(" distance " + lens.distance + " D"));
        nearby.appendChild(row);
      });
      four.body.appendChild(nearby);
    }
    var lensPower = quarter ? model.selectedPower : model.recommendedPower;
    var recommendedLabel = model.differsFromRecommended || model.closerMatch;
    four.body.appendChild(valueRow(doc, recommendedLabel ? COPY.step4Recommended : COPY.step4Selected, formatPower(lensPower) + " D"));
    four.body.appendChild(node(doc, "p", "oo-rx-explain__copy", COPY.step4Copy));
    if (model.closerMatch) four.body.appendChild(node(doc, "p", "oo-rx-explain__copy", model.closerMatchCopy));
    else if (model.stockCopy && !quarter) four.body.appendChild(node(doc, "p", "oo-rx-explain__copy", model.stockCopy));
    list.appendChild(four.item);

    if (model.choiceLines && model.choiceLines.length) {
      var five = stepItem(doc, 5, COPY.stepChoiceTitle, "oo-rx-explain__step--choice");
      if (model.differsFromRecommended) five.body.appendChild(valueRow(doc, COPY.step4Selected, formatPower(model.selectedPower) + " D"));
      model.choiceLines.forEach(function (line) {
        five.body.appendChild(node(doc, "p", "oo-rx-explain__copy", line));
      });
      list.appendChild(five.item);
    }
    if (model.showSeNotice) {
      var notice = node(doc, "p", "oo-rx-explain__warning", COPY.strongerThanSeNotice);
      notice.setAttribute("role", "note");
      section.appendChild(list);
      section.appendChild(notice);
      return section;
    }
    section.appendChild(list);
    return section;
  }

  /**
   * Builds the expandable explanation for a calculated pair.
   * input: { rightResult, leftResult, strategy, recommendation
   *   ({recommendedRight, recommendedLeft}), highCylinderPreview (optional),
   *   choice (the ordinary recommendation choice on show, optional),
   *   title (optional summary title) }
   */
  function renderExplanation(doc, input) {
    var settings = input || {};
    var rec = settings.recommendation || {};
    var high = settings.highCylinderPreview;
    var wrapper = node(doc, "div", "oo-rx-explain");

    var how = node(doc, "details", "oo-rx-explain__details");
    var summary = node(doc, "summary", "oo-rx-explain__summary");
    var summaryCopy = node(doc, "span", "oo-rx-explain__summary-copy");
    summaryCopy.appendChild(node(doc, "strong", "", settings.title || COPY.explainerTitle));
    summary.appendChild(summaryCopy);
    summary.appendChild(node(doc, "span", "oo-rx-explain__chevron"));
    summary.lastChild.setAttribute("aria-hidden", "true");
    how.appendChild(summary);
    var body = node(doc, "div", "oo-rx-explain__body");
    body.appendChild(node(doc, "p", "oo-rx-explain__intro", COPY.explainerIntro));
    var eyes = node(doc, "div", "oo-rx-explain__eyes");
    // A choice that defaults to its Closer Match presents that pair first.
    var defaultStrategy = high ? STRATEGY_BALANCED : defaultStrategyOf(settings.choice);
    var recommendedPair = defaultStrategy === STRATEGY_SHARPER ? settings.choice.sharper : null;
    [["right", "Right Eye (OD)", settings.rightResult, rec.recommendedRight],
     ["left", "Left Eye (OS)", settings.leftResult, rec.recommendedLeft]].forEach(function (entry) {
      var model = explainEye(entry[2], {
        strategy: settings.strategy,
        selectedPower: entry[3],
        defaultStrategy: defaultStrategy,
        recommendedPower: recommendedPair ? recommendedPair[entry[0] + "Power"] : null,
        highCylinderEye: high && high.eyes ? high.eyes[entry[0]] : null
      });
      if (model) eyes.appendChild(renderEyeExplanation(doc, entry[1], model));
    });
    body.appendChild(eyes);
    how.appendChild(body);
    wrapper.appendChild(how);

    var why = node(doc, "details", "oo-rx-explain__details oo-rx-explain__details--why");
    var whySummary = node(doc, "summary", "oo-rx-explain__summary");
    var whyCopy = node(doc, "span", "oo-rx-explain__summary-copy");
    whyCopy.appendChild(node(doc, "strong", "", COPY.whyTitle));
    whySummary.appendChild(whyCopy);
    whySummary.appendChild(node(doc, "span", "oo-rx-explain__chevron"));
    whySummary.lastChild.setAttribute("aria-hidden", "true");
    why.appendChild(whySummary);
    var whyBody = node(doc, "div", "oo-rx-explain__body");
    COPY.whyBody.forEach(function (paragraph) {
      whyBody.appendChild(node(doc, "p", "oo-rx-explain__copy", paragraph));
    });
    why.appendChild(whyBody);
    wrapper.appendChild(why);
    return wrapper;
  }

  return {
    STRATEGY_BALANCED: STRATEGY_BALANCED,
    STRATEGY_SHARPER: STRATEGY_SHARPER,
    STRATEGY_CLOSER_TO_SPH: STRATEGY_CLOSER_TO_SPH,
    HIGH_CYL_THRESHOLD: HIGH_CYL_THRESHOLD,
    COPY: COPY,
    BALANCED_TITLE: COPY.balancedTitle,
    BALANCED_COPY: COPY.balancedCopy,
    SHARPER_TITLE: COPY.sharperTitle,
    SHARPER_COPY: COPY.sharperCopy,
    CLOSER_TITLE: COPY.closerTitle,
    CLOSER_COPY: COPY.closerCopy,
    formatPower: formatPower,
    protectedReason: protectedReason,
    eyeMidpointAlternative: eyeMidpointAlternative,
    eyeSharperAlternative: eyeMidpointAlternative,
    calculatePairMidpointChoice: calculatePairMidpointChoice,
    calculatePairSharperChoice: calculatePairMidpointChoice,
    eyeCloserToSphPreference: eyeCloserToSphPreference,
    calculatePairCloserToSphPreference: calculatePairCloserToSphPreference,
    calculatePairRecommendationChoice: calculatePairRecommendationChoice,
    recommendationSelection: recommendationSelection,
    defaultStrategyOf: defaultStrategyOf,
    strategyTitle: strategyTitle,
    choiceEntries: choiceEntries,
    explainEye: explainEye,
    closerToSphRelation: closerToSphRelation,
    eyesStrongerThanSE: eyesStrongerThanSE,
    seNoticeFor: seNoticeFor,
    renderExplanation: renderExplanation
  };
});
