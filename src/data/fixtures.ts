import { CaseloadKpi, Client, DayDashboard, DraftNote } from './types';

/* =========================================================================
 * Amara K. — the primary longitudinal dataset (design-direction cohort).
 * PHQ-9 18→15→11→9 · GAD-7 14→8 · sleep 4.9h→5.8h · passive ideation screened
 * 9 Feb, none since. All fictional.
 * ========================================================================= */

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
  latestScore: 9,
  sparkline: [18, 15, 11, 9],
  focusTags: ['Academic anxiety', 'Sleep'],
  summaryLine: 'Session 5 · re-engagement week',
  measures: [
    {
      key: 'phq9',
      name: 'PHQ-9',
      readings: [
        { date: '2026-01-12', label: '12 Jan', value: 18 },
        { date: '2026-02-09', label: '9 Feb', value: 15 },
        { date: '2026-03-08', label: '8 Mar', value: 11 },
        { date: '2026-04-05', label: '5 Apr', value: 9 },
      ],
      latest: 9,
      deltaSinceStart: -9,
      band: 'mild',
    },
    {
      key: 'gad7',
      name: 'GAD-7',
      readings: [
        { date: '2026-01-12', label: '12 Jan', value: 14 },
        { date: '2026-03-08', label: '8 Mar', value: 10 },
        { date: '2026-04-05', label: '5 Apr', value: 8 },
      ],
      latest: 8,
      deltaSinceStart: -6,
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
      title: 'Session 5 — re-engagement week',
      body: 'Steadier fortnight; sleep improving. Exam anxiety remains the focus. Draft under review.',
      scores: 'PHQ-9 9   GAD-7 8   Sleep 5.8h',
    },
    {
      id: 't-j1',
      kind: 'journal',
      date: '10 Aug',
      body: '"Slept through the night for the first time in weeks. Still nervous about stats."',
    },
    {
      id: 't-s4',
      kind: 'session',
      date: '5 Apr',
      title: 'Session 4 — sleep hygiene focus',
      body: 'Better mornings; still ruminating before exams. Trialled worry-window.',
      scores: 'PHQ-9 11   GAD-7 10',
    },
    {
      id: 't-s3',
      kind: 'session',
      date: '8 Mar',
      title: 'Session 3 — first-gen pressure',
      body: 'Agreed to log sleep and one values-based action.',
      scores: 'PHQ-9 11   GAD-7 10',
    },
    {
      id: 't-safety',
      kind: 'safety',
      date: '9 Feb',
      title: 'Passive ideation screened — no plan or intent',
      body: 'Safety check completed; supports in place. Re-screen each session (now routine).',
    },
    {
      id: 't-intake',
      kind: 'intake',
      date: '12 Jan',
      title: 'Intake — moderate-severe presentation',
      body: 'Academic anxiety, disrupted sleep, low motivation since term start.',
      scores: 'PHQ-9 18   GAD-7 14',
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
  dateLabel: 'TUESDAY · 12 AUGUST',
  subtitle: 'Six sessions today · 2 need prep · caseload all sync’d on this device',
  nextInMinutes: 24,
  nextClientId: 'amara',
  glance: [
    { label: 'Sessions today', value: '6' },
    { label: 'Need prep', value: '2' },
    { label: 'Notes to sign', value: '3' },
    { label: 'Follow-ups due', value: '1', tone: 'risk' },
  ],
  schedule: [
    { clientId: 'amara', time: '10:30', meridiem: 'AM', durationMin: 50, kind: 'Individual', sessionLabel: 'Session 5 · re-engagement week', prepCount: 3 },
    { clientId: 'daniel', time: '11:30', meridiem: 'AM', durationMin: 50, kind: 'Individual', sessionLabel: 'Session 2 · intake follow-up', prepCount: 2 },
    { clientId: 'leah', time: '1:00', meridiem: 'PM', durationMin: 50, kind: 'Individual', sessionLabel: 'Session 8 · safety review scheduled', prepCount: 4 },
    { clientId: 'priya', time: '2:30', meridiem: 'PM', durationMin: 50, kind: 'Individual', sessionLabel: 'Session 6 · exam-season check-in', prepCount: 1 },
  ],
  standingSafety: { clientId: 'leah', note: 'Leah C. — acute · review at 1:00' },
};

/* ---------------------------------------------------------- caseload KPIs -- */

export const CASELOAD_KPIS: CaseloadKpi[] = [
  { label: 'Active clients', value: '24', sub: '+2 this month' },
  { label: 'Measure adherence', value: '86', unit: '%', sub: 're-screened on schedule' },
  { label: 'Improving (90d)', value: '17', sub: 'PHQ-9 or GAD-7 down' },
  { label: 'Risk flags', value: '1', sub: 'acute · review — sober, not alarmed', tone: 'risk' },
];

/* ------------------------------------------------ Amara's session-5 draft -- */

export const AMARA_DRAFT: DraftNote = {
  sessionLabel: 'Session 5 — 12 Aug',
  sourceLine: 'From a 47-min voice note · transcribed on-device · Identifiers never left this device',
  status: 'draft',
  // SOAP order (round-2 change #9): Subjective · Objective · Risk & Safety Check · Assessment · Plan.
  // Risk is its own always-present section, between Objective and Assessment.
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
      id: 'sec-risk',
      marker: 'risk',
      title: 'Risk & Safety Check',
      isRisk: true,
      rows: [
        { label: 'Passive ideation (PHQ-9 item 9)', value: 'Not present today' },
        { label: 'Plan / intent / means', value: 'Denied' },
        { label: 'Protective factors', value: 'Strong — friends, faith, goals' },
      ],
      body: [
        'Safety plan from Session 2 reviewed and remains current. Continue routine re-screening each session. Standing escalation affordance available if this changes.',
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
  ],
  measures: [
    { measure: 'PHQ-9', today: '9', prev: '11', band: 'mild' },
    { measure: 'GAD-7', today: '8', prev: '10', band: 'mild' },
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
