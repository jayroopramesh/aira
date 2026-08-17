import { Client, DayDashboard, DraftNote, Reading, ReviewCode, RiskLevel } from './types';

/* =========================================================================
 * Amara K. — the primary longitudinal dataset (design-direction cohort).
 *
 * SINGLE SOURCE OF TRUTH for Amara's PHQ-9 / GAD-7 (F13). Every surface that shows her scores — the
 * caseload sparkline, the patterns chart (scales.ts imports these), the session-history timeline, and
 * the draft's measures table — derives from these two arrays, so they can never disagree again.
 * A longer longitudinal series (captain C5): 9 fortnightly readings 12 Jan → 12 Aug, so the multi-point
 * charts are properly exercised. Every reading has a matching timeline entry (milestone session or
 * interim screening) below, so the chart and history stay in lock-step.
 * PHQ-9 18→9 · GAD-7 14→8 · sleep 4.9h→5.8h. All fictional. (MHI-5 stays deliberately sparse to keep
 * demonstrating the ≤2-reading dot-strip rule.)
 * ========================================================================= */

export const AMARA_PHQ9: Reading[] = [
  { date: '2026-01-12', label: '12 Jan', value: 18 },
  { date: '2026-01-26', label: '26 Jan', value: 17 },
  { date: '2026-02-09', label: '9 Feb', value: 16 },
  { date: '2026-02-23', label: '23 Feb', value: 15 },
  { date: '2026-03-08', label: '8 Mar', value: 14 },
  { date: '2026-03-22', label: '22 Mar', value: 13 },
  { date: '2026-04-05', label: '5 Apr', value: 11 },
  { date: '2026-05-03', label: '3 May', value: 10 },
  { date: '2026-08-12', label: '12 Aug', value: 9 },
];

export const AMARA_GAD7: Reading[] = [
  { date: '2026-01-12', label: '12 Jan', value: 14 },
  { date: '2026-01-26', label: '26 Jan', value: 14 },
  { date: '2026-02-09', label: '9 Feb', value: 13 },
  { date: '2026-02-23', label: '23 Feb', value: 12 },
  { date: '2026-03-08', label: '8 Mar', value: 12 },
  { date: '2026-03-22', label: '22 Mar', value: 11 },
  { date: '2026-04-05', label: '5 Apr', value: 10 },
  { date: '2026-05-03', label: '3 May', value: 9 },
  { date: '2026-08-12', label: '12 Aug', value: 8 },
];

/** Human "PHQ-9 15   GAD-7 12" score line for a timeline entry on the given visit date. */
function scoreLine(dateLabel: string): string {
  const phq = AMARA_PHQ9.find((r) => r.label === dateLabel)?.value;
  const gad = AMARA_GAD7.find((r) => r.label === dateLabel)?.value;
  return [phq != null ? `PHQ-9 ${phq}` : '', gad != null ? `GAD-7 ${gad}` : ''].filter(Boolean).join('   ');
}

const amara: Client = {
  id: 'amara',
  name: 'Amara K.',
  initials: 'AK',
  tokenId: '4c9-AK',
  age: 24,
  pronouns: 'she/her',
  status: 'active',
  risk: 'watch',
  clientSince: '12 Jan',
  sessionNumber: 5,
  lastSessionLabel: 'today · 10:30',
  followUp: 'On track',
  latestScore: AMARA_PHQ9[AMARA_PHQ9.length - 1].value,
  sparkline: AMARA_PHQ9.map((r) => r.value),
  focusTags: ['Academic anxiety', 'Sleep'],
  summaryLine: 'Session 5 · re-engagement week',
  measures: [
    {
      key: 'phq9',
      name: 'PHQ-9',
      readings: AMARA_PHQ9,
      latest: AMARA_PHQ9[AMARA_PHQ9.length - 1].value,
      deltaSinceStart: AMARA_PHQ9[AMARA_PHQ9.length - 1].value - AMARA_PHQ9[0].value,
      band: 'mild',
    },
    {
      key: 'gad7',
      name: 'GAD-7',
      readings: AMARA_GAD7,
      latest: AMARA_GAD7[AMARA_GAD7.length - 1].value,
      deltaSinceStart: AMARA_GAD7[AMARA_GAD7.length - 1].value - AMARA_GAD7[0].value,
      band: 'mild',
    },
    {
      // Sparse: 2 readings → renders as a dot-strip, never a trend line.
      key: 'sleep',
      name: 'Sleep (self-report)',
      unit: 'h',
      readings: [
        { date: '2026-04-05', label: '5 Apr', value: 4.9 },
        { date: '2026-08-10', label: '10 Aug', value: 5.8 },
      ],
      latest: 5.8,
      band: 'improving',
    },
  ],
  timeline: [
    {
      id: 't-s5',
      kind: 'session',
      date: '12 Aug · today',
      title: 'Session — re-engagement week',
      body: 'Steadier fortnight; sleep improving. Exam anxiety remains the focus. Draft under review.',
      scores: `${scoreLine('12 Aug')}   Sleep 5.8h`,
    },
    {
      id: 't-j1',
      kind: 'journal',
      date: '10 Aug',
      body: '"Slept through the night for the first time in weeks. Still nervous about stats."',
    },
    {
      id: 't-scr-may',
      kind: 'session',
      date: '3 May',
      title: 'Fortnightly screening',
      body: 'Interim re-administration of PHQ-9 / GAD-7; steady downward trend continues.',
      scores: scoreLine('3 May'),
    },
    {
      id: 't-s4',
      kind: 'session',
      date: '5 Apr',
      title: 'Session — sleep hygiene focus',
      body: 'Better mornings; still ruminating before exams. Trialled worry-window.',
      scores: scoreLine('5 Apr'),
    },
    {
      id: 't-scr-mar22',
      kind: 'session',
      date: '22 Mar',
      title: 'Fortnightly screening',
      body: 'Interim re-administration of PHQ-9 / GAD-7.',
      scores: scoreLine('22 Mar'),
    },
    {
      id: 't-s3',
      kind: 'session',
      date: '8 Mar',
      title: 'Session — first-gen pressure',
      body: 'Agreed to log sleep and one values-based action.',
      scores: scoreLine('8 Mar'),
    },
    {
      id: 't-scr-feb23',
      kind: 'session',
      date: '23 Feb',
      title: 'Fortnightly screening',
      body: 'Interim re-administration of PHQ-9 / GAD-7.',
      scores: scoreLine('23 Feb'),
    },
    {
      id: 't-safety',
      kind: 'safety',
      date: '9 Feb',
      title: 'Passive ideation screened — no plan or intent',
      body: 'Safety check completed; supports in place. Re-screen each session (now routine).',
      scores: scoreLine('9 Feb'),
    },
    {
      id: 't-scr-jan26',
      kind: 'session',
      date: '26 Jan',
      title: 'Fortnightly screening',
      body: 'Interim re-administration of PHQ-9 / GAD-7.',
      scores: scoreLine('26 Jan'),
    },
    {
      id: 't-intake',
      kind: 'intake',
      date: '12 Jan',
      title: 'Intake — moderate-severe presentation',
      body: 'Academic anxiety, disrupted sleep, low motivation since term start.',
      scores: scoreLine('12 Jan'),
    },
  ],
  lastPlan: [
    { id: 'p1', text: 'Review sleep log & re-administer PHQ-9 + GAD-7', source: 'from Plan & Next Steps · 5 Apr', done: false },
    { id: 'p2', text: 'Follow up on the worry-window experiment', source: 'from Plan & Next Steps · 5 Apr', done: false },
    { id: 'p3', text: 'Re-screen passive ideation (routine each session)', source: 'standing safety item · re-screen every session', done: false },
  ],
  naturalistic: [
    { date: '10 Aug', body: 'Slept through the night for the first time in weeks. Still nervous about stats.' },
    { date: '6 Aug', body: 'Study group helped. Felt less behind than I thought.' },
  ],
};

