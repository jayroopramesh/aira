/**
 * PENDING captain decision: recovery-key policy.
 * Backlog: aira-ui-screens-s4-decision-recovery-key-policy
 *
 * ALL recovery-related copy is isolated here so it can be swapped in one place once the
 * captain rules. The s4 prototype commits to a RECOVERY-FILE model (option b, the s3
 * recommended default): a saved `aira-recovery.key` is the only other way into the vault,
 * and there is no server-side reset. The three options the s3 study surfaced were:
 *
 *   (a) pure zero-knowledge / no recovery
 *   (b) recovery file  ← depicted here
 *   (c) clinic-escrow
 *
 * Do NOT build recovery behaviour beyond the screens the prototype depicts (unlock keypad,
 * wrong-key state, recovery-file drop). The copy below matches those screens verbatim.
 */
export const recoveryStrings = {
  // Unlock greeting / vault-locked
  lockedEyebrow: (clinician: string) => `Good morning, ${clinician}`,
  lockedTitle: 'Your vault is locked',
  lockedSubtitle: 'Six sessions today. Everything below is encrypted until you open it.',
  onDeviceSubtitle: 'Your notes stay encrypted on this device.',
  useRecoveryLink: 'Use recovery file',

  // Wrong-key (calm, nothing locked out)
  wrongKeyEyebrow: 'That key didn’t fit',
  wrongKeyTitle: 'Let’s try once more',
  wrongKeySubtitle: 'No account is locked and nothing was sent anywhere — this vault only exists on your device.',
  wrongKeyAttempt: 'Attempt 2 of unlimited · take your time',
  wrongKeyRecoveryLink: 'Use recovery file instead',

  // Decrypt transition
  decryptingTitle: 'Opening your vault',
  decryptingSubtitle: 'Deriving your key on this device…',

  // Recovery-file screen (recovery-file model — the one the prototype commits to)
  recoveryEyebrow: 'Recovery',
  recoveryTitle: 'Open with your recovery file',
  recoverySubtitle:
    'If you saved a recovery file when you set up Aira, drop it here. It’s the only other way in — Aira can’t reset a key it never stored.',
  recoveryDropPrimary: 'Drop aira-recovery.key',
  recoveryDropSecondary: 'or browse for it',
  recoveryBackLink: 'Back to key entry',
  recoveryNoFile: 'No recovery file? Your data can’t be recovered — that’s the trade for true privacy.',
} as const;
