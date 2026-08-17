/**
 * Typed fixtures for Aira's mock data layer. All content is fictional — NO real PHI.
 * The dataset is the Amara K. cohort from the design direction plus the s4 report's
 * invented clients. Everything is exposed behind `ClientRepository` (see repository.ts)
 * so the future encrypted vault can slot in behind the same interface.
 */

export type RiskLevel = 'clear' | 'watch' | 'elevated' | 'acute';
export type ClientStatus = 'active' | 'intake' | 'wind-down';
export type MeasureBand = 'minimal' | 'mild' | 'moderate' | 'mod-sev' | 'severe' | 'improving';

/** A single dated measurement (PHQ-9, GAD-7 score, or a sleep hours reading). */
export type Reading = {
  date: string; // ISO
  label: string; // human date, e.g. "12 Jan"
  value: number;
};

/** A measure series. `sparse` series (< 3 readings) render as a dot-strip, never a line. */
export type MeasureSeries = {
  key: 'phq9' | 'gad7' | 'sleep';
  name: string;
  unit?: string;
  readings: Reading[];
  latest: number;
  deltaSinceStart?: number; // negative = improved for PHQ/GAD
  band: MeasureBand;
};

export type TimelineKind = 'session' | 'journal' | 'safety' | 'intake';

/** A history-timeline entry. Types are always labelled and never blurred together. */
export type TimelineEntry = {
  id: string;
  kind: TimelineKind;
  date: string; // human date
  title?: string;
  body: string;
  scores?: string; // e.g. "PHQ-9 11 · GAD-7 10"
};

export type PrepItem = {
  id: string;
  text: string;
  source: string; // provenance, e.g. "from Plan & Next Steps · 5 Apr"
  done: boolean;
  /** True for a prescription pulled from the Plan section by "Generate from notes" (round-2 item 2),
   *  as opposed to one the clinician wrote by hand. Persisted so the rail's badge survives reload. */
  generated?: boolean;
};

export type NoteSection = {
  id: string;
  /** SOAP marker shown in the section gutter: 'S' | 'O' | 'A' | 'P', or a shield for risk. */
  marker: string;
  title: string;
  /** Body paragraphs. Risk sections render in the clay risk surface. */
  body: string[];
  quote?: string;
  /** Bulleted body (used by the Plan section). */
  bullets?: string[];
  isRisk?: boolean;
  /** Structured rows (used by the Risk & Safety check). */
  rows?: { label: string; value: string }[];
  /** The symptom-measures table renders under this section (the Objective section). */
  hasMeasures?: boolean;
};

export type ReviewCode = {
  code: string;
  label: string;
  relevance: 'high' | 'med' | 'low';
};

export type DraftNote = {
  sessionLabel: string; // "Session 5 — 12 Aug"
  sourceLine: string; // "From a 47-min voice note · transcribed on-device · Identifiers never left this device"
  status: 'draft' | 'signed';
  signedBy?: string;
  signedAt?: string;
  /**
   * Structured caseload risk tier the summarizer assigns for this session (F4). `riskFromNote` TRUSTS
   * this tier for the ordinary case — it is never re-derived DOWN by sniffing the free-text rows, so an
   * unseen phrasing of disclosed ideation can't be under-rated. It does apply an UP-ONLY safety floor
   * derived from the note's own STRUCTURED risk rows (the free-text risk summary does not influence
   * the tier): a documented ideation (or self-harm) disclosure never lets this tier sit below acute
   * (or elevated). The floor only ever RAISES, never lowers.
   * Absent (mock/older notes) → that same derivation IS the tier.
   */
  riskLevel?: RiskLevel;
  /**
   * The real session transcript this note was drafted from — the Groq-transcribed (or clinician-typed)
   * text, persisted device-local alongside the note through ClientRepository/VaultStorage and shown in
   * the review screen's Transcript tab. HONESTY INVARIANT: this is only ever the actual captured text,
   * never fabricated. Absent for sample fixtures and older notes captured before transcripts were
   * stored — the Transcript tab then says so plainly rather than passing placeholder prose off as the
   * session.
   */
  transcript?: string;
  /**
   * DISCLOSURE: true iff this capture's audio was UPLOADED to the cloud transcriber — from the moment
   * the POST is issued, not from a successful reply, because a 429/5xx arrives after the recording has
   * already left the device. Never under-disclose this; it is what the audio-trust card speaks about.
   * Absent for sample fixtures and older notes.
   */
  audioLeftDevice?: boolean;
  /**
   * CLAIM: true iff the transcript text stored on this note is what the cloud transcriber (whisper)
   * returned. False when the clinician typed or pasted it — including after an upload that failed, so
   * `audioLeftDevice` can be true while this is false. Kept separate because a clinician auditing
   * "could the model have misheard this?" must not be told machine transcription produced their own
   * typing. Absent for sample fixtures and older notes — no claim is made either way.
   */
  transcriptFromCloud?: boolean;
  /**
   * True iff THIS note was drafted by the cloud summarizer (Groq) rather than the on-device mock — the
   * hop that sends the transcript TEXT away, independent of where the audio was transcribed. Recorded
   * at draft time so a note viewed later, under a build configured differently, still reports what
   * actually happened to it. Absent for sample fixtures and older notes — then nothing is claimed
   * either way, because a cloud hop we can't prove is never claimed and neither is its absence.
   */
  draftedInCloud?: boolean;
  /**
   * True once "Continue recording" (`appendRecording.ts`) has spliced a second capture onto this note's
   * transcript whose OWN `transcriptFromCloud` disagreed with the note's prior claim — e.g. a
   * cloud-transcribed original with a later hand-typed addition, or vice versa. `transcriptFromCloud`
   * alone can no longer describe the WHOLE transcript truthfully at that point (a single boolean can't
   * say "part of this is machine-transcribed, part isn't"), so this flags the Transcript tab to say so
   * explicitly rather than pick one claim that misstates the other segment. The per-segment truth lives
   * inline, in each "--- Added recording ---" divider. Absent/false when every segment agrees (the
   * ordinary case, including every note with no appended recording).
   */
  transcriptMixedProvenance?: boolean;
  sections: NoteSection[];
  measures: { measure: string; today: string; prev: string; band: string }[];
  reviewCodes: ReviewCode[];
  /** Rail prescriptions — clinician-written, or generated from the Plan section. */
  prescriptions: PrepItem[];
  /**
   * True once "Generate from notes" has pulled the Plan bullets into `prescriptions` for THIS note
   * (round-2 item 2 — "generate" is once per transcript). A capture-provider guard, not just UI
   * state: it survives reload because it lives on the persisted note, and it re-enables naturally on
   * a re-record/paste-new-transcript, since that always produces a brand-new DraftNote with this flag
   * unset. Absent/false → never generated yet.
   */
  prescriptionsGenerated?: boolean;
  /**
   * The other speaker's turns, stripped from the main transcript by the capture screen's "Remove
   * second speaker + add as auxiliary notes" action (round-2 item 1 — speaker separation). Machine-
   * attributed, for review — never treated as a clinical finding. Absent when speaker separation
   * never ran or nothing was removed.
   */
  auxiliaryNotes?: string;
  /**
   * True only for a note authored by the sample cohort (`buildSampleSnapshot`), stamped at load time —
   * never guessed later by name/content sniffing. This is what "Undo sample data" (Settings) uses to
   * remove exactly the sample-authored notes while leaving every note the counselor captured afterwards
   * (which carries no such flag) untouched. Absent/false for every real capture.
   */
  sampleOrigin?: boolean;
};

