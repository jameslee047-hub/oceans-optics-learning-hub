# R31 — Prescription Masks: Nearsightedness, Farsightedness & Lens Selection

## Curriculum Status
Category: Gear, Masks & Vision
Pathways: Equipment Essentials (R01 → R31 → R02 → R03 → R04 → R05 → R06 → R27 → R09 — R31 may be identified within this pathway as particularly relevant to learners who need vision correction); Prescription Masks & Underwater Vision (R01 → R31 → R02, R25 optional supporting science) — this pathway is approved to launch once this lesson is drafted and reviewed, not before
Curriculum decision: NEW (approved as launch-level, FINAL APPROVED)
Related lessons: R01, R02, R25

**Revision note (2026-08-28):** this brief was corrected after review. Earlier drafting incorrectly stated some unconfirmed conclusions (that AXIS should simply be "ignored," that ADD is unsupported, that the calculator rejects mixed-sign eyes) as if they were settled. Those statements are removed or corrected below, with sources re-classified using a five-way scheme: **CONFIRMED OPERATIONAL FACT**, **CURRENT PRODUCT CAPABILITY**, **LEGACY CLAIM**, **EXTERNAL VERIFICATION REQUIRED**, **UNRESOLVED**. Full supporting detail is in `content-development/research/LENS-CALCULATOR-SOURCE-OF-TRUTH.md` — this brief summarizes it; that document is the source of record for exact algorithm behavior.

**Second revision note (2026-08-28):** the canonical calculator algorithm is now James-confirmed, not merely best-evidenced. The `LENS-CALCULATOR-SOURCE-OF-TRUTH.md` document has been updated accordingly, including a resolved finding that the repository copy of `lens-calculator.liquid` contains one non-canonical rule (nearsighted "high" CYL band). This does not block external optical verification — see that document's "Ready for External Optics Verification" section.

**Third revision note (2026-08-28):** James has confirmed the calculator's CYL-band adjustment methodology has already been tested extensively, iterated in practice, and evaluated underwater with real users. It is **CURRENT OCEANS OPTICS OPERATIONAL METHODOLOGY + INTERNALLY / EMPIRICALLY VALIDATED** — not a claim awaiting external optical verification. External verification is reserved for the *standard, general* optical concepts this lesson explains (myopia, hyperopia, SPH, CYL, AXIS, ADD, astigmatism, sphere-only lenses, plano, general underwater light behavior). The *specific* adjustment amounts/rounding rules are Oceans Optics' own field-tested guidance, not to be re-derived, mathematically validated, or measured against published formulas. See the updated "Two Kinds of Claim" section in `LENS-CALCULATOR-SOURCE-OF-TRUTH.md` for the exact boundary, applied throughout this brief below.

## Lesson Purpose
Give a snorkeler who needs vision correction a beginner-safe understanding of what a prescription mask is, whether they need one, how nearsighted/farsighted lens strength is chosen for off-the-shelf lenses, and which Oceans Optics tool to use next — without positioning this lesson as a substitute for an eye exam or optometrist advice.

## Learner Outcomes
After this lesson the learner should be able to / understand:
- What a prescription mask is and whether they need one
- The basic difference between nearsighted (myopia) and farsighted (hyperopia)
- What SPH, CYL, AXIS, and ADD each mean on a standard eyeglass prescription
- Which of those fields the current Oceans Optics Lens Calculator asks for (SPH and CYL) and which it does not (AXIS and ADD) — as an operational fact about the tool, separate from why
- That each eye's lens strength is calculated independently, and that today's mask catalog — not the calculator itself — is what limits mixing nearsighted and farsighted correction across the two eyes
- The plano (0.00 / no corrective power) case
- That fit and prescription are separate decisions
- When to use the Lens Calculator vs. the Mask Sizing Tool
- When to consult an optometrist instead of relying on this lesson

## Scope Boundary

