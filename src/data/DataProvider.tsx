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
import { clientFromSession } from './sessionClient';

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
      if (existingId) {
        await persist({ ...snapshot, notes: { ...snapshot.notes, [existingId]: note } });
        return existingId;
      }
      // Standalone session — mint a lightweight client so blank boot visibly populates.
      const id = `s-${Date.now().toString(36)}`;
      const dateLabel = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
      const sessionNumber = 1;
      const client = clientFromSession(id, note, { name: opts?.name?.trim() || 'New client', sessionNumber, dateLabel });
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
      caseloadKpis: snapshot.caseloadKpis,
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
