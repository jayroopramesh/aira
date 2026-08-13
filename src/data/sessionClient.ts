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
 * Derive the caseload risk level from the note's Risk & Safety check (F4). The caseload risk queue
 * is what a counselor scans to decide who needs attention, so it must reflect what the signed note
 * documents — never a hardcoded "clear". Reads the ideation / self-harm rows and maps conservatively:
 * an explicit denial reads clear, passive ideation or current self-harm reads elevated, ideation with
 * a plan/means/intent reads acute, and anything unclassifiable (e.g. "not assessed") reads watch so it
 * is never silently reassuring.
 */
export function riskFromNote(note: DraftNote): RiskLevel {
  const risk = note.sections.find((s) => s.isRisk);
  const rows = risk?.rows ?? [];
  const valueFor = (kw: string) => rows.find((r) => r.label.toLowerCase().includes(kw))?.value?.toLowerCase() ?? '';
  const has = (s: string, ...kws: string[]) => kws.some((k) => s.includes(k));

  const ideation = valueFor('ideation') || valueFor('suicid');
  const selfHarm = valueFor('self-harm') || valueFor('self harm');
  const allText = rows.map((r) => `${r.label} ${r.value}`.toLowerCase()).join(' | ');

  const negated = (s: string) => has(s, 'denied', 'without plan', 'no plan', 'no specific plan', 'none', 'no means');

  // Ideation with a concrete plan / means / intent (and not explicitly negated) → acute.
  if (ideation && has(ideation, 'plan', 'means', 'intent', 'active') && !negated(ideation)) return 'acute';

  // Passive ideation, or self-harm currently reported → elevated.
  const passiveIdeation = ideation && has(ideation, 'passive') && !has(ideation, 'denied');
  const selfHarmPresent = selfHarm && !has(selfHarm, 'denied', 'none', 'nil', 'no ', 'not reported');
  if (passiveIdeation || selfHarmPresent) return 'elevated';

  // Risk that was NOT assessed / captured (e.g. the silence case, or the model omitting the check) →
  // watch, so the caseload never reads a reassuring "clear" for a session where risk is simply unknown.
  if (has(allText, 'not assessed', 'not captured', 'review required', 'unable to assess', 'not evaluated')) return 'watch';

  // Explicit denial / nothing of concern raised → clear.
  if (ideation && has(ideation, 'denied', 'none', 'no ', 'nil', 'not present')) return 'clear';

  // Some other risk text we couldn't classify → watch; truly no risk info at all → clear (routine).
  return ideation || selfHarm ? 'watch' : 'clear';
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
