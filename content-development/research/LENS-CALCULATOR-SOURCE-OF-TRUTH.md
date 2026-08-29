# Lens Calculator — Source of Truth

Research document only. No calculator code was changed. No lesson copy was written. This document exists to establish what the Oceans Optics Lens Calculator actually does today, before R31 can be drafted or externally verified.

## CURRENT CANONICAL OPERATIONAL CALCULATOR

**CURRENT CANONICAL: James-confirmed live-site calculator code, supplied and explicitly confirmed 2026-08-28.**

This is the authoritative record of what the Oceans Optics Underwater Lens Calculator does today. Repository implementations are classified below by how closely they match this confirmed algorithm — where a repository copy differs, **the confirmed live code wins for describing current behavior**, regardless of which repository file it appears in.

**Status of the methodology itself (2026-08-28):** James has confirmed the current calculator methodology — the CYL-band adjustment/rounding rules documented below — has already been tested extensively, iterated in practice, trialed with real users, and evaluated underwater in the environment it is intended for. It is recorded here as **CURRENT OCEANS OPTICS OPERATIONAL METHODOLOGY + INTERNALLY / EMPIRICALLY VALIDATED**. The external research pass described later in this document is not an attempt to replace, redesign, or mathematically re-derive this methodology, and the absence of an identical published formula elsewhere is not evidence against it. External verification targets the *educational explanations* used to teach standard optical concepts (myopia, hyperopia, SPH, CYL, AXIS, ADD, astigmatism, sphere-only lenses, plano, underwater light behavior, and why a glasses prescription and an underwater lens recommendation may differ) — not the Oceans Optics-specific adjustment amounts themselves. See "Claims Requiring External Verification" and "Ready for External Optics Verification" below for the exact boundary.

## Files Found (full repository search performed)

- `theme/learning-hub-pilot/sections/lens-calculator.liquid` — byte-identical to `theme/base/sections/lens-calculator.liquid` — Shopify schema name **"Lens Calculator Main"** — on-page heading: **"Use Our Exclusive Underwater Lens Calculator Tool"** — rendered as a dedicated page via `templates/page.lens-page.json`, and also embedded in `page.nearsighted-or-farsighted.json`, `page.rx_titan_size_guide.json`, `page.flippin-fins-sizing.json`, `index.json`, `page.json`, `article.json`, `collection.say-goodbye-to-irritated.json`
- `theme/learning-hub-pilot/sections/lens-calc-tool-product.liquid` — byte-identical to `theme/base/sections/lens-calc-tool-product.liquid` — Shopify schema name **"Lens-Calc-tool-product"** — embedded directly on individual mask product page templates (`product.rx-lumix-white.json`, `product.rx_titan_scuba_dive_mask.json`, `product.the-reef-rover.json`, `product.new-obisdian-with-snorkel.json`, `product.far-obsidian-waitlist.json`, `product.rover-rx-scuba-mask-white.json`, `product.obsidian-clear-with-snork.json`, `product.rx-lumix-dive-mask.json`, and more), plus `page.find-your-perfect-mask.json` and `collection.all-our-masks.json`
- **NOT FOUND anywhere in this repository**, despite a full-repo search: `lens-calculator-main.txt`, `components/lensCalculator.tsx`, any "Project Hub" documentation file or directory. If James has these outside this repository, they were not supplied as literal text in this session and could not be compared.
- `theme/learning-hub-pilot/sections/fs-cylinder-guide.liquid`, `ns-cylinder-guide.liquid` — worked-example rounding-table guides, not algorithm implementations (already classified LEGACY in `R01-R31-SCOPE-APPROVAL.md`; re-confirmed below against the actual `calcOne()` arithmetic)
- `theme/learning-hub-pilot/templates/page.which-lens-astigmatism.json` — long-form educational copy, not an algorithm implementation
- `theme/learning-hub-pilot/assets/maskData.js`, `snippets/mask_lens_database.liquid` — product/model data (identical in `theme/base` and `theme/learning-hub-pilot`); feeds the mask-matching step inside `lens-calculator.liquid` only

## Classification

