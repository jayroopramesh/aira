import { StringColorKey } from '../theme/tokens';
import { AMARA_GAD7, AMARA_PHQ9 } from './fixtures';

/**
 * Assessment-scale definitions for the client patterns chart (round-4 item 8). Multiple scales
 * are offered as tabs — PHQ-9 · GAD-7 · MHI-5 · DASS-21 — and the sparse ≤2-reading rule is kept
 * PER SCALE (MHI-5 has only 2 readings, so it renders as a dot-strip, never a trend line).
 *
 * The GAD-7 / MHI-5 / DASS-21 series (and the caseload-average comparison, `cmp`) are illustrative
 * prototype data consistent with Amara's existing PHQ-9 story — ported from the s4 prototype.
 */

export type BandKey = Extract<StringColorKey, 'bandSev' | 'bandModSev' | 'bandMod' | 'bandMild' | 'bandMin'>;

export type ScaleBand = { from: number; to: number; label: string; key: BandKey };

export type ScaleDef = {
  key: string; // display key, e.g. 'PHQ-9'
  sub?: string; // subtitle, e.g. 'Depression subscale'
  max?: number;
  ticks?: number[];
  unit?: string;
  sparse?: boolean; // ≤ 2 readings → dot-strip, no trend line
  higherBetter?: boolean;
  bands?: ScaleBand[];
  pts: { label: string; value: number }[];
  cmp?: number[]; // muted caseload-average comparison stroke (this-vs-that)
  read: string; // plain-language, headline-first reading
};

const PHQ_BANDS: ScaleBand[] = [
  { from: 20, to: 27, label: 'severe', key: 'bandSev' },
  { from: 15, to: 20, label: 'mod-sev', key: 'bandModSev' },
  { from: 10, to: 15, label: 'moderate', key: 'bandMod' },
  { from: 5, to: 10, label: 'mild', key: 'bandMild' },
  { from: 0, to: 5, label: 'minimal', key: 'bandMin' },
];

const GAD_BANDS: ScaleBand[] = [
  { from: 15, to: 21, label: 'severe', key: 'bandSev' },
  { from: 10, to: 15, label: 'moderate', key: 'bandMod' },
  { from: 5, to: 10, label: 'mild', key: 'bandMild' },
  { from: 0, to: 5, label: 'minimal', key: 'bandMin' },
];

const DASS_BANDS: ScaleBand[] = [
  { from: 28, to: 42, label: 'ext-severe', key: 'bandSev' },
  { from: 21, to: 28, label: 'severe', key: 'bandModSev' },
  { from: 14, to: 21, label: 'moderate', key: 'bandMod' },
  { from: 10, to: 14, label: 'mild', key: 'bandMild' },
  { from: 0, to: 10, label: 'normal', key: 'bandMin' },
];

/** The four-scale set for Amara's patterns view (order = tab order). */
export const AMARA_SCALES: ScaleDef[] = [
  {
    key: 'PHQ-9',
    max: 27,
    ticks: [27, 14, 0],
    bands: PHQ_BANDS,
    // Single source: Amara's canonical PHQ-9 (fixtures.ts) — chart, sparkline, timeline and the
    // draft measures table all read from the same array (F13).
    pts: AMARA_PHQ9.map((r) => ({ label: r.label, value: r.value })),
    cmp: [16, 16, 15, 15, 14, 13, 12, 11, 10],
    read: '18 → 9 across 9 readings · now in the mild band, down from moderate-severe at intake. Improving faster than the caseload average.',
  },
  {
    key: 'GAD-7',
    max: 21,
    ticks: [21, 10, 0],
    bands: GAD_BANDS,
    pts: AMARA_GAD7.map((r) => ({ label: r.label, value: r.value })),
    cmp: [12, 12, 12, 11, 11, 11, 10, 10, 9],
    read: '14 → 8 across 9 readings · into the mild band. Anxiety trails the depression trend by a few weeks.',
  },
  {
    key: 'MHI-5',
    sparse: true,
    unit: '/100',
    higherBetter: true,
    pts: [
      { label: '5 Apr', value: 56 },
      { label: '10 Aug', value: 68 },
    ],
    read: 'Only 2 readings so far — shown as points, not a trend. On MHI-5, higher is better.',
  },
  {
    key: 'DASS-21',
    sub: 'Depression subscale',
    max: 42,
    ticks: [42, 21, 0],
    bands: DASS_BANDS,
    // Same nine readings as PHQ-9 / GAD-7 (captain C5) so the multi-point plot is exercised here too.
    pts: [
      { label: '12 Jan', value: 26 },
      { label: '26 Jan', value: 25 },
      { label: '9 Feb', value: 23 },
      { label: '23 Feb', value: 21 },
      { label: '8 Mar', value: 19 },
      { label: '22 Mar', value: 16 },
      { label: '5 Apr', value: 13 },
      { label: '3 May', value: 11 },
      { label: '12 Aug', value: 10 },
    ],
    cmp: [17, 17, 16, 16, 15, 15, 14, 14, 13],
    read: '26 → 10 across 9 readings (depression subscale) · from severe toward the mild range.',
  },
];
