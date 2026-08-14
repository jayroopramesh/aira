/**
 * Risk-floor harness (audit fix 2). Proves the up-only "disclosed ideation ⇒ acute" safety floor in
 * `riskFromNote` holds on BOTH the live (Groq-shaped, structured `riskLevel` present) and mock-shaped
 * drafts — the model's structured tier may RAISE but never LOWER what the note's STRUCTURED RISK ROWS
 * disclose, and a benign / denied row is never floored up.
 *
 * The floor is ROW-BASED: the free-text risk summary does not drive the tier (see `scanNoteRisk`), so
 * these cases assert on rows. Each denial phrasing below is one a clinician or the model actually
 * writes; reading any of them as a disclosure pins a client to acute permanently, since nothing
 * lowers a tier.
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
  { name: 'live: row discloses fleeting thoughts, level=watch', in: note({ level: 'watch', rows: ideationRow('Reports fleeting thoughts of being better off not here') }), want: 'acute' },
  { name: 'live: self-harm endorsed but level=watch → elevated floor', in: note({ level: 'watch', rows: [{ label: 'Self-harm', value: 'Endorsed cutting this week' }, { label: 'Suicidal ideation', value: 'Denied' }] }), want: 'elevated' },

  // --- Plainest row phrasings floor too (not just hand-listed disclosure markers) ------------------
  { name: 'live: bare "Present" ideation row, level=watch → acute', in: note({ level: 'watch', rows: ideationRow('Present') }), want: 'acute' },
  { name: 'live: "Active, with a plan" ideation row, level=watch → acute', in: note({ level: 'watch', rows: ideationRow('Active, with a plan') }), want: 'acute' },
  // A denial of OVERALL risk sitting in the ideation row must not cancel the floor on the disclosure.
  { name: 'live: disclosed ideation carrying a generic "no other risk" clause still floors to acute', in: note({ level: 'watch', rows: ideationRow('Active with a plan; no other risk factors') }), want: 'acute' },
  // A row the model labelled something else must not hide the disclosure.
  { name: 'live: ideation detected by VALUE cue despite a non-ideation label → acute', in: note({ level: 'watch', rows: [{ label: 'Risk', value: 'Active suicidal ideation with a plan' }] }), want: 'acute' },

  // --- Ordinary denial phrasings must stay clear (each was a false acute before the row-only floor) -
  { name: 'live: "Denied" ideation row stays clear', in: note({ level: 'clear', rows: ideationRow('Denied') }), want: 'clear' },
  { name: 'live: "Not currently present" stays clear (word inserted into the bigram)', in: note({ level: 'clear', rows: ideationRow('Not currently present') }), want: 'clear' },
  { name: 'live: "None currently reported" stays clear', in: note({ level: 'clear', rows: ideationRow('None currently reported') }), want: 'clear' },
  { name: 'live: "Not endorsed" stays clear', in: note({ level: 'clear', rows: ideationRow('Not endorsed') }), want: 'clear' },
  { name: 'live: "No SI/HI" clinical shorthand stays clear', in: note({ level: 'clear', rows: ideationRow('No SI/HI') }), want: 'clear' },
  { name: 'live: bare "Nil" stays clear', in: note({ level: 'clear', rows: ideationRow('Nil') }), want: 'clear' },
  { name: 'live: bare "Absent" stays clear', in: note({ level: 'clear', rows: ideationRow('Absent') }), want: 'clear' },
  { name: 'live: fully denied, level=clear stays clear', in: note({ level: 'clear', rows: [{ label: 'Suicidal ideation', value: 'Denied' }, { label: 'Self-harm', value: 'Denied' }] }), want: 'clear' },

  // --- A benign risk SUMMARY never drives the tier, whatever it says -------------------------------
  { name: 'summary: "nothing of concern was raised" over denied rows stays clear', in: note({ level: 'clear', rows: [{ label: 'Suicidal ideation', value: 'Denied' }, { label: 'Self-harm', value: 'Denied' }], summary: 'Suicidal ideation and self-harm were screened; nothing of concern was raised this session.' }), want: 'clear' },
  { name: 'summary: terse "were both screened" over denied rows stays clear', in: note({ level: 'clear', rows: ideationRow('Denied'), summary: 'Suicidal ideation and self-harm were both screened.' }), want: 'clear' },
  { name: 'summary: an unrelated "reported" never overrides a denied row', in: note({ level: 'clear', rows: ideationRow('Denied'), summary: 'Client reported improved mood; suicidal ideation and self-harm were both screened and denied.' }), want: 'clear' },

  // --- Floor never LOWERS the model's tier ---------------------------------------------------------
  { name: 'live: model already acute stays acute (denied rows never lower it)', in: note({ level: 'acute', rows: ideationRow('Denied') }), want: 'acute' },
  { name: 'live: model elevated with denied rows stays elevated (floor never lowers)', in: note({ level: 'elevated', rows: ideationRow('Denied') }), want: 'elevated' },

  // --- Mock-shaped drafts (scanTranscriptRisk output): floor is a no-op, tier preserved ------------
  { name: 'mock: acute reference row + acute level', in: note({ level: 'acute', rows: ideationRow('Possible reference in transcript — clinician to review and confirm'), summary: 'A possible reference to suicidal ideation was picked up in the transcript — review and confirm with the client.' }), want: 'acute' },
  { name: 'mock: benign watch preserved', in: note({ level: 'watch', rows: [{ label: 'Suicidal ideation', value: 'Not raised this session' }, { label: 'Self-harm', value: 'Not raised this session' }], summary: 'No suicidal ideation or self-harm was raised in this session on an automated review.' }), want: 'watch' },
  { name: 'mock: denied-on-read stays clear', in: note({ level: 'clear', rows: ideationRow('Denied on an automated read of the transcript — clinician to confirm'), summary: 'Ideation / self-harm appear to have been raised and denied in this session — confirm with the client.' }), want: 'clear' },
  {
    name: 'mock: self-harm branch ("Not explicitly addressed" ideation) stays elevated',
    in: note({
      level: 'elevated',
      rows: [
        { label: 'Suicidal ideation', value: 'Not explicitly addressed' },
        { label: 'Self-harm', value: 'Possible reference in transcript — clinician to review and confirm' },
      ],
      summary: 'A possible reference to self-harm was picked up in the transcript — review and confirm with the client.',
    }),
    want: 'elevated',
  },

  // --- Nothing assessed → watch, never a false "clear" ---------------------------------------------
  { name: 'no rows at all → watch', in: note({ level: undefined, rows: [] }), want: 'watch' },
  { name: "buildDraft's uncaptured-risk stand-in row derives watch, never a false clear", in: note({ level: undefined, rows: [{ label: 'Risk screening', value: 'Not captured in this draft — review required' }] }), want: 'watch' },

  // --- Asymmetry guard: identical rows must derive the same tier with and without a level ----------
  { name: 'asymmetry: bare "Present" ideation row, no level → acute (floor == derivation)', in: note({ level: undefined, rows: ideationRow('Present') }), want: 'acute' },
  { name: 'asymmetry: "Active, with a plan" ideation row, no level → acute (floor == derivation)', in: note({ level: undefined, rows: ideationRow('Active, with a plan') }), want: 'acute' },
  { name: 'no level: disclosed ideation row → acute', in: note({ level: undefined, rows: ideationRow('Passive ideation reported') }), want: 'acute' },
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
