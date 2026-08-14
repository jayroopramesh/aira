/**
 * Build a lightweight caseload Client from a just-completed session draft, so a captured session
 * shows up in the (otherwise blank) caseload and dashboard. Measures/scores are intentionally empty
 * — a single session yields no assessment series yet, which the sparse-series rule renders as a
 * dot-strip. The clinician fills the rest over time.
 */

import type { Client, DraftNote, PrepItem, RiskLevel } from './types';

/** Severity ordering for the caseload risk tiers — used to compare, never to render. */
const RISK_ORDER: Record<RiskLevel, number> = { clear: 0, watch: 1, elevated: 2, acute: 3 };

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
 * The summarizer emits a structured `riskLevel`; we trust it for the ordinary case (no prose-sniffing
 * to RE-derive a lower tier). But the model may contradict itself — disclose ideation in the rows or
 * summary while returning a `watch`/`clear` `level`. So we apply an UP-ONLY safety floor: derive what
 * the note's own risk TEXT discloses (`riskFromRows`) and never let the structured tier fall BELOW an
 * acute/elevated disclosure. This makes the "any disclosed ideation ⇒ acute, never auto-downgrade"
 * invariant hold on the live path exactly as it does in the mock — the floor only ever RAISES the
 * tier, so it cannot reintroduce the under-rating that motivated trusting the structured field, and a
 * "watch"/"clear" derivation (no rows, or explicitly denied) never overrides the model.
 *
 * When there is no structured level (mock/older notes) the row-derivation IS the tier.
 */
export function riskFromNote(note: DraftNote): RiskLevel {
  const { tier, floor } = scanNoteRisk(note);
  // No structured level (mock/older notes): the conservative derivation IS the tier.
  if (!note.riskLevel) return tier;
  // Structured level present: trust it for the ordinary case, but never let it fall BELOW a genuine
  // positive disclosure the note's own risk text documents (up-only floor). A neutral / denied /
  // not-assessed note yields NO floor, so "trust the structured tier" still holds — the floor only
  // ever raises, never lowers, keeping the never-auto-downgrade rule intact on the live path.
  return floor && RISK_ORDER[floor] > RISK_ORDER[note.riskLevel] ? floor : note.riskLevel;
}

/**
 * Read a note's own risk TEXT (structured rows + the risk-summary sentence) two ways:
 *  - `tier`: the conservative full derivation used when there is NO structured level — ANY suicidal
 *    ideation that isn't explicitly denied/​not-assessed is ACUTE, endorsed self-harm is ELEVATED,
 *    un-assessed risk is WATCH (never a false "clear"). Errs toward over-, never under-, rating.
 *  - `floor`: the STRICT up-only safety floor applied when a structured level IS present — acute/
 *    elevated only on a genuine POSITIVE disclosure marker (not merely "not denied"), so it raises the
 *    model's tier on a real disclosure it under-rated, yet a neutral row like "Not raised this session"
 *    never floors a benign tier up.
 * This matches the app's own convention (Leah, whose last session had passive ideation, is
 * "Acute · review").
 */