/* =========================================================================
 * Leah C. — the acute-risk exemplar (PHQ-9 item-9 positive). Sober clay
 * treatment, never alarm-red, never modal.
 * ========================================================================= */

const leah: Client = {
  id: 'leah',
  name: 'Leah C.',
  initials: 'LC',
  tokenId: '7f2-LC',
  age: 21,
  status: 'active',
  risk: 'acute',
  clientSince: '3 Feb',
  sessionNumber: 8,
  lastSessionLabel: 'today · 1:00',
  followUp: 'Safety review',
  followUpDue: true,
  latestScore: 16,
  sparkline: [17, 17, 16],
  focusTags: ['Low mood'],
  summaryLine: 'Session 8 · safety review scheduled',
  measures: [
    {
      key: 'phq9',
      name: 'PHQ-9',
      readings: [
        { date: '2026-07-08', label: '8 Jul', value: 17 },
        { date: '2026-07-22', label: '22 Jul', value: 17 },
        { date: '2026-08-05', label: '5 Aug', value: 16 },
      ],
      latest: 16,
      deltaSinceStart: -1,
      band: 'mod-sev',
    },
  ],
  timeline: [
    {
      id: 'lt-s8',
      kind: 'safety',
      date: '5 Aug',
      title: 'Passive ideation endorsed — C-SSRS completed',
      body: 'No plan / intent / means. Safety plan updated with two coping steps and a trusted contact. Weekly cadence agreed.',
      scores: 'PHQ-9 16',
    },
    {
      id: 'lt-s7',
      kind: 'session',
      date: '22 Jul',
      title: 'Session 7 — low mood, isolation',
      body: 'Reviewed supports; behavioural activation homework set.',
      scores: 'PHQ-9 17',
    },
  ],
  lastPlan: [
    { id: 'lp1', text: 'Review safety plan and trusted-contact status', source: 'from Risk & Safety Check · 5 Aug', done: false },
    { id: 'lp2', text: 'Re-administer C-SSRS this session', source: 'standing safety item', done: false },
  ],
  safety: {
    headline: 'Acute · review before today’s session',
    detail:
      'At the last session Leah endorsed passive thoughts of being better off asleep, with no plan, intent, or means. This is a standing review flag — calm and clear, not an alarm. The signal is a clay marker and the word review, never a red flash.',
    item9Positive: true,
    snapshot: [
      { label: 'PHQ-9', value: '16', sub: 'from 17', tone: 'neutral' },
      { label: 'Item 9', value: '1', sub: 'passive ideation', tone: 'risk' },
      { label: 'Safety plan', value: 'Current', sub: 'updated 5 Aug', tone: 'positive' },
    ],
    lastRiskNote:
      'Endorsed passive ideation; C-SSRS completed — no plan/intent/means. Collaborative safety plan updated with two new coping steps and a trusted contact. Agreed to weekly cadence and a mid-week check-in. Continue routine re-screen.',
    lastRiskNoteDate: '5 Aug',
  },
};

/* =========================================================================
 * Supporting caseload (lighter detail). Daniel R. is the sparse-data case
 * (2 readings → dot-strip). Sofia M. is follow-up-overdue / Elevated.
 * ========================================================================= */

const daniel: Client = {
  id: 'daniel',
  name: 'Daniel R.',
  initials: 'DR',
  tokenId: '33b-DR',
  age: 29,
  status: 'intake',
  risk: 'clear',
  clientSince: '29 Jul',
  sessionNumber: 2,
  lastSessionLabel: 'today · 11:30',
  followUp: 'New',
  latestScore: 10,
  sparkline: [11, 10], // sparse → dot-strip
  focusTags: ['Adjustment'],
  summaryLine: 'Session 2 · intake follow-up',
  measures: [
    {
      key: 'phq9',
      name: 'PHQ-9',
      readings: [
        { date: '2026-07-29', label: '29 Jul', value: 11 },
        { date: '2026-08-12', label: '12 Aug', value: 10 },
      ],
      latest: 10,
      band: 'moderate',
    },
  ],
  timeline: [
    { id: 'dt-2', kind: 'session', date: '12 Aug', title: 'Session 2 — intake follow-up', body: 'Establishing goals; adjustment to relocation.', scores: 'PHQ-9 10' },
    { id: 'dt-1', kind: 'intake', date: '29 Jul', title: 'Intake', body: 'Work stress and relocation adjustment.', scores: 'PHQ-9 11' },
  ],
  lastPlan: [{ id: 'dlp1', text: 'Complete formal assessment next session', source: 'from Plan & Next Steps · 29 Jul', done: false }],
};

const priya: Client = {
  id: 'priya',
  name: 'Priya S.',
  initials: 'PS',
  tokenId: 'a15-PS',
  age: 26,
  status: 'active',
  risk: 'watch',
  clientSince: '2 Mar',
  sessionNumber: 6,
  lastSessionLabel: 'today · 2:30',
  followUp: 'On track',
  latestScore: 13,
  sparkline: [15, 14, 14, 13],
  focusTags: ['Generalised anxiety'],
  summaryLine: 'Session 6 · exam-season check-in',
  measures: [
    {
      key: 'phq9',
      name: 'PHQ-9',
      readings: [
        { date: '2026-03-02', label: '2 Mar', value: 15 },
        { date: '2026-05-10', label: '10 May', value: 14 },
        { date: '2026-06-28', label: '28 Jun', value: 14 },
        { date: '2026-08-12', label: '12 Aug', value: 13 },
      ],
      latest: 13,
      deltaSinceStart: -2,
      band: 'moderate',
    },
  ],
  timeline: [{ id: 'pt-1', kind: 'session', date: '12 Aug', title: 'Session 6 — exam-season check-in', body: 'Generalised anxiety; exam-season workload.', scores: 'PHQ-9 13' }],
  lastPlan: [{ id: 'plp1', text: 'Review worry log', source: 'from Plan & Next Steps · 28 Jun', done: false }],
};

const marcus: Client = {
  id: 'marcus',
  name: 'Marcus T.',
  initials: 'MT',
  tokenId: '6d0-MT',
  age: 34,
  status: 'active',
  risk: 'clear',
  clientSince: '14 Apr',
  sessionNumber: 5,
  lastSessionLabel: '8 Aug',
  followUp: 'On track',
  latestScore: 6,
  sparkline: [12, 9, 7, 6],
  focusTags: ['Low mood'],
  summaryLine: 'Session 5 · behavioural activation',
  measures: [
    {
      key: 'phq9',
      name: 'PHQ-9',
      readings: [
        { date: '2026-04-14', label: '14 Apr', value: 12 },
        { date: '2026-05-30', label: '30 May', value: 9 },
        { date: '2026-07-11', label: '11 Jul', value: 7 },
        { date: '2026-08-08', label: '8 Aug', value: 6 },
      ],
      latest: 6,
      deltaSinceStart: -6,
      band: 'mild',
    },
  ],
  timeline: [{ id: 'mt-1', kind: 'session', date: '8 Aug', title: 'Session 5 — behavioural activation', body: 'Steady improvement; activity scheduling working.', scores: 'PHQ-9 6' }],
  lastPlan: [{ id: 'mlp1', text: 'Continue activity schedule', source: 'from Plan & Next Steps · 8 Aug', done: false }],
};

