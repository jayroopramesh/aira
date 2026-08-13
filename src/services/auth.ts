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

import { hasSupabase } from '../config/env';
import { getSupabase } from './supabase';
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

/** A fresh 12-word recovery code (seed-phrase convention) — generated once per account. */
const RECOVERY_POOL = [
  'harbor', 'lantern', 'cedar', 'quartz', 'tidal', 'ember', 'willow', 'basalt', 'saffron', 'meadow',
  'cobalt', 'anchor', 'marina', 'pebble', 'coral', 'lagoon', 'compass', 'driftwood', 'seabreeze',
  'current', 'beacon', 'estuary', 'ripple', 'shoal',
] as const;

function generateRecoveryCode(): string[] {
  // No crypto RNG needed for a demo recovery moment; a shuffled 12 of the pool reads as a
  // real seed phrase. (The real vault derives this from the Argon2id envelope instead.)
  const pool = [...RECOVERY_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 12);
}

export interface AuthService {
  /** Current account lifecycle state. */
  getStatus(): AccountStatus;
  /**
   * Create the account. Generates the one-time recovery code (app-side vault-key moment) and moves
   * to `awaiting-recovery-save`. The returned code is the ONLY time it is exposed.
   */
  createAccount(details: AccountDetails): Promise<{ recoveryCode: string[] }>;
  /** The 12-word recovery code for the current account (for the one-time reveal only). */
  getRecoveryCode(): string[];
  /** Gate past the one-time recovery screen once the clinician confirms they saved it. */
  markRecoverySaved(): void;
  /** The email of the account being set up / last used, so login can prefill it. */
  getKnownEmail(): string | null;
  /** Sign in with username/email + password; unlocks the vault on success. */
  signIn(username: string, password: string): Promise<UnlockResult>;
  /** Fallback path: unlock with the saved 12-word recovery code (lets them reset later). */
  signInWithRecoveryCode(code: string): Promise<UnlockResult>;
  /** Drop the session (re-locks the vault). */
  signOut(): Promise<void>;
}

export class MockAuthService implements AuthService {
  private status: AccountStatus = 'none';
  private recoveryCode: string[] = [...RECOVERY_WORDS];
  private createdPassword: string | null = null;
  private knownEmail: string | null = null;

  constructor(private readonly vault: VaultStorage) {}

  getStatus() {
    return this.status;
  }

  async createAccount(details: AccountDetails): Promise<{ recoveryCode: string[] }> {
    // A real impl derives the vault key from the password and escrows a wrapped copy;
    // here we remember the chosen password, move state forward, and hand back the code.
    this.createdPassword = details.password;
    this.knownEmail = details.email;
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

  getKnownEmail() {
    return this.knownEmail;
  }

  async signIn(username: string, password: string): Promise<UnlockResult> {
    // Demo rule: the password chosen at account creation or DEMO_PASSWORD opens;
    // anything else reproduces the calm wrong-password state.
    const accepted = password === DEMO_PASSWORD || (this.createdPassword !== null && password === this.createdPassword);
    if (!accepted) return { ok: false, reason: 'wrong-key' };
    this.knownEmail = username;
    const res = await this.vault.unlock(password);
    if (res.ok) this.status = 'active';
    return res;
  }

  async signInWithRecoveryCode(code: string): Promise<UnlockResult> {
    // The entered words must match the canonical 12-word code (no crypto — a plain
    // normalized word-sequence check); the real impl checks the saved envelope.
    const normalize = (s: string) => s.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const entered = normalize(code);
    const expected = normalize(this.recoveryCode.join(' '));
    const matches = entered.length === expected.length && entered.every((w, i) => w === expected[i]);
    if (!matches) return { ok: false, reason: 'wrong-key' };
    const res = await this.vault.unlockWithRecoveryCode(code);
    if (res.ok) this.status = 'active';
    return res;
  }

  async signOut() {
    await this.vault.lock();
  }
}

/**
 * SupabaseAuthService — accounts (create-account + login) run against the captain's Supabase
 * project. Email confirmation is OFF, so signUp returns a usable session immediately. Our flow maps
 * honestly onto Supabase primitives:
 *
 *   • createAccount → auth.signUp({ email, password, options.data: { emiratesId, phone, fullName } })
 *     — the identity fields become user metadata. The one-time recovery-code moment stays app-side
 *     (the vault key path is local), so the code is generated here and never sent to the server.
 *   • signIn        → auth.signInWithPassword({ email, password }); a wrong password surfaces the
 *     real "Invalid login credentials" error, wired to the calm wrong-password state.
 *   • signInWithRecoveryCode — stays app-side against the code generated at signup (the vault-key
 *     fallback), matching the local-vault model. On reload the in-memory code is gone; the demo
 *     recovery moment lives within a session.
 *
 * The vault open is still delegated to VaultStorage — clinical data is device-local regardless.
 */
export class SupabaseAuthService implements AuthService {
  private status: AccountStatus = 'none';
  private recoveryCode: string[] = generateRecoveryCode();
  private knownEmail: string | null = null;

  constructor(private readonly vault: VaultStorage) {}

  getStatus() {
    return this.status;
  }

  getRecoveryCode() {
    return this.recoveryCode;
  }

  markRecoverySaved() {
    this.status = 'active';
  }

  getKnownEmail() {
    return this.knownEmail;
  }

  async createAccount(details: AccountDetails): Promise<{ recoveryCode: string[] }> {
    const supabase = getSupabase();
    this.knownEmail = details.email;
    this.recoveryCode = generateRecoveryCode();
    if (supabase) {
      const { error } = await supabase.auth.signUp({
        email: details.email,
        password: details.password,
        options: {
          data: { emiratesId: details.emiratesId, phone: details.phone, fullName: details.fullName },
        },
      });
      // "already registered" is expected on repeated demo runs — the account exists, so the
      // create → one-time-recovery → login walkthrough can still proceed.
      if (error && !/already registered|already been registered/i.test(error.message)) {
        throw new Error(error.message);
      }
    }
    // The recovery code is the app-side vault-key moment — unlock the local vault now.
    await this.vault.unlock(details.password);
    this.status = 'awaiting-recovery-save';
    return { recoveryCode: this.recoveryCode };
  }

  async signIn(username: string, password: string): Promise<UnlockResult> {
    const supabase = getSupabase();
    this.knownEmail = username;
    if (supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email: username.trim(), password });
      if (error) return { ok: false, reason: 'wrong-key' };
    }
    const res = await this.vault.unlock(password);
    if (res.ok) this.status = 'active';
    return res;
  }

  async signInWithRecoveryCode(code: string): Promise<UnlockResult> {
    const normalize = (s: string) => s.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const entered = normalize(code);
    const expected = normalize(this.recoveryCode.join(' '));
    const matches = entered.length === expected.length && entered.every((w, i) => w === expected[i]);
    if (!matches) return { ok: false, reason: 'wrong-key' };
    const res = await this.vault.unlockWithRecoveryCode(code);
    if (res.ok) this.status = 'active';
    return res;
  }

  async signOut() {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut().catch(() => {});
    await this.vault.lock();
  }
}

/**
 * The app-wide auth handle. Supabase-backed when accounts are configured (real create-account +
 * login), otherwise the on-device mock so the flow still demos with no keys.
 */
export const authService: AuthService = hasSupabase
  ? new SupabaseAuthService(vaultStorage)
  : new MockAuthService(vaultStorage);
