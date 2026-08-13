import { useRouter } from 'expo-router';
import React from 'react';
import { PageHeader, Screen } from './Screen';
import { Button } from './ui';

/**
 * Honest not-found state for a client route whose client no longer exists (N2) — e.g. the caseload
 * was cleared while a client detail route was still mounted. Without this the route rendered a blank
 * page with no way back; this gives a plain explanation and a route back to the caseload. No mascot:
 * this is reached from the caseload table, and the locked rule keeps the mascot off those surfaces.
 */
export function ClientNotFound() {
  const router = useRouter();
  return (
    <Screen maxWidth={640}>
      <PageHeader
        eyebrow="Caseload"
        title="This client isn’t in your caseload"
        subtitle="They may have been removed, or this link is stale. Nothing was lost — head back to your caseload to pick a client."
      />
      <Button title="Back to caseload" variant="primary" onPress={() => router.replace('/(app)/patterns')} />
    </Screen>
  );
}
