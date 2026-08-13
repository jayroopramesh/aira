import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Linking, View } from 'react-native';
import { BackLink, PageHeader, Screen } from '../../../components/Screen';
import { useEscalate } from '../../../components/Escalate';
import { PhoneIcon, ShieldIcon } from '../../../components/icons';
import { AppText, Avatar, Button, Card, Eyebrow, Row } from '../../../components/ui';
import { crisisLine } from '../../../config/env';
import { useClient } from '../../../data/DataProvider';
import { useTheme } from '../../../theme/ThemeProvider';

/**
 * Safety-plan viewer (F6/F7). An HONEST read of the safety information already on file for a client —
 * it shows only what exists (the last signed risk note, the safety-plan status, standing safety
 * prep items) and says so plainly when there is no safety plan yet, rather than rendering a
 * fabricated plan. The standing Escalate affordance is one tap away throughout.
 */
export default function SafetyPlan() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const escalate = useEscalate();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const client = useClient(clientId);

  if (!client) {
    // No client referent (e.g. reached without one) — say so honestly, don't invent a plan.
    return (
      <Screen maxWidth={760}>
        <BackLink label="Back" onPress={() => router.back()} />
        <PageHeader
          eyebrow="Safety plan"
          title="Open a client to see their safety plan"
          subtitle="A safety plan belongs to a specific client. Open a client from the caseload, then choose “Review safety plan”."
        />
      </Screen>
    );
  }

  const safety = client.safety;
  // Standing safety prep items carried on the client (e.g. "Review safety plan and trusted-contact status").
  const safetyPlanItems = client.lastPlan.filter((p) => /safety|risk|contact|c-ssrs|coping/i.test(`${p.text} ${p.source}`));

  return (
    <Screen maxWidth={760}>
      <BackLink label={`Back to ${client.name.split(' ')[0]}’s review`} onPress={() => router.back()} />

      <Row gap={14} style={{ marginTop: theme.spacing.sm }}>
        <Avatar initials={client.initials} size={52} tone={client.risk === 'acute' ? 'risk' : 'brand'} />
        <View style={{ flex: 1 }}>
          <AppText variant="h1">{client.name}</AppText>
          <AppText variant="small" color="ink3" style={{ marginTop: 4 }}>
            Safety plan · ID {client.tokenId}
          </AppText>
        </View>
      </Row>

      <View style={{ height: theme.spacing.lg }} />

      {safety ? (
        <>
          {/* Safety-plan status — read straight from the risk snapshot, no invented fields. */}
          <Card tone="elevated" elevation="none" radius="lg" style={{ backgroundColor: c.riskBg, borderColor: c.riskBg }}>
            <Eyebrow color="risk">Safety plan on file</Eyebrow>
            {safety.snapshot
              .filter((s) => /safety plan/i.test(s.label))
              .map((s) => (
                <AppText key={s.label} variant="h2" tint={c.risk} style={{ marginTop: 8 }}>
                  {s.value} · {s.sub}
                </AppText>
              ))}
            <AppText variant="body" color="ink" style={{ marginTop: 10, lineHeight: 23 }}>
              {safety.detail}
            </AppText>
          </Card>

          {/* The last signed risk note carries the actual coping steps / trusted-contact detail. */}
          <Card style={{ marginTop: theme.spacing.lg }}>
            <Eyebrow>Last risk note · {safety.lastRiskNoteDate}, signed</Eyebrow>
            <AppText variant="body" color="ink" style={{ marginTop: 10, lineHeight: 23 }}>
              {safety.lastRiskNote}
            </AppText>
            <AppText variant="small" color="ink3" style={{ marginTop: 12, lineHeight: 17 }}>
              Coping steps and trusted-contact detail live in the signed risk notes above — Aira never
              summarises a safety plan into anything you didn’t write and sign.
            </AppText>
          </Card>
        </>
      ) : (
        // No structured safety plan yet — be honest rather than showing an empty or invented one.
        <Card tone="sunken" elevation="none" radius="lg" style={{ backgroundColor: c.brandBg, borderColor: c.brandBd }}>
          <Eyebrow color="brand">Safety plan</Eyebrow>
          <AppText variant="h2" style={{ marginTop: 8 }}>
            No safety plan on file yet
          </AppText>
          <AppText variant="body" color="ink2" style={{ marginTop: 8, lineHeight: 22 }}>
            {client.name.split(' ')[0]} doesn’t have a completed safety plan recorded yet. When you complete
            one in a session — coping steps and a trusted contact — it’ll appear here alongside the signed
            risk note.
          </AppText>
          {safetyPlanItems.length ? (
            <>
              <View style={{ height: theme.spacing.md }} />
              <Eyebrow>Standing safety items</Eyebrow>
              <View style={{ height: 8 }} />
              {safetyPlanItems.map((p) => (
                <Row key={p.id} gap={8} style={{ alignItems: 'flex-start', marginBottom: 6 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.brand, marginTop: 7 }} />
                  <AppText variant="body" color="ink" style={{ flex: 1 }}>
                    {p.text}
                  </AppText>
                </Row>
              ))}
            </>
          ) : null}
        </Card>
      )}

      <View style={{ height: theme.spacing.lg }} />
      <Row gap={12} wrap>
        <Button
          title="Open escalation options"
          variant="danger"
          leftIcon={<PhoneIcon size={18} color={c.risk} />}
          onPress={() => escalate.open({ clientId: client.id })}
        />
        <Button
          title="Call the crisis line"
          variant="secondary"
          leftIcon={<PhoneIcon size={18} color={c.ink} />}
          onPress={() => Linking.openURL(crisisLine.tel).catch(() => {})}
        />
      </Row>
      <Row gap={7} style={{ marginTop: 14, alignItems: 'flex-start' }}>
        <View style={{ marginTop: 1 }}>
          <ShieldIcon size={14} color={c.brand} />
        </View>
        <AppText variant="small" color="ink3" style={{ flex: 1, lineHeight: 17 }}>
          Crisis line dials {crisisLine.display}
          {crisisLine.configured ? '' : ' — no dedicated crisis line is configured for this build'}.
        </AppText>
      </Row>
    </Screen>
  );
}
