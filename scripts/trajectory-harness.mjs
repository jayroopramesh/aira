/**
 * Trajectory harness (captain feedback round 2, item 2). Proves `deriveTrajectory` — recurring review
 * codes, repeated plan/prescription items, and the risk-tier trend across a client's retained notes —
 * derives ONLY from data already on the notes, and honours the captain's own <3-session empty state.
 *
 * Run (Node ≥ 22.13, e.g. ~/.cache/fm-node/node-v22.23.2-darwin-arm64/bin/node):
 *   node --experimental-strip-types scripts/trajectory-harness.mjs
 * Exits non-zero on the first failed assertion.
 */
import { deriveTrajectory, MIN_SESSIONS_FOR_TRAJECTORY } from '../src/data/trajectory.ts';

let failed = 0;
function check(name, ok, detail) {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (${detail})`}`);
}

function makeNote({ sessionLabel, codes = [], prescriptions = [], riskLevel }) {
  return {
    sessionLabel,
    sourceLine: 'test',
    status: 'signed',
    riskLevel,
    sections: [],
    measures: [],
    reviewCodes: codes.map((code) => ({ code, label: `label for ${code}`, relevance: 'high' })),
    prescriptions: prescriptions.map((text, i) => ({ id: `rx${i}`, text, source: 'test', done: false })),
  };
}

// --- Empty state: fewer than MIN_SESSIONS_FOR_TRAJECTORY notes ---
{
  check('MIN_SESSIONS_FOR_TRAJECTORY is 3 ("At least 3 sessions needed")', MIN_SESSIONS_FOR_TRAJECTORY === 3);
  check('0 notes → null', deriveTrajectory([]) === null);
  check('1 note → null', deriveTrajectory([makeNote({ sessionLabel: 'Session 1 — 1 Jan' })]) === null);
  const two = [makeNote({ sessionLabel: 'Session 2 — 2 Jan' }), makeNote({ sessionLabel: 'Session 1 — 1 Jan' })];
  check('2 notes → null (Daniel\'s exact fixture case)', deriveTrajectory(two) === null);
}

// --- Recurring codes: only codes seen ≥2 times, with real session provenance ---
{
  // Notes are supplied newest-first (useClientNotes order); a code in every session must recur, one
  // seen only once must not.
  const notes = [
    makeNote({ sessionLabel: 'Session 3 — 3 Jan', codes: ['F41.1', 'Z55.9'], riskLevel: 'watch' }),
    makeNote({ sessionLabel: 'Session 2 — 2 Jan', codes: ['F41.1'], riskLevel: 'watch' }),
    makeNote({ sessionLabel: 'Session 1 — 1 Jan', codes: ['F41.1', 'F43.20'], riskLevel: 'watch' }),
  ];
  const t = deriveTrajectory(notes);
  check('3 sessions → non-null trajectory', t !== null);
  check('sessionCount matches', t.sessionCount === 3, String(t.sessionCount));
  const f411 = t.recurringCodes.find((c) => c.code === 'F41.1');
  check('a code in all 3 sessions recurs 3x', f411?.count === 3, JSON.stringify(f411));
  check('recurring code lists sessions oldest-first (real provenance)', JSON.stringify(f411.sessions) === JSON.stringify(['Session 1 — 1 Jan', 'Session 2 — 2 Jan', 'Session 3 — 3 Jan']), JSON.stringify(f411?.sessions));
  check('a code seen only once is NOT reported as recurring', !t.recurringCodes.some((c) => c.code === 'Z55.9'), JSON.stringify(t.recurringCodes));
  check('a code seen only once is NOT reported as recurring (F43.20)', !t.recurringCodes.some((c) => c.code === 'F43.20'));
  check('recurring codes sorted by count, most-frequent first', t.recurringCodes[0].code === 'F41.1');
}

