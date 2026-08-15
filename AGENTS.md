# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

## What this is
Aira is an **Expo (React Native) + expo-router + TypeScript** app (SDK 57), web support enabled.
It realises the approved click-through prototype; Expo **replaces** the earlier SvelteKit plan.
See `README.md` for how to run, the theme/token architecture, the service seams, and the locked v1
constraints — don't duplicate it here.

## Sharp edges
- **Node ≥ 22.13 is required** (Expo SDK 57). The default `node` here may be older; a compatible
  build is at `~/.cache/fm-node/node-v22.23.2-darwin-arm64/bin`.
- Verify with `npx tsc --noEmit` and `npx expo export --platform web --platform ios --platform
  android`. `expo export` **overwrites `dist/`** per run — don't expect web HTML to survive a
  later native export.
- Design tokens come from `aira-ui-s3/design-direction.html` (light: verbatim; dark: revised
  turquoise in round 4 — see `README.md` "Theme / token architecture"); the prototype spec is
  `aira-ui-screens-s4/screens.html`. Treat those as source-of-truth for any UI change.

## Demo-mode live services (behind the seams)
The seams are wired to real cloud services for the demo, degrading to mocks when keys are absent:
- **Config**: `src/config/env.ts` reads `EXPO_PUBLIC_*` from `.env.local` (gitignored; `.env.example`
  is the committed template). `hasSupabase` / `hasGroq` pick live vs mock per service — the app never
  crashes without keys. `hasGroq = hasSupabase && EXPO_PUBLIC_GROQ_PROXY_URL set` (the proxy
  authenticates with the Supabase session). Secrets source:
  `firstmate/data/aira-secrets/{supabase,groq}.env`.
- **Accounts — Supabase** (`src/services/supabase.ts`, `SupabaseAuthService` in `auth.ts`): real
  signup/login (email confirmation OFF; identity fields → user metadata). The one-time recovery-code
  moment stays app-side (local vault key path). `getAccessToken()` (supabase.ts) yields the signed-in
  session JWT the Groq proxy verifies. **Only email/password `signIn` mints that token** — recovery-code
  unlock opens the vault but holds no Supabase credentials, and native reloads drop the session
  (`persistSession` is web-only), so those paths reach capture with no cloud. That is by design; the
  capture screen offers a "Sign in to enable cloud transcription" action (routing through
  `/unlock?next=<in-app route>`, validated by `safeNext`) plus the paste fallback. See `README.md`.
- **Groq is server-side** — the Groq API key is NO LONGER a client var. It lives as a Supabase secret
  behind the `groq-proxy` Edge Function (`supabase/functions/groq-proxy/index.ts`), which proxies both
  Groq calls (`/transcriptions` whisper-large-v3 multipart, `/chat/completions` llama-3.3-70b JSON).
  The function verifies the caller's Supabase user JWT (anon key / anonymous → 401), reads
  `GROQ_API_KEY` from its own env, **pins the models server-side** (a caller-supplied `model` is
  overwritten, never honoured), rate-limits per user (best-effort in-memory, documented), rejects
  payloads carrying a client identifier/name (400), and relays upstream errors faithfully (including
  `Retry-After` / `x-ratelimit-*`).
  `verify_jwt=false` in `supabase/config.toml` on purpose — we verify in-code so the anon key (a valid
  JWT) is rejected. The function is **Deno** (uses `Deno.*` globals), so `supabase/functions` is
  excluded from the app `tsconfig.json` — `npx tsc --noEmit` does not cover it; its promises are
  proved instead by `scripts/groq-proxy-harness.mjs`, which runs the real function over HTTP with
  stand-in GoTrue/Groq servers (no Deno or Docker). Deploy + the honest residency note (Supabase
  global edge; project ap-south-1; Azure in-region for prod) are in `README.md` → "Groq proxy (Edge
  Function)". Never reintroduce `EXPO_PUBLIC_GROQ_API_KEY`.
- **Transcription — Groq whisper-large-v3** (`GroqTranscriptionService` in `transcription.ts`) and
  **summarization — Groq llama-3.3-70b** (`src/services/summarization.ts` → a `DraftNote`), both via
  the proxy above with the session token. Web audio via `src/services/audioCapture.ts` (MediaRecorder
  + file-picker fallback; native falls back to the mock). The `mock://` sample-audio path always uses
  the mock transcriber. No proxy configured → the on-device mock for both.