const sofia: Client = {
  id: 'sofia',
  name: 'Sofia M.',
  initials: 'SM',
  tokenId: 'b82-SM',
  age: 41,
  status: 'active',
  risk: 'elevated',
  clientSince: '5 Jan',
  sessionNumber: 9,
  lastSessionLabel: '22 Jul',
  followUp: 'Overdue 8d',
  followUpDue: true,
  latestScore: 12,
  sparkline: [10, 11, 12],
  focusTags: ['Panic'],
  summaryLine: 'Session 9 · follow-up overdue',
  measures: [
    {
      key: 'phq9',
      name: 'PHQ-9',
      readings: [
        { date: '2026-06-01', label: '1 Jun', value: 10 },
        { date: '2026-07-01', label: '1 Jul', value: 11 },
        { date: '2026-07-22', label: '22 Jul', value: 12 },
      ],
      latest: 12,
      deltaSinceStart: 2,
      band: 'moderate',
    },
  ],
  timeline: [{ id: 'st-1', kind: 'session', date: '22 Jul', title: 'Session 9 — panic symptoms', body: 'Uptick in panic frequency; follow-up now overdue.', scores: 'PHQ-9 12' }],
  lastPlan: [{ id: 'slp1', text: 'Reschedule overdue follow-up', source: 'from Plan & Next Steps · 22 Jul', done: false }],
};

const jordan: Client = {
  id: 'jordan',
  name: 'Jordan P.',
  initials: 'JP',
  tokenId: 'e47-JP',
  age: 38,
  status: 'wind-down',
  risk: 'clear',
  clientSince: '10 Nov',
  sessionNumber: 12,
  lastSessionLabel: '1 Aug',
  followUp: 'Discharge soon',
  latestScore: 4,
  sparkline: [9, 7, 5, 4],
  focusTags: ['Wind-down'],
  summaryLine: 'Session 12 · wind-down',
  measures: [
    {
      key: 'phq9',
      name: 'PHQ-9',
      readings: [
        { date: '2026-05-01', label: '1 May', value: 9 },
        { date: '2026-06-15', label: '15 Jun', value: 7 },
        { date: '2026-07-10', label: '10 Jul', value: 5 },
        { date: '2026-08-01', label: '1 Aug', value: 4 },
      ],
      latest: 4,
      deltaSinceStart: -5,
      band: 'minimal',
    },
  ],
  timeline: [{ id: 'jt-1', kind: 'session', date: '1 Aug', title: 'Session 12 — wind-down', body: 'Gains maintained; planning discharge.', scores: 'PHQ-9 4' }],
  lastPlan: [{ id: 'jlp1', text: 'Draft discharge summary', source: 'from Plan & Next Steps · 1 Aug', done: false }],
};

/** Caseload order matches the s4 prototype (follow-up due first). */
export const CLIENTS: Client[] = [leah, amara, priya, daniel, marcus, sofia, jordan];

export const CLIENTS_BY_ID: Record<string, Client> = Object.fromEntries(CLIENTS.map((c) => [c.id, c]));

/* ------------------------------------------------------------ day board --- */

export const DAY_DASHBOARD: DayDashboard = {
  // Header date is set at load time (see todayLabel in buildSampleSnapshot) so it never claims the
  // wrong weekday/date. Counts below match the 4-entry schedule (F15).
  dateLabel: 'TODAY',
  subtitle: 'Four sessions today · 2 need prep · caseload all sync’d on this device',
  nextInMinutes: 24,
  nextClientId: 'amara',
  glance: [
    { label: 'Sessions today', value: '4' },
    { label: 'Need prep', value: '2' },
    { label: 'Notes to sign', value: '1' },
    { label: 'Follow-ups due', value: '2', tone: 'risk' },
  ],
  schedule: [
    { clientId: 'amara', time: '10:30', meridiem: 'AM', durationMin: 50, kind: 'Individual', sessionLabel: 'Session 5 · re-engagement week', prepCount: 3 },
    { clientId: 'daniel', time: '11:30', meridiem: 'AM', durationMin: 50, kind: 'Individual', sessionLabel: 'Session 2 · intake follow-up', prepCount: 2 },
    { clientId: 'leah', time: '1:00', meridiem: 'PM', durationMin: 50, kind: 'Individual', sessionLabel: 'Session 8 · safety review scheduled', prepCount: 4 },
    { clientId: 'priya', time: '2:30', meridiem: 'PM', durationMin: 50, kind: 'Individual', sessionLabel: 'Session 6 · exam-season check-in', prepCount: 1 },
  ],
  standingSafety: { clientId: 'leah', note: 'Leah C. — acute · review at 1:00' },
};

/* ------------------------------------------------ Amara's session-5 draft -- */

export const AMARA_DRAFT: DraftNote = {
  sessionLabel: 'Session 5 — 12 Aug',
  sourceLine: 'Sample note · fictional session, no real PHI — nothing was transcribed',
  status: 'draft',
  riskLevel: 'watch',
  // SOAP order (round-2 change #9, revised captain round 2 2026-08-17): Subjective · Objective ·
  // Assessment · Plan · Risk & Safety Check. Risk is its own always-present section, now LAST so the
  // clinical narrative (S/O/A/P) reads before the routine safety check.
  sections: [
    {
      id: 'sec-s',
      marker: 'S',
      title: 'Subjective',
      body: [
        'Amara attended for a scheduled individual session during re-engagement week. She described the past fortnight as "steadier," with fewer early-morning waking episodes since starting the sleep log. Ongoing academic pressure remains the central concern, particularly an upcoming statistics exam and a sense of being "behind everyone else" as a first-generation student.',
      ],
      quote: 'The mornings are easier now — it’s the nights before a deadline that still get me.',
    },
    {
      id: 'sec-o',
      marker: 'O',
      title: 'Objective',
      hasMeasures: true,
      body: [
        'Re-administered standardised measures this session; both continue to trend down from intake. Presented as engaged and reflective, with brighter affect than at intake.',
      ],
    },
    {
      id: 'sec-a',
      marker: 'A',
      title: 'Assessment',
      body: [
        'Presentation is consistent with an adjustment response with anxious and depressive features, showing steady improvement in response to behavioural activation and sleep intervention. Cognitive themes centre on perfectionism and belonging. No new risk indicators emerged this session.',
      ],
    },
    {
      id: 'sec-p',
      marker: 'P',
      title: 'Plan',
      body: [],
      bullets: [
        'Continue sleep log; aim for consistent wake time across weekends.',
        'Introduce exam-specific cognitive reframe; assign one worry-window per day.',
        'Re-administer PHQ-9 & GAD-7 next session; re-screen passive ideation (routine).',
        'Book Session 6 for the week of 26 Aug (post-exam).',
      ],
    },
    {
      id: 'sec-risk',
      marker: 'risk',
      title: 'Risk & Safety Check',
      isRisk: true,
      rows: [
        { label: 'Passive ideation (PHQ-9 item 9)', value: 'Not present today' },
        { label: 'Plan / intent / means', value: 'Not indicated' },
        { label: 'Protective factors', value: 'Strong — friends, faith, goals' },
      ],
      body: [
        'Safety plan from Session 2 reviewed and remains current. Continue routine re-screening each session. Standing escalation affordance available if this changes.',
      ],
    },
  ],
  measures: [
    // today/prev derive from the last two canonical readings (F13) — they can't drift from the chart.
    { measure: 'PHQ-9', today: String(AMARA_PHQ9[AMARA_PHQ9.length - 1].value), prev: String(AMARA_PHQ9[AMARA_PHQ9.length - 2].value), band: 'mild' },
    { measure: 'GAD-7', today: String(AMARA_GAD7[AMARA_GAD7.length - 1].value), prev: String(AMARA_GAD7[AMARA_GAD7.length - 2].value), band: 'mild' },
    { measure: 'Sleep (avg/night)', today: '5.8h', prev: '4.9h', band: 'improving' },
  ],
  reviewCodes: [
    { code: 'F43.22', label: 'Adjustment disorder, mixed anxiety & depressed mood', relevance: 'high' },
    { code: 'Z63.8', label: 'Other specified problems related to primary support', relevance: 'med' },
    { code: 'G47.00', label: 'Insomnia, unspecified', relevance: 'med' },
  ],
  // Rail prescriptions start clinician-written; "Generate from notes" pulls the Plan bullets.
  prescriptions: [
    { id: 'rx1', text: 'Sleep-hygiene handout + consistent wake time', source: 'added by you', done: false },
    { id: 'rx2', text: 'Daily worry-window (10 min, same time)', source: 'added by you', done: false },
  ],
};