| Source | Classification | Basis |
| --- | --- | --- |
| Confirmed live code (James, 2026-08-28) | **CURRENT CANONICAL** | Authoritative record of what the calculator does today; documented in full below |
| `sections/lens-calc-tool-product.liquid` ("Lens-Calc-tool-product") | **CURRENT CANONICAL MATCH** | Matches the confirmed algorithm on every documented rule, including the nearsighted "high" CYL band (sign-independent, `bias = "nearest"`). Embedded on real product pages; has no mask-catalog-matching step. |
| `sections/lens-calculator.liquid` ("Lens Calculator Main") | **CURRENT, WITH ONE CONFLICTING RULE** | Matches the confirmed algorithm everywhere except the nearsighted "high" CYL band, where this repository copy uses a CYL-sign-dependent bias (`"stronger"`/`"weaker"`) instead of the confirmed `"nearest"` — see "Resolved: High-CYL Conflict" below. This is the dedicated calculator page (`page.lens-page.json`) and also contains the mask-catalog-matching step and the mixed-eye "contact us" copy. |
| `sections/fs-cylinder-guide.liquid`, `ns-cylinder-guide.liquid` | **LEGACY / STALE relative to the current algorithm** | Worked-example whole-number rounding tables that do not reproduce the confirmed algorithm's actual arithmetic (see comparison below) |
| `templates/page.which-lens-astigmatism.json` | **LEGACY** | Educational-page copy, not algorithm logic; contains the "ignore AXIS" simplification, unverified |
| `templates/page.nearsighted-or-farsighted.json` | **LEGACY** | Educational-page copy (definitions), even though the page also embeds a current calculator section |
| `assets/maskData.js`, `snippets/mask_lens_database.liquid` | **CURRENT, SUPPORTING** | Live product/model data feeding the mask-catalog-matching step; time-sensitive |
| `lens-calculator-main.txt`, `components/lensCalculator.tsx`, Project Hub docs | **UNCERTAIN — NOT FOUND IN REPOSITORY** | No such files exist anywhere in this repo; cannot be classified or compared |

## Confirmed Inputs (verified identical in both implementations)

- Right/left eye **SPH**: numeric field, parsed as a float; the UI's stepper/labeling implies 0.25 increments per James's description, but the code itself (`parseFloat(...) || 0`) does not reject non-0.25 values if one were typed manually
- Right/left eye **SPH sign**: `+` or `−` button toggle; starts as `+/-` (unselected); calculation is blocked with an error message until both are set
- Right/left eye **CYL band**: a dropdown/select with exactly these string values in the code: `none`, `low`, `medium`, `high`, `very-high`
- Right/left eye **CYL sign**: `+` or `−` button toggle; required unless the CYL band is `none`
- **No AXIS input** in either implementation
- **No ADD input** in either implementation

This confirms James's description on every point that could be checked directly against the code. **This is an operational fact about what the tool asks for — it is not, by itself, evidence that AXIS or ADD are optically irrelevant.** See "Claims Requiring External Verification" below.

## Confirmed Algorithm — `calcOne()`

Both implementations compute each eye **independently** — the function is called once per eye with that eye's own SPH/sign/CYL band/CYL sign, and nothing about the other eye is passed in. There is no cross-eye logic inside `calcOne()` itself in either file.

### FARSIGHTED / PLUS SPH (identical in both implementations)

```
input: val = max(0, SPH magnitude), CYL band, CYL sign

SPECIAL CASE — val is 0.50 or 0.75 (within floating-point tolerance):
  if CYL sign is "+" (or CYL band is "none") → output 0.00
  else (CYL sign is "-" and a CYL band is set) → output +1.00

OTHERWISE, by CYL band:
  none or low  → result = floor(val)
                 if result == 0 → result = 1        [see Plano note below]
  medium       → CYL sign "-" → result = floor(val)
                 CYL sign "+" → result = ceil(val)
  high         → result = round(val)
  very-high    → CYL sign "-" → result = round(max(0, val - 0.75))
                 CYL sign "+" → result = round(val + 0.75)

CLAMPING (all bands):
  if result > 5.00 → result = 5.00        [maximum +5.00 output, confirmed]
  if 0 < result < 1.00 → result = 1.00    [non-zero minimum recommendation, confirmed]
  if result == 0 → output "0.00"
  else → output "+{result}"
```

### NEARSIGHTED / MINUS SPH

**Identical in both implementations**, except where marked:

