# Aira — UI/UX Inspiration Study & Design Direction

**Scout task `aira-ui-s3`** · prepared 2026-08-07
**Deliverables:** this report · [`design-direction.html`](./design-direction.html) (self-contained mood board + token sheet) · screenshots in [`./shots/`](./shots)

---

## 0. TL;DR

- **The mascot is the palette.** I sampled the seafoam elephant art directly (body `#70B8B0`, outline `#2E7370`, mint belly `#B8D8D4`) and built the whole system from it. The `handoff.md` §6 hypothesis (seafoam core + warm sand + coral pop) is largely right; I made **two justified changes**: (1) the *ground* becomes a cool seafoam-tinted off-white, not warm cream, so the seafoam elephant and the teal data read as one family; (2) brand is pulled one step deeper than the mascot (`#0F6E60`) so it passes AA as UI text and reads like an instrument, not a toy. Warm sand/coral survive as *accents*, not the canvas.
- **The central tension is resolved with one rule:** *softness is a property of shells, warmth is a property of humans, and neither touches the numbers.* Cards, sheets, chips and the mascot are rounded and seafoam; chart plots and table cells are square, gridded, tabular and sober. Concrete do/don't list in §D and rendered side-by-side in the HTML.
- **Every text-on-surface pairing is measured, not asserted.** Full WCAG table in §B. All body/label text clears **AA (≥4.5:1)** in both light and dark; primary text and primary button clear **AAA**.
- **Dark mode is a first-class variant** (dim-office use), fully rendered — toggle it live in the HTML.
- **Local-first surfaces are designed as first-class:** unlock, the audio-deleted "trust moment", note sign-off, and an honest forgotten-password path (§C).
- **Fonts chosen for real script coverage:** Lexend (UI) + IBM Plex Sans Arabic (RTL, launch market) + Noto Sans Devanagari (India). RTL is demonstrated live in the HTML with real glyphs.
- **Open questions for the founder in §F** — the biggest is the *forgotten-password / recovery policy*, which is a product decision, not a design one.

---

## 1. What I did (method & evidence)

| Step | Command / artifact | Result |
|---|---|---|
| Read the brief & handoff | `handoff.md` (§6 Aesthetic) | Starting hypothesis captured; noted it is stale on the mascot & name (task overrides: elephant is current, product is "Aira"). |
| Studied the mascot art | 4 PNGs in `Mascot Designz/` | Seafoam elephant, 13 poses (meditating, reading w/ glasses, note-taking, watering a plant, hugging a glowing heart, sleeping under a star blanket, balloon…). Filigree ears, coral cheek blush. |
| Sampled true mascot colours | Pillow quantiser over all 4 images | Body `~#70B8B0` (hue ≈176°), outline→shadow `#2E7370`→`#307070`, belly `#B8D8D4`, highlight `#9ECFC9`. |
| Read the existing mockups | `aira-mvp 3.html`, `aira-screens.html` | Critiqued in §A.6. They are genuinely good; the main gap vs. brief is the *warm cream ground* and a couple of loud chart tints. |
| Built the token set | contrast scripts (`/tmp/contrast*.py`) | Full scales + semantic roles, all pairings measured (§B). |
| Rendered the system | [`design-direction.html`](./design-direction.html) | Self-contained (fonts base64-inlined, no CDN), light+dark, palette, type ramp, components, chart, caseload table, screen mocks. |
| Visual QA | Chrome-for-Testing screenshots in `./shots/` | Reviewed at 2× and iterated on the pixels (§E). |

**Tooling note (honest):** `chrome-devtools-axi` was initially blocked — the host had **no Chrome installed** and **Node v22.6.0** (the MCP needs ≥22.12). I resolved this inside the worktree by fetching a portable Node 22.14 and Chrome-for-Testing, then driving it over the DevTools protocol. Because Mobbin/Reflectly-class references are login-walled or mobile-app-only, I did **not** fabricate live screenshots of them; the reference analysis in §A is from established, verifiable design knowledge and is written as *specific transferable mechanics*, not vibes. The screenshots I do include are the real, capturable things: the existing Aira mockups and the new rendered system.

