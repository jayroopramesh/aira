/**
 * Chart-range harness (fix-these #9). Proves the patterns screen's 3m/6m/1y range chips actually
 * filter the readings handed to the chart, rather than updating dead local state that nothing reads.
 *
 * Run (Node ≥ 22.13, e.g. ~/.cache/fm-node/node-v22.23.2-darwin-arm64/bin/node):
 *   node --experimental-strip-types scripts/chart-range-harness.mjs
 * Exits non-zero on the first failed assertion.
 */
import { filterReadingsByRange } from '../src/data/measureRange.ts';

let failed = 0;
function check(name, ok, detail) {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (${detail})`}`);
}

const reading = (date, value) => ({ date, label: date, value });

const READINGS = [
  reading('2026-01-12', 18),
  reading('2026-01-26', 17),
  reading('2026-02-09', 16),
  reading('2026-02-23', 15),
  reading('2026-03-08', 14),
  reading('2026-03-22', 13),
  reading('2026-04-05', 11),
  reading('2026-05-03', 10),
  reading('2026-08-12', 9),
];

const NOW = new Date('2026-08-17T00:00:00Z');

{
  const r = filterReadingsByRange(READINGS, '3m', NOW);
  check('3m keeps only readings within the last 3 months of now', r.every((x) => x.date >= '2026-05-17'), JSON.stringify(r.map((x) => x.date)));
  check('3m keeps the most recent reading', r.some((x) => x.date === '2026-08-12'), JSON.stringify(r.map((x) => x.date)));
  check('3m excludes readings older than 3 months', !r.some((x) => x.date === '2026-05-03'), JSON.stringify(r.map((x) => x.date)));
}

{
  const r = filterReadingsByRange(READINGS, '6m', NOW);
  check('6m keeps more readings than 3m for the same series', r.length > filterReadingsByRange(READINGS, '3m', NOW).length, `6m=${r.length}`);
  check('6m includes 5 Apr (within 6 months of 17 Aug)', r.some((x) => x.date === '2026-04-05'), JSON.stringify(r.map((x) => x.date)));
  check('6m excludes 12 Jan (over 6 months before 17 Aug)', !r.some((x) => x.date === '2026-01-12'), JSON.stringify(r.map((x) => x.date)));
}

{
  const r = filterReadingsByRange(READINGS, '1y', NOW);
  check('1y keeps every reading in this series (all within a year)', r.length === READINGS.length, `${r.length} of ${READINGS.length}`);
}

{
  // Switching ranges must actually change what's returned — the dead-control bug was that nothing
  // downstream of the chip ever varied by range at all.
  const a = filterReadingsByRange(READINGS, '3m', NOW).length;
  const b = filterReadingsByRange(READINGS, '6m', NOW).length;
  const c = filterReadingsByRange(READINGS, '1y', NOW).length;
  check('3m < 6m < 1y for a series spanning the full year', a < b && b < c, `3m=${a}, 6m=${b}, 1y=${c}`);
}

{
  // A window with nothing in it returns empty, not a crash or the full series.
  const r = filterReadingsByRange(READINGS, '3m', new Date('2026-01-13T00:00:00Z'));
  check('an empty window returns no readings', r.length === 1 && r[0].date === '2026-01-12', JSON.stringify(r.map((x) => x.date)));
}

console.log(failed ? `\n${failed} assertion(s) failed` : '\nAll chart-range assertions passed');
process.exit(failed ? 1 : 0);
