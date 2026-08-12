/**
 * VaultStorage — the encrypted-vault contract seam.
 *
 * v1 does NOT implement crypto (locked scope). But all patient-record persistence is
 * routed through this interface so the real vault slots in without touching callers:
 *
 *   • Argon2id password → key envelope (unlock derives the key; nothing is stored plaintext)
 *   • One-time recovery code — the self-service path back in when the password is lost
 *   • Export / import of the encrypted vault
 *
 * The account + session lifecycle (create account, one-time recovery reveal, sign-in,
 * wrong-password) lives in the AuthService seam (services/auth.ts), which delegates the
 * actual vault open to this contract. The recovery-key policy is captain-resolved
 * (decision-recovery-key-policy): all recovery-related copy is isolated in
 * strings/recovery.ts.
 */

export type UnlockResult = { ok: true } | { ok: false; reason: 'wrong-key' | 'locked-out' };

export interface VaultStorage {
  /** Whether a vault exists on this device (first-run vs returning). */
  isInitialised(): Promise<boolean>;
  /** Derive the key from the login password and open the vault (no plaintext stored). */
  unlock(password: string): Promise<UnlockResult>;
  /** Open the vault using the saved recovery code — the path when the password is lost. */
  unlockWithRecoveryCode(code: string): Promise<UnlockResult>;
  /** Lock the vault (drop the in-memory key). */
  lock(): Promise<void>;
  /** Read/write an opaque encrypted blob for a record id. */
  read(recordId: string): Promise<Uint8Array | null>;
  write(recordId: string, data: Uint8Array): Promise<void>;
  /** Export the whole encrypted vault (for backup / device migration). */
  exportVault(): Promise<Uint8Array>;
  importVault(data: Uint8Array): Promise<void>;
}

/**
 * A mock that lets the unlock flow render and demo without any crypto. Sign-in acceptance
 * is decided in the AuthService (services/auth.ts); this mock simply flips the in-memory
 * unlocked flag. Intentionally NOT secure — replaced by the real Argon2id vault later.
 */
export class MockVaultStorage implements VaultStorage {
  private unlocked = false;
  private store = new Map<string, Uint8Array>();

  async isInitialised() {
    return true;
  }
  async unlock(_password: string): Promise<UnlockResult> {
    this.unlocked = true;
    return { ok: true };
  }
  async unlockWithRecoveryCode(): Promise<UnlockResult> {
    this.unlocked = true;
    return { ok: true };
  }
  async lock() {
    this.unlocked = false;
  }
  async read(recordId: string) {
    if (!this.unlocked) throw new Error('vault locked');
    return this.store.get(recordId) ?? null;
  }
  async write(recordId: string, data: Uint8Array) {
    if (!this.unlocked) throw new Error('vault locked');
    this.store.set(recordId, data);
  }
  async exportVault() {
    return new Uint8Array();
  }
  async importVault() {
    /* no-op mock */
  }
}

export const vaultStorage: VaultStorage = new MockVaultStorage();
