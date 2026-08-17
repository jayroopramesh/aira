/**
 * "Undo sample data" (captain feedback round 2, item 4). `loadSample()` REPLACES the whole device
 * snapshot — that's pre-existing, longstanding behaviour (Settings already warns "this cannot be
 * undone" for the load itself) and out of scope here. What this covers is everything the counselor
 * does AFTER loading: their own new clients, their own captured sessions, their own patient-details
 * edits. None of that may be silently destroyed by undoing the sample.
 *
 * Every sample-authored `Client`/`DraftNote` is stamped `sampleOrigin: true` at load time
 * (`buildSampleSnapshot`) — never guessed here by name or content. The policy, stated plainly so the
 * UI copy and PR description can say the same thing:
 *   - A client with no `sampleOrigin` flag is never touched — it's the counselor's own record.
 *   - A sample-origin client with only sample-origin notes and no patient-details edit is untouched
 *     since loading — remove it and its notes entirely.
 *   - A sample-origin client the counselor captured a REAL session against, or edited patient details
 *     for, is KEPT (not reverted — the sample baseline and the counselor's addition can't be cleanly
 *     separated once the client record itself has been updated by that capture). Its sample-authored
 *     notes are stripped; any note the counselor captured stays. This is the one place a sample record
 *     survives "undo", and it's a deliberate, stated choice — never a silent partial removal.
 */
import type { CaseloadSnapshot } from './repository';

export type SampleUndoResult = {
  snapshot: CaseloadSnapshot;
  /** Sample clients removed outright (untouched since loading). */
  removedClients: number;
  /** Sample clients kept because the counselor added a session or edited details for them since loading. */
  keptWithUserData: number;
};

function hasPatientDetailsEdit(entry: CaseloadSnapshot['patientDetails'][string] | undefined): boolean {
  if (!entry) return false;
  if (entry.values?.some((v) => v.trim())) return true;
  if (entry.extra?.trim()) return true;
  return false;
}

export function computeSampleUndo(snapshot: CaseloadSnapshot): SampleUndoResult {
  let removedClients = 0;
  let keptWithUserData = 0;
  const notes = { ...snapshot.notes };
  const patientDetails = { ...snapshot.patientDetails };

  const clients = snapshot.clients.filter((cl) => {
    if (!cl.sampleOrigin) return true; // never a sample record — never touched

    const clientNotes = snapshot.notes[cl.id] ?? [];
    const userNotes = clientNotes.filter((n) => !n.sampleOrigin);
    const touched = userNotes.length > 0 || hasPatientDetailsEdit(snapshot.patientDetails[cl.id]);

    if (touched) {
      notes[cl.id] = userNotes;
      keptWithUserData += 1;
      return true;
    }

    delete notes[cl.id];
    delete patientDetails[cl.id];
    removedClients += 1;
    return false;
  });

  return {
    snapshot: { ...snapshot, clients, notes, patientDetails, sampleLoaded: keptWithUserData > 0 },
    removedClients,
    keptWithUserData,
  };
}
