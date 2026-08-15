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
const { MockTranscriptionService, GroqTranscriptionService, isSampleCapture, isTranscriptionUnavailableError } =
  await import('../src/services/transcription.ts');
const { isCloudSessionRequiredError } = await import('../src/services/cloudSession.ts');
const { failedCaptureRef } = await import('../src/services/audioCapture.ts');

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

// --- 1b. The CLOUD transcriber refuses too, and with the OTHER error kind ------------------------
// Only `CloudSessionRequiredError` makes the capture screen offer "sign in" — signing in fixes a
// missing session and cannot conjure an engine that isn't in the build, so the kinds must stay apart.
{
  const signedOut = new GroqTranscriptionService('https://proxy.invalid', async () => null, 'whisper-large-v3');
  let thrown = null;
  try {
    await signedOut.transcribe(RECORDING);
  } catch (e) {
    thrown = e;
  }
  check('cloud transcription with no session is refused', thrown !== null, 'it returned a transcript');
  check('the refusal is CloudSessionRequiredError, so the UI offers sign-in', isCloudSessionRequiredError(thrown), thrown?.name);
  check('it is NOT the on-device error kind', !isTranscriptionUnavailableError(thrown), thrown?.name);
  check('the refusal does not leak the canned text', !String(thrown?.message ?? '').includes(CANNED_MARKER), thrown?.message);

  // With a token it must actually reach the proxy rather than answering locally.
  const originalFetch = globalThis.fetch;
  let posted = null;
  globalThis.fetch = async (url) => {
    if (String(url) === RECORDING.uri) return new Response(new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' }));
    posted = String(url);
    return new Response(JSON.stringify({ text: 'real whisper output', segments: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const signedIn = new GroqTranscriptionService('https://proxy.invalid', async () => 'session-token', 'whisper-large-v3');
  const cloud = await signedIn.transcribe(RECORDING);
  check('with a session the audio goes to the proxy', posted === 'https://proxy.invalid/transcriptions', posted);
  check('and the transcript is whisper\'s, not canned', cloud.text === 'real whisper output', cloud.text);
  globalThis.fetch = originalFetch;
}

// --- 1c. A recording that cannot be finalised is never relabelled as the sample ------------------
// `stopAndAnalyse` used to fall back to the sample ref when MediaRecorder.stop() threw, which handed
// a real 40-minute session the canned transcript and the canned walkthrough note.
{
  const failed = failedCaptureRef(40 * 60 * 1000);
  check('a failed recording is not a sample capture', isSampleCapture(failed.uri) === false, failed.uri);
  check('it keeps the elapsed duration', failed.durationMs === 40 * 60 * 1000, String(failed.durationMs));

  let thrown = null;
  try {
    await new MockTranscriptionService(0.001).transcribe(failed);
  } catch (e) {
    thrown = e;
  }
  check('and it is refused rather than answered with canned words', isTranscriptionUnavailableError(thrown), thrown?.name);

  // The drafting half of the same gate: a failed recording must not unlock the walkthrough content.
  const draft = await new MockSummarizationService().summarize({
    transcript: REAL_TRANSCRIPT,
    sampleCapture: isSampleCapture(failed.uri),
  });
  check('nor given the walkthrough diagnosis chip', draft.reviewCodes.length === 0, JSON.stringify(draft.reviewCodes));
  check('nor the walkthrough prescriptions', draft.prescriptions.length === 0, String(draft.prescriptions.length));
}

// --- 1d. A recorder that stops itself still hands back the real clip -----------------------------
// When every track of the stream ends (mic unplugged, permission revoked) MediaRecorder fires `stop`
// and goes `inactive` on its own; a later stop() then throws InvalidStateError. The recorded audio is
// already in hand, so it must be returned rather than surfaced as a capture failure.
{
  class FakeRecorder {
    constructor() {
      this.state = 'recording';
      this.ondataavailable = null;
      this.onstop = null;
    }
    start() {}
    stop() {
      if (this.state === 'inactive') {
        const e = new Error('The MediaRecorder is not recording');
        e.name = 'InvalidStateError';
        throw e;
      }
      this.state = 'inactive';
      this.onstop?.();
    }
    endStreamOnItsOwn() {
      this.state = 'inactive';
      this.onstop?.();
    }
    static isTypeSupported() {
      return false;
    }
  }

  let recorder = null;
  const priorRecorder = globalThis.MediaRecorder;
  const priorNavigator = globalThis.navigator;
  globalThis.MediaRecorder = new Proxy(FakeRecorder, {
    construct(T, args) {
      recorder = new T(...args);
      return recorder;
    },
  });
  Object.defineProperty(globalThis, 'navigator', {
    value: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } },
    configurable: true,
    writable: true,
  });

  const { startRecording } = await import('../src/services/audioCapture.ts');
  const active = await startRecording();
  recorder.ondataavailable({ data: new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' }) });
  recorder.endStreamOnItsOwn();

  let ref = null;
  let stopThrew = null;
  try {
    ref = await active.stop();
  } catch (e) {
    stopThrew = e;
  }
  check('stopping an already-inactive recorder does not reject', stopThrew === null, stopThrew?.name);
  check('it returns the real recorded clip', !!ref && ref.uri.startsWith('blob:'), ref?.uri);
  check('never the sample clip', !!ref && isSampleCapture(ref.uri) === false, ref?.uri);

  globalThis.MediaRecorder = priorRecorder;
  Object.defineProperty(globalThis, 'navigator', { value: priorNavigator, configurable: true, writable: true });
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

// --- 5. The Transcript tab's contract: the reviewed transcript rides on the note itself ------------
// (decision item 3) `buildDraft` — not a caller re-attaching it after the fact — is the single source
// of truth for `DraftNote.transcript`, so every summarize() path (mock, offline-delegate, live cloud)
// carries it identically and the review screen never has to trust a UI-layer graft.
{
  const mock = new MockSummarizationService();

  const withText = await mock.summarize({ transcript: REAL_TRANSCRIPT });
  check('a real transcript rides on the returned note', withText.transcript === REAL_TRANSCRIPT, withText.transcript);

  const padded = await mock.summarize({ transcript: `  ${REAL_TRANSCRIPT}  ` });
  check('surrounding whitespace is trimmed, matching what the clinician reviewed', padded.transcript === REAL_TRANSCRIPT, padded.transcript);

  const blank = await mock.summarize({ transcript: '   ' });
  check('a whitespace-only transcript stores as absent, never a blank string', blank.transcript === undefined, String(blank.transcript));

  const empty = await mock.summarize({ transcript: '' });
  check('an empty transcript stores as absent too', empty.transcript === undefined, String(empty.transcript));

  // The offline (no-token) delegate path is the same buildDraft call, so it must carry the same field —
  // there is deliberately only one place this is decided.
  const offline = new GroqSummarizationService('https://proxy.invalid', async () => null, 'llama-3.3-70b-versatile');
  const offlineDraft = await offline.summarize({ transcript: REAL_TRANSCRIPT });
  check('the offline Groq-delegate path also stamps the transcript', offlineDraft.transcript === REAL_TRANSCRIPT, offlineDraft.transcript);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ subjective: { body: ['Reported a steadier fortnight.'] }, riskSafety: { level: 'clear' } }) } }],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  const live = new GroqSummarizationService('https://proxy.invalid', async () => 'session-token', 'llama-3.3-70b-versatile');
  const liveDraft = await live.summarize({ transcript: REAL_TRANSCRIPT, audioLeftDevice: true, transcriptFromCloud: true });
  check('the live cloud-drafted path stamps the same transcript the clinician reviewed', liveDraft.transcript === REAL_TRANSCRIPT, liveDraft.transcript);
  globalThis.fetch = originalFetch;
}

console.log(failed ? `\n${failed} assertion(s) failed` : '\nAll provenance assertions passed');
process.exit(failed ? 1 : 0);
