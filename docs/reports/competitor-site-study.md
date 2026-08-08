# Aira — Competitor Website Study: what we can borrow for our own pages

**Market-intelligence deliverable · Task `market/task-001` · 2026-08-08**
**Author: market secondmate. Method: live capture via `chrome-devtools-axi` (headless Chrome for Testing), session "market".**

This is an *applied* study, not another landscape survey. The prior market study
(`aira-market-s2/report.md`) established who the competitors are, whether privacy sells, the ranked
buyer decision factors, and the UAE/India picture. This report builds on it and answers a narrower
question: **how do these products present themselves on the web, and what concretely can go on Aira's
own pages?** Positioning claims are checked against the feasibility report (`aira-stack-s1/report.md`)
so nothing here promises something V1 cannot deliver.

## How to read this (verification & confidence)

- Every competitor line in the Findings half was **read live on 2026-08-08** from the URL cited. Quoted
  strings are copied only into this internal evidence doc for accuracy; **none of it may be reproduced
  onto an Aira page** (hard rule — we borrow the *pattern*, never the *material*).
- **Verified** = I saw it on the live page today. **Inferred** = my reading of what the pattern is
  doing, labelled as such. **Unverified** = could not confirm; flagged.
- **No legal or compliance conclusions.** Where a competitor claims HIPAA/PHIPA/SOC 2/GDPR I report the
  claim and its wording only. What Aira may lawfully claim in the UAE is a question for local counsel,
  not this report.
- Sites studied: **Supanote, Klarify, Mentalyc** (the three named), plus **Upheal** and **Blueprint**
  (the two obvious adds from the prior study — the sophisticated-privacy-narrative player and the
  longitudinal/price player), plus **Bryl** (added deliberately — see below).

