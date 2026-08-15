/**
 * TranscriptionService — the on-device ASR seam.
 *
 * ON-DEVICE transcription itself is OUT OF SCOPE for v1 (a separate whisper.cpp spike ran
 * the benchmark). This interface is shaped to that spike's findings so `whisper.rn` slots
 * in later without touching callers. Key decisions the seam encodes:
 *
 *   • ONE-SHOT, post-session transcription — NOT streaming. Naive fixed-window chunking
 *     reproducibly hallucinates words at chunk boundaries; live transcription waits for a
 *     VAD-gated, overlap-stitched pipeline (v1.x+). So there is no partial/streaming
 *     callback here on purpose — `transcribe()` resolves once with the full transcript.
 *   • MODEL DOWNLOADED ON FIRST RUN, never bundled. `small.en` (~465 MB) is the v1 default
 *     (accuracy-safe vs base.en's homophone/name errors; 12.4× realtime is ample). The
 *     app ships with no model; `ensureModel()` fetches it the first time capture is used.
 *   • whisper.rn is a NATIVE module — it does NOT run in Expo Go. It requires
 *     expo-dev-client + `npx expo prebuild` + an EAS dev build. The mobile pipeline is
 *     structured for that from day one (see README → "Service seams").
 *   • After ASR, the transcript passes through on-device de-identification (OpenMed) before
 *     anything is drafted — identifiers never leave the device. Modelled as `deidentify`.
 *
 * The app-wide handle is `GroqTranscriptionService` (whisper-large-v3 — a disclosed cloud
 * hop, see its doc comment below) when Groq is configured, and `MockTranscriptionService`
 * (mocked timing, canned sample transcript) otherwise; neither needs a native module.
 *
 * ONE RULE HOLDS ON EVERY BUILD: a real recording is never answered with invented words. Whichever
 * handle is in play, it either returns a transcript actually produced from THAT audio or it rejects
 * — the cloud one with `CloudSessionRequiredError` when there is no session, the on-device one with
 * `TranscriptionUnavailableError` for anything that is not the built-in `mock://` sample clip. The
 * capture screen turns either rejection into the "type or paste the transcript" recovery.
 */

import { env, hasGroq } from '../config/env';
import { CloudSessionRequiredError } from './cloudSession';
import { getAccessToken } from './supabase';

export type WhisperModelId = 'small.en' | 'base.en' | 'large-v3-turbo-q5_0' | 'whisper-large-v3';

export type ModelStatus =
  | { state: 'absent' }
  | { state: 'downloading'; progress: number } // 0..1
  | { state: 'ready'; sizeBytes: number };

export type TranscriptSegment = { startMs: number; endMs: number; text: string };

export type Transcript = {
  /** Full de-identified text (identifiers already tokenized on-device). */
  text: string;
  segments: TranscriptSegment[];
  durationMs: number;
  model: WhisperModelId;
  /** True once the on-device de-identification hop has run over the transcript. */
  deidentified: boolean;
};

/** A handle to captured audio. In production this is an on-device file URI, never uploaded. */
export type CaptureRef = { uri: string; durationMs: number };

export interface TranscriptionService {
  /** The v1 default model id for this platform. */
  readonly defaultModel: WhisperModelId;
  /** Whether the real engine needs a custom dev build (true for whisper.rn on native). */
  readonly requiresDevBuild: boolean;

  getModelStatus(model?: WhisperModelId): Promise<ModelStatus>;
  /** Download the model on first run (never bundled). Reports progress 0..1. */
  ensureModel(model: WhisperModelId, onProgress?: (p: number) => void): Promise<void>;

  /** One-shot, post-session transcription. Resolves once with the full transcript. */
  transcribe(
    audio: CaptureRef,
    opts?: { model?: WhisperModelId; onStage?: (stage: 'preparing' | 'transcribing' | 'deidentifying') => void; signal?: AbortSignal },
  ): Promise<Transcript>;
}

/**
 * Raised when no transcription ENGINE exists for this capture — as opposed to a cloud engine that
 * exists but has no session (`CloudSessionRequiredError`). Signing in cannot fix this one, so the
 * capture screen must offer the type/paste path and NOT the cloud sign-in action.
 */
export const TRANSCRIPTION_UNAVAILABLE = 'TranscriptionUnavailableError';

