/**
 * audioVault harness. Proves the in-memory registry behind the review screen's stitched playback
 * ("Continue recording" captain addition, 2026-08-17):
 *   1. Only REAL captures (`blob:` URIs) are ever registered — never the sample clip or a failed
 *      capture, so a demo session or a dead mic can never be offered a fabricated "kept audio" replay.
 *   2. Segments accumulate in order (original, then each later append) under a stable per-note key.
 *   3. An unknown note key returns empty, not undefined/throw — the review screen reads this
 *      unconditionally on every signed note, most of which will have nothing registered.
 *   4. (round 5, 2026-08-18) DELETION IS REAL, never a UI state: "Recording deleted" in the app may
 *      only ever describe a discard that actually REVOKED every blob URL. Sign-off's
 *      `discardAudioUnlessKept` deletes unless the clinician's keep decision says otherwise, a
 *      re-record's replacement revokes the clip it throws away, and a discarded note has no
 *      resurrect path (its registry entry is gone, its disposition says 'discarded').
 *
 * Run (Node ≥ 22.13, e.g. ~/.cache/fm-node/node-v22.23.2-darwin-arm64/bin/node):
 *   node --experimental-strip-types scripts/audio-vault-harness.mjs
 * Exits non-zero on the first failed assertion.
 */
import {
  addAudioSegment,
  discardAudio,
  discardAudioUnlessKept,
  getAudioDisposition,
  getAudioSegments,
  getAudioVaultSnapshot,
  isRealAudioUri,
  setAudioKept,
  setOriginalAudioSegment,
  subscribeAudioVault,
} from '../src/services/audioVault.ts';

// Stub the browser's revocation API so the harness can OBSERVE deletion. Node's URL class has no
// revokeObjectURL; the vault reaches it via optional chaining, so attaching a recorder here is the
// same shape the browser provides.
const revoked = [];
globalThis.URL.revokeObjectURL = (uri) => revoked.push(uri);

let failed = 0;
function check(name, ok, detail) {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (${detail})`}`);
}

check('a blob: uri is real audio', isRealAudioUri('blob:https://app.example/9f2c') === true);
check('the sample clip is never real audio', isRealAudioUri('mock://session') === false);
check('a failed-capture uri is never real audio', isRealAudioUri('capture://unavailable') === false);

// --- 1. Only real captures are ever stored ---------------------------------------------------------
{
  setOriginalAudioSegment('amara', 0, { uri: 'mock://session', durationMs: 1000, kind: 'original', label: 'Original recording' });
  check('a sample-clip original is silently never registered', getAudioSegments('amara', 0).length === 0, JSON.stringify(getAudioSegments('amara', 0)));

  addAudioSegment('amara', 0, { uri: 'capture://unavailable', durationMs: 0, kind: 'added', label: 'Added · 17 Aug 21:11' });
  check('a failed-capture addition is silently never registered', getAudioSegments('amara', 0).length === 0, JSON.stringify(getAudioSegments('amara', 0)));
}

// --- 2. Real segments accumulate in order under a stable key ---------------------------------------
{
  setOriginalAudioSegment('amara', 0, { uri: 'blob:https://app.example/original', durationMs: 47 * 60 * 1000, kind: 'original', label: 'Original recording' });
  addAudioSegment('amara', 0, { uri: 'blob:https://app.example/added-1', durationMs: 90 * 1000, kind: 'added', label: 'Added · 17 Aug 21:11' });
  addAudioSegment('amara', 0, { uri: 'blob:https://app.example/added-2', durationMs: 45 * 1000, kind: 'added', label: 'Added · 17 Aug 21:32' });

  const segs = getAudioSegments('amara', 0);
  check('all three real segments are present', segs.length === 3, String(segs.length));
  check('the original comes first', segs[0].uri === 'blob:https://app.example/original', segs[0]?.uri);
  check('the appends follow in the order they were added', segs[1].uri.endsWith('added-1') && segs[2].uri.endsWith('added-2'), JSON.stringify(segs.map((s) => s.uri)));
  check('each segment keeps its own kind', segs[0].kind === 'original' && segs[1].kind === 'added' && segs[2].kind === 'added', JSON.stringify(segs.map((s) => s.kind)));

  // A fresh capture for the SAME client/note key (e.g. a signed note re-recorded) replaces, not appends.
  setOriginalAudioSegment('amara', 0, { uri: 'blob:https://app.example/re-recorded', durationMs: 1000, kind: 'original', label: 'Original recording' });
  const replaced = getAudioSegments('amara', 0);
  check('setOriginalAudioSegment REPLACES the prior list, not appends to it', replaced.length === 1 && replaced[0].uri.endsWith('re-recorded'), JSON.stringify(replaced));
}