/* =========================================================================
 * Round-2 item 2/3: longitudinal history. Every client below gets up to
 * MAX_NOTES_PER_CLIENT (5) real DraftNote sessions — not just Amara — so the patterns/[clientId]
 * trajectory view (recurring review codes, repeated plan items, risk tier over time) has real
 * per-client history to derive from, rather than one client's data standing in for everyone's.
 * A client is never given more notes than their `sessionNumber` — Daniel (2 real sessions) is left at
 * 2 on purpose: it's the fixture's own demonstration of the "at least 3 sessions" trajectory
 * empty-state, not an oversight. `sampleOrigin` is stamped uniformly by `buildSampleSnapshot`, not here.
 * ========================================================================= */

/**
 * One lighter-weight historical session note for the supporting caseload — enough real structure
 * (risk rows, reviewCodes, prescriptions, riskLevel) for trajectory derivation, without Amara/Leah's
 * full bespoke prose. `status: 'signed'` with no `signedBy` (a past session) — the review screen
 * already falls back to the signed-in clinician's name when that's absent. Section order is
 * S/O/A/P/Risk (captain round 2, 2026-08-17 — Risk & Safety Check renders LAST), matching AMARA_DRAFT.
 */
function note(opts: {
  clientId: string;
  sessionNumber: number;
  dateLabel: string;
  subjective: string;
  riskRows: { label: string; value: string }[];
  riskBody: string;
  assessment: string;
  planBullets: string[];
  reviewCodes: ReviewCode[];
  prescriptions: { text: string }[];
  riskLevel: RiskLevel;
  phq9: number;
}): DraftNote {
  const idBase = `${opts.clientId}-s${opts.sessionNumber}`;
  return {
    sessionLabel: `Session ${opts.sessionNumber} — ${opts.dateLabel}`,
    sourceLine: 'Sample note · fictional session, no real PHI — nothing was transcribed',
    status: 'signed',
    signedAt: opts.dateLabel,
    riskLevel: opts.riskLevel,
    sections: [
      { id: `${idBase}-s`, marker: 'S', title: 'Subjective', body: [opts.subjective] },
      { id: `${idBase}-o`, marker: 'O', title: 'Objective', hasMeasures: true, body: [`PHQ-9 re-administered this session: ${opts.phq9}.`] },
      { id: `${idBase}-a`, marker: 'A', title: 'Assessment', body: [opts.assessment] },
      { id: `${idBase}-p`, marker: 'P', title: 'Plan', body: [], bullets: opts.planBullets },
      { id: `${idBase}-risk`, marker: 'risk', title: 'Risk & Safety Check', isRisk: true, rows: opts.riskRows, body: [opts.riskBody] },
    ],
    measures: [{ measure: 'PHQ-9', today: String(opts.phq9), prev: '—', band: '—' }],
    reviewCodes: opts.reviewCodes,
    prescriptions: opts.prescriptions.map((p, i) => ({ id: `${idBase}-rx${i + 1}`, text: p.text, source: 'from Plan & Next Steps', done: false })),
  };
}

const NOT_INDICATED_ROWS = [
  { label: 'Passive ideation (PHQ-9 item 9)', value: 'Not indicated' },
  { label: 'Plan / intent / means', value: 'Not indicated' },
];

/* ---- Amara: sessions 1-4 (session 5 is the existing AMARA_DRAFT, above). ---- */

const AMARA_S1 = note({
  clientId: 'amara',
  sessionNumber: 1,
  dateLabel: '12 Jan',
  subjective:
    'Amara presented for an initial intake session, describing worsening low mood, disrupted sleep, and a persistent sense of falling behind her peers as a first-generation student since the start of term. Low motivation for coursework and early-morning waking most nights.',
  riskRows: [{ label: 'Passive ideation (PHQ-9 item 9)', value: 'Not present' }, { label: 'Plan / intent / means', value: 'Not indicated' }, { label: 'Protective factors', value: 'Friends, faith, academic goals' }],
  riskBody: 'No risk indicators identified at intake.',
  assessment:
    'Presentation consistent with an adjustment response with mixed anxious and depressive features, precipitated by academic pressure and the transition to university life. Disrupted sleep is a secondary maintaining factor.',
  planBullets: ['Start a nightly sleep log', 'Psychoeducation on adjustment stress and sleep hygiene', 'Book Session 2 in two weeks'],
  reviewCodes: [
    { code: 'F43.22', label: 'Adjustment disorder, mixed anxiety & depressed mood', relevance: 'high' },
    { code: 'G47.00', label: 'Insomnia, unspecified', relevance: 'med' },
  ],
  prescriptions: [{ text: 'Start a nightly sleep log' }],
  riskLevel: 'elevated',
  phq9: 18,
});

const AMARA_S2 = note({
  clientId: 'amara',
  sessionNumber: 2,
  dateLabel: '23 Feb',
  subjective:
    'Amara reported a difficult few weeks, with passing thoughts of not wanting to wake up on her worst nights, alongside ongoing academic pressure and disrupted sleep. Denied any plan, intent, or means, and identified friends and faith as active protective factors.',
  riskRows: [
    { label: 'Passive ideation (PHQ-9 item 9)', value: 'Endorsed — no plan/intent/means' },
    { label: 'Plan / intent / means', value: 'Not indicated' },
    { label: 'Protective factors', value: 'Strong — friends, faith, goals' },
  ],
  riskBody:
    'Safety check completed this session; passive ideation endorsed with no plan, intent, or means. Supports reviewed and confirmed in place; safety plan drafted collaboratively. Standing item to re-screen every session going forward.',
  assessment:
    'Adjustment disorder, mixed anxiety & depressed mood, with newly disclosed passive ideation — a standing review item. Sleep disruption and academic stress remain the primary drivers.',
  planBullets: ['Continue sleep log', 'Draft and review a brief safety plan', 'Re-screen passive ideation next session (now routine)'],
  reviewCodes: [
    { code: 'F43.22', label: 'Adjustment disorder, mixed anxiety & depressed mood', relevance: 'high' },
    { code: 'Z63.8', label: 'Other specified problems related to primary support group', relevance: 'med' },
    { code: 'G47.00', label: 'Insomnia, unspecified', relevance: 'med' },
  ],
  prescriptions: [{ text: 'Continue nightly sleep log' }, { text: 'Safety plan drafted this session' }],
  riskLevel: 'elevated',
  phq9: 15,
});

