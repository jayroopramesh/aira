/**
 * Risk-floor harness (audit fix 2). Proves the up-only "disclosed ideation ⇒ acute" safety floor in
 * `riskFromNote` holds on BOTH the live (Groq-shaped, structured `riskLevel` present) and mock-shaped
 * drafts — the model's structured tier may RAISE but never LOWER what the note's own risk text
 * discloses, and a benign / denied note is never floored up.
 *
 * Run (Node ≥ 22.13, e.g. ~/.cache/fm-node/node-v22.23.2-darwin-arm64/bin/node):
 *   node --experimental-strip-types scripts/risk-floor-harness.mjs
 * Exits non-zero on the first failed assertion.
 */
import { riskFromNote } from '../src/data/sessionClient.ts';

/** Minimal DraftNote shaped just enough for riskFromNote (riskLevel + a risk section). */
function note({ level, rows, summary }) {
  return {
    sessionLabel: 'Session 1',
    sourceLine: 'test',
    status: 'draft',
    riskLevel: level,
    sections: [
      { id: 'risk', marker: 'R', title: 'Risk & Safety Check', body: summary ? [summary] : [], rows: rows ?? [], isRisk: true },
    ],
    measures: [],
    reviewCodes: [],
    prescriptions: [],
  };
}
const ideationRow = (v) => [{ label: 'Suicidal ideation', value: v }];

const cases = [
  // --- Live path: model under-rates a disclosure → floor to acute ---------------------------------
  { name: 'live: passive-ideation row but level=watch', in: note({ level: 'watch', rows: ideationRow('Passive ideation reported; denies plan or intent') }), want: 'acute' },
  { name: 'live: passive-ideation row but level=clear', in: note({ level: 'clear', rows: ideationRow('Passive, reported') }), want: 'acute' },
  { name: 'live: summary-only disclosure, no ideation row, level=clear', in: note({ level: 'clear', rows: [], summary: 'Client reports fleeting thoughts of being better off not here.' }), want: 'acute' },
  { name: 'live: self-harm endorsed but level=watch → elevated floor', in: note({ level: 'watch', rows: [{ label: 'Self-harm', value: 'Endorsed cutting this week' }, { label: 'Suicidal ideation', value: 'Denied' }] }), want: 'elevated' },

  // --- Live path: floor must NOT raise a benign / denied note -------------------------------------
  { name: 'live: fully denied, level=clear stays clear', in: note({ level: 'clear', rows: [{ label: 'Suicidal ideation', value: 'Denied' }, { label: 'Self-harm', value: 'Denied' }], summary: 'No concerns were raised this session.' }), want: 'clear' },
  { name: 'live: benign summary "no suicidal ideation" stays watch', in: note({ level: 'watch', rows: [], summary: 'No suicidal ideation or self-harm was raised in this session on an automated review.' }), want: 'watch' },
  { name: 'live: model already acute stays acute (denied rows never lower it)', in: note({ level: 'acute', rows: [{ label: 'Suicidal ideation', value: 'Denied' }] }), want: 'acute' },
  { name: 'live: model elevated with clear rows stays elevated (floor never lowers)', in: note({ level: 'elevated', rows: [{ label: 'Suicidal ideation', value: 'Denied' }] }), want: 'elevated' },

  // --- Mock-shaped drafts (scanTranscriptRisk output): floor is a no-op, tier preserved ------------
  { name: 'mock: acute reference row + acute level', in: note({ level: 'acute', rows: [{ label: 'Suicidal ideation', value: 'Possible reference in transcript — clinician to review and confirm' }], summary: 'A possible reference to suicidal ideation was picked up in the transcript — review and confirm with the client.' }), want: 'acute' },
  { name: 'mock: benign watch preserved', in: note({ level: 'watch', rows: [{ label: 'Suicidal ideation', value: 'Not raised this session' }, { label: 'Self-harm', value: 'Not raised this session' }], summary: 'No suicidal ideation or self-harm was raised in this session on an automated review.' }), want: 'watch' },
  { name: 'mock: denied-on-read stays clear', in: note({ level: 'clear', rows: [{ label: 'Suicidal ideation', value: 'Denied on an automated read of the transcript — clinician to confirm' }], summary: 'Ideation / self-harm appear to have been raised and denied in this session — confirm with the client.' }), want: 'clear' },

  // --- No structured level (older/mock notes): derivation IS the tier -----------------------------
  { name: 'no level: disclosed ideation row → acute', in: note({ level: undefined, rows: ideationRow('Passive ideation reported') }), want: 'acute' },
  { name: 'no level: no rows, no summary → watch (never false clear)', in: note({ level: undefined, rows: [], summary: '' }), want: 'watch' },
];

let failed = 0;
for (const t of cases) {
  const got = riskFromNote(t.in);
  const ok = got === t.want;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${t.name}  (want ${t.want}, got ${got})`);
}
console.log(`\n${cases.length - failed}/${cases.length} passed`);
if (failed) {
  console.error(`${failed} assertion(s) failed`);
  process.exit(1);
}
