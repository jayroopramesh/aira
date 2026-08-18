/**
 * "Continue recording" harness. Proves `applyRecordingAppend` (the pure note→note merge behind
 * `DataProvider.appendRecording`) end to end:
 *   1. Nothing already on the note is discarded — the prior transcript survives verbatim, with a
 *      timestamped, per-segment "--- Added recording ---" divider ahead of the new text.
 *   2. A signed note is refused outright (read-only, same rule `updateNoteSection` enforces).
 *   3. Provenance stays honest: `audioLeftDevice` only ever grows more true (a disclosure), and
 *      `transcriptFromCloud` keeps meaning "the WHOLE transcript" only while every segment agrees —
 *      the moment a cloud-transcribed segment and a hand-typed one are spliced together,
 *      `transcriptMixedProvenance` takes over rather than one claim silently misdescribing the other
 *      segment.
 *   4. The transcript genuinely changing re-enables "Generate from notes" (`prescriptionsGenerated`
 *      resets), because a stale, no-longer-true "already generated" flag is not an honest default.
 *
 * Run (Node ≥ 22.13, e.g. ~/.cache/fm-node/node-v22.23.2-darwin-arm64/bin/node):
 *   node --experimental-strip-types scripts/append-recording-harness.mjs
 * Exits non-zero on the first failed assertion.
 */
import { applyRecordingAppend } from '../src/data/appendRecording.ts';

let failed = 0;
function check(name, ok, detail) {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (${detail})`}`);
}

const BASE_NOTE = {
  sessionLabel: 'Session 5 — 12 Aug',
  sourceLine: 'From a 47-min voice note · transcribed and drafted in demo mode (cloud) · for your review',
  status: 'draft',
  transcript: 'Client reported a steadier fortnight and improved sleep since starting the sleep log.',
  audioLeftDevice: true,
  transcriptFromCloud: true,
  draftedInCloud: true,
  sections: [],
  measures: [],
  reviewCodes: [],
  prescriptions: [{ id: 'gen-0', text: 'Continue the sleep log', source: 'from Plan', done: false, generated: true }],
  prescriptionsGenerated: true,
};

// --- 1. The prior transcript survives verbatim, with a timestamped divider ahead of the addition ---
{
  const next = applyRecordingAppend(
    BASE_NOTE,
    { transcript: 'They also mentioned a new sleep aid the GP prescribed this week.', audioLeftDevice: true, transcriptFromCloud: true },
    '17 Aug 14:32',
  );
  check('append is not refused for an unsigned draft', next !== null, String(next));
  check('the prior transcript text survives verbatim', next.transcript.startsWith(BASE_NOTE.transcript), next.transcript);
  check('the new text is present too', next.transcript.includes('new sleep aid the GP prescribed'), next.transcript);
  check('a timestamped divider separates the two', next.transcript.includes('--- Added recording · 17 Aug 14:32'), next.transcript);
  check(
    'the original note object is untouched (pure function)',
    BASE_NOTE.transcript === 'Client reported a steadier fortnight and improved sleep since starting the sleep log.',
    BASE_NOTE.transcript,
  );
}

// --- 2. A signed note refuses the append outright — never mutated -----------------------------------
{
  const signed = { ...BASE_NOTE, status: 'signed', signedBy: 'A. Rahman', signedAt: '13 Aug 09:00' };
  const next = applyRecordingAppend(signed, { transcript: 'Should never land.', audioLeftDevice: false, transcriptFromCloud: false }, '17 Aug 14:32');
  check('a signed note refuses the append (returns null)', next === null, String(next));
}

// --- 2b. A blank addition is refused too — nothing to append ----------------------------------------
{
  const next = applyRecordingAppend(BASE_NOTE, { transcript: '   ', audioLeftDevice: true, transcriptFromCloud: true }, '17 Aug 14:32');
  check('a whitespace-only addition is refused', next === null, String(next));
}

