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
 * the note's own risk TEXT discloses (`scanNoteRisk`) and never let the structured tier fall BELOW an
 * acute/elevated disclosure. This makes the "any disclosed ideation ⇒ acute, never auto-downgrade"
 * invariant hold on the live path exactly as it does in the mock — the floor only ever RAISES the
 * tier, so it cannot reintroduce the under-rating that motivated trusting the structured field, and a
 * "watch"/"clear" derivation (no rows, or explicitly denied) never overrides the model.
 *
 * The floor is the positive-tier restriction of the SAME derivation used when there is no structured
 * level, so a leveled note and an unleveled note with identical risk text can never disagree about
 * what that text discloses — the live/mock asymmetry has nowhere to hide.
 */
export function riskFromNote(note: DraftNote): RiskLevel {
  const derived = scanNoteRisk(note);
  // No structured level (mock/older notes): the conservative derivation IS the tier.
  if (!note.riskLevel) return derived;
  // Structured level present: trust it for the ordinary case, but never let it fall BELOW what the
  // note's own risk text discloses (up-only floor). A neutral / denied / not-assessed note derives
  // "watch"/"clear", which yields NO floor, so "trust the structured tier" still holds — the floor
  // only ever raises, never lowers, keeping the never-auto-downgrade rule intact on the live path.
  const floor = derived === 'acute' || derived === 'elevated' ? derived : null;
  return floor && RISK_ORDER[floor] > RISK_ORDER[note.riskLevel] ? floor : note.riskLevel;
}

/**
 * Derive, from a note's own risk TEXT (structured rows + the risk-summary sentence), the tier that
 * text documents: ANY suicidal ideation that isn't explicitly denied/​not-assessed is ACUTE, endorsed
 * self-harm is ELEVATED, un-assessed risk is WATCH (never a false "clear"). Errs toward over-, never
 * under-, rating. This matches the app's own convention (Leah, whose last session had passive
 * ideation, is "Acute · review").
 *
 * There is deliberately ONE derivation: it is both the tier when no structured level exists and the
 * source of the up-only floor when one does. Two separate ladders drifted apart before — the strict
 * floor missed the plainest disclosures ("Suicidal ideation: Present") that the derivation caught.
 */
function scanNoteRisk(note: DraftNote): RiskLevel {
  const risk = note.sections.find((s) => s.isRisk);
  const rows = risk?.rows ?? [];
  // The model can disclose ideation only in the summary sentence, not as a labeled row, so scan it too.
  const summary = (risk?.body ?? []).join(' ').toLowerCase();

  const valueFor = (kw: string) => rows.find((r) => r.label.toLowerCase().includes(kw))?.value?.toLowerCase() ?? '';
  const has = (s: string, ...kws: string[]) => kws.some((k) => s.includes(k));

  const ideation = valueFor('ideation') || valueFor('suicid');
  const selfHarm = valueFor('self-harm') || valueFor('self harm');
  const allText = rows.map((r) => `${r.label} ${r.value}`.toLowerCase()).join(' | ');

  // A denial is either a denial token, or a negation BINDING a risk topic ("no suicidal ideation",
  // "without any thoughts of self-harm"). The bound form matters: a fixed 'no ideation' token misses
  // every ordinary phrasing that puts a word between the negation and the topic — including the mock
  // summarizer's own benign sentence — which then reads as a disclosure and pins the client to acute.
  // The anchors are deliberately ideation/self-harm SPECIFIC: a generic "no other risk factors" or
  // "no concerns about X" says nothing about the ideation itself, and letting it bind would cancel the
  // safety floor on the most severe row there is ("Active with a plan; no other risk factors").
  const isDenial = (s: string) =>
    has(s, 'denied', 'denies', 'none reported', 'not present', 'no ideation', 'nil', 'negative', 'no concerns', 'absent') ||
    /\b(?:no|not|without)\s+(?:[\w'-]+\s+){0,3}(?:ideation|suicid\w*|self[- ]?harm|thoughts of)\b/.test(s);
  // "Not raised / not disclosed / not addressed" are NEUTRAL: the topic simply didn't come up. They are
  // neither a disclosure nor a clinical denial, so they must land on "watch" — without them the
  // not-denied branch below would read a benign mock row ("Not raised this session", or the
  // "Not explicitly addressed" the mock emits on its self-harm branch) as disclosed ideation.
  const isNotAssessed = (s: string) =>
    has(s, 'not assessed', 'not captured', 'unable to assess', 'not evaluated', 'review required', 'deferred', 'not raised', 'not disclosed', 'not reported', 'not explicitly addressed', 'not addressed', 'not discussed');
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

  // A summary sentence can disclose ideation even when it wasn't structured as a row, so scan it with
  // the mock summarizer's ideation cues (see `scanTranscriptRisk` in summarization.ts).
  const summaryIdeationCues = [
    'suicid', 'ideation', 'kill myself', 'end my life', 'end it all', 'better off dead', 'better off not here',
    'better off gone', "don't want to be here", 'do not want to be here', "don't want to be alive",
    'not want to be alive', 'not worth living', 'thoughts of dying', 'thoughts of death',
  ];
  // The summary is judged on cue + not-assessed + not-denied ONLY. `discloses()` is deliberately NOT
  // applied here: its markers are bare substrings, so in free prose they match words that belong to a
  // different clause ("Client reported improved mood…", "…denied any thoughts of suicide") and would
  // override a correct denial — a false acute the caseload can never come back down from. Scoping a
  // substring marker to the ideation clause is not something this can do reliably, so the
  // disclosure-despite-a-plan-denial case is delegated to the structured ideation ROW below, where the
  // text being tested is already scoped to ideation.
  const hasIdeationCue = summaryIdeationCues.some((k) => summary.includes(k));
  const summaryDiscloses = hasIdeationCue && !isNotAssessed(summary) && !isDenial(summary);

  // No risk rows AND no summary means nothing was assessed — "watch", never a false "clear".
  if (!rows.length && !summary.trim()) return 'watch';
  // ANY disclosed (non-denied, actually-assessed) suicidal ideation → acute. `!isDenial` is what makes
  // the plainest phrasings ("Present", "Active, with a plan and means") count without needing to be on
  // a hand-maintained marker list.
  if (ideation && !isNotAssessed(ideation) && (discloses(ideation) || !isDenial(ideation))) return 'acute';
  if (summaryDiscloses) return 'acute';
  // Self-harm currently endorsed → elevated.
  if (selfHarm && !isNotAssessed(selfHarm) && (discloses(selfHarm) || !isDenial(selfHarm))) return 'elevated';
  // Risk simply not assessed (silence/failed capture, or model omission) → watch, never false "clear".
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
