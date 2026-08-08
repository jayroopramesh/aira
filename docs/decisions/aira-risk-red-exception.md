# Decision: Alarm-red exception for the acute suicidal-ideation flag

**Captain's answer (2026-08-08):** Yes, make an exception — alarm red, or a muted maroon paired
with a warning sign. Captain's stated rationale: the notes are narrated by the therapist, so the
therapist is already aware of the patient's condition; a strong marker is an aid, not a shock.

**Resolution adopted:** muted maroon plus an explicit warning glyph, rather than a pure alarm red.

**Why maroon-plus-glyph rather than saturated red:** the captain offered both and the rationale
(clinician already knows) supports either. Maroon carries the required severity step above the
existing clay marker while staying inside the measured palette and preserving the WCAG contrast
work already done. The warning glyph is what actually does the escalation work, and it keeps the
system's colour-blind-safety rule intact.

**Binding constraints this decision does NOT relax:**

- Colour is never the only signal. The acute-SI flag is always maroon + warning glyph + a text
  label, per `data/aira-ui-s3/report.md` §A.6.
- The exception is scoped to the acute suicidal-ideation flag alone. All other severity states
  keep the sober clay/severity-band treatment. Do not generalise maroon into a house error colour.
- No flashing, no animation, no count-up on the value.
- The chosen maroon must be contrast-measured against light and dark surfaces the same way every
  other token in §B was, and added to the token sheet — not hand-picked in a component.
