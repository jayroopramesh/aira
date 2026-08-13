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
 *
 * v1 ships `LocalVaultStorage`: still NO crypto (records are stored as plaintext blobs), but it
 * now PERSISTS records device-locally through `deviceStore` (localStorage on web / a JSON file on
 * native) so notes, transcripts and prescriptions survive a reload. The real Argon2id vault slots
 * in behind the same interface and simply encrypts these same blobs.
 */

import { deviceStore } from './deviceStore';

export type UnlockResult = { ok: true } | { ok: false; reason: 'wrong-key' | 'locked-out' };

export interface VaultStorage {
  /** Whether a vault exists on this device (first-run vs returning). */
  isInitialised(): Promise<boolean>;
  /** Whether the vault is currently open (key held in memory). */
  isUnlocked(): boolean;
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
 * Base64 <-> bytes, so binary blobs round-trip through the string-only deviceStore. Uses the
 * platform btoa/atob when present (web + modern RN), with a small self-contained fallback so the
 * bundle never depends on Node's Buffer.
 */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBinary(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return bin;
}

function encodeB64(bin: string): string {
  const g = globalThis as { btoa?: (s: string) => string };
  if (typeof g.btoa === 'function') return g.btoa(bin);
  let out = '';
  for (let i = 0; i < bin.length; i += 3) {
    const a = bin.charCodeAt(i);
    const b = i + 1 < bin.length ? bin.charCodeAt(i + 1) : NaN;
    const c = i + 2 < bin.length ? bin.charCodeAt(i + 2) : NaN;
    out += B64[a >> 2] + B64[((a & 3) << 4) | (isNaN(b) ? 0 : b >> 4)];
    out += isNaN(b) ? '=' : B64[((b & 15) << 2) | (isNaN(c) ? 0 : c >> 6)];
    out += isNaN(c) ? '=' : B64[c & 63];
  }
  return out;
}

function decodeB64(b64: string): string {
  const g = globalThis as { atob?: (s: string) => string };
  if (typeof g.atob === 'function') return g.atob(b64);
  const clean = b64.replace(/=+$/, '');
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    buffer = (buffer << 6) | B64.indexOf(clean[i]);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  return encodeB64(bytesToBinary(bytes));
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = decodeB64(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * The device-local vault. No crypto yet (locked scope) — it flips the in-memory unlocked flag and
 * persists each record as a base64 blob under `deviceStore`. Acceptance (whether a password is
 * correct) is decided in the AuthService; this layer just holds and persists the bytes.
 */
export class LocalVaultStorage implements VaultStorage {
  private unlocked = false;

  async isInitialised() {
    return true;
  }

  isUnlocked() {
    return this.unlocked;
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

  async read(recordId: string): Promise<Uint8Array | null> {
    if (!this.unlocked) throw new Error('vault locked');
    const b64 = await deviceStore.get(recordId);
    return b64 == null ? null : b64ToBytes(b64);
  }

  async write(recordId: string, data: Uint8Array): Promise<void> {
    if (!this.unlocked) throw new Error('vault locked');
    await deviceStore.set(recordId, bytesToB64(data));
  }

  async exportVault(): Promise<Uint8Array> {
    return new Uint8Array();
  }

  async importVault(): Promise<void> {
    /* no-op until the real Argon2id vault lands */
  }
}

export const vaultStorage: VaultStorage = new LocalVaultStorage();
