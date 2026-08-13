/**
 * Recovery / login copy — captain-resolved recovery-key policy
 * (decision-recovery-key-policy.md, 2026-08-12).
 *
 * ALL recovery-related and vault-login copy is isolated here so it can be tuned in one
 * place. The policy: account creation collects Emirates ID + phone + name + email +
 * password; a one-time recovery code is shown ONCE at setup and is the self-service path
 * if the password is forgotten. Aira also escrows the decrypt key server-side, released
 * only on a manual, mutually-approved basis — deliberately NOT surfaced as a UI button.
 *
 * Framing guidance: stern but TRUTHFUL. Treat the vault as effectively unrecoverable so
 * the clinician takes the code seriously, without claiming absolute impossibility (a slow
 * manual support path exists). Final wording is at the engineer's discretion within that.
 */
export const recoveryStrings = {
  // Unlock · login (username + password)
  loginEyebrow: (clinician: string) => `Good morning, ${clinician}`,
  loginTitle: 'Your vault is locked',
  loginSubtitle: 'Sign in to decrypt today’s notes. Everything below stays on this device.',
  usernameLabel: 'Username',
  passwordLabel: 'Password',
  signInCta: 'Sign in & decrypt',
  demoWrongLink: 'See a wrong-password state',
  createAccountLink: 'New to Aira? Create an account',
  vaultLine: 'Encrypted with your login · notes stay on this device.',
  // Supanote-style trust note — HIPAA-ALIGNED phrasing only (never "compliant/certified"; counsel pending).
  hipaaLine: 'HIPAA-aligned safeguards · encrypted on this device — only you hold the key.',

  // Wrong-password (calm, nothing locked out)
  wrongEyebrow: 'That didn’t match',
  wrongTitle: 'Let’s try once more',
  wrongSubtitle: 'No account is locked — take your time. Your notes vault exists only on this device.',
  wrongHint: 'Password didn’t match this vault. Attempt 2 — take your time.',

  // Recovery-code fallback (revealed inline on the wrong-password screen)
  forgotLink: 'Forgot your password? Use your recovery code',
  recoveryCodeLabel: 'Recovery code',
  recoveryCodePlaceholder: 'harbor  lantern  cedar  …',
  recoveryCodeHint:
    'Enter the 12-word code you saved when you created your vault. It unlocks the vault and lets you set a new password.',
  recoveryCodeCta: 'Unlock with recovery code',
  recoveryCodeError: 'That code didn’t match — check the 12 words and spacing.',

  // Decrypt transition
  decryptingEyebrow: 'Signed in',
  decryptingTitle: 'Opening your vault…',
  decryptingSubtitle: 'Decrypting notes on this device with your login. This never touches a server.',
  decryptingVaultLine: 'Encrypted with your login · keys never leave this device',

  // Welcome · onboarding
  onboard1Eyebrow: 'Welcome to Aira',
  onboard1Title: 'Your sessions, understood — and kept only by you',
  onboard1Lede:
    'Aira is your personal scribe for after the session — not another ear in the room. You capture the conversation on your device; Aira drafts the clinical note once you’re done, and shows what’s changing over time. Everything private stays on your device, encrypted.',
  onboard1Chips: ['Encrypted on your device', 'Notes drafted for you', 'Patterns over time'],
  onboard1Cta: 'Get started',
  onboardSkip: 'Skip — I already have an account',

  onboard2Eyebrow: 'How it works',
  onboard2Title: 'Three steps, every session',
  onboard2Beats: [
    { title: 'Capture on your device', body: 'Record the session on your device; Aira transcribes it and drafts your note for you to review.' },
    { title: 'Sign your note', body: 'Aira drafts a SOAP note. You review, edit, and sign — nothing is final until you say so.' },
    { title: 'See patterns', body: 'Scores and themes build over time, so change is visible across visits.' },
  ],
  onboard2Privacy: 'Your notes are encrypted with a key only you hold. Aira can’t read them, and neither can anyone else.',
  onboard2Cta: 'Create your account',

  // Welcome · create account
  createEyebrow: 'Create your account',
  createTitle: 'A vault that’s yours alone',
  createLede: 'We verify you’re a licensed clinician, then set up your encrypted vault on this device.',
  emiratesIdLabel: 'Emirates ID number',
  emiratesIdWhyLink: 'Why do we need this?',
  emiratesIdWhy:
    'Your Emirates ID lets us confirm you against the UAE licensed-practitioner registry, and it’s the identity we’d check for the manual, mutually-approved account-recovery path. It’s used for verification only — it isn’t stored in your notes vault.',
  phoneLabel: 'Phone number',
  fullNameLabel: 'Full name',
  emailLabel: 'Email',
  confirmPasswordLabel: 'Confirm password',
  consentText:
    'I’m a licensed clinician and I agree to Aira’s Terms and Privacy Notice. I understand my notes are encrypted on this device.',
  createCta: 'Create account',
  createSignInLink: 'Already have an account? Sign in',

  // Welcome · one-time recovery code
  recoveryBadge: 'Shown once — never again',
  recoveryTitle: 'Your recovery code',
  recoveryLede:
    'If you ever forget your password, this code is how you get back into your vault. Save it now — Aira can’t show it to you a second time.',
  recoveryReveal: 'Tap to reveal',
  recoveryCopy: 'Copy code',
  recoveryCopied: 'Copied',
  recoverySave: 'Save as file',
  recoverySaved: 'Saved',
  recoveryWarning:
    'Treat this code as your only way back in. Lose both it and your password, and recovery becomes a slow, manually-verified process — if it’s possible at all.',
  recoveryGate: 'I’ve saved my recovery code somewhere safe. I understand it won’t be shown again.',
  recoveryEnterCta: 'Enter Aira',
} as const;
