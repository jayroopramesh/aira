/**
 * Provenance + no-fabrication harness. Proves the two rules the note's honesty rests on, by running
 * the real services rather than by reading them.
 *
 *   1. NEVER INVENT A TRANSCRIPT. A real recording either gets a transcript actually produced from
 *      that audio or gets none — on every build. The canned walkthrough text belongs to the built-in
 *      `mock://` clip and to nothing else, and the canned assessment / plan / `F41.1` chip belong to
 *      that same sample. Both have leaked into a real client's note before.
 *   2. NEVER MISSTATE THE HOPS. `audioLeftDevice`, `transcriptFromCloud` and `draftedInCloud` are
 *      three separate facts that come apart in practice (an upload can succeed while the
 *      transcription fails), and the note's `sourceLine` is a pure function of them. That expression
 *      was re-derived wrongly in three successive fix rounds, each time caught only by a reader —
 *      hence this file.
 *
 * Run (Node ≥ 22.13, e.g. ~/.cache/fm-node/node-v22.23.2-darwin-arm64/bin/node):
 *   node scripts/provenance-harness.mjs
 * Exits non-zero on the first failed assertion.
 */
import { register } from 'node:module';

register('./ts-service-loader.mjs', import.meta.url);

const { MockSummarizationService, GroqSummarizationService } = await import('../src/services/summarization.ts');
const { MockTranscriptionService, isTranscriptionUnavailableError } = await import('../src/services/transcription.ts');

let failed = 0;
function check(name, ok, detail) {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (${detail})`}`);
}

/** The words the walkthrough puts in the sample client's mouth, including a safety finding. */
const CANNED_MARKER = 'Denies passive ideation on screening today';
/** A real session, in the clinician's own words. */
const REAL_TRANSCRIPT =
  'Client described a steadier fortnight and improved sleep since starting the sleep log. ' +
  'They reported ongoing academic pressure before an upcoming exam. Denied any thoughts of self-harm ' +
  'when asked directly. Agreed to continue the sleep log and practise an exam-specific reframe.';

const SAMPLE = { uri: 'mock://session', durationMs: 47 * 60 * 1000 };
const RECORDING = { uri: 'blob:https://app.example/9f2c', durationMs: 47 * 60 * 1000 };

// --- 1. The on-device transcriber replays the sample and refuses everything else ------------------
{
  const mock = new MockTranscriptionService(0.001);

  const sample = await mock.transcribe(SAMPLE);
  check('sample clip still yields the walkthrough transcript', sample.text.includes(CANNED_MARKER), sample.text);

  let thrown = null;
  try {
    await mock.transcribe(RECORDING);
  } catch (e) {
    thrown = e;
  }
  check('a real recording is refused, not answered with canned words', thrown !== null, 'it returned a transcript');
  check(
    'the refusal is TranscriptionUnavailableError, so the UI offers paste and not sign-in',
    isTranscriptionUnavailableError(thrown),
    thrown?.name,
  );
  check(
    'the refusal does not leak the canned text',
    !String(thrown?.message ?? '').includes(CANNED_MARKER),
    thrown?.message,
  );

  // An uploaded file is a real recording too — only the built-in clip is the sample.
  let uploadThrown = null;
  try {
    await mock.transcribe({ uri: 'file:///tmp/session.m4a', durationMs: 1000 });
  } catch (e) {
    uploadThrown = e;
  }
  check('an uploaded audio file is treated as real, not sample', isTranscriptionUnavailableError(uploadThrown), uploadThrown?.name);
}

// --- 2. The on-device summarizer's canned clinical content is sample-only -------------------------
{
  const mock = new MockSummarizationService();

  const real = await mock.summarize({ transcript: REAL_TRANSCRIPT, sessionNumber: 4 });
  const realCodes = JSON.stringify(real.reviewCodes);
  check('a real session gets no invented diagnosis chip', real.reviewCodes.length === 0, realCodes);
  check('specifically no F41.1 anxiety code', !realCodes.includes('F41.1'), realCodes);
  check('a real session gets no invented prescriptions', real.prescriptions.length === 0, String(real.prescriptions.length));
  const body = (id) => {
    const s = real.sections.find((x) => x.id === id);
    return (s.bullets ?? s.body).join(' ');
  };
  check('assessment is left for the clinician', /review required/i.test(body('assessment')), body('assessment'));
  check('plan is left for the clinician', /review required/i.test(body('plan')), body('plan'));
  check('subjective IS derived from the clinician\'s own words', body('subjective').includes('steadier fortnight'), body('subjective'));
  check('the transcript risk scan still runs', !!real.riskLevel, String(real.riskLevel));
  check('the note says a keyword stub wrote it', /keyword stub/.test(real.sourceLine), real.sourceLine);

  // A caller that forgets the flag must get the safe mode, not the canned one.
  const unflagged = await mock.summarize({ transcript: REAL_TRANSCRIPT });
  check('an absent sampleCapture flag defaults to derive-only', unflagged.reviewCodes.length === 0, JSON.stringify(unflagged.reviewCodes));

  const sample = await mock.summarize({ transcript: REAL_TRANSCRIPT, sampleCapture: true });
  check('the sample walkthrough still fills a complete note', sample.reviewCodes.length === 1, JSON.stringify(sample.reviewCodes));
  check('the sample walkthrough still fills the prescriptions rail', sample.prescriptions.length === 3, String(sample.prescriptions.length));
  check('the sample walkthrough is not labelled a keyword stub', !/keyword stub/.test(sample.sourceLine), sample.sourceLine);
}

