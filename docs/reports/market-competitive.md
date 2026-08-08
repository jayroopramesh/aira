# Aira — Market & Competitive Research

**Scout report · 2026-08-07 · Task `aira-market-s2`**

Aira: a privacy-first, **local-first** documentation + longitudinal-insight web app for mental-health
counselors. All patient data stays **encrypted on the therapist's own device** under a password only
they hold, and is never uploaded. Browser-based, zero-backend. **Launch market: UAE** (first client is
a counselor at MBZUAI, Abu Dhabi). **Second market: India.**

> **Naming / architecture note.** The prior brief (`handoff.md`) renamed the product to "Galene" and
> described a **cloud-hybrid** architecture (in-region UAE backend, tokenized transcripts leave the
> device). That is **superseded.** This report treats the current truth as the founder stated it: the
> product is **Aira**, and the architecture has pivoted **back to fully-local / on-device**. Where I
> cite the old brief's competitive claims (its §7), I treat them as hypotheses to verify, not fact.

The two beliefs the founder asked this pass to stress-test:
1. **Privacy / data sovereignty as the wedge** — does "your data never leaves your device" actually win
   deals, or is it a say-want-ignore feature?
2. **AI analysis depth as the wedge** — specifically *longitudinal, cross-caseload* analysis, not
   per-session notes.

---

## How to read this (method & confidence)

Findings were web-verified in August 2026 across six parallel research streams (US/EU scribes;
enterprise clinical AI; regional/Arabic + Sanad; local-first/on-device; "does privacy sell"; UAE/India
compliance). Every non-obvious claim is cited with a URL. Where a fact could not be verified from a
public source it is marked **COULD NOT VERIFY** rather than inferred.

**Honest limits of this research:** live Reddit, G2, Trustpilot, Capterra and several primary PDFs were
403-blocked to automated fetching. Reddit quotes were recovered verbatim via an archive API with
permalinks verified; review-platform specifics lean on neutral comparison articles, not primary review
pages. The single weakest evidence area is **willingness to pay a *premium* for privacy** — no such
verbatim evidence was found (slightly negative signal). These caveats matter for Section D and are
flagged again there.

---

## TL;DR (the six answers)

- **A — The map.** The field splits on two axes that matter more than any feature list: **(1) where the
  data lives** (cloud-with-compliance-paperwork → on-device) and **(2) how deep the intelligence goes**
  (single-session note → cross-caseload longitudinal analytics). Almost every funded incumbent clusters
  in the same quadrant: *cloud + single-session-note*. The other quadrants are thin.
- **B — Local-first.** **No longer pure whitespace, but the specific slot Aira targets is unoccupied.**
  A 2025–26 wave of genuine on-device tools exists (Scribular, Bryl, OnDevice Notes, Sessionary) — but
  every one is a **native app** and a **single-session scribe**. **No browser-based, zero-backend,
  client-side-encrypted web app with longitudinal insight exists.** All the funded incumbents
  (Mentalyc, Upheal, Supanote, Blueprint, Klarify, Berries, Eleos, Sanad) are **cloud**, and are
  structurally boxed into it.
