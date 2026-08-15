/**
 * DataProvider — the reactive, device-local caseload state for the authed app.
 *
 * Screens read the caseload through the hooks here (useClients / useClient / useDayDashboard /
 * useCaseloadKpis / useDraftNote) instead of importing fixtures directly, so a BLANK BOOT shows
 * real zero-states everywhere. The Amara K. sample cohort is loaded on demand (Settings). All state
 * is persisted through the vault seam (ClientRepository → VaultStorage) and never leaves the device.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { buildSampleSnapshot, CaseloadSnapshot, clientRepository, EMPTY_SNAPSHOT, PatientDetailsEntry } from './repository';
import { CaseloadKpi, Client, DayDashboard, DraftNote, NoteSection } from './types';
import { applySessionNote } from './saveSession';

/**
 * Caseload KPI tiles computed from the ACTUAL caseload (F10). The tiles used to be static fixtures
 * ("24 active clients", "17 improving") that contradicted a 7-client caseload and never moved when
 * real clients were added. These derive from the clients on screen, so they can never disagree with
 * the table below them.
 */
function computeCaseloadKpis(clients: Client[]): CaseloadKpi[] {
  if (!clients.length) return [];
  const active = clients.filter((c) => c.status === 'active').length;
  const improving = clients.filter((c) => c.sparkline.length >= 2 && c.sparkline[c.sparkline.length - 1] < c.sparkline[0]).length;
  const followUpsDue = clients.filter((c) => c.followUpDue).length;
  const riskFlags = clients.filter((c) => c.risk === 'acute' || c.risk === 'elevated').length;
  return [
    { label: 'Clients', value: String(clients.length), sub: `${active} active` },
    { label: 'Improving', value: String(improving), sub: 'PHQ-9 trending down' },
    { label: 'Follow-ups due', value: String(followUpsDue), sub: followUpsDue ? 'need scheduling' : 'all scheduled' },
    { label: 'Risk flags', value: String(riskFlags), sub: riskFlags ? 'elevated / acute · review' : 'none flagged', tone: riskFlags ? 'risk' : 'default' },
  ];
}

/**
 * The day-board "Notes to sign" tile counts the notes actually awaiting a signature (F15). It was a
 * hand-authored fixture constant, so signing a note left the tile claiming work that no longer
 * existed — the same class of contradiction computeCaseloadKpis closed for the caseload tiles.
 */
function withDerivedGlance(day: DayDashboard | null, notes: Record<string, DraftNote[]>): DayDashboard | null {
  if (!day) return null;
  const unsigned = Object.values(notes).reduce((n, list) => n + list.filter((x) => x.status !== 'signed').length, 0);
  return {
    ...day,
    glance: day.glance.map((g) => (/notes to sign/i.test(g.label) ? { ...g, value: String(unsigned) } : g)),
  };
}