function scanNoteRisk(note: DraftNote): { tier: RiskLevel; floor: 'acute' | 'elevated' | null } {
  const risk = note.sections.find((s) => s.isRisk);
  const rows = risk?.rows ?? [];
  // The model can disclose ideation only in the summary sentence, not as a labeled row, so scan it too.
  const summary = (risk?.body ?? []).join(' ').toLowerCase();

  const valueFor = (kw: string) => rows.find((r) => r.label.toLowerCase().includes(kw))?.value?.toLowerCase() ?? '';
  const has = (s: string, ...kws: string[]) => kws.some((k) => s.includes(k));

  const ideation = valueFor('ideation') || valueFor('suicid');
  const selfHarm = valueFor('self-harm') || valueFor('self harm');
  const allText = rows.map((r) => `${r.label} ${r.value}`.toLowerCase()).join(' | ');

  const isDenial = (s: string) =>
    has(s, 'denied', 'denies', 'none reported', 'not present', 'no ideation', 'nil', 'negative', 'no concerns', 'absent');
  const isNotAssessed = (s: string) =>
    has(s, 'not assessed', 'not captured', 'unable to assess', 'not evaluated', 'review required', 'deferred');
  // A row like "Passive ideation reported; denies plan or intent" DISCLOSES even though it also
  // contains a denial token — a positive-disclosure marker outranks the denial of a plan/means.
  // Negated forms ("none reported", "not present") are scrubbed first so they never read as disclosure.
  const discloses = (s: string) => {
    const scrubbed = s.replace(/\b(?:none|not|no|nothing|denies|denied|without)\s+(?:[\w-]+\s+){0,2}(?:reported|endorsed|present|noted)\b/g, '');
    return (
      has(scrubbed, 'passive', 'transient', 'fleeting', 'intermittent', 'endorsed', 'reported', 'noted', 'thoughts of', 'better off', 'not wanting to be') ||
      /(?:ideation|thoughts?|urges?)\s+present/.test(scrubbed)
    );
  };

  // A summary sentence can disclose ideation even when it wasn't structured as a row. Reuse the mock
  // summarizer's proven ideation-cue + denial detection (see `scanTranscriptRisk` in summarization.ts)
  // so a summary-only disclosure floors to acute WITHOUT false-positiving on a benign "no suicidal
  // ideation was raised" sentence (the cue anchors are specific, and the negation check catches
  // "no/denied … suicidal ideation" without swallowing "better off not here").
  const summaryIdeationCues = [
    'suicid', 'kill myself', 'end my life', 'end it all', 'better off dead', 'better off not here',
    'better off gone', "don't want to be here", 'do not want to be here', "don't want to be alive",
    'not want to be alive', 'not worth living', 'thoughts of dying', 'thoughts of death',
  ];
  const summaryDisclosesIdeation =
    summaryIdeationCues.some((k) => summary.includes(k)) &&
    !/\b(?:denied|denies)\b[^.?!]{0,40}?(?:suicid|ideation|thoughts of|wanting to die|kill (?:myself|herself|himself))|\b(?:no|not|without(?: any)?)\s+(?:[\w'-]+\s+){0,2}(?:suicid|ideation|wanting to die)/.test(
      summary,
    );

  // Genuine POSITIVE disclosures (used by the strict floor).
  const ideationDisclosed = (!!ideation && !isNotAssessed(ideation) && discloses(ideation)) || summaryDisclosesIdeation;
  const selfHarmDisclosed = !!selfHarm && !isNotAssessed(selfHarm) && discloses(selfHarm);
  const floor: 'acute' | 'elevated' | null = ideationDisclosed ? 'acute' : selfHarmDisclosed ? 'elevated' : null;

  // Aggressive full derivation (used only when there is no structured level).
  const tier: RiskLevel = (() => {
    // No risk rows AND no summary means nothing was assessed — "watch", never a false "clear".
    if (!rows.length && !summary.trim()) return 'watch';
    // ANY disclosed (non-denied, actually-assessed) suicidal ideation → acute.
    if (ideation && !isNotAssessed(ideation) && (discloses(ideation) || !isDenial(ideation))) return 'acute';
    if (summaryDisclosesIdeation) return 'acute';
    // Self-harm currently endorsed → elevated.
    if (selfHarm && !isNotAssessed(selfHarm) && (discloses(selfHarm) || !isDenial(selfHarm))) return 'elevated';
    // Risk simply not assessed (silence/failed capture, or model omission) → watch, never false "clear".
    if ((ideation && isNotAssessed(ideation)) || isNotAssessed(allText)) return 'watch';
    // Explicit denial / nothing of concern raised → clear.
    return 'clear';
  })();

  return { tier, floor };
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
 * timeline entry, and raises risk from the newest note — a client's standing risk tier is never
 * auto-DOWNGRADED by a calmer session (captain ruling); lowering it is a deliberate clinician act.
 */
export function appendSessionToClient(
  existing: Client,
  note: DraftNote,
  opts: { sessionNumber: number; dateLabel: string },
): Client {
  const subjective = note.sections.find((s) => s.marker === 'S');
  const summary = subjective?.body?.[0] ?? existing.summaryLine;
  const noteRisk = riskFromNote(note);

  return {
    ...existing,
    risk: RISK_ORDER[noteRisk] > RISK_ORDER[existing.risk] ? noteRisk : existing.risk,
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
