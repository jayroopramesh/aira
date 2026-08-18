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
- **A first `expo export --platform web` in a fresh worktree/checkout can silently bake in EMPTY
  `EXPO_PUBLIC_*` values even with a correct `.env.local` present** — Metro's bundler cache (shared
  outside the worktree, e.g. from another task's cacheless run) can serve a stale transform for
  `src/config/env.ts` that predates the env file. Symptom: `hasSupabase`/`hasGroq` are false in the
  deployed bundle (grep the exported `dist/_expo/static/js/web/*.js` for your project ref/secret
  substrings — zero hits means they didn't get inlined) even though the CLI printed `env: load
  .env.local`. Fix: `npx expo export --platform web --clear` (or `rm -rf dist` first) once per fresh
  checkout/worktree before trusting an export that depends on newly-written env vars; always grep the
  built bundle for an expected env-derived string as a sanity check before deploying, not just the
  CLI's "env: load" log line.
- **CI** (`.github/workflows/ci.yml`, PRs + push to `main`, Node pinned via `actions/setup-node`,
  no secrets): `tsc --noEmit`, `npm test` (the `scripts/*-harness.mjs` suites — provenance,
  persist-race, risk-floor, escalate-targets, duplicate-identity, chart-axis, chart-range, groq-proxy —
  followed by `jest --ci`, all chained in the `test` script in `package.json`; that IS the
  project's test suite. The harnesses are the default lane for pure modules; jest
  (`jest.config.js`, preset `jest-expo/ios`, matching `src/**/*.test.tsx?`) exists for tests that
  must RENDER a component to prove its wiring), then `expo export --platform web`, then two
  dist-inspecting steps: every exported page is noindex, and interface font assets ship outside
  any `node_modules` path (see the web-fonts sharp edge below).
  Lint is deliberately not wired in: `expo lint` auto-installs `eslint-config-expo` and currently
  flags real `react-hooks/refs` errors (refs read during render) that would require behaviour
  changes to fix — re-evaluate next time those files are touched.
- **Web fonts must be `require()`d from `assets/fonts/`, never from an npm package.** Metro's static
  web export names an asset's `dist/` path after its source module's path relative to the project
  root, so a `require()` reaching into `node_modules/<pkg>/...` (as `@expo-google-fonts/lexend`'s
  named exports do) lands the exported font under `dist/assets/node_modules/...`. Cloudflare Pages'
  deploy uploader silently drops any `dist/assets/**` file whose path contains a `node_modules`
  segment — the request still 200s (it serves the SPA-fallback `index.html` with `content-type:
  text/html` instead of 404ing), so `document.fonts` reports the face `error` and interface text
  silently renders in the system fallback. This shipped once for the whole Lexend ramp; the fix was
  vendoring the four weights as local `.ttf` files in `assets/fonts/` (OFL-1.1, `Lexend-LICENSE.txt`
  alongside them — same pattern the wordmark face already used) and `require()`-ing those directly in
  `_layout.tsx`'s `useFonts` call instead of importing `@expo-google-fonts/lexend`. The CI step
  "Interface fonts ship, and no font asset path crosses node_modules" (`ci.yml`, after the web
  export) guards both ends — the four weights present under `assets/fonts/`, and no font asset
  anywhere under `dist/assets/node_modules/**`. KNOWN FOLLOW-UP: `expo-router`'s own internal nav
  chrome images (back/close/search icons under `dist/assets/node_modules/expo-router/assets/**`)
  have the same latent problem but are out of scope — this app hides the stock header
  (`headerShown: false`) everywhere, so they are never requested on the golden path. Any local
  `expo export --platform web` + local static-server repro will NOT reproduce this class of bug —
  the files exist and serve fine locally; it only manifests once deployed to Cloudflare Pages, so
  diagnosing a "fonts not rendering on the deployed site" report needs the actual deployed URL (or
  an equivalent host that drops `node_modules`-pathed assets), not just `dist/` served locally.
  `RootLayout`'s font-load `error` branch renders instead of blocking (never reintroduce an infinite
  blank screen on font-load failure — that would also take the standing Escalate affordance down
  with it) but now also `console.error`s loudly so a failed load doesn't ship silently.
- A harness that runs a pure `src/` module directly under `node --experimental-strip-types` needs
  an **explicit `.ts` extension** on every runtime (non-type-only) relative import inside that
  module's own import chain — Node's stripped-types loader does not resolve extensionless
  specifiers, unlike Metro/tsc. `tsconfig.json` sets `allowImportingTsExtensions: true` for exactly
  this (see `src/config/escalateContacts.ts` importing `./env.ts`). Type-only imports (`import
  type`) are erased before resolution and never hit this.
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
  Groq calls (`/transcriptions` whisper-large-v3 multipart, `/chat/completions` openai/gpt-oss-120b JSON).
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
  **`CHAT_MODEL` has already gone stale once**: Groq retired `llama-3.3-70b-versatile` (404
  `model_not_found`) with transcription unaffected, since `whisper-large-v3` is a separate pin — the
  user-facing symptom was "drafting fails, transcription works". `GET
  https://api.groq.com/openai/v1/models` (Bearer the Groq key) is the source of truth for what's
  still live on the key; don't assume a model name from memory or docs is still valid. Before
  re-pinning to any candidate, hit the real API directly with the app's EXACT request shape from
  `summarization.ts` (`temperature: 0.2`, `response_format: {type: "json_object"}`, the real
  `SYSTEM_PROMPT`) — a trivial "ping" test passing is not sufficient evidence. **Reasoning models are
  a trap here**: some (e.g. `qwen/qwen3.6-27b`) emit their `<think>...</think>` trace inline in
  `message.content` rather than a separate `reasoning` field, which makes `response_format:
  json_object` 400 with `json_validate_failed` even combined with `reasoning_format: "hidden"`, and
  without `response_format` the reasoning alone can exceed the default `max_tokens` (2048), truncating
  before any real content — plus such models can carry a much lower per-model TPM cap on this key,
  making them unsafe for a single-call, no-retry drafting path even when the shape is coaxed into
  working. `openai/gpt-oss-120b` (current pin) puts its reasoning in a separate `message.reasoning`
  field and returns clean JSON with the app's exact shape unmodified.
- **Transcription — Groq whisper-large-v3** (`GroqTranscriptionService` in `transcription.ts`) and
  **summarization — Groq gpt-oss-120b** (`src/services/summarization.ts` → a `DraftNote`), both via
  the proxy above with the session token. Web audio via `src/services/audioCapture.ts` (MediaRecorder
  + file-picker fallback; native falls back to the mock). The `mock://` sample-audio path always uses
  the mock transcriber. No proxy configured → the on-device mock for both.
- **Speaker separation** (`src/services/speakerSeparation.ts`, round 2 2026-08-17): Whisper does not
  diarize, so this is a SEPARATE post-transcription pass over the SAME `/chat/completions` proxy route
  (openai/gpt-oss-120b, same identifier guard) — never a Whisper feature. Only the capture screen's
  "patient session" scribe mode runs it (`session/index.tsx`'s `Analysing`); "retrospective" assumes
  a single therapist voice and skips it entirely. Labels turns Therapist/Client/Speaker 2 and is always
  presented as machine-attributed, for review — never ground truth. No mock fallback on purpose: with
  no live cloud session it degrades to "unavailable" (same honesty rule as `GroqTranscriptionService`
  refusing rather than fabricating a transcript), it does not fake a local diarization. "Remove Speaker
  2 + add as auxiliary notes" strips those turns from the transcript sent to the summarizer and stores
  them as `DraftNote.auxiliaryNotes`, rendered as its own card on the review screen's Transcript tab —
  never blended into the main transcript or sent to the summarizer.
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
  - **The sample may only analyse for a fully ANONYMOUS capture** (round 3, 2026-08-17): on the
    capture screen, a linked client OR a typed name OR a typed Emirates ID makes it a real person's
    session, so BOTH routes to the `mock://` clip — stopping with no live recorder, and "Use sample
    audio" — refuse (`hasRealIdentity` in `session/index.tsx`; the stop takes `failedCaptureRef()`
    into the type/paste recovery, the sample button explains inline). Before this gate, a named
    no-mic capture saved the canned transcript, the F41.1 walkthrough code and a fabricated
    "From a 47-min voice note" provenance into a real client record as an ordinary non-sample note
    that "Undo sample data" can never remove. Proved by
    `src/app/(app)/session/__tests__/index.test.tsx` (jest — it's component wiring).
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
  `{text: ""}` is not a transcript either, so `transcriptFromCloud` needs non-empty text. The machine
  claims carry a qualifier, `transcriptEdited` (round 5, 2026-08-18): the capture screen compares the
  drafted text against the transcriber's EXACT output (`machineTranscript` ref), and any divergence —
  one fixed mishear, the speaker-removal rewrite, or a wholesale replacement typed into the editable
  transcript box — makes the source line say "then edited by you" and the Transcript tab caption stop
  presenting the text as verbatim machine output. Without it, the editable box let 1,100 characters of
  hand-typed replacement ship as "transcribed and drafted off this device". Up-only across
  Continue-recording appends (an edited segment's divider says so; a later clean segment never clears
  the note-level qualifier), and ignored over hand-typed text, where there is no machine output to
  have edited. None derive
  from `hasGroq`, so a note can never claim — or deny — a hop that did not match reality. `buildDraft`
  owns all three; the `sourceLine` expression they feed is proved by `scripts/provenance-harness.mjs`,
  which exists because it was re-derived wrongly in three successive fix rounds. `buildDraft` also
  stamps the note's `transcript` (trimmed; blank = absent) from the input it drafted, so the review
  screen's Transcript tab is fed by every `summarize()` path instead of by one UI call site
  re-attaching it — never reintroduce that graft.
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

## Invite-only beta preview (airavacare.com)
- **`WipBanner`** (`src/components/WipBanner.tsx`) is a standing, non-dismissible strip mounted
  ONCE in the root layout (`src/app/_layout.tsx`, inside `RootStack`, above the `Stack`) — every
  route (welcome/unlock/(app) alike) nests under that one `Stack`, so this is the only mount point;
  never add per-screen copies. Caution tone (`c.caution`/`cautionBg`), exact copy "Preview — not a
  live medical service. Test with fictional client data only." The banner consumes the window's top
  safe-area inset itself, so the `Stack` below it is wrapped in a **nested `SafeAreaProvider`**
  (same file) that re-measures relative to its own frame — descendants then see a ~0 top inset and
  don't double-pad for a notch the banner already covered; don't remove it as redundant, and keep
  the Escalate sheet (mounted above `RootStack`) on the OUTER provider's full-window insets. Proved
  by `src/app/__tests__/RootLayout.test.tsx` (renders the real root layout and asserts the banner
  is mounted outside the navigator — a jest render, so a commented-out mount fails it) and
  `src/components/__tests__/WipBanner.test.tsx` (renders the exact copy).
- **noindex**: `src/app/+html.tsx` (the web-only root HTML wrapper) emits
  `<meta name="robots" content="noindex, nofollow">` in `<head>` — this is the one template every
  static-exported page shares, so one line covers all of them. CI (`.github/workflows/ci.yml`)
  greps every `dist/**/*.html` for that exact meta tag after `expo export --platform web`, failing
  the build if any exported page is missing it (that step also catches an accidentally-empty
  export). Note: expo-router's static export pre-renders each route's HTML shell before the client
  bundle hydrates fonts (`useFonts` gates `RootLayout`'s render), so app UI — the banner included —
  is not literally present in the static HTML source, only after client hydration; only header
  metadata (title, manifest links, this robots tag) is guaranteed present at the HTML-source level.

## Server infra (`infra/`)
OpenTofu module for the v1 server on Azure (UAE North) — dummy-application phase, nothing applied
yet. Runbook, decisions applied, cost table, and open items are all in `infra/README.md`; don't
duplicate them here. Sharp edges specific to working on it: Homebrew is broken on the dev machine
(`/opt/homebrew` ownership), so `az` was installed via `pip3 install --user azure-cli` and `tofu`
via the standalone-binary method — see `infra/README.md` "Prerequisites". CI is GitHub Actions only
(`.github/workflows/infra.yml`) — no Azure DevOps.

## Structural rules to preserve (locked design decisions)
- **A client's name/avatar is always a link to their patient page** (`/(app)/today/[clientId]`),
  wherever it's rendered as a discrete identity chip (list rows, detail headers) — never for a
  client's first name mentioned inline in prose ("Back to Amara's patterns"). `src/components/
  ClientLink.tsx` owns this: it wraps `Avatar` + caller-supplied name/subtitle content in a single
  `Pressable` (`accessibilityRole="link"`, label `Open <name>'s page`) routed to that patient page —
  every screen that renders a client identity chip reuses it rather than hand-rolling a Pressable, so
  the affordance can't drift. When a row's own primary tap already does something else (e.g. the
  caseload row opens patterns, not the patient page), `ClientLink` sits as a SIBLING Pressable next to
  the row's own action, never nested inside it (nesting breaks web `<button>`-in-`<button>` semantics
  — see the `patterns/index.tsx` `ClientRowWide`/`ClientRowNarrow` split for the pattern). On the
  **patterns caseload rows specifically** (round 2, 2026-08-17), this footprint is narrowed further:
  the row's own primary tap (avatar, status, session, sparkline, risk — everywhere except the name)
  opens that client's patterns view, and ONLY the underlined client name is the `ClientLink` to the
  patient page. `ClientLink` gained `showAvatar` (default `true`) for this — the patterns rows pass
  `showAvatar={false}` and render the avatar as its own sibling Pressable inside the "open patterns"
  region instead. Every other screen keeps the full avatar+name chip as the single patient-page link.
