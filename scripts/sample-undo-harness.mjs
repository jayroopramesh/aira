/**
 * Sample-undo harness (captain feedback round 2, item 4). Proves `computeSampleUndo` — "Undo sample
 * data" in Settings — removes exactly the untouched sample cohort, NEVER touches a client the counselor
 * created themselves, and KEEPS (rather than silently destroying) a sample client the counselor added a
 * real session or a patient-details edit to since loading.
 *
 * Run (Node ≥ 22.13, e.g. ~/.cache/fm-node/node-v22.23.2-darwin-arm64/bin/node):
 *   node --experimental-strip-types scripts/sample-undo-harness.mjs
 * Exits non-zero on the first failed assertion.
 */
import { computeSampleUndo } from '../src/data/undoSample.ts';

// A local stand-in for repository.ts's EMPTY_SNAPSHOT — importing the real module would pull in
// services/storage.ts → deviceStore.ts → `react-native`, which needs Metro/RN, not plain Node.
const EMPTY_SNAPSHOT = { clients: [], dayDashboard: null, caseloadKpis: [], notes: {}, patientDetails: {}, sampleLoaded: false };

let failed = 0;
function check(name, ok, detail) {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (${detail})`}`);
}

function sampleClient(id) {
  return { id, name: `Sample ${id}`, initials: 'S', tokenId: `tok-${id}`, age: 30, status: 'active', risk: 'clear', clientSince: '1 Jan', sessionNumber: 1, lastSessionLabel: '1 Jan', followUp: 'On track', latestScore: 5, sparkline: [], focusTags: [], summaryLine: '', measures: [], timeline: [], lastPlan: [], sampleOrigin: true };
}
function userClient(id) {
  return { ...sampleClient(id), sampleOrigin: false, id, name: `User ${id}` };
}
function sampleNote(sessionLabel) {
  return { sessionLabel, sourceLine: 'sample', status: 'signed', sections: [], measures: [], reviewCodes: [], prescriptions: [], sampleOrigin: true };
}
function userNote(sessionLabel) {
  return { sessionLabel, sourceLine: 'captured', status: 'draft', sections: [], measures: [], reviewCodes: [], prescriptions: [] };
}

// --- A user-created client (no sampleOrigin) is never touched, even if its id collides in shape ---
{
  const snap = { ...EMPTY_SNAPSHOT, clients: [userClient('u1')], notes: { u1: [userNote('Session 1')] }, sampleLoaded: false };
  const { snapshot, removedClients, keptWithUserData } = computeSampleUndo(snap);
  check('a user-created client is untouched', snapshot.clients.length === 1 && snapshot.clients[0].id === 'u1');
  check('its notes are untouched', snapshot.notes.u1.length === 1);
  check('no removal/keep counted for a non-sample client', removedClients === 0 && keptWithUserData === 0);
}

// --- An untouched sample client (only sample notes, no details edit) is removed entirely ---
{
  const snap = {
    ...EMPTY_SNAPSHOT,
    clients: [sampleClient('amara')],
    notes: { amara: [sampleNote('Session 5'), sampleNote('Session 4')] },
    patientDetails: {},
    sampleLoaded: true,
  };
  const { snapshot, removedClients, keptWithUserData } = computeSampleUndo(snap);
  check('untouched sample client is removed', snapshot.clients.length === 0, JSON.stringify(snapshot.clients));
  check('its notes are removed too', snapshot.notes.amara === undefined);
  check('counted as removed, not kept', removedClients === 1 && keptWithUserData === 0);
}

// --- A sample client the counselor captured a REAL session against is kept, sample notes stripped ---
{
  const snap = {
    ...EMPTY_SNAPSHOT,
    clients: [sampleClient('amara')],
    notes: { amara: [userNote('Session 6 — captured'), sampleNote('Session 5'), sampleNote('Session 4')] },
    patientDetails: {},
    sampleLoaded: true,
  };
  const { snapshot, removedClients, keptWithUserData } = computeSampleUndo(snap);
  check('a client with a real captured session is KEPT, not removed', snapshot.clients.length === 1 && snapshot.clients[0].id === 'amara', JSON.stringify(snapshot.clients));
  check('only the sample-authored notes are stripped', snapshot.notes.amara.length === 1 && snapshot.notes.amara[0].sessionLabel === 'Session 6 — captured', JSON.stringify(snapshot.notes.amara));
  check('the real captured note text/status is untouched', snapshot.notes.amara[0].status === 'draft');
  check('counted as kept, not removed', removedClients === 0 && keptWithUserData === 1);
}

