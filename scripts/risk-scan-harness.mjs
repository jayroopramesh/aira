/**
 * Risk-scan harness (round 4, 2026-08-18). Proves the mock/fallback transcript risk scan
 * (`scanTranscriptRisk`, driven through the public `MockSummarizationService.summarize` seam — the
 * path every typed/pasted transcript takes on a keyless build or signed-out session) never asserts
 * "Not raised this session" against a transcript that raised it.
 *
 * The bug this pins: the cue lists were exact substrings ("kill myself", "hurt myself"), so every
 * inflected disclosure — "thinking about killing myself", "she has been hurting herself", "close to
 * ending it all" — fell through to the benign branch, and the drafted note's Risk & Safety Check
 * claimed "No suicidal ideation or self-harm was raised in this session" directly under a Subjective
 * section quoting the disclosure, while the client's caseload tier stayed wherever it was (the
 * up-only floor rightly treats "Not raised" as neutral). A scanner miss here does not degrade
 * gracefully — it fabricates a negative safety finding.
 *
 * Also pins: "never" is a denial word ("I have never thought about hurting myself" is an explicit
 * lifetime denial → "Not indicated", not "Not raised"), and the pre-existing honesty rules survive —
 * a pure denial is never flagged, a denial-of-plan alongside a disclosure still flags, and a benign
 * transcript still reads "Not raised this session" (never a fabricated denial).
 *
 * Round 4b (2026-08-18) pins the dialogue-shaped misses: second-person reflexives ("harming
 * yourself" — the standard screening question and a therapist reflecting a disclosure back) are
 * visible to the scanner; a screening question answered with a plain denial ("No, nothing like
 * that") reads as raised-and-denied, not as a disclosure and not as "Not raised"; and every row +
 * the summary derive from each cue's own state, so the card can never claim a topic was raised and
 * denied while its row says "Not raised this session".
 *
 * Run (Node ≥ 22.13, e.g. ~/.cache/fm-node/node-v22.23.2-darwin-arm64/bin/node):
 *   node --experimental-strip-types scripts/risk-scan-harness.mjs
 * Exits non-zero on the first failed assertion.
 */
import { register } from 'node:module';

register('./ts-service-loader.mjs', import.meta.url);

const { MockSummarizationService } = await import('../src/services/summarization.ts');

const svc = new MockSummarizationService();
const NOT_RAISED = 'Not raised this session';
const REVIEW = 'Possible reference in transcript — clinician to review and confirm';
const NOT_INDICATED = 'Not indicated on an automated read of the transcript — clinician to confirm';