```
input: val = max(0, SPH magnitude), CYL band, CYL sign

SPECIAL CASE — 0 < val <= 0.75, AND CYL band is "high" or "very-high":
  → output -1.00 directly, skipping the general logic below

OTHERWISE, by CYL band, compute a target and a rounding bias:
  none or low  → reduce = 0.25 if the fractional part of val is .25 or .75, else 0.50
                 target = max(0, val - reduce); bias = "weaker" (round down toward zero)

  medium       → CYL sign "-" → target = val; bias = "nearest"
                 CYL sign "+" → target = max(0, val - 0.50); bias = "weaker"

  high (2.00–3.00) → CONFIRMED CANONICAL: target = val (SPH magnitude); bias = "nearest"
                 This band does NOT vary by CYL sign. One repository file
                 conflicts with this — see "Resolved: High-CYL Conflict" below.

  very-high (3.25+) → CYL sign "-" → target = val + 0.75; bias = "nearest"
                 CYL sign "+" → target = max(0, val - 0.75); bias = "nearest"
                 This band DOES vary by CYL sign, confirmed.

Then snap `target` to the nearest half-diopter (0.50 step) using the bias
  ("weaker" rounds down/toward zero, "stronger" rounds up/away from zero,
   "nearest" rounds to the closer half-step)

CLAMPING:
  if result > 9.00 → result = 9.00        [maximum -9.00 output, confirmed]
  if 0 < result < 1.00 → result = 1.00    [non-zero minimum recommendation, confirmed]
  if result == 0 → output "0.00" (Main) or "0" (Product widget — cosmetic difference only)
  else → output "-{result}"
```

## Resolved: High-CYL Conflict

**Nearsighted, CYL band = "high" (2.00–3.00): confirmed canonical behavior is `target = SPH magnitude`, `bias = "nearest"`, and this does not vary by CYL sign.**

The repository copy of `lens-calculator.liquid` ("Lens Calculator Main") does not match this — its "high" band uses a CYL-sign-dependent bias instead (`"stronger"` for CYL sign `-`, `"weaker"` for CYL sign `+`). **This repository file's "high" band rule is classified CONFLICTING / STALE relative to the confirmed canonical algorithm.** The repository copy of `lens-calc-tool-product.liquid` already matches the confirmed canonical rule exactly.

This is now a resolved *identification* question (the canonical rule is the sign-independent "nearest" rule), but remains an open *repository-maintenance* question: why the `lens-calculator.liquid` file in this repository contains a different, non-canonical rule for this one band — whether it's an unsynced copy of an older live version, a deliberate variant, or a mistake — is for James to determine. **No calculator file is edited in this task.**

**Secondary, cosmetic-only difference:** the `lens-calculator.liquid` repository copy formats a zero-diopter nearsighted result as `"0.00"`; `lens-calc-tool-product.liquid` formats it as `"0"`. Same value, different display string. Low priority, unaffected by the canonical-behavior finding above.

## Plano / 0.00 — Documented Behavior

There is **no dedicated "Plano" or "no correction" selector** in either tool. A customer enters SPH magnitude `0.00` and must still choose a `+` or `−` sign before the calculator will run.

**SPH = 0.00, sign = "−" (minus), CYL band = "none":** the nearsighted branch computes `target = max(0, 0 - 0.50) = 0`, which snaps to `0`, and the function returns `"0.00"` (Main) or `"0"` (Product widget). **This behaves as expected for plano.**

**SPH = 0.00, sign = "+" (plus), CYL band = "none":** the farsighted branch's `none`/`low` rule computes `result = floor(0) = 0`, then a line specific to that branch forces `if (result == 0) result = 1` — **the function returns `"+1.00"`, not `"0.00"`.** This happens in **both** implementations identically.

**Confirmed, exact behavior:**
- **Minus-SPH path:** SPH 0.00 can return `0` / no correction (plano-consistent).
- **Plus-SPH path:** with SPH 0.00 and no/low CYL, the farsighted branch forces the result from zero to **+1.00** — not plano. This happens identically in both repository implementations (the zero-forcing line exists only in the `none`/`low` branch; the `medium`/`high`/`very-high` branches, if fed SPH=0 with a CYL band selected, correctly fall through to `if (result == 0) return "0.00"` and are not forced to 1).

This asymmetry is **CURRENT IMPLEMENTATION BEHAVIOR**. It is not assumed to be intentional or unintentional.

**Classification: PRODUCT / UX INTENT REVIEW REQUIRED.**

