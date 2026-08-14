/**
 * A minimal serial queue for persistence writes.
 *
 * Storage writes must land in the order they were ISSUED, not the order they happen to finish.
 * A screen can persist twice in one tick — a pending note edit, then the sign-off — and on native
 * each write is an independent `FS.writeAsStringAsync` to the same file, so two writes started
 * microseconds apart have no completion-order guarantee. If the older snapshot lands last, the
 * signature is gone on next launch while the running app still shows it applied.
 *
 * Enqueue order is fixed synchronously at call time, and each task starts only after the previous
 * one settles. A failing task never stalls the queue: the tail swallows its rejection, while the
 * caller still sees it.
 *
 * Deliberately dependency-free (no expo/react-native imports) so it can be exercised directly.
 */
export function createWriteQueue(): <T>(task: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = tail.then(task, task);
    tail = run.catch(() => undefined);
    return run;
  };
}
