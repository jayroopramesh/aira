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
- Design tokens are ported verbatim from `aira-ui-s3/design-direction.html`; the prototype spec is
  `aira-ui-screens-s4/screens.html`. Treat those as source-of-truth for any UI change.

## Server infra (`infra/`)
OpenTofu module for the v1 server on Azure (UAE North) — dummy-application phase, nothing applied
yet. Runbook, decisions applied, cost table, and open items are all in `infra/README.md`; don't
duplicate them here. Sharp edges specific to working on it: Homebrew is broken on the dev machine
(`/opt/homebrew` ownership), so `az` was installed via `pip3 install --user azure-cli` and `tofu`
via the standalone-binary method — see `infra/README.md` "Prerequisites". CI is GitHub Actions only
(`.github/workflows/infra.yml`) — no Azure DevOps.

## Structural rules to preserve (locked design decisions)
- Mascot only on human surfaces (unlock, wordmark) — never on charts/tables/risk queue.
- Risk is clay, never alarm-red; colour is never the only signal (always paired with a word).
- Escalate is a standing, dismissible sheet — never modal, never alarm.
- Sparse series (≤ 2 readings) render as a dot-strip with no trend line.
- Recovery-key copy is isolated in `src/strings/recovery.ts` (PENDING captain decision); don't
  build recovery behaviour beyond the depicted screens.
- Patient data never leaves the device: persist through `ClientRepository` / `VaultStorage`; ASR
  through `TranscriptionService` (one-shot, model downloaded on first run, whisper.rn needs a dev
  build — not Expo Go).

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