**Instruction for R31:** the lesson must not teach that +0.00 means +1.00. Plano remains educationally described as **"plano (0.00 / no corrective power)"** until James decides whether the calculator's +0.00 behavior is a bug, an intended rule, or an irrelevant user-entry edge case (a real customer with no farsighted correction would have no reason to select a "+" sign at all). This question does not block external optical verification of the plano concept itself.

## Mixed Nearsighted / Farsighted Eyes — Calculator Capability vs. Product Capability

**Confirmed canonical: each eye is passed independently to `calcOne()`, and there is no mixed-sign rejection in the calculation itself.** Both eyes' lens strengths are computed regardless of whether the signs match. Any earlier statement that "the current calculator cannot calculate one nearsighted eye plus one farsighted eye" is incorrect and has been removed from the R01 and R31 briefs.

**The restriction that does exist is a separate, later step, found in the repository copy of `lens-calculator.liquid` only, not in `lens-calc-tool-product.liquid`.** After computing and displaying both results, `lens-calculator.liquid`'s `calculateLensStrength()` runs a mask-catalog-matching step, and that step contains this explicit check:

```
if (leftSign !== rightSign) {
  grid.innerHTML = 'We currently do not have masks that support different
  lens types (nearsighted + farsighted) for each eye. Please contact us
  for custom solutions.';
  return;
}
```

This is a **PRODUCT / MASK-CATALOG CAPABILITY** restriction (no single off-the-shelf SKU in `maskData.js` spans both a nearsighted and a farsighted lens), not a limitation of the calculation itself. The calculator will tell a customer their correct lens strength for each eye either way; it is the *product-matching* step that cannot find something to sell them.

`lens-calc-tool-product.liquid` has no mask-matching step at all — it only ever displays the two computed numbers, because it's embedded on a page for one specific, already-chosen product.

**Calculator capability and product capability are kept separate throughout R01 and R31:** the calculator computes a mixed-sign result; the current product catalog cannot fulfill it; "contact us for custom solutions" is `lens-calculator.liquid`'s own live copy for this exact case, so it is safe to keep referencing that phrase specifically (not a paraphrase), pending confirmation that this is still the current support process — that confirmation is a product-process question, not a calculator-identity question, and does not block external optical verification.

## Two Kinds of Claim — Where External Verification Does and Doesn't Apply

Every claim connected to this calculator falls into one of two categories, and they are verified differently:

**A. STANDARD OPTOMETRIC / OPTICAL FACT** — general concepts that exist independent of Oceans Optics (what myopia/hyperopia/astigmatism are, what SPH/CYL/AXIS/ADD mean on a prescription, that sphere-only lenses can't reproduce cylinder+axis correction, that light bends differently underwater, that a mask's air space changes apparent size/distance, and the general reason a land prescription and an underwater recommendation can differ). **These are EXTERNAL VERIFICATION REQUIRED** — checkable against optometric/ophthalmic sources independent of Oceans Optics.

**B. OCEANS OPTICS EMPIRICAL GUIDANCE** — the specific CYL-band adjustment/rounding rules documented in this file (the exact `calcOne()` arithmetic: which band gets which bias, the +0.75/−0.75 offsets, the floor/ceil/round choices). James has confirmed this methodology has already been tested extensively, iterated in practice, trialed with real users, and evaluated underwater. **It is classified CURRENT OCEANS OPTICS OPERATIONAL METHODOLOGY + INTERNALLY / EMPIRICALLY VALIDATED, not EXTERNAL VERIFICATION REQUIRED.** The external research pass should not attempt to re-derive, mathematically validate, or find a published formula matching these specific rules — their absence from published optometric literature is expected and is not evidence against them; they are Oceans Optics' own field-tested house rules, not a claim to be checked against outside sources.

**The two operational tooltips are an instructive example of the boundary:**
- `lens-calculator.liquid`: *"Underwater, light bends differently and can make your usual prescription feel too strong. We lower it slightly to prevent overmagnification."*
- `lens-calc-tool-product.liquid`: *"Underwater, light bends differently and can make your usual prescription feel too strong. We adjust it slightly for comfortable vision underwater."*

The **general claim** — that light bends differently underwater and this can make a land prescription feel too strong — is Category A, standard optical fact, EXTERNAL VERIFICATION REQUIRED. The **specific decision to lower the prescription, and by how much** — is Category B, Oceans Optics empirical guidance, already validated through the company's own testing, not something the external pass tries to re-derive. R31 should be transparent about this split in copy, in the spirit of (exact wording to be finalized at drafting): *"Our recommendations combine the information in your prescription with the lens powers available in prescription masks and Oceans Optics' real-world underwater testing."*

