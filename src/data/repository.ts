import { AMARA_DRAFT, CLIENTS, DAY_DASHBOARD } from './fixtures';
import { CaseloadKpi, Client, DayDashboard, DraftNote } from './types';
import { vaultStorage, VaultStorage } from '../services/storage';

/**
 * The whole device-local caseload, as one persisted snapshot.
 *
 * BLANK BOOT: a fresh install starts EMPTY — no clients, no schedule. The Amara K. sample cohort is
 * loaded on demand (Settings → "Load sample data"). Session-generated draft notes are keyed by
 * clientId. Everything here is written through the vault seam (VaultStorage) and never leaves the
 * device.
 */
export type CaseloadSnapshot = {
  clients: Client[];
  dayDashboard: DayDashboard | null;
  caseloadKpis: CaseloadKpi[];
  /** Session-generated (or sample) draft notes, keyed by clientId. */
  notes: Record<string, DraftNote>;
  /** True once the sample cohort has been loaded (so Settings can offer "Clear"). */
  sampleLoaded: boolean;
};

export const EMPTY_SNAPSHOT: CaseloadSnapshot = {
  clients: [],
  dayDashboard: null,
  caseloadKpis: [],
  notes: {},
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
    notes: { amara: AMARA_DRAFT },
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
      return { ...EMPTY_SNAPSHOT, ...parsed, notes: parsed.notes ?? {} };
    } catch {
      return { ...EMPTY_SNAPSHOT };
    }
  }

  async save(snapshot: CaseloadSnapshot): Promise<void> {
    await this.ensureUnlocked();
    await this.vault.write(RECORD_ID, encoder.encode(JSON.stringify(snapshot)));
  }
}

/** The app-wide repository handle. Swap the construction for a crypto vault later — same interface. */
export const clientRepository: ClientRepository = new VaultClientRepository(vaultStorage);