### This lesson teaches
- Prescription-mask basics, nearsighted/farsighted, what SPH/CYL/AXIS/ADD mean, which fields the current Lens Calculator uses, the sphere-only limitation, the mixed-eye product limitation, the plano case, the Lens Calculator vs. Mask Sizing Tool distinction

### This lesson introduces but does not teach in depth
- Why vision behaves differently underwater (the magnification effect) → detailed home: R25. This lesson references it only as a reason a land prescription may not translate directly; R25 owns the physics.
- Physical mask fit → detailed home: R02

### This lesson does NOT cover
- General mask selection (lens format for non-prescription reasons, skirt color) → R01
- Fit, donning, adjustment technique → R02
- Underwater light/vision physics in depth → R25
- The exact CYL-band rounding arithmetic as a republished table or worked example — this lesson may explain *that* the calculator adjusts for CYL, and describe the general shape of that adjustment in plain language once verified, but must not reproduce the specific floor/ceil/round rules or link out to `fs-cylinder-guide.liquid` / `ns-cylinder-guide.liquid` while those remain LEGACY / unverified (see Section 6 and Section 7 below)

## IMPORTANT: Two Kinds of Claim in This Lesson

Every factual claim in R31 falls into one of two categories, verified differently:

**A. STANDARD OPTOMETRIC / OPTICAL FACT** — general concepts independent of Oceans Optics (what myopia/hyperopia/astigmatism are, what SPH/CYL/AXIS/ADD mean, the sphere-only-lens limitation, general underwater light behavior, the general reason a land prescription and an underwater one can differ). **EXTERNAL VERIFICATION REQUIRED** — checkable against optometric sources independent of Oceans Optics.

**B. OCEANS OPTICS EMPIRICAL GUIDANCE** — the specific CYL-band adjustment/rounding rules the Lens Calculator applies. James has confirmed this methodology is already tested extensively, iterated in practice, and evaluated underwater with real users. **CURRENT OCEANS OPTICS OPERATIONAL METHODOLOGY + INTERNALLY / EMPIRICALLY VALIDATED** — not sent through external optical verification, and its absence from published optometric formulas is not evidence against it.

This distinction is applied section-by-section below. R31 must never present Category B as if it were a universal optometric standard, and must never omit or soften it merely because it isn't independently published — it is Oceans Optics' own validated guidance, and the lesson should say so transparently (exact wording at drafting time), e.g.: *"Our recommendations combine the information in your prescription with the lens powers available in prescription masks and Oceans Optics' real-world underwater testing."*

## Proposed Teaching Sequence

### 1. What Is a Prescription Mask, and Do I Need One?

Purpose: Establish the basic concept and help the reader self-identify whether this lesson applies to them.

Teaching points:
- A prescription (corrective) mask replaces standard mask lenses with vision-correcting lenses
- Self-check: if you'd normally wear glasses or contacts to see clearly, and don't want to wear contacts underwater, this is likely relevant

Source basis:
- APPROVED CURRICULUM / PLANNING SOURCE — general concept, not a specific claim requiring verification

Instructor/expert input:
- None required for this framing section.

Visual opportunity:
- NONE required.

### 2. Nearsighted vs. Farsighted, in Plain Terms

Purpose: Explain the two basic vision-correction categories relevant to mask lenses.

Teaching points:
- Nearsighted (myopia): near objects clear, distant objects blurry; SPH shown as a negative number
- Farsighted (hyperopia): distant objects clear, near objects blurry; SPH shown as a positive number

Source basis:
- LEGACY CLAIM (`theme/learning-hub-pilot/templates/page.nearsighted-or-farsighted.json` — educational-page copy) + EXTERNAL VERIFICATION REQUIRED (medical/vision claim). Do not restate the page's "eye focuses light in front of/behind the retina" technical-insight wording as verified fact without an external check, even though it is standard optometric explanation.
- The SPH sign convention itself (negative = nearsighted, positive = farsighted) is also CONFIRMED OPERATIONAL FACT per the live calculator's own tooltip copy (`lens-calculator.liquid`) — the tool and the legacy page agree on this point, which is reassuring but still not a substitute for external verification.

