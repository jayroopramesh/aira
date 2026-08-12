/**
 * TranscriptionService — the on-device ASR seam.
 *
 * Transcription itself is OUT OF SCOPE for v1 (a separate whisper.cpp spike ran the
 * benchmark). This interface is shaped to that spike's findings so `whisper.rn` slots in
 * later without touching callers. Key decisions the seam encodes:
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
 * v1 uses `MockTranscriptionService` (mocked timing, canned transcript) so the session
 * flow's recording/analysing states demo end-to-end with no native module.
 */

export type WhisperModelId = 'small.en' | 'base.en' | 'large-v3-turbo-q5_0';

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

/** Canned de-identified transcript used to drive the mock analysing → draft transition. */
const MOCK_TRANSCRIPT_TEXT =
  'Client reports a steadier fortnight with improved sleep since starting the sleep log. ' +
  'Ongoing academic pressure ahead of an upcoming exam. Denies passive ideation on screening today. ' +
  'Agreed to continue the sleep log and practise an exam-specific cognitive reframe.';

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

export const transcriptionService: TranscriptionService = new MockTranscriptionService(1);
