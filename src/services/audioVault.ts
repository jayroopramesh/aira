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
 *
 * DELETION IS REAL here, not a UI state (round 5, 2026-08-18). The app's copy promises the recording
 * is deleted unless the clinician keeps it, and for a whole round that claim was cosmetic: nothing
 * ever revoked the blob URL, so the "deleted" audio stayed alive and fetchable in this tab for as
 * long as it lived — the review card even offered to resurrect and replay it. Now each note's audio
 * carries a DISPOSITION and the deletion moment is sign-off:
 *   • 'held'      — captured, awaiting the clinician's decision; lives only in this tab's memory.
 *   • 'kept'      — the clinician chose to keep it for this session (replay stays possible).
 *   • 'discarded' — `discardAudio` ran: every segment's object URL was REVOKED (the browser drops
 *                   the underlying Blob) and the registry entry cleared. There is no resurrect path.
 * `discardAudioUnlessKept` is what sign-off calls, so "Recording deleted" in the UI is an OBSERVED
 * fact (the revocation actually ran), the same posture as the note's provenance line. Replacing a
 * note's audio (`setOriginalAudioSegment`, the re-record path) revokes the clip it replaces for the
 * same reason — a discarded recording must actually be unreachable, not merely unlisted.
 */

export type AudioSegment = {
  uri: string;
  durationMs: number;
  /** 'original' is the note's first capture; 'added' is a later "Continue recording" append. */
  kind: 'original' | 'added';
  /** Shown next to the currently-playing segment, e.g. "Original recording" or "Added · 17 Aug 21:11". */
  label: string;
};

/** What has happened to a note's captured audio THIS tab — see the module doc above. */
export type AudioDisposition = 'held' | 'kept' | 'discarded';

const store = new Map<string, AudioSegment[]>();
const dispositions = new Map<string, AudioDisposition>();

/**
 * REACTIVITY IS PART OF THE CONTRACT, not a nicety. This app compiles with the React Compiler
 * (`app.json` → `experiments.reactCompiler`), which memoizes render-time expressions on the props
 * they mention — so a component that calls `getAudioSegments(clientId, noteIndex)` bare in render
 * gets that read CACHED forever (clientId/noteIndex never change) and keeps rendering the pre-sign
 * state after the recording was actually discarded. That shipped once: the review card said
 * "Recording held" over a blob that sign-off had already revoked. Render-time readers MUST go
 * through `useSyncExternalStore(subscribeAudioVault, …getAudioVaultSnapshot…)`; every mutation here
 * bumps the version and notifies, and snapshots are cached per key so an unchanged store returns a
 * referentially stable value (what `useSyncExternalStore` requires to not loop).
 */
type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;

function notify(): void {
  version++;
  for (const l of [...listeners]) l();
}

