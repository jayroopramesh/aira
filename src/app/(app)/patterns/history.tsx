import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { BackLink, PageHeader, Screen } from '../../../components/Screen';
import { HistoryTimeline } from '../../../components/clinical';
import { CLIENTS_BY_ID } from '../../../data/fixtures';

/** Chronological session-history timeline — typed feed, types never blurred. */
export default function SessionHistory() {
  const router = useRouter();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const client = CLIENTS_BY_ID[clientId ?? 'amara'];
  if (!client) return null;

  return (
    <Screen maxWidth={820}>
      <BackLink label={`Back to ${client.name.split(' ')[0]}’s patterns`} onPress={() => router.back()} />
      <PageHeader
        eyebrow={`${client.name} · chronological`}
        title="Session history"
        subtitle="Signed clinical notes, screenings, and naturalistic entries — each labelled by type, never blurred."
      />
      <HistoryTimeline entries={client.timeline} cards />
    </Screen>
  );
}
