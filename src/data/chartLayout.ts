/**
 * Pure chart-layout math, kept free of React/React Native imports so it can run under the project's
 * node-script test harnesses (see `scripts/chart-axis-harness.mjs`) the same way `sessionClient.ts`
 * and `scales.ts` do.
 */

/**
 * X positions for a longitudinal chart, spaced proportionally to REAL ELAPSED TIME rather than by
 * index — otherwise a 2-week gap and a 3-month gap between readings draw the same width and visually
 * misrepresent the trajectory (item 4). Falls back to equal-index spacing (the prior behaviour) when
 * dates are missing/unparsable or all identical, so a caller that never had dates keeps working — the
 * caller does that fallback itself (`dateX?.[i] ?? <equal-spacing formula>`), which is why this
 * returns `null` rather than a fabricated position on that path.
 *
 * Points that land closer than `minGap` (a real clustering, e.g. two readings the same week) are
 * pushed apart so they — and the axis labels under them — stay distinguishable; `minGap` never
 * demands more room than plain equal-spacing already would, so it only kicks in for genuine
 * clustering, never for a normally-spread series. If that push would run past the plot's right edge,
 * every position is scaled back down to fit — still ordered, still inside the plot.
 */
export function dateProportionalX(dates: (string | undefined)[], plotW: number, padL: number): number[] | null {
  if (dates.length < 2) return null;
  const times = dates.map((d) => (d ? Date.parse(d) : NaN));
  if (times.some((t) => Number.isNaN(t))) return null;
  const start = times[0];
  const span = times[times.length - 1] - start;
  if (span <= 0) return null;

  const ideal = times.map((t) => ((t - start) / span) * plotW);
  const minGap = Math.min(plotW / (dates.length - 1), 34);
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
