/**
 * deviceStore — the on-device key/value persistence primitive.
 *
 * This is the physical layer the encrypted vault (VaultStorage) writes through. It never talks to
 * a server: patient data stays on the counselor's device. Platform split:
 *   • Web    — window.localStorage (survives reload; the demo's screenshot target).
 *   • Native — a JSON file per key under the app document directory (expo-file-system).
 *
 * Values are opaque strings (the vault hands us its encoded blobs). Missing keys resolve to null.
 */

import { Platform } from 'react-native';

const NS = 'aira.vault.';

interface KvBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/* --------------------------------------------------------------------- web --- */

const webBackend: KvBackend = {
  async get(key) {
    try {
      return globalThis.localStorage?.getItem(NS + key) ?? null;
    } catch {
      return null;
    }
  },
  async set(key, value) {
    try {
      globalThis.localStorage?.setItem(NS + key, value);
    } catch {
      /* quota / private-mode — persistence is best-effort in the demo */
    }
  },
  async remove(key) {
    try {
      globalThis.localStorage?.removeItem(NS + key);
    } catch {
      /* ignore */
    }
  },
};

/* ------------------------------------------------------------------ native --- */

/**
 * Lazily require expo-file-system so the web bundle never pulls the native module. One small JSON
 * file per key under the document directory. SDK 57 moved this API behind the /legacy entry — the
 * main entry's *Async functions are throwing deprecation shims and no longer export
 * documentDirectory.
 */
function nativeBackend(): KvBackend {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const FS = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
  const dir = FS.documentDirectory ?? '';
  const path = (key: string) => `${dir}${NS}${encodeURIComponent(key)}.json`;

  return {
    async get(key) {
      try {
        const info = await FS.getInfoAsync(path(key));
        if (!info.exists) return null;
        return await FS.readAsStringAsync(path(key));
      } catch {
        return null;
      }
    },
    async set(key, value) {
      try {
        await FS.writeAsStringAsync(path(key), value);
      } catch {
        /* ignore — best-effort */
      }
    },
    async remove(key) {
      try {
        await FS.deleteAsync(path(key), { idempotent: true });
      } catch {
        /* ignore */
      }
    },
  };
}

let backend: KvBackend | null = null;
function kv(): KvBackend {
  if (backend) return backend;
  backend = Platform.OS === 'web' ? webBackend : nativeBackend();
  return backend;
}

export const deviceStore = {
  get: (key: string) => kv().get(key),
  set: (key: string, value: string) => kv().set(key, value),
  remove: (key: string) => kv().remove(key),
};
