/**
 * Duplicate-identity harness. Proves the two duplicate-identity guards, by running the real code
 * paths rather than by reading them.
 *
 *   1. DUPLICATE ACCOUNT never voids a saved recovery code. A returning counselor who taps "Create
 *      account" (Supabase reports the email already registered) must have createAccount STOP: no new
 *      recovery code, the persisted recovery hash UNTOUCHED, the vault NOT unlocked, no active/awaiting
 *      status — and a distinct `AccountExistsError` so the UI can route them to sign in. The
 *      genuine-new-account path still mints, persists, unlocks, and returns the code.
 *   2. DUPLICATE PATIENT within the local caseload. Emirates ID is the local uniqueness key: adding a
 *      client whose (normalised) Emirates ID already exists opens the EXISTING record and creates
 *      nothing; a novel one creates a new client; the raw typed value is stored verbatim.
 *
 * Run (Node ≥ 22.13, e.g. ~/.cache/fm-node/node-v22.23.2-darwin-arm64/bin/node):
 *   node scripts/duplicate-identity-harness.mjs
 * Exits non-zero on the first failed assertion.
 */
import { register } from 'node:module';

register('./ts-service-loader.mjs', import.meta.url);

// A localStorage shim so deviceStore's web backend actually persists in-process — this is what lets
// the harness observe that the saved recovery hash survives an already-registered createAccount.
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const { AccountExistsError, SupabaseAuthService } = await import('../src/services/auth.ts');
const { deviceStore } = await import('../src/services/deviceStore.ts');
const { clientFromSession, matchExistingClient, normalizeEmiratesId } = await import('../src/data/sessionClient.ts');

let failed = 0;
function check(name, ok, detail) {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (${detail})`}`);
}

/** Minimal VaultStorage — tracks whether it was unlocked, since the duplicate path must NOT unlock. */
function fakeVault() {
  let unlocked = false;
  return {
    isUnlocked: () => unlocked,
    unlock: async () => {
      unlocked = true;
      return { ok: true };
    },
    unlockWithRecoveryCode: async () => {
      unlocked = true;
      return { ok: true };
    },
    lock: async () => {
      unlocked = false;
    },
    read: async () => null,
    write: async () => {},
  };
}

/** A stand-in Supabase client whose signUp returns whatever result we hand it. */
function fakeSupabase(signUpResult) {
  return {
    auth: {
      signUp: async () => signUpResult,
      signInWithPassword: async () => ({ error: null }),
      signOut: async () => ({}),
      getSession: async () => ({ data: { session: null } }),
    },
  };
}

// deviceStore namespaces keys under 'aira.vault.'; the recovery hash key auth.ts persists is this one.
const RECOVERY_HASH_KEY = 'auth.recovery-hash';
const DETAILS = {
  emiratesId: '784-1988-1234567-1',
  phone: '+971 50 123 4567',
  fullName: 'Dr. Amina Okafor',
  email: 'a.okafor@clinic.ae',
  password: 'seafoam-harbor-42',
};

// --- 1. Genuine new account works end to end ------------------------------------------------------
{
  mem.clear();
  const vault = fakeVault();
  const svc = new SupabaseAuthService(vault, () => fakeSupabase({ error: null }));
  const { recoveryCode } = await svc.createAccount(DETAILS);

  check('new account: mints a 12-word recovery code', Array.isArray(recoveryCode) && recoveryCode.length === 12, JSON.stringify(recoveryCode));
  check('new account: persists the recovery hash', !!(await deviceStore.get(RECOVERY_HASH_KEY)), 'no hash stored');
  check('new account: unlocks the vault', vault.isUnlocked() === true, 'vault stayed locked');
  check('new account: status → awaiting-recovery-save', svc.getStatus() === 'awaiting-recovery-save', svc.getStatus());
  check('new account: known email persisted for the sign-in prefill', svc.getKnownEmail() === DETAILS.email, String(svc.getKnownEmail()));

  // The persisted hash IS the minted code's — the saved code unlocks. (This is exactly the credential
  // defect 1 must never silently overwrite.)
  const unlock = await svc.signInWithRecoveryCode(recoveryCode.join(' '));
  check('new account: the saved recovery code unlocks the vault', unlock.ok === true, JSON.stringify(unlock));
}

