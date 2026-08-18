/**
 * "Continue recording" — append a SECOND capture's transcript onto an already-drafted note, rather than
 * starting a fresh note the way "Re-record" does. Lives outside the React provider on the same
 * principle as `applySessionNote` (`saveSession.ts`): a pure note→note function is what a harness or a
 * plain jest test can drive directly, and this is exactly the kind of honesty-critical merge that has
 * been re-derived wrongly before elsewhere in this file's neighbourhood (see the provenance doc in
 * `types.ts`). `DataProvider.appendRecording` is the thin, impure wrapper that supplies the clock and
 * persists the result.
 */

import type { DraftNote, RecordingComment } from './types';

export type RecordingAddition = {
  /** The newly transcribed (and, in patient-session mode, speaker-separated) text — never empty. */
  transcript: string;
  audioLeftDevice: boolean;
  transcriptFromCloud: boolean;
  /** True when the clinician changed the machine transcriber's output for THIS segment before adding
   *  it — the divider then says "then edited by you" instead of letting a pure machine-transcription
   *  claim stand over the clinician's own words. Meaningless (and ignored) when `transcriptFromCloud`
   *  is false: typed text has no machine output to have edited. */
  transcriptEdited?: boolean;
  auxiliaryNotes?: string;
  /** Comments typed on the recording screen during THIS added capture — clock values read within this
   *  segment's own recording, concatenated after the note's existing comments, never replacing them. */
  recordingComments?: RecordingComment[];
};

/** How THIS added segment's own text was produced — read at the point it's spliced in, so the divider
 *  discloses the truth for that segment specifically rather than borrowing the note's prior claim. */
function segmentProvenance(addition: RecordingAddition): string {
  if (addition.transcriptFromCloud)
    return addition.transcriptEdited === true ? 'transcribed off this device, then edited by you' : 'transcribed off this device';
  if (addition.audioLeftDevice) return 'audio sent off this device but no transcript came back — typed by you';
  return 'typed by you';
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
  const comments = [...(note.recordingComments ?? []), ...(addition.recordingComments ?? [])];

  return {
    ...note,
    transcript,
    audioLeftDevice: note.audioLeftDevice === true || addition.audioLeftDevice,
    transcriptFromCloud,
    // Up-only, like `audioLeftDevice`: once any machine-transcribed segment has been edited, the
    // note-level machine claim stays qualified. The segment-level truth lives in each divider.
    transcriptEdited:
      note.transcriptEdited === true || (addition.transcriptFromCloud && addition.transcriptEdited === true) || undefined,
    transcriptMixedProvenance: mixed || undefined,
    auxiliaryNotes: auxParts.length ? auxParts.join('\n\n') : undefined,
    recordingComments: comments.length ? comments : undefined,
    // The transcript genuinely changed, so the once-per-note "Generate from notes" pull re-enables —
    // see PrescriptionsRail's dedup-by-text guard in review.tsx for why a second pull over an
    // unchanged Plan can't duplicate the same prescriptions.
    prescriptionsGenerated: false,
  };
}
