# Decision: Arabic transcription strategy for V1

**Captain's answer (2026-08-08):** English first. Arabic comes after.

This selects option (b) from `data/aira-stack-s1/report.md` §7 Decision-1: ship English
transcription for V1 (Whisper-base in-browser, the measured-accurate path), and defer Arabic
speech-to-text to a later phase rather than betting V1 on it.

**Consequences accepted:**

- V1 does not promise Arabic transcription. Arabic sessions are served by typed/manual notes
  plus the deterministic longitudinal analysis, which is language-independent.
- The Moonshine-Tiny-Arabic web/ONNX build verification moves out of the V1 critical path and
  becomes a cheap de-risking spike scheduled ahead of the Arabic phase.
- Browser-size Whisper is NOT to be shipped for Arabic clinical audio at any point
  (49% WER base / 31% small on easy MSA, worse on Gulf dialect).

**Still true and unchanged:** RTL layout, Arabic typography, and Arabic lexical risk rules are
design/analysis concerns, not transcription concerns, and stay on the roadmap per
`aira-multiling-roadmap`.