export class TranscriptionUnavailableError extends Error {
  readonly name = TRANSCRIPTION_UNAVAILABLE;
}

export function isTranscriptionUnavailableError(e: unknown): boolean {
  return (e as Error | undefined)?.name === TRANSCRIPTION_UNAVAILABLE;
}

/** True for the built-in demo clip (`mock://…`), which is not a recording of anyone. */
export function isSampleCapture(uri: string): boolean {
  return uri.startsWith('mock://');
}

/**
 * The canned transcript that drives the walkthrough. It belongs to the `mock://` SAMPLE CLIP and to
 * nothing else — see `MockTranscriptionService.transcribe`, which refuses to return it for a real
 * recording.
 */
const MOCK_TRANSCRIPT_TEXT =
  'Client reports a steadier fortnight with improved sleep since starting the sleep log. ' +
  'Ongoing academic pressure ahead of an upcoming exam. Denies passive ideation on screening today. ' +
  'Agreed to continue the sleep log and practise an exam-specific cognitive reframe.';

/**
 * The on-device stand-in. It does NOT transcribe: it replays a canned transcript for the built-in
 * `mock://` sample clip so the capture → analysing → draft walkthrough demos with no keys.
 *
 * It therefore refuses any OTHER capture. Returning the canned text for a real recording would put
 * words in a client's mouth — including "Denies passive ideation on screening today", a safety
 * finding nobody made — and the note would present it as the session. That is the same fabrication
 * the cloud transcriber refuses when it has no session, and the rule holds identically on an
 * unconfigured build: a real recording either gets a real transcript or gets none, never an invented
 * one. The capture screen turns the refusal into the type/paste recovery.
 */
export class MockTranscriptionService implements TranscriptionService {
  readonly defaultModel: WhisperModelId = 'small.en';
  readonly requiresDevBuild = false; // the mock runs anywhere; the real whisper.rn does not

  private status: ModelStatus = { state: 'ready', sizeBytes: 465_000_000 };

  /** Speed multiplier so the walkthrough doesn't wait the real ~4 min. */
  constructor(private readonly demoScale = 1) {}

  async getModelStatus(): Promise<ModelStatus> {
    return this.status;
  }

  async ensureModel(_model: WhisperModelId, onProgress?: (p: number) => void): Promise<void> {
    // Simulate a first-run download; real impl streams the ggml model to disk.
    for (let p = 0; p <= 1.0001; p += 0.25) {
      onProgress?.(Math.min(p, 1));
      await delay(120 * this.demoScale);
    }
    this.status = { state: 'ready', sizeBytes: 465_000_000 };
  }

