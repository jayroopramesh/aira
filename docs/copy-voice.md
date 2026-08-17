# Airava copy voice

How user-facing copy in Airava should sound. Studied from the therapy-and-wellbeing
apps the captain named — Calm, Headspace, Wysa, 7 Cups, Supanote, Takalam, Klarify —
via Mobbin screens and product pages (2026-08-17). Use this register for every label,
empty state, banner, confirm, hint, and error string. It does **not** relax the honesty
contracts in `CLAUDE.md`: provenance, cloud-disclosure, trust-pill, and the WIP banner
copy stay exactly as specified there. Warmer wording, same truth.

## The register, in 15 lines

1. **Short sentences.** One idea each. Calm: "Reflecting can bring up a lot." Headspace:
   "Stress less. Move more. Sleep soundly." When a thought needs two clauses, use two
   sentences, not a dash.
2. **Warm and plain, not clinical — at the right moment.** Save clinical vocabulary for
   the note itself; the chrome around it talks like a person. Supanote's whole pitch is
   "sounds like you," not like a system.
3. **Address the counselor directly, kindly.** "you", "your client", "your notes". Wysa:
   "Thanks for sharing a little bit about yourself."
4. **Reassure by pointing forward, not by piling up qualifiers.** Empty states say what
   *will* be here: Fitbit "You'll see data from completed sessions here." Calm "come back
   here anytime." Waking Up "Listen to any session to see it in your history."
5. **Errors are calm and actionable.** Name what happened in one plain clause, then the
   one thing to do next. No blame, no alarm, no stack-trace tone.
6. **Confirmations state the outcome plainly.** What will happen, in the fewest true
   words. A destructive confirm still says what is lost — plainly, once.
7. **"Let's" only when it's genuinely an invitation to do something together**, and at
   most once on a screen. Headspace: "Let's create your meditation practice." Never as
   filler in front of an error or a routine action.
8. **Reassurance is specific, never saccharine.** "Treat yourself tenderly today" works
   because it's concrete. Avoid empty "Don't worry!" and "Oops!".
9. **One idea, one emphasis.** No triple-clause reassurance sandwiches ("X, but Y, though
   of course Z"). Cut to the load-bearing clause.
10. **Verbs over nouns.** "Sign in to turn on cloud transcription" beats "Cloud
    transcription enablement requires authentication."
11. **Honesty reads as care, not fine print.** When we disclose a limit (cloud hop, no
    recording, unsigned draft), say it in the same warm plain voice as everything else —
    Alan's "For your safety, our doctors review a sample" is calm, not defensive.
12. **Buttons are a verb + optional object.** "Start reflection", "Take me there", "Use
    sample audio". Not "OK" where a real verb fits.
13. **Culturally grounded, unfussy.** Takalam's register is regional and values-led, not
    breezy Silicon-Valley. Airava serves UAE counselors; keep copy grounded, respectful,
    never chirpy.
14. **Punctuation: periods and commas carry the load.** Em-dashes are the smell we're
    removing — allowed only where truly the best mark (a genuine aside a comma can't hold),
    which is rare in UI. Prefer a period or a colon. One exclamation mark per surface at
    most, and only where warmth is real.
15. **What these apps never do:** clinical jargon in the chrome, exclamation spray,
    em-dash chains, stacked hedges ("might possibly perhaps"), fake cheer over a real
    problem, or a reassurance so vague it says nothing.

## Quick rewrites (pattern → do this)

- Em-dash chain → two short sentences or a colon. "Signing in cannot rescue a capture
  already recorded — the audio is gone." → "Signing in can't recover a recording that's
  already finished. That audio is gone."
- "Let's…" assistant-ism on an error → drop it. "Let's get you signed in first." →
  "Sign in to continue."
- Triple reassurance → one true clause. "Don't worry, your data is safe and nothing has
  left your device and everything stays private." → "Your notes stay on this device."
- Empty state that only states absence → add the forward pointer. "No notes." → "No notes
  yet. Your first session will show up here."

## Maintaining this file

Keep it short and register-focused. If a real product example teaches a rule better than
the abstract statement, cite the product. Don't turn it into a style-guide encyclopedia —
15 lines is the budget.
