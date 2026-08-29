# Gear, Masks & Vision — Brief Review

Category-level review of the seven lesson briefs created for R01, R02, R03, R04, R05, R06, and R31. This is the companion report to those briefs, per `content-development/FINAL-CURRICULUM-APPROVAL.md`. No lesson copy is written here.

**Updated 2026-08-28** after the brief-correction pass: nine R01 decisions, several R31 corrections, and the Lens Calculator source-of-truth question have been resolved or substantially clarified. See `content-development/research/LENS-CALCULATOR-SOURCE-OF-TRUTH.md` for the calculator-specific findings.

## Summary Table

| Lesson | Brief complete | Ready for drafting | Main blocker | Main cross-link |
| --- | --- | --- | --- | --- |
| R01 Choosing a Mask | Yes | BLOCKED (fewer items than before) | Catalog-accuracy checks (dual-lens compatibility by model, skirt availability), mask-volume performance-claim decision, snorkeling-vs-scuba framing question | R02, R31 |
| R02 Mask Fit, Positioning & Adjustment | Yes | BLOCKED | Two legacy donning-technique sources conflict and must be reconciled | R01, R20 |
| R03 Mask Preparation, Defogging & Care | Yes | BLOCKED | Toothpaste defogging method needs a current-practice check | R02, R31 (prescription-lens care, future) |
| R04 Choosing and Setting Up a Snorkel | Yes | READY (pending 2 low-risk checks) | Snorkel-type tradeoffs need a catalog-accuracy check | R18, R19 |
| R05 Choosing Fins | Yes | READY (pending 1 low-risk check) | Fin-type tradeoffs need a catalog-accuracy check | R21, R22, R30 |
| R06 Exposure Protection & Staying Warm | Yes | BLOCKED | Reef-safe sunscreen terminology and sun-exposure/burn-severity claim need verification | R27, R10 |
| R31 Prescription Masks | Yes | BLOCKED (heavily) | Calculator source-of-truth confirmation (which implementation is primary), external optics/medical verification, several direct Oceans Optics confirmations | R01, R02, R25 |

## RESOLVED Since Last Review

- **Product-neutral educational policy (CG-062):** resolved. R01's educational body stays product-neutral throughout; Oceans Optics products, collections, and tools (Lens Calculator, Mask Sizing Tool, Find Your Mask) appear only as clearly separated related-tools/next-steps/CTA blocks, never woven into the core teaching.
- **Mask Sizing Tool placement:** resolved. The tool now appears in **both** R01 (introduced as an optional pre-purchase model/size-narrowing step) and R02 (explained as relating to, but not replacing, the physical seal/comfort/positioning check R02 teaches). R02 was not expanded into a face-sizing lesson.
- **Clear vs. dark/black skirt — peripheral light claim:** resolved and approved. Clear skirts allow more ambient/peripheral light; dark/black skirts block more peripheral light. This is settled planning information, no further verification needed. The previous "clear skirts improve visibility in murky water" wording has been removed from the R01 brief — peripheral light and water-clarity/turbidity are different concepts and must not be conflated.
- **Single-lens vs. dual-lens section:** kept (it was never in question) — but the prescription-compatibility claim inside it was corrected from an absolute rule to a nuanced one: *"dual-lens masks are commonly used for interchangeable corrective lenses, but prescription compatibility still depends on the specific mask model."* Unsupported clarity/field-of-view/distortion comparisons remain explicitly excluded.
- **Mask volume:** resolved. R01 now owns a basic, planning-level mask-volume section (what it means, low vs. high volume as a characteristic). Detailed performance claims (equalizing, clearing, field of view, hydrodynamics, freediving, drag) remain verification items, not asserted facts, in both R01 and R02.
- **Plano terminology:** resolved. Educational term is **"plano (0.00 / no corrective power)."** "Sharp Vision" is treated as legacy/marketing terminology, only usable as a secondary aside once current product-interface usage is confirmed.
- **Legacy cylinder guides not linked publicly:** resolved. R31 will not link learners to `fs-cylinder-guide.liquid`, `ns-cylinder-guide.liquid`, or `page.which-lens-astigmatism.json` while those remain LEGACY/unverified — they may be used only as research inputs.
- **No artificial snorkeling-vs-scuba R31 section:** resolved as a drafting rule. R31 will not force a standalone "Snorkeling vs. Scuba" section unless research confirms a real difference; if none exists, the question is dropped or folded into a one-line note.
- **No invented professional-referral threshold:** resolved as a drafting rule. R31 will not state a numeric CYL/AXIS/SPH threshold for "see an optometrist" — that must come from external, evidence-based research.
- **R31's mixed-eye claim corrected:** the earlier brief incorrectly stated the calculator rejects opposite-sign (nearsighted + farsighted) prescriptions across the two eyes. Confirmed via direct code reading: the calculator computes both eyes independently with no such rejection; it is the **mask product catalog**, not the calculator, that currently can't fulfill a mixed-sign pair. R31 now states this correctly, with the calculator's own live "contact us for custom solutions" copy quoted precisely. See `LENS-CALCULATOR-SOURCE-OF-TRUTH.md`.
- **R31's AXIS/ADD framing corrected:** the earlier brief stated conclusions ("ignore AXIS," "ADD unsupported") that were not actually established. R31 now teaches the operational fact — the current calculator asks for SPH and CYL, not AXIS or ADD — as separate from the unresolved optical question of why, and separate from the unresolved product question of whether ADD is supported through some other means.