  async transcribe(
    audio: CaptureRef,
    opts?: { model?: WhisperModelId; onStage?: (stage: 'preparing' | 'transcribing' | 'deidentifying') => void; signal?: AbortSignal },
  ): Promise<Transcript> {
    const model = opts?.model ?? this.defaultModel;
    if (!isSampleCapture(audio.uri)) {
      throw new TranscriptionUnavailableError(
        'No automatic transcription is available in this build — type or paste the transcript instead.',
      );
    }
    opts?.onStage?.('preparing');
    await delay(400 * this.demoScale, opts?.signal);
    opts?.onStage?.('transcribing');
    await delay(1600 * this.demoScale, opts?.signal);
    opts?.onStage?.('deidentifying'); // on-device OpenMed hop before drafting
    await delay(500 * this.demoScale, opts?.signal);
    return {
      text: MOCK_TRANSCRIPT_TEXT,
      segments: [{ startMs: 0, endMs: audio.durationMs, text: MOCK_TRANSCRIPT_TEXT }],
      durationMs: audio.durationMs,
      model,
      deidentified: true,
    };
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

/**
 * GroqTranscriptionService — DEMO-mode transcription (whisper-large-v3) via the server-side
 * groq-proxy Edge Function, NOT Groq directly: the Groq key lives as a Supabase secret and never
 * ships in the bundle. This is a CLOUD hop: the recorded (or uploaded) audio is POSTed to the proxy
 * (which forwards it to Groq) with the counselor's Supabase session token. That's an honest
 * departure from the on-device story, disclosed by the app's demo-mode banner. No model is
 * downloaded — it runs server-side — so `ensureModel` is a no-op and `requiresDevBuild` is false.
 *
 * Not signed in (no session token) REJECTS with a CloudSessionRequiredError — it never falls back to
 * the mock. The proxy requires a signed-in counselor, so with no token there is no cloud path to
 * take; substituting the mock's canned transcript for a real recording would attach fabricated
 * clinical content to the session and leave the note claiming a cloud hop that never ran. The
 * capture screen catches this and offers the calm "paste the transcript" recovery. (Drafting is the
 * opposite: it falls back on-device, because drafting the clinician's own words invents nothing.)
 *
 * The `transcribing` stage marks the moment the audio is HANDED TO THE NETWORK — `onStage` fires
 * immediately before the POST. Everything after it means the recording left the device, whether the
 * call then succeeds, 429s, 5xxes or drops, so the capture screen keys its "audio left the device"
 * provenance off that stage rather than off a successful return.
 *
 * There is NO on-device de-identification hop in demo mode (that needs the native OpenMed model),
 * so `deidentified` is false; the summarizer's clinical prompt is instructed to avoid echoing
 * raw identifiers, and the banner keeps the trust copy honest.
 */
export class GroqTranscriptionService implements TranscriptionService {
  readonly defaultModel: WhisperModelId = 'whisper-large-v3';
  readonly requiresDevBuild = false;

  constructor(
    private readonly proxyUrl: string,
    private readonly getToken: () => Promise<string | null>,
    private readonly model = 'whisper-large-v3',
  ) {}

  async getModelStatus(): Promise<ModelStatus> {
    // Server-side model — always "ready" from the client's perspective.
    return { state: 'ready', sizeBytes: 0 };
  }

  async ensureModel(_model: WhisperModelId, onProgress?: (p: number) => void): Promise<void> {
    onProgress?.(1);
  }

  async transcribe(
    audio: CaptureRef,
    opts?: { model?: WhisperModelId; onStage?: (stage: 'preparing' | 'transcribing' | 'deidentifying') => void; signal?: AbortSignal },
  ): Promise<Transcript> {
    const token = await this.getToken();
    // No signed-in session → no server-side cloud path. Reject rather than fabricate a transcript.
    if (!token) {
      throw new CloudSessionRequiredError('Sign in to use cloud transcription — there is no active session.');
    }

    opts?.onStage?.('preparing');

    // Pull the captured audio into a Blob. On web this is a blob:/File URI from MediaRecorder or
    // the file picker; fetch() resolves both.
    const resp = await fetch(audio.uri, { signal: opts?.signal });
    const blob = await resp.blob();
    const filename = guessFilename(blob.type);

    const form = new FormData();
    // React Native's FormData accepts a Blob on web; the cast keeps TS happy across platforms.
    form.append('file', blob as unknown as Blob, filename);
    form.append('model', opts?.model ?? this.model);
    form.append('response_format', 'verbose_json');
    form.append('temperature', '0');

    opts?.onStage?.('transcribing');
    const res = await fetch(`${this.proxyUrl}/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: opts?.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Groq transcription failed (${res.status}). ${detail.slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      text?: string;
      duration?: number;
      segments?: { start: number; end: number; text: string }[];
    };

    const text = (json.text ?? '').trim();
    const segments: TranscriptSegment[] = (json.segments ?? []).map((s) => ({
      startMs: Math.round((s.start ?? 0) * 1000),
      endMs: Math.round((s.end ?? 0) * 1000),
      text: s.text.trim(),
    }));

    return {
      text,
      segments: segments.length ? segments : [{ startMs: 0, endMs: audio.durationMs, text }],
      durationMs: json.duration != null ? Math.round(json.duration * 1000) : audio.durationMs,
      model: (opts?.model ?? this.model) as WhisperModelId,
      deidentified: false, // cloud demo — on-device OpenMed de-id is not run here
    };
  }
}

function guessFilename(mime: string): string {
  if (mime.includes('webm')) return 'session.webm';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'session.m4a';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'session.mp3';
  if (mime.includes('wav')) return 'session.wav';
  if (mime.includes('ogg')) return 'session.ogg';
  return 'session.webm';
}

/**
 * The app-wide transcription handle. Groq-backed when configured (real whisper-large-v3),
 * otherwise the mock so the recording/analysing flow still demos with no keys.
 */
export const transcriptionService: TranscriptionService = hasGroq
  ? new GroqTranscriptionService(env.groq.proxyUrl, getAccessToken, env.groq.transcriptionModel)
  : new MockTranscriptionService(1);
