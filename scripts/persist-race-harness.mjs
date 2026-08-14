/**
 * Persist-ordering harness. Proves the serial write queue behind `clientRepository.save` applies
 * snapshots in the order they were ISSUED, not the order their underlying writes happen to finish.
 *
 * The real sequence this guards: signing a note persists twice in one tick — first the pending
 * section edit, then the sign-off. On native each save ends in an independent
 * `FS.writeAsStringAsync` to the same file, so if the slower earlier write lands last the SIGNATURE
 * IS LOST on next launch while the running app still shows the note signed.
 *
 * Run (Node ≥ 22.13, e.g. ~/.cache/fm-node/node-v22.23.2-darwin-arm64/bin/node):
 *   node --experimental-strip-types scripts/persist-race-harness.mjs
 * Exits non-zero on the first failed assertion.
 */
import { createWriteQueue } from '../src/services/writeQueue.ts';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failed = 0;
function check(name, ok, detail) {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (${detail})`}`);
}

/** A stand-in for the device file: last writer wins, exactly like FS.writeAsStringAsync. */
function makeStore() {
  const store = { value: null, order: [] };
  return {
    store,
    write: async (value, delayMs) => {
      await sleep(delayMs);
      store.value = value;
      store.order.push(value);
    },
  };
}

// --- 1. Out-of-order completion must NOT reorder the writes -------------------------------------
{
  const { store, write } = makeStore();
  const enqueue = createWriteQueue();
  // A: the flushed section edit, whose write is slow. B: the sign-off, whose write is fast.
  const a = enqueue(() => write('edit', 40));
  const b = enqueue(() => write('edit+signature', 0));
  await Promise.all([a, b]);
  check('signature is not lost when the earlier write is slower', store.value === 'edit+signature', `final=${store.value}`);
  check('writes apply in enqueue order', store.order.join(' → ') === 'edit → edit+signature', store.order.join(' → '));
}

// --- 2. Unqueued writes DO reorder — the failure this queue exists to prevent --------------------
{
  const { store, write } = makeStore();
  await Promise.all([write('edit', 40), write('edit+signature', 0)]);
  check('control: without the queue the stale snapshot lands last', store.value === 'edit', `final=${store.value}`);
}

// --- 3. Ordering holds across many interleaved writes -------------------------------------------
{
  const { store, write } = makeStore();
  const enqueue = createWriteQueue();
  const delays = [30, 0, 20, 5, 0, 15];
  await Promise.all(delays.map((d, i) => enqueue(() => write(`v${i}`, d))));
  check('final state is the last enqueued snapshot', store.value === 'v5', `final=${store.value}`);
  check('every write applied in enqueue order', store.order.join(',') === 'v0,v1,v2,v3,v4,v5', store.order.join(','));
}

// --- 4. A failed write must not stall or reorder the queue --------------------------------------
{
  const { store, write } = makeStore();
  const enqueue = createWriteQueue();
  const boom = enqueue(async () => {
    await sleep(10);
    throw new Error('disk full');
  });
  const after = enqueue(() => write('edit+signature', 0));
  const rejected = await boom.then(() => false, () => true);
  await after;
  check('a rejected write surfaces to its caller', rejected, 'expected rejection');
  check('a rejected write does not stall the queue', store.value === 'edit+signature', `final=${store.value}`);
}

console.log(`\n${failed === 0 ? 'all checks passed' : `${failed} assertion(s) failed`}`);
if (failed) process.exit(1);