## Lens Calculator Source-of-Truth — CONFIRMED

James supplied and explicitly confirmed the current live-site calculator algorithm (2026-08-28). It is now recorded as CURRENT CANONICAL in `content-development/research/LENS-CALCULATOR-SOURCE-OF-TRUTH.md`. Two repository implementations were checked against it: `sections/lens-calc-tool-product.liquid` matches on every documented rule; `sections/lens-calculator.liquid` (the dedicated calculator page) matches everywhere **except** the nearsighted "high" CYL band, where this repository copy uses a non-canonical, CYL-sign-dependent rule instead of the confirmed sign-independent "nearest" rule. This is now a resolved *identification* finding — the canonical rule is known — but remains an open *repository-maintenance* question (should the repository file be corrected to match). Separately, entering a plano (0.00) prescription with a "+" sign and no cylinder returns "+1.00," not plano, in both repository implementations identically — classified PRODUCT / UX INTENT REVIEW REQUIRED, not assumed to be a bug or by design. **Neither open item blocks external optical verification, which is now unblocked.**

## Overlaps Successfully Removed

Every adjacent-lesson boundary in this category was checked via each brief's Scope Boundary section, and all are clean:

- **R01 vs. R02 vs. R03** — selection vs. fitting technique vs. care are cleanly separated; R01's decision sequence now explicitly hands off to R02/R03 instead of vaguely gesturing at "the fitting lesson."
- **R01 vs. R31** — R01 *names* prescription need; R31 *teaches* it. No prescription mechanics appear in the R01 brief.
- **R02 vs. R20** — R02 is pre-water fitting technique; in-water mask clearing (water already inside) stays with R20.
- **R05 vs. R21/R22** — R05 is equipment comparison; kicking technique/efficiency stays with R21/R22.
- **R06 vs. R27** — R06 is "what to buy/use"; R27 (outside this category) is "why it works." Both briefs state this split explicitly.
- **R31 vs. R25** — R31 is the buying decision; R25 (outside this category) owns the underwater-vision physics. R31's brief references the magnification effect only as a reason to link to R25, not as content to teach.

## Remaining Unresolved Gaps

