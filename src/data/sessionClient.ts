/**
 * Build a lightweight caseload Client from a just-completed session draft, so a captured session
 * shows up in the (otherwise blank) caseload and dashboard. Measures/scores are intentionally empty
 * — a single session yields no assessment series yet, which the sparse-series rule renders as a
 * dot-strip. The clinician fills the rest over time.
 */

import { Client, DraftNote, PrepItem, RiskLevel } from './types';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'NC';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * The caseload risk tier for a captured session (F4). The caseload risk queue is what a counselor
 * scans to decide who needs attention, so it must reflect what the note documents — never a hardcoded
 * "clear", and never UNDER-rated on an unseen phrasing.
 *
 * PRIMARY: the summarizer emits a structured `riskLevel` and we map it straight through — no
 * keyword-sniffing of free prose for a suicide-risk tier (that kept under-rating "transient"/"fleeting"
 * ideation). FALLBACK (mock/older notes with no structured level): a deliberately conservative reading
 * where ANY disclosed suicidal ideation — passive, transient, fleeting, "better off not here", with or
 * without a plan — is ACUTE unless it is explicitly denied. This matches the app's own convention
 * (Leah, whose last session had passive ideation, is "Acute · review") and only ever errs toward
 * over-, never under-, rating.
 */
export function riskFromNote(note: DraftNote): RiskLevel {
  // Primary: trust the structured tier the summarizer assigned.
  if (note.riskLevel) return note.riskLevel;

  // Fallback: derive conservatively from the risk rows.
  const risk = note.sections.find((s) => s.isRisk);
  const rows = risk?.rows ?? [];
  const valueFor = (kw: string) => rows.find((r) => r.label.toLowerCase().includes(kw))?.value?.toLowerCase() ?? '';
  const has = (s: string, ...kws: string[]) => kws.some((k) => s.includes(k));

  const ideation = valueFor('ideation') || valueFor('suicid');
  const selfHarm = valueFor('self-harm') || valueFor('self harm');
  const allText = rows.map((r) => `${r.label} ${r.value}`.toLowerCase()).join(' | ');

  const isDenial = (s: string) =>
    has(s, 'denied', 'denies', 'none reported', 'not present', 'no ideation', 'nil', 'negative', 'no concerns', 'absent');
  const isNotAssessed = (s: string) =>
    has(s, 'not assessed', 'not captured', 'unable to assess', 'not evaluated', 'review required', 'deferred');

  // ANY disclosed (non-denied, actually-assessed) suicidal ideation → acute. Documented ideation is
  // the highest-priority caseload signal; we do not require the word "passive" or a stated plan.
  if (ideation && !isDenial(ideation) && !isNotAssessed(ideation)) return 'acute';

  // Self-harm currently endorsed → elevated.
  if (selfHarm && !isDenial(selfHarm) && !isNotAssessed(selfHarm)) return 'elevated';

  // Risk simply not assessed (silence/failed capture, or model omission) → watch, never a false "clear".
  if ((ideation && isNotAssessed(ideation)) || isNotAssessed(allText)) return 'watch';

  // Explicit denial / nothing of concern raised → clear.
  return 'clear';
}

function planFromNote(note: DraftNote, dateLabel: string): PrepItem[] {
  return note.prescriptions.map((p, i) => ({
    id: `plan-${i}`,
    text: p.text,
    source: `from Plan & Next Steps · ${dateLabel}`,
    done: false,
  }));
}

export function clientFromSession(
  id: string,
  note: DraftNote,
  opts: { name: string; sessionNumber: number; dateLabel: string },
): Client {
  const subjective = note.sections.find((s) => s.marker === 'S');
  const summary = subjective?.body?.[0] ?? 'New session captured today.';

  return {
    id,
    name: opts.name,
    initials: initialsOf(opts.name),
    tokenId: id.slice(0, 6),
    age: null,
    status: 'intake',
    risk: riskFromNote(note),
    clientSince: opts.dateLabel,
    sessionNumber: opts.sessionNumber,
    lastSessionLabel: `Today · ${opts.dateLabel}`,
    followUp: 'Set at next session',
    followUpDue: false,
    // No screening administered in a captured session yet — leave the score/trend empty (rendered as
    // "—") rather than a fabricated 0, which would read as a real "no depression" screen (F14).
    latestScore: null,
    sparkline: [],
    focusTags: [],
    summaryLine: summary,
    measures: [],
    timeline: [
      {
        id: `t-${id}`,
        kind: 'session',
        date: opts.dateLabel,
        title: `Session ${opts.sessionNumber}`,
        body: summary,
      },
    ],
    lastPlan: planFromNote(note, opts.dateLabel),
    naturalistic: [],
  };
}

/**
 * Fold a second (or later) captured session into an EXISTING caseload client (F3) instead of minting
 * a duplicate. Bumps the session count, refreshes the last-session/summary/plan, prepends a new
 * timeline entry, and re-derives risk from the newest note — so "patterns over time" can accumulate
 * for real data and the session history stays reachable.
 */
export function appendSessionToClient(
  existing: Client,
  note: DraftNote,
  opts: { sessionNumber: number; dateLabel: string },
): Client {
  const subjective = note.sections.find((s) => s.marker === 'S');
  const summary = subjective?.body?.[0] ?? existing.summaryLine;

  return {
    ...existing,
    risk: riskFromNote(note),
    sessionNumber: opts.sessionNumber,
    lastSessionLabel: `Today · ${opts.dateLabel}`,
    summaryLine: summary,
    lastPlan: planFromNote(note, opts.dateLabel),
    timeline: [
      {
        id: `t-${existing.id}-${opts.sessionNumber}`,
        kind: 'session',
        date: opts.dateLabel,
        title: `Session ${opts.sessionNumber}`,
        body: summary,
      },
      ...existing.timeline,
    ],
  };
}