const AMARA_S3 = note({
  clientId: 'amara',
  sessionNumber: 3,
  dateLabel: '8 Mar',
  subjective:
    'Amara described feeling somewhat steadier this fortnight, with passive ideation not present since the last session. First-generation pressure and a sense of falling behind remain prominent themes.',
  riskRows: [
    { label: 'Passive ideation (PHQ-9 item 9)', value: 'Not present today' },
    { label: 'Plan / intent / means', value: 'Not indicated' },
    { label: 'Protective factors', value: 'Strong — friends, faith, goals' },
  ],
  riskBody: 'No risk indicators today; safety plan from Session 2 reviewed and remains current. Continue routine re-screening.',
  assessment:
    'Adjustment disorder, mixed anxiety & depressed mood; passive ideation has not recurred since disclosure, though the underlying stressors persist.',
  planBullets: ['Continue sleep log', 'Agree one values-based action to log daily', 'Re-screen passive ideation (routine)'],
  reviewCodes: [
    { code: 'F43.22', label: 'Adjustment disorder, mixed anxiety & depressed mood', relevance: 'high' },
    { code: 'Z63.8', label: 'Other specified problems related to primary support group', relevance: 'med' },
  ],
  prescriptions: [{ text: 'Continue nightly sleep log' }, { text: 'One values-based action, logged daily' }],
  riskLevel: 'watch',
  phq9: 14,
});

const AMARA_S4 = note({
  clientId: 'amara',
  sessionNumber: 4,
  dateLabel: '5 Apr',
  subjective:
    'Amara reported better mornings and fewer early wakes since consistent bedtime tracking, though pre-exam rumination continues in the evenings. Trialled a worry-window technique this fortnight with some success.',
  riskRows: [
    { label: 'Passive ideation (PHQ-9 item 9)', value: 'Not present today' },
    { label: 'Plan / intent / means', value: 'Not indicated' },
    { label: 'Protective factors', value: 'Strong — friends, faith, goals' },
  ],
  riskBody: 'No risk indicators. Safety plan reviewed and remains current.',
  assessment: 'Continued steady improvement; sleep intervention showing effect, exam-related rumination now the primary residual target.',
  planBullets: ['Continue sleep log; consistent wake time across weekends', 'Continue daily worry-window (10 min)', 'Re-administer PHQ-9 & GAD-7 next session'],
  reviewCodes: [
    { code: 'F43.22', label: 'Adjustment disorder, mixed anxiety & depressed mood', relevance: 'high' },
    { code: 'G47.00', label: 'Insomnia, unspecified', relevance: 'med' },
    { code: 'Z63.8', label: 'Other specified problems related to primary support group', relevance: 'low' },
  ],
  prescriptions: [{ text: 'Sleep-hygiene handout + consistent wake time' }, { text: 'Daily worry-window (10 min, same time)' }],
  riskLevel: 'watch',
  phq9: 11,
});

/* ---- Leah: sessions 4-8 (5 of her 8 real sessions — oldest 3 roll off, per MAX_NOTES_PER_CLIENT). ---- */

const LEAH_S4 = note({
  clientId: 'leah',
  sessionNumber: 4,
  dateLabel: '24 Jun',
  subjective: 'Leah described low mood and increasing social withdrawal over the past few weeks, citing low energy and difficulty motivating herself to see friends.',
  riskRows: [{ label: 'Passive ideation (PHQ-9 item 9)', value: 'Not present today' }, { label: 'Plan / intent / means', value: 'Not indicated' }],
  riskBody: 'No risk indicators today; safety plan from prior session remains current.',
  assessment: 'Recurrent depressive disorder, moderate episode; low mood and isolation are the primary targets.',
  planBullets: ['Weekly check-in call between sessions', 'Begin behavioural activation homework'],
  reviewCodes: [{ code: 'F33.1', label: 'Recurrent depressive disorder, moderate', relevance: 'high' }],
  prescriptions: [{ text: 'Weekly check-in call' }, { text: 'Behavioural activation homework' }],
  riskLevel: 'watch',
  phq9: 18,
});

const LEAH_S5 = note({
  clientId: 'leah',
  sessionNumber: 5,
  dateLabel: '1 Jul',
  subjective: 'Leah reports the check-in calls have helped with accountability; mood remains low but slightly more stable.',
  riskRows: NOT_INDICATED_ROWS,
  riskBody: 'No risk indicators.',
  assessment: 'Continued moderate depressive episode; some early response to behavioural activation.',
  planBullets: ['Continue weekly check-in call', 'Review behavioural activation homework'],
  reviewCodes: [{ code: 'F33.1', label: 'Recurrent depressive disorder, moderate', relevance: 'high' }],
  prescriptions: [{ text: 'Weekly check-in call' }, { text: 'Behavioural activation homework' }],
  riskLevel: 'watch',
  phq9: 17,
});

const LEAH_S6 = note({
  clientId: 'leah',
  sessionNumber: 6,
  dateLabel: '8 Jul',
  subjective: 'Leah describes a difficult week with a setback in mood following a disagreement with a close friend; withdrawal has increased again.',
  riskRows: [
    { label: 'Passive ideation (PHQ-9 item 9)', value: 'Not present today' },
    { label: 'Plan / intent / means', value: 'Not indicated' },
  ],
  riskBody: 'No risk indicators today; monitoring closely given the setback.',
  assessment: 'Depressive episode remains moderate; recent interpersonal stressor a likely precipitant for the setback.',
  planBullets: ['Increase check-in call frequency this week', 'Review supports and social contact plan'],
  reviewCodes: [{ code: 'F33.1', label: 'Recurrent depressive disorder, moderate', relevance: 'high' }],
  prescriptions: [{ text: 'Weekly check-in call' }, { text: 'Behavioural activation homework' }],
  riskLevel: 'watch',
  phq9: 17,
});

const LEAH_S7 = note({
  clientId: 'leah',
  sessionNumber: 7,
  dateLabel: '22 Jul',
  subjective: 'Leah attended describing ongoing low mood and isolation; behavioural activation homework has been inconsistent this fortnight.',
  riskRows: NOT_INDICATED_ROWS,
  riskBody: 'No risk indicators today.',
  assessment: 'Recurrent depressive disorder, moderate; isolation remains the primary maintaining factor.',
  planBullets: ['Reviewed supports', 'Behavioural activation homework re-set for the coming week'],
  reviewCodes: [{ code: 'F33.1', label: 'Recurrent depressive disorder, moderate', relevance: 'high' }],
  prescriptions: [{ text: 'Behavioural activation homework' }],
  riskLevel: 'watch',
  phq9: 17,
});

