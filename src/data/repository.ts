import { AMARA_DRAFT, CASELOAD_KPIS, CLIENTS, CLIENTS_BY_ID, DAY_DASHBOARD } from './fixtures';
import { CaseloadKpi, Client, DayDashboard, DraftNote } from './types';

/**
 * ClientRepository — the seam the future encrypted vault slots behind.
 *
 * v1 reads from typed in-memory fixtures. When the Argon2id-envelope vault lands
 * (see services/storage.ts VaultStorage), a `VaultClientRepository` implements this
 * same interface — decrypting records on read, re-identifying tokens client-side — and
 * nothing in the UI layer changes. Patient data never leaves the device either way.
 *
 * All methods are async on purpose: the vault will do real (async) decryption work.
 */
export interface ClientRepository {
  listClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  getDayDashboard(): Promise<DayDashboard>;
  getCaseloadKpis(): Promise<CaseloadKpi[]>;
  /** The draft note for a given client's current session (mocked for v1). */
  getDraftNote(clientId: string): Promise<DraftNote | undefined>;
}

class InMemoryClientRepository implements ClientRepository {
  async listClients() {
    return CLIENTS;
  }
  async getClient(id: string) {
    return CLIENTS_BY_ID[id];
  }
  async getDayDashboard() {
    return DAY_DASHBOARD;
  }
  async getCaseloadKpis() {
    return CASELOAD_KPIS;
  }
  async getDraftNote(clientId: string) {
    // Only Amara has an authored draft in the fixtures; the walkthrough uses her.
    return clientId === 'amara' ? AMARA_DRAFT : AMARA_DRAFT;
  }
}

/** The app-wide repository handle. Swap this construction for the vault-backed one later. */
export const clientRepository: ClientRepository = new InMemoryClientRepository();