Instructor/expert input:
- None beyond the external verification above.

Visual opportunity:
- Simple diagram contrasting near/far focus points — OPTIONAL; standard optics diagram, not Oceans-Optics-specific.

### 3. Reading Your Prescription: SPH, CYL, AXIS, and ADD

Purpose: Teach what each prescription term means, and clearly separate "what the current tool asks for" from "whether that's optically correct."

Teaching points:
- SPH: the base correction number; sign (− / +) indicates myopia/hyperopia
- CYL: astigmatism correction; a CYL band and sign, or "none" if there is no astigmatism
- AXIS: describes the orientation of astigmatism correction on a full eyeglass prescription
- ADD: reading/near-vision power (presbyopia) on a full eyeglass prescription
- **The current Oceans Optics Lens Calculator asks for SPH and CYL (band + sign) for each eye. It does not ask for AXIS or ADD.** This is stated as what the tool does today — not as a claim that AXIS or ADD don't matter optically.

Source basis:
- SPH/CYL as prescription concepts — EXTERNAL VERIFICATION REQUIRED (medical/optics claim)
- **"The calculator asks for SPH and CYL, not AXIS or ADD"** — CONFIRMED OPERATIONAL FACT, verified directly against both live calculator implementations' input fields (see `LENS-CALCULATOR-SOURCE-OF-TRUTH.md`)
- Why AXIS and ADD are not asked for (the optical reasoning, e.g. "sphere-only lenses can't reproduce cylinder+axis correction") — EXTERNAL VERIFICATION REQUIRED; do not state this as established fact yet

Instructor/expert input:
- Confirm whether Oceans Optics wants any current-process statement about AXIS/ADD beyond "the calculator doesn't ask for them" — e.g., whether staff have an informal practice for advising customers with significant astigmatism or presbyopia that isn't reflected in the calculator itself.

Visual opportunity:
- Simple labeled-prescription-slip graphic (SPH/CYL/AXIS/ADD columns) — OPTIONAL; would help readers locate these values on their own prescription.

### 4. What a Standard Mask Lens Can and Cannot Correct

Purpose: Set accurate expectations about sphere-only correction.

Teaching points:
- Off-the-shelf mask lenses are corrected for SPH; the current calculator also factors in CYL band/sign when recommending a strength, rather than using SPH alone
- Available lens strength (diopter range and step size) varies by mask model — not a single universal range

