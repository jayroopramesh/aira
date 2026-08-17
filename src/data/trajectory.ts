/**
 * Longitudinal trajectory (captain feedback round 2, item 2): across a client's retained session
 * notes, surface recurring review codes, repeated plan/prescription items, and the risk-tier trend —
 * derived ONLY from data already on the notes (`reviewCodes`, `prescriptions`, `riskLevel`,
 * `sessionLabel`). Purely deterministic, on-device, no new cloud calls, no invented clinical claims:
 * every item this returns is directly traceable to a note already shown elsewhere in the app.
 *
 * `riskLevel` is TRUSTED as-is, same as everywhere else in the app (see `riskFromNote` in
 * `sessionClient.ts`) — this module never re-derives or re-scores it from note prose.
 */
import type { DraftNote, RiskLevel } from './types';

/** Captain's own wording: fewer than this many retained notes and trajectory says so, not a thin chart. */
export const MIN_SESSIONS_FOR_TRAJECTORY = 3;

export type RecurringCode = {
  code: string;
  label: string;
  /** How many of the client's retained notes carry this code. */
  count: number;
  /** Session labels it appeared in, oldest first, so a row is traceable to real notes. */
  sessions: string[];
};

export type RepeatedItem = {
  /** Normalised (trimmed, case-folded) text used to group repeats — display text is the first as-typed match. */
  text: string;
  count: number;
  sessions: string[];
};

export type RiskPoint = {
  sessionLabel: string;
  riskLevel: RiskLevel;
};

export type Trajectory = {
  /** Notes considered, oldest first (the order every list/point below is reported in). */
  sessionCount: number;
  recurringCodes: RecurringCode[];
  repeatedPrescriptions: RepeatedItem[];
  riskTrend: RiskPoint[];
};

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Derive the trajectory from a client's retained notes (`useClientNotes` order — newest first).
 * Returns `null` when there's not enough history (< `MIN_SESSIONS_FOR_TRAJECTORY`), so the caller
 * shows the honest empty state rather than a thin chart. Only codes/items that recur (count ≥ 2) or
 * risk levels present are returned — a code seen once isn't "recurring".
 */
export function deriveTrajectory(notesNewestFirst: DraftNote[]): Trajectory | null {
  if (notesNewestFirst.length < MIN_SESSIONS_FOR_TRAJECTORY) return null;
  const notes = [...notesNewestFirst].reverse(); // oldest first, so every list below reads chronologically

  const codes = new Map<string, RecurringCode>();
  for (const n of notes) {
    for (const rc of n.reviewCodes ?? []) {
      const existing = codes.get(rc.code);
      if (existing) {
        existing.count += 1;
        existing.sessions.push(n.sessionLabel);
      } else {
        codes.set(rc.code, { code: rc.code, label: rc.label, count: 1, sessions: [n.sessionLabel] });
      }
    }
  }

  const items = new Map<string, RepeatedItem>();
  for (const n of notes) {
    for (const p of n.prescriptions ?? []) {
      const key = normalize(p.text);
      if (!key) continue;
      const existing = items.get(key);
      if (existing) {
        existing.count += 1;
        existing.sessions.push(n.sessionLabel);
      } else {
        items.set(key, { text: p.text, count: 1, sessions: [n.sessionLabel] });
      }
    }
  }

  const riskTrend: RiskPoint[] = notes.filter((n) => n.riskLevel).map((n) => ({ sessionLabel: n.sessionLabel, riskLevel: n.riskLevel as RiskLevel }));

  return {
    sessionCount: notes.length,
    recurringCodes: [...codes.values()].filter((c) => c.count >= 2).sort((a, b) => b.count - a.count),
    repeatedPrescriptions: [...items.values()].filter((i) => i.count >= 2).sort((a, b) => b.count - a.count),
    riskTrend,
  };
}
