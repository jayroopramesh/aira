/**
 * Chart-axis harness (decision item 4). Proves the longitudinal chart's x-axis is spaced
 * proportionally to REAL ELAPSED TIME, not by reading index — a 2-week gap and a 3-month gap must
 * draw visibly different widths, which the prior equal-interval layout got wrong.
 *
 * Run (Node ≥ 22.13, e.g. ~/.cache/fm-node/node-v22.23.2-darwin-arm64/bin/node):
 *   node --experimental-strip-types scripts/chart-axis-harness.mjs
 * Exits non-zero on the first failed assertion.
 */
import { axisLabelVisibility, dateProportionalX } from '../src/data/chartLayout.ts';

let failed = 0;
function check(name, ok, detail) {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (${detail})`}`);
}

const PLOT_W = 430;
const PAD_L = 34;
const DAY = 86400000;
const days = (a, b) => (Date.parse(b) - Date.parse(a)) / DAY;

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

  // The real guarantee, and the one a min-gap floor set too high silently destroys: on a normally
  // spread series EVERY gap is proportional to its own elapsed days, not just the extremes. The
  // brief's own dataset has three distinct intervals (13, 14, 28 days) plus the 101-day tail; a
  // floor that flattened the short ones to a uniform width would still pass the coarse check above.
  const pxPerDay = PLOT_W / days(PHQ9_DATES[0], PHQ9_DATES[PHQ9_DATES.length - 1]);
  for (let i = 0; i < PHQ9_DATES.length - 1; i++) {
    const elapsed = days(PHQ9_DATES[i], PHQ9_DATES[i + 1]);
    check(
      `gap ${i} (${elapsed} days) is drawn at its true elapsed width, not floored`,
      Math.abs(gap(i) - elapsed * pxPerDay) < 0.01,
      `drew ${gap(i).toFixed(2)}px, proportional width is ${(elapsed * pxPerDay).toFixed(2)}px`,
    );
  }
  // The 28-day interval must draw about twice a 14-day one — the specific misrepresentation item 4
  // set out to remove, and exactly what a 34px floor reintroduced by flattening both to 34px.
  check(
    '5 Apr → 3 May (28 days) draws about twice 22 Mar → 5 Apr (14 days)',
    Math.abs(gap(6) / gap(5) - 2) < 0.05,
    `28-day gap=${gap(6).toFixed(1)}px, 14-day gap=${gap(5).toFixed(1)}px, ratio=${(gap(6) / gap(5)).toFixed(2)}`,
  );

  // Positions must stay strictly increasing and inside the plot.
  for (let i = 1; i < x.length; i++) {
    check(`point ${i} stays right of point ${i - 1}`, x[i] > x[i - 1], `${x[i - 1]} → ${x[i]}`);
  }
  check('every point stays within the plot width', x.every((v) => v >= PAD_L && v <= PAD_L + PLOT_W + 0.01), JSON.stringify(x));
}

// A cluster of same-week readings must not overlap into indistinguishable points. The markers are
// r=5 circles with a 2.4 stroke (~12.4 across), so the push must open at least that much room —
// proportional spacing alone would leave these three ~2.85px apart, one overlapping blob.
{
  const clustered = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-06-01'];
  const x = dateProportionalX(clustered, PLOT_W, PAD_L);
  const raw = (i) => (days(clustered[0], clustered[i]) / days(clustered[0], clustered[3])) * PLOT_W;
  check('proportional spacing alone would overlap this cluster (so the push has real work to do)', raw(1) < 12.4, `${raw(1).toFixed(2)}px`);
  check('a tight cluster is pushed to a full marker width apart', x[1] - x[0] >= 12.4 && x[2] - x[1] >= 12.4, JSON.stringify(x));
  check('the pushed points are not spread further than the marker floor needs', x[2] - x[0] < 30, JSON.stringify(x));
  check('the far-out reading still lands last, inside the plot', x[3] > x[2] && x[3] <= PAD_L + PLOT_W + 0.01, JSON.stringify(x));
}

