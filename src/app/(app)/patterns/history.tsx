import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';
import { BackLink, PageHeader, Screen } from '../../../components/Screen';
import { ClientLink } from '../../../components/ClientLink';
import { ClientNotFound } from '../../../components/ClientNotFound';
import { HistoryTimeline } from '../../../components/clinical';
import { AppText, Badge, Card, Eyebrow, Row } from '../../../components/ui';
import { useClient, useClientNotes } from '../../../data/DataProvider';
import { MAX_NOTES_PER_CLIENT } from '../../../data/repository';
import { useTheme } from '../../../theme/ThemeProvider';

/** Chronological session-history timeline — typed feed, types never blurred. */
export default function SessionHistory() {
  const theme = useTheme();
  const router = useRouter();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const client = useClient(clientId);
  if (!client) return <ClientNotFound />;

  return (
    <Screen maxWidth={820}>
      <BackLink label={`Back to ${client.name.split(' ')[0]}’s patterns`} onPress={() => router.back()} />
      <ClientLink client={client} avatarSize={36} gap={10} style={{ marginBottom: theme.spacing.sm }}>
        <AppText variant="bodyStrong">{client.name}</AppText>
      </ClientLink>
      <PageHeader
        eyebrow={`${client.name} · chronological`}
        title="Session history"
        subtitle="Signed clinical notes, screenings, and naturalistic entries — each labelled by type, never blurred."
      />
      <RetainedNotes clientId={client.id} />
      <HistoryTimeline entries={client.timeline} cards />
    </Screen>
  );
}

/**
 * The client's retained note text (up to MAX_NOTES_PER_CLIENT, newest first — C4). The timeline below
 * summarises what happened; these open the full note and its sign-off, which otherwise have no entry
 * point once the post-capture review screen is left (F5).
 */
function RetainedNotes({ clientId }: { clientId: string }) {
  const theme = useTheme();
  const router = useRouter();
  const notes = useClientNotes(clientId);
  if (!notes.length) return null;

  return (
    <View style={{ marginBottom: theme.spacing.lg }}>
      <Eyebrow>Session notes</Eyebrow>
      <View style={{ height: 10 }} />
      {notes.map((n, i) => (
        <Pressable
          key={i}
          onPress={() => router.push(`/(app)/session/review?clientId=${encodeURIComponent(clientId)}&note=${i}`)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${n.sessionLabel}`}
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <Card elevation="sm" radius="sm" style={{ marginBottom: 8 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText variant="bodyStrong">{n.sessionLabel}</AppText>
                <AppText variant="small" color="ink3" numberOfLines={1} style={{ marginTop: 4 }}>
                  {n.sourceLine}
                </AppText>
              </View>
              <Badge
                label={n.status === 'signed' ? `Signed${n.signedBy ? ` · ${n.signedBy}` : ''}` : 'Draft · review'}
                tone={n.status === 'signed' ? 'positive' : 'draft'}
              />
            </Row>
          </Card>
        </Pressable>
      ))}
      <AppText variant="small" color="ink3" style={{ marginTop: 2, fontSize: 11 }}>
        Up to {MAX_NOTES_PER_CLIENT} recent notes are kept per client, on this device.
      </AppText>
      <View style={{ height: theme.spacing.md }} />
    </View>
  );
}
