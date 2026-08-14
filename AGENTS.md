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
  crashes without keys. Secrets source: `firstmate/data/aira-secrets/{supabase,groq}.env`.
- **Accounts — Supabase** (`src/services/supabase.ts`, `SupabaseAuthService` in `auth.ts`): real
  signup/login (email confirmation OFF; identity fields → user metadata). The one-time recovery-code
  moment stays app-side (local vault key path).
- **Transcription — Groq whisper-large-v3** (`GroqTranscriptionService` in `transcription.ts`) and
  **summarization — Groq llama-3.3-70b** (`src/services/summarization.ts` → a `DraftNote`). Web audio
  via `src/services/audioCapture.ts` (MediaRecorder + file-picker fallback; native falls back to the
  mock). The `mock://` sample-audio path always uses the mock transcriber.
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
  applies an **up-only safety floor**: if the note's own risk rows/summary disclose ideation (or
  self-harm) it never lets the model's tier fall below acute (or elevated), so the "any disclosed
  ideation → acute, never auto-downgrade" rule holds on the live path exactly as in the mock. The
  floor only ever raises. See `scanNoteRisk` / `riskFromNote` / `appendSessionToClient` in
  `src/data/sessionClient.ts`, proved by `scripts/risk-floor-harness.mjs`.
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
