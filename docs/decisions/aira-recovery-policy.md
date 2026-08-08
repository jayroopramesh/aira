# Decision: Forgotten-password / key-recovery policy

**Captain's answer (2026-08-08):** Recovery file plus a printable version. The captain's first
instinct was an emailed one-time code; that was withdrawn once it became clear it cannot work without
a server holding key material.

**What ships:** at setup Aira generates a high-entropy recovery credential, writes a copy into the
therapist's chosen folder, offers a printable version, and lets the therapist email it to themselves
FROM THEIR OWN mail app. The vault's data key is wrapped twice - once under the password, once under
the recovery credential - so either opens the vault and a password change only re-wraps the small key.

**Why not the emailed code:** for an emailed one-time code to unlock the vault, a server would have to
hold material capable of decrypting it. That server, or anyone who breached or legally compelled it,
could then read patient records. It would delete the single promise the product is built on.

**What must be said to every therapist, once and plainly:** if they lose both the password and the
recovery file, the data is gone and nobody can recover it, including us. That is the design, not a
gap. Onboarding states it up front rather than burying it.

**Deferred:** if a clinic ever demands administrator recovery, a split design where a server holds
only a partial key useless without the therapist's own vault file is possible. It needs a backend and
weakens the claim, so it waits for a customer who actually asks.
