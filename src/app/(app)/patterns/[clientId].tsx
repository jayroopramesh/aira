import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { BackLink, Screen } from '../../../components/Screen';
import { useEscalate } from '../../../components/Escalate';
import { BandedChart, DotStrip, ScaleChart } from '../../../components/charts';
import { ArrowRight, PhoneIcon, ShieldIcon } from '../../../components/icons';
import { AppText, Avatar, Button, Card, Chip, Eyebrow, Row, RiskDot, TrustPill } from '../../../components/ui';
import { AMARA_SCALES } from '../../../data/scales';
import { useClient } from '../../../data/DataProvider';
import { Client } from '../../../data/types';
import { useTheme } from '../../../theme/ThemeProvider';

export default function ClientPatterns() {
  const { clientId, risk } = useLocalSearchParams<{ clientId: string; risk?: string }>();
  const client = useClient(clientId);
  if (!client) return null;
  const showRisk = risk === '1' || client.risk === 'acute';
  return showRisk && client.safety ? <RiskReview clientId={client.id} /> : <PatternsView clientId={client.id} />;
}

/**
 * Sparse patterns state for a freshly-captured client with no assessment series yet. Honours the
 * sparse-series rule (no trend line before there are readings) and points at what does exist.
 */
function NoReadingsYet({ client }: { client: Client }) {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  return (
    <Screen>
      <BackLink label="Back to caseload" onPress={() => router.replace('/(app)/patterns')} />
      <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: theme.spacing.sm }}>
        <Row gap={14} style={{ flex: 1, minWidth: 220 }}>
          <Avatar initials={client.initials} size={52} />
          <View style={{ flex: 1 }}>
            <AppText variant="h1">{client.name}</AppText>
            <AppText variant="small" color="ink3" style={{ marginTop: 4 }}>
              ID {client.tokenId} · client since {client.clientSince}
            </AppText>
          </View>
        </Row>
        {/* A freshly-captured client's signed note is only reachable through here (F5) — the sparse
            state must still surface the session-history door, not just the full patterns view. */}
        <Pressable onPress={() => router.push(`/(app)/patterns/history?clientId=${client.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
          <Card elevation="sm" padded={false} radius="sm" style={{ paddingVertical: 10, paddingHorizontal: 16 }}>
            <Row gap={8}>
              <AppText variant="bodyStrong">Session history</AppText>
              <ArrowRight size={16} color={c.ink} />
            </Row>
          </Card>
        </Pressable>
      </Row>
      <View style={{ height: theme.spacing.lg }} />
      <Card tone="sunken" elevation="none" radius="lg" style={{ backgroundColor: c.brandBg, borderColor: c.brandBd }}>
        <Eyebrow color="brand">Patterns</Eyebrow>
        <AppText variant="h2" style={{ marginTop: 8 }}>
          Not enough readings yet
        </AppText>
        <AppText variant="body" color="ink2" style={{ marginTop: 8, lineHeight: 22 }}>
          Trends appear once this client has a few scored sessions. A single visit is shown as a point, never a
          trend line — the shape only means something with readings behind it.
        </AppText>
        {client.lastPlan.length ? (
          <>
            <View style={{ height: theme.spacing.md }} />
            <Eyebrow>From the last session</Eyebrow>
            <View style={{ height: 8 }} />
            {client.lastPlan.map((p) => (
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
    </Screen>
  );
}

/* --------------------------------------------------------- patterns view --- */

function PatternsView({ clientId }: { clientId: string }) {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const client = useClient(clientId);
  const [range, setRange] = useState('6m');
  const phq = client?.measures.find((m) => m.key === 'phq9');
  const sleep = client?.measures.find((m) => m.key === 'sleep');

  if (!client) return null;
  // A freshly-captured client has no assessment series yet — respect the sparse-series rule.
  if (!phq) return <NoReadingsYet client={client} />;

  const headline =
    clientId === 'amara'
      ? 'Amara’s depression has more than halved since January — PHQ-9 fell from 18 to 9 across four visits — with the steepest drop after sleep became the focus. Anxiety is following the same path.'
      : `${client.name.split(' ')[0]}’s PHQ-9 latest reading is ${phq.latest}${phq.deltaSinceStart ? `, ${phq.deltaSinceStart < 0 ? 'down' : 'up'} ${Math.abs(phq.deltaSinceStart)} since intake` : ''}.`;

  return (
    <Screen>
      <BackLink label="Back to caseload" onPress={() => router.replace('/(app)/patterns')} />

      <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <Row gap={14} style={{ flex: 1, minWidth: 260 }}>
          <Avatar initials={client.initials} size={52} />
          <View>
            <AppText variant="h1">{client.name}</AppText>
            <Row gap={8} style={{ marginTop: 4, flexWrap: 'wrap' }}>
              <AppText variant="small" color="ink3">
                ID {client.tokenId} · {client.age ?? '—'} · client since {client.clientSince}
              </AppText>
              <RiskDot level={client.risk} />
            </Row>
          </View>
        </Row>
        <Pressable onPress={() => router.push(`/(app)/patterns/history?clientId=${client.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
          <Card elevation="sm" padded={false} radius="sm" style={{ paddingVertical: 10, paddingHorizontal: 16 }}>
            <Row gap={8}>
              <AppText variant="bodyStrong">Session history</AppText>
              <ArrowRight size={16} color={c.ink} />
            </Row>
          </Card>
        </Pressable>
      </Row>

      {/* Plain-language headline FIRST — before any chart (stoic. pattern). */}
      <Card tone="sunken" elevation="none" radius="lg" style={{ marginTop: theme.spacing.lg, backgroundColor: c.brandBg, borderColor: c.brandBd }}>
        <Eyebrow color="brand">Read this first</Eyebrow>
        <AppText variant="h2" style={{ marginTop: 10, lineHeight: 27 }}>
          {headline}
        </AppText>
      </Card>

      <View style={{ height: theme.spacing.lg }} />
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: theme.spacing.lg, alignItems: 'flex-start' }}>
        {/* Assessment-scale chart. Amara carries the full multi-scale set (PHQ-9 · GAD-7 · MHI-5 ·
            DASS-21) as tabs; each scale keeps the sparse ≤2-reading rule (MHI-5 → dot-strip). */}
        {clientId === 'amara' ? (
          <View style={{ flex: wide ? 1.3 : undefined, width: '100%' }}>
            <ScaleCard clientLabel={client.name.split(' ')[0]} />
          </View>
        ) : (
          <Card style={{ flex: wide ? 1.3 : undefined, width: '100%' }}>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <AppText variant="h2">PHQ-9 over time</AppText>
              <Row gap={8}>
                {['3m', '6m', '1y'].map((r) => (
                  <Chip key={r} label={r} active={range === r} onPress={() => setRange(r)} />
                ))}
              </Row>
            </Row>
            <AppText variant="body" color="ink2" style={{ marginTop: 8 }}>
              {phq.readings[0].value} → {phq.latest} across {phq.readings.length} visits · now in the{' '}
              <AppText variant="bodyStrong">{phq.band}</AppText> band, down from moderate-severe at intake.
            </AppText>
            <View style={{ height: 14 }} />
            <BandedChart readings={phq.readings} />
          </Card>
        )}

        {/* Sleep sparse dot-strip + naturalistic block */}
        <View style={{ flex: wide ? 1 : undefined, width: '100%', gap: theme.spacing.lg }}>
          {sleep ? (
            <Card>
              <AppText variant="h2">Sleep (self-report)</AppText>
              <AppText variant="body" color="ink2" style={{ marginTop: 8 }}>
                Only <AppText variant="bodyStrong">{sleep.readings.length} readings</AppText> logged so far — shown as points, not a trend.
              </AppText>
              <View style={{ height: 14 }} />
              <DotStrip readings={sleep.readings} unit="h" />
              <AppText variant="small" color="ink3" style={{ marginTop: 12 }}>
                {sleep.readings.length} readings — not enough for a trend yet.
              </AppText>
            </Card>
          ) : null}

          {client.naturalistic ? (
            <Card tone="sunken" elevation="none" style={{ backgroundColor: c.sand, borderColor: c.sandBd }}>
              <AppText variant="bodyStrong" tint={c.accent}>
                On her mind — not on your report
              </AppText>
              <AppText variant="body" color="ink2" style={{ marginTop: 8 }}>
                From {client.name.split(' ')[0]}’s <AppText variant="bodyStrong" color="ink2">companion app</AppText> — journal entries she chooses to share. Unsigned · self-reported · never blended with clinical scores.
              </AppText>
              {client.naturalistic.map((n, i) => (
                <View key={i} style={{ marginTop: 14 }}>
                  <AppText variant="small" color="ink3">
                    {n.date}
                  </AppText>
                  <AppText variant="body" color="ink" style={{ marginTop: 4 }}>
                    {n.body}
                  </AppText>
                </View>
              ))}
            </Card>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

/**
 * The multi-scale chart card. Scale tabs above the plot swap the data, severity bands, and the
 * plain-language headline in place; the sparse ≤2-reading rule is kept per scale.
 */
function ScaleCard({ clientLabel }: { clientLabel: string }) {
  const theme = useTheme();
  const c = theme.colors;
  const [key, setKey] = useState('PHQ-9');
  const scale = AMARA_SCALES.find((s) => s.key === key) ?? AMARA_SCALES[0];

  return (
    <Card style={{ width: '100%' }}>
      {/* Scale tabs */}
      <Row gap={6} style={{ flexWrap: 'wrap' }}>
        {AMARA_SCALES.map((s) => (
          <Chip key={s.key} label={s.key} active={s.key === key} onPress={() => setKey(s.key)} />
        ))}
      </Row>
      <View style={{ height: 12 }} />
      <Row gap={8} style={{ alignItems: 'baseline', flexWrap: 'wrap' }}>
        <AppText variant="h2">{scale.key} over time</AppText>
        {scale.sub ? (
          <AppText variant="small" color="ink3">
            {scale.sub}
          </AppText>
        ) : null}
      </Row>
      {/* Plain-language, headline-first reading for this scale. */}
      <AppText variant="body" color="ink2" style={{ marginTop: 8, lineHeight: 22 }}>
        {scale.read}
      </AppText>
      <View style={{ height: 14 }} />
      <ScaleChart scale={scale} clientLabel={clientLabel} />
    </Card>
  );
}

/* ------------------------------------------------------------ risk review --- */

function RiskReview({ clientId }: { clientId: string }) {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const escalate = useEscalate();
  const client = useClient(clientId);
  if (!client?.safety) return null;
  const safety = client.safety;

  return (
    <Screen maxWidth={860}>
      <BackLink label="Back to caseload" onPress={() => router.replace('/(app)/patterns')} />

      <Row gap={14} style={{ flexWrap: 'wrap' }}>
        <Avatar initials={client.initials} size={52} tone="risk" />
        <View style={{ flex: 1 }}>
          <AppText variant="h1">{client.name}</AppText>
          <Row gap={8} style={{ marginTop: 4, flexWrap: 'wrap' }}>
            <AppText variant="small" color="ink3">
              ID {client.tokenId} · {client.age ?? '—'} · Session {client.sessionNumber} · today 1:00
            </AppText>
            <TrustPill label="Re-identified locally" icon={<ShieldIcon size={12} color={c.brand} />} />
          </Row>
        </View>
      </Row>

      {/* Acute banner — clay, calm, the literal word "review". Never alarm-red, never modal. */}
      <Card tone="elevated" elevation="none" radius="lg" style={{ marginTop: theme.spacing.lg, backgroundColor: c.riskBg, borderColor: c.riskBg }}>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <Row gap={10}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.riskFill }} />
            <AppText variant="h2" tint={c.risk}>
              {safety.headline}
            </AppText>
          </Row>
          {safety.item9Positive ? (
            <AppText variant="small" tint={c.risk}>
              PHQ-9 item 9 positive
            </AppText>
          ) : null}
        </Row>
        <AppText variant="body" color="ink" style={{ marginTop: 12, lineHeight: 23 }}>
          {safety.detail}
        </AppText>
      </Card>

      {/* Safety snapshot */}
      <Card style={{ marginTop: theme.spacing.lg }}>
        <Eyebrow>Safety snapshot</Eyebrow>
        <Row gap={12} wrap style={{ marginTop: 12 }}>
          {safety.snapshot.map((s) => (
            <Card key={s.label} tone="elevated" elevation="none" radius="md" style={{ flex: 1, minWidth: 150, borderColor: c.line }}>
              <AppText variant="small" color="ink3">
                {s.label}
              </AppText>
              <AppText variant="display" tint={s.tone === 'risk' ? c.risk : c.ink} style={{ fontSize: 26, lineHeight: 28, marginTop: 6 }}>
                {s.value}
              </AppText>
              <AppText variant="small" tint={s.tone === 'positive' ? c.positive : s.tone === 'risk' ? c.risk : c.ink3} style={{ marginTop: 4 }}>
                {s.sub}
              </AppText>
            </Card>
          ))}
        </Row>
      </Card>

      {/* Last risk note */}
      <Card style={{ marginTop: theme.spacing.lg }}>
        <Eyebrow>Last risk note · {safety.lastRiskNoteDate}, signed</Eyebrow>
        <AppText variant="body" color="ink" style={{ marginTop: 10, lineHeight: 23 }}>
          {safety.lastRiskNote}
        </AppText>
      </Card>

      <View style={{ height: theme.spacing.lg }} />
      <Row gap={12} wrap>
        <Button title="Open escalation options" variant="danger" leftIcon={<PhoneIcon size={18} color={c.risk} />} onPress={escalate.open} />
        <Button title="Review safety plan" variant="secondary" onPress={() => {}} />
        <Button title="See history" variant="secondary" onPress={() => router.push(`/(app)/patterns/history?clientId=${client.id}`)} />
      </Row>
      <AppText variant="small" color="ink3" style={{ marginTop: 14 }}>
        The same standing Escalate affordance sits top-right on every screen — this review state just brings the details forward.
      </AppText>
    </Screen>
  );
}
