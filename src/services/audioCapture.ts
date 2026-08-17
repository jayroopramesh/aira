/**
 * audioCapture — web-first session audio input for the demo.
 *
 * The demo's transcription target is the web build, where MediaRecorder captures the microphone.
 * A file-picker fallback lets you transcribe an uploaded clip (handy for testing without a mic, or
 * on a device where recording isn't available). Both resolve to a CaptureRef (a blob: URI +
 * duration) that the TranscriptionService uploads to Groq.
 *
 * On native (Expo Go) there is no MediaRecorder and no whisper.rn dev build here, so recording is
 * reported unsupported and the session flow falls back to the mock transcript.
 */

import { Platform } from 'react-native';
import { CaptureRef } from './transcription';

type MediaRecorderInstance = {
  start: () => void;
  stop: () => void;
  pause?: () => void;
  resume?: () => void;
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  state: string;
};

export function isRecordingSupported(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof (globalThis as { MediaRecorder?: unknown }).MediaRecorder !== 'undefined'
  );
}

export function isUploadSupported(): boolean {
  return Platform.OS === 'web' && typeof document !== 'undefined';
}

export type ActiveRecording = {
  /** Stop capture and resolve the recorded clip as a CaptureRef. */
  stop: () => Promise<CaptureRef>;
  /**
   * Pause/resume the SAME in-progress capture — a paused-then-resumed recording is still ONE
   * segment (MediaRecorder keeps writing into the same clip; this is distinct from "Continue
   * recording", which starts a whole new segment appended to an already-drafted note). No-ops when
   * `supportsPause` is false or the recorder isn't in the expected state, so a caller doesn't need
   * to track recorder state itself to call these safely.
   */
  pause: () => void;
  resume: () => void;
  /** Whether this recorder actually supports pause/resume — gate the UI on this, never assume. */
  supportsPause: boolean;
  /**
   * Real per-bar input levels (0..1, one per requested bar) sampled from the SAME MediaStream
   * MediaRecorder is encoding, via a Web Audio AnalyserNode — never a canned animation. Returns
   * `null` when no live analyser exists (Web Audio unsupported in this browser), so callers can
   * honestly fall back to an ambient animation instead of faking responsiveness. Flattens to zero
   * while paused, since nothing is being captured then.
   */
  getLevels: (bars: number) => number[] | null;
};

/**
 * The capture ref for a real recording we could not finalise (no clip to hand back).
 *
 * It is deliberately NOT a `mock://` uri. `mock://` means "the built-in sample clip, with no real
 * person in it", and that is what licenses the canned transcript and the canned walkthrough note —
 * so labelling a failed REAL recording as the sample would put invented words and an invented
 * diagnosis on an actual client. This uri routes through the ordinary real-capture path instead,
 * which refuses to transcribe and lands the clinician in the type/paste recovery.
 */
export function failedCaptureRef(durationMs = 0): CaptureRef {
  return { uri: 'capture://unavailable', durationMs };
}