- **The fabrication line — canned content belongs to the `mock://` sample and to nothing else, on
  EVERY build.** Fabrication is the app INVENTING clinical text; drafting the clinician's own
  typed/pasted words on-device invents nothing. So the gate is *whose session it is*, never how the
  build is configured:
  - `MockTranscriptionService.transcribe` replays `MOCK_TRANSCRIPT_TEXT` only for a `mock://` uri and
    otherwise throws `TranscriptionUnavailableError` (`transcription.ts`). An unconfigured build has
    no automatic transcription for a real recording — it must not answer one with the sample's words
    ("Denies passive ideation on screening today" is a safety finding nobody made).
  - `MockSummarizationService` emits the full walkthrough note (canned assessment, plan bullets, the
    `F41.1` chip) only when `input.sampleCapture === true`; every other session gets derive-only
    output (subjective/objective from the clinician's words + the risk scan, everything else left at
    `NOT_CAPTURED`). The flag defaults to absent = safe mode.
  - With the proxy configured but NOT signed in, **transcription throws** `CloudSessionRequiredError`
    (`cloudSession.ts`) while **drafting falls back** to the stub over the same text, stamped
    `draftedInCloud: false`. Never make transcription fall back, never make drafting throw — that is
    what keeps the paste-the-transcript recovery a real route to a note instead of a dead end.
  Proved by `scripts/provenance-harness.mjs`; the two error kinds are distinct because signing in
  fixes one and cannot fix the other, so only `CloudSessionRequiredError` shows the sign-in action.
- **Provenance is observed, never configured — and it is THREE facts, never one**:
  `audioLeftDevice` (the upload was ISSUED; set on the cloud transcriber's `transcribing` stage, which
  fires immediately before the POST, because a 429/5xx arrives after the audio has already left),
  `transcriptFromCloud` (the stored text IS whisper's output — only on a successful transcription, so
  text typed after a failed upload is never presented as machine-transcribed), and `draftedInCloud`
  (stamped by `buildDraft` from the summarizer that actually ran). Collapsing the first two back into
  one boolean is how a note came to claim whisper produced the clinician's own typing. A 200 carrying
  `{text: ""}` is not a transcript either, so `transcriptFromCloud` needs non-empty text. None derive
  from `hasGroq`, so a note can never claim — or deny — a hop that did not match reality. `buildDraft`
  owns all three; the `sourceLine` expression they feed is proved by `scripts/provenance-harness.mjs`,
  which exists because it was re-derived wrongly in three successive fix rounds.
- **Cloud reachability is a runtime question**: `cloudSessionReady()` (`cloudSession.ts`) = proxy
  configured AND a live token. The capture screen asks it before the mic opens and says plainly when
  the cloud is unreachable; it never gates recording. Signing in cannot rescue a capture already
  recorded, and the copy says so.
- **Blank boot + device-local data**: a fresh install starts EMPTY. Caseload state is a reactive
  context (`src/data/DataProvider.tsx`, hooks `useClients`/`useClient`/`useDayDashboard`/etc.) persisted
  through `ClientRepository` → `VaultStorage` (`LocalVaultStorage` → `deviceStore`: localStorage on web,
  a JSON file on native). The Amara fixtures are the on-demand sample (Settings → "Load sample data").
  Screens read via the hooks (never `data/fixtures` directly) and render zero-states when empty. The
  read hooks tolerate being called outside the provider (shared `TopBar` on pre-auth chrome).
- **Demo banner**: `src/components/DemoBanner.tsx` (in `(app)/_layout`) states plainly that
  transcription/summarization use the cloud, so the on-device trust copy doesn't overclaim.

## Server infra (`infra/`)
OpenTofu module for the v1 server on Azure (UAE North) — dummy-application phase, nothing applied
yet. Runbook, decisions applied, cost table, and open items are all in `infra/README.md`; don't
duplicate them here. Sharp edges specific to working on it: Homebrew is broken on the dev machine
(`/opt/homebrew` ownership), so `az` was installed via `pip3 install --user azure-cli` and `tofu`
via the standalone-binary method — see `infra/README.md` "Prerequisites". CI is GitHub Actions only
(`.github/workflows/infra.yml`) — no Azure DevOps.