// --- 3. Different clients/notes never cross-contaminate --------------------------------------------
{
  setOriginalAudioSegment('marcus', 0, { uri: 'blob:https://app.example/marcus-original', durationMs: 1000, kind: 'original', label: 'Original recording' });
  check("amara's segments are untouched by marcus's registration", getAudioSegments('amara', 0).length === 1, String(getAudioSegments('amara', 0).length));
  check("marcus's own segment is present under his own key", getAudioSegments('marcus', 0).length === 1, String(getAudioSegments('marcus', 0).length));

  setOriginalAudioSegment('amara', 1, { uri: 'blob:https://app.example/amara-note-1', durationMs: 1000, kind: 'original', label: 'Original recording' });
  check('a different note INDEX for the same client is a different key', getAudioSegments('amara', 0).length === 1 && getAudioSegments('amara', 1).length === 1);
}

// --- 4. An unknown key returns empty, never throws/undefined ---------------------------------------
{
  const segs = getAudioSegments('no-such-client', 7);
  check('an unregistered note returns an empty array', Array.isArray(segs) && segs.length === 0, JSON.stringify(segs));
  check('an unknown note reads as held (nothing decided, nothing discarded)', getAudioDisposition('no-such-client', 7) === 'held', getAudioDisposition('no-such-client', 7));
}

// --- 5. Deletion is real: sign-off discards unless kept, and a discard revokes the blob URLs -------
{
  revoked.length = 0;
  setOriginalAudioSegment('yuki', 0, { uri: 'blob:https://app.example/yuki-original', durationMs: 60_000, kind: 'original', label: 'Original recording' });
  addAudioSegment('yuki', 0, { uri: 'blob:https://app.example/yuki-added', durationMs: 30_000, kind: 'added', label: 'Added · 18 Aug 10:02' });
  check('a fresh capture starts held, awaiting the keep-or-delete decision', getAudioDisposition('yuki', 0) === 'held', getAudioDisposition('yuki', 0));

  // Kept → sign-off leaves the audio alone: nothing revoked, segments intact, disposition 'kept'.
  setAudioKept('yuki', 0, true);
  check('keeping marks the disposition kept', getAudioDisposition('yuki', 0) === 'kept', getAudioDisposition('yuki', 0));
  const discardedWhileKept = discardAudioUnlessKept('yuki', 0);
  check('sign-off does NOT discard a kept recording', discardedWhileKept === false && getAudioSegments('yuki', 0).length === 2, JSON.stringify({ discardedWhileKept, segments: getAudioSegments('yuki', 0).length }));
  check('nothing was revoked while kept', revoked.length === 0, JSON.stringify(revoked));

  // Un-keeping BEFORE sign-off returns to held (pending) — it does not delete by itself.
  setAudioKept('yuki', 0, false);
  check('un-keeping before sign-off returns to held without deleting', getAudioDisposition('yuki', 0) === 'held' && getAudioSegments('yuki', 0).length === 2 && revoked.length === 0);

  // Sign-off without keep → REAL deletion: every segment's URL revoked, registry cleared, disposition observed.
  const discarded = discardAudioUnlessKept('yuki', 0);
  check('sign-off without keep discards', discarded === true && getAudioSegments('yuki', 0).length === 0, JSON.stringify(getAudioSegments('yuki', 0)));
  check('the discard REVOKED every segment blob URL', revoked.length === 2 && revoked.includes('blob:https://app.example/yuki-original') && revoked.includes('blob:https://app.example/yuki-added'), JSON.stringify(revoked));
  check("the disposition records the observed deletion ('discarded')", getAudioDisposition('yuki', 0) === 'discarded', getAudioDisposition('yuki', 0));

  // Idempotent: a second discard neither throws nor double-revokes.
  discardAudio('yuki', 0);
  check('a second discard is idempotent (no double revocation)', revoked.length === 2, JSON.stringify(revoked));

  // A discarded note cannot be resurrected into 'kept' by the toggle — there is nothing to keep,
  // but a LATER real append (unlock + Continue recording) honestly returns it to held.
  addAudioSegment('yuki', 0, { uri: 'blob:https://app.example/yuki-after-unlock', durationMs: 15_000, kind: 'added', label: 'Added · 18 Aug 10:40' });
  check('a real append after a discard returns the note to held (a new decision is pending)', getAudioDisposition('yuki', 0) === 'held' && getAudioSegments('yuki', 0).length === 1);
}