// --- 3. sourceLine across every reachable combination of the three facts --------------------------
{
  // No token → the Groq summarizer delegates on-device, so this exercises the real fallback path.
  const offline = new GroqSummarizationService('https://proxy.invalid', async () => null, 'llama-3.3-70b-versatile');
  // `buildDraft` sentence-cases the provenance when there is no duration to prefix, so every phrase
  // assertion here is deliberately case-insensitive.
  const draft = (flags) => offline.summarize({ transcript: REAL_TRANSCRIPT, ...flags });

  const nothingSent = await draft({ audioLeftDevice: false, transcriptFromCloud: false });
  check(
    'nothing left the device → says so, and promises nothing was sent',
    /nothing was sent anywhere/.test(nothingSent.sourceLine),
    nothingSent.sourceLine,
  );
  check('and stamps all three facts false', !nothingSent.audioLeftDevice && !nothingSent.transcriptFromCloud && !nothingSent.draftedInCloud);

  // The case rounds 3-5 kept getting wrong: the upload happened, the transcription did not.
  const uploadedThenFailed = await draft({ audioLeftDevice: true, transcriptFromCloud: false });
  check(
    'upload-then-failure still discloses the audio hop',
    /audio sent to the cloud/i.test(uploadedThenFailed.sourceLine),
    uploadedThenFailed.sourceLine,
  );
  check(
    'upload-then-failure does NOT claim machine transcription',
    !/transcribed in demo mode \(cloud\)/i.test(uploadedThenFailed.sourceLine),
    uploadedThenFailed.sourceLine,
  );
  check(
    'upload-then-failure says the text was entered by hand',
    /entered by hand/.test(uploadedThenFailed.sourceLine),
    uploadedThenFailed.sourceLine,
  );
  check(
    'upload-then-failure must not promise nothing was sent',
    !/nothing was sent anywhere/.test(uploadedThenFailed.sourceLine),
    uploadedThenFailed.sourceLine,
  );
  check('and stamps the disclosure true while the claim stays false',
    uploadedThenFailed.audioLeftDevice === true && uploadedThenFailed.transcriptFromCloud === false);

  // transcriptFromCloud implies the audio left, even if a caller forgets to say so.
  const claimedWithoutUpload = await draft({ audioLeftDevice: false, transcriptFromCloud: true });
  check(
    'a cloud transcript implies the audio left the device',
    claimedWithoutUpload.audioLeftDevice === true,
    claimedWithoutUpload.sourceLine,
  );
}

// --- 4. A token-backed draft is the only thing that may claim the cloud drafting hop --------------
{
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                subjective: { body: ['Reported a steadier fortnight.'] },
                objective: { body: ['Engaged throughout.'] },
                riskSafety: { summary: 'Screened.', rows: [{ label: 'Suicidal ideation', value: 'Denied' }], level: 'clear' },
                assessment: { body: ['Stable.'] },
                plan: { bullets: ['Continue the sleep log'] },
                reviewCodes: [{ code: 'F32.0', label: 'Mild depressive episode' }],
              }),
            },
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );

  const live = new GroqSummarizationService('https://proxy.invalid', async () => 'session-token', 'llama-3.3-70b-versatile');
  const cloud = await live.summarize({ transcript: REAL_TRANSCRIPT, audioLeftDevice: true, transcriptFromCloud: true });
  check('a token-backed draft is stamped drafted-in-cloud', cloud.draftedInCloud === true);
  check('cloud transcription + cloud draft collapses to one clause',
    /transcribed and drafted in demo mode \(cloud\)/i.test(cloud.sourceLine), cloud.sourceLine);
  check('a cloud draft is never labelled a keyword stub', !/keyword stub/.test(cloud.sourceLine), cloud.sourceLine);

  const localAudioCloudDraft = await live.summarize({ transcript: REAL_TRANSCRIPT, audioLeftDevice: false, transcriptFromCloud: false });
  check('sample audio + cloud draft reads as two separate hops',
    /transcribed on this device, drafted in demo mode \(cloud\)/i.test(localAudioCloudDraft.sourceLine),
    localAudioCloudDraft.sourceLine);

  globalThis.fetch = originalFetch;
}

console.log(failed ? `\n${failed} assertion(s) failed` : '\nAll provenance assertions passed');
process.exit(failed ? 1 : 0);
