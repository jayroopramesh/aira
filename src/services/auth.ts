/**
 * AuthService — the account + session seam that sits in front of the encrypted vault.
 *
 * This is where the Welcome flow (create account → one-time recovery code) and the
 * Unlock flow (username + password, wrong-password, recovery-code fallback) get their
 * state. It models the captain-approved recovery-key policy (see strings/recovery.ts);
 * the app-wide handle is `SupabaseAuthService` (real signup/login) when accounts are
 * configured and `MockAuthService` (no crypto, no server calls) otherwise:
 *
 *   none ──createAccount()──▶ awaiting-recovery-save ──markRecoverySaved()──▶ active
 *   active ──signIn()/signInWithRecoveryCode()──▶ unlocked vault (delegated to VaultStorage)
 *
 * The recovery code is generated ONCE at account creation and never exposed again — the
 * one-time reveal on the recovery screen is the only time it is shown. Aira additionally
 * escrows the decrypt key server-side (manual, mutually-approved release only); that path
 * is deliberately NOT surfaced in the UI. The production implementation adds an Argon2id
 * envelope + registry check behind the same interface without touching callers.
 */

import { hasSupabase } from '../config/env';
import { deviceStore } from './deviceStore';
import { getSupabase } from './supabase';
import { UnlockResult, vaultStorage, VaultStorage } from './storage';

/**
 * The recovery code and the clinician's name must survive a page reload — the whole point of the
 * recovery code is that it works when you come back locked out (F1), and the sign-off attestation
 * must name the clinician who actually signed in (F8). Both persist through `deviceStore` (the same
 * device-local layer the vault uses). The recovery code is stored as a non-reversible hash, not the
 * words themselves — the real Argon2id vault replaces this with a proper key-derivation envelope.
 */
const RECOVERY_HASH_KEY = 'auth.recovery-hash';
const CLINICIAN_NAME_KEY = 'auth.clinician-name';
const KNOWN_EMAIL_KEY = 'auth.known-email';
const PASSWORD_HASH_KEY = 'auth.password-hash';

/** Canonicalise a 12-word code so spacing/case never cause a false mismatch. */
function normalizeCode(code: string): string {
  return code.trim().toLowerCase().split(/\s+/).filter(Boolean).join(' ');
}