/** Begin microphone capture (web). Rejects if the mic is denied or unsupported. */
export async function startRecording(): Promise<ActiveRecording> {
  if (!isRecordingSupported()) throw new Error('Recording is not supported on this platform.');

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const MR = (globalThis as { MediaRecorder: new (s: MediaStream, opts?: unknown) => MediaRecorderInstance }).MediaRecorder;
  const mimeType = pickMimeType();
  const recorder = new MR(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  const startedAt = Date.now();
  // Paused time must not count as recorded duration — a 10-minute session with 2 minutes paused is
  // an 8-minute clip, not 10. Tracked here rather than trusted to a UI timer, so `stop()`'s
  // `durationMs` is right even if the caller's own on-screen clock drifts.
  let totalPausedMs = 0;
  let pausedAt: number | null = null;

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  // The recorder can stop WITHOUT us asking: when every track of the captured stream ends (mic
  // unplugged, permission revoked mid-session, device switch) it fires `stop` and goes `inactive` on
  // its own. Attaching the handler here, before `start`, means that clip is still captured — and a
  // later `recorder.stop()` then throws InvalidStateError against an already-finished recording,
  // which must not be allowed to look like a capture failure. The counselor's audio is in `chunks`
  // either way, so settle from there exactly once.
  let settled = false;
  let resolveClip: (ref: CaptureRef) => void;
  const clip = new Promise<CaptureRef>((resolve) => {
    resolveClip = resolve;
  });
  const finish = () => {
    if (settled) return;
    settled = true;
    stream.getTracks().forEach((t) => t.stop());
    audioCtx?.close().catch(() => {});
    const stillPausedMs = pausedAt !== null ? Date.now() - pausedAt : 0;
    const durationMs = Math.max(0, Date.now() - startedAt - totalPausedMs - stillPausedMs);
    const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
    resolveClip({ uri: URL.createObjectURL(blob), durationMs });
  };

  recorder.onstop = finish;
  recorder.start();

  const supportsPause = typeof recorder.pause === 'function' && typeof recorder.resume === 'function';
  const pause = () => {
    if (!supportsPause || recorder.state !== 'recording') return;
    recorder.pause?.();
    pausedAt = Date.now();
  };
  const resume = () => {
    if (!supportsPause || recorder.state !== 'paused') return;
    recorder.resume?.();
    if (pausedAt !== null) {
      totalPausedMs += Date.now() - pausedAt;
      pausedAt = null;
    }
  };

  // A Web Audio AnalyserNode tapped off the SAME stream MediaRecorder reads, so the waveform reflects
  // the real mic signal rather than a canned loop. Deliberately never connected to
  // `audioCtx.destination` — this only reads levels, it must never play the mic back and cause
  // feedback. Best-effort: some embed/test environments lack `AudioContext` entirely, and that must
  // degrade to "no live levels" rather than throw and abort the whole recording.
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let freqData: Uint8Array<ArrayBuffer> | null = null;
  try {
    const AC = (globalThis as { AudioContext?: new () => AudioContext }).AudioContext;
    if (AC) {
      audioCtx = new AC();
      const source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64; // 32 frequency bins — plenty for a bar count this small, and cheap per frame
      source.connect(analyser);
      freqData = new Uint8Array(analyser.frequencyBinCount);
    }
  } catch {
    audioCtx = null;
    analyser = null;
    freqData = null;
  }

  const getLevels = (bars: number): number[] | null => {
    if (!analyser || !freqData || bars <= 0) return null;
    if (pausedAt !== null) return new Array(bars).fill(0); // flatten — nothing is being captured
    analyser.getByteFrequencyData(freqData);
    const binSize = Math.max(1, Math.floor(freqData.length / bars));
    const levels: number[] = [];
    for (let i = 0; i < bars; i++) {
      let sum = 0;
      let n = 0;
      for (let j = i * binSize; j < Math.min(freqData.length, (i + 1) * binSize); j++) {
        sum += freqData[j];
        n++;
      }
      levels.push(n ? sum / n / 255 : 0);
    }
    return levels;
  };

  return {
    stop: async () => {
      try {
        if (recorder.state !== 'inactive') recorder.stop();
        else finish();
      } catch {
        finish();
      }
      return clip;
    },
    pause,
    resume,
    supportsPause,
    getLevels,
  };
}

/** Open the browser file picker and resolve the chosen audio clip as a CaptureRef (web only). */
export function pickAudioFile(): Promise<CaptureRef | null> {
  if (!isUploadSupported()) return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      resolve({ uri: URL.createObjectURL(file), durationMs: 0 });
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

function pickMimeType(): string | undefined {
  const MR = (globalThis as { MediaRecorder?: { isTypeSupported?: (t: string) => boolean } }).MediaRecorder;
  const supported = MR?.isTypeSupported;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  if (!supported) return undefined;
  return candidates.find((t) => supported.call(MR, t));
}