// --- Repeated prescriptions: text-normalised grouping, ≥2 occurrences ---
{
  const notes = [
    makeNote({ sessionLabel: 'Session 3 — 3 Jan', prescriptions: ['Sleep log'], riskLevel: 'watch' }),
    makeNote({ sessionLabel: 'Session 2 — 2 Jan', prescriptions: ['  Sleep Log  '], riskLevel: 'watch' }), // same item, different case/whitespace
    makeNote({ sessionLabel: 'Session 1 — 1 Jan', prescriptions: ['Worry-window practice'], riskLevel: 'watch' }),
  ];
  const t = deriveTrajectory(notes);
  const sleep = t.repeatedPrescriptions.find((p) => p.text.toLowerCase().includes('sleep'));
  check('same item, different case/whitespace, still recurs', sleep?.count === 2, JSON.stringify(sleep));
  check('an item seen once is not reported as repeated', !t.repeatedPrescriptions.some((p) => p.text.includes('Worry-window')), JSON.stringify(t.repeatedPrescriptions));
}

// --- Risk trend: chronological (oldest-first), trusts riskLevel as-is, no re-derivation ---
{
  const notes = [
    makeNote({ sessionLabel: 'Session 5 — 5 Aug', codes: ['F33.1'], riskLevel: 'acute' }),
    makeNote({ sessionLabel: 'Session 4 — 22 Jul', codes: ['F33.1'], riskLevel: 'watch' }),
    makeNote({ sessionLabel: 'Session 3 — 8 Jul', codes: ['F33.1'], riskLevel: 'watch' }),
  ];
  const t = deriveTrajectory(notes);
  check(
    'risk trend is oldest-first, trusting each note\'s own riskLevel verbatim',
    JSON.stringify(t.riskTrend) === JSON.stringify([
      { sessionLabel: 'Session 3 — 8 Jul', riskLevel: 'watch' },
      { sessionLabel: 'Session 4 — 22 Jul', riskLevel: 'watch' },
      { sessionLabel: 'Session 5 — 5 Aug', riskLevel: 'acute' },
    ]),
    JSON.stringify(t.riskTrend),
  );
}

// --- A note with no riskLevel is skipped in the trend, not fabricated as some default tier ---
{
  const notes = [
    makeNote({ sessionLabel: 'Session 3 — 3 Jan', riskLevel: 'watch' }),
    makeNote({ sessionLabel: 'Session 2 — 2 Jan' }), // no riskLevel — older note, absent field
    makeNote({ sessionLabel: 'Session 1 — 1 Jan', riskLevel: 'clear' }),
  ];
  const t = deriveTrajectory(notes);
  check('a note with no riskLevel is omitted from the trend, never invented', t.riskTrend.length === 2, JSON.stringify(t.riskTrend));
}

// --- Real fixture shape sanity: Amara's 5 sample sessions recur F43.22 across all 5 ---
{
  const notes = [
    makeNote({ sessionLabel: 'Session 5 — 12 Aug', codes: ['F43.22', 'Z63.8', 'G47.00'], riskLevel: 'watch' }),
    makeNote({ sessionLabel: 'Session 4 — 5 Apr', codes: ['F43.22', 'G47.00', 'Z63.8'], riskLevel: 'watch' }),
    makeNote({ sessionLabel: 'Session 3 — 8 Mar', codes: ['F43.22', 'Z63.8'], riskLevel: 'watch' }),
    makeNote({ sessionLabel: 'Session 2 — 23 Feb', codes: ['F43.22', 'Z63.8', 'G47.00'], riskLevel: 'elevated' }),
    makeNote({ sessionLabel: 'Session 1 — 12 Jan', codes: ['F43.22', 'G47.00'], riskLevel: 'elevated' }),
  ];
  const t = deriveTrajectory(notes);
  const f4322 = t.recurringCodes.find((c) => c.code === 'F43.22');
  check('F43.22 recurs across all 5 Amara sessions', f4322?.count === 5, JSON.stringify(f4322));
  check('risk trend shows the elevated→watch improvement', t.riskTrend.map((p) => p.riskLevel).join(',') === 'elevated,elevated,watch,watch,watch', t.riskTrend.map((p) => p.riskLevel).join(','));
}

console.log(failed ? `\n${failed} assertion(s) failed` : '\nAll trajectory assertions passed');
process.exit(failed ? 1 : 0);
