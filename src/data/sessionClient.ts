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
 * to RE-derive a lower tier). But the model may contradict itself — disclose ideation in the risk
 * ROWS while returning a `watch`/`clear` `level`. So we apply an UP-ONLY safety floor: derive what
 * those rows disclose (`scanNoteRisk`) and never let the structured tier fall BELOW an
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

/** Ideation cues, used to find the ideation ROW when the model labelled it something unexpected. */
const IDEATION_CUE =
  /suicid|ideation|thoughts of (?:dying|death|suicide|not being here|being better off)|kill (?:my|her|him|them)sel|end (?:my|her|his|their) life|better off (?:dead|gone|not here)|\bsi\b|\bsi\/hi\b/;
const SELF_HARM_CUE = /self[- ]?harm|cutting|hurt (?:my|her|him|them)sel/;

/**
 * Does this risk-row VALUE deny the risk it describes? A denial verb, a bare denial word standing as
 * the whole value ("Nil", "Absent"), or a negation BOUND to an ideation/self-harm/state anchor within
 * a few tokens ("no SI/HI", "not currently present", "none currently reported").
 *
 * Binding is what keeps this honest in both directions. Exact bigrams ('not present') missed every
 * phrasing with a word inserted, reading routine denials as disclosures. Generic anchors ('concerns',
 * 'risk') went the other way: "Active with a plan; no other risk factors" read as a denial of the
 * ideation itself and cancelled the floor on the most severe row there is. So only ideation/self-harm
 * and state words anchor a negation.
 */
function deniesRisk(s: string): boolean {
  return (
    /\b(?:denied|denies|denying)\b/.test(s) ||
    /^\s*(?:nil|none|negative|absent|no)\s*\.?\s*$/.test(s) ||
    /\b(?:no|not|none|without|nil|negative|absent|nothing)\b[\s\w'/-]{0,20}?\b(?:ideation|suicid\w*|self[- ]?harm|thought|present|reported|endorsed|noted|raised|current|si|hi)\b/.test(s)
  );
}

/**
 * Derive, from a note's STRUCTURED risk rows, the tier the note documents: disclosed suicidal ideation
 * is ACUTE, disclosed self-harm is ELEVATED, un-assessed risk is WATCH (never a false "clear"). Errs
 * toward over-, never under-, rating. This matches the app's own convention (Leah, whose last session
 * had passive ideation, is "Acute · review").
 *
 * ROWS ONLY — the free-text risk summary deliberately does NOT influence the tier. Judging a whole
 * sentence cost four rounds of false acutes: a disclosure marker belonging to one clause ("Client
 * reported improved mood; … screened and denied") kept overriding a correct denial, and a benign
 * sentence the system prompt itself invites ("nothing of concern was raised") matched no denial
 * pattern at all — each one pinning an ordinary client to acute permanently, since no path lowers a
 * tier. A row value is already scoped to its topic, so the same predicates are sound there.
 *
 * There is deliberately ONE derivation: it is both the tier when no structured level exists and the
 * source of the up-only floor when one does. Two separate ladders drifted apart before — the strict
 * floor missed the plainest disclosures ("Suicidal ideation: Present") that the derivation caught.
 */
function scanNoteRisk(note: DraftNote): RiskLevel {
  const risk = note.sections.find((s) => s.isRisk);
  const rows = risk?.rows ?? [];

  const has = (s: string, ...kws: string[]) => kws.some((k) => s.includes(k));
  // Match on the LABEL or the VALUE: a row the model labelled 'Risk' or 'SI/HI' must never hide a
  // disclosure just because the label didn't use the word we expected.
  const valueFor = (labelRe: RegExp, valueRe: RegExp) =>
    rows.find((r) => labelRe.test(r.label.toLowerCase()) || valueRe.test(r.value.toLowerCase()))?.value?.toLowerCase() ?? '';

  const ideation = valueFor(/ideation|suicid/, IDEATION_CUE);
  const selfHarm = valueFor(/self[- ]?harm/, SELF_HARM_CUE);
  const allText = rows.map((r) => `${r.label} ${r.value}`.toLowerCase()).join(' | ');

  // "Not raised / not disclosed / not addressed" are NEUTRAL: the topic simply didn't come up. They are
  // neither a disclosure nor a clinical denial, so they must land on "watch" — without them the
  // not-denied branch below would read a benign mock row ("Not raised this session", or the
  // "Not explicitly addressed" the mock emits on its self-harm branch) as disclosed ideation.
  const isNotAssessed = (s: string) =>
    has(s, 'not assessed', 'not captured', 'unable to assess', 'not evaluated', 'review required', 'deferred', 'not raised', 'not disclosed', 'not reported', 'not explicitly addressed', 'not addressed', 'not discussed');
  // A row like "Passive ideation reported; denies plan or intent" DISCLOSES even though it also
  // contains a denial verb — a positive-disclosure marker outranks the denial of a plan/means.
  // Negated forms ("none reported", "not present") are scrubbed first so they never read as disclosure.
  const discloses = (s: string) => {
    const scrubbed = s.replace(/\b(?:none|not|no|nothing|denies|denied|without)\s+(?:[\w-]+\s+){0,2}(?:reported|endorsed|present|noted)\b/g, '');
    return (
      has(scrubbed, 'passive', 'transient', 'fleeting', 'intermittent', 'endorsed', 'reported', 'noted', 'thoughts of', 'better off', 'not wanting to be') ||
      /(?:ideation|thoughts?|urges?)\s+present/.test(scrubbed)
    );
  };

  const ideationDisclosed = !!ideation && !isNotAssessed(ideation) && (discloses(ideation) || !deniesRisk(ideation));
  const selfHarmDisclosed = !!selfHarm && !isNotAssessed(selfHarm) && (discloses(selfHarm) || !deniesRisk(selfHarm));

  if (ideationDisclosed) return 'acute';
  if (selfHarmDisclosed) return 'elevated';
  // Nothing assessed at all, or a row that says so outright (including buildDraft's "Not captured in
  // this draft — review required" stand-in) → watch, never a false "clear".
  if (!rows.length) return 'watch';
  if ((ideation && isNotAssessed(ideation)) || (selfHarm && isNotAssessed(selfHarm)) || isNotAssessed(allText)) return 'watch';
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