/** Subscribe to any vault mutation. Returns the unsubscribe — the `useSyncExternalStore` shape. */
export function subscribeAudioVault(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export type AudioVaultSnapshot = { segments: AudioSegment[]; disposition: AudioDisposition };

/** The stable empty snapshot for callers with no note key to read (referential stability matters). */
export const EMPTY_AUDIO_VAULT_SNAPSHOT: AudioVaultSnapshot = { segments: [], disposition: 'held' };

const snapshotCache = new Map<string, { version: number; snap: AudioVaultSnapshot }>();

/** A note's current audio state as one referentially-stable value — the `getSnapshot` for readers. */
export function getAudioVaultSnapshot(clientId: string, noteIndex: number): AudioVaultSnapshot {
  const key = noteKey(clientId, noteIndex);
  const hit = snapshotCache.get(key);
  if (hit && hit.version === version) return hit.snap;
  const snap: AudioVaultSnapshot = {
    segments: store.get(key) ?? EMPTY_AUDIO_VAULT_SNAPSHOT.segments,
    disposition: dispositions.get(key) ?? 'held',
  };
  snapshotCache.set(key, { version, snap });
  return snap;
}

function noteKey(clientId: string, noteIndex: number): string {
  return `${clientId}::${noteIndex}`;
}

/**
 * Actually release a blob: URI — after this the browser drops its reference to the Blob and the
 * audio can no longer be fetched or played from this URL. Best-effort: absent API (native/tests)
 * or an already-revoked URL must never throw the caller off the sign-off path.
 */
function revokeUri(uri: string): void {
  try {
    (globalThis as { URL?: { revokeObjectURL?: (u: string) => void } }).URL?.revokeObjectURL?.(uri);
  } catch {
    /* best-effort — revoking twice or on a non-blob URI is not an error worth surfacing */
  }
}

/** Only a real MediaRecorder/file-picker capture is a `blob:` URI — never the sample clip or a failure. */
export function isRealAudioUri(uri: string): boolean {
  return uri.startsWith('blob:');
}

/**
 * Register the FIRST segment for a note, replacing anything previously stored under this key. The
 * replaced clip's object URLs are REVOKED — a re-record throws the old recording away, and "thrown
 * away" must mean unreachable, not just unlisted. The note's disposition resets to 'held': this is a
 * fresh recording awaiting its own keep-or-delete decision.
 */
export function setOriginalAudioSegment(clientId: string, noteIndex: number, segment: AudioSegment): void {
  if (!isRealAudioUri(segment.uri)) return;
  const key = noteKey(clientId, noteIndex);
  for (const old of store.get(key) ?? []) revokeUri(old.uri);
  store.set(key, [segment]);
  dispositions.delete(key);
  notify();
}

/**
 * Append a later "Continue recording" segment onto the note's existing list, in order. A note whose
 * earlier audio was discarded returns to 'held' — there is a real recording to decide about again.
 */
export function addAudioSegment(clientId: string, noteIndex: number, segment: AudioSegment): void {
  if (!isRealAudioUri(segment.uri)) return;
  const key = noteKey(clientId, noteIndex);
  store.set(key, [...(store.get(key) ?? []), segment]);
  if (dispositions.get(key) === 'discarded') dispositions.delete(key);
  notify();
}

/** Every real audio segment kept for this note THIS SESSION, oldest first — empty if none/reloaded. */
export function getAudioSegments(clientId: string, noteIndex: number): AudioSegment[] {
  return store.get(noteKey(clientId, noteIndex)) ?? [];
}

/** The note's audio disposition THIS tab. 'held' is the default (nothing decided, nothing discarded). */
export function getAudioDisposition(clientId: string, noteIndex: number): AudioDisposition {
  return dispositions.get(noteKey(clientId, noteIndex)) ?? 'held';
}

/**
 * The clinician's keep decision. Keeping marks the audio 'kept' so sign-off leaves it alone;
 * un-keeping BEFORE sign-off returns it to 'held' (still pending — sign-off will delete it). This
 * never deletes by itself: `discardAudio` is the only deletion path, so a stray toggle can't destroy
 * a recording the clinician was still deciding about.
 */
export function setAudioKept(clientId: string, noteIndex: number, keep: boolean): void {
  const key = noteKey(clientId, noteIndex);
  if (keep) dispositions.set(key, 'kept');
  else if (dispositions.get(key) === 'kept') dispositions.set(key, 'held');
  else return; // nothing changed — don't wake subscribers
  notify();
}

/**
 * REALLY delete a note's audio: revoke every segment's object URL (the browser releases the Blob —
 * the audio is no longer fetchable from this tab) and clear the registry entry. Idempotent.
 */
export function discardAudio(clientId: string, noteIndex: number): void {
  const key = noteKey(clientId, noteIndex);
  for (const seg of store.get(key) ?? []) revokeUri(seg.uri);
  store.delete(key);
  dispositions.set(key, 'discarded');
  notify();
}

/**
 * The sign-off hook: deletion is the default at the moment a note is signed, and the clinician's
 * explicit keep is the only thing that prevents it. Returns whether a discard actually ran, so the
 * caller could disclose it if it ever needs to.
 */
export function discardAudioUnlessKept(clientId: string, noteIndex: number): boolean {
  if (getAudioDisposition(clientId, noteIndex) === 'kept') return false;
  discardAudio(clientId, noteIndex);
  return true;
}
