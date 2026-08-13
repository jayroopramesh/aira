/**
 * DataProvider — the reactive, device-local caseload state for the authed app.
 *
 * Screens read the caseload through the hooks here (useClients / useClient / useDayDashboard /
 * useCaseloadKpis / useDraftNote) instead of importing fixtures directly, so a BLANK BOOT shows
 * real zero-states everywhere. The Amara K. sample cohort is loaded on demand (Settings). All state
 * is persisted through the vault seam (ClientRepository → VaultStorage) and never leaves the device.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { buildSampleSnapshot, CaseloadSnapshot, clientRepository, EMPTY_SNAPSHOT } from './repository';
import { CaseloadKpi, Client, DayDashboard, DraftNote } from './types';
import { appendSessionToClient, clientFromSession } from './sessionClient';

const normalizeName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

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

type DataContextValue = {
  hydrated: boolean;
  clients: Client[];
  clientsById: Record<string, Client>;
  dayDashboard: DayDashboard | null;
  caseloadKpis: CaseloadKpi[];
  notes: Record<string, DraftNote>;
  sampleLoaded: boolean;
  /** Load the Amara K. sample cohort (Settings / dev affordance). */
  loadSample: () => Promise<void>;
  /** Wipe every device-local record back to a fresh-install blank state. */
  clearAll: () => Promise<void>;
  /**
   * Persist a session-generated draft. With no clientId, a lightweight client is created so the
   * captured session appears in the caseload. Returns the clientId the note is stored under.
   */
  saveSessionNote: (note: DraftNote, opts?: { clientId?: string; name?: string }) => Promise<string>;
};

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<CaseloadSnapshot>(EMPTY_SNAPSHOT);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    clientRepository
      .load()
      .then((s) => {
        if (alive) setSnapshot(s);
      })
      .finally(() => {
        if (alive) setHydrated(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const persist = useCallback(async (next: CaseloadSnapshot) => {
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
    async (note: DraftNote, opts?: { clientId?: string; name?: string }) => {
      const existingId = opts?.clientId;
      const dateLabel = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
      const name = opts?.name?.trim() || 'New client';

      // A session for a client we already know → fold it in rather than minting a duplicate (F3),
      // so trends accumulate, the session history stays reachable, and the note's risk reaches the
      // caseload on EVERY capture path (F4) — whether the client arrived by id (day board → session)
      // or by typed name. The name match is scoped to captured clients ('s-' ids) so it never
      // collides with the sample cohort.
      const existing = existingId
        ? snapshot.clients.find((cl) => cl.id === existingId)
        : snapshot.clients.find((cl) => cl.id.startsWith('s-') && normalizeName(cl.name) === normalizeName(name));
      if (existing) {
        const sessionNumber = existing.sessionNumber + 1;
        const updated = appendSessionToClient(existing, note, { sessionNumber, dateLabel });
        const noteForClient: DraftNote = { ...note, sessionLabel: `Session ${sessionNumber} — ${dateLabel}` };
        await persist({
          ...snapshot,
          clients: snapshot.clients.map((cl) => (cl.id === existing.id ? updated : cl)),
          notes: { ...snapshot.notes, [existing.id]: noteForClient },
        });
        return existing.id;
      }

      // A clientId whose client no longer exists (e.g. cleared data mid-session) — keep the note
      // reachable under that id rather than silently minting an unrelated client.
      if (existingId) {
        await persist({ ...snapshot, notes: { ...snapshot.notes, [existingId]: note } });
        return existingId;
      }

      // Standalone session — mint a lightweight client so blank boot visibly populates.
      const id = `s-${Date.now().toString(36)}`;
      const sessionNumber = 1;
      const client = clientFromSession(id, note, { name, sessionNumber, dateLabel });
      const noteForClient: DraftNote = { ...note, sessionLabel: `Session ${sessionNumber} — ${dateLabel}` };
      await persist({
        ...snapshot,
        clients: [client, ...snapshot.clients],
        notes: { ...snapshot.notes, [id]: noteForClient },
      });
      return id;
    },
    [persist, snapshot],
  );

  const value = useMemo<DataContextValue>(() => {
    const clientsById = Object.fromEntries(snapshot.clients.map((c) => [c.id, c]));
    return {
      hydrated,
      clients: snapshot.clients,
      clientsById,
      dayDashboard: snapshot.dayDashboard,
      caseloadKpis: computeCaseloadKpis(snapshot.clients),
      notes: snapshot.notes,
      sampleLoaded: snapshot.sampleLoaded,
      loadSample,
      clearAll,
      saveSessionNote,
    };
  }, [snapshot, hydrated, loadSample, clearAll, saveSessionNote]);

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

/** The saved/generated draft for a client, if any. */
export function useDraftNote(id?: string): DraftNote | undefined {
  const ctx = useContext(DataContext);
  return ctx && id ? ctx.notes[id] : undefined;
}