- **Longitudinal trajectory** (`src/data/trajectory.ts`, `deriveTrajectory`, round 2, 2026-08-17):
  recurring review codes, repeated plan/prescription items, and the risk-tier trend, derived purely
  on-device from a client's retained `DraftNote[]` (`reviewCodes`, `prescriptions`, `riskLevel` —
  never re-scored from prose, same trust rule as `riskFromNote`). Rendered as a `TrajectoryCard` on
  `patterns/[clientId].tsx`. Returns `null` below `MIN_SESSIONS_FOR_TRAJECTORY` (3) so the screen shows
  the honest "At least 3 sessions needed" empty state instead of a thin chart — the sample fixtures
  keep Daniel at exactly 2 real sessions on purpose as that demo case. Proved by
  `scripts/trajectory-harness.mjs`.
- **Sample-origin flagging + "Undo sample data"** (Settings, round 2, 2026-08-17): `Client.sampleOrigin`
  / `DraftNote.sampleOrigin` are stamped `true` ONLY by `buildSampleSnapshot` at load time — never
  guessed later by name/content. `computeSampleUndo` (`src/data/undoSample.ts`) removes a sample client
  and its notes only if untouched since loading; a sample client the counselor captured a real session
  against, or edited patient details for, is KEPT (its sample-authored notes stripped, any real note
  kept) rather than silently destroyed — the exact policy is documented at the top of that file. Wired
  as `DataProvider.undoSample` / `hasSampleData`, two-step confirm in Settings next to Load/Clear (not
  a global header affordance — this is a data-management action, not a safety one; Escalate owns the
  header). Proved by `scripts/sample-undo-harness.mjs` plus a Settings jest wiring test.
