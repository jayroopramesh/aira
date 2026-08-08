# Decision: Canvas ground — cool seafoam vs warm sand

**Captain's answer (2026-08-08):** Cool seafoam. "We can improve and iterate on this as required."

**What this settles:** the design scout's deviation from `handoff.md` §6 is accepted. The app
ground is the cool seafoam-tinted off-white (`--surface #F3F8F6`), not the original warm cream.
Warm sand (`#F4EDDD`) survives as an accent only (e.g. draft badges), never as the canvas.

The full measured token set in `data/aira-ui-s3/report.md` §B and
`data/aira-ui-s3/design-direction.html` is the source of truth and is adopted as-is.

**Explicitly not frozen:** the captain flagged this as iterable. Treat the ground as a tuned
token, not a brand commitment; changing `--surface` later must remain a one-token change, which
means no component may hardcode the ground colour.
