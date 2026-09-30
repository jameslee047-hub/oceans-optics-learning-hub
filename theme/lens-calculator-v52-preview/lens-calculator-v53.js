/*
 * ============================================================================
 * OCEANS OPTICS LENS CALCULATOR - V5.3 (EXPERIMENTAL)
 * ============================================================================
 *
 * STATUS: EXPERIMENTAL. NOT VALIDATED. NOT DEPLOYED. NOT WIRED INTO ANY
 * CUSTOMER-FACING CALCULATOR. This is an isolated V5.2 derivative for
 * methodology comparison only. The historical V5.2 engine remains intact.
 *
 * V5.3 keeps V5.2's normalization, sphere-only references, continuous
 * 0.50D underwater adjustment toward zero, CYL bands and warnings, and
 * plano-crossover handling. Its only methodology change is the ordinary
 * stock selection performed after the continuous target is calculated.
 *
 * Instead of selecting the nearest stocked power and using toward zero only
 * as an exact-tie rule, V5.3 excludes any candidate whose absolute power is
 * stronger than the continuous target. It then selects the closest eligible
 * stocked power. Exact stock targets remain exact. This directional snap is
 * sign-safe because eligibility is expressed as:
 *
 *   abs(stock power) <= abs(continuous target)
 *
 * The stock grid can make the total difference between the sphere-only
 * reference and final stock lens exceed 0.75D. For example, reference
 * -7.875 becomes target -7.375 after the 0.50D adjustment, then snaps to
 * -7.00 because -7.50 is stronger than the target: an effective 0.875D
 * weakening from the original reference.
 *
 * FARSIGHTED STOCK (revised 2026-09-30): for positive (hyperopic)
 * prescriptions the directional rule above no longer applies. Farsighted
 * stock comes in 1.00 D steps, where "never stronger than the target"
 * could discard up to 0.875 D beyond the intended adjustment. Positive
 * targets now use the nearest stocked plus power, with an exact tie going
 * to the weaker lens (toward zero) — the V5.2 selector — including the
 * 0.00 / +1.00 gap (target +0.50 or less -> 0.00, above +0.50 -> +1.00).
 * The exact SE +0.50 manual-review safeguard is kept. Minus selection is
 * unchanged.
 *
 * Version: 5.3.0-experimental
 * Created: 2026-09-26 from the unchanged V5.2 engine
 * ============================================================================
 */