let failed = 0;
function check(name, ok, detail) {
  if (ok) console.log(`  ok  ${name}`);
  else {
    failed++;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function scan(transcript) {
  const draft = await svc.summarize({ transcript });
  const risk = draft.sections.find((x) => x.isRisk);
  const row = (label) => risk.rows.find((r) => r.label === label)?.value;
  return { level: draft.riskLevel, summary: risk.body[0] ?? '', si: row('Suicidal ideation'), sh: row('Self-harm') };
}

console.log('— inflected disclosures flag (the exact-substring miss) —');
{
  const r = await scan('She told me that some nights she lies awake thinking about killing herself, though she has not made any plan.');
  check('"thinking about killing herself" → acute', r.level === 'acute', `got ${r.level}`);
  check('  …and the SI row asks for review, not "Not raised"', r.si === REVIEW, `got "${r.si}"`);
}
{
  const r = await scan('I keep thinking about killing myself when the panic gets bad at night.');
  check('"thinking about killing myself" → acute', r.level === 'acute', `got ${r.level}`);
}
{
  const r = await scan('He admitted he had been close to ending it all last month. We made a plan for tonight.');
  check('"ending it all" → acute', r.level === 'acute', `got ${r.level}`);
}
{
  const r = await scan('She talked about ending her life during the worst week and about who found her then.');
  check('"ending her life" → acute', r.level === 'acute', `got ${r.level}`);
}
{
  const r = await scan('Client shared that she has been hurting herself again after the breakup, and hiding it from her roommate.');
  check('"hurting herself" (no ideation cue) → elevated', r.level === 'elevated', `got ${r.level}`);
  check('  …and the self-harm row asks for review', r.sh === REVIEW, `got "${r.sh}"`);
}
{
  const r = await scan('He said he started cutting himself again in March and stopped in May.');
  check('"cutting himself" → elevated', r.level === 'elevated', `got ${r.level}`);
}

console.log('— base forms still flag (no regression) —');
{
  const r = await scan('I want to kill myself some days, that is the honest truth.');
  check('"kill myself" → acute', r.level === 'acute', `got ${r.level}`);
}
{
  const r = await scan('Sometimes I cut myself to feel something at all.');
  check('"cut myself" → elevated', r.level === 'elevated', `got ${r.level}`);
}

console.log('— explicit denials read as denials, never as "Not raised" —');
{
  const r = await scan('I have never thought about hurting myself, I want to be clear about that. It is more that I feel exhausted and numb.');
  check('"never thought about hurting myself" → clear', r.level === 'clear', `got ${r.level}`);
  check('  …self-harm row says Not indicated', r.sh === NOT_INDICATED, `got "${r.sh}"`);
  check('  …and never claims it was not raised', r.sh !== NOT_RAISED && !r.summary.includes('was raised in this session on an automated review'), `summary "${r.summary}"`);
}
{
  const r = await scan('She has never had thoughts of suicide, and we did not dwell there.');
  check('"never had thoughts of suicide" → clear', r.level === 'clear', `got ${r.level}`);
  check('  …SI row says Not indicated', r.si === NOT_INDICATED, `got "${r.si}"`);
}
{
  const r = await scan('Client denied suicidal ideation when asked directly today.');
  check('pure denial "denied suicidal ideation" → clear (no fabricated flag)', r.level === 'clear', `got ${r.level}`);
}

console.log('— the disclosed-guard still wins over a partial denial —');
{
  const r = await scan('Denies plan or intent; reports fleeting suicidal thoughts most evenings.');
  check('denial of plan + disclosed ideation → acute', r.level === 'acute', `got ${r.level}`);
}
{
  const r = await scan('She described hurting herself last week but denies any thoughts of suicide.');
  check('disclosed self-harm alongside an SI denial still flags', r.level === 'acute' || r.level === 'elevated', `got ${r.level}`);
}

console.log('— dialogue: second-person phrasing is visible (round 4b) —');
{
  const r = await scan('Therapist: You said last week you had been cutting yourself again. Client: Yes, twice, after the exams.');
  check('"cutting yourself" reflected by the therapist → elevated', r.level === 'elevated', `got ${r.level}`);
  check('  …self-harm row asks for review, not "Not raised"', r.sh === REVIEW, `got "${r.sh}"`);
}
{
  const r = await scan(
    'Therapist: Have you had any thoughts of harming yourself, or that life is not worth living?\nClient: No, nothing like that. It is loneliness, not wanting to die.'
  );
  check('screening question answered "No, nothing like that" → clear', r.level === 'clear', `got ${r.level}`);
  check('  …SI row says Not indicated', r.si === NOT_INDICATED, `got "${r.si}"`);
  check('  …self-harm row says Not indicated, never "Not raised" for a raised topic', r.sh === NOT_INDICATED, `got "${r.sh}"`);
  check(
    '  …summary names both topics as raised and denied',
    r.summary === 'Ideation and self-harm appear to have been raised and denied in this session — confirm with the client.',
    `got "${r.summary}"`
  );
}
{
  const r = await scan('Therapist: Have you thought about killing yourself?\nClient: Yes. Sometimes at night.');
  check('screening question answered "Yes" still flags → acute', r.level === 'acute', `got ${r.level}`);
}

console.log('— the card never contradicts itself (round 4b) —');
{
  const r = await scan('She has never had thoughts of suicide, and we did not dwell there.');
  check(
    'single-topic denial: summary names only ideation',
    r.summary === 'Suicidal ideation appears to have been raised and denied in this session — confirm with the client.',
    `got "${r.summary}"`
  );
  check('  …and the self-harm row honestly says Not raised', r.sh === NOT_RAISED, `got "${r.sh}"`);
}
{
  const r = await scan('I keep thinking about killing myself when the panic gets bad. Have I ever cut myself? No, never that.');
  check('acute branch: raised-and-denied self-harm reads Not indicated, not "Not explicitly addressed"', r.sh === NOT_INDICATED, `got "${r.sh}"`);
  check('  …while ideation stays under review at acute', r.level === 'acute' && r.si === REVIEW, `level ${r.level}, si "${r.si}"`);
}

console.log('— benign transcripts stay honestly neutral —');
{
  const r = await scan('We practiced the breathing exercise together and reviewed her week at work. She felt proud of setting a boundary with her manager.');
  check('benign transcript → watch', r.level === 'watch', `got ${r.level}`);
  check('  …rows say Not raised (never a fabricated denial)', r.si === NOT_RAISED && r.sh === NOT_RAISED, `si "${r.si}" sh "${r.sh}"`);
}

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nrisk-scan-harness: all assertions passed');