Do not present the Oceans Optics-specific CYL-band/rounding rules as if they were universal optometric standards — they aren't, and R31 shouldn't imply that. Equally, do not reject, soften, or omit them merely because no external published formula matches them — that would misrepresent internally validated, real-world-tested guidance as unfounded.

## Repository Comparison Summary

| Source | vs. confirmed canonical algorithm |
| --- | --- |
| `lens-calc-tool-product.liquid` | **Matches the confirmed canonical algorithm on every documented rule**, including the nearsighted "high" CYL band; no mask-matching step (not applicable in its product-page context); cosmetic zero-format difference only |
| `lens-calculator.liquid` | Matches the confirmed canonical algorithm on every rule **except** the nearsighted "high" CYL band, where this repository file uses a CYL-sign-dependent bias instead of the confirmed sign-independent "nearest" rule — see "Resolved: High-CYL Conflict" above |
| `fs-cylinder-guide.liquid` | Does not reproduce the current algorithm. Presents whole-number-only worked examples (farsighted lenses "in whole numbers only: +1.00 to +5.00") banded as 0.00–0.75 / 1.00–1.75 / 2.00–3.00 / 3.25+, with manual round-toward-zero guidance — a different, coarser rule set than the current `calcOne()` farsighted branch's per-band floor/ceil/round logic. LEGACY / STALE. |
| `ns-cylinder-guide.liquid` | Same finding as above for the nearsighted side — worked examples, not the current formula. LEGACY / STALE. |
| `page.which-lens-astigmatism.json` | Explanatory copy only ("ignore AXIS," weaker-vs-exact tradeoffs); does not implement or fully match the current banded algorithm; some framing ("As your CYL increases, going weaker backfires...") is broadly consistent in spirit with the current tool's CYL-band escalation but is not the same as the actual arithmetic above. LEGACY. |
| `lens-calculator-main.txt`, `components/lensCalculator.tsx`, Project Hub docs | Not found in this repository; no comparison possible |

## Remaining Internal / Product Questions (do not block external verification)

These are open, but none of them prevent the external optics verification pass from starting — they are product-intent and repository-maintenance questions, not questions about what the algorithm is:

1. Why does the repository copy of `lens-calculator.liquid` contain a non-canonical rule for the nearsighted "high" CYL band, and should it be brought in line with the confirmed canonical "nearest" rule?
2. Do `lens-calculator-main.txt`, `components/lensCalculator.tsx`, or Project Hub documentation exist somewhere outside this repository, and if so, do they agree with what's documented here?
3. Is the SPH=0.00/plus-sign → "+1.00" behavior intentional, a bug, or an irrelevant edge case? (Classified PRODUCT / UX INTENT REVIEW REQUIRED above.)
4. Is the "contact us for custom solutions" mixed-eye process still current?
5. Does ADD/presbyopia support exist through any channel outside the calculator (custom order, bifocal/readers, staff advice)?

## SOURCE OF TRUTH: CONFIRMED

The canonical algorithm — inputs, the full farsighted and nearsighted branch logic per CYL band, all clamping rules, the plano/zero asymmetry, and the calculator-vs-product-capability distinction for mixed eyes — is now confirmed per James's supplied and explicitly confirmed live-site calculator behavior (2026-08-28), documented in full above. Repository files have been checked against it and classified accordingly. The five items above are open product/repository questions that do not require resolution before external optical verification begins.

## READY FOR EXTERNAL OPTICS VERIFICATION: YES

The confirmed canonical algorithm is now the reference point for R31. The external verification pass covers **Category A claims only**: standard explanations of myopia/hyperopia, SPH, CYL, AXIS, ADD, astigmatism, sphere-only corrective lenses, plano, general underwater light/vision behavior, and why a glasses prescription and an underwater recommendation may reasonably differ. **It does not cover, re-derive, or attempt to mathematically validate the Oceans Optics CYL-band adjustment/rounding methodology itself (Category B)** — that methodology is already internally/empirically validated through testing, iteration, and real-world underwater use, and is out of scope for this verification pass. The remaining internal/product questions listed above are tracked separately and do not gate either the Category A verification or R31's educational framing. **External research itself is not performed in this task.**