// --- 2. Duplicate account STOPS and leaves the saved recovery code intact -------------------------
{
  mem.clear();
  // A returning counselor already has a saved recovery hash on this device.
  const SAVED = 'the-counselors-saved-hash';
  await deviceStore.set(RECOVERY_HASH_KEY, SAVED);
  const vault = fakeVault();
  const svc = new SupabaseAuthService(vault, () => fakeSupabase({ error: { message: 'User already registered' } }));

  let thrown = null;
  try {
    await svc.createAccount(DETAILS);
  } catch (e) {
    thrown = e;
  }

  check('duplicate account: throws AccountExistsError', thrown instanceof AccountExistsError, String(thrown));
  check('duplicate account: the error carries the email to prefill', thrown?.email === DETAILS.email, String(thrown?.email));
  check('duplicate account: the saved recovery hash is UNTOUCHED', (await deviceStore.get(RECOVERY_HASH_KEY)) === SAVED, String(await deviceStore.get(RECOVERY_HASH_KEY)));
  check('duplicate account: the vault is NOT unlocked', vault.isUnlocked() === false, 'vault was unlocked');
  check('duplicate account: status stays none (not active/awaiting)', svc.getStatus() === 'none', svc.getStatus());
}

// --- 2b. A non-duplicate signUp failure is still a generic error (retry the form, not go sign in) --
{
  mem.clear();
  const svc = new SupabaseAuthService(fakeVault(), () => fakeSupabase({ error: { message: 'Network unreachable' } }));
  let thrown = null;
  try {
    await svc.createAccount(DETAILS);
  } catch (e) {
    thrown = e;
  }
  check('other signUp error: generic Error, NOT AccountExistsError', thrown instanceof Error && !(thrown instanceof AccountExistsError), String(thrown));
}

// --- Patient fixtures --------------------------------------------------------------------------
const DATE = '13 Aug';
const NOTE = {
  sessionLabel: 'Session 1',
  sourceLine: 'test',
  status: 'draft',
  sections: [{ id: 's', marker: 'S', title: 'Subjective', body: ['Discussed sleep and exam stress.'] }],
  measures: [],
  reviewCodes: [],
  prescriptions: [],
};

// --- 3. A new patient is created (novel Emirates ID → no match) -----------------------------------
{
  const emid = '784-1988-7654321-9';
  const match = matchExistingClient([], { name: 'Sam Ali', emiratesId: emid });
  check('new patient: no existing client matches', match === undefined, JSON.stringify(match));

  const client = clientFromSession('s-1', NOTE, { name: 'Sam Ali', sessionNumber: 1, dateLabel: DATE, emiratesId: emid });
  check('new patient: Emirates ID stored EXACTLY as typed', client.emiratesId === emid, String(client.emiratesId));
}

// --- 4. A duplicate Emirates ID opens the existing record and creates nothing ---------------------
{
  const existing = clientFromSession('s-1', NOTE, {
    name: 'Sam Ali',
    sessionNumber: 1,
    dateLabel: DATE,
    emiratesId: '784-1988-1234567-1',
  });
  const caseload = [existing];

  // Same ID, different formatting (spaces for dashes, stray padding) AND a different typed name — the
  // Emirates ID is the key, so it must still resolve to the existing record.
  const match = matchExistingClient(caseload, { name: 'A Different Name', emiratesId: ' 784 1988 1234567 1 ' });
  check('duplicate patient: matched by Emirates ID', match?.matchedBy === 'emiratesId', JSON.stringify(match));
  check('duplicate patient: opens the EXISTING record', match?.client?.id === existing.id, String(match?.client?.id));
  check('normalizeEmiratesId collapses separators + case', normalizeEmiratesId('784-1988-1234567-1') === normalizeEmiratesId(' 784 1988 1234567 1 '), 'keys differ');
}

// --- Priority + guards: id beats Emirates ID; a blank Emirates ID is never a match key -------------
{
  const a = clientFromSession('s-a', NOTE, { name: 'A', sessionNumber: 1, dateLabel: DATE, emiratesId: '111-1' });
  const b = clientFromSession('s-b', NOTE, { name: 'B', sessionNumber: 1, dateLabel: DATE, emiratesId: '222-2' });
  check('priority: an explicit clientId matches by id', matchExistingClient([a, b], { clientId: 's-b', emiratesId: '111-1' })?.matchedBy === 'id', 'id did not win');
  check('guard: a blank/whitespace Emirates ID is not a match key', matchExistingClient([a, b], { emiratesId: '   ' }) === undefined, 'blank matched');
  check('guard: an Emirates ID with no caseload match falls through', matchExistingClient([a, b], { emiratesId: '999-9' }) === undefined, 'phantom match');
}

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