// --- 6. A re-record's replacement revokes the clip it throws away ----------------------------------
{
  revoked.length = 0;
  setOriginalAudioSegment('rebecca', 0, { uri: 'blob:https://app.example/first-take', durationMs: 10_000, kind: 'original', label: 'Original recording' });
  setAudioKept('rebecca', 0, true);
  setOriginalAudioSegment('rebecca', 0, { uri: 'blob:https://app.example/second-take', durationMs: 12_000, kind: 'original', label: 'Original recording' });
  check('replacing a recording revokes the replaced blob URL', revoked.length === 1 && revoked[0] === 'blob:https://app.example/first-take', JSON.stringify(revoked));
  check('a replacement recording starts a fresh held decision (a prior keep does not carry over)', getAudioDisposition('rebecca', 0) === 'held', getAudioDisposition('rebecca', 0));
}

// --- 7. The store is subscribable, and snapshots are referentially stable between mutations --------
// (The app compiles with the React Compiler, so the review card can ONLY see vault changes through
// the subscribe/snapshot seam — a mutation that fails to notify re-freezes the UI on stale state.)
{
  let fired = 0;
  const unsubscribe = subscribeAudioVault(() => fired++);

  const before = getAudioVaultSnapshot('scout', 0);
  check('an empty note snapshot is held with no segments', before.segments.length === 0 && before.disposition === 'held', JSON.stringify(before));
  check('an unchanged store returns a referentially STABLE snapshot', getAudioVaultSnapshot('scout', 0) === before);

  setOriginalAudioSegment('scout', 0, { uri: 'blob:https://app.example/scout-original', durationMs: 5000, kind: 'original', label: 'Original recording' });
  check('registering a capture notifies subscribers', fired === 1, String(fired));
  const held = getAudioVaultSnapshot('scout', 0);
  check('the snapshot CHANGES after a mutation', held !== before && held.segments.length === 1 && held.disposition === 'held', JSON.stringify(held));

  setAudioKept('scout', 0, true);
  check('the keep decision notifies subscribers', fired === 2, String(fired));
  setAudioKept('scout', 0, false);
  setAudioKept('scout', 0, false);
  check('a no-op un-keep does not wake subscribers again', fired === 3, String(fired));

  discardAudio('scout', 0);
  check('a discard notifies subscribers', fired === 4, String(fired));
  const gone = getAudioVaultSnapshot('scout', 0);
  check("the post-discard snapshot reads 'discarded' with no segments", gone.segments.length === 0 && gone.disposition === 'discarded', JSON.stringify(gone));

  unsubscribe();
  discardAudio('scout', 0);
  check('an unsubscribed listener is never called again', fired === 4, String(fired));
}

console.log(failed ? `\n${failed} assertion(s) failed` : '\nAll audio-vault assertions passed');
process.exit(failed ? 1 : 0);
