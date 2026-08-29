/*
 * Regression / normalization / equivalence test suite for
 * assets/lens-calculator-master.js.
 *
 * Run with: node theme/learning-hub-pilot/tests/lens-calculator-master.test.js
 *
 * This is a dependency-free test runner (no test framework) so it can be
 * executed in this repository without adding a package.json/npm install
 * step to the theme folder.
 */

var path = require("path");
var LC = require(path.join(__dirname, "..", "assets", "lens-calculator-master.js"));

var pass = 0;
var fail = 0;
var failures = [];

function eye(sphere, cylinder, axis, add) {
  return {
    sphere: sphere === null ? "" : String(sphere),
    cylinder: cylinder === null ? "" : String(cylinder),
    axis: axis === null || axis === undefined ? "" : String(axis),
    add: add === null || add === undefined ? "" : String(add)
  };
}

function assertEqual(actual, expected, label) {
  var ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass++;
  } else {
    fail++;
    failures.push(label + "\n    expected: " + JSON.stringify(expected) + "\n    actual:   " + JSON.stringify(actual));
  }
}

function assertTrue(condition, label) {
  if (condition) {
    pass++;
  } else {
    fail++;
    failures.push(label + " (expected truthy)");
  }
}

console.log("=== Lens Calculator Master v" + LC.VERSION + " — Test Suite ===\n");

// --------------------------------------------------------------------------
// 1. MINUS CYL UNCHANGED
// --------------------------------------------------------------------------
(function () {
  var r = LC.calculateEyeRecommendation(eye(-3.00, -1.50, 180), "Test");
  assertEqual(r.normalized.sphere, -3.00, "1. Minus CYL unchanged: sphere");
  assertEqual(r.normalized.cylinder, -1.50, "1. Minus CYL unchanged: cylinder");
  assertEqual(r.normalized.axis, 180, "1. Minus CYL unchanged: axis");
})();

// --------------------------------------------------------------------------
// 2. PLUS CYL TRANSPOSES
// --------------------------------------------------------------------------
(function () {
  var r = LC.calculateEyeRecommendation(eye(-4.50, 1.50, 90), "Test");
  assertEqual(r.normalized.sphere, -3.00, "2. Plus CYL transposes: sphere");
  assertEqual(r.normalized.cylinder, -1.50, "2. Plus CYL transposes: cylinder");
  assertEqual(r.normalized.axis, 180, "2. Plus CYL transposes: axis");
})();

// --------------------------------------------------------------------------
// 3. EQUIVALENT PRESCRIPTIONS -> IDENTICAL RECOMMENDATION
// --------------------------------------------------------------------------
(function () {
  var a = LC.calculateEyeRecommendation(eye(-3.00, -1.50, 180), "A");
  var b = LC.calculateEyeRecommendation(eye(-4.50, 1.50, 90), "B");
  assertEqual(a.recommendation, b.recommendation, "3. Equivalent prescriptions (A vs B) give identical recommendation");
  console.log("    A (minus-cyl as written) -> normalized " + a.normalized.sphere + " / " + a.normalized.cylinder + " x " + a.normalized.axis + " -> " + a.recommendation);
  console.log("    B (plus-cyl as written)  -> normalized " + b.normalized.sphere + " / " + b.normalized.cylinder + " x " + b.normalized.axis + " -> " + b.recommendation);
})();

// --------------------------------------------------------------------------
// 4. AXIS WRAP: 100 + 90 = 190 -> 10
// --------------------------------------------------------------------------
(function () {
  var r = LC.calculateEyeRecommendation(eye(-2.00, 1.00, 100), "Test");
  assertEqual(r.normalized.axis, 10, "4. Axis wrap 100+90=190 -> 10");
})();

// --------------------------------------------------------------------------
// 5. AXIS 180 WRAP: plus-cyl axis 180 -> normalized axis 90
// --------------------------------------------------------------------------
(function () {
  var r = LC.calculateEyeRecommendation(eye(-2.00, 1.00, 180), "Test");
  assertEqual(r.normalized.axis, 90, "5. Axis 180+90=270 -> 90");
})();

