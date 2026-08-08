# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test,
release, architecture, and sharp-edge notes that should travel with the code. It is also the handoff
document — read it before you touch product copy, a model, or the data path.

Detail lives in [`docs/`](docs/README.md); this file points at it rather than restating it. The
[feasibility report](docs/reports/feasibility-stack.md) is the authority on what V1 can do, and the
[decision records](docs/decisions/) are the settled answers. Check both before you assume.

## The architecture invariant (load-bearing, not a preference)

**No backend. Nothing leaves the device.** V1 is a static, installable web app (PWA) built with
SvelteKit, with no server, no accounts, and no cloud sync. Client records are encrypted on the
counselor's own device under a password only they hold.

This is not a stylistic choice you can trade away for convenience — it *is* the product. The entire
market position, the UAE regulatory fit (health data that may not leave the country), and the trust
pitch all rest on it. The moment any session audio, transcript, or identifiable content is sent to a
server, Aira becomes a different, weaker product that competes with well-funded cloud incumbents on
their terms. If a feature seems to need a server, it is out of scope for V1 — raise it, do not quietly
add a fetch. (A future, self-hosted, off-by-default enrichment path for *de-identified* semantic data
is contemplated in [note-fluency](docs/decisions/aira-note-fluency.md), but it never carries raw
transcripts and is not V1.)

## What V1 deliberately does NOT do

Do not build, imply, or promise any of these in V1:

- **No AI-narrated notes.** There is no in-browser LLM. Transcripts become an *editable, structured
  draft* the clinician corrects and signs; no model writes prose. See
  [note-fluency](docs/decisions/aira-note-fluency.md).
- **No Arabic speech-to-text.** English transcription only. Browser-size Whisper is not accurate
  enough for Arabic clinical audio and must not be shipped for it. Arabic is a later phase. See
  [arabic-transcription-strategy](docs/decisions/aira-arabic-transcription-strategy.md). (RTL layout
  and Arabic typography are still built for from day one — that is a design/i18n concern, not a
  transcription one.)
- **No server of any kind.** See the invariant above.
- **No multi-user clinic administration** — no supervisor dashboards, no team accounts, no
  per-clinic isolation-by-server, no admin recovery. V1 is a single solo counselor on their own
  device.

## The de-identification trap (highest-value caveat — read this twice)

There are two different things both called "OpenMed," and confusing them ships something that
**redacts nothing while appearing to work:**

- **OpenMed-NER** — the famous one, the SOTA-on-benchmarks flagship — is a **biomedical** tagger:
  diseases, drugs, genes, anatomy. It is **English-only** and **does not remove names or dates at
  all.** Diseases-and-drugs ≠ names-and-dates.
- **OpenMed-PII** — a *separate* sub-family — is the one that actually de-identifies (names, dates,
  addresses, MRN, …) and is multilingual.

If someone wires up the well-known OpenMed-NER model expecting de-identification, they get a
disease/drug tagger that speaks only English and redacts none of the identifiers that matter. Use the
**PII** sub-family (or a validated clinical de-id model), never the headline biomedical NER. Details
in [feasibility §A2](docs/reports/feasibility-stack.md).

### Redaction is assistive, never a guarantee

No de-identification model here is trained or validated on counseling/psychotherapy dialogue, and a
**missed name in a mental-health record is a confidentiality breach.** Redaction must always be
*clinician-confirmed* — the UI surfaces detected identifiers for the counselor to redact or keep, and
never invites blind trust. Treat automated de-id as one assistive stage the human confirms, not a
silent safety net.

## Never assert a compliance verdict

State **what the system did**, in language the counselor can check — "names removed on this device,"
"audio deleted after transcription," "nothing on this screen has left your device." **Never** state
what the system legally *is* — no "HIPAA compliant," "GDPR compliant," "PDPL compliant," or "fully
de-identified" claims in the UI or the docs. On-device encryption is a strong technical measure, not a
legal exemption; the counselor/clinic remains the data controller. The launch market is the **UAE**,
so HIPAA is not even the applicable framework. When in doubt, describe the action, not the status, and
route compliance questions to counsel.

## Outward naming

The people in the records are **students** or **clients**; the user is the **counselor**. Never write
"patient" in UI copy, marketing, or user-facing docs. (Internal clinical-instrument names like PHQ-9
stay as-is.)

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