// --- A sample client with only a patient-details edit (no captured session) is also kept ---
{
  const snap = {
    ...EMPTY_SNAPSHOT,
    clients: [sampleClient('leah')],
    notes: { leah: [sampleNote('Session 8')] },
    patientDetails: { leah: { extra: 'Prefers afternoon slots' } },
    sampleLoaded: true,
  };
  const { snapshot, removedClients, keptWithUserData } = computeSampleUndo(snap);
  check('a sample client with a details edit is kept', snapshot.clients.length === 1, JSON.stringify(snapshot.clients));
  check('its patient-details edit survives', snapshot.patientDetails.leah?.extra === 'Prefers afternoon slots');
  // No user-authored note exists here, so the (now-orphaned) sample note is stripped along with the rest.
  check('its sample notes are stripped (no user note to keep)', (snapshot.notes.leah ?? []).length === 0, JSON.stringify(snapshot.notes.leah));
  check('counted as kept', keptWithUserData === 1 && removedClients === 0);
}

// --- An empty patientDetails entry ({} / blank strings) does NOT count as an edit ---
{
  const snap = {
    ...EMPTY_SNAPSHOT,
    clients: [sampleClient('daniel')],
    notes: { daniel: [sampleNote('Session 2')] },
    patientDetails: { daniel: { values: ['', '  '], extra: '   ' } },
    sampleLoaded: true,
  };
  const { snapshot, removedClients, keptWithUserData } = computeSampleUndo(snap);
  check('a blank/whitespace-only patientDetails entry does not count as an edit', snapshot.clients.length === 0, JSON.stringify(snapshot.clients));
  check('removed, not kept', removedClients === 1 && keptWithUserData === 0);
}

// --- Mixed caseload: one untouched sample, one touched sample, one user client — nothing bleeds across ---
{
  const snap = {
    ...EMPTY_SNAPSHOT,
    clients: [sampleClient('untouched'), sampleClient('touched'), userClient('mine')],
    notes: {
      untouched: [sampleNote('Session 3')],
      touched: [userNote('Session new'), sampleNote('Session 3')],
      mine: [userNote('Session 1')],
    },
    sampleLoaded: true,
  };
  const { snapshot, removedClients, keptWithUserData } = computeSampleUndo(snap);
  const ids = snapshot.clients.map((c) => c.id).sort();
  check('exactly the untouched sample client is removed; touched sample + user client survive', JSON.stringify(ids) === JSON.stringify(['mine', 'touched']), JSON.stringify(ids));
  check('the user client keeps its own note untouched', snapshot.notes.mine.length === 1);
  check('the touched sample client keeps only its real note', snapshot.notes.touched.length === 1 && snapshot.notes.touched[0].sessionLabel === 'Session new');
  check('counts: 1 removed, 1 kept', removedClients === 1 && keptWithUserData === 1, `removed=${removedClients} kept=${keptWithUserData}`);
}

// --- sampleLoaded reflects whether any sample-origin record still remains ---
{
  const allRemoved = computeSampleUndo({ ...EMPTY_SNAPSHOT, clients: [sampleClient('a')], notes: { a: [sampleNote('S1')] }, sampleLoaded: true });
  check('sampleLoaded → false once every sample record is gone', allRemoved.snapshot.sampleLoaded === false);
  const oneKept = computeSampleUndo({ ...EMPTY_SNAPSHOT, clients: [sampleClient('a')], notes: { a: [userNote('S2'), sampleNote('S1')] }, sampleLoaded: true });
  check('sampleLoaded stays true while a touched sample record remains', oneKept.snapshot.sampleLoaded === true);
}

// --- Idempotent / safe on a snapshot with no sample data at all ---
{
  const snap = { ...EMPTY_SNAPSHOT, clients: [userClient('u')], notes: { u: [userNote('S1')] }, sampleLoaded: false };
  const { snapshot, removedClients, keptWithUserData } = computeSampleUndo(snap);
  check('running undo with no sample data is a safe no-op', snapshot.clients.length === 1 && removedClients === 0 && keptWithUserData === 0);
}

console.log(failed ? `\n${failed} assertion(s) failed` : '\nAll sample-undo assertions passed');
process.exit(failed ? 1 : 0);