// --------------------------------------------------------------------------
// 6. NO CYL -> AXIS NOT REQUIRED
// --------------------------------------------------------------------------
(function () {
  var r = LC.calculateEyeRecommendation(eye(-3.00, 0.00, null), "Test");
  assertTrue(r.valid, "6. No CYL: axis not required, prescription is valid");
  assertEqual(r.normalized.axis, null, "6. No CYL: normalized axis is null");
})();

// --------------------------------------------------------------------------
// 7. TRUE PLANO: 0.00 / 0.00 -> "0.00"
// --------------------------------------------------------------------------
(function () {
  var r = LC.calculateEyeRecommendation(eye(0.00, 0.00, null), "Test");
  assertTrue(r.valid, "7. True plano is a valid prescription");
  assertTrue(r.normalized.isPlano, "7. True plano: isPlano flag set");
  assertEqual(r.recommendation, "0.00", "7. True plano returns 0.00, not +1.00");
})();

// --------------------------------------------------------------------------
// 8. PLUS SPHERE: +3.00 / 0.00 continues through farsighted branch
// --------------------------------------------------------------------------
(function () {
  var r = LC.calculateEyeRecommendation(eye(3.00, 0.00, null), "Test");
  assertEqual(r.recommendation, "+3.00", "8. Plus sphere +3.00/0.00 -> +3.00 (farsighted branch, none band)");
})();

// --------------------------------------------------------------------------
// 9. PLUS-CYL WITH PLUS SPHERE transposes correctly before recommendation
// --------------------------------------------------------------------------
(function () {
  var r = LC.calculateEyeRecommendation(eye(2.00, 1.00, 90), "Test");
  // Transposition: sphere 2.00 + 1.00 = 3.00, cylinder -1.00, axis 90+90=180.
  assertEqual(r.normalized.sphere, 3.00, "9. +2.00/+1.00x90 transposes sphere to +3.00");
  assertEqual(r.normalized.cylinder, -1.00, "9. +2.00/+1.00x90 transposes cylinder to -1.00");
  assertEqual(r.normalized.axis, 180, "9. +2.00/+1.00x90 transposes axis to 180");
  assertEqual(r.normalized.cylinderBand, LC.CYL_BAND_MEDIUM, "9. -1.00 CYL classifies as medium band");
})();

// --------------------------------------------------------------------------
// 10. CROSS-ZERO TRANSPOSITION: branch selection uses NORMALIZED sphere
// --------------------------------------------------------------------------
(function () {
  // Original SPH -1.00, CYL +2.00 -> normalized sphere = -1.00 + 2.00 = +1.00 (crosses zero).
  var r = LC.calculateEyeRecommendation(eye(-1.00, 2.00, 45), "Test");
  assertEqual(r.normalized.sphere, 1.00, "10. Cross-zero: normalized sphere is +1.00 (positive)");
  assertTrue(r.recommendation.charAt(0) === "+" || r.recommendation === "0.00", "10. Cross-zero: recommendation uses farsighted branch (normalized sphere), not original negative sign");
})();

// --------------------------------------------------------------------------
// 11. ADD is retained but does not alter the standard result
// --------------------------------------------------------------------------
(function () {
  var withAdd = LC.calculateEyeRecommendation(eye(-3.00, -1.50, 180, 2.00), "Test");
  var withoutAdd = LC.calculateEyeRecommendation(eye(-3.00, -1.50, 180), "Test");
  assertEqual(withAdd.recommendation, withoutAdd.recommendation, "11. ADD present vs absent gives identical distance recommendation");
  assertEqual(withAdd.normalized.add, 2.00, "11. ADD is preserved in the normalized record");
  assertTrue(withAdd.addNotice === true, "11. ADD notice flag is set when ADD is present and nonzero");
  assertTrue(withoutAdd.addNotice === false, "11. ADD notice flag is false when ADD is blank");
})();

