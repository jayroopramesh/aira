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

const IDEATION_LABEL = /ideation|suicid/;
const SELF_HARM_LABEL = /self[- ]?harm/;
/** Ideation cues, used to find the ideation ROW when the model labelled it something unexpected. */
const IDEATION_CUE =
  /suicid|ideation|thoughts of (?:dying|death|suicide|not being here|being better off)|kill (?:my|her|him|them)sel|end (?:my|her|his|their) life|better off (?:dead|gone|not here)|\bsi\b|\bsi\/hi\b/;
const SELF_HARM_CUE = /self[- ]?harm|cutting|hurt (?:my|her|him|them)sel/;

/**
 * Does this risk-row VALUE deny the risk it describes? A denial verb, a standalone denial word
 * ("Nil for this session", "Screening negative", "Absent this session"), or a negation BOUND to an
 * ideation/self-harm/state anchor within a few tokens ("no SI/HI", "not currently present",
 * "none currently reported", "no acute concerns").
 *
 * Both looseness and tightness have burned this before. Exact bigrams ('not present') missed every
 * phrasing with a word inserted; requiring a denial word to be the WHOLE value missed every phrasing
 * with a word appended — both read a routine denial as a disclosure and pin a benign client to acute.
 * Generic anchors ('risk', 'factors') fail the other way: "Active with a plan; no other risk factors"
 * would read as a denial of the ideation itself and cancel the floor on the most severe row there is.
 * So denial words match anywhere, and a negation only binds an ideation/self-harm/state/concern word.
 */
function deniesRisk(s: string): boolean {
  return (
    /\b(?:denied|denies|denying)\b/.test(s) ||
    /\b(?:nil|negative|absent)\b/.test(s) ||
    /none reported|not present|no ideation|no concerns|not endorsed/.test(s) ||
    /\b(?:no|not|none|without|nil|negative|absent|nothing)\b[\s\w'/-]{0,20}?\b(?:ideation|suicid\w*|self[- ]?harm|thought|present|reported|endorsed|noted|raised|current|concerns?|si|hi)\b/.test(s)
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
  // A correctly LABELLED row always wins. The value-cue fallback exists so a row the model labelled
  // 'Risk' or 'SI/HI' can't hide a disclosure — but it must never outrank the row actually about the
  // topic, or a row that merely mentions the other topic ("Ideation: denied; no self-harm reported")
  // shadows the real one ("Self-harm: endorsed cutting this week") and swallows its tier. The fallback
  // therefore also skips rows labelled for the OTHER topic.
  const valueFor = (labelRe: RegExp, valueRe: RegExp, otherLabelRe: RegExp) =>
    (
      rows.find((r) => labelRe.test(r.label.toLowerCase())) ??
      rows.find((r) => valueRe.test(r.value.toLowerCase()) && !otherLabelRe.test(r.label.toLowerCase()))
    )?.value?.toLowerCase() ?? '';

  const ideation = valueFor(IDEATION_LABEL, IDEATION_CUE, SELF_HARM_LABEL);
  const selfHarm = valueFor(SELF_HARM_LABEL, SELF_HARM_CUE, IDEATION_LABEL);
  const allText = rows.map((r) => `${r.label} ${r.value}`.toLowerCase()).join(' | ');

  // "Not raised / not disclosed / not addressed" are NEUTRAL: the topic simply didn't come up. They are
  // neither a disclosure nor a clinical denial, so they must land on "watch" — without them the
  // not-denied branch below would read a benign mock row ("Not raised this session", or the
  // "Not explicitly addressed" the mock emits on its self-harm branch) as disclosed ideation.
  const isNotAssessed = (s: string) =>
    has(s, 'not assessed', 'not captured', 'unable to assess', 'not evaluated', 'review required', 'deferred', 'not raised', 'not disclosed', 'not reported', 'not explicitly addressed', 'not addressed', 'not discussed');
  // A row like "Passive ideation reported; denies plan or intent" DISCLOSES even though it also
  // contains a denial verb — a positive-disclosure marker outranks the denial of a plan/means. Plain
  // STATE words count as markers too ("Present; denies plan or intent", "Active thoughts, denies
  // intent"): the same clinical fact written without a fancier adjective must not lose the floor.
  // Negated forms ("not currently present", "no active ideation") are scrubbed first — every marker
  // that can be negated appears in the scrub's trailing group as well.
  const discloses = (s: string) => {
    const scrubbed = s.replace(/\b(?:none|not|no|nothing|denies|denied|without)\s+(?:[\w-]+\s+){0,2}(?:reported|endorsed|present|noted|active|ongoing|positive)\b/g, '');
    return (
      has(scrubbed, 'passive', 'transient', 'fleeting', 'intermittent', 'endorsed', 'reported', 'noted', 'thoughts of', 'better off', 'not wanting to be', 'present', 'active', 'ongoing', 'positive') ||
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
