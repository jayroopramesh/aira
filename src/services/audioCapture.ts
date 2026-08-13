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
  recorder.start();

  return {
    stop: () =>
      new Promise<CaptureRef>((resolve) => {
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
          resolve({ uri: URL.createObjectURL(blob), durationMs: Date.now() - startedAt });
        };
        recorder.stop();
      }),
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