// --------------------------------------------------------------------------
// 12. TWO-EYE MIXED SIGN: computed independently, not rejected
// --------------------------------------------------------------------------
(function () {
  var pair = LC.calculatePrescriptionPair(eye(-3.00, -1.00, 90), eye(2.00, 0.00, null));
  assertTrue(pair.valid, "12. Mixed-sign pair (one minus, one plus) is valid at calculator level");
  assertTrue(pair.right.recommendation.charAt(0) === "-", "12. Right eye (minus) computed independently");
  assertTrue(pair.left.recommendation.charAt(0) === "+", "12. Left eye (plus) computed independently");
})();

// --------------------------------------------------------------------------
// 13. CYL BAND BOUNDARIES
// --------------------------------------------------------------------------
(function () {
  var cases = [
    [0.00, LC.CYL_BAND_NONE],
    [0.25, LC.CYL_BAND_LOW],
    [0.75, LC.CYL_BAND_LOW],
    [1.00, LC.CYL_BAND_MEDIUM],
    [1.75, LC.CYL_BAND_MEDIUM],
    [2.00, LC.CYL_BAND_HIGH],
    [3.00, LC.CYL_BAND_HIGH],
    [3.25, LC.CYL_BAND_VERY_HIGH]
  ];
  cases.forEach(function (c) {
    assertEqual(LC.getCylinderBand(c[0]), c[1], "13. CYL band boundary " + c[0] + " -> " + c[1]);
  });
})();

// --------------------------------------------------------------------------
// 14. CURRENT CANONICAL REGRESSION CASES
// (already-minus-cylinder inputs must match the confirmed live calcOne()
//  behavior exactly — computed directly against calcOne() with explicit
//  band/sign, bypassing normalization, to pin down the untouched algorithm.)
// --------------------------------------------------------------------------
(function () {
  var cases = [
    // [sphereMagnitude, isFar, cylBand, isCylMinus, expected]
    [2.30, false, LC.CYL_BAND_NONE, true, "-1.50"],           // none/low: frac .30 -> reduce 0.50 => target 1.80 -> weaker-snap -> 1.50
    [3.00, false, LC.CYL_BAND_MEDIUM, true, "-3.00"],         // medium, minus: target=val, nearest
    [3.00, false, LC.CYL_BAND_HIGH, true, "-3.00"],           // high: sign-independent nearest, target=val
    [3.00, false, LC.CYL_BAND_VERY_HIGH, true, "-3.50"],      // very-high minus: target=val+0.75=3.75 -> nearest-snap tie -> 3.50
    [0.50, false, LC.CYL_BAND_HIGH, true, "-1.00"],           // special-case: 0<val<=0.75 & high/very-high -> -1.00
    [2.00, true, LC.CYL_BAND_NONE, true, "+2.00"],            // far none: floor(2.00)=2
    [2.00, true, LC.CYL_BAND_MEDIUM, true, "+2.00"],          // far medium minus: floor(2.00)=2
    [2.00, true, LC.CYL_BAND_MEDIUM, false, "+2.00"],         // far medium plus: ceil(2.00)=2 (documents plus-branch is preserved)
    [2.30, true, LC.CYL_BAND_HIGH, true, "+2.00"],            // far high: round(2.30)=2
    [0.50, true, LC.CYL_BAND_LOW, true, "0.00"],              // far 0.50 special case, band != none, isCylMinus true -> 0.00
    [0.50, true, LC.CYL_BAND_LOW, false, "+1.00"]             // far 0.50 special case, plus sign -> +1.00 (preserved, unreachable post-normalization)
  ];
  cases.forEach(function (c, i) {
    var actual = LC.calcOne(c[0], c[1], c[2], c[3]);
    assertEqual(actual, c[4], "14." + (i + 1) + " calcOne(" + c[0] + ", isFar=" + c[1] + ", " + c[2] + ", isCylMinus=" + c[3] + ")");
  });
})();

