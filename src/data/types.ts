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
   * derived from the note's own risk rows/summary: a documented ideation (or self-harm) disclosure
   * never lets this tier sit below acute (or elevated). The floor only ever RAISES, never lowers.
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
   * True iff THIS note's transcript was produced by the cloud transcription hop (Groq) rather than the
   * on-device mock transcriber. Drives the honest provenance caption in the review screen's Transcript
   * tab, so the caption reports what actually happened to this capture instead of the app-wide config.
   * Absent for sample fixtures and older notes — treated as on-device, because a cloud hop we can't
   * prove is never claimed.
   */
  transcribedInCloud?: boolean;
  /**
   * True iff THIS note was drafted by the cloud summarizer (Groq) rather than the on-device mock — the
   * hop that sends the transcript TEXT away, independent of where the audio was transcribed. Recorded
   * at draft time so a note viewed later, under a build configured differently, still reports what
   * actually happened to it. Absent for sample fixtures and older notes — then nothing is claimed
   * either way, because a cloud hop we can't prove is never claimed and neither is its absence.
   */
  draftedInCloud?: boolean;
  sections: NoteSection[];
  measures: { measure: string; today: string; prev: string; band: string }[];
  reviewCodes: ReviewCode[];
  /** Rail prescriptions — clinician-written, or generated from the Plan section. */
  prescriptions: PrepItem[];
};

export type Client = {
  id: string;
  name: string;
  initials: string;
  tokenId: string; // re-identified locally, e.g. "4c9-AK"
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
