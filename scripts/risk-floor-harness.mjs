/**
 * Risk-floor harness (audit fix 2). Proves the up-only "disclosed ideation ⇒ acute" safety floor in
 * `riskFromNote` holds on BOTH the live (Groq-shaped, structured `riskLevel` present) and mock-shaped
 * drafts — the model's structured tier may RAISE but never LOWER what the note's STRUCTURED RISK ROWS
 * disclose, and a benign / denied row is never floored up.
 *
 * The floor is ROW-BASED: the free-text risk summary does not drive the tier (see `scanNoteRisk`), so
 * these cases assert on rows. Each denial phrasing below is one a clinician or the model actually
 * writes; reading any of them as a disclosure pins a client to acute permanently, since nothing
 * lowers a tier.
 *
 * Run (Node ≥ 22.13, e.g. ~/.cache/fm-node/node-v22.23.2-darwin-arm64/bin/node):
 *   node --experimental-strip-types scripts/risk-floor-harness.mjs
 * Exits non-zero on the first failed assertion.
 */
import { riskFromNote } from '../src/data/sessionClient.ts';

/** Minimal DraftNote shaped just enough for riskFromNote (riskLevel + a risk section). */
function note({ level, rows, summary }) {
  return {
    sessionLabel: 'Session 1',
    sourceLine: 'test',
    status: 'draft',
    riskLevel: level,
    sections: [
      { id: 'risk', marker: 'R', title: 'Risk & Safety Check', body: summary ? [summary] : [], rows: rows ?? [], isRisk: true },
    ],
    measures: [],
    reviewCodes: [],
    prescriptions: [],
  };
}
const ideationRow = (v) => [{ label: 'Suicidal ideation', value: v }];