const LEAH_S8 = note({
  clientId: 'leah',
  sessionNumber: 8,
  dateLabel: '5 Aug',
  subjective:
    'Leah presented today and, on routine screening, endorsed passive thoughts of being better off asleep over the past week, with no plan, intent, or means identified.',
  riskRows: [
    { label: 'Passive ideation (PHQ-9 item 9)', value: 'Endorsed — no plan/intent/means' },
    { label: 'Plan / intent / means', value: 'Not indicated' },
    { label: 'Protective factors', value: 'Present — supports, safety plan updated today' },
  ],
  riskBody:
    'C-SSRS completed; passive ideation endorsed with no plan, intent, or means. Safety plan updated collaboratively with two new coping steps and a trusted contact; weekly cadence agreed with a mid-week check-in.',
  assessment:
    'Recurrent depressive disorder, moderate, with newly endorsed passive suicidal ideation — a standing review flag, not an alarm. Continue routine re-screening every session.',
  planBullets: ['Weekly cadence with mid-week check-in', 'Re-administer C-SSRS next session (standing safety item)', 'Review safety plan and trusted-contact status'],
  reviewCodes: [
    { code: 'F33.1', label: 'Recurrent depressive disorder, moderate', relevance: 'high' },
    { code: 'R45.851', label: 'Suicidal ideation', relevance: 'high' },
  ],
  prescriptions: [{ text: 'Safety plan — two coping steps + trusted contact' }, { text: 'C-SSRS re-administration (standing)' }],
  riskLevel: 'acute',
  phq9: 16,
});

/* ---- Daniel: only 2 real sessions — deliberately left under 3 (the trajectory empty-state case). ---- */

const DANIEL_S1 = note({
  clientId: 'daniel',
  sessionNumber: 1,
  dateLabel: '29 Jul',
  subjective:
    'Daniel presented for an initial intake session following a recent relocation for work. He described ongoing stress adjusting to a new city and role, with some difficulty sleeping and low motivation in the evenings.',
  riskRows: NOT_INDICATED_ROWS,
  riskBody: 'No risk indicators identified at intake.',
  assessment: 'Presentation consistent with an adjustment reaction to relocation and role change. No prior mental health history reported.',
  planBullets: ['Complete formal assessment next session', 'Begin a brief sleep log'],
  reviewCodes: [
    { code: 'Z60.0', label: 'Phase of life problem (relocation / role change)', relevance: 'high' },
    { code: 'F43.20', label: 'Adjustment disorder, unspecified', relevance: 'med' },
  ],
  prescriptions: [{ text: 'Sleep log — evenings and wake time' }],
  riskLevel: 'clear',
  phq9: 11,
});

const DANIEL_S2 = note({
  clientId: 'daniel',
  sessionNumber: 2,
  dateLabel: '12 Aug',
  subjective:
    'Daniel returned for his first follow-up. He has settled into a routine at work and reports slightly improved sleep, though still misses his previous social network.',
  riskRows: NOT_INDICATED_ROWS,
  riskBody: 'No risk indicators; protective factors include a supportive sibling nearby.',
  assessment: 'Continued adjustment presentation; mood and sleep both trending in the right direction.',
  planBullets: ['Continue sleep log', 'Identify one local social activity to try', 'Formal PHQ-9/GAD-7 re-screen next visit'],
  reviewCodes: [
    { code: 'Z60.0', label: 'Phase of life problem (relocation / role change)', relevance: 'high' },
    { code: 'F43.20', label: 'Adjustment disorder, unspecified', relevance: 'med' },
  ],
  prescriptions: [{ text: 'Sleep log — evenings and wake time' }, { text: 'One local social activity this week' }],
  riskLevel: 'clear',
  phq9: 10,
});

/* ---- Priya: sessions 2-6 (the F41.1 example from the captain's own feedback). ---- */

const PRIYA_S2 = note({
  clientId: 'priya',
  sessionNumber: 2,
  dateLabel: '2 Mar',
  subjective: 'Priya described persistent worry about coursework and upcoming exams, with muscle tension and difficulty switching off in the evenings.',
  riskRows: [{ label: 'Passive ideation', value: 'Not indicated' }],
  riskBody: 'No risk indicators; worry is exam/coursework focused.',
  assessment: 'Presentation consistent with generalised anxiety, exam-season exacerbation.',
  planBullets: ['Start a daily worry log', 'Practice diaphragmatic breathing before bed'],
  reviewCodes: [
    { code: 'F41.1', label: 'Generalised anxiety disorder', relevance: 'high' },
    { code: 'Z55.9', label: 'Problems related to education, unspecified', relevance: 'med' },
  ],
  prescriptions: [{ text: 'Daily worry log' }],
  riskLevel: 'watch',
  phq9: 15,
});

const PRIYA_S3 = note({
  clientId: 'priya',
  sessionNumber: 3,
  dateLabel: '15 Apr',
  subjective: 'Priya reports the worry log is helping her notice patterns; still anxious ahead of assignment deadlines.',
  riskRows: [{ label: 'Passive ideation', value: 'Not indicated' }],
  riskBody: 'No risk indicators.',
  assessment: 'Gradual improvement; anxious cognitions remain assignment-focused.',
  planBullets: ['Continue worry log', 'Introduce a 10-minute grounding practice'],
  reviewCodes: [
    { code: 'F41.1', label: 'Generalised anxiety disorder', relevance: 'high' },
    { code: 'Z55.9', label: 'Problems related to education, unspecified', relevance: 'med' },
  ],
  prescriptions: [{ text: 'Daily worry log' }, { text: 'Grounding practice, 10 min daily' }],
  riskLevel: 'watch',
  phq9: 14,
});

const PRIYA_S4 = note({
  clientId: 'priya',
  sessionNumber: 4,
  dateLabel: '10 May',
  subjective: 'Exam season underway; Priya reports the grounding practice has become part of her routine and worry episodes are shorter.',
  riskRows: [{ label: 'Passive ideation', value: 'Not indicated' }],
  riskBody: 'No risk indicators.',
  assessment: 'Continued improvement; generalised anxiety trending down with skills practice.',
  planBullets: ['Continue worry log and grounding practice', 'Review sleep routine during exam weeks'],
  reviewCodes: [{ code: 'F41.1', label: 'Generalised anxiety disorder', relevance: 'high' }],
  prescriptions: [{ text: 'Daily worry log' }, { text: 'Grounding practice, 10 min daily' }],
  riskLevel: 'watch',
  phq9: 14,
});

const PRIYA_S5 = note({
  clientId: 'priya',
  sessionNumber: 5,
  dateLabel: '28 Jun',
  subjective: 'Between exam sittings; Priya reports steady mood with occasional worry spikes before results.',
  riskRows: [{ label: 'Passive ideation', value: 'Not indicated' }],
  riskBody: 'No risk indicators.',
  assessment: 'Stable presentation; anxiety well-managed with current strategies.',
  planBullets: ['Maintain worry log through results week', 'Plan a summer routine to reduce unstructured-time worry'],
  reviewCodes: [
    { code: 'F41.1', label: 'Generalised anxiety disorder', relevance: 'high' },
    { code: 'Z55.9', label: 'Problems related to education, unspecified', relevance: 'med' },
  ],
  prescriptions: [{ text: 'Daily worry log' }, { text: 'Grounding practice, 10 min daily' }],
  riskLevel: 'watch',
  phq9: 14,
});

