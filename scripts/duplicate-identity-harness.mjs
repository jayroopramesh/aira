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
 *   2. DUPLICATE PATIENT within the local caseload. A WELL-FORMED Emirates ID is the local uniqueness
 *      key: adding a client whose (normalised) Emirates ID already exists opens the EXISTING record and
 *      creates nothing; a novel one creates a new client; the raw typed value is stored verbatim. The
 *      governing rule is that a strong identifier always decides and a weak one never merges two
 *      patients — so a valid id resolves by id ALONE (the name fold is vetoed in BOTH directions:
 *      against a record storing a different id and against one storing none), the veto is REPORTED
 *      rather than silently forking the caseload, and a malformed entry ("N/A", a partial number) is no
 *      identity at all: it is neither stored nor matched on, and the capture falls back to name folding.
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
const {
  appendSessionToClient,
  clientFromSession,
  findNameConflict,
  isValidEmiratesId,
  matchExistingClient,
  normalizeEmiratesId,
} = await import('../src/data/sessionClient.ts');

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
// The credential the unguarded MOCK path actually destroyed: its recovery hash is deterministic (the
// RECOVERY_WORDS constant through an unsalted fnv1a), so a second createAccount rewrote an IDENTICAL
// recovery hash — but PASSWORD_HASH_KEY took the second attempt's password and the counselor's real
// password stopped opening signIn.
const PASSWORD_HASH_KEY = 'auth.password-hash';
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
  // counselor taps "Create an account" again instead of "Sign in", with a DIFFERENT password typed in.
  const savedHash = await deviceStore.get(RECOVERY_HASH_KEY);
  const savedPasswordHash = await deviceStore.get(PASSWORD_HASH_KEY);
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
  // THE credential this guard saves on the mock path — it is the password hash that a second
  // createAccount overwrote (the recovery hash is deterministic, so rewriting it changed nothing).
  check('mock duplicate account: the saved PASSWORD hash is UNTOUCHED', (await deviceStore.get(PASSWORD_HASH_KEY)) === savedPasswordHash, String(await deviceStore.get(PASSWORD_HASH_KEY)));
  check('mock duplicate account: the vault is NOT unlocked', vault2.isUnlocked() === false, 'vault was unlocked');
  check('mock duplicate account: status stays none (not active/awaiting)', svc2.getStatus() === 'none', svc2.getStatus());
  // The observable consequence: the counselor's ORIGINAL password still opens signIn afterwards.
  const vault3 = fakeVault();
  const svc3 = new MockAuthService(vault3);
  const signedIn = await svc3.signIn(DETAILS.email, DETAILS.password);
  check('mock duplicate account: the ORIGINAL password still signs in', signedIn.ok === true, JSON.stringify(signedIn));
  // And the saved recovery code still unlocks.
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
  check(
    'a MALFORMED entry is no identifier: the name fold is unchanged',
    matchExistingClient(caseload, { name: 'Ahmed Ali', emiratesId: 'N/A' })?.matchedBy === 'name',
    'malformed entry changed the fold',
  );

  // The veto must never be SILENT: the same refusal that mints a separate record is reported, so the
  // counselor is told why two same-named rows now exist instead of being left to guess at a typo.
  const conflict = findNameConflict(caseload, { name: 'Ahmed Ali', emiratesId: '784-1988-2222222-2' });
  check('conflict notice: the vetoed same-name record is reported', conflict?.id === 's-1', JSON.stringify(conflict));
  check('conflict notice: it names the client the counselor already sees', conflict?.name === 'Ahmed Ali', String(conflict?.name));
  check('conflict notice: the existing client is still left untouched', JSON.stringify(caseload[0]) === before, 'existing record mutated');

  // ...and it must stay quiet whenever there is nothing to explain.
  check(
    'conflict notice: silent when the Emirates IDs MATCH (that folds)',
    findNameConflict(caseload, { name: 'Ahmed Ali', emiratesId: ' 784 1988 1111111 1 ' }) === undefined,
    'flagged a matching id',
  );
  check(
    'conflict notice: silent when the NAME differs',
    findNameConflict(caseload, { name: 'Someone Else', emiratesId: '784-1988-2222222-2' }) === undefined,
    'flagged a different name',
  );
  check(
    'conflict notice: silent when the capture supplies NO Emirates ID',
    findNameConflict(caseload, { name: 'Ahmed Ali' }) === undefined && findNameConflict(caseload, { name: 'Ahmed Ali', emiratesId: '  ' }) === undefined,
    'flagged with no supplied id',
  );
  check(
    'conflict notice: silent when the entry is MALFORMED (no identifier was supplied)',
    findNameConflict(caseload, { name: 'Ahmed Ali', emiratesId: 'N/A' }) === undefined,
    'a placeholder produced a conflict',
  );

  // The veto and the notice are exact complements — every same-named candidate the fold refuses is one
  // the notice can name, so the app can never refuse to fold for a reason it then fails to explain.
  const supplied = '784-1988-2222222-2';
  check(
    'conflict notice: fires exactly when the name fold was vetoed',
    matchExistingClient(caseload, { name: 'Ahmed Ali', emiratesId: supplied }) === undefined &&
      !!findNameConflict(caseload, { name: 'Ahmed Ali', emiratesId: supplied }),
    'veto and notice disagree',
  );
}