---

## Development Note (2026-08-28): Lens Calculator v4 Architecture

This section documents new development work; it does not alter any finding above. **Status: DEVELOPMENT — not deployed, not wired into any live or published Shopify theme, not approved for release.**

The input-interpretation problem identified alongside this refactor: the two existing implementations (`sections/lens-calculator.liquid`, `sections/lens-calc-tool-product.liquid`) ask the customer to self-select a CYL band and CYL sign, rather than entering their prescription's actual CYL and AXIS values. A customer whose optometrist wrote their prescription in plus-cylinder notation, entering that CYL sign as literally written without transposing, could receive a different recommendation than an optically-identical prescription written in minus-cylinder notation — because the confirmed algorithm's medium/very-high CYL bands apply genuinely different rules depending on which sign is selected (this is not a bug in the algorithm itself; the algorithm has no way to know whether an unconverted sign was handed to it).

**New architecture:**

```
full prescription (SPH, CYL, AXIS, ADD as written)
  -> validation
  -> spherocylindrical transposition to minus-cylinder notation
  -> automatic CYL band classification
  -> existing Oceans Optics empirical recommendation methodology (UNCHANGED)
  -> formatted result
```

The recommendation methodology itself — `calcOne()` and `snapToHalf()` — is preserved verbatim from the confirmed canonical algorithm documented earlier in this file. It was cross-verified by direct comparison against the actual source code of `sections/lens-calc-tool-product.liquid` (which matches confirmed canonical on every rule) across all SPH values 0.00–10.00 in 0.25 steps, both signs, all five CYL bands, and both CYL signs — 820 exhaustive comparisons, zero discrepancies beyond one already-known cosmetic formatting difference (`"0"` vs `"0.00"`).

**Architectural consequence, stated plainly:** because normalization always produces a CYL value that is zero or negative, the confirmed algorithm's "plus CYL sign" branches (in the medium and very-high bands, and in the farsighted 0.50/0.75 special case) are no longer reachable through the normal input pipeline going forward. This is the intended fix, not a side effect — it is what makes optically-equivalent prescriptions, however an optometrist chose to notate them, produce the same recommendation. Those branches remain in the master file, untouched, so the file stays a complete and faithful transcription of the confirmed algorithm.

**New files (development, not deployed):**
- `theme/learning-hub-pilot/assets/lens-calculator-master.js` — canonical calculation module (parsing, validation, normalization, the preserved recommendation methodology, formatting)
- `theme/learning-hub-pilot/sections/calculator.liquid` — new UI section loading the master file; contains no duplicated algorithm logic
- `theme/learning-hub-pilot/tests/lens-calculator-master.test.js` — regression, normalization, and transposition-invariance test suite (67 assertions, all passing)

No existing calculator file was modified or deleted. See the chat report accompanying this development pass for full test results, an audit of old implementations, and open questions.

---

## Status Correction (2026-08-29)

The transposition/normalization architecture described above remains **VALIDATED** — James confirmed manually that optically-equivalent prescriptions written in different CYL notations (e.g. `-4.50/+1.50x90` and `-3.00/-1.50x180`) are correctly recognized as identical and produce the same normalized values.

However, **feeding the resulting normalized SPH into the existing, unchanged `calcOne()` band rules as the empirical recommendation is now UNDER REVIEW.** Manual testing against real prescriptions found recommendations that James considers too weak relative to intended Oceans Optics methodology in at least two medium/high-CYL cases. This does not mean `calcOne()`/`snapToHalf()` were altered or misquoted above — they weren't — it means the *assumption that a post-transposition SPH is a valid input to those unchanged rules* is not yet confirmed. See `LENS-CALCULATOR-V4-EMPIRICAL-MAPPING.md` and `LENS-CALCULATOR-V4-REAL-RX-VALIDATION.md` for the correction notes and specific examples.

**Current status:**
- FULL-RX INPUT / TRANSPOSITION: **VALIDATED**
- EMPIRICAL V4 RECOMMENDATION MODEL: **UNDER REVIEW / MANUAL VALIDATION REQUIRED**
- SHOPIFY MIGRATION: **NOT APPROVED**
- DEPLOYMENT: **NOT APPROVED**

No calculator code, existing Liquid sections, or test harness logic have changed as a result of this correction.
