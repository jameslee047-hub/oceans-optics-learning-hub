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
 * Default (choice layer only; the V5.3 "balanced" result itself is
 * unchanged): Balanced, the normal V5.3 pathway, is always the Recommended and
 * initially selected option. The second pair is shown to customers as
 * "Alternative" (it can be stronger, softer or mixed relative to Balanced).
 * This applies equally to sharper, closer_to_sph and the high-CYL workflow.
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
      defaultStrategy: STRATEGY_BALANCED
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

  // The strategy presented first and selected by default for a choice:
  // always Balanced (the Recommended option).
  function defaultStrategyOf() {
    return STRATEGY_BALANCED;
  }

  // Same shape as the high-CYL recommendationSelection(). Accepts a Sharper
  // (midpoint) choice or a calculatePairRecommendationChoice() result. With no
  // strategy it returns the default (Balanced).
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
  // CUSTOMER-FACING COPY, shared by the Lens Calculator, the Product Rx Checker
  // and the Quiz so every tool says the same thing. No hyphens, en dashes or
  // em dashes in customer copy (signed lens values are numbers, not copy).
  // --------------------------------------------------------------------------

  var BALANCED_TITLE = "Balanced";
  var BALANCED_COPY = "Our recommended all round option, adjusted for comfortable underwater vision.";
  // The second option (internal strategy sharper or closer_to_sph) can be
  // stronger, softer or mixed relative to Balanced, so its fixed copy makes no
  // general claim; one dynamic sentence states what the actual pair does.
  var ALTERNATIVE_TITLE = "Alternative";
  var ALTERNATIVE_COPY = "Another valid lens option calculated from your prescription.";

  var COPY = {
    recommendedBadge: "Recommended",
    balancedTitle: BALANCED_TITLE,
    balancedCopy: BALANCED_COPY,
    alternativeTitle: ALTERNATIVE_TITLE,
    alternativeCopy: ALTERNATIVE_COPY,
    sharperTitle: ALTERNATIVE_TITLE,
    sharperCopy: ALTERNATIVE_COPY,
    closerTitle: ALTERNATIVE_TITLE,
    closerCopy: ALTERNATIVE_COPY,
    highCylBalancedTitle: BALANCED_TITLE,
    highCylBalancedCopy: BALANCED_COPY,
    highCylCloserTitle: ALTERNATIVE_TITLE,
    highCylCloserCopy: ALTERNATIVE_COPY,
    relationStronger: "This gives a stronger correction than Balanced.",
    relationSofter: "This gives a softer correction than Balanced.",
    relationMixed: "This uses a different balance of lens strengths than Balanced.",
    suggestedTitle: "Suggested Lens Strength",
    singleTitle: "Your lens strength",
    choiceIntro: "",
    checkerChoiceIntro: "",
    highCylIntro: "",
    whyTitle: "Why are my mask lenses different from my glasses?",
    whyBody: [
      "Underwater, your mask and the water make things look bigger and closer, a little like zooming in.",
      "Because of this, you usually do not need quite as much prescription correction as you do on land.",
      "We adjust your prescription for this underwater effect, then choose the closest available lens for your mask."
    ],
    expectTitle: "What to expect underwater",
    expectBalanced: "This is our recommended all round option. It is designed to give clear, natural vision underwater while accounting for the way objects appear bigger and closer through a dive mask.",
    expectAlternative: "Balanced remains our recommended all round option.",
    explainerTitle: "See how we calculated this",
    checkerExplainerTitle: "See how we calculated this",
    rowPrescription: "Glasses prescription",
    rowSphereOnly: "Sphere only strength",
    rowUnderwater: "Underwater adjusted strength",
    rowLens: "Closest available mask lens",
    rowAlternativeLens: "Alternative mask lens",
    mathsNote: "Prescription mask lenses come in fixed strengths, so the final lens may not exactly match the calculated number."
  };

  // --------------------------------------------------------------------------
  // EXPLANATION DATA (pure; numbers come only from the engine results).
  // --------------------------------------------------------------------------

  function formatRounded(value) {
    if (Math.abs(value) < 0.005) return "0.00";
    return (value > 0 ? "+" : "-") + Math.abs(value).toFixed(2);
  }

  function canonicalStrategy(strategy) {
    return strategy === STRATEGY_BALANCED || !strategy ? STRATEGY_BALANCED : STRATEGY_CLOSER_TO_SPH;
  }

  function strategyName(strategy) {
    return canonicalStrategy(strategy) === STRATEGY_BALANCED ? BALANCED_TITLE : ALTERNATIVE_TITLE;
  }

  function strongerThan(power, reference) {
    return power !== null && reference !== null && sign(power) === sign(reference) &&
      Math.abs(power) > Math.abs(reference) + EPSILON;
  }

  function numericPair(pair) {
    if (!pair) return null;
    var right = finite(pair.rightPower !== undefined ? pair.rightPower : pair.right);
    var left = finite(pair.leftPower !== undefined ? pair.leftPower : pair.left);
    return right === null || left === null ? null : { rightPower: right, leftPower: left };
  }

  function eyePowers(rightResult, leftResult, balancedPair, alternativePair) {
    var balanced = numericPair(balancedPair);
    var alternative = numericPair(alternativePair);
    return [["right", rightResult], ["left", leftResult]].map(function (entry) {
      return {
        result: entry[1],
        balanced: balanced ? balanced[entry[0] + "Power"] : null,
        alternative: alternative ? alternative[entry[0] + "Power"] : null
      };
    }).filter(function (eye) {
      return eye.balanced !== null && eye.alternative !== null && Math.abs(eye.balanced - eye.alternative) > EPSILON;
    });
  }

  /**
   * One factual sentence describing what the second pair does compared with
   * Balanced, from the actual lenses only (no general claim):
   * both differing eyes stronger / softer, a mix, or the one eye that differs.
   */
  function alternativeRelation(rightResult, leftResult, balancedPair, alternativePair) {
    var balanced = numericPair(balancedPair);
    var alternative = numericPair(alternativePair);
    var differing = [];
    if (balanced && alternative) {
      ["right", "left"].forEach(function (side) {
        var b = balanced[side + "Power"];
        var a = alternative[side + "Power"];
        if (Math.abs(a - b) > EPSILON) differing.push({ side: side, stronger: Math.abs(a) > Math.abs(b) });
      });
    }
    if (!differing.length) return { direction: "same", sentence: "" };
    if (differing.length === 1) {
      var eye = differing[0];
      return {
        direction: eye.stronger ? "stronger" : "softer",
        sentence: "The " + eye.side + " lens is " + (eye.stronger ? "stronger" : "softer") + " than Balanced."
      };
    }
    if (differing[0].stronger === differing[1].stronger) {
      return differing[0].stronger
        ? { direction: "stronger", sentence: COPY.relationStronger }
        : { direction: "softer", sentence: COPY.relationSofter };
    }
    return { direction: "mixed", sentence: COPY.relationMixed };
  }

  // Alternative card description for a pair: fixed copy plus the relation.
  function alternativeCopyFor(rightResult, leftResult, balancedPair, alternativePair) {
    var relation = alternativeRelation(rightResult, leftResult, balancedPair, alternativePair).sentence;
    return relation ? ALTERNATIVE_COPY + " " + relation : ALTERNATIVE_COPY;
  }

  // "What to expect underwater" for the selected option only.
  function expectationFor(strategy, rightResult, leftResult, balancedPair, alternativePair) {
    if (canonicalStrategy(strategy) === STRATEGY_BALANCED) return COPY.expectBalanced;
    var relation = alternativeRelation(rightResult, leftResult, balancedPair, alternativePair).sentence;
    return (relation ? relation + " " : "") + COPY.expectAlternative;
  }

  /**
   * Compact pathway for one eye. context: { strategy, selectedPower,
   * highCylinderEye (optional), label }. For a high-CYL eye with the Alternative
   * selected the existing SPH + CYL/4 base and its underwater target are
   * shown, because that is how that lens was found.
   */
  function explainEye(result, context) {
    var settings = context || {};
    if (!result || result.valid !== true) return null;
    var original = result.original || {};
    var sphere = finite(original.sphere);
    var cylinder = finite(original.cylinder) || 0;
    var primary = finite(result.finalStockPower);
    var strategy = canonicalStrategy(settings.strategy);
    var selected = finite(settings.selectedPower);
    if (selected === null) selected = primary;
    var highEye = settings.highCylinderEye;
    var quarter = strategy === STRATEGY_CLOSER_TO_SPH && highEye && highEye.triggered === true &&
      finite(highEye.quarterCylinderBase) !== null;
    var base = quarter ? Number(highEye.quarterCylinderBase) : finite(result.sphericalEquivalent);
    var target = quarter ? finite(highEye.alternativeTarget) : finite(result.preSnapTarget);
    var hasCylinder = Math.abs(cylinder) > EPSILON;
    return {
      method: quarter ? "quarter_cyl" : "spherical_equivalent",
      strategy: strategy,
      sphere: sphere,
      cylinder: cylinder,
      hasCylinder: hasCylinder,
      prescription: formatRounded(sphere) + (hasCylinder ? " / " + formatRounded(cylinder) : ""),
      sphereOnlyPower: base,
      sphereOnly: base === null ? null : formatRounded(base),
      underwaterTargetPower: target,
      underwaterTarget: target === null ? null : formatRounded(target),
      primaryPower: primary,
      selectedPower: selected,
      lensLabel: settings.label || COPY.rowLens,
      lens: selected === null ? null : formatPower(selected),
      strongerThanSE: strongerThan(selected, finite(result.sphericalEquivalent))
    };
  }

  // Short relation copy (pair level); kept for compatibility.
  function closerToSphRelation(choice) {
    if (!choice || !choice.eyes) return "";
    var directions = ["right", "left"].map(function (side) {
      var eye = choice.eyes[side];
      if (!eye || eye.alternativePower === null || eye.alternativePower === undefined) return 0;
      return Math.abs(eye.alternativePower) > Math.abs(eye.balancedPower) ? 1 : -1;
    }).filter(function (direction) { return direction !== 0; });
    if (!directions.length) return "";
    return directions.indexOf(-1) === -1 ? "It is stronger than Balanced." : "It is softer than Balanced.";
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

  // The card and "What to expect underwater" already state the direction of
  // the Alternative, so no separate warning box is shown.
  function seNoticeFor() {
    return "";
  }

  // Customer-facing title of one strategy: always Balanced or Alternative.
  function strategyTitle(choice, strategy) {
    return strategyName(strategy);
  }

  /**
   * The two option cards, Balanced (Recommended) first, then Alternative.
   * Each: { strategy, title, badge, copy, notice, pair, recommended }.
   * pairs (optional, high CYL): { balanced, alternative, alternativeStrategy }.
   */
  function choiceEntries(choice, rightResult, leftResult, pairs) {
    var source = pairs || choice;
    if (!source || (!pairs && !choice.available)) return [];
    var alternativeStrategy = (pairs ? pairs.alternativeStrategy : choice.alternativeStrategy) || STRATEGY_SHARPER;
    var alternative = source.alternative || source.sharper;
    return [{
      strategy: STRATEGY_BALANCED,
      title: BALANCED_TITLE,
      badge: COPY.recommendedBadge,
      copy: BALANCED_COPY,
      notice: "",
      pair: source.balanced,
      recommended: true
    }, {
      strategy: alternativeStrategy,
      title: ALTERNATIVE_TITLE,
      badge: "",
      copy: alternativeCopyFor(rightResult, leftResult, source.balanced, alternative),
      notice: "",
      pair: alternative,
      recommended: false
    }];
  }

  /**
   * Explanation model for a calculated pair (pure data, shared by every
   * surface). input: { rightResult, leftResult, strategy, recommendation
   *   ({recommendationStrategy, recommendedRight, recommendedLeft}), choice
   *   (the ordinary choice on show, optional), highCylinderPreview (optional) }
   */
  function explanationModel(input) {
    var settings = input || {};
    var rec = settings.recommendation || {};
    var high = settings.highCylinderPreview || null;
    var choice = settings.choice && settings.choice.available ? settings.choice : null;
    var offered = Boolean(high || choice);
    var strategy = canonicalStrategy(rec.recommendationStrategy || settings.strategy);
    var label = offered && strategy !== STRATEGY_BALANCED ? COPY.rowAlternativeLens : COPY.rowLens;
    var eyes = [];
    [["right", "Right eye", settings.rightResult, rec.recommendedRight],
     ["left", "Left eye", settings.leftResult, rec.recommendedLeft]].forEach(function (entry) {
      var model = explainEye(entry[2], {
        strategy: strategy,
        selectedPower: entry[3],
        label: label,
        highCylinderEye: high && high.eyes ? high.eyes[entry[0]] : null
      });
      if (model) eyes.push(Object.assign({ side: entry[0], title: entry[1] }, model));
    });
    var balancedPair = offered ? (high ? high.balanced : choice.balanced) : null;
    var alternativePair = offered ? (high ? high.alternative : (choice.alternative || choice.sharper)) : null;
    return {
      whyTitle: COPY.whyTitle,
      whyBody: COPY.whyBody.slice(),
      strategy: strategy,
      expectTitle: COPY.expectTitle,
      expectation: offered ? expectationFor(strategy, settings.rightResult, settings.leftResult, balancedPair, alternativePair) : "",
      mathsTitle: COPY.explainerTitle,
      eyes: eyes,
      note: COPY.mathsNote
    };
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

  function valueRow(doc, label, value, extraClass) {
    var row = node(doc, "p", "oo-rx-explain__value" + (extraClass ? " " + extraClass : ""));
    row.appendChild(node(doc, "span", "oo-rx-explain__value-label", label + ":"));
    row.appendChild(node(doc, "strong", "oo-rx-explain__value-number", value));
    return row;
  }

  // "Why are my mask lenses different from my glasses?" (shown above the
  // option cards on every surface).
  function renderWhy(doc) {
    var section = node(doc, "section", "oo-rx-why");
    section.appendChild(node(doc, "h3", "oo-rx-why__title", COPY.whyTitle));
    COPY.whyBody.forEach(function (paragraph) {
      section.appendChild(node(doc, "p", "oo-rx-why__copy", paragraph));
    });
    return section;
  }

  function renderEyeExplanation(doc, eye) {
    var section = node(doc, "section", "oo-rx-explain__eye");
    section.dataset.eye = eye.side;
    section.appendChild(node(doc, "h3", "oo-rx-explain__eye-title", eye.title));
    var pathway = node(doc, "div", "oo-rx-explain__pathway");
    pathway.appendChild(valueRow(doc, COPY.rowPrescription, eye.prescription));
    if (eye.sphereOnly !== null) pathway.appendChild(valueRow(doc, COPY.rowSphereOnly, eye.sphereOnly));
    if (eye.underwaterTarget !== null) pathway.appendChild(valueRow(doc, COPY.rowUnderwater, eye.underwaterTarget));
    pathway.appendChild(valueRow(doc, eye.lensLabel, eye.lens || "--", "oo-rx-explain__value--lens"));
    section.appendChild(pathway);
    return section;
  }

  /**
   * Below the option cards: "What to expect underwater" for the selected
   * option (only when two options are on show), then the collapsed
   * "See how we calculated this" pathway. Same input as explanationModel().
   */
  function renderExplanation(doc, input) {
    var settings = input || {};
    var model = explanationModel(settings);
    var wrapper = node(doc, "div", "oo-rx-explain");
    wrapper.dataset.strategy = model.strategy;

    if (model.expectation) {
      var expect = node(doc, "section", "oo-rx-expect");
      expect.dataset.strategy = model.strategy;
      expect.setAttribute("aria-live", "polite");
      expect.appendChild(node(doc, "h3", "oo-rx-expect__title", model.expectTitle));
      expect.appendChild(node(doc, "p", "oo-rx-expect__copy", model.expectation));
      wrapper.appendChild(expect);
    }

    var how = node(doc, "details", "oo-rx-explain__details");
    var summary = node(doc, "summary", "oo-rx-explain__summary");
    var summaryCopy = node(doc, "span", "oo-rx-explain__summary-copy");
    summaryCopy.appendChild(node(doc, "strong", "", model.mathsTitle));
    summary.appendChild(summaryCopy);
    summary.appendChild(node(doc, "span", "oo-rx-explain__chevron"));
    summary.lastChild.setAttribute("aria-hidden", "true");
    how.appendChild(summary);
    var body = node(doc, "div", "oo-rx-explain__body");
    var eyes = node(doc, "div", "oo-rx-explain__eyes");
    model.eyes.forEach(function (eye) {
      eyes.appendChild(renderEyeExplanation(doc, eye));
    });
    body.appendChild(eyes);
    body.appendChild(node(doc, "p", "oo-rx-explain__note", model.note));
    how.appendChild(body);
    wrapper.appendChild(how);
    return wrapper;
  }

  return {
    STRATEGY_BALANCED: STRATEGY_BALANCED,
    STRATEGY_SHARPER: STRATEGY_SHARPER,
    STRATEGY_CLOSER_TO_SPH: STRATEGY_CLOSER_TO_SPH,
    HIGH_CYL_THRESHOLD: HIGH_CYL_THRESHOLD,
    COPY: COPY,
    BALANCED_TITLE: BALANCED_TITLE,
    BALANCED_COPY: BALANCED_COPY,
    ALTERNATIVE_TITLE: ALTERNATIVE_TITLE,
    ALTERNATIVE_COPY: ALTERNATIVE_COPY,
    SHARPER_TITLE: ALTERNATIVE_TITLE,
    SHARPER_COPY: ALTERNATIVE_COPY,
    CLOSER_TITLE: ALTERNATIVE_TITLE,
    CLOSER_COPY: ALTERNATIVE_COPY,
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
    explanationModel: explanationModel,
    alternativeRelation: alternativeRelation,
    alternativeCopyFor: alternativeCopyFor,
    expectationFor: expectationFor,
    renderWhy: renderWhy,
    closerToSphRelation: closerToSphRelation,
    eyesStrongerThanSE: eyesStrongerThanSE,
    seNoticeFor: seNoticeFor,
    renderExplanation: renderExplanation
  };
});
