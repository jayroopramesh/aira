# Decision: Clinical note fluency without an in-browser LLM

**Captain's answer (2026-08-08):** Structured extraction for V1, no AI narration. De-identified
semantic data may go to an intermediary server later "if needed, but we don't need that now."

Selects option (a) from `data/aira-stack-s1/report.md` section 7 Decision-3, with the bring-your-own
path replaced by a future self-hosted one.

**V1 behaviour:** transcripts become an editable, structured draft the clinician corrects and signs.
The note format is selectable (SOAP plus alternatives). No model writes prose.

**Phase 2, designed for but not built:** de-identified semantic data may be sent to the captain's own
server for richer note drafting. Off by default, clearly labelled, never the default path, and never
carrying raw transcripts or identifiable content.

**Positioning consequence:** buyers who expect an "AI scribe" expect narration. Lead with privacy and
caseload insight, and frame the note as precise and clinician-signed rather than machine-written.
