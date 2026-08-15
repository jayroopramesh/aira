# Airava — rendered workflow captures

> **Every capture in this folder predates the Airava brand rename.** The README hero strip,
> `mobile/*`, and the `r4r5-`/`r2r3-` sets all still show the old **"Aira"** wordmark set in Lexend;
> the shipped app now shows **"Airava"** in Atkinson Hyperlegible Mono. Judge layout and colour from
> them as usual, but not the brand mark. A full refresh is queued as a separate task.
>
> They also predate two later changes. The **encryption/server copy sweep**: the shipped app no longer
> says "encrypted on this device" or "keys never leave this device" anywhere — read the live copy from
> `src/strings/recovery.ts`, not from these images. And the **date-proportional chart x-axis**, so
> `06-patterns` still spaces its readings at equal intervals.

Real renders of the running **web** app (headless Chrome, 2× scale). The `mobile/` folder is the
**current** set (phone-dimension signature screens, light + dark); the `r4r5-` prefix below it is the
prior desktop-width rounds 4 + 5 set (captain-approved, final mascot system), and the `r2r3-` set is
the superseded round-2/3 refresh, kept as history.

Regenerate after UI changes: `npx expo export --platform web && npx expo serve`, then drive the
flows by **client-side navigation** — never load dynamic `[clientId]` routes directly against the
static server. Dark shots emulate `prefers-color-scheme: dark`, which the theme follows.

## Current signature set: mobile (`mobile/`)

Phone-dimension captures of the signature screens, **light + dark**, with the Amara sample cohort
loaded — the set the README strip uses. Rendered at a **390×844 iPhone-class viewport, @2×**
(`deviceScaleFactor: 2`, so files are 780px wide), on the static web export driven through the real
sign-in → load-sample → client-side navigation flow (the authed `(app)` routes are never hit
directly — the in-memory vault would re-lock). The build is the on-device **mock** path (no
`.env.local`), so nothing leaves the machine and login accepts the demo password.

- `01-onboarding` · welcome intro: mascot hero, personal-scribe copy, endowed progress bar
- `02-login` · unlock: vault-locked copy + both trust notes (pre-sweep wording — the shipped line is now
  "Stored on this device · unlocked with your login"; the HIPAA-aligned note likewise no longer says "encrypted")
- `03-day-dashboard` · Get ready: countdown, today's session cards, day-at-a-glance, standing safety
- `04-client-drawer` · client details: latest scores, patient-details + SALAMA/EHR card, history timeline
- `05-caseload` · caseload: per-row Outreach quick-actions (two pre-greyed), sparklines, sober risk chips
- `06-patterns` · Amara's longitudinal PHQ-9 chart, multi-scale tabs, sparse ≤2-reading dot-strip, journal box
- `07-soap-note` · session note with the **SOAP/DAP** format switcher, risk section, prescriptions, sign-off
- `08-recording` · in-session capture: live timer + waveform, timestamp-synced comment-card strip

## Prior set: rounds 4 + 5 (`r4r5-`)

Both themes where the design shifted; detail states are light-only.

### Welcome + Unlock
- `r4r5-welcome` · onboarding intro: personal-scribe copy, encouraging hero, endowed progress bar (20%)
- `r4r5-how` · onboarding step 2: shared seafoam step boxes, progress 45%
- `r4r5-create` · create account, progress 72%
- `r4r5-recovery` · one-time recovery code: supportive hero, progress 100%
- `r4r5-login` · login: encouraging hero + HIPAA-aligned trust note
- `r4r5-wrong` · calm wrong-password state: empathetic hero

### Get ready
- `r4r5-today` · day dashboard (encouraging app-bar mood)
- `r4r5-drawer-top` / `r4r5-drawer-details` / `r4r5-drawer-ehr-connected` · client drawer: patient-details card + mock SALAMA/EHR connection card (disconnected → connected, persistent mock disclaimer)

### Session summary
- `r4r5-session-precapture` · pre-capture with read-only reminders
- `r4r5-recording-comments` · recording: dotted add-first comment-card strip + HIPAA-aligned trust note
- `r4r5-review-soap` / `r4r5-review-dap` · note-format switcher: SOAP layout vs the derived DAP re-lay (D — Data merges S + O)

### Patterns
- `r4r5-caseload` · caseload table: Outreach mailto column (two pre-greyed), dashed first-reading sparkline baselines
- `r4r5-patterns-phq` / `r4r5-patterns-gad` · multi-scale tabs with dashed "Caseload avg" comparison + legend
- `r4r5-patterns-mhi` · MHI-5 tab: sparse ≤2-reading dot-strip (rule kept per scale)

## Superseded: rounds 2 + 3 (`r2r3-`)

Historical captures predating rounds 4/5 (old timestamped notebox, single-scale charts, hand-drawn
mascot). Kept for reference; do not use them to judge current UI.

### Welcome (new — boots here when signed out)
- `r2r3-welcome-1-intro` · onboarding: what Aira is (full mascot, benefit chips)
- `r2r3-welcome-2-how` · onboarding: the loop in three beats + privacy close
- `r2r3-welcome-3-create` · create account (Emirates ID + "why?", phone, name, email, password ×2, consent)
- `r2r3-welcome-4-recovery` · one-time recovery code (revealed; copy/save; stern warning; "I've saved it" gate)

### Unlock (username + password)
- `r2r3-unlock-1-login` · login (username + password, "Encrypted with your login")
- `r2r3-unlock-2-wrong` · calm wrong-password state + inline recovery-code fallback

### Get ready
- `r2r3-today-1-dashboard` · day dashboard (countdown, session cards, day-at-a-glance, standing safety)
- `r2r3-today-drawer` · client drawer — read-only "highlights to keep in mind" (no checkboxes)
- `r2r3-today-prep` · prep reminder — read-only highlights (no checklist / counter / mark-all)
- `r2r3-today-2-ready` · "you're ready" state

### Session summary
- `r2r3-session-1-precapture` · pre-capture with read-only reminders
- `r2r3-session-2-recording` · recording: current-word live readout + timestamped notebox + authoritative line
- `r2r3-session-3-analysing` · analysing: skeletons + faint-green **editable transcript** → next
- `r2r3-session-4-note-soap` · SOAP note (S · O · Risk & Safety · A · P) + **Prescriptions** rail (generated + added)
- `r2r3-session-5-signed-audio` · signed + audio-trust moment (delete-by-default, keep toggle)

### Patterns
- `r2r3-patterns-1-caseload` · caseload table (search, chips, sparklines, sober risk column)
- `r2r3-patterns-2-client` · client patterns; naturalistic box labelled **companion app**
- `r2r3-patterns-3-history` · session-history timeline (journal entries → "Companion app")
- `r2r3-patterns-4-risk` · acute-risk review (clay, calm, the word "review")
- `r2r3-patterns-5-escalate` · standing Escalate sheet (never alarm-red, never modal)

### Phone-width proofs (414px, light)
- `r2r3-phone-welcome-create`, `r2r3-phone-welcome-recovery`, `r2r3-phone-unlock-login`
- `r2r3-phone-today`, `r2r3-phone-session-review`, `r2r3-phone-patterns`
