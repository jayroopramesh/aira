/**
 * AuthService — the account + session seam that sits in front of the encrypted vault.
 *
 * This is where the Welcome flow (create account → one-time recovery code) and the
 * Unlock flow (username + password, wrong-password, recovery-code fallback) get their
 * state. It is a MOCK: no real crypto, no server calls. It models the captain-approved
 * recovery-key policy (see strings/recovery.ts) with realistic in-memory state
 * transitions so the screens demo end-to-end:
 *
 *   none ──createAccount()──▶ awaiting-recovery-save ──markRecoverySaved()──▶ active
 *   active ──signIn()/signInWithRecoveryCode()──▶ unlocked vault (delegated to VaultStorage)
 *
 * The recovery code is generated ONCE at account creation and never exposed again — the
 * one-time reveal on the recovery screen is the only time it is shown. Aira additionally
 * escrows the decrypt key server-side (manual, mutually-approved release only); that path
 * is deliberately NOT surfaced in the UI. The real implementation replaces this mock with
 * an Argon2id envelope + registry check without touching callers.
 */

import { UnlockResult, vaultStorage, VaultStorage } from './storage';

/** What account creation collects (Emirates ID for the manual-recovery identity check). */
export type AccountDetails = {
  emiratesId: string;
  phone: string;
  fullName: string;
  email: string;
  password: string;
};

export type AccountStatus = 'none' | 'awaiting-recovery-save' | 'active';

/** The demo password the mock login accepts; anything else drives the wrong-password state. */
const DEMO_PASSWORD = 'clinicvault';

/** The one-time recovery code the prototype commits to (seed-phrase convention, 12 words). */
const RECOVERY_WORDS = [
  'harbor',
  'lantern',
  'cedar',
  'quartz',
  'tidal',
  'ember',
  'willow',
  'basalt',
  'saffron',
  'meadow',
  'cobalt',
  'anchor',
] as const;

export interface AuthService {
  /** Current account lifecycle state. */
  getStatus(): AccountStatus;
  /**
   * Create the account (mock — no server). Generates the one-time recovery code and moves
   * to `awaiting-recovery-save`. The returned code is the ONLY time it is exposed.
   */
  createAccount(details: AccountDetails): Promise<{ recoveryCode: string[] }>;
  /** The 12-word recovery code for the current account (for the one-time reveal only). */
  getRecoveryCode(): string[];
  /** Gate past the one-time recovery screen once the clinician confirms they saved it. */
  markRecoverySaved(): void;
  /** Sign in with username + password; unlocks the vault on success. */
  signIn(username: string, password: string): Promise<UnlockResult>;
  /** Fallback path: unlock with the saved 12-word recovery code (lets them reset later). */
  signInWithRecoveryCode(code: string): Promise<UnlockResult>;
  /** Drop the session (re-locks the vault). */
  signOut(): Promise<void>;
}

export class MockAuthService implements AuthService {
  private status: AccountStatus = 'none';
  private recoveryCode: string[] = [...RECOVERY_WORDS];

  constructor(private readonly vault: VaultStorage) {}

  getStatus() {
    return this.status;
  }

  async createAccount(_details: AccountDetails): Promise<{ recoveryCode: string[] }> {
    // A real impl derives the vault key from the password and escrows a wrapped copy;
    // here we just move state forward and hand back the one-time code.
    this.recoveryCode = [...RECOVERY_WORDS];
    this.status = 'awaiting-recovery-save';
    return { recoveryCode: this.recoveryCode };
  }

  getRecoveryCode() {
    return this.recoveryCode;
  }

  markRecoverySaved() {
    this.status = 'active';
  }

  async signIn(_username: string, password: string): Promise<UnlockResult> {
    // Demo rule: DEMO_PASSWORD opens; anything else reproduces the calm wrong-password state.
    if (password !== DEMO_PASSWORD) return { ok: false, reason: 'wrong-key' };
    const res = await this.vault.unlock(password);
    if (res.ok) this.status = 'active';
    return res;
  }

  async signInWithRecoveryCode(code: string): Promise<UnlockResult> {
    // Any non-empty code opens in the mock; the real impl checks the saved envelope.
    if (!code.trim()) return { ok: false, reason: 'wrong-key' };
    const res = await this.vault.unlockWithRecoveryCode(code);
    if (res.ok) this.status = 'active';
    return res;
  }

  async signOut() {
    await this.vault.lock();
  }
}

export const authService: AuthService = new MockAuthService(vaultStorage);