type DataContextValue = {
  hydrated: boolean;
  clients: Client[];
  clientsById: Record<string, Client>;
  dayDashboard: DayDashboard | null;
  caseloadKpis: CaseloadKpi[];
  notes: Record<string, DraftNote[]>;
  patientDetails: Record<string, PatientDetailsEntry>;
  sampleLoaded: boolean;
  /** Load the Amara K. sample cohort (Settings / dev affordance). */
  loadSample: () => Promise<void>;
  /** Wipe every device-local record back to a fresh-install blank state. */
  clearAll: () => Promise<void>;
  /**
   * Persist a session-generated draft. With no clientId, a lightweight client is created so the
   * captured session appears in the caseload — UNLESS a supplied Emirates ID already exists on the
   * caseload, in which case the session folds into that client and NO second record is minted.
   * Returns the clientId the note is stored under, plus `isDuplicate` (true only when an Emirates ID
   * matched an existing client), so the UI can plainly say "you already see this client", and
   * `nameConflict` (true only on the mint path, when a valid Emirates ID vetoed folding into a
   * same-named client) so the deliberate refusal to fold two different people is explained rather than
   * leaving two identical-looking rows on the caseload, and `idNameConflict` (true only on the mint
   * path, when that Emirates ID is already on file under a materially different name) so a mis-entered
   * id is visible before the note is signed. All three are mutually exclusive.
   */
  saveSessionNote: (
    note: DraftNote,
    opts?: { clientId?: string; name?: string; emiratesId?: string },
  ) => Promise<{ clientId: string; isDuplicate: boolean; nameConflict: boolean; idNameConflict: boolean }>;
  /** Persist the clinician-entered patient-details card edits for a client (C2) — device-local. */
  savePatientDetails: (clientId: string, patch: PatientDetailsEntry) => Promise<void>;
  /** Persist a sign-off onto the stored note (F8) so the attestation survives navigation/reload. */
  signNote: (clientId: string, noteIndex: number, signedBy: string, signedAt: string) => Promise<void>;
  /**
   * Persist a clinician's inline edit to ONE note section, so the review screen's per-section Edit is a
   * real edit rather than a throwaway text box (no-dead-promise). Only the section prose moves — the
   * sign-off (status/signedBy/signedAt) and the structured riskLevel are never touched here.
   *
   * It deliberately does NOT re-derive `client.risk`. The caseload tier is a CAPTURE-TIME signal read
   * from the note's structured risk ROWS (`riskFromNote`), not from the free-text risk narrative, so
   * editing that narrative neither can nor should move the tier. Lowering a tier stays a deliberate
   * act elsewhere — never an automatic downgrade.
   */
  updateNoteSection: (clientId: string, noteIndex: number, sectionId: string, body: string[], bullets?: string[]) => Promise<void>;
};

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<CaseloadSnapshot>(EMPTY_SNAPSHOT);
  const [hydrated, setHydrated] = useState(false);

  // Every mutator below rewrites the WHOLE snapshot, so two writes in the same tick would otherwise
  // race: the second still holds the render's `snapshot` and silently reverts the first. (Signing a
  // note while a section edit was in flight lost the edit exactly this way.) The ref is advanced
  // SYNCHRONOUSLY by persist, before React re-renders, so writes compose in whatever order they land.
  const snapshotRef = useRef(snapshot);

  useEffect(() => {
    let alive = true;
    clientRepository
      .load()
      .then((s) => {
        if (alive) {
          snapshotRef.current = s;
          setSnapshot(s);
        }
      })
      .finally(() => {
        if (alive) setHydrated(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const persist = useCallback(async (next: CaseloadSnapshot) => {
    snapshotRef.current = next;
    setSnapshot(next);
    await clientRepository.save(next).catch(() => {
      /* best-effort persistence — the demo keeps working from in-memory state */
    });
  }, []);

  const loadSample = useCallback(async () => {
    await persist(buildSampleSnapshot());
  }, [persist]);

  const clearAll = useCallback(async () => {
    await persist({ ...EMPTY_SNAPSHOT, notes: {} });
  }, [persist]);

  const saveSessionNote = useCallback(
    async (note: DraftNote, opts?: { clientId?: string; name?: string; emiratesId?: string }) => {
      // The whole match/fold/mint decision — including every duplicate-identity rule — lives in
      // `applySessionNote` so it can be driven end to end by the harness. This wrapper supplies the two
      // impure values and persists what comes back; it must never re-decide anything itself.
      const { snapshot, ...result } = applySessionNote(snapshotRef.current, note, {
        ...opts,
        dateLabel: new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        newClientId: `s-${Date.now().toString(36)}`,
      });
      await persist(snapshot);
      return result;
    },
    [persist],
  );

  const savePatientDetails = useCallback(
    async (clientId: string, patch: PatientDetailsEntry) => {
      const snapshot = snapshotRef.current;
      await persist({
        ...snapshot,
        patientDetails: { ...snapshot.patientDetails, [clientId]: { ...snapshot.patientDetails[clientId], ...patch } },
      });
    },
    [persist],
  );

  const signNote = useCallback(
    async (clientId: string, noteIndex: number, signedBy: string, signedAt: string) => {
      const snapshot = snapshotRef.current;
      const list = snapshot.notes[clientId];
      if (!list?.[noteIndex]) return;
      const next = list.map((n, i) => (i === noteIndex ? { ...n, status: 'signed' as const, signedBy, signedAt } : n));
      await persist({ ...snapshot, notes: { ...snapshot.notes, [clientId]: next } });
    },
    [persist],
  );

  const updateNoteSection = useCallback(
    async (clientId: string, noteIndex: number, sectionId: string, body: string[], bullets?: string[]) => {
      const snapshot = snapshotRef.current;
      const list = snapshot.notes[clientId];
      if (!list?.[noteIndex]) return;
      // Read-only after sign-off is enforced HERE, at the seam, not only by the screen hiding its
      // editor: a signed note is a legal attestation, so no caller may rewrite its content.
      if (list[noteIndex].status === 'signed') return;
      const edit = (s: NoteSection): NoteSection => {
        if (s.id !== sectionId) return s;
        // Only a section that already carries bullets keeps them — a plain prose section never grows a
        // bullets array it never had, so the round-trip can't change how the section renders.
        return s.bullets === undefined ? { ...s, body } : { ...s, body, bullets: bullets ?? [] };
      };
      const next: DraftNote[] = list.map((n, i) => (i === noteIndex ? { ...n, sections: n.sections.map(edit) } : n));
      await persist({ ...snapshot, notes: { ...snapshot.notes, [clientId]: next } });
    },
    [persist],
  );

  const value = useMemo<DataContextValue>(() => {
    const clientsById = Object.fromEntries(snapshot.clients.map((c) => [c.id, c]));
    return {
      hydrated,
      clients: snapshot.clients,
      clientsById,
      dayDashboard: withDerivedGlance(snapshot.dayDashboard, snapshot.notes),
      caseloadKpis: computeCaseloadKpis(snapshot.clients),
      notes: snapshot.notes,
      patientDetails: snapshot.patientDetails,
      sampleLoaded: snapshot.sampleLoaded,
      loadSample,
      clearAll,
      saveSessionNote,
      savePatientDetails,
      signNote,
      updateNoteSection,
    };
  }, [snapshot, hydrated, loadSample, clearAll, saveSessionNote, savePatientDetails, signNote, updateNoteSection]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

/** Requires the provider — used by screens/actions that live inside the authed (app) shell. */
export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within a DataProvider');
  return ctx;
}

/**
 * The read hooks tolerate being called OUTSIDE the provider (e.g. the shared TopBar renders on the
 * pre-auth welcome/unlock chrome, which has no DataProvider) — they return empty defaults there
 * rather than throwing.
 */
export function useClients(): Client[] {
  return useContext(DataContext)?.clients ?? [];
}

export function useClient(id?: string): Client | undefined {
  const ctx = useContext(DataContext);
  return ctx && id ? ctx.clientsById[id] : undefined;
}

export function useDayDashboard(): DayDashboard | null {
  return useContext(DataContext)?.dayDashboard ?? null;
}

export function useCaseloadKpis(): CaseloadKpi[] {
  return useContext(DataContext)?.caseloadKpis ?? [];
}

/** All retained session notes for a client (newest first, up to 3 — C4). Empty outside the provider. */
export function useClientNotes(id?: string): DraftNote[] {
  const ctx = useContext(DataContext);
  return ctx && id ? ctx.notes[id] ?? [] : [];
}

/** One saved/generated draft for a client — the newest by default, or the note at `index` (C4). */
export function useDraftNote(id?: string, index = 0): DraftNote | undefined {
  const ctx = useContext(DataContext);
  return ctx && id ? ctx.notes[id]?.[index] : undefined;
}

/** The persisted patient-details card edits for a client (C2). Empty outside the provider. */
export function usePatientDetails(id?: string): PatientDetailsEntry {
  const ctx = useContext(DataContext);
  return (ctx && id ? ctx.patientDetails[id] : undefined) ?? {};
}