Source basis:
- CONFIRMED OPERATIONAL FACT (`lens-calculator.liquid`'s `calcOne()` function adjusts its SPH-based recommendation differently depending on the CYL band and sign — see `LENS-CALCULATOR-SOURCE-OF-TRUTH.md` for the exact rule table). This is a confirmed fact about what the tool *does*.
- The **general** optical reasoning for why a sphere-only lens can't fully correct astigmatism — Category A, EXTERNAL VERIFICATION REQUIRED
- The **specific** CYL-based adjustment amounts Oceans Optics applies — Category B, OCEANS OPTICS EMPIRICAL GUIDANCE, already internally/empirically validated; not sent through external verification
- Model-varies-by-range fact — CURRENT PRODUCT CAPABILITY (`assets/maskData.js`, `snippets/mask_lens_database.liquid`)

Instructor/expert input:
- None beyond the external verification above.

Visual opportunity:
- NONE required — better stated in words than shown.

### 5. Different Prescriptions in Each Eye

Purpose: Explain per-eye lens strength and today's mixed-type limitation — correctly attributed.

Teaching points:
- Each eye's lens strength is calculated independently by the Lens Calculator, using that eye's own SPH and CYL
- **Correction:** the calculator itself does not reject a combination where one eye is nearsighted and the other is farsighted — it will calculate a result for both eyes regardless of sign
- **What actually limits this today is the mask catalog, not the calculator.** The Lens Calculator's own live copy states: *"We currently do not have masks that support different lens types (nearsighted + farsighted) for each eye. Please contact us for custom solutions."* This is a confirmed, current, product-catalog limitation, not a calculation limitation.
- Plano (no correction needed) in one eye while the other needs correction — see terminology note below

Source basis:
- **CONFIRMED OPERATIONAL FACT**: independent per-eye calculation, no calculator-level sign rejection (directly verified in both live implementations' code)
- **CURRENT PRODUCT CAPABILITY**: the mask-catalog restriction and its exact quoted wording, from the Main Lens Calculator's own live copy (`lens-calculator.liquid`)

Instructor/expert input:
- Confirm the "contact us for custom solutions" process is still current before this lesson describes it as an active option for customers — the phrase itself may be safely quoted (it's live copy), but what actually happens when a customer contacts Oceans Optics about this should be confirmed.

Visual opportunity:
- NONE required.

### 6. Choosing Your Lens Strength

Purpose: Connect the prescription-reading knowledge to an actual decision, being transparent that the recommendation blends standard prescription information with Oceans Optics' own tested guidance.

Teaching points:
- General idea: your glasses SPH is the starting point, but the Lens Calculator's recommendation can differ from it — the current tool's own tooltip states this is because "underwater, light bends differently and can make your usual prescription feel too strong," and the calculator adjusts for that
- Direct the learner to the Lens Calculator to get their actual recommendation, rather than teaching the rounding rule itself in this lesson
- Be transparent about the source of the recommendation, in the spirit of (exact wording at drafting time): *"Our recommendations combine the information in your prescription with the lens powers available in prescription masks and Oceans Optics' real-world underwater testing."*

Source basis:
- **CONFIRMED OPERATIONAL FACT + CURRENT OPERATIONAL COPY**: the calculator does adjust its recommendation based on CYL band/sign, and its own live tooltip states the underwater-refraction rationale (quoted precisely in `LENS-CALCULATOR-SOURCE-OF-TRUTH.md`)
- **Category A, EXTERNAL VERIFICATION REQUIRED**: the *general* claim that underwater refraction can make a land prescription feel too strong
- **Category B, OCEANS OPTICS EMPIRICAL GUIDANCE**: the *specific* CYL-band adjustment amounts and rounding rules — already internally/empirically validated through testing, iteration, and real-world underwater use; not re-derived or mathematically checked against outside sources, and its absence from published formulas is not evidence against it
- Do NOT source this section's *wording* from `fs-cylinder-guide.liquid` / `ns-cylinder-guide.liquid` — those present a different, coarser, worked-example rule set that predates and does not match the confirmed current arithmetic (see Section 7); this is a copy-sourcing note, not a doubt about the current methodology's validity

Instructor/expert input:
- Confirm the exact transparency wording Oceans Optics wants for describing the blend of prescription data and empirical testing (the sentence above is a placeholder, not final copy).

Visual opportunity:
- NONE required — hand off to the tool rather than illustrating the adjustment logic.

### 7. Fit and Prescription Are Two Separate Decisions

Purpose: Prevent the misconception that getting the prescription right guarantees a good physical fit.

Teaching points:
- Lens strength and mask fit are independent; a correctly-powered lens in a poorly-fitting mask still won't work well
- Use the Mask Sizing Tool for physical fit, separately from the Lens Calculator

Source basis:
- APPROVED CURRICULUM / PLANNING SOURCE (structural point)
- CURRENT PRODUCT CAPABILITY (`mask-sizing-tool.liquid` exists and is live) for the tool reference

Instructor/expert input:
- None required.

Visual opportunity:
- NONE required.

### 8. Snorkeling vs. Scuba — Only If a Real Difference Exists

Purpose: Address whether prescription-lens selection differs by activity, without forcing an unnecessary section.

Teaching points:
- **Do not draft this as a standalone section unless research confirms a real, meaningful difference in lens-power selection between snorkeling and scuba.**
- The research question to answer first: *does corrective lens power selection materially differ between snorkeling and scuba diving?*
- If the answer is no, this becomes a one-line note elsewhere in the lesson (or is omitted entirely), not a section.
- If a small, real distinction exists, mention it briefly within the relevant section (likely Section 6) rather than creating a dedicated heading.

Source basis:
- NO SOURCE FOUND either way — nothing in the repository (calculator, product data, or educational pages) addresses a snorkeling/scuba distinction in lens selection

Instructor/expert input:
- **Required.** This determines whether Section 8 exists in final copy at all.

Visual opportunity:
- NONE.

### 9. When to Get Professional Optical Advice

Purpose: Set a clear boundary between what this lesson/tool can do and when to see an optometrist, without inventing a threshold.

Teaching points:
- Some prescriptions may warrant a conversation with an optometrist or Oceans Optics support before ordering
- This lesson and the Lens Calculator are decision-support, not a substitute for a professional eye exam

Source basis:
- APPROVED CURRICULUM / PLANNING SOURCE (framing decision)
- The **specific triggers** for when to recommend professional advice (e.g., a CYL magnitude, an AXIS consideration, an ADD/presbyopia need) — EXTERNAL VERIFICATION REQUIRED. **Do not invent a numeric CYL, AXIS, or SPH threshold.** The external research pass should identify evidence-based situations, not this brief.

Instructor/expert input:
- Confirm whether Oceans Optics support has an existing informal referral practice worth reflecting here.

Visual opportunity:
- NONE required.

### 10. Where to Learn More

Purpose: Close with explicit next-step links.

Teaching points:
- Link to R01 (mask overview), R02 (fit), R25 (underwater vision science), Lens Calculator, Mask Sizing Tool
- **Do not link to `fs-cylinder-guide.liquid`, `ns-cylinder-guide.liquid`, or the old astigmatism selection page (`page.which-lens-astigmatism.json`) from this lesson** while those remain LEGACY / unverified — see Section 7 below

Source basis:
- APPROVED CURRICULUM / PLANNING SOURCE

Instructor/expert input:
- None.

Visual opportunity:
- NONE.

## Legacy Cylinder Guides — Do Not Link Publicly

`fs-cylinder-guide.liquid`, `ns-cylinder-guide.liquid`, and `page.which-lens-astigmatism.json` remain classified LEGACY / UNVERIFIED. They may be used only as **research inputs** — do not plan to send a learner from this newly-drafted, verified lesson into one of these old, unverified guides. After external verification, either (A) validate and update them, or (B) replace their function entirely with the Lens Calculator and new Learning Hub guidance. This decision is deferred, not made in this brief.

## Key Takeaways
- SPH and CYL are what the current Lens Calculator asks for; AXIS and ADD are not asked for today — that's an operational fact about the tool. What myopia/hyperopia/astigmatism/SPH/CYL/AXIS/ADD *mean* is standard optical fact (external verification required); the specific adjustment amounts the calculator applies are Oceans Optics' own tested guidance (not sent through external verification)
- The calculator adjusts its recommendation using CYL, not just SPH — the general reason underwater vision can differ from land vision is standard fact to verify; the exact adjustment rule itself is validated internally through Oceans Optics' own testing
- Each eye's lens strength is calculated independently; today's product catalog, not the calculator, is what currently limits mixing nearsighted and farsighted correction across the two eyes
- The Lens Calculator (prescription) and Mask Sizing Tool (physical fit) are two different tools for two different decisions
- This lesson supports, but doesn't replace, professional optical advice

## Instructor Tips Opportunities
- Real guidance on the most common prescription-selection mistakes Oceans Optics sees — not yet supplied, do not invent
- Whether staff have an informal AXIS/ADD/presbyopia advising practice beyond what the calculator itself asks for — needed before Section 3/9 can be finalized

## Common Mistakes Opportunities
- Assuming glasses SPH will feel identical underwater
- Assuming the calculator ignoring AXIS/ADD as inputs means those factors don't matter at all
- Assuming any mask model supports any diopter range
- Confusing the Lens Calculator (prescription) with the Mask Sizing Tool (physical fit)
- Assuming mixed nearsighted/farsighted eyes can't be *calculated* — when it's the product catalog, not the calculation, that's limited

## Safety Notes
NONE in the physical/emergency-risk sense — this is a buying-decision lesson, not a safety lesson in the R08/R12/R15 sense. However, **every Category A (standard optical fact) claim in this lesson is flagged for external verification** (see Source Inventory) because inaccurate vision-correction guidance could materially affect a customer's underwater vision — treat this as a factual-accuracy gate, not a safety-review gate. Category B (Oceans Optics' own tested CYL-adjustment methodology) is not part of this gate — it is already internally/empirically validated.

## Knowledge Check Plan

What understanding should be tested:
- SPH sign convention (negative = nearsighted, positive = farsighted)
- That the current calculator uses SPH and CYL, and does not ask for AXIS or ADD — as a fact about the tool, not a scientific conclusion
- Knowing which tool to use for which decision (Lens Calculator vs. Mask Sizing Tool)
- Correctly distinguishing "the calculator can compute this" from "the product catalog can fulfill this" for mixed-eye prescriptions

Proposed question concepts:
1. What does a negative SPH number mean? — catches sign-convention confusion. Do not finalize wording until the SPH claim is externally verified.
2. Which two prescription fields does the current Lens Calculator use to make its recommendation? — catches the assumption that AXIS or ADD feed into today's tool.
3. You need different correction in each eye — one nearsighted, one farsighted. Can the Lens Calculator work out a recommendation for both eyes? — correct answer is yes, the calculator computes both; the follow-up point is that the mask catalog is what currently can't fulfill it. This question is specifically designed to correct the earlier draft's mistaken framing, not repeat it.
4. You want to choose your lens strength. Which tool should you use? — catches Lens Calculator vs. Mask Sizing Tool confusion.

No answer key is finalized; several depend on the verification items below.

## Related Lesson / Tool Links

Educational progression: R01 (overview, before this lesson) → R31 (this lesson) → R02 (fit, after model/lens are decided); optional link to R25 (underwater vision science).

Tools: Lens Calculator (prescription-strength selection); Mask Sizing Tool (physical fit) — both should be clearly distinguished, not presented as interchangeable. **Do not link to the legacy cylinder guides or the legacy astigmatism page** (see above).

Commercial CTAs (kept separate from educational links): specific mask model links (Rx Rover, Rx Lumix, Rx Obsidian, etc.) — do not hardcode specific product URLs in this brief; resolve via the same placeholder pattern R01 already uses (`[PRODUCT: ...]`) when copy is drafted.

## Visual / Diagram Brief

1. Concept: near/far focus point (myopia/hyperopia) — Type: simple optics diagram — Purpose: visualize section 2 — Optional
2. Concept: labeled prescription slip (SPH/CYL/AXIS/ADD) — Type: annotated graphic — Purpose: help readers locate these values on their own prescription — Optional, high-value
3. Concept: Lens Calculator vs. Mask Sizing Tool — Type: simple two-column comparison callout — Purpose: prevent tool confusion — **Essential**

## Source Inventory

- `content-development/research/LENS-CALCULATOR-SOURCE-OF-TRUTH.md` — the authoritative record of confirmed calculator behavior; supersedes this brief's own summaries if they ever diverge
- `theme/learning-hub-pilot/sections/lens-calculator.liquid` — the dedicated calculator page; matches the confirmed canonical algorithm except for one rule (nearsighted "high" CYL band uses a non-canonical, sign-dependent bias) — see source-of-truth doc
- `theme/learning-hub-pilot/sections/lens-calc-tool-product.liquid` — CONFIRMED OPERATIONAL FACT source; matches the confirmed canonical algorithm on every documented rule, including the nearsighted "high" CYL band
- `theme/learning-hub-pilot/assets/maskData.js`, `snippets/mask_lens_database.liquid` — CURRENT PRODUCT CAPABILITY (time-sensitive product data; reconfirm ranges at actual drafting time)
- `theme/learning-hub-pilot/sections/fs-cylinder-guide.liquid`, `ns-cylinder-guide.liquid` — LEGACY CLAIM, confirmed STALE relative to the current algorithm (does not reproduce current `calcOne()` arithmetic)
- `theme/learning-hub-pilot/templates/page.which-lens-astigmatism.json` — LEGACY CLAIM
- `theme/learning-hub-pilot/templates/page.nearsighted-or-farsighted.json` — LEGACY CLAIM
- `content-development/R01-R31-SCOPE-APPROVAL.md`, `FINAL-CURRICULUM-APPROVAL.md` — APPROVED CURRICULUM / PLANNING SOURCE
- **Category A — EXTERNAL VERIFICATION REQUIRED:** SPH/CYL/AXIS/ADD medical meaning, myopia/hyperopia/astigmatism definitions, sphere-only-lens limitations, general underwater magnification/light-behavior claims, and the general reason a land prescription and an underwater one may differ
- **Category B — OCEANS OPTICS EMPIRICAL GUIDANCE, not externally verified:** the calculator's specific CYL-band adjustment amounts and rounding rules — confirmed by James as already tested extensively, iterated in practice, and evaluated underwater with real users
- Whether ADD/presbyopia support exists in any form outside the calculator (bifocal/readers/custom) — UNRESOLVED, needs direct Oceans Optics confirmation, not external research
- Whether `lens-calculator-main.txt` / `components/lensCalculator.tsx` / Project Hub docs exist outside this repository, and whether the repository copy of `lens-calculator.liquid` should be brought in line with the confirmed canonical "high" CYL band rule — UNRESOLVED, needs James's direct confirmation, but does not block external verification (the canonical algorithm itself is confirmed)

## Verification Before Drafting

[ ] Confirm whether `lens-calculator-main.txt` / `components/lensCalculator.tsx` / Project Hub documentation exist outside this repository, and whether the repository copy of `lens-calculator.liquid` should be corrected to match the confirmed canonical "high" CYL band rule (internal/repository question — does not block external verification)
[ ] Confirm whether the SPH=0.00/plus-sign → "+1.00" behavior is intentional (plano/UX review) before deciding how this lesson describes the plano case
[ ] Confirm the current "contact us for custom solutions" process for mixed-eye prescriptions is still accurate before describing it to learners
[ ] Confirm whether ADD/presbyopia support exists in any form today (this is a direct product-capability question, separate from external optical verification)
[ ] Decide whether Section 8 (snorkeling vs. scuba) exists at all, based on instructor confirmation of a real difference
[ ] Obtain the professional-advice referral criteria from external, evidence-based research — do not invent a threshold
[ ] Reconfirm current diopter ranges/models against live product data at actual drafting time (product data is time-sensitive)
[ ] Complete the external optics/medical verification pass covering the Category A claims only: SPH, CYL, AXIS, ADD, myopia/hyperopia/astigmatism, sphere-only-lens limitations, and the general underwater-magnification claim — **not** the Category B CYL-band adjustment methodology itself, which is already internally/empirically validated. This pass is unblocked and is not performed in this task.

## Drafting Readiness

BLOCKED. This remains the most heavily gated brief in this batch. The structural section order and scope boundary are final and approved; the internal contradictions flagged in the previous version have been corrected. **The calculator source-of-truth is now confirmed, so the external optics/medical verification pass may proceed** (as a separate task) without waiting on the remaining internal items above. Public copy still may not be drafted until both the external verification pass and the remaining internal/product questions (repository "high" CYL band correction decision, plano/UX intent, ADD support, mixed-eye process currency, Section 8 existence, professional-advice criteria) are resolved.