const PRIYA_S6 = note({
  clientId: 'priya',
  sessionNumber: 6,
  dateLabel: '12 Aug',
  subjective: 'Priya attended for exam-season check-in; results are in and anxiety has eased somewhat, though a new term is approaching.',
  riskRows: [{ label: 'Passive ideation', value: 'Not indicated' }],
  riskBody: 'No risk indicators.',
  assessment: 'Generalised anxiety disorder, exam-season exacerbation now easing; core worry pattern remains the focus for ongoing work.',
  planBullets: ['Review worry log', "Plan ahead for next exam cycle's early warning signs"],
  reviewCodes: [{ code: 'F41.1', label: 'Generalised anxiety disorder', relevance: 'high' }],
  prescriptions: [{ text: 'Daily worry log' }],
  riskLevel: 'watch',
  phq9: 13,
});

/* ---- Marcus: sessions 1-5 (steady improvement — watch → clear). ---- */

const MARCUS_S1 = note({
  clientId: 'marcus',
  sessionNumber: 1,
  dateLabel: '1 Apr',
  subjective:
    "Marcus presented with low mood, reduced motivation and withdrawal from usual activities over the past two months, describing himself as 'just going through the motions'.",
  riskRows: NOT_INDICATED_ROWS,
  riskBody: 'No risk indicators; strong prior functioning and social supports intact.',
  assessment: 'Presentation consistent with a moderate depressive episode; good prognostic indicators given prior functioning.',
  planBullets: ['Introduce activity scheduling — 1-2 valued activities daily', 'Psychoeducation on behavioural activation'],
  reviewCodes: [{ code: 'F32.1', label: 'Moderate depressive episode', relevance: 'high' }],
  prescriptions: [{ text: 'Activity scheduling — 1-2 valued activities daily' }],
  riskLevel: 'watch',
  phq9: 14,
});

const MARCUS_S2 = note({
  clientId: 'marcus',
  sessionNumber: 2,
  dateLabel: '14 Apr',
  subjective: 'Marcus reports completing the activity schedule most days; noticed a slight lift in mood after re-engaging with a hobby.',
  riskRows: NOT_INDICATED_ROWS,
  riskBody: 'No risk indicators.',
  assessment: 'Early response to behavioural activation; mood beginning to trend upward.',
  planBullets: ['Continue activity scheduling', 'Add a brief mood rating alongside the log'],
  reviewCodes: [{ code: 'F32.1', label: 'Moderate depressive episode', relevance: 'high' }],
  prescriptions: [{ text: 'Activity scheduling — 1-2 valued activities daily' }],
  riskLevel: 'watch',
  phq9: 12,
});

const MARCUS_S3 = note({
  clientId: 'marcus',
  sessionNumber: 3,
  dateLabel: '30 May',
  subjective: 'Marcus describes more consistent energy and has resumed a regular exercise routine; still some low mood on weekends.',
  riskRows: NOT_INDICATED_ROWS,
  riskBody: 'No risk indicators.',
  assessment: 'Continued improvement; depressive episode trending toward mild severity.',
  planBullets: ['Continue activity scheduling, extend to weekends', 'Review sleep consistency'],
  reviewCodes: [
    { code: 'F32.1', label: 'Moderate depressive episode', relevance: 'high' },
    { code: 'Z73.0', label: 'Burn-out / life-management difficulty', relevance: 'med' },
  ],
  prescriptions: [{ text: 'Activity scheduling — 1-2 valued activities daily' }, { text: 'Weekend activity planning' }],
  riskLevel: 'clear',
  phq9: 9,
});

const MARCUS_S4 = note({
  clientId: 'marcus',
  sessionNumber: 4,
  dateLabel: '11 Jul',
  subjective: "Marcus reports feeling 'mostly like himself again,' maintaining the activity schedule with minimal effort now.",
  riskRows: NOT_INDICATED_ROWS,
  riskBody: 'No risk indicators.',
  assessment: 'Depressive symptoms now in the mild range; sustained response to behavioural activation.',
  planBullets: ['Maintain activity schedule as a standing routine', 'Begin tapering session-frequency discussion'],
  reviewCodes: [{ code: 'F32.1', label: 'Moderate depressive episode', relevance: 'high' }],
  prescriptions: [{ text: 'Activity scheduling — 1-2 valued activities daily' }],
  riskLevel: 'clear',
  phq9: 7,
});

const MARCUS_S5 = note({
  clientId: 'marcus',
  sessionNumber: 5,
  dateLabel: '8 Aug',
  subjective: 'Marcus attended reporting steady mood and consistent activity levels; motivated and engaged.',
  riskRows: NOT_INDICATED_ROWS,
  riskBody: 'No risk indicators.',
  assessment: 'Sustained improvement; depressive episode now minimal, consistent with the activity-scheduling response documented across sessions.',
  planBullets: ['Continue activity schedule', 'Discuss session-frequency taper at next visit'],
  reviewCodes: [{ code: 'F32.1', label: 'Moderate depressive episode', relevance: 'high' }],
  prescriptions: [{ text: 'Activity scheduling — 1-2 valued activities daily' }],
  riskLevel: 'clear',
  phq9: 6,
});

/* ---- Sofia: sessions 5-9 (worsening — watch → elevated, follow-up now overdue). ---- */

const SOFIA_S5 = note({
  clientId: 'sofia',
  sessionNumber: 5,
  dateLabel: '15 Apr',
  subjective: 'Sofia described occasional panic episodes, typically triggered by crowded spaces, with racing heart and shortness of breath lasting several minutes.',
  riskRows: NOT_INDICATED_ROWS,
  riskBody: 'No risk indicators.',
  assessment: 'Presentation consistent with panic disorder; episodes currently manageable with avoidance.',
  planBullets: ['Start a panic-symptom log (trigger, duration, intensity)', 'Introduce 5-4-3-2-1 grounding technique'],
  reviewCodes: [{ code: 'F41.0', label: 'Panic disorder', relevance: 'high' }],
  prescriptions: [{ text: 'Panic-symptom log' }],
  riskLevel: 'watch',
  phq9: 9,
});

const SOFIA_S6 = note({
  clientId: 'sofia',
  sessionNumber: 6,
  dateLabel: '15 May',
  subjective: 'Sofia reports the symptom log has helped identify crowding and time pressure as common triggers; grounding technique used with mixed success.',
  riskRows: NOT_INDICATED_ROWS,
  riskBody: 'No risk indicators.',
  assessment: 'Panic disorder, frequency stable; avoidance pattern is the current focus.',
  planBullets: ['Continue symptom log', 'Practice grounding technique daily, not just during episodes'],
  reviewCodes: [{ code: 'F41.0', label: 'Panic disorder', relevance: 'high' }],
  prescriptions: [{ text: 'Panic-symptom log' }, { text: 'Grounding technique, daily practice' }],
  riskLevel: 'watch',
  phq9: 10,
});