// --- 6. The MIRROR direction: a valid id never folds into a same-named record holding none ---------
// The counselor typed the id precisely to distinguish two people who share a name. Folding would merge
// strangers' notes/plan/timeline and carry one patient's risk tier onto the other.
{
  const first = clientFromSession('s-1', NOTE, { name: 'Sam Ali', sessionNumber: 1, dateLabel: DATE });
  check('mirror: the earlier capture stored no Emirates ID', first.emiratesId === undefined, String(first.emiratesId));
  const before = JSON.stringify(first);

  const emid = '784-1988-1234567-1';
  const match = matchExistingClient([first], { name: 'Sam Ali', emiratesId: emid });
  check('mirror: the name fold is VETOED (a new record would be minted)', match === undefined, JSON.stringify(match));
  check('mirror: the existing client is left untouched', JSON.stringify(first) === before, 'existing record mutated');
  const conflict = findNameConflict([first], { name: 'Sam Ali', emiratesId: emid });
  check('mirror: the notice fires so the second row is explained', conflict?.id === 's-1', JSON.stringify(conflict));

  // The identity takes hold through the record this capture MINTS, not by writing onto someone else's:
  // a later capture with that id — under any spelling of the name — resolves to it.
  const minted = clientFromSession('s-2', NOTE, { name: 'Sam Ali', sessionNumber: 1, dateLabel: DATE, emiratesId: emid });
  const later = matchExistingClient([first, minted], { name: 'S. Ali', emiratesId: ' 784 1988 1234567 1 ' });
  check('mirror: a later same-id capture resolves by Emirates ID', later?.matchedBy === 'emiratesId', JSON.stringify(later));
  check('mirror: it lands on the id-carrying record, not the ID-less namesake', later?.client?.id === 's-2', String(later?.client?.id));

  // Folding writes no Emirates ID onto a record — that is how one patient's id got stamped on another's.
  const folded = appendSessionToClient(first, NOTE, { sessionNumber: 2, dateLabel: DATE });
  check('mirror: a name-fold never records an Emirates ID', folded.emiratesId === undefined, String(folded.emiratesId));
}

// --- 7. A malformed entry is not an identity — it can never merge two patients ---------------------
{
  check('valid id: a well-formed Emirates ID is accepted', isValidEmiratesId('784-1988-1234567-1') === true, 'rejected a valid id');
  check('valid id: formatting is irrelevant', isValidEmiratesId(' 784 1988 1234567 1 ') === true, 'rejected an unformatted valid id');
  check(
    'valid id: placeholders and partials are REJECTED',
    ['N/A', 'n/a', 'unknown', '784', '784-1988', '', '   ', '784-1988-1234567-12'].every((v) => isValidEmiratesId(v) === false),
    'a placeholder passed validation',
  );

  // The failure this prevents: two unrelated patients whose counselor typed the same placeholder.
  const a = clientFromSession('s-a', NOTE, { name: 'Patient A', sessionNumber: 1, dateLabel: DATE, emiratesId: 'N/A' });
  check('malformed id: is NOT stored as this patient’s identity', a.emiratesId === undefined, String(a.emiratesId));
  const match = matchExistingClient([a], { name: 'Patient B', emiratesId: 'n/a' });
  check('malformed id: a second patient typing the same placeholder never matches', match === undefined, JSON.stringify(match));
  check(
    'malformed id: nor does it match a record that stored one before validation',
    matchExistingClient([{ ...a, emiratesId: 'N/A' }], { name: 'Patient B', emiratesId: 'n/a' }) === undefined,
    'legacy placeholder matched',
  );
  check(
    'malformed id: a truncated number never matches a full one',
    matchExistingClient(
      [clientFromSession('s-c', NOTE, { name: 'C', sessionNumber: 1, dateLabel: DATE, emiratesId: '784-1988-1234567-1' })],
      { name: 'D', emiratesId: '784-1988' },
    ) === undefined,
    'a partial matched',
  );
}

// --- Priority + guards: id beats Emirates ID; a blank Emirates ID is never a match key -------------
{
  const a = clientFromSession('s-a', NOTE, { name: 'A', sessionNumber: 1, dateLabel: DATE, emiratesId: '784-1111-1111111-1' });
  const b = clientFromSession('s-b', NOTE, { name: 'B', sessionNumber: 1, dateLabel: DATE, emiratesId: '784-2222-2222222-2' });
  check('priority: an explicit clientId matches by id', matchExistingClient([a, b], { clientId: 's-b', emiratesId: '784-1111-1111111-1' })?.matchedBy === 'id', 'id did not win');
  check('guard: a blank/whitespace Emirates ID is not a match key', matchExistingClient([a, b], { emiratesId: '   ' }) === undefined, 'blank matched');
  check('guard: an Emirates ID with no caseload match falls through', matchExistingClient([a, b], { emiratesId: '784-9999-9999999-9' }) === undefined, 'phantom match');
}

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
