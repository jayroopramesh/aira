/**
 * Chart-axis harness (decision item 4). Proves the longitudinal chart's x-axis is spaced
 * proportionally to REAL ELAPSED TIME, not by reading index — a 2-week gap and a 3-month gap must
 * draw visibly different widths, which the prior equal-interval layout got wrong.
 *
 * Run (Node ≥ 22.13, e.g. ~/.cache/fm-node/node-v22.23.2-darwin-arm64/bin/node):
 *   node --experimental-strip-types scripts/chart-axis-harness.mjs
 * Exits non-zero on the first failed assertion.
 */
import { dateProportionalX } from '../src/data/chartLayout.ts';

let failed = 0;
function check(name, ok, detail) {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (${detail})`}`);
}

const PLOT_W = 430;
const PAD_L = 34;

// The exact case from the decision brief: PHQ-9's real date sequence.
const PHQ9_DATES = ['2026-01-12', '2026-01-26', '2026-02-09', '2026-02-23', '2026-03-08', '2026-03-22', '2026-04-05', '2026-05-03', '2026-08-12'];

{
  const x = dateProportionalX(PHQ9_DATES, PLOT_W, PAD_L);
  check('returns a position per reading', x !== null && x.length === PHQ9_DATES.length, JSON.stringify(x));

  const gap = (i) => x[i + 1] - x[i];
  // 12 Jan → 26 Jan is 14 days; 3 May → 12 Aug is ~101 days — over 7x the elapsed time.
  const twoWeekGap = gap(0);
  const threeMonthGap = gap(7);
  check(
    '3 May → 12 Aug (≈101 days) draws far more width than 12 Jan → 26 Jan (14 days)',
    threeMonthGap > twoWeekGap * 3,
    `14-day gap=${twoWeekGap.toFixed(1)}px, ~101-day gap=${threeMonthGap.toFixed(1)}px`,
  );

  // Positions must stay strictly increasing and inside the plot.
  for (let i = 1; i < x.length; i++) {
    check(`point ${i} stays right of point ${i - 1}`, x[i] > x[i - 1], `${x[i - 1]} → ${x[i]}`);
  }
  check('every point stays within the plot width', x.every((v) => v >= PAD_L && v <= PAD_L + PLOT_W + 0.01), JSON.stringify(x));
}

// A cluster of same-week readings must not overlap into indistinguishable points.
{
  const clustered = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-06-01'];
  const x = dateProportionalX(clustered, PLOT_W, PAD_L);
  check('a tight cluster still keeps points separated', x[1] - x[0] >= 1 && x[2] - x[1] >= 1, JSON.stringify(x));
  check('the cluster does not collapse into a single indistinguishable pixel', x[2] - x[0] > 5, JSON.stringify(x));
  check('the far-out reading still lands last, inside the plot', x[3] > x[2] && x[3] <= PAD_L + PLOT_W + 0.01, JSON.stringify(x));
}

// Degenerate/unusable input falls back to the caller's equal-index spacing (returns null).
{
  check('fewer than 2 points → null (caller falls back)', dateProportionalX(['2026-01-01'], PLOT_W, PAD_L) === null);
  check('a missing date → null (caller falls back)', dateProportionalX(['2026-01-01', undefined, '2026-03-01'], PLOT_W, PAD_L) === null);
  check('an unparsable date → null (caller falls back)', dateProportionalX(['2026-01-01', 'not-a-date'], PLOT_W, PAD_L) === null);
  check('identical dates (zero span) → null (caller falls back)', dateProportionalX(['2026-01-01', '2026-01-01', '2026-01-01'], PLOT_W, PAD_L) === null);
  check('out-of-order dates (non-positive span) → null (caller falls back)', dateProportionalX(['2026-03-01', '2026-01-01'], PLOT_W, PAD_L) === null);
}

// Two evenly-spaced readings should land at the two ends of the plot, same as equal-spacing would.
{
  const x = dateProportionalX(['2026-01-01', '2026-02-01'], PLOT_W, PAD_L);
  check('first point sits at the left pad', Math.abs(x[0] - PAD_L) < 0.01, String(x[0]));
  check('last point sits at the right edge of the plot', Math.abs(x[1] - (PAD_L + PLOT_W)) < 0.01, String(x[1]));
}

console.log(failed ? `\n${failed} assertion(s) failed` : '\nAll chart-axis assertions passed');
process.exit(failed ? 1 : 0);