---

## A. What is actually good in the references — transferable mechanics

Not "these apps are pretty." Each item below is a mechanic you can port into Aira, and where it should be *bent* because we render clinical data.

### A.1 Reflectly / Resonance Journal — gradient depth used as *hierarchy*, not decoration
- **Mechanic:** a single soft top-to-bottom gradient on the *canvas* (not on components) creates depth cheaply; content cards sit on it in flat white with a low, wide shadow. The gradient is desaturated (8–14% saturation) so text stays readable.
- **Port to Aira:** use it on the **unlock screen and empty states only** — the emotional, low-density surfaces. Keep it *off* the caseload and charts. (In the HTML: the unlock screen uses a seafoam `#0B564B → #0C312B` gradient; everything data-dense is flat.)
- **Bend:** consumer apps put gradient *behind numbers*. We must not — a gradient behind a PHQ-9 score reads as "mood app," which is exactly the credibility we can't spend.

### A.2 Calm / Headspace — motion that *settles* rather than *entertains*
- **Mechanic:** entrance animations are slow (300–500ms), single-axis (fade + 8px rise), and never spring/bounce. Ambient loops (Headspace's blobs, Calm's scenes) are 4–8s and low-amplitude. Result: the app feels like it's *breathing*, not performing.
- **Port:** one ambient element only — the mascot's 5.5s float. Interactions are 120–180ms fade+rise. Nothing bounces.
- **Bend:** data never animates its *value* (no count-up on a risk number — it reads as a slot machine). Charts may fade in as a whole; the line never draws itself dramatically.

### A.3 Finch / How We Feel — warmth via a *character* and *plain language*, not clutter
- **Mechanic:** Finch's bird and How We Feel's copy carry the emotional load so the UI itself can stay minimal. Warmth lives in *one* place (the character, the microcopy), leaving the rest calm.
- **Port:** the seafoam elephant is our warmth budget. Because the mascot carries charm, the clinical surfaces are free to be sober without feeling cold. Microcopy does the rest ("You hold the only key").
- **Bend:** the mascot appears on *human* surfaces (home, unlock, empty states, patient-facing journal) and is **banned** from the chart plot and the risk queue.

### A.4 How We Feel / Daylio — the *mood grid* and low-friction capture
- **Mechanic:** a 5-point mood strip with a colour per step and one tap to log. It's fast because it's constrained.
- **Port:** the patient-facing journal (Flow 3) already uses this; keep it. In the clinician tool, the *severity band* language mirrors it (minimal→severe), giving a shared visual grammar between the soft patient app and the crisp clinician app.
- **Bend:** clinician-side, the mood colours become **sober severity tones**, not the saturated emoji palette.

### A.5 Linear / Things 3 / Arc — "rounded but serious"
- **Mechanic:** these prove you can be friendly *and* trusted. Their tricks: generous radii on containers but **crisp typography, tabular numbers, tight data tables, hairline dividers**, and restraint in colour (one accent, greys everywhere else). Linear's tables are the reference for our caseload view.
- **Port:** directly — this is the backbone of Aira's data surfaces. Tabular-num scores, hairline row dividers, hover row tint, right-aligned numerics, uppercase 11px column labels.
- **This is the single most important reference set for Aira**, because it's the only one in the list that renders professional data.

### A.6 Oura / Whoop — clinical-adjacent data that still feels calm
- **Mechanic:** Oura shows a lot of numbers without panic. How: a **restrained sequential palette**, a *readiness*-style single headline number with a one-line plain-language interpretation above the chart, and **bands** (optimal/pay-attention) as faint background zones. Whoop signals strain/recovery with colour but keeps saturation low and always pairs colour with a label (never colour alone).
- **Port:** (1) the "read this first" plain-language sentence above every chart — the HTML does this. (2) faint severity **bands** behind the PHQ-9 line. (3) colour is *never the only* signal — every risk state has a label and a shape, for colour-blind safety.
- **Bend:** Oura/Whoop can afford a little theatre; a counselor acting on a suicide-risk item cannot. Our risk signal is a clay marker + ring + the word "review," never a red flash.

