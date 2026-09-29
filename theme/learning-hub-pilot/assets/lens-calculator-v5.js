/*
 * ============================================================================
 * OCEANS OPTICS LENS CALCULATOR — V5.2 (EXPERIMENTAL)
 * ============================================================================
 *
 * STATUS: EXPERIMENTAL. NOT VALIDATED. NOT DEPLOYED. NOT WIRED INTO ANY
 * LIVE OR PUBLISHED SHOPIFY THEME. Not clinically validated. Not a medical
 * claim of accuracy. Exists purely so Legacy and V5.2 can be run side by
 * side on real prescriptions and manually compared before any decision is
 * made. The 0.50D underwater adjustment below is an EXPERIMENTAL OCEANS
 * OPTICS EMPIRICAL HYPOTHESIS — it is NOT currently claimed to be a
 * universal physical constant, and has not yet been validated against
 * mask optical modelling, underwater comparison, or customer/tested-lens
 * outcomes.
 *
 * This file does NOT replace, modify, or remove
 * `lens-calculator-master.js` (the production/Legacy engine) or
 * `legacy-calculator-adapter.js`. Both remain fully intact and continue to
 * pass their own, unmodified regression suites.
 *
 * ----------------------------------------------------------------------
 * V5.2 METHODOLOGY CHANGE (2026-09-08) — STOCK-TIE DIRECTION CORRECTED
 * ----------------------------------------------------------------------
 * V5.1 introduced an exact-tie rule that, on a stock tie, favored whichever
 * candidate was closer to the ORIGINAL SE. Real-prescription testing (the
 * -6.75/+3.00 x130 case, SE -5.25, target -4.75, tied between -5.00 and
 * -4.50) showed this was conceptually wrong: choosing -5.00 moves BACK
 * TOWARD SE, partially reversing the underwater adjustment that had just
 * been deliberately applied. There is no rationale for a tie-break rule
 * that undoes the adjustment it's supposed to be resolving.
 *
 * V5.2 corrects this: on an exact stock tie, the selector continues in the
 * SAME DIRECTION as the underwater adjustment — toward zero — by choosing
 * the candidate with the smaller absolute power. For the case above, that
 * is -4.50, not -5.00. See nearestAvailablePowerTowardZero() below. This is
 * NOT described as "round toward SPH": with small CYL the 0.50D adjustment
 * can move the target beyond the normalized SPH value, so "toward zero" is
 * the only correct characterization of the rule.
 *
 * V5.1's separation of concepts is otherwise unchanged and fully preserved:
 *   1. SPHERICAL EQUIVALENT — the sphere-only optical reference (SPH + CYL/2).
 *   2. OCEANS OPTICS UNDERWATER ADJUSTMENT — a single, CYL-independent,
 *      provisional empirical weakening of SE (see underwaterAdjustmentD
 *      below). This is applied IDENTICALLY regardless of how much
 *      astigmatism is present.
 *   3. CYL MAGNITUDE — now controls confidence/warning/approximation
 *      level ONLY (see warningForBand()), never the adjustment amount.
 *
 * The plano-crossover special case (see that section below) is preserved
 * completely unchanged in its own logic — it still resolves near-zero SE
 * cases by comparing distance to the ORIGINAL SE, not to the shifted
 * continuous target, and still returns PLANO_CROSSOVER_REVIEW rather than
 * guessing when genuinely ambiguous. It takes precedence over the generic
 * stock-tie rule whenever SE falls inside the crossover zone.
 *
 * ----------------------------------------------------------------------
 * WHY V5 (AND NOW V5.2) EXIST AT ALL
 * ----------------------------------------------------------------------
 * The production/Legacy engine (`calcOne()`/`snapToHalf()`, preserved
 * verbatim in `lens-calculator-master.js` and reused read-only by
 * `legacy-calculator-adapter.js`) uses the normalized SPH magnitude as its
 * starting point. Normalized SPH is only ONE of the two principal
 * meridian powers of an astigmatic eye — it is not the eye's overall mean
 * spherical requirement. `content-development/research/LENS-CALCULATOR-SOURCE-OF-TRUTH.md`
 * records that James found real-Rx cases where that approach produces
 * recommendations that read as too weak, and marked the underlying
 * empirical model "UNDER REVIEW / MANUAL VALIDATION REQUIRED".
 *
 * V5 (and now V5.2) are candidate answers to that open review, built on a
 * different starting principle: for a sphere-only stock lens, the
 * SPHERICAL EQUIVALENT (SE = normalized SPH + normalized CYL / 2) — the
 * mean power across both principal meridians — is a more defensible
 * optical starting point than either individual meridian.
 *
 * NORMALIZATION NOTE: normalization (transposition to minus-cylinder
 * notation) does NOT remove astigmatism and does NOT itself determine the
 * recommended stock lens. It exists only so equivalent prescriptions
 * (however an optometrist chose to notate them) are guaranteed to reach
 * this module in one canonical internal representation. SE, computed from
 * the normalized values, is itself provably notation-invariant, so this
 * guarantee is what makes V5.2's recommendation notation-invariant too.
 *
 * ----------------------------------------------------------------------
 * WHAT THIS FILE DELIBERATELY DOES NOT DO
 * ----------------------------------------------------------------------
 * - Does not assume normalized SPH is the overall spherical requirement.
 * - Does not let CYL magnitude change the underwater adjustment amount —
 *   CYL band now affects warning/confidence text ONLY.
 * - Does not treat +CYL and -CYL as different severity types — both are
 *   transposed to the same canonical minus-cylinder form before any V5.2
 *   logic runs, and a plus-cylinder input and its minus-cylinder
 *   equivalent always reach computeV5Recommendation() with identical
 *   normalized values.
 * - Does not blindly reuse Legacy's plus-CYL/minus-CYL calcOne() sub-branches;
 *   V5.2 has its own recommendation logic entirely, built around SE only.
 * - Does not apply Legacy's very-high-band +/-0.75 offset.
 * - Does not add an AXIS-based power adjustment (AXIS is normalized and
 *   retained for completeness/debugging only — see normalizeAxisValue via
 *   the shared production module).
 * - Does not change the production engine's snapToHalf() or its tie-break.
 *   V5.2 has its own, separate, explicitly-coded stock-power selector.
 * - Does not allow the continuous underwater-adjustment target to cross
 *   zero (clamped at plano; see computeContinuousTarget()).
 * - Does not resolve an exact stock tie back toward SE (that was V5.1's
 *   mistake) — it continues toward zero, in the same direction as the
 *   underwater adjustment itself (see nearestAvailablePowerTowardZero()).
 * - Does not publish, sync, or wire into any live theme.
 * - Does not claim clinical validation of the 0.50D adjustment value.
 *
 * Version: 5.2.0-experimental
 * Created: 2026-09-04 (5.0.0) — Revised: 2026-09-06 (5.1.0) — Revised: 2026-09-08 (5.2.0)
 * ============================================================================
 */