const cases = [
  // --- Live path: model under-rates a disclosure → floor to acute ---------------------------------
  { name: 'live: passive-ideation row but level=watch', in: note({ level: 'watch', rows: ideationRow('Passive ideation reported; denies plan or intent') }), want: 'acute' },
  { name: 'live: passive-ideation row but level=clear', in: note({ level: 'clear', rows: ideationRow('Passive, reported') }), want: 'acute' },
  { name: 'live: row discloses fleeting thoughts, level=watch', in: note({ level: 'watch', rows: ideationRow('Reports fleeting thoughts of being better off not here') }), want: 'acute' },
  { name: 'live: self-harm endorsed but level=watch → elevated floor', in: note({ level: 'watch', rows: [{ label: 'Self-harm', value: 'Endorsed cutting this week' }, { label: 'Suicidal ideation', value: 'Denied' }] }), want: 'elevated' },

  // --- Plainest row phrasings floor too (not just hand-listed disclosure markers) ------------------
  { name: 'live: bare "Present" ideation row, level=watch → acute', in: note({ level: 'watch', rows: ideationRow('Present') }), want: 'acute' },
  { name: 'live: "Active, with a plan" ideation row, level=watch → acute', in: note({ level: 'watch', rows: ideationRow('Active, with a plan') }), want: 'acute' },
  // A denial of OVERALL risk sitting in the ideation row must not cancel the floor on the disclosure.
  { name: 'live: disclosed ideation carrying a generic "no other risk" clause still floors to acute', in: note({ level: 'watch', rows: ideationRow('Active with a plan; no other risk factors') }), want: 'acute' },
  // A row that NAMES the ideation must survive a trailing denial of some unrelated worry — the denial
  // is of "other concerns", not of the ideation the row just documented.
  { name: 'live: "Active suicidal ideation with a plan; no other concerns" floors to acute', in: note({ level: 'watch', rows: ideationRow('Active suicidal ideation with a plan; no other concerns') }), want: 'acute' },
  { name: 'live: "Endorses suicidal ideation; no immediate concerns" floors to acute', in: note({ level: 'watch', rows: ideationRow('Endorses suicidal ideation; no immediate concerns about safety tonight') }), want: 'acute' },
  { name: 'asymmetry: named ideation + trailing concern denial, no level → acute', in: note({ level: undefined, rows: ideationRow('Active suicidal ideation with a plan; no other concerns') }), want: 'acute' },
  { name: 'asymmetry: "Endorses suicidal ideation; no immediate concerns", no level → acute', in: note({ level: undefined, rows: ideationRow('Endorses suicidal ideation; no immediate concerns about safety tonight') }), want: 'acute' },
  // A plain state word is a disclosure; a denial of the PLAN must not cancel it. Written with a
  // fancier adjective ("Passive ideation reported; denies plan") this already floored — the same
  // clinical fact in plainer words must not silently lose the floor.
  { name: 'live: "Present; denies plan or intent" floors to acute', in: note({ level: 'watch', rows: ideationRow('Present; denies plan or intent') }), want: 'acute' },
  { name: 'live: "Active thoughts, denies intent" floors to acute', in: note({ level: 'watch', rows: ideationRow('Active thoughts, denies intent') }), want: 'acute' },
  // The SAME clinical fact written with "no …" instead of "denies …". A negation whose object is the
  // plan/means denies the plan, not the row, so it must not cancel the floor on a disclosure.
  { name: 'live: "Present; no current plan or intent" floors to acute', in: note({ level: 'watch', rows: ideationRow('Present; no current plan or intent') }), want: 'acute' },
  { name: 'live: "Endorsed ideation; no plan reported" floors to acute', in: note({ level: 'watch', rows: ideationRow('Endorsed ideation; no plan reported') }), want: 'acute' },
  { name: 'live: "Active thoughts; no intent reported" floors to acute', in: note({ level: 'watch', rows: ideationRow('Active thoughts; no intent reported') }), want: 'acute' },
  { name: 'live: "Endorsed; no means noted" floors to acute', in: note({ level: 'watch', rows: ideationRow('Endorsed; no means noted') }), want: 'acute' },
  // …and the same plan denial written with a REPORT VERB rather than a bare negation. The object is
  // still the plan, so it must not read as a denial of the row.
  { name: 'live: "Present; reports no plan" floors to acute', in: note({ level: 'watch', rows: ideationRow('Present; reports no plan') }), want: 'acute' },
  { name: 'live: "Present, but reports no intent" floors to acute', in: note({ level: 'watch', rows: ideationRow('Present, but reports no intent') }), want: 'acute' },
  { name: 'live: "Present; endorsed no plan or intent" floors to acute', in: note({ level: 'watch', rows: ideationRow('Present; endorsed no plan or intent') }), want: 'acute' },
  { name: 'live: "Active thoughts; reports no plan" floors to acute', in: note({ level: 'watch', rows: ideationRow('Active thoughts; reports no plan') }), want: 'acute' },
  { name: 'live: "Present; reports no plan or intent" floors to acute', in: note({ level: 'watch', rows: ideationRow('Present; reports no plan or intent') }), want: 'acute' },
  // …and with no structured level the derivation must agree (floor == derivation).
  { name: 'asymmetry: "Present; no current plan or intent", no level → acute', in: note({ level: undefined, rows: ideationRow('Present; no current plan or intent') }), want: 'acute' },
  { name: 'asymmetry: "Endorsed; no means noted", no level → acute', in: note({ level: undefined, rows: ideationRow('Endorsed; no means noted') }), want: 'acute' },
  { name: 'asymmetry: "Present; reports no plan", no level → acute', in: note({ level: undefined, rows: ideationRow('Present; reports no plan') }), want: 'acute' },
  { name: 'asymmetry: "Present, but reports no intent", no level → acute', in: note({ level: undefined, rows: ideationRow('Present, but reports no intent') }), want: 'acute' },
  { name: 'asymmetry: "Present; endorsed no plan or intent", no level → acute', in: note({ level: undefined, rows: ideationRow('Present; endorsed no plan or intent') }), want: 'acute' },
  // The self-harm row has no affirmation escape, so a report-verb plan denial is its only guard.
  { name: 'live: self-harm "Endorsed cutting last week; reports no intent to escalate" → elevated', in: note({ level: 'watch', rows: [{ label: 'Self-harm', value: 'Endorsed cutting last week; reports no intent to escalate' }, { label: 'Suicidal ideation', value: 'Denied' }] }), want: 'elevated' },
  { name: 'live: self-harm "Recent cutting; reports no plan to repeat" → elevated', in: note({ level: 'watch', rows: [{ label: 'Self-harm', value: 'Recent cutting; reports no plan to repeat' }, { label: 'Suicidal ideation', value: 'Denied' }] }), want: 'elevated' },
  // An incidental phrase about who else knows must not cancel a real disclosure — 'not disclosed' /
  // 'not reported' describe ordinary content, not the status of the screening, so they are not in
  // `isNotAssessed`.
  { name: 'live: disclosure carrying "not disclosed to family" still floors to acute', in: note({ level: 'watch', rows: ideationRow('Endorsed passive ideation; not disclosed to family') }), want: 'acute' },
  // --- Severity-qualified ideation: a denial of the NARROWER form never clears the row -------------
  // This is how passive ideation is normally documented, so reading it as a denial derived 'clear' —
  // worse than the 'watch' this design treats as its safe floor.
  { name: 'live: "Passive ideation reported; denies active ideation, plan or intent" floors to acute', in: note({ level: 'watch', rows: ideationRow('Passive ideation reported; denies active ideation, plan or intent') }), want: 'acute' },
  { name: 'live: "Passive SI reported, no active ideation" floors to acute', in: note({ level: 'watch', rows: ideationRow('Passive SI reported, no active ideation') }), want: 'acute' },
  { name: 'live: "Endorsed passive ideation; no plan, means absent" floors to acute', in: note({ level: 'watch', rows: ideationRow('Endorsed passive ideation; no plan, means absent') }), want: 'acute' },
  { name: 'live: "Chronic passive ideation; denies intent" floors to acute', in: note({ level: 'watch', rows: ideationRow('Chronic passive ideation; denies intent') }), want: 'acute' },
  // …and the same values with no structured level must derive the same tier (floor == derivation).
  { name: 'asymmetry: qualified ideation + subtype denial, no level → acute', in: note({ level: undefined, rows: ideationRow('Passive ideation reported; denies active ideation, plan or intent') }), want: 'acute' },
  { name: 'asymmetry: "Passive SI reported, no active ideation", no level → acute', in: note({ level: undefined, rows: ideationRow('Passive SI reported, no active ideation') }), want: 'acute' },
  { name: 'asymmetry: "Endorsed passive ideation; no plan, means absent", no level → acute', in: note({ level: undefined, rows: ideationRow('Endorsed passive ideation; no plan, means absent') }), want: 'acute' },
  // The negated form of the SAME phrase is still a denial.
  { name: 'live: "Denies passive ideation" stays clear (negated qualified phrase)', in: note({ level: undefined, rows: ideationRow('Denies passive ideation') }), want: 'clear' },
  // A denial is rarely adjacent to its object. Each of these read as an AFFIRMATION while the scrub
  // required adjacency, pinning a benign client to acute permanently.
  { name: 'live: "Denies any passive ideation" stays clear', in: note({ level: undefined, rows: ideationRow('Denies any passive ideation') }), want: 'clear' },
  { name: 'live: "No current passive ideation" stays clear', in: note({ level: undefined, rows: ideationRow('No current passive ideation') }), want: 'clear' },
  { name: 'live: "Denies active or passive ideation" stays clear', in: note({ level: 'clear', rows: ideationRow('Denies active or passive ideation') }), want: 'clear' },
  { name: 'live: "Denies recurrent or persistent ideation" stays clear', in: note({ level: 'clear', rows: ideationRow('Denies recurrent or persistent ideation') }), want: 'clear' },
  { name: 'live: "Not endorsing passive ideation" stays clear', in: note({ level: 'clear', rows: ideationRow('Not endorsing passive ideation') }), want: 'clear' },
  { name: 'live: "Negative for passive ideation" stays clear', in: note({ level: 'clear', rows: ideationRow('Negative for passive ideation') }), want: 'clear' },
  { name: 'live: "Client denies experiencing passive ideation" stays clear', in: note({ level: 'clear', rows: ideationRow('Client denies experiencing passive ideation') }), want: 'clear' },
  { name: 'live: "No history of passive ideation" stays clear', in: note({ level: 'clear', rows: ideationRow('No history of passive ideation') }), want: 'clear' },

  // A row mentioning the OTHER topic must not shadow the row actually about it.
  {
    name: 'live: an ideation row mentioning self-harm does not shadow the real self-harm row',
    in: note({
      level: 'watch',
      rows: [
        { label: 'Suicidal ideation', value: 'Denied; no self-harm reported' },
        { label: 'Self-harm', value: 'Endorsed cutting this week' },
      ],
    }),
    want: 'elevated',
  },
  {
    name: 'live: a safety-plan row mentioning ideation does not shadow the real ideation row',
    in: note({
      level: 'watch',
      rows: [
        { label: 'Safety plan', value: 'Reviewed; client denies needing it, no suicidal thoughts' },
        { label: 'Suicidal ideation', value: 'Passive, reported' },
      ],
    }),
    want: 'acute',
  },
  // A row the model labelled something else must not hide the disclosure.
  { name: 'live: ideation detected by VALUE cue despite a non-ideation label → acute', in: note({ level: 'watch', rows: [{ label: 'Risk', value: 'Active suicidal ideation with a plan' }] }), want: 'acute' },

  // --- Ordinary denial phrasings must stay clear (each was a false acute before the row-only floor) -
  { name: 'live: "Denied" ideation row stays clear', in: note({ level: 'clear', rows: ideationRow('Denied') }), want: 'clear' },
  // The canonical TERSE answers to a screening row. Requiring a denial to bind an anchor read every
  // one of these as a disclosure.
  { name: 'live: bare "None" stays clear', in: note({ level: 'clear', rows: ideationRow('None') }), want: 'clear' },
  { name: 'live: bare "No" stays clear', in: note({ level: 'clear', rows: ideationRow('No') }), want: 'clear' },
  { name: 'live: bare "Negative" stays clear', in: note({ level: 'clear', rows: ideationRow('Negative') }), want: 'clear' },
  { name: 'live: "None this session" stays clear', in: note({ level: 'clear', rows: ideationRow('None this session') }), want: 'clear' },
  { name: 'live: "None disclosed" stays clear', in: note({ level: 'clear', rows: ideationRow('None disclosed') }), want: 'clear' },
  // …but a terse opening denial must not swallow the disclosure that follows it.
  // A leading plan-denial followed by a NAMED ideation disclosure. The negation's object is the plan,
  // so it must not reach past it and delete the disclosure. The comma-free forms are the real test —
  // the comma variant used to pass only because a word-only gap cannot consume 'plan,'.
  { name: 'live: "No plan, but active ideation present" still floors to acute', in: note({ level: 'watch', rows: ideationRow('No plan, but active ideation present') }), want: 'acute' },
  { name: 'live: "No plan but active ideation" floors to acute', in: note({ level: 'watch', rows: ideationRow('No plan but active ideation') }), want: 'acute' },
  { name: 'live: "No plan but active ideation present" floors to acute', in: note({ level: 'watch', rows: ideationRow('No plan but active ideation present') }), want: 'acute' },
  { name: 'live: "No plan but reports ideation" floors to acute', in: note({ level: 'watch', rows: ideationRow('No plan but reports ideation') }), want: 'acute' },
  { name: 'live: "Denies plan but reports ideation" floors to acute', in: note({ level: 'watch', rows: ideationRow('Denies plan but reports ideation') }), want: 'acute' },
  { name: 'live: "Denies intent but endorses ideation" floors to acute', in: note({ level: 'watch', rows: ideationRow('Denies intent but endorses ideation') }), want: 'acute' },
  { name: 'live: "Denies means but describes ideation" floors to acute', in: note({ level: 'watch', rows: ideationRow('Denies means but describes ideation') }), want: 'acute' },
  // …and with no structured level the derivation must agree (floor == derivation).
  { name: 'asymmetry: "No plan but active ideation", no level → acute', in: note({ level: undefined, rows: ideationRow('No plan but active ideation') }), want: 'acute' },
  { name: 'asymmetry: "Denies plan but reports ideation", no level → acute', in: note({ level: undefined, rows: ideationRow('Denies plan but reports ideation') }), want: 'acute' },
  { name: 'asymmetry: "Denies intent but endorses ideation", no level → acute', in: note({ level: undefined, rows: ideationRow('Denies intent but endorses ideation') }), want: 'acute' },
  { name: 'asymmetry: "Denies means but describes ideation", no level → acute', in: note({ level: undefined, rows: ideationRow('Denies means but describes ideation') }), want: 'acute' },
  // A denial carrying a trailing clause that happens to contain a positive-sounding word. Judging the
  // value for positive markers read these as disclosures ('noted', and 'present' inside 'presents').
  { name: 'live: "Denied; protective factors noted" stays clear', in: note({ level: 'clear', rows: ideationRow('Denied; protective factors noted') }), want: 'clear' },
  { name: 'live: "No current ideation; protective factors noted" stays clear', in: note({ level: 'clear', rows: ideationRow('No current ideation; protective factors noted') }), want: 'clear' },
  { name: 'live: "Client denied; presents as future-oriented" stays clear', in: note({ level: 'clear', rows: ideationRow('Client denied; presents as future-oriented') }), want: 'clear' },
  { name: 'live: "Denied; presented as calm" stays clear', in: note({ level: 'clear', rows: ideationRow('Denied; presented as calm') }), want: 'clear' },
  { name: 'live: "Not currently present" stays clear (word inserted into the bigram)', in: note({ level: 'clear', rows: ideationRow('Not currently present') }), want: 'clear' },
  { name: 'live: "None currently reported" stays clear', in: note({ level: 'clear', rows: ideationRow('None currently reported') }), want: 'clear' },
  { name: 'live: "Not endorsed" stays clear', in: note({ level: 'clear', rows: ideationRow('Not endorsed') }), want: 'clear' },
  { name: 'live: "No SI/HI" clinical shorthand stays clear', in: note({ level: 'clear', rows: ideationRow('No SI/HI') }), want: 'clear' },
  { name: 'live: bare "Nil" stays clear', in: note({ level: 'clear', rows: ideationRow('Nil') }), want: 'clear' },
  { name: 'live: bare "Absent" stays clear', in: note({ level: 'clear', rows: ideationRow('Absent') }), want: 'clear' },
  { name: 'live: fully denied, level=clear stays clear', in: note({ level: 'clear', rows: [{ label: 'Suicidal ideation', value: 'Denied' }, { label: 'Self-harm', value: 'Denied' }] }), want: 'clear' },
  // A denial word with words appended is still a denial — requiring it to be the whole value read
  // every one of these as a disclosure and pinned a benign client to acute.
  { name: 'live: "Absent this session" stays clear', in: note({ level: 'clear', rows: ideationRow('Absent this session') }), want: 'clear' },
  { name: 'live: "Screening negative" stays clear', in: note({ level: 'clear', rows: ideationRow('Screening negative') }), want: 'clear' },
  { name: 'live: "Nil for this session" stays clear', in: note({ level: 'clear', rows: ideationRow('Nil for this session') }), want: 'clear' },
  { name: 'live: "No acute concerns" stays clear', in: note({ level: 'clear', rows: ideationRow('No acute concerns') }), want: 'clear' },
  { name: 'live: "Nothing of concern" stays clear', in: note({ level: 'clear', rows: ideationRow('Nothing of concern') }), want: 'clear' },
  // A concern-denial answers the row wherever it sits, not only when it opens the value — these are
  // ordinary ways to write a benign screening row, and each derived a permanent acute while the
  // concern anchor was leading-only.
  { name: 'live: "Screened; no acute concerns" stays clear', in: note({ level: 'clear', rows: ideationRow('Screened; no acute concerns') }), want: 'clear' },
  // A row discloses unless a denial is RECOGNISED, so the ordinary ways of writing a benign answer
  // must each be recognised — otherwise they pin a benign client to acute forever.
  { name: 'live: "Reports none" stays clear', in: note({ level: 'clear', rows: ideationRow('Reports none') }), want: 'clear' },
  { name: 'live: "Client reports none" stays clear', in: note({ level: 'clear', rows: ideationRow('Client reports none') }), want: 'clear' },
  { name: 'live: "None elicited" stays clear', in: note({ level: 'clear', rows: ideationRow('None elicited') }), want: 'clear' },
  { name: 'live: "None endorsed" stays clear', in: note({ level: 'clear', rows: ideationRow('None endorsed') }), want: 'clear' },
  { name: 'live: "Not disclosed" stays clear', in: note({ level: 'clear', rows: ideationRow('Not disclosed') }), want: 'clear' },
  { name: 'live: "Not disclosed this session" stays clear', in: note({ level: 'clear', rows: ideationRow('Not disclosed this session') }), want: 'clear' },
  { name: 'live: "Not reported" stays clear', in: note({ level: 'clear', rows: ideationRow('Not reported') }), want: 'clear' },
  { name: 'live: "Screened this session, no safety concerns" stays clear', in: note({ level: 'clear', rows: ideationRow('Screened this session, no safety concerns') }), want: 'clear' },
  { name: 'live: "Discussed openly; no immediate concerns" stays clear', in: note({ level: 'clear', rows: ideationRow('Discussed openly; no immediate concerns') }), want: 'clear' },
  { name: 'live: "Asked directly; no further concerns" stays clear', in: note({ level: 'clear', rows: ideationRow('Asked directly; no further concerns') }), want: 'clear' },
  // ACCEPTED RESIDUAL: a trailing concern-denial is indistinguishable from the benign rows above
  // without a positive-marker test on the leading clause, so a disclosure written this way reads as
  // denied. It leaves the model's own tier standing (here: watch); a false acute never comes back down.
  { name: 'residual: "Present; nothing further of concern" reads as denied → keeps the model tier', in: note({ level: 'watch', rows: ideationRow('Present; nothing further of concern') }), want: 'watch' },
  // A NEGATED disclosure marker is a denial, not a disclosure. The summarizer's own prompt teaches this
  // vocabulary ("passive, transient, fleeting, better off"), so these are ordinary, not exotic.
  { name: 'live: "Denies thoughts of self-harm or suicide" stays clear', in: note({ level: undefined, rows: ideationRow('Denies thoughts of self-harm or suicide') }), want: 'clear' },
  { name: 'live: "No passive or active ideation" stays clear', in: note({ level: undefined, rows: ideationRow('No passive or active ideation') }), want: 'clear' },
  { name: 'live: "Denied any thoughts of suicide" stays clear', in: note({ level: undefined, rows: ideationRow('Denied any thoughts of suicide') }), want: 'clear' },
  { name: 'live: "Denies passive ideation" stays clear', in: note({ level: undefined, rows: ideationRow('Denies passive ideation') }), want: 'clear' },
  // A full denial that happens to list the plan first still denies the ideation it reaches. The tier
  // must not hinge on which object the model wrote first — "Denies ideation, plan, or intent" was
  // already clear, so these were a permanent false acute purely from word order.
  { name: 'live: "Denies any plan, intent, or suicidal ideation" stays clear', in: note({ level: undefined, rows: ideationRow('Denies any plan, intent, or suicidal ideation') }), want: 'clear' },
  { name: 'live: "Denies plan, intent, or ideation" stays clear', in: note({ level: undefined, rows: ideationRow('Denies plan, intent, or ideation') }), want: 'clear' },
  { name: 'live: "No plan, intent, or ideation" stays clear', in: note({ level: undefined, rows: ideationRow('No plan, intent, or ideation') }), want: 'clear' },
  { name: 'live: "No suicidal ideation reported" stays clear', in: note({ level: undefined, rows: ideationRow('No suicidal ideation reported') }), want: 'clear' },
  { name: 'asymmetry: "Denies any plan, intent, or suicidal ideation", level=clear stays clear', in: note({ level: 'clear', rows: ideationRow('Denies any plan, intent, or suicidal ideation') }), want: 'clear' },

  // --- A benign risk SUMMARY never drives the tier, whatever it says -------------------------------
  { name: 'summary: "nothing of concern was raised" over denied rows stays clear', in: note({ level: 'clear', rows: [{ label: 'Suicidal ideation', value: 'Denied' }, { label: 'Self-harm', value: 'Denied' }], summary: 'Suicidal ideation and self-harm were screened; nothing of concern was raised this session.' }), want: 'clear' },
  { name: 'summary: terse "were both screened" over denied rows stays clear', in: note({ level: 'clear', rows: ideationRow('Denied'), summary: 'Suicidal ideation and self-harm were both screened.' }), want: 'clear' },
  { name: 'summary: an unrelated "reported" never overrides a denied row', in: note({ level: 'clear', rows: ideationRow('Denied'), summary: 'Client reported improved mood; suicidal ideation and self-harm were both screened and denied.' }), want: 'clear' },

  // --- Floor never LOWERS the model's tier ---------------------------------------------------------
  { name: 'live: model already acute stays acute (denied rows never lower it)', in: note({ level: 'acute', rows: ideationRow('Denied') }), want: 'acute' },
  { name: 'live: model elevated with denied rows stays elevated (floor never lowers)', in: note({ level: 'elevated', rows: ideationRow('Denied') }), want: 'elevated' },

  // --- Mock-shaped drafts (scanTranscriptRisk output): floor is a no-op, tier preserved ------------
  { name: 'mock: acute reference row + acute level', in: note({ level: 'acute', rows: ideationRow('Possible reference in transcript — clinician to review and confirm'), summary: 'A possible reference to suicidal ideation was picked up in the transcript — review and confirm with the client.' }), want: 'acute' },
  { name: 'mock: benign watch preserved', in: note({ level: 'watch', rows: [{ label: 'Suicidal ideation', value: 'Not raised this session' }, { label: 'Self-harm', value: 'Not raised this session' }], summary: 'No suicidal ideation or self-harm was raised in this session on an automated review.' }), want: 'watch' },
  { name: 'mock: denied-on-read stays clear', in: note({ level: 'clear', rows: ideationRow('Denied on an automated read of the transcript — clinician to confirm'), summary: 'Ideation / self-harm appear to have been raised and denied in this session — confirm with the client.' }), want: 'clear' },
  {
    name: 'mock: self-harm branch ("Not explicitly addressed" ideation) stays elevated',
    in: note({
      level: 'elevated',
      rows: [
        { label: 'Suicidal ideation', value: 'Not explicitly addressed' },
        { label: 'Self-harm', value: 'Possible reference in transcript — clinician to review and confirm' },
      ],
      summary: 'A possible reference to self-harm was picked up in the transcript — review and confirm with the client.',
    }),
    want: 'elevated',
  },

  // --- Nothing assessed → watch, never a false "clear" ---------------------------------------------
  { name: 'no rows at all → watch', in: note({ level: undefined, rows: [] }), want: 'watch' },
  // The two spellings of the same non-answer must land on the same tier.
  { name: '"Not applicable" is a non-answer → watch', in: note({ level: 'watch', rows: ideationRow('Not applicable') }), want: 'watch' },
  { name: '"N/A" is a non-answer → watch', in: note({ level: 'watch', rows: ideationRow('N/A') }), want: 'watch' },
  { name: "buildDraft's uncaptured-risk stand-in row derives watch, never a false clear", in: note({ level: undefined, rows: [{ label: 'Risk screening', value: 'Not captured in this draft — review required' }] }), want: 'watch' },

  // --- Accepted residual: a disclosure carrying a trailing SCREENING-STATUS clause reads as
  // not-assessed and lands on watch rather than acute. Recorded here so the trade is visible: judging
  // the value for positive markers instead is what produced six rounds of permanent false acutes, and
  // watch is never a false "clear". ------------------------------------------------------------------
  { name: 'residual: "…; not discussed with family" reads as not-assessed → watch', in: note({ level: 'watch', rows: ideationRow('Endorsed passive ideation; not discussed with family') }), want: 'watch' },
  { name: 'residual: "…; safety plan deferred" reads as not-assessed → watch', in: note({ level: 'watch', rows: ideationRow('Passive ideation reported; safety plan deferred') }), want: 'watch' },

  // --- Asymmetry guard: identical rows must derive the same tier with and without a level ----------
  { name: 'asymmetry: bare "Present" ideation row, no level → acute (floor == derivation)', in: note({ level: undefined, rows: ideationRow('Present') }), want: 'acute' },
  { name: 'asymmetry: "Active, with a plan" ideation row, no level → acute (floor == derivation)', in: note({ level: undefined, rows: ideationRow('Active, with a plan') }), want: 'acute' },
  { name: 'no level: disclosed ideation row → acute', in: note({ level: undefined, rows: ideationRow('Passive ideation reported') }), want: 'acute' },

  // --- Ideation without plan or means must never settle for "watch" (item 1) ----------------------
  // Ideation is ideation, with or without a plan — it must floor to acute (above watch, the mildest
  // non-clear tier) and thereby enter the risk queue (patterns/index.tsx filters on acute/elevated).
  { name: 'ideation without plan or means, level=watch → floors to acute', in: note({ level: 'watch', rows: ideationRow('Transient, without plan or means') }), want: 'acute' },
  { name: 'ideation without plan or means, no level → acute', in: note({ level: undefined, rows: ideationRow('Transient, without plan or means') }), want: 'acute' },
  { name: 'ideation without plan or means, level=clear → floors to acute', in: note({ level: 'clear', rows: ideationRow('Transient, without plan or means') }), want: 'acute' },
  // A row labelled with the bare "SI" clinical shorthand (never spelling "ideation"/"suicid" again in
  // either the label or the value) must still be recognised as the ideation row — this is the exact
  // gap that let a real "SI: transient, without plan or means" row escape the floor and keep the
  // model's own too-low "watch" tier.
  { name: '"SI"-labelled row, ideation without plan or means, level=watch → floors to acute', in: note({ level: 'watch', rows: [{ label: 'SI', value: 'Transient, without plan or means' }] }), want: 'acute' },
  { name: '"SI/HI"-labelled row, ideation without plan or means, no level → acute', in: note({ level: undefined, rows: [{ label: 'SI/HI', value: 'Transient, without plan or means' }] }), want: 'acute' },
  // The same shorthand label must still deny correctly — broadening label recognition must not turn a
  // genuine denial into a false acute.
  { name: '"SI"-labelled row, denied, level=watch → stays watch (no false acute)', in: note({ level: 'watch', rows: [{ label: 'SI', value: 'Denied' }] }), want: 'watch' },
  { name: '"SI"-labelled row, not assessed, no level → watch', in: note({ level: undefined, rows: [{ label: 'SI', value: 'Not raised this session' }] }), want: 'watch' },
];


let failed = 0;
for (const t of cases) {
  const got = riskFromNote(t.in);
  const ok = got === t.want;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${t.name}  (want ${t.want}, got ${got})`);
}
console.log(`\n${cases.length - failed}/${cases.length} passed`);
if (failed) {
  console.error(`${failed} assertion(s) failed`);
  process.exit(1);
}