const SOFIA_S7 = note({
  clientId: 'sofia',
  sessionNumber: 7,
  dateLabel: '1 Jun',
  subjective: 'Sofia describes a steady period with fewer panic episodes, though avoidance of crowded transport continues.',
  riskRows: NOT_INDICATED_ROWS,
  riskBody: 'No risk indicators.',
  assessment: 'Panic disorder; symptom frequency stable, avoidance pattern persists as maintaining factor.',
  planBullets: ['Begin gentle exposure planning for avoided situations', 'Continue grounding practice'],
  reviewCodes: [{ code: 'F41.0', label: 'Panic disorder', relevance: 'high' }],
  prescriptions: [{ text: 'Grounding technique, daily practice' }],
  riskLevel: 'watch',
  phq9: 10,
});

const SOFIA_S8 = note({
  clientId: 'sofia',
  sessionNumber: 8,
  dateLabel: '1 Jul',
  subjective: 'Sofia reports an uptick in panic frequency this month, coinciding with a stressful period at work; avoidance has increased.',
  riskRows: NOT_INDICATED_ROWS,
  riskBody: 'No risk indicators; distress is situational, not safety-related.',
  assessment: 'Panic disorder symptoms have increased in frequency; work stress appears to be a precipitant.',
  planBullets: ['Review exposure plan given increased avoidance', 'Discuss work-stress coping strategies'],
  reviewCodes: [
    { code: 'F41.0', label: 'Panic disorder', relevance: 'high' },
    { code: 'Z56.6', label: 'Other physical/mental strain related to work', relevance: 'med' },
  ],
  prescriptions: [{ text: 'Panic-symptom log' }, { text: 'Grounding technique, daily practice' }],
  riskLevel: 'elevated',
  phq9: 11,
});

const SOFIA_S9 = note({
  clientId: 'sofia',
  sessionNumber: 9,
  dateLabel: '22 Jul',
  subjective: "Sofia's panic episodes have continued at an elevated frequency; today's follow-up was overdue by over a week.",
  riskRows: NOT_INDICATED_ROWS,
  riskBody: 'No risk indicators; distress remains situational.',
  assessment: 'Panic disorder, increased frequency sustained over two sessions — follow-up cadence needs to tighten.',
  planBullets: ['Reschedule overdue follow-up promptly', 'Continue grounding technique and exposure planning'],
  reviewCodes: [{ code: 'F41.0', label: 'Panic disorder', relevance: 'high' }],
  prescriptions: [{ text: 'Grounding technique, daily practice' }],
  riskLevel: 'elevated',
  phq9: 12,
});

/* ---- Jordan: sessions 8-12 (wind-down — steady clear, discharge planning). ---- */

const JORDAN_S8 = note({
  clientId: 'jordan',
  sessionNumber: 8,
  dateLabel: '10 Apr',
  subjective:
    'Jordan reports continued stability; the adjustment difficulties that brought him to therapy have largely resolved, though he wants to consolidate gains before ending.',
  riskRows: NOT_INDICATED_ROWS,
  riskBody: 'No risk indicators.',
  assessment: 'Adjustment disorder with prolonged depressed mood, in substantial remission.',
  planBullets: ['Begin relapse-prevention planning', 'Identify early-warning signs to watch for'],
  reviewCodes: [{ code: 'F43.21', label: 'Adjustment disorder with prolonged depressed mood', relevance: 'high' }],
  prescriptions: [{ text: 'Draft relapse-prevention plan' }],
  riskLevel: 'clear',
  phq9: 11,
});

const JORDAN_S9 = note({
  clientId: 'jordan',
  sessionNumber: 9,
  dateLabel: '1 May',
  subjective: "Jordan continues to maintain his routine and reports good mood stability; relapse-prevention plan drafted last session feels solid.",
  riskRows: NOT_INDICATED_ROWS,
  riskBody: 'No risk indicators.',
  assessment: 'Sustained remission; relapse-prevention planning underway.',
  planBullets: ['Finalise relapse-prevention plan', 'Maintain current activity routine'],
  reviewCodes: [{ code: 'F43.21', label: 'Adjustment disorder with prolonged depressed mood', relevance: 'high' }],
  prescriptions: [{ text: 'Maintain activity/routine' }],
  riskLevel: 'clear',
  phq9: 9,
});

const JORDAN_S10 = note({
  clientId: 'jordan',
  sessionNumber: 10,
  dateLabel: '15 Jun',
  subjective: 'Jordan reports mood remains stable; beginning to discuss what ending therapy might look like.',
  riskRows: NOT_INDICATED_ROWS,
  riskBody: 'No risk indicators.',
  assessment: 'Continued remission; wind-down phase appropriate to begin discussing.',
  planBullets: ['Discuss discharge timeline', 'Continue relapse-prevention plan'],
  reviewCodes: [{ code: 'F43.21', label: 'Adjustment disorder with prolonged depressed mood', relevance: 'high' }],
  prescriptions: [{ text: 'Maintain activity/routine' }],
  riskLevel: 'clear',
  phq9: 7,
});

const JORDAN_S11 = note({
  clientId: 'jordan',
  sessionNumber: 11,
  dateLabel: '10 Jul',
  subjective: 'Jordan reports feeling ready to reduce session frequency; routine and mood both stable.',
  riskRows: NOT_INDICATED_ROWS,
  riskBody: 'No risk indicators.',
  assessment: 'Sustained remission; appropriate candidate for discharge planning.',
  planBullets: ['Space next session by three weeks', 'Begin drafting discharge summary'],
  reviewCodes: [{ code: 'F43.21', label: 'Adjustment disorder with prolonged depressed mood', relevance: 'high' }],
  prescriptions: [{ text: 'Maintain activity/routine' }, { text: 'Draft discharge summary' }],
  riskLevel: 'clear',
  phq9: 5,
});

const JORDAN_S12 = note({
  clientId: 'jordan',
  sessionNumber: 12,
  dateLabel: '1 Aug',
  subjective: 'Jordan attended for a wind-down session; gains have been maintained over the extended interval and he feels ready for discharge.',
  riskRows: NOT_INDICATED_ROWS,
  riskBody: 'No risk indicators.',
  assessment: 'Adjustment disorder, in full remission; discharge appropriate.',
  planBullets: ['Finalise discharge summary', 'Provide relapse-prevention plan and re-referral pathway'],
  reviewCodes: [{ code: 'F43.21', label: 'Adjustment disorder with prolonged depressed mood', relevance: 'high' }],
  prescriptions: [{ text: 'Draft discharge summary' }],
  riskLevel: 'clear',
  phq9: 4,
});

/**
 * Session-generated (or sample) draft notes, keyed by clientId, NEWEST FIRST — the same order
 * `withNote`/`useClientNotes` expect. `buildSampleSnapshot` stamps `sampleOrigin: true` onto every
 * note here at load time.
 */
export const SAMPLE_NOTES: Record<string, DraftNote[]> = {
  amara: [AMARA_DRAFT, AMARA_S4, AMARA_S3, AMARA_S2, AMARA_S1],
  leah: [LEAH_S8, LEAH_S7, LEAH_S6, LEAH_S5, LEAH_S4],
  daniel: [DANIEL_S2, DANIEL_S1],
  priya: [PRIYA_S6, PRIYA_S5, PRIYA_S4, PRIYA_S3, PRIYA_S2],
  marcus: [MARCUS_S5, MARCUS_S4, MARCUS_S3, MARCUS_S2, MARCUS_S1],
  sofia: [SOFIA_S9, SOFIA_S8, SOFIA_S7, SOFIA_S6, SOFIA_S5],
  jordan: [JORDAN_S12, JORDAN_S11, JORDAN_S10, JORDAN_S9, JORDAN_S8],
};