## Structural rules to preserve (locked design decisions)
- **Name vs. slug**: the user-visible product name is **Airava** (`app.json` `name`, the TopBar
  wordmark, onboarding/login lockups, the web `<title>`, and `public/manifest.json`). The shorthand
  **aira** stays for everything non-user-facing — repo, npm package, the `aira` `slug`/`scheme`, the
  `aira.vault.` storage namespace in `deviceStore.ts`, code identifiers, and paths — so persisted data
  and deep links keep working; do not rename those. Web `<title>` and PWA manifest are NOT emitted by
  Expo static export, so they're declared explicitly: the title via a root `Head` in `_layout.tsx`
  (the static HTML title stays empty and hydrates at runtime), the manifest as `public/manifest.json`
  linked from `src/app/+html.tsx`.
- **Wordmark font**: the wordmark — and ONLY the wordmark — renders in the `brandFont` token
  (`src/theme/tokens.ts`, exposed as `theme.brandFont`) = Atkinson Hyperlegible Mono Medium, a local
  asset in `assets/fonts/` (with its Braille Institute license) loaded via `useFonts` in
  `_layout.tsx`. Lexend remains the interface font everywhere else (body/headings/labels/data) — the
  s3 WCAG pairings assume it; never put the mono face into UI text.
- Mascot only on human surfaces (welcome onboarding, unlock/login, wordmark) — never on
  charts/tables/risk queue or the in-session capture screen. The final art is the captain's
  background-removed mood set in `assets/mascot/<mood>.png`, driven by
  `src/components/mascotMoods.tsx` (`MOOD_ART` registry, `MascotMood`, and the per-workflow
  `appBarMood` map); heroes are wired per screen. The app icon derives from `Mascot Designz/logo2.png`
  via `app.json`. (The earlier hand-drawn inline-SVG mascot has been retired.)
- Risk is clay, never alarm-red; colour is never the only signal (always paired with a word).
- Escalate is a standing, dismissible sheet — never modal, never alarm. No safety control may be a
  dead promise: the crisis line, warm handoff and safety plan each do a real thing or say plainly why
  they can't (contacts come from `EXPO_PUBLIC_CRISIS_LINE` / `EXPO_PUBLIC_ONCALL_EMAIL`; an unset
  crisis line falls back to local emergency services and never invents a mental-health number).