// --------------------------------------------------------------------------
// TRANSPOSITION INVARIANCE PAIRS (main v4 acceptance criteria)
// --------------------------------------------------------------------------
console.log("\n--- Transposition invariance pairs ---");
(function () {
  var pairs = [
    {
      label: "Myopic, low CYL",
      minus: eye(-2.00, -0.50, 60),
      plus: eye(-2.50, 0.50, 150)
    },
    {
      label: "Myopic, medium CYL",
      minus: eye(-3.50, -1.25, 30),
      plus: eye(-4.75, 1.25, 120)
    },
    {
      label: "Myopic, high CYL",
      minus: eye(-4.00, -2.50, 170),
      plus: eye(-6.50, 2.50, 80)
    },
    {
      label: "Myopic, very-high CYL",
      minus: eye(-2.00, -3.50, 10),
      plus: eye(-5.50, 3.50, 100)
    },
    {
      label: "Hyperopic, low CYL",
      minus: eye(2.00, -0.75, 45),
      plus: eye(1.25, 0.75, 135)
    },
    {
      label: "Hyperopic, medium CYL",
      minus: eye(1.50, -1.50, 20),
      plus: eye(0.00, 1.50, 110)
    },
    {
      label: "Hyperopic, high CYL",
      minus: eye(3.00, -2.00, 5),
      plus: eye(1.00, 2.00, 95)
    }
  ];

  pairs.forEach(function (p) {
    var minusResult = LC.calculateEyeRecommendation(p.minus, p.label + " (minus-cyl)");
    var plusResult = LC.calculateEyeRecommendation(p.plus, p.label + " (plus-cyl)");

    var sameNormalized =
      Math.abs(minusResult.normalized.sphere - plusResult.normalized.sphere) < 1e-6 &&
      Math.abs(minusResult.normalized.cylinder - plusResult.normalized.cylinder) < 1e-6 &&
      minusResult.normalized.axis === plusResult.normalized.axis;

    assertTrue(sameNormalized, "Invariance [" + p.label + "]: both notations normalize identically");
    assertEqual(minusResult.recommendation, plusResult.recommendation, "Invariance [" + p.label + "]: both notations give identical recommendation");

    console.log(
      "    " + p.label + ": minus-cyl(" + p.minus.sphere + "/" + p.minus.cylinder + "x" + p.minus.axis + ") -> " + minusResult.recommendation +
      "   |   plus-cyl(" + p.plus.sphere + "/" + p.plus.cylinder + "x" + p.plus.axis + ") -> " + plusResult.recommendation +
      "   |   normalized: " + minusResult.normalized.sphere + "/" + minusResult.normalized.cylinder + "x" + minusResult.normalized.axis
    );
  });
})();

// --------------------------------------------------------------------------
// VALIDATION EDGE CASES
// --------------------------------------------------------------------------
console.log("\n--- Validation edge cases ---");
(function () {
  var blankSph = LC.calculateEyeRecommendation(eye(null, 0.00, null), "Test");
  assertTrue(!blankSph.valid, "Validation: blank SPH is rejected");

  var blankCyl = LC.calculateEyeRecommendation(eye(-3.00, null, null), "Test");
  assertTrue(!blankCyl.valid, "Validation: blank CYL is rejected (not silently treated as 0)");

  var missingAxis = LC.calculateEyeRecommendation(eye(-3.00, -1.00, null), "Test");
  assertTrue(!missingAxis.valid, "Validation: CYL != 0 without AXIS is rejected");

  var badAxisRange = LC.calculateEyeRecommendation(eye(-3.00, -1.00, 181), "Test");
  assertTrue(!badAxisRange.valid, "Validation: AXIS out of 1-180 range is rejected");

  var malformed = LC.calculateEyeRecommendation(eye(-3.00, "abc", null), "Test");
  assertTrue(!malformed.valid, "Validation: malformed CYL is rejected clearly");

  var nonStepSph = LC.calculateEyeRecommendation(eye(-3.10, 0.00, null), "Test");
  assertTrue(!nonStepSph.valid, "Validation: SPH not on a 0.25 step is rejected");
})();

// --------------------------------------------------------------------------
// SUMMARY
// --------------------------------------------------------------------------
console.log("\n=== Results: " + pass + " passed, " + fail + " failed ===");
if (failures.length) {
  console.log("\nFailures:");
  failures.forEach(function (f) {
    console.log("  - " + f);
  });
  process.exitCode = 1;
} else {
  console.log("All tests passed.");
}
