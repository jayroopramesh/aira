# Aira — rendered workflow captures

Real renders of the running **web** app (headless Chrome, 2× scale), refreshed for the
captain-approved round-2 + round-3 design. Each changed screen is captured in **both themes**
(`-light` / `-dark`), plus phone-width proofs. The `r2r3-` prefix marks this refresh.

Regenerate after UI changes: `npx expo export --platform web && npx expo serve`, then drive the
flows (dark shots emulate `prefers-color-scheme: dark`, which the theme follows).

## Welcome (new — boots here when signed out)
- `r2r3-welcome-1-intro` · onboarding: what Aira is (full mascot, benefit chips)
- `r2r3-welcome-2-how` · onboarding: the loop in three beats + privacy close
- `r2r3-welcome-3-create` · create account (Emirates ID + "why?", phone, name, email, password ×2, consent)
- `r2r3-welcome-4-recovery` · one-time recovery code (revealed; copy/save; stern warning; "I've saved it" gate)

## Unlock (username + password)
- `r2r3-unlock-1-login` · login (username + password, "Encrypted with your login")
- `r2r3-unlock-2-wrong` · calm wrong-password state + inline recovery-code fallback

## Get ready
- `r2r3-today-1-dashboard` · day dashboard (countdown, session cards, day-at-a-glance, standing safety)
- `r2r3-today-drawer` · client drawer — read-only "highlights to keep in mind" (no checkboxes)
- `r2r3-today-prep` · prep reminder — read-only highlights (no checklist / counter / mark-all)
- `r2r3-today-2-ready` · "you're ready" state

## Session summary
- `r2r3-session-1-precapture` · pre-capture with read-only reminders
- `r2r3-session-2-recording` · recording: current-word live readout + timestamped notebox + authoritative line
- `r2r3-session-3-analysing` · analysing: skeletons + faint-green **editable transcript** → next
- `r2r3-session-4-note-soap` · SOAP note (S · O · Risk & Safety · A · P) + **Prescriptions** rail (generated + added)
- `r2r3-session-5-signed-audio` · signed + audio-trust moment (delete-by-default, keep toggle)

## Patterns
- `r2r3-patterns-1-caseload` · caseload table (search, chips, sparklines, sober risk column)
- `r2r3-patterns-2-client` · client patterns; naturalistic box labelled **companion app**
- `r2r3-patterns-3-history` · session-history timeline (journal entries → "Companion app")
- `r2r3-patterns-4-risk` · acute-risk review (clay, calm, the word "review")
- `r2r3-patterns-5-escalate` · standing Escalate sheet (never alarm-red, never modal)

## Phone-width proofs (414px, light)
- `r2r3-phone-welcome-create`, `r2r3-phone-welcome-recovery`, `r2r3-phone-unlock-login`
- `r2r3-phone-today`, `r2r3-phone-session-review`, `r2r3-phone-patterns`
