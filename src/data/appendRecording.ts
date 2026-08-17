/**
 * "Continue recording" — append a SECOND capture's transcript onto an already-drafted note, rather than
 * starting a fresh note the way "Re-record" does. Lives outside the React provider on the same
 * principle as `applySessionNote` (`saveSession.ts`): a pure note→note function is what a harness or a
 * plain jest test can drive directly, and this is exactly the kind of honesty-critical merge that has
 * been re-derived wrongly before elsewhere in this file's neighbourhood (see the provenance doc in
 * `types.ts`). `DataProvider.appendRecording` is the thin, impure wrapper that supplies the clock and
 * persists the result.
 */

import type { DraftNote } from './types';

export type RecordingAddition = {
  /** The newly transcribed (and, in patient-session mode, speaker-separated) text — never empty. */
  transcript: string;
  audioLeftDevice: boolean;
  transcriptFromCloud: boolean;
  auxiliaryNotes?: string;
};

/** How THIS added segment's own text was produced — read at the point it's spliced in, so the divider
 *  discloses the truth for that segment specifically rather than borrowing the note's prior claim. */
function segmentProvenance(addition: RecordingAddition): string {
  if (addition.transcriptFromCloud) return 'transcribed in the cloud';
  if (addition.audioLeftDevice) return 'audio sent to the cloud but no transcript came back — typed by the clinician';
  return 'typed by the clinician';
}

/**
 * Merge `addition` onto `note`. Returns `null` when the append must be refused rather than applied:
 * a signed note is read-only (the seam this mirrors is `updateNoteSection`'s refusal in
 * `DataProvider.updateNoteSection`), and a blank addition has nothing to append.
 *
 * Nothing already on the note is discarded — the prior transcript text, its own provenance, and any
 * auxiliary notes all survive untouched or concatenated, never replaced. Provenance stays honest under
 * the existing single-boolean model precisely where it still applies: `audioLeftDevice` only ever
 * grows more true (a disclosure), and `transcriptFromCloud` keeps its prior meaning when the new
 * segment agrees with it. Only when the two segments DISAGREE does a single boolean stop being able to
 * describe the whole transcript truthfully — that's `transcriptMixedProvenance`, and the per-segment
 * truth then lives in the divider line itself rather than being flattened into one claim.
 */
export function applyRecordingAppend(note: DraftNote, addition: RecordingAddition, timestampLabel: string): DraftNote | null {
  if (note.status === 'signed') return null;
  const additionText = addition.transcript.trim();
  if (!additionText) return null;

  const priorText = note.transcript?.trim();
  const divider = `--- Added recording · ${timestampLabel} · ${segmentProvenance(addition)} ---`;
  const transcript = priorText ? `${priorText}\n\n${divider}\n\n${additionText}` : additionText;

  const priorCloud = note.transcriptFromCloud === true;
  const mixed = !!priorText && priorCloud !== addition.transcriptFromCloud;
  const transcriptFromCloud = mixed ? false : priorText ? priorCloud && addition.transcriptFromCloud : addition.transcriptFromCloud;

  const auxParts = [note.auxiliaryNotes, addition.auxiliaryNotes].filter((x): x is string => !!x?.trim());

  return {
    ...note,
    transcript,
    audioLeftDevice: note.audioLeftDevice === true || addition.audioLeftDevice,
    transcriptFromCloud,
    transcriptMixedProvenance: mixed || undefined,
    auxiliaryNotes: auxParts.length ? auxParts.join('\n\n') : undefined,
    // The transcript genuinely changed, so the once-per-note "Generate from notes" pull re-enables —
    // see PrescriptionsRail's dedup-by-text guard in review.tsx for why a second pull over an
    // unchanged Plan can't duplicate the same prescriptions.
    prescriptionsGenerated: false,
  };
}
