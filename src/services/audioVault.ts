/**
 * audioVault — an IN-MEMORY registry of the real audio blob: URIs a capture produced, so the review
 * screen's "Keep the audio" toggle can offer a REAL stitched playback (the original recording plus
 * every "Continue recording" segment appended after it) instead of the promise alone.
 *
 * Deliberately module-scope, in-memory, and NEVER written through the vault seam
 * (`deviceStore`/`ClientRepository`): a `blob:` object URL is only valid for the lifetime of THIS
 * page load, so persisting the string itself across a reload would be a dead reference, and this app
 * has no Blob-capable device storage (the vault is a JSON string store — see `deviceStore.ts`).
 * "Keep the audio" already reads as scoped to "for this session" in the existing AudioTrust copy
 * (`review.tsx`), so an in-memory vault under-promises nothing: audio genuinely is NOT retained past
 * this browser tab's lifetime, which is honestly disclosed, not silently different from the copy.
 *
 * Only REAL captures are ever registered (`isRealAudioUri` — a `blob:` URI from MediaRecorder or the
 * file picker). `mock://` (the sample clip) and `capture://unavailable` (a failed real recording)
 * never enter here, so a demo session or a failed capture can never be offered a fabricated "kept
 * audio" playback.
 */

export type AudioSegment = {
  uri: string;
  durationMs: number;
  /** 'original' is the note's first capture; 'added' is a later "Continue recording" append. */
  kind: 'original' | 'added';
  /** Shown next to the currently-playing segment, e.g. "Original recording" or "Added · 17 Aug 21:11". */
  label: string;
};

const store = new Map<string, AudioSegment[]>();

function noteKey(clientId: string, noteIndex: number): string {
  return `${clientId}::${noteIndex}`;
}

/** Only a real MediaRecorder/file-picker capture is a `blob:` URI — never the sample clip or a failure. */
export function isRealAudioUri(uri: string): boolean {
  return uri.startsWith('blob:');
}

/** Register the FIRST segment for a note, replacing anything previously stored under this key. */
export function setOriginalAudioSegment(clientId: string, noteIndex: number, segment: AudioSegment): void {
  if (!isRealAudioUri(segment.uri)) return;
  store.set(noteKey(clientId, noteIndex), [segment]);
}

/** Append a later "Continue recording" segment onto the note's existing list, in order. */
export function addAudioSegment(clientId: string, noteIndex: number, segment: AudioSegment): void {
  if (!isRealAudioUri(segment.uri)) return;
  const key = noteKey(clientId, noteIndex);
  store.set(key, [...(store.get(key) ?? []), segment]);
}

/** Every real audio segment kept for this note THIS SESSION, oldest first — empty if none/reloaded. */
export function getAudioSegments(clientId: string, noteIndex: number): AudioSegment[] {
  return store.get(noteKey(clientId, noteIndex)) ?? [];
}
