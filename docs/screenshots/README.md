# Aira — rendered workflow captures

Real renders of the running **web** app (headless Chrome, 2× scale), one per prototype step, plus
dark-theme and phone-width proofs. Regenerate after UI changes by running the app
(`npx expo start --web`) and re-driving the flows.

## Unlock
- `unlock-1-greeting` · locked greeting + mascot + keypad
- `unlock-2-entry` · passcode dots filling
- `unlock-3-wrong` · calm wrong-key state (nothing locked out)
- `unlock-4-decrypt` · decrypt / opening-vault transition
- `unlock-5-recovery` · recovery-file screen (PENDING captain decision)

## Get ready
- `today-1-dashboard` · day dashboard (countdown, session cards, day-at-a-glance, standing safety)
- `today-2-drawer` · in-place client drawer (scores, history timeline, last plan → prep)
- `today-3-prep` · derived prep checklist
- `today-4-ready` · "you're ready" state

## Session summary
- `session-1-precapture` · pre-capture (mic, prepped items)
- `session-2-recording` · recording (waveform, on-device chip, Stop)
- `session-3-analysing` · analysing (skeletons, Stop)
- `session-4-draft` · draft note, three-pane, labeled clinical sections
- `session-5-signed` · signed + audio-deleted trust moment

## Patterns
- `patterns-1-caseload` · caseload table (search, chips, sparklines, sober risk column)
- `patterns-2-client` · client patterns (headline before charts, banded chart, sparse dot-strip)
- `patterns-3-history` · session-history timeline
- `patterns-4-risk` · acute-risk review (clay, calm, the word "review")
- `patterns-5-escalate` · standing Escalate sheet (never alarm-red, never modal)

## Theming & responsiveness
- `dark-unlock`, `dark-today`, `dark-patterns`, `dark-session-review` · dark-mode inversion
- `phone-today`, `phone-patterns`, `phone-session-review` · phone-width adaptation (panes stack; bottom tab switcher)
