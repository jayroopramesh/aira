/**
 * VaultStorage — the encrypted-vault contract seam.
 *
 * v1 does NOT implement crypto (locked scope). But all patient-record persistence is
 * routed through this interface so the real vault slots in without touching callers:
 *
 *   • Argon2id password → key envelope (unlock derives the key; nothing is stored plaintext)
 *   • Recovery-file model (aira-recovery.key) — the ONLY other way in
 *   • Export / import of the encrypted vault
 *
 * The recovery-key policy itself is an OPEN captain decision
 * (backlog: aira-ui-screens-s4-decision-recovery-key-policy). See strings/recovery.ts —
 * all recovery-related copy is isolated there and must not be built beyond the depicted
 * screens until the captain rules.
 */

export type UnlockResult = { ok: true } | { ok: false; reason: 'wrong-key' | 'locked-out' };

export interface VaultStorage {
  /** Whether a vault exists on this device (first-run vs returning). */
  isInitialised(): Promise<boolean>;
  /** Derive the key from the passcode and attempt to open the vault (no plaintext stored). */
  unlock(passcode: string): Promise<UnlockResult>;
  /** Open the vault using a recovery file — the only path when the passcode is lost. */
  unlockWithRecoveryFile(fileContents: string): Promise<UnlockResult>;
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
 * A mock that lets the unlock flow render and demo without any crypto. It accepts any
 * 6-digit passcode as correct EXCEPT the sentinel used to demo the wrong-key screen.
 * This is intentionally NOT secure and must be replaced by the real Argon2id vault.
 */
export class MockVaultStorage implements VaultStorage {
  private unlocked = false;
  private store = new Map<string, Uint8Array>();

  async isInitialised() {
    return true;
  }
  async unlock(passcode: string): Promise<UnlockResult> {
    // Demo rule: "000000" reproduces the calm wrong-key state; anything else opens.
    if (passcode === '000000') return { ok: false, reason: 'wrong-key' };
    this.unlocked = true;
    return { ok: true };
  }
  async unlockWithRecoveryFile(): Promise<UnlockResult> {
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