- **Note section order is S/O/A/P then Risk & Safety Check LAST** (round 2, 2026-08-17 — it used to sit
  between Objective and Assessment). Both emitters order it this way — `buildDraft` in
  `summarization.ts` and the `AMARA_DRAFT` sample in `fixtures.ts` — and every renderer (`NotePane`'s
  SOAP array-map, its DAP layout, `noteToPlainText`'s copy-to-clipboard) reads `draft.sections` in
  order or via `.find(s => s.isRisk)`, never a positional index, so reordering the two emitters is
  sufficient; don't reintroduce an index-based read. A screened-and-not-present risk row reads **"Not
  indicated"**, not "Denied" (fixtures, the mock scanner, and the live `SYSTEM_PROMPT`) — `deniesRisk`
  in `sessionClient.ts` recognises "indicated" as a denial-equivalent alongside "present/reported/
  endorsed/noted/raised/concerns" so the up-only risk floor treats the two wordings identically; old
  notes and hand-typed "Denied" still parse correctly, this only added a second accepted spelling.
- **"Generate from notes" (prescriptions rail) is once per note, not once per screen-mount**: the pull
  is persisted onto the note itself (`DraftNote.prescriptionsGenerated` + the pulled items appended to
  `prescriptions`) via `DataProvider.generatePrescriptions`, so the control stays disabled across a
  reload instead of local `useState` resetting it. A fresh capture always mints a brand-new `DraftNote`
  with the flag unset, which is what re-enables it on a re-record/new transcript — there is no separate
  "did the transcript change" check to maintain.
- **Re-record affordance** (`ReRecordAction` in `review.tsx`) returns to `/(app)/session?clientId=…`
  (same route `today/ready.tsx` uses to begin a session) via `router.replace`. Two-step confirm only
  when the current note is an unsigned draft — a fresh capture could rotate it out of the notes-per-
  client retention cap (`MAX_NOTES_PER_CLIENT`, `repository.ts`, C4 — 3→5 in round 2, 2026-08-17) before
  it's signed; a signed note re-records with no confirm since nothing there can be lost.
- **Continue recording** (`ContinueRecordingAction` in `review.tsx`, captain 2026-08-17 — named "Continue
  recording" in every user-facing label/test; internal identifiers and the `mode=append` route param
  are unaffected by that naming) is Re-record's opposite:
  it threads `?mode=append&note=<noteIndex>` onto the same `/(app)/session` route rather than minting a
  fresh note, never available on a signed note (no confirm needed either — append is additive, nothing
  is discarded). `session/index.tsx` detects append mode, skips `summarizationService.summarize()`
  entirely for the terminal action, and instead hands the newly transcribed (+ speaker-separated, in
  patient-session mode) text to `DataProvider.appendRecording`, which delegates the actual merge to the
  pure `applyRecordingAppend` (`src/data/appendRecording.ts`, proved by
  `scripts/append-recording-harness.mjs`) — the same pure-function-outside-React shape as
  `applySessionNote` (`saveSession.ts`), for the same reason: a rule this honesty-critical needs a
  harness that can drive it directly. It splices the new segment onto the note's existing transcript
  behind a timestamped `--- Added recording · <ts> · <segment provenance> ---` divider (never replacing
  or discarding the prior text or its own auxiliary notes, which concatenate). Provenance stays honest
  under the note's existing single-boolean model exactly while every appended segment agrees with it;
  `audioLeftDevice` only ever grows more true (up-only disclosure, same posture as the risk floor), and
  the moment a cloud-transcribed segment and a hand-typed one are spliced together, a single
  `transcriptFromCloud` boolean can no longer describe the WHOLE transcript truthfully — that's
  `DraftNote.transcriptMixedProvenance`, which switches the Transcript tab to an explicit "combines more
  than one recording" caption instead of picking one claim that misstates the other segment; the
  per-segment truth then lives in the divider line itself. Appending resets `prescriptionsGenerated`
  (the transcript genuinely changed, so "Generate from notes" honestly re-enables) — `PrescriptionsRail`
  now dedupes by bullet text before pulling, since the Plan section itself isn't auto-redrafted on
  append and a second pull over an unchanged Plan must not duplicate prescriptions.
- **Stitched audio playback + REAL recording deletion** (`StitchedAudioPlayer`/`AudioTrust` in
  `review.tsx`, captain 2026-08-17; deletion made real round 5, 2026-08-18): "Keep the audio"
  (`AudioTrust`) backs its promise with a real `<Audio>`-driven sequential player — the original
  capture, then each later Continue-recording segment, in order, via a single audio element advancing
  on `ended`. The segment list lives in `src/services/audioVault.ts`, an IN-MEMORY (module-scope,
  never vault-persisted) registry keyed by `clientId::noteIndex`, written only by `session/index.tsx`'s
  `onDrafted`/`onAppended` and only for a REAL `blob:` capture (`isRealAudioUri` — the sample clip and
  a failed recording never register, so a demo session can never be offered a fabricated "kept audio"
  replay). In-memory is a deliberate, honestly-scoped choice: a `blob:` object URL is only valid for
  the page load that created it, and the copy promises persistence only "for this session" — a reload
  genuinely loses it. **"Recording deleted" must be an OBSERVED event, never a UI state**: for a whole
  round the card claimed deletion while the blob URL stayed alive and fetchable all tab long, with a
  toggle that resurrected and replayed the "deleted" audio. Now each note's audio carries a
  disposition (`held`/`kept`/`discarded`); the deletion moment is SIGN-OFF (`sign` in `review.tsx`
  calls `discardAudioUnlessKept`, which REVOKES every segment's object URL), a re-record's
  `setOriginalAudioSegment` revokes the clip it replaces, un-keeping a signed note deletes
  immediately (the copy warns first), and a deleted recording gets no resurrect toggle. The draft
  review renders the card too ("Recording held on this device") because the keep decision must
  precede the deletion moment — and no copy anywhere claims the CLOUD copy was deleted, since the
  app cannot observe that. **`AudioTrust` reads the vault via
  `useSyncExternalStore(subscribeAudioVault, …getAudioVaultSnapshot…)` — never a bare render-time
  read.** This build runs the React Compiler (`app.json` → `experiments.reactCompiler`), which
  memoizes render expressions on the props they mention, so a bare `getAudioSegments(clientId,
  noteIndex)` in render gets cached forever and froze the card on pre-sign state in the exported
  bundle while jest (no compiler) stayed green — any future module-scope store read in render needs
  the same subscribe/snapshot seam, and needs verifying in the compiled export, not just jest.
  Proved by `scripts/audio-vault-harness.mjs` (registry ordering/isolation, disposition transitions,
  revocation observed via a stubbed `URL.revokeObjectURL`, subscription notify/stable-snapshot) and
  `review.test.tsx` wiring tests (sign-off calls the discard, the switch drives the vault ops, a
  note with no held recording gets no switch and a real `window.Audio` construction backs Play).
- **Pause/resume + a real waveform** (captain 2026-08-17, `audioCapture.ts`'s `ActiveRecording`): a
  paused-then-resumed recording is ONE segment (MediaRecorder's native `pause()`/`resume()` keep
  writing into the same clip) — the opposite of Continue-recording's brand-new segment. `stop()`'s
  `durationMs` excludes paused time (tracked via `totalPausedMs`/`pausedAt`, not trusted to the UI's
  own timer). `supportsPause` gates the Recording screen's Pause button so an unsupported
  browser/polyfill is never offered a control that would silently no-op. The waveform
  (`Waveform.tsx`) is real amplitude when a live analyser exists: `startRecording()` taps a Web Audio
  `AnalyserNode` off the SAME `MediaStream` MediaRecorder encodes (never connected to
  `audioCtx.destination` — this only reads levels, never plays the mic back) and exposes
  `getLevels(bars)`, polled by `Waveform` on a `requestAnimationFrame` loop that calls
  `Animated.Value.setValue()` directly — an imperative update RN's Animated module applies without a
  React re-render, which is what keeps a per-frame poll cheap (captain's explicit "no per-frame React
  state churn"). `getLevels` returns `null` when no analyser exists (native, an unsupported browser,
  or `AudioContext` construction failed) so `Waveform` falls back to its original ambient canned loop
  — never a fake "responsive" one — and flattens to zero while paused. Verified live in a headless
  Chrome launched with `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream` (grants a
  synthetic mic stream with no permission prompt): real per-bar amplitude that visibly varies frame to
  frame, flattens to the floor value the instant Pause is pressed, and resumes on Resume — plus the
  resulting clip's stitched playback actually plays in a real `<audio>` element, proving the whole
  capture→analyse→play pipeline end to end, not just each piece in isolation.
- **Cancel on the recording screen** (round 3, 2026-08-17): stops the recorder (releasing the mic
  track — no leak) and discards the in-progress clip back to precapture, never analysing it; two-step
  confirm only when something real is being thrown away (`live`), same as Re-record/Clear-data. Also
  round 3: `startRecording()` takes an optional `onInterrupted` callback, invoked from `finish()` only
  when the recorder's own `onstop` fires WITHOUT a caller-invoked `stop()` having run first (tracked via
  a `stopRequested` flag) — i.e. the mic stream ended on its own (unplugged, permission revoked, device
  switch). The Recording screen surfaces a distinct caution banner for this case rather than silently
  finalising the partial clip like an ordinary Stop tap.
- **Name vs. slug**: the user-visible product name is **Airava** (`app.json` `name`, the TopBar
  wordmark, onboarding/login lockups, the web `<title>`, and `public/manifest.json`). The shorthand
  **aira** stays for everything non-user-facing — repo, npm package, the `aira` `slug`/`scheme`, the
  `aira.vault.` storage namespace in `deviceStore.ts`, code identifiers, and paths — so persisted data
  and deep links keep working; do not rename those. Web `<title>` and PWA manifest are NOT emitted by
  Expo static export, so they're declared explicitly: the title via a root `Head` in `_layout.tsx`
  (the static HTML title stays empty and hydrates at runtime), the manifest as `public/manifest.json`
  linked from `src/app/+html.tsx`. `public/manifest.json` icons are scaled from `assets/images/icon.png`
  (same source as the native app icon): `icon-192.png`/`icon-512.png` (`purpose: any`) plus
  `icon-512-maskable.png` (the mark inset to the central 80% safe zone on the `#0F6E60` brand
  background, `purpose: maskable`) — below 192/512 Chrome refuses to treat the app as installable.
  Regenerate all three together if the brand mark ever changes; verify real pixel dimensions with
  `sips -g pixelWidth -g pixelHeight <file>` before committing, and installability with Chrome's
  `Page.getInstallabilityErrors` CDP call (empty array = installable) since headless Chrome has no
  DevTools UI to read visually.
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
- **UI copy voice** lives in `docs/copy-voice.md` — the warm, plain, therapy-friendly register
  (studied from Calm/Headspace/Wysa/7 Cups/Supanote/Takalam): short sentences, no em-dash chains or
  assistant-isms, forward-pointing empty states, calm actionable errors. Honesty copy keeps its exact
  meaning while following the register; the WIP banner copy is a locked literal (never reword). Em-dashes
  in UI copy were removed in a dedicated pass; the ones that remain are intentional — `'—'` no-value
  placeholders, the `Session N — date` label format (parsed by a regex), and the plaintext note-export
  section marker/attribution in `review.tsx`'s `noteToPlainText`.
- **User-facing copy is vendor/tech-jargon-free** (2026-08-18 pass): no "Groq"/"Supabase"/"Whisper",
  no "API"/"Edge Function"/"proxy"/model names, anywhere a clinician can see them — banners,
  provenance lines, capture-screen notices, Settings' service list (`configuredServices` in
  `src/config/env.ts`), onboarding. The pilot's written brief + consent form now own that technical
  disclosure; app copy says "off this device" / "pilot mode" instead. The on-device-vs-off-device
  FACT always stays (never claim a hop that didn't happen — same rule as the provenance lines below);
  only the vendor/tech naming goes. Code comments, `README.md`, and `docs/` keep full technical
  detail — this rule is copy-only. `scripts/provenance-harness.mjs`'s regexes assert the plain-language
  wording (e.g. `/transcribed off this device/i`) while still proving the same three-fact guarantees;
  keep the two in lockstep if either changes.
- Risk is clay, never alarm-red; colour is never the only signal (always paired with a word).
- Escalate is a standing, dismissible sheet — never modal, never alarm. No safety control may be a
  dead promise: the crisis line, warm handoff and safety plan each do a real thing or say plainly why
  they can't. **The crisis line's default is a literal in `src/config/env.ts`** (`DEFAULT_CRISIS_LINE`
  = the UAE Mental Support Line, "800 4673"), NOT a `.env.example` value — a safety number that only
  appears once someone copies a template is missing in CI and in a fresh clone, which is precisely
  where it was missing. `EXPO_PUBLIC_CRISIS_LINE` only *overrides* it; the `configured: false`
  branch (999 + honest "no dedicated line" copy) stays in source as the seam for a deployment that
  signals it has none, and never invents a mental-health number. The on-call address still comes
  from `EXPO_PUBLIC_ONCALL_EMAIL`. The sheet also carries two
  fixed, non-configurable UAE safety-net tiers below the crisis line — **emergency** (police, Rashid
  Hospital, DHA) and **crisis but not urgent** (The LightHouse Arabia Centre for Wellbeing) — visually
  distinct by tone so neither is mistaken for the other. All target-resolution (every `tel:`/`https:`/
  `mailto:`/route href) is pure data in `src/config/escalateContacts.ts` (`buildEscalateSections`,
  config-injectable for testing), proved by `scripts/escalate-targets-harness.mjs`; `Escalate.tsx` is
  a thin renderer over it. Any new contact must be transcribed verbatim from a source, never
  paraphrased or "corrected" — a number therefore carries BOTH forms: `href` is machine form
  (`tel:` wants bare digits) and `displayTarget` is the brief's own grouping, which is what a human
  asked to dial by hand is shown. Set `displayTarget` ONLY where the href-derived form loses
  something (i.e. `tel:`); a url/mailto copy of it can only drift. The harness re-derives the target
  from the href independently and pins that the two never disagree, for every kind.
  Pure data can't prove the WIRING, and a deleted `onPress` is how this surface went inert once — so
  `src/components/__tests__/Escalate.test.tsx` mounts the real sheet, presses every row, and asserts
  the exact `Linking.openURL` / `router.push` target (and that the disabled safety-plan row reaches
  neither). It runs under **jest + jest-expo + @testing-library/react-native** (`jest.config.js`,
  `jest --ci` at the end of the `test` script) — the project's only non-`.mjs` test lane; keep new
  component-wiring tests here and pure-module proofs in `scripts/`.
  A hand-off that the device REFUSES (a `tel:` on desktop web with no dialer) must not dismiss the
  sheet onto nothing: `runAction` closes only on a resolved `openURL`, and on rejection keeps the
  sheet open and renders `openFailureMessage` — the bare number/address to use by hand. Never
  restore the `.catch(() => {})` swallow. That copy must never name a target the app knows isn't
  real: an unconfigured on-call address is the deliberate placeholder `on-call@clinic.example`, so
  that action carries a `failureMessage` override saying no address is configured rather than
  sending the counselor to an inbox that does not exist.
  Every row's real target is also readable up front, not just tappable — on web `Linking.openURL`
  essentially never rejects, so a row can't rely on a failed tap alone to reveal the number.
  `visibleTarget(action)` (`escalateContacts.ts`) is that inline text — empty for a `route` action or
  a `hideTarget: true` row (the on-call action sets this when the address is the unconfigured
  placeholder, so it never renders as though reachable). `Escalate.tsx` renders it beside `sub` on the
  same line, ink2 against `sub`'s ink3, so the number reads first without adding a row of height.
  `buildCrisisAction` is the crisis-line action's single source of truth, shared by the Escalate sheet
  and the safety-plan screen's own crisis-line control (`src/app/(app)/patterns/safety-plan.tsx`) so
  the two never drift into separate copy for the same number; that screen's `tel:` press no longer
  swallows a rejection silently — it surfaces `openFailureMessage` the same way Escalate.tsx does.
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
  A signed note can be reopened via `DataProvider.unlockNote` (review screen's rail, two-step
  confirm mirroring sign-off's) — it only flips `status` back to `'draft'` so that same seam check
  honestly permits edits again; it never bypasses the check. `signedBy`/`signedAt` are deliberately
  left on a reopened draft (only ever read while `status === 'signed'`) so the review screen can
  tell "never signed" apart from "unlocked after being signed" — `!!draft.signedAt` on a
  draft-status note — and say so in the trust pill rather than reading as an ordinary first draft.
- Sparse series (≤ 2 readings) render as a dot-strip with no trend line.
- **Re-entry recognises the returning clinician** (round 5, 2026-08-18): boot routing at `/`
  (`src/app/index.tsx`) is decided from the device's own evidence, never a hardcoded "everyone is
  new" — vault already open → `/(app)/today`; persisted account evidence (known email or clinician
  name, via `authService.whenHydrated()`) → `/unlock`; genuinely fresh device → `/welcome`
  onboarding. The `(app)` guard's locked-vault bounce carries the interrupted location as
  `next=/(app)<path><search>` (web reads `window.location` — `usePathname()` can still be `/` on the
  first render of a reloaded deep link — native falls back to the router pathname), so sign-in
  returns the clinician to the page they were on, query params included; `safeNext` in
  `unlock/index.tsx` still validates every `next`. The unlock greeting name goes through STATE
  hydrated in an effect — a bare `authService.getClinicianName()` render read is frozen by the React
  Compiler in the compiled bundle (stuck on "Doctor" while jest passed; same trap as the audio-vault
  card). Proved by `src/app/__tests__/index.test.tsx`, the locked-vault case in
  `(app)/__tests__/_layout.test.tsx`, and the greeting/prefill case in
  `unlock/__tests__/index.test.tsx`; compiler-sensitive parts re-verified in the compiled export.
- Login + recovery copy is isolated in `src/strings/recovery.ts`; the recovery-key policy is
  captain-resolved (`decision-recovery-key-policy`): account creation + one-time recovery code,
  shown once. The account/session lifecycle lives in the `AuthService` seam (`src/services/auth.ts`,
  mocked); the server-side key-escrow support path is policy-only and never surfaced in UI.
  **The 12-word recovery code is generated fresh per account on BOTH auth paths**
  (`generateRecoveryCode` in `auth.ts`, called from `MockAuthService.createAccount` and
  `SupabaseAuthService.createAccount` alike) via a Fisher-Yates shuffle drawing from `expo-crypto`'s
  CSPRNG (`secureRandomInt`, rejection sampling — never `Math.random`, and never a fixed/shared word
  list). The persisted hash is salted: `s2:<16-byte salt, hex>:<SHA-256 digest, hex>`
  (`persistRecoveryHash`/`saltedRecoveryDigest`), a fresh random salt per account via
  `Crypto.getRandomBytes`. `recoveryCodeMatches` also recognises the PRE-upgrade format (a bare
  unsalted `fnv1a(normalizeCode(code))` hex string, no version tag) so an existing install's saved
  recovery code still unlocks — that fallback is read-only, `persistRecoveryHash` never writes it,
  so it can't be reintroduced as a regression. Because `expo-crypto`'s native module doesn't resolve
  outside Metro, `scripts/ts-service-loader.mjs` stubs it (backed by Node's own `crypto`, so the
  harness still exercises real randomness and real SHA-256) — the same pattern already used there
  for `react-native`/`@supabase/supabase-js`; extend that stub, never the app code, if a future
  harness needs another native module. Proved by `scripts/duplicate-identity-harness.mjs` (section
  "2d").
- Patient data never leaves the device: persist through `ClientRepository` / `VaultStorage`; ASR
  through `TranscriptionService` (one-shot, model downloaded on first run, whisper.rn needs a dev
  build — not Expo Go).

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