// The push can only overflow the right edge when the cluster sits AT that edge. Fitting it back in
// must not undo the separation the push just bought — the marker is ~12.4 across (r=5 circle + 2.4
// stroke), so every surviving gap has to clear that, not merely "most of it".
const MARKER_W = 12.4;
{
  const trailing = ['2026-01-01', '2026-06-01', '2026-06-02'];
  const x = dateProportionalX(trailing, PLOT_W, PAD_L);
  check('an edge cluster does not push the last point past the plot', Math.abs(x[2] - (PAD_L + PLOT_W)) < 0.01, JSON.stringify(x));
  check('the edge cluster stays a full marker width apart', x[2] - x[1] >= MARKER_W, `${(x[2] - x[1]).toFixed(2)}px`);
  check('fitting back in keeps positions ordered and in bounds', x[0] >= PAD_L && x[1] > x[0] && x[2] > x[1], JSON.stringify(x));
  check('the long first interval still dominates the width', x[1] - x[0] > (x[2] - x[1]) * 10, JSON.stringify(x));
}

// The case a proportional rescale gets badly wrong: one old reading, then a long dense run crowded
// at the far edge. Scaling every position by plotW/total shrinks the pushed-open gaps along with
// everything else, collapsing the run into an unreadable blob. Pulling the tail LEFT instead keeps
// each gap at the floor.
{
  const dense = ['2026-01-01'];
  for (let i = 0; i < 30; i++) dense.push(new Date(Date.UTC(2026, 5, 1) + i * 6 * 3600000).toISOString().slice(0, 10));
  const x = dateProportionalX(dense, PLOT_W, PAD_L);
  let tightest = Infinity;
  for (let i = 1; i < x.length; i++) tightest = Math.min(tightest, x[i] - x[i - 1]);
  check('a dense tail keeps every marker separated', tightest >= MARKER_W, `tightest gap = ${tightest.toFixed(2)}px across ${x.length} readings`);
  check('a dense tail still ends at the plot edge', Math.abs(x[x.length - 1] - (PAD_L + PLOT_W)) < 0.01, String(x[x.length - 1]));
  check('a dense tail never drifts left of the plot', x[0] >= PAD_L - 0.01, String(x[0]));
  let ordered = true;
  for (let i = 1; i < x.length; i++) if (x[i] <= x[i - 1]) ordered = false;
  check('a dense tail stays strictly ordered', ordered, JSON.stringify(x));
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

// Readability is bought on the LABELS, not by displacing points: captions that would collide are
// dropped, so proportional spacing survives and the axis still reads.
const LABEL_GAP = 46;
{
  const x = dateProportionalX(PHQ9_DATES, PLOT_W, PAD_L);
  const shown = axisLabelVisibility(x, LABEL_GAP);
  check('a label is decided for every reading', shown.length === x.length, JSON.stringify(shown));
  check('the first reading keeps its label', shown[0] === true, JSON.stringify(shown));
  check('the latest reading keeps its label', shown[shown.length - 1] === true, JSON.stringify(shown));

  const kept = x.filter((_, i) => shown[i]);
  let closest = Infinity;
  for (let i = 1; i < kept.length; i++) closest = Math.min(closest, kept[i] - kept[i - 1]);
  check('no two rendered labels land closer than a label width', closest >= LABEL_GAP, `closest rendered pair = ${closest.toFixed(1)}px`);
  // The 14-day gaps draw ~28px, narrower than a "12 Jan" caption — so some captions MUST be dropped.
  check('crowded captions are dropped rather than the points being spread', shown.some((s) => !s), JSON.stringify(shown));
  check('the axis still keeps a useful number of labels', kept.length >= 4, `${kept.length} labels for ${x.length} readings`);
}

{
  // A series with room to spare keeps every label — thinning must not fire on a spread-out axis.
  const spread = dateProportionalX(['2026-01-01', '2026-03-01', '2026-05-01', '2026-07-01'], PLOT_W, PAD_L);
  const shown = axisLabelVisibility(spread, LABEL_GAP);
  check('a well-spread axis keeps every label', shown.every((s) => s), JSON.stringify(shown));
}

{
  // Fallback path: the caller passes equal-index positions when there are no dates. Those are wider
  // apart than a caption here, so all of them stay — the prior axis is not degraded.
  const equal = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => PAD_L + (i * PLOT_W) / 8);
  check('equal-index fallback spacing keeps all its labels', axisLabelVisibility(equal, LABEL_GAP).every((s) => s), JSON.stringify(equal));
  check('a single reading keeps its label', JSON.stringify(axisLabelVisibility([PAD_L], LABEL_GAP)) === '[true]');
  check('no readings decides no labels', JSON.stringify(axisLabelVisibility([], LABEL_GAP)) === '[]');
}

console.log(failed ? `\n${failed} assertion(s) failed` : '\nAll chart-axis assertions passed');
process.exit(failed ? 1 : 0);
