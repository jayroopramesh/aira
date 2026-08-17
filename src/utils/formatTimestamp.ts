/**
 * "13 Aug 14:18" — a real clock moment (F8 sign-off attestation, the append-recording divider),
 * never a hardcoded/relative timestamp. Shared so every place that stamps a moment onto persisted
 * clinical data formats it identically.
 */
export function formatTimestamp(d: Date): string {
  const date = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} ${time}`;
}
