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
 * Does this risk-row VALUE deny the risk it describes? Five readings, any of which is a denial:
 * a denial VERB that isn't denying the plan/means ("Denied", "Denies thoughts of suicide" — but NOT
 * the "denies plan or intent" that follows a disclosure); a negation BOUND to an ideation/self-harm
 * TOPIC word ("no SI/HI", "no current ideation"); a negation bound to a STATE or concern word ("not
 * currently present", "none currently reported", "Screened; no acute concerns"); a LEADING terse
 * denial ("None", "No", "None this session"); or a fixed denial word ("Nil for this session",
 * "Screening negative", "Absent this session").
 *
 * A negation only denies the ROW when its object is the row's own topic or state. What the clinician
 * denied is decided by what the negation REACHES, so the bound-negation gap to a STATE word cannot
 * cross a plan/intent/means noun: "Present; no current plan or intent" and "Endorsed; no means noted"
 * deny the plan, not the ideation, and reading them as row denials silently drops the acute floor on a
 * documented disclosure — the one direction this floor exists to prevent.
 *
 * Reaching the TOPIC itself needs no such guard: whatever else a negation lists, if it arrives at
 * "ideation" it denied the ideation. So the topic branches cross plan/intent nouns and commas freely —
 * "Denies any plan, intent, or suicidal ideation" and "No plan, intent, or ideation" are ordinary full
 * denials, and reading them as disclosures pinned a benign client to acute forever purely because of
 * the order the model happened to list the objects in.
 *
 * "Concerns" is a genuine denial anchor wherever it sits, because "Screened; no acute concerns" is an
 * ordinary way to answer the row and reading it as a disclosure pins a benign client to acute forever.
 * The cost is that a trailing concern-denial cannot be told apart from that: "Present; nothing further
 * of concern" has the identical shape and now reads as denied. Separating them would need a
 * positive-marker test on the leading clause — the unscoped-substring approach that produced false
 * acutes for six rounds. An under-rate leaves the model's own structured tier standing; a false acute
 * can never be lowered, so the tie breaks toward the denial.
 *
 * The leading-denial branch answers the row, so it holds however the phrase is finished — UNLESS the
 * value goes on to name the risk itself ("No plan, but active ideation present"), which is a
 * disclosure wearing a denial's opening clause.
 *
 * Every one of these shapes has been read as a DISCLOSURE by an earlier, narrower predicate, and each
 * time it pinned an ordinary client to acute permanently — nothing lowers a tier. Exact bigrams
 * ('not present') missed every phrasing with a word inserted; requiring the denial word to be the
 * WHOLE value missed every phrasing with a word appended; requiring an anchor missed the bare "None"
 * that is the canonical terse answer to a screening row. Tightness fails the other way too: generic
 * anchors ('risk', 'factors') would let "Active with a plan; no other risk factors" read as a denial
 * of the ideation itself and cancel the floor on the most severe row there is.
 */
function deniesRisk(s: string): boolean {
  return (
    /\b(?:denied|denies|denying)\b(?!\s+(?:to\s+\w+\s+)?(?:a\s+|any\s+|the\s+)?(?:plan|intent|means|access|method|specific)\b)/.test(s) ||
    /\b(?:denied|denies|denying)\b[\s\w'/,-]{0,40}?\b(?:ideation|suicid\w*|self[- ]?harm|si|hi|thoughts of)\b/.test(s) ||
    /\b(?:no|not|none|without|nil|negative|absent|nothing)\b[\s\w'/,-]{0,20}?\b(?:ideation|suicid\w*|self[- ]?harm|thought|si|hi)\b/.test(s) ||
    /\b(?:no|not|none|without|nil|negative|absent|nothing)\b(?:(?!\b(?:plan|intent|means|method|access)\b)[\s\w'/-]){0,20}?\b(?:present|reported|endorsed|noted|raised|concerns?)\b/.test(s) ||
    /^\s*(?:no|none|nil|negative|absent|denied|denies|nad|n\/?a)\b(?![\s\w'/-]{0,30}?\b(?:ideation|suicid\w*|self[- ]?harm|thought|plan|intent|endorsed|present|active|passive|reported)\b)/.test(s) ||
    /\b(?:nil|negative|absent)\b|none reported|not present|no ideation|no concerns|nothing of concern|not endorsed/.test(s)
  );
}

/**
 * Ideation NAMED and stated positively — a severity qualifier or a report verb bound to the word
 * "ideation"/"SI", or ideation carrying a plan/intent/means. This is how a real disclosure is written
 * ("Passive ideation reported; denies active ideation, plan or intent", "Active suicidal ideation with
 * a plan; no other concerns"), and it must outrank a denial elsewhere in the value: the denial there is
 * of a NARROWER form or of an unrelated worry, and letting it cancel the row drops the acute floor on a
 * documented disclosure.
 *
 * Every test is anchored ON the ideation word rather than being a loose substring, so — unlike the
 * marker list this replaced — a word sitting in an unrelated clause cannot trigger it. Negated
 * mentions of ideation are scrubbed FIRST, which is what keeps "No suicidal ideation reported" and
 * "Denies any passive ideation" clear. Written as a scrub rather than a lookbehind, which Hermes does
 * not support.
 *
 * The scrub allows a few words between the negation and the ideation word, because a denial is rarely
 * adjacent to its object. Its gap is word-only, so it cannot cross the ';' or ',' separating a real
 * disclosure from a following denial clause — "Passive ideation reported; denies active ideation" still
 * affirms.
 *
 * Accepted safe residual: a negation separated from the ideation word by punctuation ("denies, on
 * direct questioning, any passive ideation") still reads as an affirmation. Rare, and it errs safe.
 */
const NEGATED_IDEATION =
  /\b(?:no|not|none|nil|negative|absent|nothing|without|denies|denied|denying)\s+(?:[\w'-]+\s+){0,3}(?:suicidal\s+)?(?:ideation|si)\b/g;
const NAMED_IDEATION =
  /\b(?:passive|active|chronic|fleeting|transient|intermittent|recurrent|persistent|endorses?|endorsed|reports?|reported|describes?|described|expresses?|expressed|admits?|admitted|voiced|discloses?|disclosed)\s+(?:suicidal\s+)?(?:ideation|si)\b/;
const IDEATION_WITH_PLAN = /\b(?:suicidal\s+)?(?:ideation|si)\s+(?:with|and)\s+(?:a\s+)?(?:plan|intent|means)\b/;

function affirmsIdeation(s: string): boolean {
  const scrubbed = s.replace(NEGATED_IDEATION, ' ');
  return NAMED_IDEATION.test(scrubbed) || IDEATION_WITH_PLAN.test(scrubbed);
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

  // "Not raised / not addressed / deferred" are NEUTRAL: the topic simply didn't come up. They are
  // neither a disclosure nor a clinical denial, so they must land on "watch" — without them the
  // not-denied branch below would read a benign mock row ("Not raised this session", or the
  // "Not explicitly addressed" the mock emits on its self-harm branch) as disclosed ideation.
  // These describe the STATUS OF THE SCREENING, not what a client did: 'not disclosed'/'not reported'
  // were dropped because they equally describe ordinary content ("not disclosed to family").
  // 'Not applicable' / 'N/A' are the same non-answer written two ways; both must land on the same
  // tier rather than three apart. 'n/a' is matched on word boundaries, not as a substring, so an
  // ordinary "clinician/assessor" cannot read as a non-answer.
  const isNotAssessed = (s: string) =>
    has(s, 'not assessed', 'not captured', 'unable to assess', 'not evaluated', 'review required', 'deferred', 'not raised', 'not explicitly addressed', 'not addressed', 'not discussed', 'not applicable') ||
    /\bn\/a\b/.test(s);
  // A disclosure is simply a PRESENT row that is neither not-assessed nor denied. There is
  // deliberately NO positive-substring marker test: a marker cannot be scoped to the clause it belongs
  // to inside a multi-clause value, so it structurally produces false acutes — "Denied; protective
  // factors noted" and "Client denied; presents as future-oriented" both read as disclosures and, under
  // never-downgrade, pin a clear client to acute forever. `deniesRisk` carries the whole burden, and
  // its plan/intent lookahead is what keeps "Passive ideation reported; denies plan or intent" a
  // disclosure. The one exception is `affirmsIdeation`, which is anchored ON the ideation word rather
  // than being a marker substring, so it can outrank a denial of a NARROWER form or of an unrelated
  // worry without the clause-scoping problem that made the old marker list unusable. Ideation only —
  // self-harm has no equivalent naming vocabulary, so it stays purely denial-driven.
  //
  // This floor is a HEURISTIC BACKSTOP over the model's own structured riskLevel, not a parser.
  // ACCEPTED RESIDUAL CLASS (captain decision, not chased further): a deeply compound value where a
  // denial and a named disclosure interleave in ways lexical rules cannot scope may mis-tier at the
  // margin — a value that endorses ideation without naming it while carrying an unrelated bare denial
  // ("Endorsed; denied to spouse"), or a trailing screening-status clause ("Passive ideation reported;
  // safety plan deferred"). Every realistic model row value is handled, the floor only ever RAISES,
  // and the clinician reads and signs every note.
  const isDisclosed = (s: string) => !!s && !isNotAssessed(s) && !deniesRisk(s);
  const ideationDisclosed = !!ideation && !isNotAssessed(ideation) && (affirmsIdeation(ideation) || !deniesRisk(ideation));
  const selfHarmDisclosed = isDisclosed(selfHarm);

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
