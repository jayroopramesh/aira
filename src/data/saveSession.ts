/**
 * The caseload decision a completed capture makes: which client this session belongs to, and what the
 * snapshot looks like afterwards.
 *
 * This lives OUTSIDE the React provider on purpose. The duplicate-identity rules it applies
 * (`matchExistingClient`, `findNameConflict`, `findIdNameMismatch`, `emiratesIdForNewClient`) are the
 * ones that decide whether two patients' records merge — the unrecoverable outcome — and a rule is only
 * as good as the wiring that calls it: the Emirates ID was once silently dropped on the fold path with
 * every helper still behaving correctly. As a pure snapshot→snapshot function this whole decision runs
 * under `scripts/duplicate-identity-harness.mjs`, so a dropped or reordered call is caught rather than
 * merely reasoned about. `DataProvider.saveSessionNote` is the thin wrapper that persists the result.
 *
 * Everything impure is supplied by the caller (`dateLabel`, `newClientId`), so the same inputs always
 * produce the same snapshot.
 */

import { CaseloadSnapshot, MAX_NOTES_PER_CLIENT } from './repository';
import {
  appendSessionToClient,
  clientFromSession,
  emiratesIdForNewClient,
  findIdNameMismatch,
  findNameConflict,
  matchExistingClient,
  UNNAMED_CLIENT_NAME,
} from './sessionClient';
import { DraftNote } from './types';

/** Prepend the newest note and keep at most MAX_NOTES_PER_CLIENT per client (C4) — oldest rotates out. */
export function withNote(existing: DraftNote[] | undefined, note: DraftNote): DraftNote[] {
  return [note, ...(existing ?? [])].slice(0, MAX_NOTES_PER_CLIENT);
}

export type SessionCaptureOpts = {
  /** The day board / client file opened this capture against a known client. */
  clientId?: string;
  /** The optional name typed on the capture screen. */
  name?: string;
  /** The optional Emirates ID typed on the capture screen, verbatim. */
  emiratesId?: string;
  /** "13 Aug" — the caller's clock, kept out of here so the decision is reproducible. */
  dateLabel: string;
  /** The id a freshly minted client takes, likewise supplied by the caller. */
  newClientId: string;
};

export type SessionSaveResult = {
  /** The snapshot to persist. */
  snapshot: CaseloadSnapshot;
  /** Where the note now lives. */
  clientId: string;
  /** An Emirates ID already on the caseload opened its existing record — "you already see this client". */
  isDuplicate: boolean;
  /**
   * PRESENTATION ONLY — the fold above was a Step-B ADOPTION: no record held that Emirates ID, so the
   * match was made on the NAME and the id was written onto that record by this save. The fold decision
   * and `isDuplicate` are unaffected; this only picks which true sentence review shows, because telling
   * the counselor the id was "already on file" would be invented corroboration on the one path where a
   * wrong match is theirs to catch.
   */
  adoptedEmiratesId: boolean;
  /** A separate record was minted although a same-named client exists, because the id vetoed the fold. */
  nameConflict: boolean;
  /** A separate record was minted because that Emirates ID is on file under a different name. */
  idNameConflict: boolean;
};

/**
 * Resolve a completed capture against the caseload and return the snapshot it produces.
 *
 * A session for a client we already know FOLDS in rather than minting a duplicate, so trends
 * accumulate, the session history stays reachable, and the note's risk reaches the caseload on EVERY
 * capture path (F4). The match rules (id → Emirates ID → captured-client name) live in
 * `matchExistingClient`: a VALID Emirates ID is the local uniqueness key, so a capture supplying one
 * already on the caseload — under an agreeing name — opens that record instead of creating a second,
 * and an id no record holds attaches to the lone same-named record that has none. Otherwise a separate
 * record is minted, and both shapes of refusal are reported rather than left silent: a namesake the app
 * could not tell apart, and an id already on file under another name.
 */
export function applySessionNote(
  snapshot: CaseloadSnapshot,
  note: DraftNote,
  opts: SessionCaptureOpts,
): SessionSaveResult {
  const existingId = opts.clientId;
  const { dateLabel } = opts;
  const typedName = opts.name?.trim() ?? '';
  const emiratesId = opts.emiratesId?.trim() ?? '';
  const name = typedName || UNNAMED_CLIENT_NAME; // display fallback only — NEVER a fold key

  const match = matchExistingClient(snapshot.clients, { clientId: existingId, name: typedName, emiratesId });
  if (match) {
    const existing = match.client;
    const sessionNumber = existing.sessionNumber + 1;
    const updated = appendSessionToClient(existing, note, {
      sessionNumber,
      dateLabel,
      name: typedName,
      adoptEmiratesId: match.adoptEmiratesId,
    });
    const noteForClient: DraftNote = { ...note, sessionLabel: `Session ${sessionNumber} — ${dateLabel}` };
    return {
      snapshot: {
        ...snapshot,
        clients: snapshot.clients.map((cl) => (cl.id === existing.id ? updated : cl)),
        // Retain up to 3 notes (C4) — the newer session no longer erases the prior note's full text.
        notes: { ...snapshot.notes, [existing.id]: withNote(snapshot.notes[existing.id], noteForClient) },
      },
      clientId: existing.id,
      // Only an Emirates-ID match is a "you already see this client" moment — an id-opened capture or a
      // same-name continuation is the expected fold, not a duplicate the counselor should be warned of.
      isDuplicate: match.matchedBy === 'emiratesId',
      adoptedEmiratesId: !!match.adoptEmiratesId,
      nameConflict: false,
      idNameConflict: false,
    };
  }

  // A clientId whose client no longer exists (e.g. cleared data mid-session) — keep the note reachable
  // under that id rather than silently minting an unrelated client.
  if (existingId) {
    return {
      snapshot: { ...snapshot, notes: { ...snapshot.notes, [existingId]: withNote(snapshot.notes[existingId], note) } },
      clientId: existingId,
      isDuplicate: false,
      adoptedEmiratesId: false,
      nameConflict: false,
      idNameConflict: false,
    };
  }

  const conflict = findNameConflict(snapshot.clients, { name: typedName, emiratesId });
  const idMismatch = findIdNameMismatch(snapshot.clients, { name: typedName, emiratesId });

  // Standalone session — mint a lightweight client so blank boot visibly populates. When the id was
  // just ruled to belong to ANOTHER patient, the new record carries no Emirates ID: storing it would
  // leave two records holding the same "unique" key, and a later capture entering that id with the name
  // left blank would fold into whichever one came first — the very merge this fork prevented. The key
  // stays with its original holder.
  const sessionNumber = 1;
  const client = clientFromSession(opts.newClientId, note, {
    name,
    sessionNumber,
    dateLabel,
    emiratesId: emiratesIdForNewClient(snapshot.clients, { name: typedName, emiratesId }),
  });
  const noteForClient: DraftNote = { ...note, sessionLabel: `Session ${sessionNumber} — ${dateLabel}` };
  return {
    snapshot: {
      ...snapshot,
      clients: [client, ...snapshot.clients],
      notes: { ...snapshot.notes, [opts.newClientId]: withNote(snapshot.notes[opts.newClientId], noteForClient) },
    },
    clientId: opts.newClientId,
    isDuplicate: false,
    adoptedEmiratesId: false,
    nameConflict: !!conflict,
    idNameConflict: !!idMismatch,
  };
}
