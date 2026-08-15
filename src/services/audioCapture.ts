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
    const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
    resolveClip({ uri: URL.createObjectURL(blob), durationMs: Date.now() - startedAt });
  };

  recorder.onstop = finish;
  recorder.start();

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
