import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { BackLink, PageHeader, Screen } from '../../../components/Screen';
import { ClientNotFound } from '../../../components/ClientNotFound';
import { Highlights } from '../../../components/Highlights';
import { ArrowRight } from '../../../components/icons';
import { Button, Card, Eyebrow } from '../../../components/ui';
import { useClient, useClientNotes } from '../../../data/DataProvider';
import { lastPlanProvenance } from '../../../data/sessionClient';
import { useTheme } from '../../../theme/ThemeProvider';

/**
 * Prep reminder (round-2 change #2). Read-only highlights drawn from the last captured plan —
 * a gentle reminder of "what's worth carrying in", NOT a checklist. No checkboxes, no
 * counter, no "mark all done": prep is something the clinician reads, not ticks off.
 */
export default function PrepReminder() {
  const router = useRouter();
  const c = useTheme().colors;
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const client = useClient(clientId);
  const notes = useClientNotes(clientId);

  if (!client) return <ClientNotFound />;
  // Same honesty rule as the client drawer's plan caption: "signed" is read off the note behind the
  // plan, never asserted — a freshly captured plan comes from a draft nobody has signed yet, and this
  // subtitle used to call that "the last signed plan".
  const plan = lastPlanProvenance(client, notes);
  const planPhrase =
    plan.status === 'signed'
      ? `the last signed plan (${plan.dateLabel})`
      : plan.status === 'draft'
        ? `the plan in the latest note (${plan.dateLabel}), still an unsigned draft`
        : `the last session’s plan${plan.dateLabel ? ` (${plan.dateLabel})` : ''}`;

  return (
    <Screen maxWidth={760}>
      <BackLink label={`Back to ${client.name.split(' ')[0]}’s file`} onPress={() => router.replace(`/(app)/today/${client.id}`)} />
      <PageHeader
        eyebrow={`Prep · ${client.name} · 10:30`}
        title="Get ready for this session"
        subtitle={`A gentle reminder drawn from ${planPhrase}. Nothing to tick off, just what's worth carrying in.`}
      />

      <Card>
        <Eyebrow>Reminders from last session</Eyebrow>
        <View style={{ height: 14 }} />
        <Highlights items={client.lastPlan.map((p) => ({ text: p.text, source: p.source }))} />
        <View style={{ height: 20 }} />
        <View style={{ alignItems: 'flex-end' }}>
          <Button
            title="I’m ready"
            variant="primary"
            rightIcon={<ArrowRight size={18} color={c.onBrand} />}
            onPress={() => router.push(`/(app)/today/ready?clientId=${client.id}`)}
          />
        </View>
      </Card>
    </Screen>
  );
}