(function (root, factory) {
  var v4 =
    typeof module === "object" && module !== null && typeof module.exports !== "undefined"
      ? require("./lens-calculator-master.js")
      : root.OOLensCalculator;

  if (!v4) {
    throw new Error(
      "lens-calculator-v5.js requires lens-calculator-master.js (V4) to be loaded first — " +
        "V5 reuses V4's parsing/validation/normalization, it does not duplicate them."
    );
  }

  var api = factory(v4);

  if (typeof module !== "object" || module === null || typeof module.exports === "undefined") {
    root.OOLensCalculatorV5 = api;
  } else {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (V4) {
  "use strict";

  var EPSILON = 1e-9;

  // ==========================================================================
  // V5 CONFIGURATION — every tunable experimental constant lives here.
  // Nothing below this block should hardcode a diopter offset, a band
  // boundary, or a stock-power list inline; everything reads from here so
  // the experimental model can be re-tuned from one place.
  // ==========================================================================

  var V5_CONFIG = {
    version: "5.2.0-experimental",

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
  function getCylinderBandV5(absCylinder) {
    var v = Math.abs(absCylinder);
    if (v <= V5_CONFIG.lowCylinderMax + EPSILON) return CYL_BAND_LOW;
    if (v <= V5_CONFIG.mediumCylinderMax + EPSILON) return CYL_BAND_MEDIUM;
    if (v <= V5_CONFIG.highCylinderMax + EPSILON) return CYL_BAND_HIGH;
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
   * V5.2's continuous underwater-adjustment target (unchanged from V5.1 —
   * see V5_CONFIG.underwaterAdjustmentD and the module banner's "V5.2
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
    var magnitude = Math.max(Math.abs(se) - V5_CONFIG.underwaterAdjustmentD, 0);
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
   * The LOW band now uses `computeV5Recommendation()`'s own
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

  /**
   * Unified final stock-power selector used by every V5 CYL band. Chooses
   * between the plano-crossover comparison (see above) and ordinary
   * nearest-to-target selection, based on whether SE actually falls
   * inside the plano-crossover zone for its refractive side.
   *
   * @param {number} target - the band's continuous pre-snap target
   * @param {number} se - the spherical equivalent (signed) — used to detect and resolve the plano-crossover zone
   * @param {number[]} availablePowers - one refractive-type catalog, must include 0.00
   * @returns {{power: number|null, stockStatus: string, reason: string|null, candidates: Array|null}}
   */
  function selectStockPower(target, se, availablePowers) {
    var corrective = weakestCorrectivePower(availablePowers);

    if (Math.abs(se) < Math.abs(corrective) - EPSILON) {
      var crossover = resolvePlanoCrossover(se, target, corrective);
      crossover.tieCandidates = null;
      return crossover;
    }

    var selection = nearestAvailablePowerTowardZero(target, availablePowers);
    return { power: selection.power, stockStatus: "OK", reason: null, candidates: null, tieCandidates: selection.tieCandidates };
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
  // V5 EXPERIMENTAL RECOMMENDATION LOGIC
  // ----------------------------------------------------------------------
  // Entirely separate from V4's calcOne()/snapToHalf(). Operates on SE and
  // CYL magnitude only. AXIS plays no role (consistent with V4, and
  // consistent with "do not invent an axis-based power adjustment yet").
  // ==========================================================================

  /**
   * @param {number} se - spherical equivalent (signed; negative = myopic side)
   * @param {string} cylBand - one of the CYL_BAND_* constants
   * @returns {{preSnapTarget:number, finalPower:number|null, ooAdjustment:string, stockStatus:string, planoCrossoverCandidates:Array|null}}
   */
  /**
   * V5.2: the underwater adjustment is a single, CYL-independent
   * function of SE alone (unchanged from V5.1 — see module banner "V5.2
   * METHODOLOGY CHANGE"). CYL band plays NO role here any more — it is passed to
   * calculateEyeRecommendationV5() separately, purely to select a
   * warning/confidence message (see warningForBand()).
   *
   * @param {number} se - spherical equivalent (signed; negative = myopic side)
   * @returns {{preSnapTarget:number, finalPower:number|null, ooAdjustment:string, stockStatus:string, planoCrossoverCandidates:Array|null, tieCandidates:Array|null, underwaterAdjustmentApplied:number}}
   */
  function computeV5Recommendation(se) {
    var availablePowers = se < 0 ? V5_CONFIG.myopiaAvailablePowers : V5_CONFIG.hyperopiaAvailablePowers;
    var preSnapTarget = computeContinuousTarget(se);
    var configuredAdjustment = V5_CONFIG.underwaterAdjustmentD;
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
    if (selection.reason) {
      ooAdjustment +=
        " PLANO CROSSOVER " +
        (selection.stockStatus === "PLANO_CROSSOVER_REVIEW" ? "(UNRESOLVED)" : "(RESOLVED)") +
        ": " +
        selection.reason;
    } else if (selection.tieCandidates) {
      ooAdjustment +=
        " EXACT STOCK TIE at target " +
        formatSigned(preSnapTarget) +
        " between " +
        selection.tieCandidates.map(function (c) { return formatSigned(c.power); }).join(" and ") +
        " — continuing in the direction of the underwater adjustment (toward zero): " +
        formatSigned(selection.power) +
        ".";
    }

    return {
      preSnapTarget: preSnapTarget,
      finalPower: selection.power,
      ooAdjustment: ooAdjustment,
      stockStatus: selection.stockStatus,
      planoCrossoverCandidates: selection.candidates,
      tieCandidates: selection.tieCandidates,
      underwaterAdjustmentApplied: appliedAdjustment
    };
  }

  function warningForBand(cylBand) {
    if (cylBand === CYL_BAND_LOW) return null;
    if (cylBand === CYL_BAND_MEDIUM) return V5_CONFIG.warnings.medium;
    if (cylBand === CYL_BAND_HIGH) return V5_CONFIG.warnings.high;
    return V5_CONFIG.warnings.veryHigh;
  }

  var PLANO_CROSSOVER_REVIEW_WARNING_LEVEL = "plano-crossover-review";

  // ==========================================================================
  // PER-EYE ORCHESTRATION
  // ==========================================================================

  /**
   * Full V5 pipeline for one eye: parse -> validate -> normalize -> compute
   * optical values -> apply experimental OO adjustment -> select stock
   * power. Reuses V4's parsing/validation/transposition (not duplicated)
   * so both engines start from an identical, already-agreed-upon
   * normalized prescription; only what happens AFTER normalization
   * differs between V4 and V5.
   *
   * @param {{sphere:string, cylinder:string, axis:string, add:string}} rawEyeInput
   * @param {string} eyeLabel
   * @returns {object}
   */
  function calculateEyeRecommendationV5(rawEyeInput, eyeLabel) {
    var parsed = V4.parsePrescription(rawEyeInput);
    var validation = V4.validatePrescription(parsed, eyeLabel);

    if (!validation.valid) {
      return { valid: false, errors: validation.errors, version: V5_CONFIG.version };
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
        version: V5_CONFIG.version,
        original: original,
        normalized: normalized,
        meridian1: 0,
        meridian2: 0,
        sphericalEquivalent: 0,
        originalSphericalEquivalent: originalSphericalEquivalent,
        cylinderMagnitude: 0,
        cylinderBand: null,
        stockStatus: "OK",
        ooAdjustment: "True plano — no correction, V5.2 logic not applied.",
        preSnapTarget: 0,
        finalStockPower: 0,
        planoCrossoverCandidates: null,
        tieCandidates: null,
        underwaterAdjustmentApplied: 0,
        recommendation: "0.00",
        warning: null,
        manualReview: false
      };
    }

    var meridian1 = transposed.sphere;
    var meridian2 = transposed.sphere + transposed.cylinder;
    var sphericalEquivalent = transposed.sphere + transposed.cylinder / 2;
    var cylBand = getCylinderBandV5(cylinderMagnitude);

    var rec = computeV5Recommendation(sphericalEquivalent);
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
      version: V5_CONFIG.version,
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
      tieCandidates: rec.tieCandidates,
      underwaterAdjustmentApplied: rec.underwaterAdjustmentApplied,
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
  function calculatePrescriptionPairV5(rawRightInput, rawLeftInput) {
    var right = calculateEyeRecommendationV5(rawRightInput, "Right (OD)");
    var left = calculateEyeRecommendationV5(rawLeftInput, "Left (OS)");
    var errors = [].concat(right.errors || [], left.errors || []);
    return { right: right, left: left, valid: right.valid && left.valid, errors: errors };
  }

  // ==========================================================================
  // V4 vs V5 COMPARISON / DEBUG MODE
  // ==========================================================================

  /**
   * Runs BOTH V4 and V5 on the same raw eye input and returns a single
   * record with everything needed to see why they differ, at a glance.
   * Does not alter, call into private internals of, or duplicate V4's own
   * logic — just calls V4's own public calculateEyeRecommendation().
   *
   * @param {object} rawEyeInput
   * @param {string} eyeLabel
   * @returns {object}
   */
  function compareEyeV4V5(rawEyeInput, eyeLabel) {
    var v4Result = V4.calculateEyeRecommendation(rawEyeInput, eyeLabel);
    var v5Result = calculateEyeRecommendationV5(rawEyeInput, eyeLabel);

    if (!v4Result.valid || !v5Result.valid) {
      return {
        valid: false,
        errors: [].concat(v4Result.errors || [], v5Result.errors || [])
      };
    }

    return {
      valid: true,
      errors: [],
      original: v5Result.original,
      normalized: v5Result.normalized,
      meridian1: v5Result.meridian1,
      meridian2: v5Result.meridian2,
      sphericalEquivalent: v5Result.sphericalEquivalent,
      cylinderBand: v5Result.cylinderBand,
      v4Recommendation: v4Result.recommendation,
      v5Recommendation: v5Result.recommendation,
      v5OOAdjustment: v5Result.ooAdjustment,
      v5PreSnapTarget: v5Result.preSnapTarget,
      v5FinalStockPower: v5Result.finalStockPower,
      v5StockStatus: v5Result.stockStatus,
      v5PlanoCrossoverCandidates: v5Result.planoCrossoverCandidates,
      v5TieCandidates: v5Result.tieCandidates,
      v5UnderwaterAdjustmentApplied: v5Result.underwaterAdjustmentApplied,
      warning: v5Result.warning,
      manualReview: v5Result.manualReview,
      changed: v4Result.recommendation !== v5Result.recommendation
    };
  }

  /**
   * @param {object} rawRightInput
   * @param {object} rawLeftInput
   * @returns {{right:object, left:object}}
   */
  function comparePrescriptionPairV4V5(rawRightInput, rawLeftInput) {
    return {
      right: compareEyeV4V5(rawRightInput, "Right (OD)"),
      left: compareEyeV4V5(rawLeftInput, "Left (OS)")
    };
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  return {
    VERSION: V5_CONFIG.version,
    V5_CONFIG: V5_CONFIG,
    CYL_BAND_LOW: CYL_BAND_LOW,
    CYL_BAND_MEDIUM: CYL_BAND_MEDIUM,
    CYL_BAND_HIGH: CYL_BAND_HIGH,
    CYL_BAND_VERY_HIGH: CYL_BAND_VERY_HIGH,

    getCylinderBandV5: getCylinderBandV5,
    nearestAvailablePower: nearestAvailablePower,
    nearestAvailablePowerTowardZero: nearestAvailablePowerTowardZero,
    computeContinuousTarget: computeContinuousTarget,
    nextWeakerAvailablePower: nextWeakerAvailablePower,
    weakestCorrectivePower: weakestCorrectivePower,
    resolvePlanoCrossover: resolvePlanoCrossover,
    selectStockPower: selectStockPower,
    assertSphericalEquivalentInvariant: assertSphericalEquivalentInvariant,
    computeV5Recommendation: computeV5Recommendation,
    calculateEyeRecommendationV5: calculateEyeRecommendationV5,
    calculatePrescriptionPairV5: calculatePrescriptionPairV5,
    compareEyeV4V5: compareEyeV4V5,
    comparePrescriptionPairV4V5: comparePrescriptionPairV4V5
  };
});