(function (root, factory) {
  var v4 =
    typeof module === "object" && module !== null && typeof module.exports !== "undefined"
      ? require("./lens-calculator-master.js")
      : root.OOLensCalculator;

  if (!v4) {
    throw new Error(
      "lens-calculator-v53.js requires lens-calculator-master.js (V4) to be loaded first - " +
        "V5.3 reuses V4's parsing/validation/normalization, it does not duplicate them."
    );
  }

  var api = factory(v4);

  if (typeof module !== "object" || module === null || typeof module.exports === "undefined") {
    root.OOLensCalculatorV53 = api;
  } else {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (V4) {
  "use strict";

  var EPSILON = 1e-9;

  // ==========================================================================
  // V5.3 CONFIGURATION - every tunable experimental constant lives here.
  // Nothing below this block should hardcode a diopter offset, a band
  // boundary, or a stock-power list inline; everything reads from here so
  // the experimental model can be re-tuned from one place.
  // ==========================================================================

  var V53_CONFIG = {
    version: "5.3.0-experimental",

    // CYL magnitude band boundaries (inclusive upper bounds). Retained
    // from V5.0 unchanged. As of V5.1 these control WARNING/CONFIDENCE
    // TEXT ONLY (see warningForBand()) — they no longer affect the
    // underwater adjustment amount in any way. Kept as a single set of
    // boundaries (not split into "affects adjustment" vs "affects
    // warning" versions) because there is currently only one use for them.
    lowCylinderMax: 0.75,
    mediumCylinderMax: 1.75,
    highCylinderMax: 3.0,
    // above highCylinderMax => "very-high"

    // ------------------------------------------------------------------
    // THE OCEANS OPTICS UNDERWATER ADJUSTMENT (V5.1 core change).
    //
    // A single, CYL-independent reduction applied to the magnitude of the
    // spherical equivalent, moving it toward zero (never past it — see
    // computeContinuousTarget()). Applied IDENTICALLY whether CYL is
    // 0.00D or 6.00D; CYL magnitude has no influence on this number.
    //
    // EXPERIMENTAL — NOT CURRENTLY CLAIMED TO BE A UNIVERSAL PHYSICAL
    // CONSTANT. This is a provisional Oceans Optics empirical hypothesis,
    // not yet validated against mask optical modelling, underwater
    // comparison, or customer/tested-lens outcomes. It replaces V5.0's
    // band-dependent lowCylTowardZeroStepD/mediumCylTowardZeroStepD
    // (0.25D, applied only at low/medium CYL) with one uniform value
    // applied at every CYL level.
    // ------------------------------------------------------------------
    underwaterAdjustmentD: 0.5,

    // ------------------------------------------------------------------
    // AVAILABLE STOCK POWERS.
    //
    // This is the FULL, ACROSS-ALL-MASKS union of powers found in
    // `sections/lens-calculator.liquid`'s mask catalog (`diopterMin` /
    // `diopterMax` / `diopterStep` per mask), not any single mask's own
    // narrower range. Individual masks in that catalog support narrower
    // windows within this union (e.g. Rx Rover: -1.50 to -6.00; Rx
    // Obsidian: -1.00 to -9.00 — both step 0.50). Matching a recommended
    // power to a specific sellable mask model is a separate, later
    // product-catalog-matching step, exactly as already established for
    // V4 in LENS-CALCULATOR-SOURCE-OF-TRUTH.md's "calculator capability vs
    // product capability" distinction — V5 keeps that same separation:
    // this module answers "what power is optically appropriate," not
    // "which specific mask SKU currently stocks it."
    //
    // FLAGGED AMBIGUITY (see chat report "edge cases discovered"): because
    // per-mask ranges differ, a power this module recommends (e.g. -8.50)
    // may not be available on every mask model, only on the ones whose
    // own diopterMin/diopterMax window covers it. That reconciliation is
    // out of scope for this experimental recommendation engine.
    // ------------------------------------------------------------------
    // Plano (0.00) is included in BOTH catalogs deliberately — it is a
    // real, supported "no correction" option (see spec section 7: "Plano
    // / 0.00 where supported"), not something reachable only via the
    // true-plano short-circuit. Corrected 2026-09-05: an earlier revision
    // of this file treated plano as unreachable except when both SPH and
    // CYL were exactly zero, which meant a small-magnitude SE near zero
    // had no way to ever be recommended plano — see "PLANO_CROSSOVER"
    // below for why this specific gap (0.00 to the first corrective
    // power, a full 1.00D jump vs. the uniform 0.50D/1.00D steps
    // everywhere else) gets its own comparison logic rather than being
    // left to plain nearest-power selection.
    myopiaAvailablePowers: [
      0.0, -1.0, -1.5, -2.0, -2.5, -3.0, -3.5, -4.0, -4.5, -5.0, -5.5, -6.0, -6.5, -7.0, -7.5, -8.0, -8.5, -9.0
    ],
    hyperopiaAvailablePowers: [0.0, 1.0, 2.0, 3.0, 4.0, 5.0],

    // Internal/experimental confidence text. Not published, not a medical
    // claim — see module banner. `level` is for programmatic branching;
    // `message` is the human-readable text.
    warnings: {
      low: null,
      medium: {
        level: "moderate",
        message: "Moderate astigmatism — sphere-only lens is an approximation."
      },
      high: {
        level: "high",
        message:
          "Higher astigmatism — sphere-only stock correction is an approximation. Underwater comparison or optometrist verification is recommended."
      },
      veryHigh: {
        level: "very-high",
        message:
          "High astigmatism — sphere-only stock lenses provide an approximate correction. Underwater comparison, optometrist verification or custom cylindrical/bifocal correction may provide better visual acuity."
      }
    }
  };

  // ==========================================================================
  // CYL BAND CLASSIFICATION (V5's own, config-driven — independent of V4's
  // getCylinderBand(), which is preserved unchanged for V4's own use).
  // ==========================================================================

  var CYL_BAND_LOW = "low";
  var CYL_BAND_MEDIUM = "medium";
  var CYL_BAND_HIGH = "high";
  var CYL_BAND_VERY_HIGH = "very-high";

  /**
   * @param {number} absCylinder - non-negative CYL magnitude
   * @returns {string} one of the CYL_BAND_* constants above
   */
  function getCylinderBandV53(absCylinder) {
    var v = Math.abs(absCylinder);
    if (v <= V53_CONFIG.lowCylinderMax + EPSILON) return CYL_BAND_LOW;
    if (v <= V53_CONFIG.mediumCylinderMax + EPSILON) return CYL_BAND_MEDIUM;
    if (v <= V53_CONFIG.highCylinderMax + EPSILON) return CYL_BAND_HIGH;
    return CYL_BAND_VERY_HIGH;
  }

  // ==========================================================================
  // SIGN-SAFE STOCK-POWER SELECTORS
  // ----------------------------------------------------------------------
  // Both helpers work on a plain array of signed available powers (all the
  // same sign — myopia arrays are all negative, hyperopia arrays all
  // positive) and reason entirely in terms of "closer to zero" (weaker) /
  // "farther from zero" (stronger). Neither uses Math.floor/Math.ceil, so
  // neither assumes a uniform step size — this is deliberate per the V5
  // spec, since positive and negative catalogs use different increments
  // (0.50D vs 1.00D) today and could diverge further later.
  // ==========================================================================

  /**
   * Returns the available power closest to `target`. On an exact tie
   * (two powers equally distant from target), explicitly and
   * deterministically prefers the WEAKER power (the one closer to zero) —
   * this is a deliberate, documented choice for V5, not inherited from
   * any `<=`/`<` comparison accident. Works for both signed catalogs
   * because "closer to zero" is evaluated via Math.abs() on the candidate
   * power itself, not on its distance from target.
   *
   * @param {number} target
   * @param {number[]} availablePowers
   * @returns {number}
   */
  function nearestAvailablePower(target, availablePowers) {
    var best = null;
    var bestDist = Infinity;

    availablePowers.forEach(function (power) {
      var dist = Math.abs(power - target);
      if (dist < bestDist - EPSILON) {
        best = power;
        bestDist = dist;
      } else if (Math.abs(dist - bestDist) < EPSILON) {
        // Exact tie: explicit weaker-wins rule.
        if (Math.abs(power) < Math.abs(best)) {
          best = power;
        }
      }
    });

    return best;
  }

  /**
   * V5.2's stock-tie rule: like nearestAvailablePower() above, but reports
   * the tied candidates for debug display. On an exact tie between two (or
   * more) equally-close candidates, prefers whichever has the SMALLER
   * ABSOLUTE POWER — i.e. continues in the same direction as the
   * underwater adjustment that produced the target: toward zero.
   *
   * This is a correction of V5.1's tie rule, which favored whichever
   * candidate was closer to the ORIGINAL SE. That was wrong: for
   * SE -5.25 / target -4.75, tied between -5.00 and -4.50, V5.1 chose
   * -5.00 (closer to SE) — but that moves BACK toward SE, partially
   * reversing the underwater adjustment that was just deliberately
   * applied. V5.2 chooses -4.50 instead: the candidate closer to zero,
   * continuing the adjustment's own direction. This is deliberately NOT
   * described as "round toward SPH" — with small CYL the 0.50D adjustment
   * can move the target beyond the normalized SPH value, so "toward zero"
   * (smaller abs(power)) is the only correct characterization.
   *
   * Sign-safe by construction: comparing Math.abs(power) works identically
   * for myopic (negative) and hyperopic (positive) catalogs, so no
   * separate positive/negative branch is needed.
   *
   * @param {number} target - the continuous pre-stock target
   * @param {number[]} availablePowers
   * @returns {{power: number, tieCandidates: Array<{power:number, distanceFromTarget:number}>|null}}
   *   `tieCandidates` is null when exactly one candidate was closest to
   *   `target` (no tie to resolve); otherwise it lists every tied
   *   candidate with its distance from target, for debug display.
   */
  function nearestAvailablePowerTowardZero(target, availablePowers) {
    var bestDist = Infinity;
    availablePowers.forEach(function (power) {
      var dist = Math.abs(power - target);
      if (dist < bestDist - EPSILON) bestDist = dist;
    });

    var tied = availablePowers.filter(function (power) {
      return Math.abs(Math.abs(power - target) - bestDist) < EPSILON;
    });

    if (tied.length <= 1) {
      return { power: tied[0], tieCandidates: null };
    }

    var withDistances = tied.map(function (power) {
      return { power: power, distanceFromTarget: Math.abs(power - target) };
    });

    var winner = withDistances[0];
    withDistances.forEach(function (candidate) {
      if (Math.abs(candidate.power) < Math.abs(winner.power) - EPSILON) {
        winner = candidate;
      }
    });

    return { power: winner.power, tieCandidates: withDistances };
  }

  /**
   * V5.3 directional stock selector. A stock power is eligible only when it
   * is no stronger than the continuous target in absolute-power terms.
   * Among eligible powers, the closest one to the target wins. This keeps
   * the selection moving toward zero for both minus and plus prescriptions,
   * while preserving an exact stocked target unchanged.
   *
   * `stockCandidates` contains the exact match or the two powers bracketing
   * the target magnitude. `rejectedStrongerCandidates` identifies any
   * bracketing power excluded by the V5.3 rule for development diagnostics.
   *
   * @param {number} target
   * @param {number[]} availablePowers
   * @returns {{power:number|null, stockCandidates:Array, rejectedStrongerCandidates:Array}}
   */
  function directionalStockPowerTowardZero(target, availablePowers) {
    var targetMagnitude = Math.abs(target);
    var exact = availablePowers.filter(function (power) {
      return Math.abs(Math.abs(power) - targetMagnitude) < EPSILON;
    });

    var eligible = availablePowers.filter(function (power) {
      return Math.abs(power) <= targetMagnitude + EPSILON;
    });

    var winner = eligible.reduce(function (best, power) {
      if (best === null) return power;
      var distance = Math.abs(power - target);
      var bestDistance = Math.abs(best - target);
      if (distance < bestDistance - EPSILON) return power;
      if (Math.abs(distance - bestDistance) < EPSILON && Math.abs(power) < Math.abs(best)) return power;
      return best;
    }, null);

    var weaker = eligible.reduce(function (best, power) {
      if (best === null || Math.abs(power) > Math.abs(best) + EPSILON) return power;
      return best;
    }, null);
    var stronger = availablePowers
      .filter(function (power) {
        return Math.abs(power) > targetMagnitude + EPSILON;
      })
      .reduce(function (best, power) {
        if (best === null || Math.abs(power) < Math.abs(best) - EPSILON) return power;
        return best;
      }, null);

    var bracketPowers = exact.length ? exact : [stronger, weaker].filter(function (power) { return power !== null; });
    var stockCandidates = bracketPowers.map(function (power) {
      return {
        power: power,
        distanceFromTarget: Math.abs(power - target),
        eligible: Math.abs(power) <= targetMagnitude + EPSILON
      };
    });

    return {
      power: winner,
      stockCandidates: stockCandidates,
      rejectedStrongerCandidates: stockCandidates.filter(function (candidate) { return !candidate.eligible; })
    };
  }

  /**
   * V5.2's continuous underwater-adjustment target (unchanged from V5.1 —
   * see V53_CONFIG.underwaterAdjustmentD and the module banner's "V5.2
   * METHODOLOGY CHANGE" section, which only touches the stock-tie rule
   * downstream of this target, not this function). Reduces
   * the MAGNITUDE of SE by the configured adjustment, toward zero, and
   * explicitly clamps at zero rather than ever crossing to the opposite
   * sign — a myopic SE can move toward plano but never become hyperopic
   * (and vice versa) through this adjustment alone.
   *
   * EXPERIMENTAL: this is a provisional Oceans Optics empirical hypothesis
   * about underwater optical comfort, not a universal physical constant,
   * and is NOT currently validated against mask optical modelling,
   * underwater comparison, or customer/tested-lens outcomes.
   *
   * @param {number} se - spherical equivalent (signed)
   * @returns {number}
   */
  function computeContinuousTarget(se) {
    var magnitude = Math.max(Math.abs(se) - V53_CONFIG.underwaterAdjustmentD, 0);
    if (se > 0) return magnitude;
    if (se < 0) return -magnitude;
    return 0;
  }

  /**
   * Returns the available power that is the SMALLEST step away from
   * `reference` while still being strictly WEAKER than it (closer to
   * zero).
   *
   * HISTORY / CURRENT STATUS (corrected 2026-09-05): an earlier revision
   * of the LOW band used this function as its stock-power selector
   * ("the next available stock power weaker than SE"), with a fallback
   * that returned a structured "no valid answer" whenever no power was
   * actually weaker than the reference (e.g. SE = -0.75 with a myopia
   * catalog bottoming out at -1.00). That blanket "never select a power
   * on the stronger side of SE" rule was itself an overcorrection — it
   * would have refused a plano recommendation even in cases where plano
   * is clearly the right answer, and treated every near-the-floor case as
   * requiring manual review instead of recognizing genuinely clear cases.
   * The recommendation pipeline uses `computeV53Recommendation()`'s own
   * target-then-`selectStockPower()` pipeline instead (see below), which
   * folds plano in as a normal candidate and only asks for manual review
   * when a case is genuinely ambiguous (see `resolvePlanoCrossover()`).
   *
   * This function is KEPT as a standalone, independently correct utility
   * (its own contract — "the closest available power that is strictly
   * weaker than X" — is unambiguous and still fully tested), but it is no
   * longer called by the recommendation pipeline. Direction is derived
   * from the sign of `reference`: for a negative reference (myopic),
   * weaker means algebraically greater (less negative); for a positive
   * reference (hyperopic), weaker means algebraically smaller (less
   * positive).
   *
   * @param {number} reference
   * @param {number[]} availablePowers
   * @returns {{power: number, stockStatus: "OK"} | {power: null, stockStatus: "NO_WEAKER_STOCK_POWER"}}
   */
  function nextWeakerAvailablePower(reference, availablePowers) {
    var myopic = reference < 0;
    var candidates = availablePowers.filter(function (power) {
      return myopic ? power > reference + EPSILON : power < reference - EPSILON;
    });

    if (!candidates.length) {
      return { power: null, stockStatus: "NO_WEAKER_STOCK_POWER" };
    }

    candidates.sort(function (a, b) {
      return Math.abs(a - reference) - Math.abs(b - reference);
    });

    return { power: candidates[0], stockStatus: "OK" };
  }

  // ==========================================================================
  // PLANO CROSSOVER — the gap between plano (0.00) and the weakest
  // corrective stock power is a full 1.00D, unlike the uniform 0.50D
  // (myopia) / 1.00D-but-starting-at-1.00 (hyperopia) steps everywhere
  // else in each catalog. Ordinary nearest-power selection, applied
  // blindly right at this boundary, can be misleading: distance to the
  // shifted continuous TARGET is not the same question as distance to the
  // actual optical SE, and at this particular gap the two can disagree.
  // This section handles that boundary explicitly and narrowly — it only
  // engages when SE's magnitude is smaller than the weakest corrective
  // power's magnitude (i.e. SE sits somewhere between 0 and the first
  // corrective lens). Everywhere else, plain nearest-to-target selection
  // (with its existing weaker-wins tie-break) applies unchanged.
  // ==========================================================================

  /**
   * @param {number[]} availablePowers - one refractive-type catalog, must include 0.00
   * @returns {number} the available power with the smallest non-zero magnitude
   */
  function weakestCorrectivePower(availablePowers) {
    var nonZero = availablePowers.filter(function (power) {
      return Math.abs(power) > EPSILON;
    });
    return nonZero.reduce(function (weakest, power) {
      return Math.abs(power) < Math.abs(weakest) ? power : weakest;
    }, nonZero[0]);
  }

  /**
   * Decides between plano (0.00) and the weakest corrective stock power
   * for an SE that falls between them, using distance FROM THE ORIGINAL
   * SPHERICAL EQUIVALENT (not the shifted continuous target) as the
   * deciding factor — per the explicit correction: "if one candidate is
   * clearly closer to the original SE, prefer that candidate at this
   * large plano-to-corrective inventory gap." If the two candidates are
   * equidistant from SE within floating-point tolerance, this returns a
   * flagged, unresolved result rather than guessing.
   *
   * @param {number} se - the spherical equivalent (signed)
   * @param {number} target - the band's continuous pre-snap target (for debug display only, not used to decide the winner)
   * @param {number} corrective - the weakest corrective power on this SE's refractive side
   * @returns {{
   *   power: number|null,
   *   stockStatus: "OK"|"PLANO_CROSSOVER_REVIEW",
   *   reason: string,
   *   candidates: Array<{power:number, distanceFromSE:number, distanceFromTarget:number}>
   * }}
   */
  function resolvePlanoCrossover(se, target, corrective) {
    var distSEPlano = Math.abs(se - 0);
    var distSECorrective = Math.abs(se - corrective);

    var candidates = [
      { power: 0, distanceFromSE: distSEPlano, distanceFromTarget: Math.abs(target - 0) },
      { power: corrective, distanceFromSE: distSECorrective, distanceFromTarget: Math.abs(target - corrective) }
    ];

    if (Math.abs(distSEPlano - distSECorrective) < EPSILON) {
      return {
        power: null,
        stockStatus: "PLANO_CROSSOVER_REVIEW",
        reason:
          "Spherical equivalent (" +
          se.toFixed(3) +
          ") is equidistant between plano (0.00) and the weakest corrective stock power (" +
          formatSigned(corrective) +
          ") — genuinely ambiguous at this unusually large inventory gap, flagged for manual review rather than resolved automatically.",
        candidates: candidates
      };
    }

    var winnerIsPlano = distSEPlano < distSECorrective;
    var winner = winnerIsPlano ? 0 : corrective;

    return {
      power: winner,
      stockStatus: "OK",
      reason:
        (winnerIsPlano ? "Plano (0.00)" : "The weakest corrective stock power (" + formatSigned(corrective) + ")") +
        " is clearly closer to the original spherical equivalent (" +
        se.toFixed(3) +
        ") than the alternative, at this unusually large plano-to-corrective inventory gap.",
      candidates: candidates
    };
  }

  function formatSigned(n) {
    return (n >= 0 ? "+" : "") + n.toFixed(2);
  }

  // ==========================================================================
  // PLANO-TO-FIRST-MINUS GAP (approved V5.3 rule; midpoint updated
  // 2026-09-29).
  //
  // Plano-to-first-minus gap: targets with less than 0.50 D of minus
  // correction use plano; targets with 0.50 D or more use -1.00. This
  // applies only to a MINUS continuous target strictly between 0.00 and the
  // weakest minus stock power (-1.00).
  //
  //   less than 0.50 D of minus (e.g. -0.25, -0.49)          ->  0.00
  //   0.50 D of minus or more (e.g. -0.50, -0.75, -0.875)   -> -1.00
  //
  // This narrow rule exists because directional selection alone would
  // reject -1.00 for being marginally stronger than the target (e.g. target
  // -0.875) and jump a full 1.00D gap to plano. Everywhere else — exact
  // 0.00 targets, stronger minus targets, and every plus/hyperopic target —
  // the existing selection logic is unchanged.
  // ==========================================================================

  /**
   * @param {number} target - continuous pre-snap target (signed)
   * @param {number[]} availablePowers - one refractive-type catalog
   * @returns {object|null} a selection result, or null when the rule does not apply
   */
  function planoToFirstMinusGapSelection(target, availablePowers) {
    var corrective = weakestCorrectivePower(availablePowers);
    if (!(corrective < 0) || !(target < -EPSILON) || !(target > corrective + EPSILON)) return null;

    var halfStepMagnitude = Math.abs(corrective) / 2;
    var power = Math.abs(target) >= halfStepMagnitude - EPSILON ? corrective : 0;
    var candidates = [
      { power: 0, distanceFromTarget: Math.abs(target - 0) },
      { power: corrective, distanceFromTarget: Math.abs(target - corrective) }
    ];

    return {
      power: power,
      stockStatus: "OK",
      rule: "plano-to-first-minus-gap",
      reason:
        "Plano-to-first-minus gap: targets with less than 0.50 D of minus correction use plano; targets with 0.50 D or more use -1.00. The continuous target (" +
        formatSigned(target) +
        ") lies between 0.00 and " +
        formatSigned(corrective) +
        ", so " +
        formatSigned(power) +
        " is selected.",
      candidates: candidates,
      tieCandidates: null,
      stockCandidates: null,
      rejectedStrongerCandidates: null
    };
  }

  // ==========================================================================
  // FARSIGHTED (PLUS) STOCK SELECTION (revised 2026-09-30).
  //
  // Positive continuous targets use the nearest stocked plus power; on an
  // exact distance tie the weaker lens (smaller absolute power, toward zero)
  // wins. This also covers the 0.00 / +1.00 gap: target +0.50 or less ->
  // 0.00, above +0.50 -> +1.00. The one exception is the existing manual
  // review safeguard for an SE of exactly +0.50 (equidistant from plano and
  // +1.00 before the adjustment), which is preserved unchanged.
  // ==========================================================================

  var PLUS_NEAREST_STOCK_RULE = "plus-nearest-stock";

  function plusNearestStockSelection(target, se, availablePowers) {
    var corrective = weakestCorrectivePower(availablePowers);
    if (Math.abs(se - corrective / 2) < EPSILON) {
      var review = resolvePlanoCrossover(se, target, corrective);
      review.tieCandidates = null;
      review.stockCandidates = null;
      review.rejectedStrongerCandidates = null;
      return review;
    }

    var nearest = nearestAvailablePowerTowardZero(target, availablePowers);
    var ordered = availablePowers.slice().sort(function (a, b) {
      return Math.abs(a - target) - Math.abs(b - target) || Math.abs(a) - Math.abs(b);
    });
    var stockCandidates = ordered.slice(0, 2).map(function (power) {
      return { power: power, distanceFromTarget: Math.abs(power - target) };
    });

    return {
      power: nearest.power,
      stockStatus: "OK",
      rule: PLUS_NEAREST_STOCK_RULE,
      reason:
        "Farsighted stock selection: the nearest stocked plus power to the continuous target (" +
        formatSigned(target) +
        ") is selected; an exact tie goes to the weaker lens. Final stock power: " +
        formatSigned(nearest.power) +
        ".",
      candidates: null,
      tieCandidates: nearest.tieCandidates,
      stockCandidates: stockCandidates,
      rejectedStrongerCandidates: null
    };
  }

  /**
   * Unified final stock-power selector used by every V5.3 CYL band. Chooses
   * between the plano-crossover comparison (see above) and ordinary
   * directional stock selection, based on whether SE actually falls
   * inside the plano-crossover zone for its refractive side.
   *
   * @param {number} target - the band's continuous pre-snap target
   * @param {number} se - the spherical equivalent (signed) — used to detect and resolve the plano-crossover zone
   * @param {number[]} availablePowers - one refractive-type catalog, must include 0.00
   * @returns {{power: number|null, stockStatus: string, reason: string|null, candidates: Array|null}}
   */
  function selectStockPower(target, se, availablePowers) {
    var planoGap = planoToFirstMinusGapSelection(target, availablePowers);
    if (planoGap) return planoGap;

    if (se > EPSILON) return plusNearestStockSelection(target, se, availablePowers);

    var corrective = weakestCorrectivePower(availablePowers);

    if (Math.abs(se) < Math.abs(corrective) - EPSILON) {
      var crossover = resolvePlanoCrossover(se, target, corrective);
      crossover.tieCandidates = null;
      crossover.stockCandidates = null;
      crossover.rejectedStrongerCandidates = null;
      return crossover;
    }

    var selection = directionalStockPowerTowardZero(target, availablePowers);
    return {
      power: selection.power,
      stockStatus: "OK",
      reason: null,
      candidates: null,
      tieCandidates: null,
      stockCandidates: selection.stockCandidates,
      rejectedStrongerCandidates: selection.rejectedStrongerCandidates
    };
  }

  // ==========================================================================
  // OPTICAL VALUE CALCULATION
  // ==========================================================================

  /**
   * Recomputes SE directly from the ORIGINAL (pre-transposition) sphere
   * and cylinder, and asserts it matches the SE computed from the
   * normalized (post-transposition) values within floating-point
   * tolerance. SE is provably transposition-invariant
   * (SPH + CYL/2 == (SPH+CYL) + (-CYL)/2 for all SPH, CYL), so any
   * mismatch here means transposition itself is broken, not a rounding
   * quirk — hence this throws rather than silently logging.
   *
   * @param {{sphere:number, cylinder:number}} original
   * @param {number} normalizedSphere
   * @param {number} normalizedCylinder
   * @returns {number} originalSphericalEquivalent
   * @throws {Error} if the invariant does not hold
   */
  function assertSphericalEquivalentInvariant(original, normalizedSphere, normalizedCylinder) {
    var originalSE = original.sphere + original.cylinder / 2;
    var normalizedSE = normalizedSphere + normalizedCylinder / 2;

    if (Math.abs(originalSE - normalizedSE) > 1e-6) {
      throw new Error(
        "V5 invariant violated: original SE (" +
          originalSE.toFixed(4) +
          ") does not match normalized SE (" +
          normalizedSE.toFixed(4) +
          "). Transposition has failed for sphere=" +
          original.sphere +
          ", cylinder=" +
          original.cylinder +
          "."
      );
    }

    return originalSE;
  }

  // ==========================================================================
  // V5.3 EXPERIMENTAL RECOMMENDATION LOGIC
  // ----------------------------------------------------------------------
  // Entirely separate from V4's calcOne()/snapToHalf(). Operates on SE and
  // CYL magnitude only. AXIS plays no role (consistent with V4, and
  // consistent with "do not invent an axis-based power adjustment yet").
  // ==========================================================================

  /**
   * V5.3 keeps V5.2's single, CYL-independent underwater adjustment.
   * CYL band plays no role here; calculateEyeRecommendationV53() uses it
   * separately to select warning/confidence copy.
   *
   * @param {number} se - spherical equivalent (signed; negative = myopic side)
   * @returns {{preSnapTarget:number, finalPower:number|null, ooAdjustment:string, stockStatus:string, planoCrossoverCandidates:Array|null, tieCandidates:Array|null, underwaterAdjustmentApplied:number}}
   */
  function computeV53Recommendation(se) {
    var availablePowers = se < 0 ? V53_CONFIG.myopiaAvailablePowers : V53_CONFIG.hyperopiaAvailablePowers;
    var preSnapTarget = computeContinuousTarget(se);
    var configuredAdjustment = V53_CONFIG.underwaterAdjustmentD;
    var appliedAdjustment = Math.round((Math.abs(se) - Math.abs(preSnapTarget)) * 1e6) / 1e6;
    var wasClamped = appliedAdjustment < configuredAdjustment - EPSILON;

    var baseAdjustment =
      "Experimental Oceans Optics underwater adjustment: SE weakened by " +
      appliedAdjustment.toFixed(2) +
      "D toward zero" +
      (wasClamped ? " (clamped at plano — configured adjustment is " + configuredAdjustment.toFixed(2) + "D)" : "") +
      ". Applied identically regardless of CYL magnitude — CYL only affects the confidence/warning level shown " +
      "separately, never this adjustment. This is an experimental Oceans Optics empirical underwater adjustment " +
      "and is NOT currently claimed to be a universal physical constant.";

    var selection = selectStockPower(preSnapTarget, se, availablePowers);
    var ooAdjustment = baseAdjustment;
    if (selection.rule === "plano-to-first-minus-gap" || selection.rule === PLUS_NEAREST_STOCK_RULE) {
      ooAdjustment += " V5.3 " + selection.reason;
    } else if (selection.reason) {
      ooAdjustment +=
        " PLANO CROSSOVER " +
        (selection.stockStatus === "PLANO_CROSSOVER_REVIEW" ? "(UNRESOLVED)" : "(RESOLVED)") +
        ": " +
        selection.reason;
    } else {
      var rejected = selection.rejectedStrongerCandidates || [];
      ooAdjustment +=
        " V5.3 directional stock selection: only powers with absolute power no greater than the continuous target are eligible." +
        (rejected.length
          ? " Rejected stronger candidate" +
            (rejected.length === 1 ? " " : "s ") +
            rejected.map(function (c) { return formatSigned(c.power); }).join(" and ") +
            "."
          : "") +
        " Final stock power: " +
        formatSigned(selection.power) +
        ".";
    }

    return {
      preSnapTarget: preSnapTarget,
      finalPower: selection.power,
      ooAdjustment: ooAdjustment,
      stockStatus: selection.stockStatus,
      planoCrossoverCandidates: selection.rule ? null : selection.candidates,
      planoGapCandidates: selection.rule === "plano-to-first-minus-gap" ? selection.candidates : null,
      stockRule: selection.rule || null,
      tieCandidates: selection.tieCandidates,
      stockCandidates: selection.stockCandidates,
      rejectedStrongerCandidates: selection.rejectedStrongerCandidates,
      underwaterAdjustmentApplied: appliedAdjustment,
      effectiveWeakeningFromReference:
        selection.power === null ? null : Math.round((Math.abs(se) - Math.abs(selection.power)) * 1e6) / 1e6
    };
  }

  /**
   * Computes both existing high-CYL sphere-only references, then sends each
   * through the same V5.3 adjustment and stock-selection pipeline. The
   * caller remains responsible for applying the existing high-CYL threshold
   * and presenting the strategy choice.
   *
   * @param {number} normalizedSphere
   * @param {number} normalizedCylinder - canonical minus-cylinder value
   * @returns {{balanced:object, closerToSph:object}}
   */
  function computeStrategyRecommendationsV53(normalizedSphere, normalizedCylinder) {
    var balancedReference = normalizedSphere + normalizedCylinder / 2;
    var closerToSphReference = normalizedSphere + normalizedCylinder / 4;

    return {
      balanced: {
        reference: balancedReference,
        recommendation: computeV53Recommendation(balancedReference)
      },
      closerToSph: {
        reference: closerToSphReference,
        recommendation: computeV53Recommendation(closerToSphReference)
      }
    };
  }

  function warningForBand(cylBand) {
    if (cylBand === CYL_BAND_LOW) return null;
    if (cylBand === CYL_BAND_MEDIUM) return V53_CONFIG.warnings.medium;
    if (cylBand === CYL_BAND_HIGH) return V53_CONFIG.warnings.high;
    return V53_CONFIG.warnings.veryHigh;
  }

  var PLANO_CROSSOVER_REVIEW_WARNING_LEVEL = "plano-crossover-review";

  // ==========================================================================
  // PER-EYE ORCHESTRATION
  // ==========================================================================

  /**
   * Full V5.3 pipeline for one eye: parse -> validate -> normalize -> compute
   * optical values -> apply experimental OO adjustment -> select stock
   * power. Reuses V4's parsing/validation/transposition (not duplicated)
   * so both engines start from an identical, already-agreed-upon
   * normalized prescription; only what happens AFTER normalization
   * differs between V4 and V5.3.
   *
   * @param {{sphere:string, cylinder:string, axis:string, add:string}} rawEyeInput
   * @param {string} eyeLabel
   * @returns {object}
   */
  function calculateEyeRecommendationV53(rawEyeInput, eyeLabel) {
    var parsed = V4.parsePrescription(rawEyeInput);
    var validation = V4.validatePrescription(parsed, eyeLabel);

    if (!validation.valid) {
      return { valid: false, errors: validation.errors, version: V53_CONFIG.version };
    }

    var original = { sphere: parsed.sphere, cylinder: parsed.cylinder, axis: parsed.axis, add: parsed.add };
    var transposed = V4.transposeToMinusCylinder(original);
    var originalSphericalEquivalent = assertSphericalEquivalentInvariant(
      original,
      transposed.sphere,
      transposed.cylinder
    );

    var cylinderMagnitude = Math.abs(transposed.cylinder);
    var isPlano = Math.abs(transposed.sphere) < EPSILON && Math.abs(transposed.cylinder) < EPSILON;

    var normalized = {
      sphere: transposed.sphere,
      cylinder: transposed.cylinder,
      axis: transposed.axis,
      add: original.add,
      isPlano: isPlano
    };

    if (isPlano) {
      return {
        valid: true,
        errors: [],
        version: V53_CONFIG.version,
        original: original,
        normalized: normalized,
        meridian1: 0,
        meridian2: 0,
        sphericalEquivalent: 0,
        originalSphericalEquivalent: originalSphericalEquivalent,
        cylinderMagnitude: 0,
        cylinderBand: null,
        stockStatus: "OK",
        ooAdjustment: "True plano — no correction, V5.3 logic not applied.",
        preSnapTarget: 0,
        finalStockPower: 0,
        planoCrossoverCandidates: null,
        stockRule: null,
        tieCandidates: null,
        stockCandidates: null,
        rejectedStrongerCandidates: null,
        underwaterAdjustmentApplied: 0,
        effectiveWeakeningFromReference: 0,
        recommendation: "0.00",
        warning: null,
        manualReview: false
      };
    }

    var meridian1 = transposed.sphere;
    var meridian2 = transposed.sphere + transposed.cylinder;
    var sphericalEquivalent = transposed.sphere + transposed.cylinder / 2;
    var cylBand = getCylinderBandV53(cylinderMagnitude);

    var rec = computeV53Recommendation(sphericalEquivalent);
    var planoCrossoverUnresolved = rec.stockStatus === "PLANO_CROSSOVER_REVIEW";
    var recommendation = planoCrossoverUnresolved ? null : V4.formatLensStrength(rec.finalPower);

    var warning;
    if (planoCrossoverUnresolved) {
      warning = {
        level: PLANO_CROSSOVER_REVIEW_WARNING_LEVEL,
        message:
          "Spherical equivalent is genuinely equidistant between plano and the weakest corrective stock power for this eye — flagged for manual review rather than resolved automatically."
      };
    } else {
      warning = warningForBand(cylBand);
    }

    return {
      valid: true,
      errors: [],
      version: V53_CONFIG.version,
      original: original,
      normalized: normalized,
      meridian1: meridian1,
      meridian2: meridian2,
      sphericalEquivalent: sphericalEquivalent,
      originalSphericalEquivalent: originalSphericalEquivalent,
      cylinderMagnitude: cylinderMagnitude,
      cylinderBand: cylBand,
      stockStatus: rec.stockStatus,
      ooAdjustment: rec.ooAdjustment,
      preSnapTarget: rec.preSnapTarget,
      finalStockPower: rec.finalPower,
      planoCrossoverCandidates: rec.planoCrossoverCandidates,
      stockRule: rec.stockRule,
      tieCandidates: rec.tieCandidates,
      stockCandidates: rec.stockCandidates,
      rejectedStrongerCandidates: rec.rejectedStrongerCandidates,
      underwaterAdjustmentApplied: rec.underwaterAdjustmentApplied,
      effectiveWeakeningFromReference: rec.effectiveWeakeningFromReference,
      recommendation: recommendation,
      warning: warning,
      manualReview: planoCrossoverUnresolved || cylBand === CYL_BAND_VERY_HIGH
    };
  }

  /**
   * @param {object} rawRightInput
   * @param {object} rawLeftInput
   * @returns {{right:object, left:object, valid:boolean, errors:string[]}}
   */
  function calculatePrescriptionPairV53(rawRightInput, rawLeftInput) {
    var right = calculateEyeRecommendationV53(rawRightInput, "Right (OD)");
    var left = calculateEyeRecommendationV53(rawLeftInput, "Left (OS)");
    var errors = [].concat(right.errors || [], left.errors || []);
    return { right: right, left: left, valid: right.valid && left.valid, errors: errors };
  }

  // ==========================================================================
  // V4 vs V5.3 COMPARISON / DEBUG MODE
  // ==========================================================================

  /**
   * Runs BOTH V4 and V5.3 on the same raw eye input and returns a single
   * record with everything needed to see why they differ, at a glance.
   * Does not alter, call into private internals of, or duplicate V4's own
   * logic — just calls V4's own public calculateEyeRecommendation().
   *
   * @param {object} rawEyeInput
   * @param {string} eyeLabel
   * @returns {object}
   */
  function compareEyeV4V53(rawEyeInput, eyeLabel) {
    var v4Result = V4.calculateEyeRecommendation(rawEyeInput, eyeLabel);
    var v53Result = calculateEyeRecommendationV53(rawEyeInput, eyeLabel);

    if (!v4Result.valid || !v53Result.valid) {
      return {
        valid: false,
        errors: [].concat(v4Result.errors || [], v53Result.errors || [])
      };
    }

    return {
      valid: true,
      errors: [],
      original: v53Result.original,
      normalized: v53Result.normalized,
      meridian1: v53Result.meridian1,
      meridian2: v53Result.meridian2,
      sphericalEquivalent: v53Result.sphericalEquivalent,
      cylinderBand: v53Result.cylinderBand,
      v4Recommendation: v4Result.recommendation,
      v53Recommendation: v53Result.recommendation,
      v53OOAdjustment: v53Result.ooAdjustment,
      v53PreSnapTarget: v53Result.preSnapTarget,
      v53FinalStockPower: v53Result.finalStockPower,
      v53StockStatus: v53Result.stockStatus,
      v53PlanoCrossoverCandidates: v53Result.planoCrossoverCandidates,
      v53StockCandidates: v53Result.stockCandidates,
      v53RejectedStrongerCandidates: v53Result.rejectedStrongerCandidates,
      v53UnderwaterAdjustmentApplied: v53Result.underwaterAdjustmentApplied,
      warning: v53Result.warning,
      manualReview: v53Result.manualReview,
      changed: v4Result.recommendation !== v53Result.recommendation
    };
  }

  /**
   * @param {object} rawRightInput
   * @param {object} rawLeftInput
   * @returns {{right:object, left:object}}
   */
  function comparePrescriptionPairV4V53(rawRightInput, rawLeftInput) {
    return {
      right: compareEyeV4V53(rawRightInput, "Right (OD)"),
      left: compareEyeV4V53(rawLeftInput, "Left (OS)")
    };
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  return {
    VERSION: V53_CONFIG.version,
    V53_CONFIG: V53_CONFIG,
    CYL_BAND_LOW: CYL_BAND_LOW,
    CYL_BAND_MEDIUM: CYL_BAND_MEDIUM,
    CYL_BAND_HIGH: CYL_BAND_HIGH,
    CYL_BAND_VERY_HIGH: CYL_BAND_VERY_HIGH,

    getCylinderBandV53: getCylinderBandV53,
    nearestAvailablePower: nearestAvailablePower,
    nearestAvailablePowerTowardZero: nearestAvailablePowerTowardZero,
    directionalStockPowerTowardZero: directionalStockPowerTowardZero,
    plusNearestStockSelection: plusNearestStockSelection,
    PLUS_NEAREST_STOCK_RULE: PLUS_NEAREST_STOCK_RULE,
    computeContinuousTarget: computeContinuousTarget,
    nextWeakerAvailablePower: nextWeakerAvailablePower,
    weakestCorrectivePower: weakestCorrectivePower,
    resolvePlanoCrossover: resolvePlanoCrossover,
    selectStockPower: selectStockPower,
    planoToFirstMinusGapSelection: planoToFirstMinusGapSelection,
    assertSphericalEquivalentInvariant: assertSphericalEquivalentInvariant,
    computeV53Recommendation: computeV53Recommendation,
    computeStrategyRecommendationsV53: computeStrategyRecommendationsV53,
    calculateEyeRecommendationV53: calculateEyeRecommendationV53,
    calculatePrescriptionPairV53: calculatePrescriptionPairV53,
    compareEyeV4V53: compareEyeV4V53,
    comparePrescriptionPairV4V53: comparePrescriptionPairV4V53
  };
});
