# Decision: Delivery target - installable web app vs any-browser tab

**Captain's answer (2026-08-08):** Proceed with a web app. Installable, not a native store app.

Accepts option (a) from `data/aira-stack-s1/report.md` section 7 Decision-2.

**Why this and not native:** the pilot demo needs no phone and no AI, so a URL is the fastest route
to the MBZUAI counselor; app-store review for a health app would delay the trial without helping it;
the counselor's real working surface is a laptop; and a native wrapper can reuse the same codebase
later without a rewrite.

**Consequences accepted:**

- On iPhone, installing to the home screen is REQUIRED, not optional. In a plain Safari tab, iOS
  deletes local storage after seven idle days and would take the vault with it. Onboarding must make
  this unmissable and should detect the uninstalled state on iOS before any data is entered.
- The app opens on any phone browser; what differs by platform is only how the user's folder works.
- Native iOS/Android stays available as a later phase, not a V1 obligation. To keep that option free,
  storage must sit behind one adapter interface from day one (see `aira-storage-model`).