/** FNV-1a 32-bit → hex. Not cryptographic (v1 stores no crypto), but avoids keeping secrets in cleartext. */
function fnv1a(raw: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** The recovery code is normalized before hashing; a password is NOT (it is case- and space-sensitive). */
function hashRecoveryCode(code: string): string {
  return fnv1a(normalizeCode(code));
}

async function persistRecoveryHash(words: string[]): Promise<void> {
  await deviceStore.set(RECOVERY_HASH_KEY, hashRecoveryCode(words.join(' ')));
}

/** True when the entered code hashes to the value persisted at account creation (survives reloads). */
async function recoveryCodeMatches(entered: string): Promise<boolean> {
  const stored = await deviceStore.get(RECOVERY_HASH_KEY);
  return !!stored && stored === hashRecoveryCode(entered);
}

/** What account creation collects (Emirates ID for the manual-recovery identity check). */
export type AccountDetails = {
  emiratesId: string;
  phone: string;
  fullName: string;
  email: string;
  password: string;
};

export type AccountStatus = 'none' | 'awaiting-recovery-save' | 'active';

/**
 * Thrown by `createAccount` when Supabase reports the email is ALREADY registered. This is a
 * returning counselor who tapped "Create account" instead of "Sign in" — and their saved recovery
 * code is the one credential the app calls their only way back in, so create-account STOPS on this:
 * it mints no new recovery code, leaves the persisted recovery hash and the local vault untouched,
 * and sets no active/awaiting status. The create screen catches it, shows a calm "you already have
 * an account" message, and routes to sign-in with the email prefilled. Distinct from a generic
 * failure precisely because the remedy is different (sign in, don't retry the form).
 */
export class AccountExistsError extends Error {
  constructor(readonly email: string) {
    super('You already have an account — sign in.');
    this.name = 'AccountExistsError';
  }
}

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
  /**
   * Resolves once the persisted email + clinician name have been read back from the device store,
   * so screens that render before hydration can re-sync (F17/F8). Never rejects.
   */
  whenHydrated(): Promise<void>;
  /** The signed-in clinician's display name — the sign-off attestation and greeting are attributed to it. */
  getClinicianName(): string | null;
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
  private clinicianName: string | null = null;
  private readonly hydrated: Promise<void>;

  constructor(private readonly vault: VaultStorage) {
    // Best-effort hydrate the clinician name + known email so a returning session attributes the
    // sign-off correctly (F8) and login prefills the RIGHT email, never a demo default (F17).
    this.hydrated = Promise.all([
      deviceStore.get(CLINICIAN_NAME_KEY).then((v) => {
        if (v && !this.clinicianName) this.clinicianName = v;
      }),
      deviceStore.get(KNOWN_EMAIL_KEY).then((v) => {
        if (v && !this.knownEmail) this.knownEmail = v;
      }),
    ]).then(
      () => undefined,
      () => undefined,
    );
  }

  getStatus() {
    return this.status;
  }

  whenHydrated() {
    return this.hydrated;
  }

  async createAccount(details: AccountDetails): Promise<{ recoveryCode: string[] }> {
    // The already-registered rule holds on EVERY build, not just the Supabase one. There is no server
    // to ask here, but the device already carries the evidence: a persisted recovery hash means an
    // account was created on it, so a second createAccount would overwrite the hash of the code the
    // counselor saved — the exact silent lockout the Supabase path stops. So STOP the same way: no new
    // code, no hash write, no password-hash write, no status change. The create screen already routes
    // AccountExistsError to sign-in with the email prefilled.
    if (await deviceStore.get(RECOVERY_HASH_KEY)) {
      throw new AccountExistsError(details.email);
    }
    // A real impl derives the vault key from the password and escrows a wrapped copy;
    // here we remember the chosen password, move state forward, and hand back the code.
    this.createdPassword = details.password;
    this.knownEmail = details.email;
    this.clinicianName = details.fullName;
    this.recoveryCode = [...RECOVERY_WORDS];
    // Persist the code's hash + the clinician name + the email so recovery works, the sign-off is
    // attributed, and login prefills the right email after a reload.
    await persistRecoveryHash(this.recoveryCode);
    await deviceStore.set(PASSWORD_HASH_KEY, fnv1a(details.password));
    await deviceStore.set(CLINICIAN_NAME_KEY, details.fullName);
    await deviceStore.set(KNOWN_EMAIL_KEY, details.email);
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

  getClinicianName() {
    return this.clinicianName;
  }

  async signIn(username: string, password: string): Promise<UnlockResult> {
    // Demo rule: the password chosen at account creation (in-memory or its persisted hash, so a
    // returning counselor's real password still works after a reload) or DEMO_PASSWORD opens;
    // anything else reproduces the calm wrong-password state.
    let accepted = password === DEMO_PASSWORD || (this.createdPassword !== null && password === this.createdPassword);
    if (!accepted) {
      const storedHash = await deviceStore.get(PASSWORD_HASH_KEY);
      accepted = !!storedHash && storedHash === fnv1a(password);
    }
    if (!accepted) return { ok: false, reason: 'wrong-key' };
    this.knownEmail = username;
    await deviceStore.set(KNOWN_EMAIL_KEY, username);
    const res = await this.vault.unlock(password);
    if (res.ok) this.status = 'active';
    return res;
  }

  async signInWithRecoveryCode(code: string): Promise<UnlockResult> {
    // Check against the hash persisted at account creation so the saved code works across reloads (F1).
    if (!(await recoveryCodeMatches(code))) return { ok: false, reason: 'wrong-key' };
    const res = await this.vault.unlockWithRecoveryCode(code);
    if (res.ok) this.status = 'active';
    return res;
  }

  async signOut() {
    // Re-lock the vault AND drop the session so the route guard re-challenges (F2).
    this.status = 'none';
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
  // Generated once inside createAccount — NOT at construction — so a reload never displays a fresh
  // set of 12 words under the "shown once" framing while the real (persisted) code is a different one.
  private recoveryCode: string[] = [];
  private knownEmail: string | null = null;
  private clinicianName: string | null = null;
  private readonly hydrated: Promise<void>;

  // The Supabase client is resolved through a seam (default: the app singleton) so tests can drive
  // the already-registered branch with a stand-in client without any network or env.
  constructor(
    private readonly vault: VaultStorage,
    private readonly resolveSupabase: () => ReturnType<typeof getSupabase> = getSupabase,
  ) {
    // Hydrate the clinician name + known email so a reload attributes the sign-off (F8) and prefills
    // the right login email, never a demo default (F17).
    this.hydrated = Promise.all([
      deviceStore.get(CLINICIAN_NAME_KEY).then((v) => {
        if (v && !this.clinicianName) this.clinicianName = v;
      }),
      deviceStore.get(KNOWN_EMAIL_KEY).then((v) => {
        if (v && !this.knownEmail) this.knownEmail = v;
      }),
    ]).then(
      () => undefined,
      () => undefined,
    );
  }

  getStatus() {
    return this.status;
  }

  whenHydrated() {
    return this.hydrated;
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

  getClinicianName() {
    return this.clinicianName;
  }

  async createAccount(details: AccountDetails): Promise<{ recoveryCode: string[] }> {
    const supabase = this.resolveSupabase();
    // Ask Supabase FIRST, before minting or persisting anything. An "already registered" reply means
    // this counselor already has an account (and, on their device, a saved recovery code). Carrying on
    // would mint a NEW code and OVERWRITE the stored hash of the one they saved — silently voiding
    // their only way back in. So we STOP here: no code, no hash write, no vault unlock, no status
    // change. The genuine-new-account path below is only ever reached when signUp did NOT error.
    if (supabase) {
      const { error } = await supabase.auth.signUp({
        email: details.email,
        password: details.password,
        options: {
          data: { emiratesId: details.emiratesId, phone: details.phone, fullName: details.fullName },
        },
      });
      if (error) {
        if (/already registered|already been registered/i.test(error.message)) {
          throw new AccountExistsError(details.email);
        }
        throw new Error(error.message);
      }
    }
    // Genuine new account. Remember the identity, mint the one-time code, and persist the code's hash
    // + the clinician name + the email so recovery works, the sign-off is attributed, and login
    // prefills the right email after a reload.
    this.knownEmail = details.email;
    this.clinicianName = details.fullName;
    this.recoveryCode = generateRecoveryCode();
    await persistRecoveryHash(this.recoveryCode);
    await deviceStore.set(CLINICIAN_NAME_KEY, details.fullName);
    await deviceStore.set(KNOWN_EMAIL_KEY, details.email);
    // The recovery code is the app-side vault-key moment — unlock the local vault now.
    await this.vault.unlock(details.password);
    this.status = 'awaiting-recovery-save';
    return { recoveryCode: this.recoveryCode };
  }

  async signIn(username: string, password: string): Promise<UnlockResult> {
    const supabase = this.resolveSupabase();
    if (supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email: username.trim(), password });
      if (error) return { ok: false, reason: 'wrong-key' };
    }
    // Remember + persist the email ONLY after the credentials are accepted, so a failed attempt with
    // a mistyped email never overwrites the correct one that F17's unlock prefill relies on.
    this.knownEmail = username;
    await deviceStore.set(KNOWN_EMAIL_KEY, username);
    const res = await this.vault.unlock(password);
    if (res.ok) this.status = 'active';
    return res;
  }

  async signInWithRecoveryCode(code: string): Promise<UnlockResult> {
    // Check against the hash persisted at account creation so the saved code works across reloads (F1).
    if (!(await recoveryCodeMatches(code))) return { ok: false, reason: 'wrong-key' };
    const res = await this.vault.unlockWithRecoveryCode(code);
    if (res.ok) this.status = 'active';
    return res;
  }

  async signOut() {
    const supabase = this.resolveSupabase();
    if (supabase) await supabase.auth.signOut().catch(() => {});
    // Re-lock the vault AND drop the session so the route guard re-challenges (F2).
    this.status = 'none';
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