export type Client = {
  id: string;
  name: string;
  initials: string;
  tokenId: string; // re-identified locally, e.g. "4c9-AK"
  /**
   * The patient's Emirates ID, exactly as the counselor typed it (spacing/dashes preserved). Optional
   * — sample-cohort and older captured clients have none. It is the local uniqueness key for a
   * caseload: two records for the same Emirates ID are a duplicate patient, so a capture that supplies
   * one already on the caseload folds into that client instead of minting a second. Compared only
   * device-locally and never sent anywhere (see `normalizeEmiratesId` / `matchExistingClient`).
   */
  emiratesId?: string;
  age: number | null; // null before any intake age is recorded (rendered as "—", never a fabricated 0)
  pronouns?: string;
  status: ClientStatus;
  risk: RiskLevel;
  clientSince: string;
  sessionNumber: number;
  /** Caseload row. */
  lastSessionLabel: string;
  followUp: string;
  followUpDue?: boolean;
  latestScore: number | null; // primary measure latest (PHQ-9); null when never screened (rendered as "—")
  sparkline: number[]; // PHQ-9 trend for the caseload sparkline (empty when no readings)
  focusTags: string[];
  summaryLine: string; // one-line for cards
  // Detail:
  measures: MeasureSeries[];
  timeline: TimelineEntry[];
  lastPlan: PrepItem[]; // the last signed plan → shown as read-only prep reminders
  naturalistic?: { date: string; body: string }[];
  /**
   * True only for a client minted by the sample cohort (`buildSampleSnapshot`), stamped at load time —
   * never guessed later by name. "Undo sample data" (Settings) removes exactly these records, UNLESS
   * the counselor captured a real session or edited patient details for one after loading, in which
   * case that record is kept (see `computeSampleUndo` in `undoSample.ts`) rather than silently
   * destroying what they added. Absent/false for every client the counselor creates themselves.
   */
  sampleOrigin?: boolean;
  // Risk-review specifics (only for acute clients):
  safety?: {
    headline: string;
    detail: string;
    item9Positive?: boolean;
    snapshot: { label: string; value: string; sub: string; tone: 'risk' | 'positive' | 'neutral' }[];
    lastRiskNote: string;
    lastRiskNoteDate: string;
  };
};

/** Today's schedule entry on the day dashboard. */
export type ScheduleEntry = {
  clientId: string;
  time: string; // "10:30"
  meridiem: string; // "AM"
  durationMin: number;
  kind: string; // "Individual"
  sessionLabel: string; // "Session 5 · re-engagement week"
  prepCount: number;
};

export type DayDashboard = {
  dateLabel: string; // "TUESDAY · 12 AUGUST"
  subtitle: string;
  nextInMinutes: number;
  nextClientId: string;
  glance: { label: string; value: string; tone?: 'risk' | 'default' }[];
  schedule: ScheduleEntry[];
  standingSafety: { clientId: string; note: string };
};

export type CaseloadKpi = { label: string; value: string; unit?: string; sub: string; tone?: 'risk' | 'default' };