// --- 3. audioLeftDevice only ever grows more true (up-only disclosure) ------------------------------
{
  const priorNeverLeft = { ...BASE_NOTE, audioLeftDevice: false, transcriptFromCloud: false };
  const next = applyRecordingAppend(priorNeverLeft, { transcript: 'Typed in the cloud path.', audioLeftDevice: true, transcriptFromCloud: true }, '17 Aug 14:32');
  check('a later cloud-transcribed addition flips audioLeftDevice true, never back to false', next.audioLeftDevice === true, String(next.audioLeftDevice));

  const priorLeft = { ...BASE_NOTE, audioLeftDevice: true, transcriptFromCloud: true };
  const next2 = applyRecordingAppend(priorLeft, { transcript: 'Typed by hand this time.', audioLeftDevice: false, transcriptFromCloud: false }, '17 Aug 14:32');
  check('a later on-device addition never UNDER-discloses a prior cloud upload', next2.audioLeftDevice === true, String(next2.audioLeftDevice));
}

// --- 4. Mixed provenance: a cloud original + a hand-typed addition must not claim either extreme ----
{
  const cloudOriginal = { ...BASE_NOTE, transcriptFromCloud: true };
  const mixed = applyRecordingAppend(cloudOriginal, { transcript: 'Typed by the clinician after a failed upload.', audioLeftDevice: true, transcriptFromCloud: false }, '17 Aug 14:32');
  check('mixed provenance is flagged', mixed.transcriptMixedProvenance === true, String(mixed.transcriptMixedProvenance));
  check('transcriptFromCloud never OVERCLAIMS the whole transcript once mixed', mixed.transcriptFromCloud === false, String(mixed.transcriptFromCloud));
  check(
    "the addition's own true provenance is still disclosed inline, in the divider",
    mixed.transcript.includes('typed by you'),
    mixed.transcript,
  );

  const typedOriginal = { ...BASE_NOTE, transcriptFromCloud: false, audioLeftDevice: false };
  const alsoMixed = applyRecordingAppend(typedOriginal, { transcript: 'This one really was transcribed in the cloud.', audioLeftDevice: true, transcriptFromCloud: true }, '17 Aug 14:32');
  check('the reverse mix (typed original + cloud addition) is flagged too', alsoMixed.transcriptMixedProvenance === true, String(alsoMixed.transcriptMixedProvenance));
  check('and does not claim the whole thing is cloud-transcribed', alsoMixed.transcriptFromCloud === false, String(alsoMixed.transcriptFromCloud));
  check(
    "the cloud addition's own provenance is disclosed inline",
    alsoMixed.transcript.includes('transcribed off this device'),
    alsoMixed.transcript,
  );

  // Agreeing provenance never sets the mixed flag, and keeps the ordinary single-claim semantics —
  // no behaviour change for the common case of two cloud-transcribed captures.
  const agreeing = applyRecordingAppend(cloudOriginal, { transcript: 'Also cloud-transcribed.', audioLeftDevice: true, transcriptFromCloud: true }, '17 Aug 14:32');
  check('agreeing provenance sets no mixed flag', !agreeing.transcriptMixedProvenance, String(agreeing.transcriptMixedProvenance));
  check('and keeps the simple true claim', agreeing.transcriptFromCloud === true, String(agreeing.transcriptFromCloud));
}

// --- 4b. An edited machine-transcribed segment says so in its own divider (round 5, Marcus Chen):
//         "transcribed off this device" alone must not stand over text the clinician changed ---------
{
  const cloudOriginal = { ...BASE_NOTE, transcriptFromCloud: true };
  const edited = applyRecordingAppend(
    cloudOriginal,
    { transcript: 'Cloud text the clinician then corrected.', audioLeftDevice: true, transcriptFromCloud: true, transcriptEdited: true },
    '17 Aug 14:32',
  );
  check(
    "the edited segment's divider names the edit",
    edited.transcript.includes('transcribed off this device, then edited by you'),
    edited.transcript,
  );
  check('the note-level machine claim is qualified once any segment was edited', edited.transcriptEdited === true, String(edited.transcriptEdited));
  check('agreement on cloud origin still avoids the mixed flag', !edited.transcriptMixedProvenance, String(edited.transcriptMixedProvenance));

  const uneditedAfter = applyRecordingAppend(
    { ...cloudOriginal, transcriptEdited: true },
    { transcript: 'A later untouched cloud segment.', audioLeftDevice: true, transcriptFromCloud: true },
    '17 Aug 14:32',
  );
  check('the qualifier is up-only — a later unedited segment never clears it', uneditedAfter.transcriptEdited === true, String(uneditedAfter.transcriptEdited));

  const typedEdited = applyRecordingAppend(
    cloudOriginal,
    { transcript: 'Typed by hand; the flag is meaningless here.', audioLeftDevice: false, transcriptFromCloud: false, transcriptEdited: true },
    '17 Aug 14:32',
  );
  check('a typed segment ignores a stray edited flag (nothing machine-made to have edited)', typedEdited.transcriptEdited === undefined, String(typedEdited.transcriptEdited));
  check('…and its divider still says typed by you', typedEdited.transcript.includes('typed by you'), typedEdited.transcript);
}

