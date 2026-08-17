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

const normalizeName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Canonicalise an Emirates ID for COMPARISON only (the raw typed value is what gets stored): drop
 * every separator — spaces, dashes, dots — and case, so "784-1988-1234567-1", "784 1988 1234567 1"
 * and "78419881234567 1" all collapse to the same key. Purely local; the value never leaves the
 * device (captain scope, 2026-08-15).
 */
export function normalizeEmiratesId(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** A well-formed UAE Emirates ID, normalised: the 784 prefix + 12 digits = 15 digits, no more. */
const EMIRATES_ID_SHAPE = /^784[0-9]{12}$/;

/**
 * Is this typed value a well-formed Emirates ID? An IDENTITY key has to be shaped like one, because
 * anything else is a placeholder the counselor reached for when they didn't have the number — "N/A",
 * "unknown", a half-remembered "784-1988" — and two unrelated patients typing the same placeholder
 * would collapse into one record under a confident "you already see this client". Merging two patients
 * is the unrecoverable outcome this whole guard exists to prevent, so a malformed entry is simply NOT
 * an identity: it never keys a match and is never stored as one. The capture falls back to name-only
 * folding, exactly as when the field is left blank.
 */
export function isValidEmiratesId(raw: string): boolean {
  return EMIRATES_ID_SHAPE.test(normalizeEmiratesId(raw));
}

/**
 * The comparison key for a typed Emirates ID — the normalised digits when the value is a well-formed
 * Emirates ID, and '' for everything else (blank, punctuation-only, or any malformed entry). Every
 * identity comparison keys off THIS, never a raw non-empty string, so a placeholder can never act as
 * one patient's identity.
 */
function emiratesIdKey(raw?: string): string {
  const trimmed = raw?.trim();
  if (!trimmed) return '';
  const normalized = normalizeEmiratesId(trimmed);
  return EMIRATES_ID_SHAPE.test(normalized) ? normalized : '';
}

/** The pre-existing F3 fold candidate: a prior CAPTURED client ('s-' id) under the same typed name. */
function isCapturedNameMatch(cl: Client, typedName: string): boolean {
  return cl.id.startsWith('s-') && normalizeName(cl.name) === normalizeName(typedName);
}

/** Does this record carry the supplied identity key as its own stored (valid) Emirates ID? */
function holdsIdKey(cl: Client, key: string): boolean {
  return !!key && emiratesIdKey(cl.emiratesId) === key;
}

/**
 * The display label a record gets when the optional name field was left blank. It is a PLACEHOLDER,
 * never a name the counselor gave — so it can never act as a signal about who the patient is. Shared
 * with `DataProvider` so the label the mint writes and the label these checks discount are one string.
 */
export const UNNAMED_CLIENT_NAME = 'New client';

/** A stored name that carries no information: blank, or the app's own display placeholder. */
function isPlaceholderName(name: string): boolean {
  const n = normalizeName(name);
  return !n || n === normalizeName(UNNAMED_CLIENT_NAME);
}

/**
 * Does this record's name AGREE with what the counselor typed? Only two REAL names can disagree:
 *   • a blank typed name has nothing to disagree with (capture opened from a client file, or the
 *     optional field left empty);
 *   • a record still under the app's own placeholder was never named by anyone, so it cannot
 *     contradict the name typed this session — treating it as a disagreement would veto a correctly
 *     entered Emirates ID and warn about a "different name" the counselor never typed.
 */
function nameAgrees(cl: Client, typedName: string): boolean {
  if (!typedName || isPlaceholderName(cl.name)) return true;
  return normalizeName(cl.name) === normalizeName(typedName);
}

/** What the counselor typed, only when it is a real name — a blank or the placeholder signals nothing. */
function realTypedName(raw?: string): string {
  const typed = raw?.trim() ?? '';
  return typed && !isPlaceholderName(typed) ? typed : '';
}

/** Prior CAPTURED records ('s-' ids) filed under the same real name. */
function sameNamedCaptured(clients: Client[], typedName: string): Client[] {
  return typedName ? clients.filter((cl) => isCapturedNameMatch(cl, typedName)) : [];
}

/**
 * The lone same-named record a NEW Emirates ID may attach to — the "first time I typed this patient's
 * ID" case, which is the ordinary one on rollout since no record captured before the field existed
 * carries an id.
 *
 * ABSENCE OF AN ID IS NEW INFORMATION, NOT DISAGREEMENT. A record holding no Emirates ID contradicts
 * nothing, so the counselor naming their own established patient and supplying that patient's id is a
 * match — the id attaches to the record they already have rather than forking them. Every way the
 * evidence could be less than conclusive rules the adoption out:
 *   • the key already has a holder — Step A owns that capture (fold, or the mis-entry warning);
 *   • MORE THAN ONE record shares the name — ambiguity; there is no way to tell which patient this is;
 *   • the lone record already holds its own valid id — disagreement, plainly a namesake.
 * Both of those fork instead, so the app still never merges on ambiguity or on disagreement. And since
 * the key is unclaimed here, adopting it keeps one key with exactly one holder.
 */
function adoptionCandidate(clients: Client[], key: string, typedName: string): Client | undefined {
  if (!key || !typedName) return undefined;
  if (clients.some((cl) => holdsIdKey(cl, key))) return undefined;
  const sameName = sameNamedCaptured(clients, typedName);
  if (sameName.length !== 1) return undefined;
  return emiratesIdKey(sameName[0].emiratesId) ? undefined : sameName[0];
}

/**
 * The record already holding this capture's Emirates ID under a MATERIALLY DIFFERENT name. Undefined
 * when there is nothing to warn about: no valid id, no typed name, no record holding that id, or the
 * names agree (that is the ordinary duplicate-patient fold).
 *
 * Two strong signals disagreeing is not a match, it is a warning. An Emirates ID reaching a record
 * filed under another name is far more likely a mis-entry — a clipboard carried over from another
 * patient's form, autofill, a transposed digit landing on a real id — than the same person renamed, and
 * folding would merge two patients' notes/plan/timeline and carry one's risk tier onto the other, which
 * nothing ever lowers, all under a confident "you already see this client". So the capture mints its own
 * record and the review screen says plainly what to check.
 *
 * Built on the SAME predicates as `matchExistingClient`'s Emirates-ID branch, so the two are exact
 * complements: a record that branch declines to fold into is precisely one this can name.
 */
export function findIdNameMismatch(clients: Client[], opts: { name?: string; emiratesId?: string }): Client | undefined {
  const key = emiratesIdKey(opts.emiratesId);
  const typedName = opts.name?.trim() ?? '';
  if (!key || !typedName) return undefined;
  return clients.find((cl) => holdsIdKey(cl, key) && !nameAgrees(cl, typedName));
}

/**
 * The Emirates ID a NEWLY MINTED record may keep — the typed value, or nothing when that id was just
 * ruled to belong to another patient (`findIdNameMismatch`).
 *
 * ONE KEY, ONE HOLDER. Storing the id on the record we forked precisely because it is someone else's
 * would leave two records answering to it, and the next capture entering that id with the name left
 * blank agrees with both — folding into whichever the caseload lists first, which is the newer fork.
 * That is the unrecoverable merge the fork existed to prevent, arriving one session later under the
 * confident "you already see this client" banner. So the key stays with its original holder.
 */
export function emiratesIdForNewClient(clients: Client[], opts: { name?: string; emiratesId?: string }): string | undefined {
  const typedId = opts.emiratesId?.trim();
  if (!typedId) return undefined;
  return findIdNameMismatch(clients, opts) ? undefined : typedId;
}

/**
 * The same-named captured client this capture was NOT folded into, although its Emirates ID is held by
 * no record. It fires on exactly the two readings the app refuses to resolve:
 *   • AMBIGUITY — more than one record already carries this name;
 *   • DISAGREEMENT — the lone same-named record holds its own, different, valid Emirates ID.
 * It stays quiet when there is nothing to explain: no valid id, no real typed name, no same-named
 * record, an id that DOES reach a record (that is Step A — a fold, or the sharper `findIdNameMismatch`
 * warning), or the adoption case, which is a MATCH rather than a refusal.
 *
 * Minting a separate record is the SAFE outcome — merging two different patients is unrecoverable
 * (notes, plan, timeline and a risk tier nothing lowers) — but it must not be a SILENT one: an
 * unexplained second identical-looking row is how a caseload quietly fragments. So the review screen
 * says plainly what happened. Device-local only; it says nothing about anyone outside this caseload.
 *
 * Built on the SAME predicates as `matchExistingClient`, so the two are exact complements: a capture
 * that branch declines to fold is precisely one this can explain.
 */
export function findNameConflict(clients: Client[], opts: { name?: string; emiratesId?: string }): Client | undefined {
  const key = emiratesIdKey(opts.emiratesId);
  const typedName = realTypedName(opts.name);
  if (!key || !typedName) return undefined;
  // A capture whose id reaches a record is not a name conflict — it either folds into it or, when the
  // names disagree, is the sharper `findIdNameMismatch` warning instead.
  if (clients.some((cl) => holdsIdKey(cl, key))) return undefined;
  // The lone id-less namesake is a MATCH (the id attaches to them), not a refusal to explain.
  if (adoptionCandidate(clients, key, typedName)) return undefined;
  return sameNamedCaptured(clients, typedName)[0];
}

/**
 * Decide which EXISTING caseload client (if any) a capture belongs to, so a second record is never
 * minted for someone already on the caseload. Priority:
 *   1. an explicit clientId (the day board / client file opened the capture) — matched by id;
 *   2. a VALID Emirates ID — the local uniqueness key for a patient. This is the duplicate-patient
 *      guard: adding a client whose Emirates ID exists must open the existing record, not create a
 *      second (captain scope: local caseload only);
 *   3. a non-blank typed name against a prior CAPTURED client ('s-' ids) — the pre-existing F3 fold,
 *      reached ONLY by a capture carrying no valid Emirates ID.
 * Returns undefined when nothing matches (the caller mints a fresh client). An explicit clientId that
 * no longer exists returns undefined too, so the caller can keep the note under that id.
 *
 * THE GOVERNING RULE: merge when nothing disagrees; never merge on ambiguity or on disagreement. A
 * capture carrying a valid Emirates ID resolves in two steps:
 *
 *   STEP A — some record already HOLDS that id. Names agreeing (or none typed) is the duplicate-patient
 *     fold. A record filed under a materially different REAL name is a warning, not a match: an id
 *     reaching another patient's record is far likelier a mis-entry — a clipboard carried over, a
 *     transposed digit landing on a real id — than the same person renamed, so that capture mints its
 *     own record and `findIdNameMismatch` explains it.
 *   STEP B — NO record holds that id, so the id itself contradicts nothing. Exactly one same-named
 *     record that holds NO id of its own is the same patient having their id recorded for the first
 *     time: it folds, and the id is ADOPTED onto that record (`adoptEmiratesId`). More than one
 *     namesake (ambiguity), or a lone namesake holding a different valid id (disagreement), forks
 *     instead — carrying the id, which is unclaimed — and `findNameConflict` explains it.
 *
 * A malformed entry is not an identifier at all, so it falls through to the name fold exactly as a
 * blank one does, and it is never stored as an identity.
 *
 * Every veto is reported, never silent — the caller pairs this with `findNameConflict` and
 * `findIdNameMismatch`, each an exact complement of the branch that declined, so the app can never
 * refuse to fold for a reason it then fails to explain.
 */
export function matchExistingClient(
  clients: Client[],
  opts: { clientId?: string; name?: string; emiratesId?: string },
): { client: Client; matchedBy: 'id' | 'emiratesId' | 'name'; adoptEmiratesId?: string } | undefined {
  if (opts.clientId) {
    const byId = clients.find((cl) => cl.id === opts.clientId);
    return byId ? { client: byId, matchedBy: 'id' } : undefined;
  }
  const typedName = opts.name?.trim() ?? '';
  const key = emiratesIdKey(opts.emiratesId);
  if (key) {
    const byEmid = clients.find((cl) => holdsIdKey(cl, key) && nameAgrees(cl, typedName));
    if (byEmid) return { client: byEmid, matchedBy: 'emiratesId' };
    const adopt = adoptionCandidate(clients, key, realTypedName(typedName));
    // Stored verbatim as typed, exactly as on the mint path — comparison normalises, storage preserves.
    return adopt ? { client: adopt, matchedBy: 'emiratesId', adoptEmiratesId: opts.emiratesId?.trim() } : undefined;
  }
  if (typedName) {
    const byName = clients.find((cl) => isCapturedNameMatch(cl, typedName));
    if (byName) return { client: byName, matchedBy: 'name' };
  }
  return undefined;
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

// Includes the bare "SI" / "SI/HI" clinical shorthand a model or clinician may use as the row LABEL
// itself (never spelling "ideation" or "suicid" out again) — without it, a row labelled just "SI"
// with a value like "Transient, without plan or means" matches neither the label nor the value cue,
// so `scanNoteRisk` never recognises it as the ideation row at all and the up-only floor never fires,
// silently trusting whatever (possibly too-low) structured tier the model returned.
const IDEATION_LABEL = /ideation|suicid|\bsi\b|\bsi\/hi\b|\bsi-hi\b/;
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
 * A row DISCLOSES unless a denial is recognised, so the realistic ways a clinician writes a benign
 * answer must all be recognised: a report verb taking a none-object ("Client reports none"), a bare
 * none-subject with a report verb ("None elicited"), and a bare "Not disclosed" — but NOT "not
 * disclosed to <someone>", which describes who else knows rather than answering the row, and must not
 * cancel a disclosure sitting beside it. "Not indicated" (the app's row wording since captain round 2,
 * 2026-08-17 — replacing bare "Denied" in generated copy) is recognised the same way "no … present"
 * is: `indicated` sits alongside `present/reported/endorsed/noted/raised/concerns` in the "no/not …
 * <state-word>" branch below, so "Not indicated" and "Denied" are exact denial-equivalents and every
 * existing "Denied" case keeps its verdict unchanged.
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
    /\b(?:no|not|none|without|nil|negative|absent|nothing)\b(?:(?!\b(?:plan|intent|means|method|access)\b)[\s\w'/-]){0,20}?\b(?:present|reported|endorsed|noted|raised|concerns?|indicated)\b/.test(s) ||
    /^\s*(?:no|none|nil|negative|absent|denied|denies|nad|n\/?a)\b(?![\s\w'/-]{0,30}?\b(?:ideation|suicid\w*|self[- ]?harm|thought|plan|intent|endorsed|present|active|passive|reported)\b)/.test(s) ||
    /\b(?:reports?|reported|endorses?|endorsed|elicited|voiced|describes?|described|denies|denied)\s+(?:no|none|nil|nothing)\b(?!\s+(?:of\s+)?(?:a\s+|any\s+)?(?:plan|intent|means))/.test(s) ||
    /\b(?:none|nil)\s+(?:elicited|endorsed|reported|noted|voiced|expressed|disclosed)\b/.test(s) ||
    /\bnot\s+(?:disclosed|reported|elicited|endorsed)\b(?!\s+to\b)/.test(s) ||
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
 * affirms. The gap also cannot cross a plan/intent/means noun or a contrast conjunction, because those
 * END the negation's scope: in "No plan but active ideation" the 'no' denies the PLAN, and letting the
 * gap reach past it would delete the very phrase that documents the disclosure and derive 'clear' — the
 * one direction this floor exists to prevent.
 *
 * Accepted safe residual: a negation separated from the ideation word by punctuation ("denies, on
 * direct questioning, any passive ideation") still reads as an affirmation. Rare, and it errs safe.
 */
const NEGATED_IDEATION =
  /\b(?:no|not|none|nil|negative|absent|nothing|without|denies|denied|denying)\s+(?:(?!(?:plan|intent|means|but|however|though|aside|apart|otherwise)\b)[\w'-]+\s+){0,3}(?:suicidal\s+)?(?:ideation|si)\b/g;
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
  // "Not explicitly addressed" that older mock drafts carried on the self-harm branch) as disclosed ideation.
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
  // safety plan deferred"). The floor also errs toward ACUTE for any UNRECOGNISED phrasing, which is
  // the deliberate cost of reading a bare "Present"/"Active" as a disclosure: a positive-clearance
  // wording that names no risk and carries no denial token ("Screened, clear", "Low risk") over-rates.
  // That is the SAFE direction — the floor only ever RAISES over the model's own structured level, and
  // the clinician reads and signs every note.
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
  opts: { name: string; sessionNumber: number; dateLabel: string; emiratesId?: string },
): Client {
  const subjective = note.sections.find((s) => s.marker === 'S');
  const summary = subjective?.body?.[0] ?? 'New session captured today.';
  // Store the Emirates ID EXACTLY as typed (spacing/dashes kept) — comparison normalises, storage
  // preserves. Only a WELL-FORMED value is stored: a blank entry, or a placeholder like "N/A" that the
  // counselor reached for without the number, is not this patient's identity and must never become one
  // for the next capture that types the same thing.
  const typedId = opts.emiratesId?.trim();
  const emiratesId = typedId && isValidEmiratesId(typedId) ? typedId : undefined;

  return {
    id,
    name: opts.name,
    initials: initialsOf(opts.name),
    tokenId: id.slice(0, 6),
    emiratesId,
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
 *
 * It writes an Emirates ID onto the record ONLY when the caller passes one it has already resolved as
 * an ADOPTION — `matchExistingClient` matched this record as the lone same-named holder of no id, for
 * an id no record holds. It is never a blanket backfill from whatever the capture happened to carry:
 * that is exactly how one patient's id came to be stamped onto another's record. An id already stored
 * is never overwritten either, so a record can only ever gain the key it was matched on.
 *
 * It DOES upgrade a placeholder name. A record captured with the name field blank is filed under the
 * app's own label; when a later session for the same identity finally supplies a real name, that name
 * takes hold (initials with it) rather than leaving the counselor's own caseload reading "New client"
 * forever. A name the counselor already gave is never overwritten.
 */
export function appendSessionToClient(
  existing: Client,
  note: DraftNote,
  opts: { sessionNumber: number; dateLabel: string; name?: string; adoptEmiratesId?: string },
): Client {
  const subjective = note.sections.find((s) => s.marker === 'S');
  const summary = subjective?.body?.[0] ?? existing.summaryLine;
  const noteRisk = riskFromNote(note);
  const typedName = opts.name?.trim();
  const upgradedName = typedName && isPlaceholderName(existing.name) ? typedName : undefined;
  const adopted = opts.adoptEmiratesId?.trim();

  return {
    ...existing,
    emiratesId: adopted && !emiratesIdKey(existing.emiratesId) ? adopted : existing.emiratesId,
    name: upgradedName ?? existing.name,
    initials: upgradedName ? initialsOf(upgradedName) : existing.initials,
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