- **R31 Section 8 (snorkeling vs. scuba):** still cannot be drafted until confirmed whether a real difference exists — the drafting *rule* is now resolved (don't force it), but the underlying *question* is not.
- **R31 ADD support:** still no source confirms or denies current support through any channel (calculator, bifocal/readers, custom order) — this is a direct product-capability question, not a drafting question.
- **R31 calculator repository-maintenance questions:** whether external documents (`lens-calculator-main.txt`, `components/lensCalculator.tsx`, Project Hub docs) exist and agree with the confirmed canonical algorithm, whether `lens-calculator.liquid` should be corrected to match the confirmed "high" CYL band rule, and whether the plano/+1.00 behavior is intentional — all open, none blocking external verification, see the source-of-truth document.

## Facts Requiring Verification

- R01: dual-lens prescription-compatibility claim against the current catalog (nuance now correct; specific models still need confirming); skirt-color product availability; mask-volume performance associations (if any are to be included); snorkeling-vs-scuba framing
- R02: conflicting donning technique (two legacy sources disagree); the "1–2 cm" comfort-check figure; the petroleum-jelly mustache tip
- R03: toothpaste defogging method as current best practice
- R04: snorkel-type tradeoffs; "dominant hand side" placement convention
- R05: fin-type tradeoffs
- R06: "reef-safe sunscreen" terminology; the water/sun-exposure severity claim; wetsuit thickness-by-temperature guidance
- R31, Category A (standard optical fact, EXTERNAL VERIFICATION REQUIRED): SPH/CYL/AXIS/ADD medical meaning, myopia/hyperopia/astigmatism definitions, sphere-only-lens limitations, and the general underwater-magnification claim. The calculator source-of-truth is confirmed, so this pass is unblocked (not performed in this task).
- R31, Category B (Oceans Optics empirical guidance, **not** externally verified): the calculator's specific CYL-band adjustment amounts and rounding rules — confirmed by James as already tested extensively, iterated in practice, and evaluated underwater with real users. The external research pass does not attempt to re-derive or validate this methodology against outside sources.

## Instructor Input Required

- R01: real customer-selection advice (CG-007), common face-fit/prescription mistakes (CG-008), whether mask-volume performance associations should be included, snorkeling-vs-scuba framing
- R02: the single correct donning technique (required, not optional — two sources conflict)
- R03: current recommended defogging method, especially for prescription/coated lenses
- R04: which snorkel type Oceans Optics recommends for beginners
- R05: which fin type suits typical beginner customers
- R06: current sun-protection specifics; wetsuit thickness table if included
- R31: decide whether the repository copy of `lens-calculator.liquid` should be corrected to match the confirmed canonical "high" CYL band rule; confirm whether the plano/+1.00 behavior is intentional; confirm the current mixed-eye "contact us" process; confirm ADD support status through any channel; confirm whether a real snorkeling-vs-scuba difference exists

## Visual Needs

- R01: 2 essential (single-lens vs. dual-lens; clear vs. dark/black skirt), 2 optional (mask-volume diagram added)
- R02: 2 essential (donning sequence; strap position), 2 optional
- R03: 0 essential, 2 optional
- R04: 2 essential (snorkel types; placement/angle), 1 optional
- R05: 2 essential (heel style; fin length), 0 optional
- R06: 0 essential, 2 optional
- R31: 1 essential (Lens Calculator vs. Mask Sizing Tool comparison callout), 2 optional

## Which Lessons Can Proceed to Public-Copy Drafting Immediately

**None are fully unblocked.** R04 and R05 remain closest — both are marked READY FOR COPY in their briefs, pending only low-risk, single-source catalog-accuracy confirmations. R01 has fewer open items than in the previous review (three policy/placement questions resolved), but is still BLOCKED on catalog and instructor-input items. R02, R03, and R06 are unchanged in blocked status. R31 is still the most heavily blocked lesson in the category on internal/product questions, but its external optics verification pass is now unblocked and can proceed as a separate task.

## Gear, Masks & Vision Briefs Ready for Review?

YES

All seven briefs are complete, internally consistent with `FINAL-CURRICULUM-APPROVAL.md`, and the corrections from this review pass have been applied. "Ready for review" is separate from "ready for drafting" — see the table above for drafting status per lesson.

## Decisions James Needs to Make Before Drafting

- [ ] Reconcile the two conflicting R02 donning techniques into one current, correct method
- [ ] Confirm the current recommended defogging method for R03 (toothpaste vs. an alternative), especially for prescription lenses
- [ ] Confirm current "reef-safe sunscreen" guidance/terminology and the sun-exposure severity claim for R06
- [ ] Confirm current product-catalog compatibility for the R01 dual-lens/prescription nuance, and current skirt-color availability
- [ ] Decide whether mask-volume performance associations belong in R01, and in what supported form
- [ ] Confirm whether snorkeling vs. scuba use materially changes mask-selection advice (R01) or lens-strength selection (R31)
- [ ] **Decide whether the repository copy of `lens-calculator.liquid` should be corrected to match the confirmed canonical nearsighted "high" CYL band rule** (the algorithm itself is confirmed; this is a repository-maintenance decision, not an identification question)
- [ ] Confirm whether the plano (0.00) + "+" sign → "+1.00" calculator behavior is intentional
- [ ] Confirm the current mixed-eye "contact us for custom solutions" process is still accurate
- [ ] Confirm ADD/presbyopia support status through any channel (not just the calculator)
- [ ] Arrange the external optics/medical verification pass for R31's Category A claims only (SPH, CYL, AXIS, ADD, myopia/hyperopia/astigmatism, sphere-only-lens limitations, general magnification claims) — **the calculator source-of-truth is now confirmed, so this pass is unblocked** and can proceed as a separate task. The Category B CYL-band adjustment methodology itself is Oceans Optics' own tested guidance and is explicitly out of scope for this pass.