**Why Bryl was added.** Bryl (https://bryl.app/) is the one competitor actually selling the pitch Aira
will make: *on-device, zero-server, "nothing leaves your device."* Every other competitor is cloud, so
their privacy pages model how to *dress up* a cloud promise. Bryl models how to sell the *real* thing —
verifiability, the device-loss objection, the "no BAA needed" reframe — which is exactly the ground Aira
stands on. It is the single most instructive site for us, and Aira can out-claim even Bryl on three
axes (browser/no-install, longitudinal caseload, and — later — Arabic).

---

# PART 1 — FINDINGS

## 1.0 The one structural pattern that matters most

Across all six sites the privacy/trust story takes one of **two fundamentally different shapes**, and
the difference is Aira's entire opening:

- **Policy-promise privacy (the five cloud players).** Supanote, Mentalyc, Upheal, Blueprint, Klarify
  all say versions of *"we don't train on your data / we can't access it / it's certifiably protected."*
  Every one of these is an **access-control or policy assertion over data the vendor still holds in its
  cloud.** The strongest examples: Upheal — *"Most AI companies exploit your data. We don't."* and *"Can
  Upheal access clients' information...?"* (https://www.upheal.io/privacy-and-compliance); Supanote —
  *"fully encrypted and not accessible by Supanote... stored in HIPAA and PHIPA compliant databases"*
  (https://www.supanote.ai/); Klarify — *"Your session data is yours. We never train on it, never sell
  it, never share it. Full stop."* (https://www.klarify.ca/). These are promises. The vendor *could*
  break them; the buyer has to *trust* they won't.
- **Architectural privacy (Bryl, and where Aira lives).** Bryl: *"there is no Bryl server... Nothing is
  sent to a server — you can prove it by turning on Airplane Mode"* (https://bryl.app/). This is not a
  promise; it is a property of the system the user can **verify**.

**This is the finding that drives every recommendation:** Aira does not have a *better privacy policy*
than these competitors — it has a *different category of privacy*. Our job on the page is to make that
category difference legible and, ideally, verifiable — without slipping into their policy-promise
vocabulary, which would flatten our advantage into "another vendor that pinky-swears."

## 1.1 Per-site findings

Each site scored on the six requested dimensions. All observations verified live 2026-08-08.

### Supanote — https://www.supanote.ai/
- **Positioning line.** H1: *"Spend More Time With Clients, Not Notes."* Subhead: *"AI Therapy Notes |
  HIPAA-compliant | Built for mental health."* Nouns: professional = "therapist"; person = **"client"**;
  artefact = "note." Benefit-first headline (time), category + compliance in the subhead.
- **Trust/privacy/compliance.** A dedicated homepage section *"Built for Privacy. Backed by Security"*
  with four cards — *All Recordings are DELETED · Personal information REMOVED · You have CONTROL ·
  Everything across the stack is ENCRYPTED* — subheaded *"We meet HIPAA, PHIPA, PIPEDA and GDPR."*
  Offers downloadable **consent forms and a BAA**. *(Inferred: privacy is a mid-page reassurance block,
  not the pitch; encryption claim is the access-control kind — "not accessible by Supanote.")*
- **Feature framing.** Three-step "how it works": *Record/dictate/upload → Review and approve → Copy and
  paste to EHR.* Capability→benefit sections: *"Never Write a Note From Scratch Again," "Notes That
  Capture the Nuance," "Clinical Notes that Sound Like You."*
- **Objection handling.** Section *"Responsible and High-Quality Notes"* pre-empts accuracy fears
  (*"trained on thousands of therapy notes... the right level of detail"*) and the client-can-read-it
  fear (*"written respectfully and factually, keeping in mind they can be accessed by clients"*).
- **Pricing.** Public, monthly/yearly toggle. Free 14-day trial → Starter $19.99 (40 notes) → **Pro
  $39.99 "Most Selected"** (unlimited) → XL $69.99 (group) → Group Practice custom. Anchor = **notes/
  month cap**; "Most Selected" badge steers to the middle tier.
- **Proof.** *"Loved by 10,000+ therapists"* + five named testimonials **with credentials** (PhD, LCSW,
  LMFT, PsyD, LPC) and time-saved quotes (*"reduced my note time to just 15 minutes a week"*).

### Mentalyc — https://www.mentalyc.com/
- **Positioning line.** Hero: label *"AI for Therapists,"* headline *"Be Fully Present. Leave With
  Everything Done."* Subhead names the whole role set (*"therapists, counselors, and mental health
  professionals"*) and the outputs (*"clinical notes, assessments, and treatment plans... tracks
  progress... therapeutic alliance"*). Person = "client"; heavy SEO noun-stacking in the title tag.
- **Trust/privacy/compliance.** The **strongest security page** of the set
  (https://www.mentalyc.com/security): H1 *"...Your Client Data, Safe By Design,"* H2 *"Private by
  design. Compliant by requirement,"* cards for HIPAA/PHIPA/SOC 2, **"AES-256 Encryption On AWS"**
  (explicitly cloud), *"No Data Stored. Never Trained On.,"* *"Ready For Client Records Requests,"*
  *"Ready For Insurance Audit,"* *"BAA & Informed Consent Template Included."* A very deep FAQ handles
  **institutional/legal** objections: 42 CFR Part 2 (SUD), *"Will my boss be aware that I am using
  Mentalyc?,"* records requests, insurance audit, medical-records status. *(Inferred: this page is built
  to survive a compliance officer, not just reassure a solo clinician — the enterprise-buyer playbook.)*
- **Feature framing.** *"Your EHR added AI notes. That's not what this is"* and *"More Than Notes"* —
  positions above commodity scribing toward insight. A dedicated *"How Is Mentalyc Different From
  ChatGPT for Therapists?"* FAQ pre-empts the free-ChatGPT substitute.
- **Objection handling.** The security FAQ above, plus the anti-EHR and anti-ChatGPT framings.
- **Pricing.** *"Simple, transparent pricing. No contracts."* Solo/Group toggle, monthly/annual (*"Save
  up to USD 240"*). Mini $14.99 (40 notes) → Basic $29.99 (100) → **Pro $59.99 "POPULAR"** (160) →
  higher. Anchor = notes/month; annual savings emphasised.
- **Proof.** *"Join 30,000+ therapists who've reclaimed their evenings."* Hero product mockups
  foreground **longitudinal insight**: *"Progress Tracker — Anxiety last 6 sessions," "Alliance Insights
  — rupture noticed & repaired," "Connection Trend."*

### Upheal — https://www.upheal.io/
- **Positioning line.** H1: *"Save time with secure AI progress notes"* (note "secure" placed *inside*
  the headline). Subhead: *"The most loved AI notes for therapists. Plus everything you need to replace
  your EHR, when you're ready."* Meta adds *"Built by clinicians."*
- **Trust/privacy/compliance.** The **most sophisticated privacy narrative** of the set
  (https://www.upheal.io/privacy-and-compliance): H1 *"Privacy as a foundation,"* subhead *"...treats
  privacy as a foundation, not a checkbox. Every compliance feature... is built into the EHR, not an
  add-on tier."* Six "you"-framed pillars (*Your sessions won't train our AI · Your clients control
  their own data · Your data is never for sale · Your therapeutic privilege comes first · Your privacy
  is certifiably protected · Your security is continuously verified*) and the aggressive contrast line
  *"Most AI companies exploit your data. We don't."* Hero also stacks badges: **SOC 2 II certified,
  GDPR & DPA compliant, Trustpilot 4.6/5.** *(Inferred: "therapeutic privilege comes first" invokes the
  legal/subpoena self-protection motive the prior study flagged as the one privacy angle buyers act on.)*
- **Feature framing.** Speed: *"From session to signed note in 60 seconds."* Four-step Capture→Select→
  Get notes→**Sign**. Land-and-expand: *"Already loving our notes? Upheal can replace your whole EHR"*
  (billing, scheduling, portal, telehealth, payments) + *"Switch from SimplePractice in minutes."*
- **Objection handling.** *"...not a checkbox... not an add-on tier"* pre-empts the fear that privacy is
  upsold; FAQ *"Can Upheal access clients' information stored on the platform?"* addresses the access
  fear head-on (and answers it as a policy assertion).
- **Pricing.** **Usage-based, value-reframed:** *"Only pay for the sessions you hold. Legacy EHRs charge
  for access. We charge for jobs done."* $1/session capped $69/mo; free plan after a 30-day trial;
  30-day money-back. A **head-to-head comparison table** at 45 sessions/mo: Upheal $45 vs SimplePractice
  $84 vs TherapyNotes $109 vs Jane App $69.
- **Proof.** *"Trusted by 70,000+ providers,"* Trustpilot score in the hero, *"Supporting 800+
  organizations."*

### Blueprint — https://www.blueprint.ai/
- **Positioning line.** H1: *"The AI Assistant for Therapists."* Subhead: *"...automate documentation,
  draft smart treatment plans and surface **actionable insights before, during, and after every
  session**"* — insight + a before/during/after structure. Nouns: "therapist," "client."
- **Trust/privacy/compliance.** Compliance badges (HIPAA/PHIPA/SOC 2) sit **directly under the hero
  CTA**. Security page (https://www.blueprint.ai/privacy-security): H1 *"Privacy and security, designed
  for modern clinical care,"* *"secure, audited infrastructure... verified through independent audits,"*
  and a *"commitment to you"*: *"You own and control your data · You control how client records are
  created."* Also *"Draft before final"* (the draft-until-sign pattern).
- **Feature framing.** Workflow triad: *"Prep before every session · Stay present during the session ·
  Automate notes and send between-session support."* Land-and-expand: *"Use Blueprint directly on top of
  your EHR"* OR *"Ready for a new EHR? Level Up your Assistant."*
- **Objection handling.** *"with or without recording"* (addresses the record-consent fear), *"Draft
  before final"* (addresses the accuracy/AI-mistake fear), *"You own and control your data."*
- **Pricing.** **Aggressive price/access play:** *"No subscriptions or monthly fees. No credit card
  required. 60 day money back guarantee. Tax deductible."* Standard **$0.49/session**, Plus $0.99/
  session, Pro (Blueprint's own EHR), and a **free AI-assisted EHR** underneath. Per-session micro-
  pricing.
- **Proof.** *"Trusted by over 70,000 mental health professionals across thousands of organizations"* +
  a credentialed testimonial (*Dwain Pellebon, PhD, LCSW*).

### Klarify (Klara) — https://www.klarify.ca/
- **Positioning line.** H1: *"The AI assistant every therapist deserves."* Subhead: *"Klara handles the
  notes, prep, paperwork, and admin, so you can focus on the work only you can do."* **Personifies the
  AI as "Klara"** (a named helper) with a *"Try me!"* chat demo.
- **Trust/privacy/compliance.** Notably, privacy is a **hero-level block on the homepage**, not buried:
  *"Your notes are protected. Always,"* *"Your session data is yours. We never train on it, never sell
  it, never share it. Full stop. PHIPA, PIPEDA, and HIPAA compliant,"* with a *"Read our privacy
  commitment"* link. *(Inferred: Klarify treats privacy as a headline trust beat, closer to how Aira
  should — but the claim is still a policy promise over cloud storage.)*
- **Feature framing.** *"Uncover the patterns beneath the surface. Each client gets their own
  interactive mind map that grows over time"* — a within-client longitudinal/visual angle. Warmth
  register throughout (*"You care about your clients. So does Klara"*).
- **Objection handling.** The emphatic *"Full stop"* privacy line pre-empts the data-use fear; a founder
  story (*"Therapy changed both of our lives"*) builds credibility.
- **Pricing.** Growth-metaphor tiers with multi-currency (USD/CAD/GBP/EUR) and monthly/yearly (Save
  20%): **Seed $0** (10 sessions) → Sprout $16 → Bloom $32 → Forest $71 → Clinic. 14-day free trial.
- **Proof.** *"The Klarify effect, by the numbers,"* named-therapist testimonials, a *"Find a Therapist"*
  directory (a two-sided-network credibility signal).

### Bryl — https://bryl.app/  ⭐ (on-device, the closest model for us)
- **Positioning line.** H1: *"Therapy notes that never leave your iPhone."* Body: *"Bryl listens to your
  session, writes the SOAP/DAP/BIRP note on your iPhone, and deletes the audio when you're done. Nothing
  is sent to a server — you can prove it by turning on Airplane Mode."* Meta: *"...entirely on-device.
  No cloud, no BAA needed. Verifiable in Airplane Mode."* Concrete, device-anchored, physical.
- **Trust/privacy/compliance — the verifiability move.** Badge *"VERIFIABLE IN AIRPLANE MODE."* Section
  *"One line on the diagram. Nothing leaves the phone,"* which **explicitly contrasts** on-device vs
  cloud: *"'HIPAA-compliant' cloud scribes still upload your session audio to their servers. Bryl
  doesn't... there is no Bryl server."* *(Inferred: Bryl converts a privacy CLAIM into a user-runnable
  TEST — the single most powerful pattern on any of these pages, and the one Aira can borrow most
  directly because it's architecturally true for us too.)*
- **Feature framing.** Concrete, benefit-named cards rather than feature lists: *"50 minutes, two
  voices," "Risk language, flagged," "Couples + family, every voice labeled," "Audio deleted by
  default," "Sign once. The note is locked," "Triage at a glance," "Goals, threaded through every
  session"* (a longitudinal beat). *"Three taps. No web portal."*
- **Objection handling — empathy-first.** A pain-agitation scroller: *"It's 8:47 PM. You're still
  typing 'client presented with…'... You've explained to three clients why their audio sits on someone
  else's server... You shouldn't need a Business Associate Agreement just to write notes."* The FAQ is
  titled *"The questions you asked your ethics consultant,"* and the **device-loss** answer is the model
  Aira needs: *"Sessions are encrypted at rest with a key tied to your passcode and FaceID. Lost or
  stolen, the data is unreadable. Pair with encrypted iCloud Backup so a replacement device can restore
  your locked notes — Apple cannot decrypt these."*
- **Pricing.** **Single flat price as a trust signal:** *"One price. No add-ons. No per-seat charge. No
  'Pro' feature locked behind an upsell. The price you see is the price you pay."* SOLO $29/mo (annual
  discounted); footer badge *"NOTES REMAIN ON YOUR DEVICE."*
- **Proof.** Verifiability itself is the proof; plus concrete ROI framing (*"The math, on your
  caseload"*). Lighter on logos/counts than the funded players (*inferred: consistent with a smaller,
  younger product*).

## 1.2 Synthesis across all six

**Positioning lines.** The dominant shape is **[benefit] + [category] + [compliance token]**: a
time/presence benefit in the H1 (*"Spend More Time With Clients," "Be Fully Present," "Save time,"
"reclaimed their evenings"*), the category ("AI therapy notes / AI assistant for therapists") in the
subhead, and a compliance token (HIPAA) nearby. Only **Bryl** leads with the *property of the product*
("never leave your iPhone") rather than the benefit. **Nouns are strikingly uniform:** the professional
is *therapist / counselor / clinician / mental-health professional*; the person is almost always
**"client," never "patient"**; the artefact is a *note / progress note / clinical note*. The AI is
sometimes personified (Klarify's "Klara"), usually not.

**Trust/privacy/compliance presentation.** Universal furniture: **HIPAA (+PHIPA/PIPEDA/SOC 2/GDPR)
badges, a BAA, a "we don't train on your data" line, and "recordings deleted."** Placement varies from
a mid-page reassurance block (Supanote) to a hero beat (Klarify, Upheal's badges) to a whole
category-defining argument (Bryl). The sophistication ceiling is Upheal ("*foundation, not a
checkbox*") and Mentalyc's compliance-officer-grade FAQ. **But all five cloud players are trapped in
policy-promise language** because their architecture forces it. Bryl is the only one who can say
"verify it yourself," and that is the exact register Aira inherits.

**Feature framing.** Everyone converts capability→benefit and shows a **3–4 step "how it works"** ending
in **Sign** (the draft-until-sign pattern is universal — good, because it's the honest V1 pattern for
Aira too). The funded players are climbing from "notes" toward "insight/assistant" (Mentalyc's Progress
Tracker, Blueprint's before/during/after, Klarify's mind maps) — i.e. **they are all reaching for the
territory Aira wants to own, but each does it in the cloud and per-client, none at true cross-caseload
level for the solo counselor** (consistent with the prior study).

**Objection handling.** The recurring fears the category has taught buyers to have: (1) *is my audio/
data stored?* (2) *do you train on it?* (3) *is it accurate / will it hallucinate?* (answered with
"draft before final" + "trained on therapy notes") (4) *client consent / can the client read this?*
(5) *will my employer/institution see it?* (Mentalyc) (6) *what about a records request / audit?*
(Mentalyc) (7) *what if I lose the device?* (Bryl). Aira's pages must answer the same list — several of
them Aira answers *better*, and one (device loss) Aira must answer *carefully*.

**Pricing presentation.** Three models observed: **per-note-cap tiers** (Supanote, Mentalyc, Klarify),
**per-session usage with a monthly cap** (Upheal $1→$69, Blueprint $0.49–$0.99), and **single flat
price** (Bryl $29). Common furniture: a **free tier or 14–30-day trial, "no credit card," annual
discount, money-back guarantee,** and — Upheal's standout — a **transparent competitor comparison
table.** All are public. *(Inferred: usage pricing signals "fair / aligned with your work"; flat price
signals "no games"; both are trust plays as much as revenue mechanics.)*

**Proof.** The category's expected proof, in order of prevalence: **big user counts** ("10,000+",
"30,000+", "70,000+"), **named testimonials carrying professional credentials** (PhD/LCSW/LMFT/PsyD —
the letters do the trust work), **compliance badges,** **third-party review scores** (Upheal's
Trustpilot), and **organization counts** ("thousands of organizations," "800+ organizations"). *(Inferred:
credentialed peer testimonials are the single most repeated proof element — buyers in this category
trust other licensed clinicians more than vendor claims.)*

---

# PART 2 — RECOMMENDATIONS FOR AIRA'S OWN PAGES

*Concrete and usable. Every proposed claim is checked against `aira-stack-s1/report.md` so it is
architecturally honest for V1. Borrowed items are patterns/mechanics, never competitor wording. Legal/
compliance phrasing is flagged for counsel, never asserted.*

## 2.1 The strategic frame (read this before the copy)

Two facts from the prior study must govern the pages, or we will mis-weight them:

1. **Privacy is the gate, not the purchase.** Buyers *say* privacy first (APA 2025: #1 stated concern)
   but *buy* on time-saved and note quality; there is no evidence anyone pays a *premium* for privacy.
   **So Aira's pages must not be privacy-only.** Lead with the felt benefit and the one thing no one
   else has (the local caseload cockpit), and let architectural privacy be the *trust differentiator
   that we pass effortlessly and can prove* — not the whole pitch.
2. **The economic buyer at MBZUAI is the institution, not the counselor.** The counselor is the
   champion; university IT/procurement/legal decide. So the site needs **two doors**: a warm
   clinician-facing story *and* a cool, linkable **institutional security/compliance one-pager** that a
   security reviewer can forward. Bryl's whole site is solo-clinician; Mentalyc's security FAQ is the
   institutional model — Aira needs both.

**Aira's honest, defensible page thesis:** *Your counseling record lives only on your device — provably,
not just by promise — and it still gives you a view of your whole caseload no cloud tool gives a solo
counselor.* Privacy = the proof-backed trust gate; caseload insight = the reason to buy.

## 2.2 Proposed positioning lines (with honesty checks)

Lead options for the H1 (pick/A-B test; all are architecturally true for V1):

- **A (property-led, à la Bryl):** *"The counseling record that never leaves your device."*
  Subhead: *"Aira writes your notes and shows you your whole caseload — entirely in your browser, on
  your machine. No server. No upload. You can check for yourself."*
- **B (benefit-led + the unique value):** *"See your whole caseload. Keep every record on your own
  device."* Subhead: *"Private-by-architecture counseling notes and longitudinal insight — no cloud, no
  app store, no one else's server."*
- **C (buyer's-outcome-led):** *"Notes done. Caseload clear. Nothing ever left your laptop."*

**Nouns.** Use **"counselor"** (matches the MBZUAI role) and **"caseload"/"students"** — the prior
study's own framing is "80 students." Prefer **"client"** or **"student"** over **"patient"**:
counseling convention and every competitor use "client," and a university wellbeing service uses
"student." *(Flag: internal Aira materials sometimes say "patient"; recommend standardising the outward
noun to counselor + student/client.)* Keep the artefact = "note / record."

**Honesty checks applied (do NOT write):**
- ✗ "AI writes notes that sound like you" / "fluent AI narration" — V1 has **no AI-narrated notes**
  (stack report §1, §3). Frame notes as *"a structured draft you edit and sign,"* precision over prose.
- ✗ Any Arabic promise — **V1 is English-only** (charter; stack report §A1). Arabic is roadmap, not a
  page claim.
- ✗ "No install / any browser" as an absolute — V1 realistically ships as an **installable PWA** (stack
  report §3, Decision-2). Say *"runs in your browser, add it to your home screen — no app store, no IT
  rollout,"* not "no install."

## 2.3 The privacy story — how to present a genuinely stronger claim

The competitors gave us the vocabulary of the *weaker* claim; our job is to occupy the *stronger* one
without borrowing their words. Three moves, in order:

1. **Name the category difference, don't out-adjective them.** Do not say "more secure," "bank-grade,"
   or "certifiably protected" (that competes on their turf and invites "prove your certification").
   Say the architectural fact plainly: *"Aira has no server. Your records are created, encrypted, and
   stored on your device. There is nothing on our side to leak, subpoena, or train on — because we
   never receive it."* This is the Bryl/"nothing to subpoena" frame, done in a browser, and it is true
   for us (stack report §4).
2. **Borrow the verifiability mechanic (this is the highest-value borrow).** Bryl's "prove it in
   Airplane Mode" converts trust into a test. Aira's browser-native equivalents, all honest:
   *"Open your browser's network panel and watch — Aira makes no calls with your data,"* and/or *"Turn
   off your Wi-Fi. Aira keeps working."* Offer it as an explicit invitation on the page. No competitor
   in a browser can copy this, and it reframes privacy from *claim* to *demonstration*. *(Confirm with
   engineering that a genuine offline/no-network demo path exists before publishing the invitation —
   stack report notes a one-time model download as the caveat; the *record/analysis* path after that is
   offline-true.)*
3. **Reframe "no BAA needed" as relief, not a gap.** Every cloud competitor sells the BAA as a feature.
   Aira should follow Bryl's reframe: *"There's no Business Associate Agreement to sign, because there's
   no third party holding your data."* **Flag for counsel:** whether "no BAA needed" is the right
   framing under UAE/DoH rules is a legal question — present it as *what the architecture means*, not as
   a compliance verdict, and let counsel confirm the wording for the launch market.

**Deliberately avoid the competitors' one weak tell:** all five cloud players must hedge with "we can't
access it / we don't train on it." If Aira ever writes "we don't look at your data," we've thrown away
the advantage — the correct sentence is "**we can't**, and here's how you check."

## 2.4 Suggested page structure (section by section)

A single-scroll clinician page, plus a separate institutional one-pager. Ordering reflects §2.1 (benefit
+ unique value first; privacy as the provable trust gate; objections; proof; price):

1. **Hero** — H1 from §2.2 + subhead + primary CTA (*"Start on your device"*). One micro-trust line
   under the CTA (*"No account on our servers. No upload. Works offline."*). *(Borrowed pattern:
   compliance/trust micro-line under the CTA — Blueprint/Upheal.)*
2. **The felt problem** — a short, honest pain beat (evening charting; explaining to clients where their
   audio goes). *(Borrowed pattern: Bryl's empathy-first agitation — write our own, never theirs.)*
3. **What Aira does, in 3 steps ending in Sign** — *Record/enter the session → Review the structured
   draft → Sign; it's locked.* Set the honest expectation here: *a precise draft you control*, not a
   ghostwriter. *(Borrowed pattern: universal 3-step→Sign.)*
4. **The caseload cockpit (our headline differentiator)** — the thing no competitor gives a solo
   counselor: *"Across your whole caseload: who's academic-stress, who stopped engaging, who's trending
   worse — PHQ-9/GAD-7 trends, all computed on your device."* Lead with a real screen, not prose.
   *(This is the deterministic, low-risk, buildable core — stack report §A3, Slice 1.)*
5. **Privacy you can verify** — the §2.3 block: architecture stated plainly + the "check it yourself"
   invitation + the "no BAA" reframe. This is where we win the trust gate.
6. **"What if I lose my device?"** — answer it directly (see §2.5). Do not hide it; addressing it builds
   more trust than omitting it.
7. **Objections / FAQ** — the category's expected list (§2.5).
8. **Proof** — credentialed testimonials once available; until then, a **security/architecture-forward**
   proof section (see §2.6) rather than fake counts.
9. **Pricing** — see §2.7.
10. **Institutional footer door** — *"Reviewing Aira for your institution?"* → the security one-pager.

**Separate institutional one-pager** (linkable, forwardable): architecture diagram (no server, on-device
encryption), data-flow ("data never leaves the device"), encryption/key model, consent capture, breach
posture (device-loss), and an explicit *"what this means under UAE/DoH rules — confirm with your
counsel"* line. *(Borrowed pattern: Mentalyc's compliance-officer-grade page, minus the cloud content.)*

## 2.5 Objection handling to build in

Answer the category's taught fears — Aira answers most of them *better*:

| Buyer fear (category-taught) | Aira's honest answer |
|---|---|
| Is my audio/data stored somewhere? | It's on your device only; audio is deleted after the note is drafted. **Verifiable** (§2.3). Stronger than any cloud "deleted after processing." |
| Do you train AI on my sessions? | We can't — we never receive your data. (Not "we promise not to.") |
| Will it hallucinate / be wrong? | It's a **structured draft you review and sign** — precision, not prose; you're always the author. *(Honest: this is our extractive-notes reality, sold as a virtue — stack report §A1.)* |
| Client consent / can the client read this? | Build in **consent capture + a timestamped log** (cheap, on-device — prior study "cheap wins" #1) and note the record is written for the chart. |
| Will my institution/employer see my usage? | On-device means there's no vendor dashboard of your activity to expose. *(Contrast Mentalyc's "will my boss know" FAQ — Aira's architecture answers it structurally.)* |
| **What if I lose my laptop/device?** | **The one to handle carefully.** Follow Bryl's model: *encrypted at rest under your password; lost/stolen = unreadable; keep an encrypted, user-controlled backup so you can restore on a new device — and we can't read it either.* Pair with the recovery-key UX. *(Stack report §4.4–4.5: this is real and designable; be blunt that a forgotten password is unrecoverable by us.)* |
| Is it as good/fast as the cloud AI scribes? | Don't over-claim. Compete on *precision + the caseload view no one else has*, and be "good enough" on speed. *(Stack report §7: on-device notes are extractive, not fluent — reframe, don't pretend.)* |

## 2.6 Pricing presentation

- **Model:** the competitors mostly meter per-note or per-session for *solo* buyers. Aira's launch buyer
  is an **institution** (MBZUAI), so recommend **per-counselor / institutional pricing**, not
  per-session metering — and *do not race to the $16–$29 solo-utility floor* (prior study §G: the
  local-first niche is full of cheap utilities; anchor on trust + insight value sold into a budget).
- **Presentation patterns worth borrowing:** public, legible pricing; a clear trial; "no card to try";
  and — if we ever compare — Upheal's **transparent comparison table** mechanic (compare on *what's
  included and where data lives*, not on being cheapest). A **single, honest price** (Bryl's "no
  add-ons, no per-seat games") reads as a trust signal that reinforces our whole story — consider it for
  the solo tier.
- **Avoid:** per-note caps as the anchor (they frame Aira as a metered scribe and undercut the
  caseload-cockpit value); and "cheapest" positioning.

## 2.7 Proof — what to assemble (and what not to fake)

The category expects credentialed peer testimonials, user counts, compliance badges, and review scores.
As a pre-launch product Aira **cannot and must not fabricate counts or logos.** Instead:

- **Lead with architecture-as-proof** (the honest early-stage substitute): the verifiability demo
  (§2.3) *is* proof; a clear architecture diagram is proof; "runs offline, check it yourself" is proof.
- **Bank the MBZUAI relationship** into a credentialed champion quote/case study **only with explicit
  consent** — one licensed-counselor testimonial with credentials outweighs a fake "10,000+."
- **Compliance signalling:** state what's *architecturally* true (on-device, encrypted, no transfer) and
  route regulatory claims to the counsel-reviewed institutional one-pager. **Do not display HIPAA/UAE
  compliance badges as fact without counsel** — the launch market is the UAE, a different framework
  entirely (prior study §E; flag for counsel).

## 2.8 What to deliberately do DIFFERENTLY from all six

1. **Make privacy verifiable, not adjectival.** They say "secure/certified/we-don't-train"; we *show*
   ("check the network tab / go offline"). This is our one unforced advantage — use it.
2. **Lead the value on the caseload cockpit, not the note.** Every competitor leads on notes/time; the
   note is commoditising. Aira's *reason to buy* is the local whole-caseload view — put a real screen of
   it above the fold, second only to the privacy hook.
3. **Sell the constraint as the strategy.** No server, no BAA, no vendor dashboard, notes-you-sign — each
   is a limitation reframed as trust. Don't apologise for on-device; make it the point.
4. **Two doors, one site.** A warm clinician page *and* a cool forwardable institutional one-pager —
   because our economic buyer is a university, not a solo shopper. None of the six splits this cleanly.
5. **Under-promise the AI, over-deliver the trust.** Where they promise ghostwritten fluency, we promise
   a precise draft the clinician owns. It's honest, it suits a skeptical clinical buyer, and it's the
   only claim our architecture can keep.

---

## Appendix — sources & method

**Sites captured live 2026-08-08 via `chrome-devtools-axi` (headless Chrome for Testing 151):**
- Supanote — https://www.supanote.ai/ · https://www.supanote.ai/pricing
- Mentalyc — https://www.mentalyc.com/ · https://www.mentalyc.com/security · https://www.mentalyc.com/pricing
- Upheal — https://www.upheal.io/ · https://www.upheal.io/privacy-and-compliance · https://www.upheal.io/pricing
- Blueprint — https://www.blueprint.ai/ · https://www.blueprint.ai/privacy-security · https://www.blueprint.ai/pricing
- Klarify — https://www.klarify.ca/
- Bryl — https://bryl.app/

**Built on prior evidence (not re-verified here):** `data/aira-market-s2/report.md` (competitive map,
"does privacy sell," UAE/India, pricing) and `data/aira-stack-s1/report.md` (what V1 can/can't honestly
claim: installable PWA, extractive not AI-narrated notes, English-only, no server, device-loss and
encrypted-backup design).

**Hard rules honoured:** verified vs inferred labelled throughout; every competitor claim carries its
source URL; no legal/compliance conclusion asserted (regulatory wording flagged for counsel); competitor
copy captured only as internal evidence and **not** reproduced onto any Aira surface — recommendations
extract patterns/mechanics only; no recommended claim exceeds V1's architecture.

**Open item for the captain (not settleable here):** the MBZUAI health-vs-social-care-vs-internal
regulatory classification remains the pending question that determines how strongly the institutional
one-pager can lean on the UAE data-localisation advantage. It is with the captain separately; the page
copy above is written to hold up either way (architectural facts, not regulatory verdicts).
