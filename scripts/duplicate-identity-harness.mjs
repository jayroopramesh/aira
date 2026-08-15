/**
 * Duplicate-identity harness. Proves the two duplicate-identity guards, by running the real code
 * paths rather than by reading them.
 *
 *   1. DUPLICATE ACCOUNT never voids a saved recovery code. A returning counselor who taps "Create
 *      account" (Supabase reports the email already registered) must have createAccount STOP: no new
 *      recovery code, the persisted recovery hash UNTOUCHED, the vault NOT unlocked, no active/awaiting
 *      status — and a distinct `AccountExistsError` so the UI can route them to sign in. The
 *      genuine-new-account path still mints, persists, unlocks, and returns the code. The SAME rule
 *      holds on the keyless build (`MockAuthService`), where a persisted recovery hash is the evidence.
 *   2. DUPLICATE PATIENT within the local caseload. Emirates ID is the local uniqueness key: adding a
 *      client whose (normalised) Emirates ID already exists opens the EXISTING record and creates
 *      nothing; a novel one creates a new client; the raw typed value is stored verbatim. A CONFLICTING
 *      Emirates ID beats a name match (two different people never merge), and folding backfills a
 *      supplied Emirates ID onto a record that has none, so the key takes hold for the next capture.
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

const { AccountExistsError, MockAuthService, SupabaseAuthService } = await import('../src/services/auth.ts');
const { deviceStore } = await import('../src/services/deviceStore.ts');
const { appendSessionToClient, clientFromSession, matchExistingClient, normalizeEmiratesId } = await import(
  '../src/data/sessionClient.ts'
);

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

// --- 2c. The KEYLESS build obeys the same rule (MockAuthService) ----------------------------------
// A genuine first account still works end to end; a second createAccount on a device that already
// holds a recovery hash STOPS instead of overwriting the counselor's saved code.
{
  mem.clear();
  const vault = fakeVault();
  const svc = new MockAuthService(vault);
  const { recoveryCode } = await svc.createAccount(DETAILS);

  check('mock first account: mints a 12-word recovery code', Array.isArray(recoveryCode) && recoveryCode.length === 12, JSON.stringify(recoveryCode));
  check('mock first account: persists the recovery hash', !!(await deviceStore.get(RECOVERY_HASH_KEY)), 'no hash stored');
  check('mock first account: status → awaiting-recovery-save', svc.getStatus() === 'awaiting-recovery-save', svc.getStatus());
  const unlock = await svc.signInWithRecoveryCode(recoveryCode.join(' '));
  check('mock first account: the saved recovery code unlocks the vault', unlock.ok === true && vault.isUnlocked() === true, JSON.stringify(unlock));

  // Reload: a fresh service + fresh vault over the SAME device store, as after a page refresh. The
  // counselor taps "Create an account" again instead of "Sign in".
  const savedHash = await deviceStore.get(RECOVERY_HASH_KEY);
  const vault2 = fakeVault();
  const svc2 = new MockAuthService(vault2);
  let thrown = null;
  try {
    await svc2.createAccount({ ...DETAILS, password: 'a-totally-different-password' });
  } catch (e) {
    thrown = e;
  }

  check('mock duplicate account: throws AccountExistsError', thrown instanceof AccountExistsError, String(thrown));
  check('mock duplicate account: the error carries the email to prefill', thrown?.email === DETAILS.email, String(thrown?.email));
  check('mock duplicate account: the saved recovery hash is UNTOUCHED', (await deviceStore.get(RECOVERY_HASH_KEY)) === savedHash, String(await deviceStore.get(RECOVERY_HASH_KEY)));
  check('mock duplicate account: the vault is NOT unlocked', vault2.isUnlocked() === false, 'vault was unlocked');
  check('mock duplicate account: status stays none (not active/awaiting)', svc2.getStatus() === 'none', svc2.getStatus());
  // The credential that matters: the code the counselor saved still opens the vault afterwards.
  const stillWorks = await svc2.signInWithRecoveryCode(recoveryCode.join(' '));
  check('mock duplicate account: the ORIGINAL saved code still unlocks', stillWorks.ok === true, JSON.stringify(stillWorks));
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

// --- 5. A CONFLICTING Emirates ID beats a name match — two different people never merge -----------
{
  const existing = clientFromSession('s-1', NOTE, {
    name: 'Ahmed Ali',
    sessionNumber: 1,
    dateLabel: DATE,
    emiratesId: '784-1988-1111111-1',
  });
  const caseload = [existing];
  const before = JSON.stringify(existing);

  // Same typed name, a DIFFERENT Emirates ID: a different person, so nothing may fold.
  const match = matchExistingClient(caseload, { name: 'Ahmed Ali', emiratesId: '784-1988-2222222-2' });
  check('conflicting id: name match is VETOED (a new record would be minted)', match === undefined, JSON.stringify(match));
  check('conflicting id: the existing client is left untouched', JSON.stringify(caseload[0]) === before, 'existing record mutated');

  // Guardrails on the veto: the SAME id (differently formatted) still folds by name, and a capture
  // supplying no Emirates ID folds by name exactly as before.
  check(
    'matching id + same name: still folds',
    matchExistingClient(caseload, { name: 'Ahmed Ali', emiratesId: ' 784 1988 1111111 1 ' })?.client?.id === 's-1',
    'same-id fold broke',
  );
  check(
    'no Emirates ID supplied: the name fold is unchanged',
    matchExistingClient(caseload, { name: 'Ahmed Ali' })?.matchedBy === 'name',
    'name fold broke',
  );
}

// --- 6. Folding BACKFILLS the uniqueness key onto a record that had none ---------------------------
{
  // Captured first with no Emirates ID at all.
  const first = clientFromSession('s-1', NOTE, { name: 'Sam Ali', sessionNumber: 1, dateLabel: DATE });
  check('backfill: the first capture stored no Emirates ID', first.emiratesId === undefined, String(first.emiratesId));

  // Second capture, same name, this time WITH the Emirates ID — folds by name.
  const emid = '784-1988-1234567-1';
  const match = matchExistingClient([first], { name: 'Sam Ali', emiratesId: emid });
  check('backfill: the second capture folds by name', match?.matchedBy === 'name', JSON.stringify(match));

  const folded = appendSessionToClient(match.client, NOTE, { sessionNumber: 2, dateLabel: DATE, emiratesId: emid });
  check('backfill: the supplied Emirates ID lands on the existing record, verbatim', folded.emiratesId === emid, String(folded.emiratesId));

  // The point of recording it: a LATER capture spelling the name differently, with that same id in
  // another format, now resolves to the existing record instead of minting a duplicate.
  const later = matchExistingClient([folded], { name: 'S. Ali', emiratesId: ' 784 1988 1234567 1 ' });
  check('backfill: a differently-named later capture now matches by Emirates ID', later?.matchedBy === 'emiratesId', JSON.stringify(later));
  check('backfill: it resolves to the SAME record (no duplicate minted)', later?.client?.id === 's-1', String(later?.client?.id));

  // An Emirates ID already on the record is never overwritten by a later capture's value.
  const kept = appendSessionToClient(folded, NOTE, { sessionNumber: 3, dateLabel: DATE, emiratesId: '999-9999-9999999-9' });
  check('backfill: an already-stored Emirates ID is NEVER overwritten', kept.emiratesId === emid, String(kept.emiratesId));

  // No id supplied → the record keeps whatever it had (including nothing).
  const noneSupplied = appendSessionToClient(first, NOTE, { sessionNumber: 2, dateLabel: DATE });
  check('backfill: no supplied id leaves the record without one', noneSupplied.emiratesId === undefined, String(noneSupplied.emiratesId));
  const blankSupplied = appendSessionToClient(first, NOTE, { sessionNumber: 2, dateLabel: DATE, emiratesId: '   ' });
  check('backfill: a whitespace-only entry is never recorded as a key', blankSupplied.emiratesId === undefined, String(blankSupplied.emiratesId));
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
