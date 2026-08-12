import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HistoryTimeline, StatTile } from '../../../components/clinical';
import { ArrowRight, CloseIcon } from '../../../components/icons';
import { AppText, Avatar, Button, Card, Eyebrow, Row, TrustPill } from '../../../components/ui';
import { CLIENTS_BY_ID } from '../../../data/fixtures';
import { useTheme } from '../../../theme/ThemeProvider';

/**
 * In-place client drawer (Heidi/Time2book pattern): latest scores, history timeline, and
 * the last signed plan — which is explicitly flagged as becoming today's prep checklist.
 * Presented as a bottom sheet on phone / modal on web.
 */
export default function ClientDrawer() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const client = CLIENTS_BY_ID[clientId ?? 'amara'];

  if (!client) return null;

  const phq = client.measures.find((m) => m.key === 'phq9');
  const gad = client.measures.find((m) => m.key === 'gad7');
  const sleep = client.measures.find((m) => m.key === 'sleep');

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 120 }}>
        <View style={{ width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: theme.spacing.lg }}>
          {/* Header */}
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Row gap={14} style={{ flex: 1 }}>
              <Avatar initials={client.initials} size={52} tone={client.risk === 'acute' ? 'risk' : 'brand'} />
              <View style={{ flex: 1 }}>
                <AppText variant="h1" style={{ fontSize: 24 }}>
                  {client.name}
                </AppText>
                <AppText variant="small" color="ink3" style={{ marginTop: 2 }}>
                  ID {client.tokenId} · {client.age} · Session {client.sessionNumber} · client since {client.clientSince}
                </AppText>
              </View>
            </Row>
            <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Close" style={{ padding: 8 }}>
              <CloseIcon size={22} color={c.ink3} />
            </Pressable>
          </Row>

          {/* Latest scores */}
          <View style={{ height: theme.spacing.lg }} />
          <Eyebrow>Latest scores</Eyebrow>
          <Row gap={12} wrap style={{ marginTop: 10 }}>
            {phq ? <StatTile label="PHQ-9" value={String(phq.latest)} delta={`▼ ${Math.abs(phq.deltaSinceStart ?? 0)} since Jan`} /> : null}
            {gad ? <StatTile label="GAD-7" value={String(gad.latest)} delta={`▼ ${Math.abs(gad.deltaSinceStart ?? 0)} since Jan`} /> : null}
            {sleep ? <StatTile label="Sleep" value={String(sleep.latest)} unit="h" delta="▲ improving" deltaTone="caution" /> : null}
          </Row>

          {/* History timeline */}
          <View style={{ height: theme.spacing.xl }} />
          <Eyebrow>History timeline</Eyebrow>
          <View style={{ height: 12 }} />
          <HistoryTimeline entries={client.timeline} />

          {/* Last plan → becomes prep checklist */}
          <View style={{ height: theme.spacing.sm }} />
          <Eyebrow>Last plan &amp; next steps · from {client.lastPlan[0]?.source.replace('from Plan & Next Steps · ', '') ?? 'last session'}, signed</Eyebrow>
          <Card tone="sunken" elevation="none" radius="md" style={{ marginTop: 10, borderColor: c.brandBd, backgroundColor: c.brandBg }}>
            <AppText variant="bodyStrong" tint={c.brand}>
              This becomes today’s prep checklist ↓
            </AppText>
            <View style={{ height: 10 }} />
            {client.lastPlan.map((p) => (
              <Row key={p.id} gap={10} style={{ marginBottom: 10, alignItems: 'flex-start' }}>
                <View style={{ width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: c.brandBd, marginTop: 2 }} />
                <AppText variant="body" color="ink" style={{ flex: 1 }}>
                  {p.text}
                </AppText>
              </Row>
            ))}
          </Card>

          <View style={{ height: theme.spacing.lg }} />
          <TrustPill label="Re-identified locally · nothing synced to a server" />
        </View>
      </ScrollView>

      {/* Sticky footer */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: c.elevated,
          borderTopWidth: 1,
          borderTopColor: c.line,
          paddingTop: 12,
          paddingBottom: insets.bottom + 12,
          paddingHorizontal: theme.spacing.lg,
        }}
      >
        <Row gap={12} style={{ maxWidth: 720, width: '100%', alignSelf: 'center', justifyContent: 'flex-end' }}>
          <Button title="Close" variant="secondary" onPress={() => router.back()} />
          <Button
            title="Build prep checklist"
            variant="primary"
            rightIcon={<ArrowRight size={18} color={c.onBrand} />}
            onPress={() => router.replace(`/(app)/today/prep?clientId=${client.id}`)}
          />
        </Row>
      </View>
    </View>
  );
}