// --- 5. Auxiliary notes concatenate — an earlier speaker-2 removal is never silently undone ---------
{
  const withAux = { ...BASE_NOTE, auxiliaryNotes: 'Speaker 2: earlier removed turn.' };
  const next = applyRecordingAppend(withAux, { transcript: 'New segment.', audioLeftDevice: true, transcriptFromCloud: true, auxiliaryNotes: 'Speaker 2: new removed turn.' }, '17 Aug 14:32');
  check('the earlier auxiliary notes survive', next.auxiliaryNotes.includes('earlier removed turn'), next.auxiliaryNotes);
  check('the new auxiliary notes are appended, not dropped', next.auxiliaryNotes.includes('new removed turn'), next.auxiliaryNotes);

  const noNewAux = applyRecordingAppend(withAux, { transcript: 'Retrospective mode, no speaker pass.', audioLeftDevice: true, transcriptFromCloud: true }, '17 Aug 14:32');
  check('with no new auxiliary notes, the earlier ones still survive untouched', noNewAux.auxiliaryNotes === 'Speaker 2: earlier removed turn.', noNewAux.auxiliaryNotes);
}

// --- 6. The transcript genuinely changing re-enables "Generate from notes" --------------------------
{
  const next = applyRecordingAppend(BASE_NOTE, { transcript: 'A new observation the clinician wants reflected.', audioLeftDevice: true, transcriptFromCloud: true }, '17 Aug 14:32');
  check('prescriptionsGenerated resets so the control re-enables', next.prescriptionsGenerated === false, String(next.prescriptionsGenerated));
  check('the prescriptions already pulled are NOT discarded — append is additive', next.prescriptions.length === 1 && next.prescriptions[0].text === 'Continue the sleep log', JSON.stringify(next.prescriptions));
}

// --- 7. Recording-screen comments concatenate — the strip's "kept with the note" promise holds across
//        an append: earlier comments survive, the new capture's are added after them, none replaced ---
{
  const withComments = { ...BASE_NOTE, recordingComments: [{ ts: '03:12', text: 'Change talk here' }] };
  const next = applyRecordingAppend(
    withComments,
    { transcript: 'New segment.', audioLeftDevice: true, transcriptFromCloud: true, recordingComments: [{ ts: '00:41', text: 'Ask about sleep' }] },
    '17 Aug 14:32',
  );
  check(
    'earlier comments survive and the new capture’s follow them, in order',
    JSON.stringify(next.recordingComments) === JSON.stringify([{ ts: '03:12', text: 'Change talk here' }, { ts: '00:41', text: 'Ask about sleep' }]),
    JSON.stringify(next.recordingComments),
  );

  const noNew = applyRecordingAppend(withComments, { transcript: 'No comments this time.', audioLeftDevice: true, transcriptFromCloud: true }, '17 Aug 14:32');
  check(
    'with no new comments, the earlier ones still survive untouched',
    JSON.stringify(noNew.recordingComments) === JSON.stringify([{ ts: '03:12', text: 'Change talk here' }]),
    JSON.stringify(noNew.recordingComments),
  );

  const neverAny = applyRecordingAppend(BASE_NOTE, { transcript: 'No comments at all.', audioLeftDevice: true, transcriptFromCloud: true }, '17 Aug 14:32');
  check('a note that never had comments gains none', neverAny.recordingComments === undefined, String(neverAny.recordingComments));
}

console.log(failed ? `\n${failed} assertion(s) failed` : '\nAll append-recording assertions passed');
process.exit(failed ? 1 : 0);
