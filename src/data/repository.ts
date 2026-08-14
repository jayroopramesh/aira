import { AMARA_DRAFT, CLIENTS, DAY_DASHBOARD } from './fixtures';
import { CaseloadKpi, Client, DayDashboard, DraftNote } from './types';
import { vaultStorage, VaultStorage } from '../services/storage';
import { createWriteQueue } from '../services/writeQueue';

/**
 * The whole device-local caseload, as one persisted snapshot.
 *
 * BLANK BOOT: a fresh install starts EMPTY — no clients, no schedule. The Amara K. sample cohort is
 * loaded on demand (Settings → "Load sample data"). Session-generated draft notes are keyed by
 * clientId. Everything here is written through the vault seam (VaultStorage) and never leaves the
 * device.
 */
/** How many session notes are retained per client (captain C4) — newest first, oldest rotates out. */
export const MAX_NOTES_PER_CLIENT = 3;

/** Clinician-entered patient-details card edits (C2) — device-local, keyed by clientId. */
export type PatientDetailsEntry = { values?: string[]; extra?: string };

export type CaseloadSnapshot = {
  clients: Client[];
  dayDashboard: DayDashboard | null;
  caseloadKpis: CaseloadKpi[];
  /**
   * Session-generated (or sample) draft notes, keyed by clientId. Up to MAX_NOTES_PER_CLIENT are
   * kept per client, NEWEST FIRST (C4) — the one-note-per-client overwrite limit is removed.
   */
  notes: Record<string, DraftNote[]>;
  /** Edits made in the patient-details card, keyed by clientId — the "stays on this device" store. */
  patientDetails: Record<string, PatientDetailsEntry>;
  /** True once the sample cohort has been loaded (so Settings can offer "Clear"). */
  sampleLoaded: boolean;
};

export const EMPTY_SNAPSHOT: CaseloadSnapshot = {
  clients: [],
  dayDashboard: null,
  caseloadKpis: [],
  notes: {},
  patientDetails: {},
  sampleLoaded: false,
};

/** "WEDNESDAY · 13 AUGUST" for today, so the sample day board never shows a stale hardcoded date (F15). */
function todayLabel(): string {
  const d = new Date();
  const weekday = d.toLocaleDateString(undefined, { weekday: 'long' });
  const day = d.toLocaleDateString(undefined, { day: 'numeric' });
  const month = d.toLocaleDateString(undefined, { month: 'long' });
  return `${weekday} · ${day} ${month}`.toUpperCase();
}

/** The Amara K. cohort + report clients, assembled as a loadable sample snapshot (no real PHI). */
export function buildSampleSnapshot(): CaseloadSnapshot {
  return {
    clients: CLIENTS.map((c) => ({ ...c })),
    dayDashboard: { ...DAY_DASHBOARD, dateLabel: todayLabel() },
    caseloadKpis: [], // computed from clients in DataProvider (F10) — no static tiles
    notes: { amara: [AMARA_DRAFT] },
    patientDetails: {},
    sampleLoaded: true,
  };
}

/**
 * ClientRepository — the seam the encrypted vault sits behind. It loads/saves the caseload snapshot
 * through VaultStorage; the real Argon2id vault slots in behind the same read/write without
 * touching callers. Patient data never leaves the device either way.
 */
export interface ClientRepository {
  load(): Promise<CaseloadSnapshot>;
  save(snapshot: CaseloadSnapshot): Promise<void>;
}

const RECORD_ID = 'caseload/v1';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const saveQueue = createWriteQueue();

class VaultClientRepository implements ClientRepository {
  constructor(private readonly vault: VaultStorage) {}

  /** Reaching the authed app implies an open session; ensure the local vault is unlocked. */
  private async ensureUnlocked() {
    if (!this.vault.isUnlocked()) await this.vault.unlock('__session__');
  }

  async load(): Promise<CaseloadSnapshot> {
    await this.ensureUnlocked();
    try {
      const bytes = await this.vault.read(RECORD_ID);
      if (!bytes) return { ...EMPTY_SNAPSHOT };
      const parsed = JSON.parse(decoder.decode(bytes)) as Partial<CaseloadSnapshot>;
      // Normalise the notes map to arrays (C4): older persisted snapshots stored a single DraftNote
      // per client; wrap those, and cap every list at MAX_NOTES_PER_CLIENT newest-first.
      const rawNotes = (parsed.notes ?? {}) as Record<string, DraftNote | DraftNote[]>;
      const notes: Record<string, DraftNote[]> = {};
      for (const [clientId, value] of Object.entries(rawNotes)) {
        notes[clientId] = (Array.isArray(value) ? value : [value]).slice(0, MAX_NOTES_PER_CLIENT);
      }
      const snapshot = { ...EMPTY_SNAPSHOT, ...parsed, notes, patientDetails: parsed.patientDetails ?? {} };
      // Re-stamp the day-board date at READ time — the label must reflect the day the counselor
      // opens the app, not the day the sample was loaded and persisted (F15).
      if (snapshot.dayDashboard) snapshot.dayDashboard = { ...snapshot.dayDashboard, dateLabel: todayLabel() };
      return snapshot;
    } catch {
      return { ...EMPTY_SNAPSHOT };
    }
  }

  /**
   * Serialized on the queue: a caller may save twice in one tick (a flushed note edit, then the
   * sign-off), and the LAST snapshot handed to `save` must be the last one stored. Enqueueing here
   * — rather than deeper in the vault — fixes the order synchronously at call time, so it cannot
   * drift with how `ensureUnlocked` or the vault schedule their awaits.
   */
  async save(snapshot: CaseloadSnapshot): Promise<void> {
    await saveQueue(async () => {
      await this.ensureUnlocked();
      await this.vault.write(RECORD_ID, encoder.encode(JSON.stringify(snapshot)));
    });
  }
}

/** The app-wide repository handle. Swap the construction for a crypto vault later — same interface. */
export const clientRepository: ClientRepository = new VaultClientRepository(vaultStorage);