- **C — Longitudinal.** The old brief's "nobody does caseload reporting" claim is **partially REFUTED.**
  Blueprint and Eleos genuinely do caseload/population-level analytics; Mentalyc does cross-session
  symptom-trend tracking. **But** all are cloud, it's framed as *measurement-based-care / payor
  outcomes*, and **none does the solo-counselor triage framing** ("of my 80 students, what % are
  academic-stress, who stopped engaging, who's trending worse"). That specific framing, done locally,
  is still open.
- **D — Does privacy sell?** **It qualifies you to be considered; it does not close the deal or command
  a premium.** Privacy is the loudest *stated* concern (APA 2025: 67%, #1) and a real pass/fail gate,
  but revealed behavior shows buyers decide on **time saved > note quality > format fit > EHR
  integration > price.** 54.6% of clinicians already paste client data into ChatGPT. Local-first is a
  defensible wedge for **solo/private-pay** clinicians and **near-disqualifying for group practices.**
- **E — UAE context.** Local-first is unusually well-aligned with the *most restrictive* posture the
  region has: **DoH Abu Dhabi Circular 147 (2022) orders licensed health entities to drop cloud
  services even when UAE-hosted**, and health data generally may not leave the UAE. Cloud SaaS
  competitors are structurally disadvantaged here. The one fact that must be pinned down before selling:
  **is MBZUAI's counseling service regulated as health (DoH) or social-care (DCD), or neither?** — it
  changes which rulebook applies. The economic buyer is the **university** (IT + procurement + legal),
  not the counselor.
- **F — Cheap wins.** The genuinely cheap ones for a zero-backend app: consent-capture + audit log,
  encrypted export/backup, note hand-off (copy-to-EHR), template library, in-session assessment scoring
  (PHQ/GAD/DASS), "not stored / not trained" trust page. The expensive-or-impossible ones (say so
  plainly): live EHR integration, team/supervisor dashboards, cloud multi-device sync.
- **G — Focus.** Win unmistakably on **(1) true on-device privacy in a browser** and **(2) longitudinal
  caseload insight for the solo counselor**, with **Arabic-first** as the launch-market multiplier.
  Do **not** try to win on EHR integration, group-practice/clinic features, or being the cheapest.
  Homepage line: **"The counseling record that never leaves your laptop — and still shows you your whole
  caseload."**

---

## A. The competitive map

### The two axes that actually define the field

Vendors describe themselves by feature checklists (note formats, templates, telehealth). Those are
table stakes and converge. The two axes that actually separate the field — and on which Aira is making
its bet — are:

- **Axis 1 — Data location & trust model:** *Cloud + compliance paperwork* (upload to the vendor's AWS/
  Azure, encrypt at rest, sign a BAA) → *"we can't read it" access-control claims* → *true on-device /
  zero-knowledge* (the vendor has no server and literally cannot read the data).
- **Axis 2 — Intelligence depth:** *Single-session note generation* → *per-client continuity /
  treatment-plan threading* → *cross-session symptom trends* → *cross-caseload / population analytics.*

A useful third axis for Aira's launch is **language/region** (English-North-America-centric → Arabic-
first → India), because it is where the incumbents are weakest in Aira's markets.

### Positioning table

| Competitor | What it is | Data location & trust model | True on-device? | Longitudinal / cross-caseload | Arabic | Primary buyer |
|---|---|---|---|---|---|---|
| **Mentalyc** | MH AI note-taker + progress tracker | Cloud (AWS), AES-256, HIPAA/PHIPA/PIPEDA/SOC2; no region published | No | **Yes** — AI Progress Tracker (symptom/goal trends from session content across sessions) + group admin dashboards | COULD NOT VERIFY (likely no) | Solo → group |
| **Supanote** | Fast MH AI scribe | Cloud (AWS); HIPAA/GDPR/SOC2/ISO self-attested; no region | No | Mostly no (per-client continuity only) | "120+ langs", Arabic COULD NOT VERIFY | Solo / small group |
| **Upheal** | AI-native EHR + scribe + session analytics | Cloud (AWS), AES-256 per-customer key, pseudonymized; HIPAA/GDPR/SOC2; no region | No | Limited, session-level (Golden Thread, sentiment/speech trends per client); **not** validated symptom trends or cross-client | **Explicitly NO** (8 langs, no Arabic) | Solo → group → enterprise |
| **Blueprint** | AI assistant + **free EHR** + measurement-based care | Cloud, US infrastructure, SOC2 Type II, HIPAA/PHIPA; data not used to train | No | **Yes, strong** — clinician + org dashboards, caseload insights, population trends, payor-facing outcomes, benchmark vs 7M+ assessments, Blueprint Quality Index | COULD NOT VERIFY | Solo **and** organizations |
| **Eleos Health** | Enterprise behavioral-health "system of action" | Cloud (AWS), **continental US only**, SOC2+HITRUST+ISO; *may retain de-identified audio* | No (offline capture syncs to cloud) | **Yes, strong** — caseload/population dashboards, outcome prediction, supervisor-oriented | "150+ langs" claim, Arabic COULD NOT VERIFY | **Enterprise / agencies only** |
| **Commure / Augmedix** | General-medicine ambient scribe (Augmedix acquired 2024) | Cloud, HIPAA/SOC2, owns pipeline; no region/GDPR | No | **No** (per-session only; "analytics" = ops/ROI) | "60+ langs", Arabic COULD NOT VERIFY | Health systems / enterprise |
| **Klarify (Klara)** | "AI OS for therapists" (YC S26) | Cloud (AWS **Montreal**); **but audio processed in US by default**; HIPAA/PHIPA/PIPEDA | No | Partial — "Mindmaps" track themes **within one client**; no cross-client | 104-lang transcription; Arabic *generation* COULD NOT VERIFY | Solo / small group |
| **Berries** | MH AI scribe (+ ICD-10, plans) | Cloud, **US-hosted**, HIPAA/PHIPA/SOC2; no GDPR | No | No (per-client highlights only) | EN/ES/FR/PT "+20"; Arabic COULD NOT VERIFY | Solo / group |
| **Sanad** (Takalam × Inception/G42) | Arabic-first clinician co-pilot (intake, case-prep, plans) | **COULD NOT VERIFY** (no published data/residency/compliance story); cloud inferred (built on Jais) | COULD NOT VERIFY (cloud inferred) | Not mentioned (COULD NOT VERIFY) | **Arabic-first**, built on Jais | Institutional (MENA hospitals, universities) |
| **Scribular** | Desktop on-device scribe | **On-device** ("No cloud. No upload."); no published crypto docs | **Yes** (native desktop) | No (single-session) | COULD NOT VERIFY | Solo |
| **Bryl** | iOS on-device scribe | **On-device / zero-server** (Apple Speech / Parakeet + Apple Foundation Models / Phi-4-mini) | **Yes** (native iOS) | No (single-session) | COULD NOT VERIFY | Solo |
| **OnDevice Notes / Sessionary** | Mobile local note tools | **On-device**; Sessionary = "$3.99/mo, stored locally on iPhone, no cloud" | **Yes** (native mobile) | No | COULD NOT VERIFY | Solo (cheap utility) |
| **AI4Docs / Sahl** | Arabic *general-medicine* scribes | Cloud (AI4Docs: in-memory, "not retained server-side", MENA-aligned) | No | No | **Yes (Gulf/Levantine dialects)** — but not MH | Clinics (general medicine) |

*(Full per-competitor detail, pricing, funding and exact quotes are in the Appendix.)*

### How the field actually segments (narrative)

1. **The dominant cluster is `cloud + single-session note`.** Mentalyc, Supanote, Klarify, Berries,
   Commure, and the local-first natives all essentially do the same core loop: record → transcribe →
   structured note. They differentiate on speed, note-format breadth, and price — a crowded, commoditizing
   middle with a **free-tier norm** (Supanote, Upheal, Blueprint free tiers; Upheal at $1/session capped
   at $69/mo). Winning here on features alone is hard.

2. **Two players are climbing Axis 2 (intelligence depth), and they define the real longitudinal
   competition:** **Blueprint** (measurement-based care → free EHR → population analytics, reaching even
   solo therapists) and **Eleos** (enterprise caseload/outcome analytics for agency leadership). Mentalyc
   is a step behind them with its cross-session Progress Tracker. See Section C.

3. **Nobody funded is on Axis 1's far end (`true on-device`) except a cluster of small native apps.**
   The incumbents' entire value — server-side analytics, cross-device sync, team features — *depends on
   holding plaintext in their cloud.* They cannot pivot to zero-knowledge without dismantling their
   product. That structural lock-in is Aira's most durable wedge (Section B).

4. **The launch-market axis is wide open.** In Arabic-first *therapist* documentation there is exactly
   one credible name — **Sanad** — and it is pre-launch with no published privacy/residency/longitudinal
   story. In **India**, there is *no* dedicated MH-therapist scribe at all (incumbents are patient-facing:
   Amaha, Rocket Health, Wysa). Aira is entering two markets where the global leaders barely operate.

**The single most important structural fact:** the axis the incumbents are strongest on (cloud-enabled
analytics + integrations) is the exact axis Aira has *chosen to give up*, and the axis Aira is betting
on (on-device) is the exact axis the incumbents *cannot follow onto*. That is a real, defensible
position — provided Aira wins on intelligence depth *despite* being local, which is the hard part.

---

## B. Is anyone doing true local-first / on-device? — the sharpest question

**Verdict: On-device local-first is NO LONGER pure whitespace — a 2025–26 wave of genuine on-device
tools has appeared — BUT the specific slot Aira targets (browser-based, zero-backend, client-side-
encrypted *web* app *with longitudinal insight*) is still unoccupied, and the funded incumbents are
structurally locked out of on-device entirely.**

### The distinction that vendors deliberately blur

There are two very different things called "private":

- **(a) True on-device / zero-knowledge** — data never leaves the machine; the vendor has no server and
  literally cannot read it. No BAA is needed because there is nothing on their side to cover. Bryl states
  the philosophy exactly: *"we never had the data, not we have a contract about the data we have"*
  (https://bryl.app/).
- **(b) Cloud, encrypted-at-rest + BAA** — data is uploaded to the vendor's AWS/Azure, encrypted there,
  deletion promised, BAA signed. The vendor's infrastructure still holds plaintext at processing time.
  This is the standard incumbent posture, and phrases like *"not accessible by Supanote"* or *"Upheal
  does not have access to stored transcripts"* are **access-control assertions, not architectural
  impossibility.** (Supanote: https://www.supanote.ai/security · Upheal:
  https://support.upheal.io/en/articles/9174722)

### Who genuinely does (a) — and why they don't fully cover Aira's slot

| Tool | Form factor | On-device claim (their words) | Longitudinal? |
|---|---|---|---|
| **Scribular** | Mac/Windows desktop | *"AI runs locally… No cloud. No upload."* / *"We never see your session audio."* (https://www.scribular.com/) | No — single session |
| **Bryl** | iOS native | *"There is no Bryl server. No audio, transcript, or note is uploaded anywhere."* On-device STT + LLM. (https://bryl.app/) | No — single session |
| **OnDevice Notes** | Mobile native | *"Your data never leaves your device. Period."* Works in airplane mode. (https://ondevicenotes.com/) | No |
| **Sessionary** | iOS native | *"stored locally on your iPhone, no cloud, $3.99/month"* (https://apps.apple.com/ca/app/sessionary/id6758564968) | No |

Two things are true of **every** genuine on-device competitor: they are **native installs** (Mac/Win
desktop or iOS), and they are **single-session scribes** (record → note → done). **None is a browser/web
app, and none does cross-session or cross-caseload analytics.**

### The evidence that on-device demand is real (not vendor hype)

Therapists are hand-rolling local setups because no polished product existed — the clearest proof of
pull: Obsidian + Meld-Encrypt (AES-256-GCM local Markdown) has an active therapist thread
(https://forum.obsidian.md/t/using-obsidian-as-a-therapist/61642); DIY Ollama + whisper.cpp stacks are
documented specifically to *"remove the third-party disclosure issue that most cloud AI scribes create"*
(https://localaimaster.com/blog/local-ai-therapists). And on Reddit, "the recording isn't stored because
then it could be subpoenaed" is volunteered *unprompted* as a reason to prefer a tool
(https://www.reddit.com/r/therapists/comments/1aus0ic/ai_for_notes/).

### The browser-local-AI slot is technically proven but commercially empty

Browser-based local inference is mature — Transformers.js + ONNX Runtime + WebGPU runs Whisper and
quantized LLMs entirely in the browser, offline, with no server round-trip
(https://whisperstt.com/blog/transcribe-audio-in-browser/ ·
https://www.sitepoint.com/webgpu-browser-ai-javascript-inference/). Generic client-side-encrypted,
zero-knowledge web-note patterns are well-trodden (Standard Notes, NoteShred,
https://github.com/topics/client-side-encryption). **But I found NO therapy-specific product doing
browser/WebGPU local inference, and COULD NOT VERIFY the existence of any MH-specific, browser-based,
client-side-encrypted web app with longitudinal insight.** That intersection is Aira's whitespace.

### The incumbents are structurally locked out (the durable part)

Mentalyc, Upheal, Supanote, Blueprint, Eleos, Klarify are all cloud on AWS/Azure. Confirmed from their
own security pages: Mentalyc *"stored in secure U.S.-based cloud environments"*
(https://www.mentalyc.com/security); Blueprint *"stored encrypted on Blueprint's servers"*
(https://www.blueprint.ai/privacy-security); Eleos hosts *"strictly within the continental United
States"* on AWS (https://eleos.health/security/). Their server-side analytics, sync, and team features
*require* holding plaintext. They cannot become zero-knowledge without dismantling their value
proposition. On-device is a lane they can't merge into.

**What this means for Aira:** you cannot claim to be *first* to on-device (Scribular/Bryl got there). But
you can credibly claim to be **the first to do it in a browser with no install, and the first to pair it
with caseload-level longitudinal insight** — and the incumbents you actually compete with for the
counselor's attention (Mentalyc, Klarify, Sanad) cannot answer it at all. Watch **Bryl** most closely:
it is the nearest philosophical competitor (same "nothing to subpoena" pitch), even though it is iOS-
native and single-session.

---

## C. Is anyone doing longitudinal caseload analysis?

**Verdict: the old brief's claim that "quarterly cross-caseload reporting is whitespace — nobody does
it" is PARTIALLY REFUTED. Cross-caseload analytics exists and is well-funded — but not in the form, for
the buyer, or on the architecture Aira targets.**

### Who genuinely does longitudinal / cross-caseload work

- **Blueprint — YES, and it's their heritage.** Clinician Dashboard + "Caseload Insights" give a live
  snapshot of in-treatment clients, updating as assessments change and risk shifts
  (https://ebchelp.blueprint.ai/en/articles/5808147-overview-clinician-dashboard). For organizations:
  *"population-level trends… benchmark your outcomes against national trends… Blueprint's dataset of 7
  million+ completed assessments"* (https://www.blueprint.ai/organizations), plus the Blueprint Quality
  Index to track quality over time
  (https://www.fiercehealthcare.com/providers/blueprint-releases-new-outcomes-based-benchmarks-behavioral-health).
  **This is the closest direct competitor to Aira's longitudinal thesis, and it reaches solo therapists.**
- **Eleos — YES, but enterprise/leadership-oriented.** *"analytics dashboards… visibility into staff
  activity, caseloads… population health metrics and trends"* + outcome prediction
  (https://eleos.health/documentation/). Sold only to agencies, not solo counselors.
- **Mentalyc — YES, a step behind.** AI Progress Tracker derives symptom/goal trends *from session
  content* (no forms), a *"longitudinal, audit-ready picture of client growth"* with charts across
  sessions and *"symptom and goal tracking across every clinician's caseload"*
  (https://www.einpresswire.com/article/874504595/ · https://www.mentalyc.com/group-practice).

### Who does NOT (despite marketing that sounds like it)

- **Upheal** — session-level only: Golden Thread + sentiment/speech trends per client, but a third-party
  review notes it *"does not provide structured or measurable progress tracking over time"*
  (https://www.mentalyc.com/blog/upheal-reviews).
- **Klarify** — "Mindmaps" track themes **within a single client**; no cross-client analytics
  (https://www.klarify.ca/).
- **Supanote, Berries, Commure/Augmedix, Sanad** — no cross-caseload analytics found (Sanad: not
  mentioned, COULD NOT VERIFY).

### The refinement that keeps this a wedge

The old "whitespace" framing is wrong at the category level but **right at the specific level.** Three
gaps separate what exists from what Aira's client (a university counselor with ~80 students) actually
asked for:

1. **Framing.** Blueprint/Eleos longitudinal analytics is *measurement-based care / outcomes / payor
   reporting* — aggregate validated-scale trends to prove program impact. The counselor's question is a
   **triage-and-engagement** question: *"of my 80 students, what proportion are academic-stress cases,
   who has stopped engaging, who is trending worse?"* That is caseload **segmentation + disengagement
   detection + trajectory flags** for one clinician's own judgment — not outcomes reporting to a payer.
   No competitor presents it that way.
2. **Buyer.** The counselor-facing version of caseload analytics is Blueprint's; the disengagement/
   "who dropped off" view is closest to **Wysa Copilot's** care-monitoring but that is a patient-facing
   B2B monitoring product, not a documentation tool. The *solo counselor's own* caseload cockpit is
   thinly served.
3. **Architecture.** Every player above is cloud. **Nobody does caseload-level longitudinal analytics
   on-device.** For Aira this is both the differentiator and the hard engineering problem (Section G
   counter-argument): the analytics that make Blueprint valuable are exactly what a zero-backend app has
   to compute locally.

**Net:** don't claim "first to caseload reporting." Claim **"the counselor's own longitudinal caseload
view — segmentation, disengagement, and trajectory — computed on your device, not a payer's dashboard in
someone's cloud."** That is verifiably differentiated.

---

## D. Does privacy actually sell?

**Verdict: privacy qualifies you to be considered; on this evidence it does not close the deal or
command a premium. It is a painkiller-shaped vitamin — a real pass/fail gate that clinicians insist on
before they'll consider a tool, but not the factor they choose on.**

### What clinicians SAY (stated concern — strong)

- **APA 2025 Practitioner Pulse Survey (n=1,742 psychologists):** *data breaches / privacy = 67%, the
  #1 stated concern*, up from 59% in 2024 (https://www.apa.org/pubs/reports/practitioner/2025/full-report.pdf ·
  press: https://www.apa.org/news/press/releases/2025/12/psychologists-ai-use-concerns). Other top
  concerns: biased outputs 63%, lack of testing 61%, hallucinated output 60%, lack of transparency 52%.
- **r/therapists behavior:** in a thread praising the Freed scribe, the **top-upvoted replies were all
  privacy/consent pushback and the enthusiast was downvoted**
  (https://www.reddit.com/r/therapists/comments/1esdmrw/): *"are your clients aware and consenting to
  their audio being listened to and parsed by AI?"* (score 34); *"They claim HIPAA compliance but you
  don't know how to verify that? … Yikes"* (score 10). Fail the privacy gate → rejected in the thread.
- **Ethics bodies** (APA, ACA, NASW, BACP) are permissive on AI but **mandate a documented informed-
  consent workflow** — so privacy/consent is not optional framing, it's a required surface
  (https://www.apa.org/topics/artificial-intelligence-machine-learning/ethical-guidance-ai-professional-practice).

### What clinicians actually BUY on (revealed preference — the challenge to the thesis)

- **54.6% of 766 mental-health professionals across 30 countries already purposely use generative AI in
  practice; 84.7% of those use ChatGPT** — a non-HIPAA tool — and 81% had no formal training
  (https://preprints.jmir.org/preprint/105052). Clinicians are **already trading privacy for convenience
  at scale.**
- **SimplePractice State of Private Practice 2025:** integrated AI note-taking went **0% → 10.2% in one
  year**, adopters citing ~**5 hours/week saved** — a *time-savings* value prop, not a privacy one
  (https://www.simplepractice.com/resource/state-of-private-practice-2025-report/).
- **Across every readable review/buyer's-guide source, the ranked decision factors are consistent:**
  (1) time saved, (2) note quality/accuracy, (3) note-format/modality fit, (4) EHR integration,
  (5) price, (6) ease of use — **(7) privacy/HIPAA treated as a baseline checkbox, not a differentiator.**
  DeepCura, verbatim: *"privacy appears as a compliance checkbox rather than a differentiating factor"*
  (https://www.deepcura.com/resources/best-ai-scribe-for-therapists).
- **Willingness to pay a privacy premium: no verbatim evidence found, slightly negative.** Privacy-
  praised tools on Reddit are praised *in the same breath for being cheap* (*"super affordable"*), and
  the genuine local-first apps are all positioned as **cheap solo utilities** (Sessionary $3.99/mo). This
  is the weakest-evidence, most important caveat for Aira's pricing.

### The reconciliation

Privacy is **necessary but not sufficient.** It behaves as a **gate**: a tool that fails it is rejected;
among tools that pass, buyers choose on time-saved and note-quality. The three forms buyers *do* act on
(without calling them "privacy"): **(1) BAA availability** — a hard gate; **(2) "is my audio stored?"** —
surfaces in triage; **(3) "not used to train AI"** — an emerging marketed differentiator. The closest
thing to privacy-as-selling-point is **zero-retention framed as reduced subpoena/legal exposure to the
clinician** — a self-protection motive, notably distinct from client confidentiality.

**The trap to avoid:** privacy will not rescue a product that is slower or produces weaker notes than
incumbents, because those are the factors buyers rank first. **Win on time + note quality, and let
local-first be the trust differentiator — not the other way around.**

### Where local-first COSTS the user (honest)

- **Availability / data-loss.** Device loss = permanent, irrecoverable loss of clinical records.
  *"77% of healthcare data breaches resulted from loss or theft of a mobile device"*
  (https://www.kiteworks.com/hipaa-compliance/lost-stolen-mobile-devices-leading-cause-of-healthcare-data-breaches/).
  Encrypted-local fixes the *confidentiality* half of "local is less secure" but **not the availability
  half.** A local-first competitor concedes it in its own marketing: *"you lose automatic cloud backup…
  The main thing you lose with local-only notes is multi-device access"*
  (https://www.steadypractice.app/blog/therapist-session-notes-without-cloud.html). **Aira must ship an
  encrypted, user-controlled backup/export as table stakes.**
- **No multi-device sync** without manual transfer.
- **EHR hand-off gap.** Standalone tools inherit the #1 standalone complaint: manual copy-paste into
  EHRs *"can inadvertently add to a clinician's administrative load"*
  (https://onlinelibrary.wiley.com/doi/10.1111/jep.70365).
- **Near-disqualifying for group practices / clinics.** Group buying centers on the *opposite* of
  on-device-only — synchronized scheduling, shared treatment plans, role-based permissions, and above
  all **supervisor co-sign, which is a legal requirement local-only breaks**
  (https://www.sessionshealth.com/features/group-practices/). Mentalyc's own guide warns against picking
  solo-only tools that must be *"rebuilt at five clinicians"*
  (https://www.mentalyc.com/blog/best-ehr-for-private-practice).

**Segment read:** local-first is a **defensible, marketable wedge for solo / private-pay / privacy-
conscious clinicians and for regulators-forcing-it institutions (see UAE)**, and a **structural
mismatch for multi-clinician group practices.** Aira should not chase the group segment without an
optional encrypted-sync/shared-access tier — which would compromise the very wedge. Pick the solo +
regulated-institution lane deliberately.

---

## E. The MBZUAI / UAE launch context

*Not legal advice — publicly documented sources only; items needing local counsel are flagged. Full
citations in Appendix E.*

### The compliance picture, and why it favors local-first

- **UAE Federal PDPL (Decree-Law 45/2021)** is in force but its **executive regulations remain
  unpublished as of 2025–26**, and critically it **carves out personal health data already governed by
  sectoral health law** (https://www.dlapiperdataprotection.com/countries/uae-general/law.html ·
  https://securiti.ai/uae-personal-data-protection-law/). So the binding rules for counseling records are
  the **health-sector** ones below, not the general PDPL.
- **Federal Law 2/2019 (ICT in Health Fields), Article 13:** health data generally **may not be stored,
  processed, or transferred outside the UAE** without health-authority authorization
  (https://www.simmons-simmons.com/publications/ck0b3wuarnuml0b85ffnosaz0/160519-new-health-data-protection-law-in-the-uae).
- **DoH Abu Dhabi Circular 147/2022** is the decisive one: for DoH-licensed entities it orders **no
  health data transmitted outside the UAE** and to **"discontinue cloud-based services… irrespective of
  whether hosted within or outside the UAE"**, with a stated end goal of full localization
  (https://www.globalcompliancenews.com/2022/10/07/ · https://www.lexology.com/library/detail.aspx?g=31a37267-4fd0-4c17-ad9c-dcd292f16493).
  **ADHICS** (Abu Dhabi Healthcare Information & Cyber Security Standard, v2.0 2024, ~692 controls) is
  mandatory for DoH-licensed entities (https://www.cyberarrow.io/blog/adhics-abu-dhabi-healthcare-information-and-cyber-security-standard/).

**Where local-first is a genuine ADVANTAGE (lead with these):**
1. **No cross-border transfer** — the toughest rule (Art. 13, Circular 147) is about data *leaving the
   UAE*; if data never leaves the in-UAE device, that failure mode is designed out.
2. **No cloud-residency problem** — Circular 147 tells Abu Dhabi health entities to *drop cloud even when
   UAE-hosted.* A true on-device app is the natural answer where a cloud-SaaS competitor is effectively
   barred. **This is the strongest single argument for the architecture in the launch market.**
3. **No hosting due-diligence burden** for the buyer's IT team — nothing to geo-fence, no foreign
   sub-processor DPA, no "where are your servers" objection (which, note, *none* of Mentalyc/Upheal/
   Supanote can even answer — none publishes an AWS region).

**Where local-first still needs CARE (don't overclaim):**
- **Consent is still required** — patient/student consent to record and process is a live obligation;
  build explicit consent capture. ADHICS-style controls (encryption at rest, auth, audit logging,
  backup, secure disposal) **don't disappear — they concentrate on the device.** The lost/stolen laptop
  is your breach scenario; a de-facto **72-hour breach notification** expectation applies.

### The buying context

- **MBZUAI** is a **public graduate university established and funded by the Abu Dhabi government**
  (2019), with a formal centralized **procurement function** (https://procurementmag.com/company/mbzuai).
  Its counseling is run through **Educational Affairs** by a Student Counselor / Wellbeing Specialist,
  an *employee within a department* — **not an independent software buyer**
  (https://mbzuai.ac.ae/student-resources/educational-affairs/).
- **Practical read:** the counselor is your **champion**, but the **economic buyer is the university**
  (IT security + procurement + legal/DPO). A per-seat pilot on a department card is plausible as a
  foot-in-the-door, but scaling will draw institutional security review. **Prepare a one-page security/
  compliance brief** (architecture, on-device encryption, no-cloud, consent, breach handling).

### The one fact to pin down before selling (needs local counsel)

**Is MBZUAI's counseling service regulated as (a) a DoH-licensed *health* facility, (b) a **DCD**
(Department of Community Development) *social-care* service, or (c) an internal university student-
services function outside both?** Abu Dhabi splits mental-health regulation this way, and it determines
whether ADHICS + Circular 147 + the ICT Health Law bind it at all
(https://www.therapyroute.com/article/mental-health-licensing-regulation-in-the-uae-2025-guide-by-therapyroute).
**COULD NOT VERIFY publicly — this is the single most important compliance fact to confirm with UAE
counsel, and it is a genuine open decision for the founder (flagged in the completion section).** Also
unverified: MBZUAI's exact procurement thresholds (department-level vs central tender).

### India (second market) — quick pass

India's **DPDP Act 2023** (Rules notified Nov 2025, full rollout ~May 2027) is **far more permissive on
residency** — a **negative-list** cross-border model with **no restricted list published as of 2026**,
and **no special health-data category** (health = ordinary personal data)
(https://www.livelaw.in/articles/cross-border-transfer-healthcare-data-reconciling-india-dpdpa-gdpr-542388 ·
https://www.dpdpa.com/dpdparules/rule15.html). **Implication:** in India local-first is a *trust/
marketing* edge, **not compliance-forced** the way it effectively is in Abu Dhabi. India is also
commercially wide open — no dedicated MH-therapist scribe exists (incumbents are patient-facing: Amaha,
Rocket Health, Wysa); Supanote is the most India-linked rival (Surge/Peak XV-backed).

---

## F. Cheap wins (prioritized, honest about the zero-backend constraint)

Rough effort sizing assumes a browser/local-first, zero-backend app. **S** = days, **M** = 1–2 weeks,
**L** = 3+ weeks, **XL/✗** = structurally expensive or impossible on this architecture.

### Genuinely cheap and worth doing (do these)

| # | Feature | Why (one line) | Effort |
|---|---|---|---|
| 1 | **Explicit consent capture + timestamped log** | Ethics bodies *mandate* it; UAE consent obligation; it's the #1 recurring Reddit worry — and it's just a local record. | **S** |
| 2 | **"Not stored / not trained / never uploaded" trust page + BAA-equivalent note** | The three privacy forms buyers actually act on; local-first lets you make the *strongest* version of each truthfully. | **S** |
| 3 | **Encrypted export / user-controlled backup** | Directly neutralizes the fatal "device loss = data loss" objection (Section D). Table stakes, not optional. | **S–M** |
| 4 | **Copy-to-EHR / clean note hand-off (formatted clipboard, .md/.pdf export)** | Every standalone competitor's #1 complaint is manual paste; you can't do live EHR write-back, so make the manual path excellent. | **S** |
| 5 | **Note-format / template breadth (SOAP, DAP, BIRP, intake, MSE, treatment plan)** | Table-stakes parity; buyers rank format-fit #3; templates are static config, cheap locally. | **S–M** |
| 6 | **In-session assessment scoring (PHQ-9, GAD-7, DASS-21) + local trend chart** | Deterministic, no backend needed; feeds the longitudinal view (Section C) that is the actual differentiator. | **M** |
| 7 | **"Not used to train AI" + local processing, stated plainly** | Emerging marketed differentiator (TherapyNotes, Mentalyc now pledge it); for Aira it's *architecturally* true, not a promise. | **S** |
| 8 | **Arabic-first UI + RTL + Arabic note generation** | Launch-market multiplier; incumbents are absent (Upheal explicitly none). Larger than S but disproportionately high-leverage. | **M–L** |

### Tempting but structurally expensive or impossible (say no clearly)

| Feature | Reality on a zero-backend local-first architecture |
|---|---|
| **Live bidirectional EHR integration** | Requires a server + per-EHR API auth/write-back. **✗ / XL.** Do #4 (clean hand-off) instead and be honest that Aira is not an EHR. |
| **Team / supervisor dashboards, role-based access, supervisor co-sign** | Fundamentally multi-user + shared store = a backend. **✗** on-device-only. This is the group-practice segment; deliberately *not* Aira's lane (Section D). |
| **Cloud multi-device sync** | Contradicts the core promise; any real sync needs a server or exposes data. **✗** unless done as opt-in encrypted P2P/user-storage — expensive, and dilutes the wedge. |
| **Cross-org benchmarking (Blueprint's 7M-assessment dataset)** | Requires pooling everyone's data centrally — the exact opposite of local-first. **✗ by design.** Don't try. |
| **Payor/outcomes reporting** | Enterprise/agency feature (Eleos) needing central aggregation. Out of segment. |

**The honest headline for this section:** the cheapest high-value wins for Aira are *trust surfaces,
consent, backup, and hand-off* — precisely the things a local-first app can do better than anyone — plus
local assessment scoring that feeds the longitudinal view. The expensive competitor features are almost
all the *networked* ones, and trying to match them would destroy the differentiation. **The constraint
is the strategy.**

---

## G. What Aira should focus on

### Win unmistakably on two-and-a-half things

1. **True on-device privacy, in a browser, with zero install.** Not "HIPAA-compliant cloud" — *the
   vendor has no server and cannot read your data.* This is the one axis the funded incumbents
   (Mentalyc, Upheal, Klarify, Sanad) **structurally cannot follow onto**, and it is *regulator-aligned*
   in the launch market (DoH Circular 147). The browser + zero-install form factor differentiates Aira
   even from the native on-device apps (Scribular/Bryl).
2. **Longitudinal caseload insight for the solo counselor — computed locally.** Not payor outcomes
   reporting (Blueprint/Eleos own that), but the counselor's own cockpit: *caseload segmentation,
   disengagement detection, trajectory flags* — "of my 80 students, who's academic-stress, who stopped
   engaging, who's trending worse." Nobody pairs this with on-device.
3. **(The multiplier) Arabic-first.** Not a standalone wedge, but it turns wins #1 and #2 from
   "differentiated" into "uncontested" in the UAE launch market, where the only Arabic-first therapist
   competitor (Sanad) is pre-launch and cloud.

### Deliberately do NOT try to win on

- **EHR integration** — you can't (no backend); make hand-off excellent instead and don't pretend to be
  an EHR.
- **Group-practice / clinic / supervisor features** — structurally impossible local-only and a different
  buyer; chasing them would force a backend and kill the wedge.
- **Price / being the cheapest** — the local-first niche is full of $3.99 utilities; racing them down is
  a loss. Anchor on trust + insight value, sold into a regulated institution that has budget, not a
  price-shopping solo.
- **Per-session note *speed*** — necessary to be *good enough* (it's the #1 buy factor), but it's a
  commoditized race you won't win outright; be competitive, differentiate elsewhere.

### The homepage line

> **"The counseling record that never leaves your laptop — and still shows you your whole caseload."**

Alternates worth A/B-ing: *"Your patients' data never leaves your device. Your insight into them still
does everything."* · *"On-device notes. Whole-caseload clarity. Arabic-first."*

### Honest counter-argument to my own recommendation

The recommendation rests on privacy being a *durable* wedge, but Section D's evidence is genuinely
uncomfortable: **buyers say privacy first and buy on time-saved and note-quality**, 54.6% already paste
into ChatGPT, and there is *zero* evidence anyone pays a *premium* for privacy. If Aira's local models
(browser/WebGPU) produce **even slightly worse or slower notes** than a cloud incumbent — a real risk,
since on-device inference is more constrained than a datacenter GPU — the privacy story will not save it,
because privacy is a gate, not a purchase driver. Two further risks: **(1)** the longitudinal analytics
that justify the premium are the *hardest* thing to compute on-device (no server to crunch a caseload),
so Aira is betting on doing the hard thing *and* the constrained thing simultaneously; **(2)** the
regulator-alignment argument (Circular 147) only bites **if** MBZUAI's counseling is DoH-regulated — and
that is unverified (Section E). If it turns out to be an internal university function outside health
regulation, the compliance-forcing advantage weakens to a general-trust advantage, and Aira is back to
competing on note-quality and time-saved against better-funded incumbents.

**Mitigation implied by this:** make note-quality/speed *non-negotiably competitive first*, treat
privacy as the trust gate you pass effortlessly (because it's architecturally true), and make the
**longitudinal caseload cockpit** the thing the counselor can't get anywhere else — because that, not
privacy alone, is what a budget-holding institution will actually pay for. And confirm the MBZUAI
regulatory status early, because it determines how strong the launch-market moat really is.

---

## Appendix — per-competitor detail & sources

### Mentalyc
- Product: MH AI note-taker; SOAP/DAP/BIRP/PIRP/GIRP/PIE/SIRP + 100+ templates, intake/MSE/risk, AI
  Treatment Planner, Alliance Genie™, **AI Progress Tracker** (cross-session symptom/goal trends).
  https://www.mentalyc.com/ai-note-taker
- Pricing (no permanent free tier; 14-day trial): Mini $19.99/$14.99 (40 notes) · Basic $39.99/$29.99
  (100) · Pro $69.99/$59.99 (160) · Super $119.99/$99.99 (330) · Team ~$119.99/seat (promo ~$49.99
  annual). https://www.mentalyc.com/pricing
- Data/compliance: AWS, AES-256; HIPAA/PHIPA/PIPEDA/SOC2 Type II; transcript anonymized, audio deleted
  ~3 days, not used to train; **region not published; GDPR not mentioned.** https://www.mentalyc.com/security
- Longitudinal: **Yes** (Progress Tracker + group admin dashboards). EHR: Chrome-extension push
  (SimplePractice, TherapyNotes, TheraNest, ICANotes, Valant, Jane, …), not bidirectional.
  https://www.mentalyc.com/ehr-integration · https://www.mentalyc.com/group-practice
- Languages: no public list, English-focused; **Arabic COULD NOT VERIFY.** Buyer: solo → group.
  Funding: pre-seed $100K (2022, Berkeley SkyDeck); later rounds COULD NOT VERIFY.

### Supanote
- Product: fast AI scribe (<1 min); SOAP/DAP/intake/plans/MSE/discharge/BIRP + custom; per-client
  workspace (Pro+); auto PII scrub; recordings deleted after transcription. https://www.supanote.ai/
- Pricing: Free (5 notes/mo) · Starter ~$19.99 (40) · Pro ~$39.99 (unlimited) · XL ~$69.99 (+ group) ·
  Group Practice custom. https://www.supanote.ai/pricing
- Data/compliance: **AWS** (their words); HIPAA/GDPR/PIPEDA/SOC2/ISO 27001 self-attested (independent
  reports not retrievable); "never store PHI"; may use de-identified data for research. **Region COULD
  NOT VERIFY.** https://www.supanote.ai/security · https://security.supanote.ai/
- Longitudinal: mostly no. EHR: Valant, SimplePractice, TherapyNotes, Tebra, DrChrono, ICANotes, Ensora,
  Carepatron (Pro+). Languages: "120+", Arabic COULD NOT VERIFY. Buyer: solo/small group.
  Funding: 2024, SF, Surge/Peak XV-backed (India-linked); total COULD NOT VERIFY.

### Upheal
- Product: AI-native EHR + scribe; 170+ note sections, HIPAA telehealth, **session analytics** (talk-
  time, sentiment, cadence, silence), scheduling/payments/billing, agentic "Upheal Assistant" (2026).
  https://www.upheal.io/support/en/articles/9149070-what-does-upheal-do
- Pricing: Free $0 (no telehealth transcript) · Individual $1/session capped $69/mo · Group/Enterprise
  custom; payments 2.9%+$0.30, claims $0.30. https://www.upheal.io/pricing
- Data/compliance: **AWS**, AES-256 per-customer key, pseudonymized; HIPAA/GDPR/UK-GDPR/PHIPA/PIPEDA,
  SOC2; **region/EU-vs-US residency COULD NOT VERIFY.** https://www.upheal.io/privacy-and-compliance
- Longitudinal: limited session-level (Golden Thread, per-client sentiment trends); **not** validated
  symptom trends or cross-client (https://www.mentalyc.com/blog/upheal-reviews). Languages: **8, no
  Arabic** (https://upheal.io/support/en/articles/8379178). Buyer: solo→group→enterprise.
  Funding: ~$14.3M total (Series A $10M Nov 2024, Headline); claims 70,000 providers/23 countries.

### Blueprint
- Product: AI assistant + **free Core EHR**; AI notes, smart treatment plans, 50+ automated assessments,
  **measurement-based care**. https://www.blueprint.ai/blog/blueprint-2-0
- Pricing: Core EHR **free**; AI Plus $0.99/session, Pro $1.49/session, Enterprise custom; payments
  3.15%+$0.30. https://www.blueprint.ai/pricing
- Data/compliance: **US infrastructure**, SOC2 Type II, HIPAA/PHIPA; encrypted in transit/at rest;
  client data **never used to train**, audio deleted after processing; **GDPR not mentioned, non-US
  residency COULD NOT VERIFY.** https://www.blueprint.ai/privacy-security
- Longitudinal: **Yes, strong** — Clinician Dashboard + Caseload Insights, org population trends, payor
  outcomes, benchmark vs 7M+ assessments, Blueprint Quality Index.
  https://www.blueprint.ai/organizations · https://ebchelp.blueprint.ai/en/articles/5808147
- Languages: not specified, Arabic COULD NOT VERIFY. Buyer: solo **and** organizations (70,000+ pros).
  Funding: ~$32–34M total (Series B ~$15M Apr 2025).

### Eleos Health
- Product: enterprise behavioral-health "system of action" — Scribe, Quick Note, Outreach, Verify; 2026
  agentic suite (Live Quality Assist, RCM/compliance). https://eleos.health/
- Pricing: **not published** (enterprise demo/quote). Data: **AWS, continental US only**; SOC2 Type II +
  HITRUST + ISO 27001/27799; **may retain de-identified audio to improve system**; GDPR not mentioned.
  https://eleos.health/security/
- Longitudinal: **Yes, strong** — caseload/population dashboards, outcome prediction, supervisor-
  oriented. https://eleos.health/documentation/ EHR: ~9 (AdvancedMD, Kipu, SmartCare, Welligent, …).
  Languages: "150+" claim, Arabic COULD NOT VERIFY. Buyer: **enterprise/agencies only** (not solo).
  Funding: $120M+ total (Series C $60M).

### Commure / Augmedix
- Product: general-medicine ambient scribe (Commure acquired Augmedix Oct 2024, ~$139M); behavioral-
  health *templates* but per-session only. https://getscribe.commure.com/ai-scribe-for-behavioral-health
- Pricing: Free trial · ScribePro $59/mo (annual) · Enterprise custom. Data: HIPAA/SOC2, owns pipeline;
  **region/GDPR not disclosed.** Longitudinal: **no** (ops/ROI analytics only). EHR: ~11 (athenahealth,
  AdvancedMD, eClinicalWorks, MEDITECH, SimplePractice, Tebra, …). Languages: "60+", Arabic COULD NOT
  VERIFY. Buyer: health systems/enterprise. Commure raised $70M at ~$7B (May 2026).

### Klarify (Klara) — YC S26
- Product: "AI OS for therapists" — scribe (20+ note formats), plans, clinical letters, **insurance
  claims/CPT/appeals**, pre-session prep, worksheets, supervision prep. https://www.klarify.ca/
- Pricing: Seed $0 (10 sessions) · Sprout $16 (70) · Bloom $32 (130) · Forest $71 (unlimited); ~20%
  off yearly; clinic pricing by email.
- Data/compliance: **AWS Montreal**, "permanently stored in Canada" — **but audio processed in US by
  default** (EU optional); HIPAA/PHIPA/PIPEDA/UK-GDPR/Quebec Law 25; encryption spec not named.
  https://www.klarify.ca/legal/privacy-policy
- Longitudinal: partial — "Mindmaps" track themes **within one client**; no cross-client. EHR: none by
  design (browser capture). Languages: 104-lang transcription; Arabic *generation* COULD NOT VERIFY.
  Buyer: solo/small group. Traction: ~6,000–8,300 therapists (conflicting). Funding: YC S26; raise
  COULD NOT VERIFY. https://www.ycombinator.com/companies/klarify

### Berries
- Product: MH AI scribe + treatment plans + ICD-10 + emails + pre-session highlights; records from
  iPhone; building own EMR. https://heyberries.com/ (US/Delaware — **not** SE-Asia)
- Pricing: free trial (20 then 10/mo) · Pro $79/mo (older $99 cited) · Group custom. Data: **US-hosted**,
  HIPAA/HITECH/PHIPA, SOC2, auto-BAA; no recordings stored, PHI not trained; **GDPR not claimed.**
  https://heyberries.com/privacy-policy Longitudinal: no. EHR: **copy-paste only.** Languages:
  EN/ES/FR/PT "+20", Arabic COULD NOT VERIFY. Buyer: solo/group. Funding: **bootstrapped** (2023).

### Sanad (Takalam × Inception/G42) — ⭐ key regional competitor
- Status: **unveiled Oct 2025, "next stage of testing" — NOT generally available**; no pricing, logos,
  or signup. https://dharab.com/takalam-and-inception-launch-sanad-the-ai-assistant-for-therapists/
- Product: clinician co-pilot — conversational **intake**, case/session prep, treatment-plan management,
  admin reduction (not a patient chatbot; Takalam's patient product "Aila" is separate).
- Data/compliance: **COULD NOT VERIFY** — no published cloud-vs-local, storage location, or PDPL/HIPAA/
  residency story (cloud inferred, built on **Jais** with G42/Inception infra). **This gap is directly
  attackable.** Longitudinal/EHR: not mentioned (COULD NOT VERIFY).
- Languages: **bilingual Arabic-English, Arabic-first** (Jais). Buyer: institutional (MENA hospitals,
  universities, research). Backing: **Inception (a G42 company)** — deepest-pocketed regional threat;
  Takalam raised $1M pre-seed (2022). The threat is the capital + Jais + distribution, not today's
  feature set.

### Genuine on-device / local-first (native apps, single-session)
- **Scribular** (Mac/Win desktop): https://www.scribular.com/ — "No cloud. No upload."
- **Bryl** (iOS): https://bryl.app/ — "There is no Bryl server." On-device STT (Apple Speech / Parakeet)
  + LLM (Apple Foundation Models / Phi-4-mini). **Closest philosophical competitor.**
- **OnDevice Notes** (mobile): https://ondevicenotes.com/ — "Your data never leaves your device."
- **Sessionary** (iOS): https://apps.apple.com/ca/app/sessionary/id6758564968 — "$3.99/mo, local, no
  cloud." **SteadyPractice** — local-only, concedes "you lose automatic cloud backup."
- **Heidi Remote** (hardware): on-device capture but **syncs to Heidi cloud** — not local-first.
- Browser-local-AI proven (Transformers.js/ONNX/WebGPU + Whisper) but **no therapy product occupies it.**

### Arabic scribes (general medicine, not MH)
- **AI4Docs** (https://ai4docs.ai/arabic-ai-medical-scribe): cloud, "in-memory, not retained server-
  side", GDPR-aligned, MENA-aligned (Saudi NDMO / UAE FPDL / Egypt EDPA); 13 langs incl. Gulf/Levantine;
  $19–79/mo; **no India.** **Sahl AI**: bilingual ambient scribe, Riyadh pilot; general clinical.

### India (second market)
- No dedicated MH-therapist scribe. Patient-facing: **Amaha/InnerHour** (~₹50 Cr, Fireside), **Rocket
  Health** (AI journal, bootstrapped), **Wysa Copilot** (B2B care-monitoring — closest, but patient-
  facing), Lissun. General-medicine scribe **Augnito** (Mumbai, ~$7.2M, Apollo-backed) is the likeliest
  future entrant. **India is wide open for therapist documentation.**

### Regulatory sources (Section E)
- PDPL: https://www.dlapiperdataprotection.com/countries/uae-general/law.html ·
  https://securiti.ai/uae-personal-data-protection-law/ · https://uaelegislation.gov.ae/en/legislations/1972
- ICT Health Law 2/2019 Art. 13: https://www.simmons-simmons.com/publications/ck0b3wuarnuml0b85ffnosaz0/160519-new-health-data-protection-law-in-the-uae ·
  https://www.recordinglaw.com/world-laws/world-data-privacy-laws/uae-data-privacy-laws/
- DoH Circular 147 / localization: https://www.globalcompliancenews.com/2022/10/07/ ·
  https://www.lexology.com/library/detail.aspx?g=31a37267-4fd0-4c17-ad9c-dcd292f16493
- ADHICS v2.0: https://www.cyberarrow.io/blog/adhics-abu-dhabi-healthcare-information-and-cyber-security-standard/
- DoH vs DCD licensing: https://www.therapyroute.com/article/mental-health-licensing-regulation-in-the-uae-2025-guide-by-therapyroute
- MBZUAI: https://mbzuai.ac.ae/student-resources/educational-affairs/ · https://procurementmag.com/company/mbzuai
- India DPDP: https://www.livelaw.in/articles/cross-border-transfer-healthcare-data-reconciling-india-dpdpa-gdpr-542388 ·
  https://www.dpdpa.com/dpdparules/rule15.html

### Evidence sources (Section D — does privacy sell)
- APA 2025 Pulse (n=1,742): https://www.apa.org/pubs/reports/practitioner/2025/full-report.pdf ·
  https://www.apa.org/news/press/releases/2025/12/psychologists-ai-use-concerns
- JMIR 54.6% use gen-AI: https://preprints.jmir.org/preprint/105052
- SimplePractice 0→10.2%: https://www.simplepractice.com/resource/state-of-private-practice-2025-report/
- r/therapists Freed thread: https://www.reddit.com/r/therapists/comments/1esdmrw/ · "recording isn't
  stored → subpoena": https://www.reddit.com/r/therapists/comments/1aus0ic/ai_for_notes/
- "privacy = compliance checkbox": https://www.deepcura.com/resources/best-ai-scribe-for-therapists
- Ethics: APA https://www.apa.org/topics/artificial-intelligence-machine-learning/ethical-guidance-ai-professional-practice ·
  ACA https://www.counseling.org/resources/research-reports/artificial-intelligence-counseling/recommendations-for-client-use-and-caution-of-artificial-intelligence
- Local-first costs: https://www.kiteworks.com/hipaa-compliance/lost-stolen-mobile-devices-leading-cause-of-healthcare-data-breaches/ ·
  https://www.steadypractice.app/blog/therapist-session-notes-without-cloud.html ·
  group co-sign https://www.sessionshealth.com/features/group-practices/

---

## What I did (method log)

- Read the source material: `handoff.md` (prior brief — noted it is superseded by the fully-local
  pivot; product is Aira, not Galene/cloud-hybrid) and the `AI operating system…` PDF (build spec —
  data model, patient channel, risk rules; extracted via `pdfminer.six`). Reviewed the existing Aira
  mockups (`aira-screens.html`, `aira-mvp 3.html`) to map current V1 scope: Flow 1 voice→signed note,
  Flow 2 pre-session brief, Flow 3 caseload "Patterns" reporting, Telegram patient channel, journal,
  homework/follow-up tracking — all tagged "On-device · sovereign."
- Ran six parallel research streams (web-verified, August 2026): US/EU scribes (Mentalyc/Supanote/
  Upheal); enterprise clinical AI (Blueprint/Eleos/Commure-Augmedix); regional + Arabic + Sanad;
  local-first/on-device; "does privacy sell"; UAE/India compliance & procurement.
- Synthesized into this report. Every non-obvious claim carries a URL; unverifiable facts are marked
  COULD NOT VERIFY.

**Open decision that belongs to the founder (not resolvable by research):** whether MBZUAI's counseling
service is DoH-regulated (health), DCD-regulated (social care), or an internal university function —
which determines how strong the regulatory moat for local-first actually is, and needs UAE local
counsel. Flagged to the completion gate.