- A note's risk reaches the caseload as a structured tier: the summarizer emits `riskLevel` and it is
  trusted for the ordinary case — never re-derived *down* by sniffing note prose. But `riskFromNote`
  applies an **up-only safety floor**: if the note's own structured risk **rows** disclose ideation (or
  self-harm) it never lets the model's tier fall below acute (or elevated), so the "any disclosed
  ideation → acute, never auto-downgrade" rule holds on the live path exactly as in the mock. The
  floor only ever raises. The floor is **row-based** — the free-text risk *summary* does not drive the
  tier: judging a whole sentence repeatedly produced false acutes (a disclosure marker from one clause
  overriding a denial in another), and nothing can lower a tier once set. Within a row the test is
  `deniesRisk`-only — a row discloses when it is present, neither not-assessed nor denied — with **no**
  positive-marker override, for the same reason: a marker substring can't be scoped to its clause
  ("Denied; protective factors noted" read as a disclosure). The one exception is **ideation NAMED
  positively** (`affirmsIdeation`): a severity qualifier or report verb bound to the word
  "ideation"/"SI", or ideation carrying a plan — it floors to acute even alongside a denial of a
  narrower form ("denies active ideation, plan or intent") or of an unrelated worry ("Active suicidal
  ideation with a plan; no other concerns"). Being anchored ON the ideation word rather than a loose
  substring, it cannot be hijacked across clauses, and negated mentions are scrubbed first so "No
  suicidal ideation reported" stays clear — though that scrub stops at a plan/intent/means noun or a
  contrast conjunction, since those end the negation's scope ("No plan but active ideation" affirms).
  A negation denies the row when what it reaches is the topic
  — freely, across plan/intent nouns and commas, so word order cannot decide the tier ("Denies any
  plan, intent, or suicidal ideation" is a full denial) — or its *state*, where the gap must not cross
  a plan/intent/means noun, so "Present; no current plan or intent" stays a disclosure. A row
  **discloses unless a denial is recognised**, so the ordinary benign answers are recognised too
  ("Client reports none", "None elicited", a bare "Not disclosed" — but not "not disclosed to family",
  which says who else knows).
  The floor is a **heuristic backstop** over the model's own structured tier, not a parser: a deeply
  compound value where a denial and a disclosure interleave may mis-tier at the margin, which is
  acceptable because it only ever raises and the clinician reads and signs every note. It likewise
  errs toward acute for any UNRECOGNISED phrasing — a positive-clearance wording naming no risk and
  carrying no denial token ("Screened, clear", "Low risk") over-rates, the deliberate cost of reading
  a bare "Present" as a disclosure. Accepted
  residuals: a value that
  endorses ideation *and* carries an unrelated bare denial ("Endorsed; denied to spouse") or a
  trailing screening-status clause ("…; safety plan deferred") can under-rate; a trailing
  concern-denial reads as a row denial ("Present; nothing further of concern"), since it is
  indistinguishable from the benign "Screened; no acute concerns" without the positive-marker test
  that caused the false acutes; and a negation separated from its phrase by punctuation ("denies, on
  direct questioning, any passive ideation") over-rates. All rare, and far cheaper than a permanent false acute. `client.risk` is likewise a
  capture-time signal: it is NOT re-derived from later manual edits to a note's risk narrative (see
  `updateNoteSection`). See `scanNoteRisk` / `riskFromNote` / `appendSessionToClient` in
  `src/data/sessionClient.ts`, proved by `scripts/risk-floor-harness.mjs`.
- **Duplicate identity never silently destroys or duplicates a record** (proved by
  `scripts/duplicate-identity-harness.mjs`):
  - **Account**: `SupabaseAuthService.createAccount` asks Supabase FIRST and STOPS on "already
    registered" by throwing `AccountExistsError` — it mints no recovery code, leaves the persisted
    recovery hash + local vault untouched, and sets no status, so a returning counselor who taps
    "Create account" never has their saved recovery code overwritten. The create screen routes that
    error to `/unlock?notice=account-exists&email=…` (calm notice + prefill); a generic signUp error
    still throws a plain `Error` (retry the form). Never reinstate the swallow-and-continue.
    The rule holds on **every** build: `MockAuthService.createAccount` (the keyless path) has no server
    to ask, so it reads the device's own evidence — a persisted `RECOVERY_HASH_KEY` means an account
    exists here — and throws the same `AccountExistsError` before writing anything. On that path the
    credential a second create destroyed is the **password** hash, not the recovery one (the mock's code
    is the `RECOVERY_WORDS` constant and `fnv1a` is unsalted, so the rewritten recovery hash was
    identical; `PASSWORD_HASH_KEY` took the second attempt's password and the real password stopped
    opening `signIn`) — same silent lockout, other credential. The guard is device-scoped, not
    email-scoped: one account per device is the keyless model, and there is no email registry to consult.
  - **Patient**: a **well-formed** Emirates ID is the **local** caseload uniqueness key
    (`Client.emiratesId`, stored verbatim; compared via `normalizeEmiratesId`). The governing rule: a
    strong identifier, present and well-formed, ALWAYS decides a MATCH; a weak one (a name, or a
    malformed entry) NEVER merges two patients; and two strong signals that DISAGREE are a warning, not
    a match — the app mints a separate record and surfaces a caution rather than merging.
    - **Well-formed** = `isValidEmiratesId` — normalises to `^784[0-9]{12}$`. Anything else ("N/A",
      "unknown", a truncated "784-1988") is a placeholder the counselor reached for without the number,
      NOT an identity: `emiratesIdKey` yields `''`, so it never keys a match, and `clientFromSession`
      stores `undefined`. Two unrelated patients typing the same placeholder must never collapse into
      one record under a confident "you already see this client". The capture screen says so inline.
    - `matchExistingClient` (`sessionClient.ts`) resolves by id → valid Emirates ID → captured-name, on
      the rule **merge when nothing disagrees; never merge on ambiguity or on disagreement**. A capture
      carrying a valid id resolves in two steps:
      - **Step A — some record HOLDS that id.** Names agreeing (or none typed) is the duplicate-patient
        fold (`saveSessionNote` returns `isDuplicate` → "You already see this client" on review). A
        materially different REAL name does NOT fold: a clipboard carried over from another patient's
        form or a transposed digit landing on a real id is likelier than a match, and folding is the
        unrecoverable merge from the opposite direction. Only two REAL names can disagree — the app's own
        `UNNAMED_CLIENT_NAME` placeholder (and a blank) never vetoes an id fold, and such a record has its
        name upgraded when a session finally supplies a real one. The record that fork mints carries
        **no** Emirates ID: the id was just ruled to be someone else's, and a second holder of the key
        would let the next blank-name capture fold into the wrong one. One key, one holder.
      - **Step B — NO record holds that id**, so the id contradicts nothing. Absence of an id is NEW
        INFORMATION, not disagreement: exactly one same-named captured record holding no id of its own is
        the same patient having their id recorded for the first time, so it FOLDS and the id is **adopted**
        onto that record (`adoptEmiratesId` → `appendSessionToClient`, stored verbatim). This is the
        ordinary rollout case — no record captured before the field existed carries an id. More than one
        namesake (**ambiguity**) or a lone namesake holding a different valid id (**disagreement**) forks
        instead, carrying the unclaimed id, and never writes onto the existing record.
      The name fold survives unchanged for captures with no valid id (the pre-existing F3 continuation).
    - Every veto mints a SEPARATE record. That is the SAFE direction by the asymmetry of harm: a fork
      leaves two truthful records that a future repair surface can reconcile, while merging two patients
      destroys whose note, plan, timeline and risk tier is whose and nothing can undo it. None of the
      vetoes is silent. `findNameConflict` and
      `findIdNameMismatch` are the exact complements of the branches that declined (so the app cannot
      refuse to fold for a reason it fails to explain), `saveSessionNote` returns `nameConflict` /
      `idNameConflict`, and review carries the matching caution — the id-under-another-name warning wins
      when both could apply. `appendSessionToClient` writes an Emirates ID **only** for a resolved
      adoption, never as a blanket backfill from whatever the capture carried and never over a stored
      one — that backfill is how one patient's id got stamped onto another's.
    - The whole match/fold/mint decision is `applySessionNote` (`src/data/saveSession.ts`), a pure
      snapshot→snapshot function; `DataProvider.saveSessionNote` only supplies the clock/new id and
      persists. It lives outside React so `scripts/duplicate-identity-harness.mjs` drives the real save
      path — a rule is only as good as the wiring that calls it, and a dropped call there was a real bug.
    - KNOWN FOLLOW-UP: a forked record has no in-app repair/merge surface — `Client.emiratesId` is written
      only at mint time (`clientFromSession`) and on a resolved Step-B adoption (`appendSessionToClient`),
      and no screen renders or edits it.
    Scope is device-local ONLY — never a cross-device/therapist
    existence check (captain, 2026-08-15): a global check would leak that a named person is in therapy.
- Snapshot writes are **serialized** (`createWriteQueue` in `src/services/writeQueue.ts`, applied at
  `ClientRepository.save`): signing persists twice in one tick (pending section edit, then the
  sign-off) and on native each save is an independent file write, so without an ordered queue the
  stale snapshot can land last and drop the signature. Proved by `scripts/persist-race-harness.mjs`.
  Read-only-after-sign is enforced at the seam too — `updateNoteSection` refuses a signed note.
- Sparse series (≤ 2 readings) render as a dot-strip with no trend line.
- Login + recovery copy is isolated in `src/strings/recovery.ts`; the recovery-key policy is
  captain-resolved (`decision-recovery-key-policy`): account creation + one-time recovery code,
  shown once. The account/session lifecycle lives in the `AuthService` seam (`src/services/auth.ts`,
  mocked); the server-side key-escrow support path is policy-only and never surfaced in UI.
- Patient data never leaves the device: persist through `ClientRepository` / `VaultStorage`; ASR
  through `TranscriptionService` (one-shot, model downloaded on first run, whisper.rn needs a dev
  build — not Expo Go).

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
