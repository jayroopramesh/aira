import type { Reading } from './types';

export type MeasureRange = '3m' | '6m' | '1y';

const RANGE_MONTHS: Record<MeasureRange, number> = { '3m': 3, '6m': 6, '1y': 12 };

/**
 * Readings within `range` of `now` (i.e. between `now - range` and `now`), oldest first (matches the
 * stored order). Pure so the range chips' filtering can be proved without rendering a chart — see
 * `scripts/chart-range-harness.mjs`.
 */
export function filterReadingsByRange(readings: Reading[], range: MeasureRange, now: Date): Reading[] {
  const months = RANGE_MONTHS[range];
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - months);
  const nowMs = now.getTime();
  const cutoffMs = cutoff.getTime();
  return readings.filter((r) => {
    const t = new Date(r.date).getTime();
    return t >= cutoffMs && t <= nowMs;
  });
}
