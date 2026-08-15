/**
 * Pure chart-layout math, kept free of React/React Native imports so it can run under the project's
 * node-script test harnesses (see `scripts/chart-axis-harness.mjs`) the same way `sessionClient.ts`
 * and `scales.ts` do.
 */

/**
 * The smallest gap that keeps two adjacent point MARKERS visually distinct. The markers are r=5
 * circles drawn with a 2.4-wide stroke (`charts.tsx`), so each occupies ~12.4 units across — 13
 * separates them without touching. It is deliberately derived from the marker, not from the width of
 * the axis LABEL underneath: displacing a data point to make room for its own caption is exactly the
 * equal-interval misrepresentation item 4 exists to remove. Label crowding is solved by thinning the
 * labels (`axisLabelVisibility`), which costs no proportionality at all.
 */
const POINT_MIN_GAP = 13;

/**
 * X positions for a longitudinal chart, spaced proportionally to REAL ELAPSED TIME rather than by
 * index — otherwise a 2-week gap and a 3-month gap between readings draw the same width and visually
 * misrepresent the trajectory (item 4). Falls back to equal-index spacing (the prior behaviour) when
 * dates are missing/unparsable or all identical, so a caller that never had dates keeps working — the
 * caller does that fallback itself (`dateX?.[i] ?? <equal-spacing formula>`), which is why this
 * returns `null` rather than a fabricated position on that path.
 *
 * Points that land closer than `POINT_MIN_GAP` (a real clustering, e.g. two readings the same week)
 * are pushed apart so they stay distinguishable. The floor is capped at what equal-index spacing
 * would already grant, so it can never make a series MORE crowded than the layout it replaced. If
 * the push would run past the plot's right edge, every position is scaled back down to fit — still
 * ordered, still inside the plot.
 */
export function dateProportionalX(dates: (string | undefined)[], plotW: number, padL: number): number[] | null {
  if (dates.length < 2) return null;
  const times = dates.map((d) => (d ? Date.parse(d) : NaN));
  if (times.some((t) => Number.isNaN(t))) return null;
  const start = times[0];
  const span = times[times.length - 1] - start;
  if (span <= 0) return null;

  const ideal = times.map((t) => ((t - start) / span) * plotW);
  const minGap = Math.min(plotW / (dates.length - 1), POINT_MIN_GAP);
  const adjusted = [...ideal];
  for (let i = 1; i < adjusted.length; i++) {
    if (adjusted[i] - adjusted[i - 1] < minGap) adjusted[i] = adjusted[i - 1] + minGap;
  }
  const overflow = adjusted[adjusted.length - 1] - plotW;
  if (overflow > 0) {
    const scale = plotW / adjusted[adjusted.length - 1];
    for (let i = 0; i < adjusted.length; i++) adjusted[i] *= scale;
  }
  return adjusted.map((x) => padL + x);
}

/**
 * Which per-point axis labels to RENDER, given where the points actually landed. Once x is
 * date-proportional the points are no longer evenly spaced, so a fixed "every nth label" rule can't
 * work: two readings a week apart sit a few units apart and their captions would overlap into
 * mush, while the labels either side of a three-month gap have room to spare.
 *
 * So the crowding is resolved on the LABELS, never on the points: walk left to right, keep a label
 * only when it clears `minLabelGap` from the last one kept. The first and last readings are the two
 * a clinician reads the axis for (where the series starts and where it stands now), so both are
 * always kept — and any earlier label the last one would collide with is dropped instead of the last.
 * Returns one flag per point, so callers just guard their label element with it.
 */
export function axisLabelVisibility(xs: number[], minLabelGap: number): boolean[] {
  const shown = xs.map(() => false);
  if (xs.length === 0) return shown;
  shown[0] = true;
  let lastShown = xs[0];
  for (let i = 1; i < xs.length - 1; i++) {
    if (xs[i] - lastShown >= minLabelGap) {
      shown[i] = true;
      lastShown = xs[i];
    }
  }
  const last = xs.length - 1;
  if (last > 0) {
    shown[last] = true;
    for (let i = last - 1; i >= 0 && xs[last] - xs[i] < minLabelGap; i--) shown[i] = false;
  }
  return shown;
}
