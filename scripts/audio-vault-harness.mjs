/**
 * audioVault harness. Proves the in-memory registry behind the review screen's stitched playback
 * ("Continue recording" captain addition, 2026-08-17):
 *   1. Only REAL captures (`blob:` URIs) are ever registered — never the sample clip or a failed
 *      capture, so a demo session or a dead mic can never be offered a fabricated "kept audio" replay.
 *   2. Segments accumulate in order (original, then each later append) under a stable per-note key.
 *   3. An unknown note key returns empty, not undefined/throw — the review screen reads this
 *      unconditionally on every signed note, most of which will have nothing registered.
 *
 * Run (Node ≥ 22.13, e.g. ~/.cache/fm-node/node-v22.23.2-darwin-arm64/bin/node):
 *   node --experimental-strip-types scripts/audio-vault-harness.mjs
 * Exits non-zero on the first failed assertion.
 */
import { addAudioSegment, getAudioSegments, isRealAudioUri, setOriginalAudioSegment } from '../src/services/audioVault.ts';

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
}

console.log(failed ? `\n${failed} assertion(s) failed` : '\nAll audio-vault assertions passed');
process.exit(failed ? 1 : 0);