### A.7 Clinician-facing (Alma, Grow Therapy, Two Chairs, Spring Health) — credibility cues
- **Mechanic:** these read as *healthcare*, not *wellness*: deeper, less candied palettes; more whitespace around data; explicit provenance ("last updated," "source"); and trust/compliance signalling near sensitive data.
- **Port:** the **provenance + trust chips** ("Re-identified locally," "On-device," "Draft · review") placed *adjacent to the data they describe*. This is Aira's differentiator (sovereignty) turned into UI.
- **Bend:** we go *further* than them on trust because our whole pitch is privacy — hence the dedicated unlock and audio-delete surfaces (§C) that even clinician SaaS doesn't have, because they're cloud, not local-first.

### A.8 Onboarding & form-pacing (Reflectly, Finch, Headspace)
- **Mechanic:** onboarding feels short because it's **one question per screen**, progress is implied not counted, and the first "win" comes before any account friction. Forms are paced across screens with large tap targets and a persistent single primary action.
- **Port:** counselor onboarding = choose your key → see your (empty, warm) home → record your first note. The scary bits (this key can't be recovered) are stated *once, clearly*, not buried in a wall.
- **Bend:** we cannot defer the key-warning for friction's sake — it's a data-loss risk, so it's front-and-centre on the unlock/setup screen.

### A.9 Empty states
- **Mechanic (Things 3, Finch):** empty states are a *feature*, not an apology — an illustration + one encouraging line + one clear action. They set tone and reduce first-run anxiety.
- **Port:** empty caseload = mascot (reading-glasses pose) + "Your caseload is private and empty. Record your first session to begin." + primary button. This is the *one* place the mascot and a warm coral accent belong on the clinician side.

---

## B. Concrete design token set

> Values are the source of truth in [`design-direction.html`](./design-direction.html) (CSS custom properties). Contrast ratios below were computed with the WCAG relative-luminance formula (`/tmp/contrast2.py`), not estimated.

### B.1 Colour scales

**Seafoam / Brand** (hue ≈176°, derived from the mascot)

| step | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|---|---|
| hex | `#EAF7F3` | `#D2ECE6` | `#A9DDD3` | `#7FCEC0` | `#45B4A3` | `#1C9483` | `#0F6E60` | `#0B564B` | `#0C4139` | `#0C312B` |
| note | tint bg | | | **mascot body/belly** | | | **brand** | **brand-strong / anchor** | | |

**Neutral** — cool seafoam-tinted slate (this replaces the old warm cream)

| step | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|---|---|
| hex | `#F3F8F6` | `#E9F1EE` | `#D7E5E0` | `#BCCFC9` | `#94A9A3` | `#6E837D` | `#586C66` | `#42574F` | `#25352F` | `#122E2A` |

**Coral** — warm accent / human pop (used sparingly)

| step | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 |
|---|---|---|---|---|---|---|---|---|
| hex | `#FBEEE3` | `#F6D9C7` | `#F1C0A3` | `#EDA983` | `#E68A66` | `#D9714E` | `#B0472A` | `#8A3820` |

**Warm sand** (optional ground warmth, e.g. draft badges): `#F4EDDD` / border `#E7DBC1`.

### B.2 Semantic roles — LIGHT, with measured contrast

| role | token | value | measured contrast | verdict |
|---|---|---|---|---|
| App surface | `--surface` | `#F3F8F6` | `ink` on it = **13.5:1** | AAA |
| Elevated (cards) | `--elevated` | `#FFFFFF` | `ink` on it = **14.5:1** | AAA |
| Sunken (inputs) | `--sunken` | `#E9F1EE` | `ink` on it = **12.6:1** | AAA |
| Text primary | `--ink` | `#122E2A` | 14.5:1 on white | AAA |
| Text secondary | `--ink2` | `#42574F` | 7.8:1 on white | AAA |
| Text tertiary | `--ink3` | `#586C66` | 5.6:1 / 5.2:1 (elevated/surface) | AA |
| Brand (links, actions) | `--brand` | `#0F6E60` | 6.1:1 on white; white-on-it 6.1:1 | AA |
| Brand strong (primary btn) | `--brand-strong` | `#0B564B` | 8.6:1; white-on-it 8.6:1 | AAA |
| Accent (coral text) | `--accent` | `#B0472A` | 5.6:1 on white | AA |
| Positive (improvement) | `--positive` | `#1E6E48` | 6.2:1 on white; 5.4:1 on its tint | AA |
| Caution (watch) | `--caution` | `#8A610E` | 5.5:1 on white | AA |
| Risk (elevated/acute) | `--risk` | `#A83F38` | 6.1:1 on white; 5.1:1 on its tint | AA |

Semantic **fills** (icons/dots, ≥3:1 needed as large/graphical): positive `#2F8F63`, caution `#C79328`, risk `#C15A50`, accent `#E68A66`.
Semantic **tint backgrounds**: brand `#E1F1ED`, positive `#E4F2EA`, caution `#F7EED8`, risk `#F7E7E4`, accent `#FBEEE3`.

**Chart severity bands (light)** — deliberately the faintest tints so *data* carries meaning: minimal `#EAF4EF`, mild `#F0F5EC`, moderate `#FBF3DE`, mod-sev `#F9EBDD`, severe `#F7E7E4`.

### B.3 Semantic roles — DARK (dim-office variant), with measured contrast

| role | value | measured contrast | verdict |
|---|---|---|---|
| Surface | `#0E1A18` | — | — |
| Elevated | `#162523` | `ink` on it = **13.8:1** | AAA |
| Sunken | `#0A1413` | `ink` = 16.3:1 | AAA |
| Text primary `ink` | `#E8F1EE` | 15.5:1 on surface | AAA |
| Text secondary `ink2` | `#A9BEB8` | 9.1:1 on surface | AAA |
| Text tertiary `ink3` | `#829993` | 5.9:1 on surface | AA |
| Brand | `#5CC7B4` | 8.7:1 on surface | AAA |
| Brand strong | `#7FD6C6` | 10.5:1 | AAA |
| Accent | `#F0997A` | 8.1:1 | AAA |
| Positive | `#63C48F` | 8.3:1 | AAA |
| Caution | `#E0B65A` | 9.3:1 | AAA |
| Risk | `#E88A80` | 7.1:1 on surface / 6.3:1 on elevated | AA–AAA |

Dark tint backgrounds: brand `#123A34`, positive `#123528`, caution `#3A2F12`, risk `#3A1E1B`. Dark severity bands mirror these at low luminance.

> **Every** text pairing above meets or exceeds WCAG AA for its use (body text ≥4.5:1; large/graphical ≥3:1). No pairing is asserted "accessible" without a number.

### B.4 Typography

| role | font | size / line-height | weight | tracking |
|---|---|---|---|---|
| Display | Lexend | 37 / 40 | 600 | −0.025em |
| H1 page | Lexend | 25 / 30 | 600 | −0.02em |
| H2 card | Lexend | 19 / 25 | 600 | −0.01em |
| Body | Lexend | 15 / 23 | 400 | 0 |
| Body-strong | Lexend | 15 / 23 | 600 | 0 |
| Small / meta | Lexend | 12.5 / 18 | 500 | 0 |
| Label / eyebrow | Lexend | 11.5 | 600 | 0.05em, UPPERCASE |
| Data / numeric | Lexend | 17–21 | 600 | **tabular-nums always** |

- **Why Lexend:** designed explicitly for reading proficiency; wide apertures and even rhythm suit an anxious-adjacent, multilingual, sometimes-tired-clinician audience. Keeps the `handoff.md` choice.
- **Arabic (launch, UAE):** **IBM Plex Sans Arabic** — humanist, pairs metrically with Lexend, full Arabic coverage; RTL demonstrated with real glyphs in the HTML (`أنت وحدك تملك المفتاح`). Noto Sans Arabic is the fallback.
- **Devanagari (India, second market):** **Noto Sans Devanagari** — complete conjunct coverage, matches the neutral Lexend tone (`कुंजी केवल आपके पास है`).
- **RTL viability:** verified — the Arabic card in the HTML sets `direction:rtl; text-align:right` and Latin/number runs (PHQ-9, 18→9) render correctly inline. Production rule: mirror layout (icons, chart axis origin, table alignment) under `[dir="rtl"]`; keep numerals LTR.

### B.5 Shape, spacing, elevation, motion

- **Radii:** `xs 8` (controls) · `sm 12` (inputs) · `md 16` (tiles) · `lg 22` (cards) · `pill 999` (chips, trust). **Data containers stay square** (chart plot rect, table cells).
- **Spacing:** 4px base — `4, 8, 12, 16, 20, 24, 32, 40, 48`.
- **Elevation** (seafoam-tinted, not grey): `sm 0 1px 2px / 0 1px 3px rgba(14,60,54,.06)` · `md 0 4px 14px / 0 10px 28px` · `lg 0 12px 30px / 0 24px 60px`.
- **Motion:** `fast 120ms` (hover/press) · `base 180ms` (enter/expand) · `slow 320ms` (theme/route) · `float 5.5s` (mascot). Easing: standard `cubic-bezier(.2,.7,.3,1)`, emphasized `cubic-bezier(.2,.85,.2,1)`. All gated behind `prefers-reduced-motion`.

---

## C. Screen-level UX direction

Rendered mini-mocks for unlock, the audio-delete moment, and note sign-off are in the HTML (§6) and `./shots/`. Reasoning per flow:

### C.1 Unlock (local-first, no reference-app equivalent)
- **Layout:** full-bleed seafoam gradient, mascot at rest, one password field, one primary button, and a single honesty line that *combines* reassurance and warning: **"Aira can't recover this key — only you can open it."**
- **Why:** the reassurance ("only you") and the risk ("can't recover") are the *same fact*. Splitting them into a soothing headline + buried warning would be dishonest. Calm ≠ hiding the stakes.
- **Details:** no "remember me" (it's a local vault); show a subtle attempt counter only after several failures; never a fake "resetting…" spinner on a key that can't be reset.

### C.2 Session recording + the audio-delete moment (a designed trust beat)
- **During capture:** a calm waveform, a live "on-device · nothing uploaded" chip, a large stop control. The mascot is *absent* here — recording a real session is not a cute moment.
- **The delete moment** (the brief's key ask): when audio is discarded after transcription, **name it and show it** — a green check, past-tense copy ("The recording never left this device, and it's now gone. Only the de-identified draft remains."), and a short settling progress bar. This converts an invisible backend promise into a visible, repeatable trust ritual. It is the emotional payoff of the whole privacy pitch, so it gets a full moment, not a toast.

### C.3 Note review & sign-off (Invariant #4 made visible)
- **Draft badge** (`Draft · review`, warm sand) on every AI output; a persistent line "Nothing is authoritative until you sign"; **Edit** (secondary) beside **Sign off** (primary). Post-sign, the badge flips to a dated, signed state and the note becomes read-only-by-default.
- **Why:** the skeptic's core fear is "the AI decided something." The UI must repeatedly show the human as the final authority. Provenance ("from a 4-min voice note," "de-identified on this device") sits at the top of the draft.

### C.4 Single client — longitudinal view
- **Structure:** identity header (with "Re-identified locally" trust chip) → primary statistics (tabular scores, severity band, 90-day trend arrow) → the longitudinal chart (§D) → threads/homework/risk history. Naturalistic self-report (journal/Telegram) is shown in a **visually distinct, clearly-labelled** block ("On her mind — not on your report") so signed-clinical and unsigned-naturalistic never blur (Invariant #7).

### C.5 Cross-caseload overview
- **KPI tiles** (active / adherence / top triage / risk flags) → **caseload table** (Linear-grade: tabular scores, Δ-90d coloured by direction, follow-up status, risk-screen chip) → triage distribution bar. Risk flags tile uses risk *text colour* but a normal tile — not a red panel. The table is the workhorse; it's rendered in the HTML.
- **Risk column** uses the four-state dot system: Clear (green), Watch (caution), Elevated (coral), Acute·review (clay + ring). Colour is always paired with a word.

### C.6 Export / backup & transfer (local-first)
- **Model:** because data is local, export is *the* backup and *the* way to move devices. Design it as a deliberate, reassuring flow, not a menu item: (1) choose scope (whole vault / one client / date range), (2) explicit re-identification choice — "Export contains real names" vs "Export stays tokenized" with the consequence stated, (3) an encrypted-bundle default with its own passphrase, (4) a plain-language receipt of what left the device and in what form. Mirror it with an **import/restore** that verifies the bundle before merging. This is a compliance surface (PDPL/DPDP) as much as a UX one — see §F.

---

## D. Charts & data display

**The rule:** the chart lives in a rounded card (soft shell); the *plot* is square, gridded, literal.

- **Colours from the token set:** single trend line in `--brand`; endpoint filled, prior points hollow; gridlines are one hairline in `--line`; labels in `--ink` (values, tabular) and `--ink3` (axes). **No gradient area fills, no drop shadows on data, no rounded bars.**
- **Severity bands:** faint horizontal zones using `--band-*` (the palest tints in the system). They orient without shouting; the line and the labels carry meaning.
- **Plain-language first:** a one-sentence interpretation sits *above* every chart ("PHQ-9 fell from 18 to 9…"), Oura-style. Skeptics read the sentence; the chart backs it up.
- **Risk without panic:** never alarm-red. Acute risk = a clay marker (`--risk-fill`) with a soft ring + the literal word "review." The risk queue is a sober list, not a klaxon. Colour never stands alone (colour-blind safe).
- **Sparse data:** with <3 points, **do not draw a line** — render a dot-strip and a caption ("2 readings — not enough for a trend yet"). A line implies a trajectory the data can't support; for a clinical tool that's a correctness bug, not a style choice. (Rendered in the HTML.)
- **Numbers:** always tabular, right-aligned in tables, so scores scan as columns.

The HTML renders: the banded PHQ-9 line chart, the sparse-data dot-strip, KPI tiles, and the caseload table — in both light and dark — so the founder can judge "precise but not cold" directly.

---

## E. The rendered mood board & token sheet

File: [`design-direction.html`](./design-direction.html) — **fully self-contained** (Lexend, IBM Plex Sans Arabic, and Noto Sans Devanagari are base64-inlined; no CDN, no sibling assets; opens standalone). It contains: hero + mascot, the three colour scales, semantic roles with printed contrast ratios, the type ramp incl. live Arabic (RTL) and Devanagari, shape/space/elevation/motion tokens, components (buttons, chips, badges, trust pill, patient card), the PHQ-9 chart + sparse strip + KPIs + caseload table, and the three local-first screen mocks — all with a working **light/dark toggle**.

**Visual QA notes** (screenshots in `./shots/`, captured at 2–3× via Chrome-for-Testing):
- `new-light-full.png` / `new-dark-full.png` — the full sheet in both themes. Both hold together; the seafoam ground makes the mascot and the teal data read as one family, which was the goal.
- `crop-chart.png` — the PHQ-9 chart. This is the money shot: rounded card shell, but a square, gridded, tabular plot with washed severity bands and a single sober trend line. Reads precise, not cute. ✓
- `crop-mascot.png` — the inline SVG elephant sits naturally in the palette (it *is* the palette). Coral heart is the only warm note.
- `crop-screens.png` — unlock / audio-deleted / sign-off. **Fixes applied during QA:** the "Sign off" button was wrapping to two lines in the narrow column (added `white-space:nowrap`); the unlock lock/shield were jarring yellow emoji (replaced with clean line-icons matching the design). Re-shot and confirmed.
- **Known, accepted imperfection:** in dark mode the semantic *role swatches* still print their light-mode hex values (they document the canonical light palette); the dark equivalents are in §B.3. Not a bug — a documentation choice.
- Icons in the sheet are placeholder glyphs/line-SVGs; production uses Phosphor/Lucide/Iconoir per `handoff.md`.

**What already exists, assessed** (`old-mvp.png`, `old-screens.png`): the prior mockups are genuinely strong — clean two-column "ask → result" home, a real seafoam elephant SVG, tabular scores with severity bands and trend arrows, excellent trust chips ("Re-identified locally," "Identifiers never leave this device"), and a draft→sign-off note flow. **What this direction changes and why:** (1) the **warm cream ground** (`#F4EEDF`) → cool seafoam off-white, so the seafoam mascot/data cohere rather than sit on a competing warm field; (2) the **chart severity bands** lean pink/red/honey and read a touch loud → washed to the faintest tints so data carries meaning; (3) it adds the missing **dark mode** and the **local-first surfaces** (unlock, audio-delete, export) the old mockups don't have; (4) it dials back competing warm accents (gold heart + honey caution + cream) to a single coral accent lane. Net: an evolution, not a teardown — the old files already use CSS variables, so retinting is a find-replace, not a rebuild.

---

## F. Open questions for the founder

1. **Forgotten-password / recovery policy — the big one.** Local-first + "only you hold the key" means a lost password = lost data. Options:
   - **(a) Pure zero-knowledge (recommended for the sovereignty pitch):** no recovery, ever. Maximum trust, maximum risk. Requires an aggressive *backup* culture (see §C.6) and blunt onboarding copy.
   - **(b) Recovery kit:** generate a one-time recovery code at setup that the counselor must store offline. Softens data-loss risk; slightly dilutes "only you."
   - **(c) Clinic-escrow:** an admin/clinic can recover (per-clinic isolation). Best for institutional buyers, weakest privacy story.
   *Recommendation:* ship **(b)** as the default with **(a)** available for sovereign/premium buyers — it's the honest middle that avoids catastrophic first-week data loss without betraying the pitch. This is a product+legal decision, hence flagged.
2. **Warm-sand vs. cool-seafoam ground.** I moved the *canvas* to cool seafoam-tinted off-white (so the mascot/data cohere) and demoted sand to an accent. If the founder specifically wants the warmer "sand" feel of the old mockups as the ground, that's a one-token change — but I'd argue against it (§0). Confirm.
3. **Mascot dosage on clinician surfaces.** I've limited the elephant to home/unlock/empty-states and banned it from charts/risk. If the founder wants it more present (brand affection) vs. more restrained (clinical credibility), that's a positioning call. *Recommendation: restrained.*
4. **Risk colour semantics.** I use clay (`#A83F38`), not alarm-red, for acute risk. Some clinicians expect a stronger red for acute/suicidal-ideation flags for safety salience. Option: reserve a single higher-saturation red **only** for the acute suicidal-ideation state (PHQ-9 item 9), clay for everything else. *Recommendation: adopt the single-exception red for item-9 acute; keep clay elsewhere.*
5. **Second-market type at scale.** IBM Plex Sans Arabic + Noto Devanagari cover launch + India. If markets beyond these are near-term (e.g. Urdu, Tamil, Bengali), we should pick the Noto family wholesale now for consistency. Confirm the market roadmap.

---

## G. What should ship from this

This is a scout report, but the token set and `design-direction.html` are directly promotable:
- The CSS custom properties in the HTML are copy-paste ready as the app's `:root` / `[data-theme="dark"]` token layer.
- The existing `aira-mvp 3.html` / `aira-screens.html` mockups can be **retinted** to this system with a find-replace on the palette variables (they already use CSS vars) plus the cool-ground and quieter-band changes — an afternoon, not a rebuild.
- Recommended next step: rebuild the counselor **home** screen on these tokens as the first production surface (per handoff §9.2).
