import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { PageHeader, Screen } from '../../../components/Screen';
import { ArrowRight, ChevronRight } from '../../../components/icons';
import { AppText, Avatar, Badge, Card, Divider, Eyebrow, RiskDot, Row } from '../../../components/ui';
import { ZeroState } from '../../../components/ZeroState';
import { useClient, useData, useDayDashboard } from '../../../data/DataProvider';
import { ScheduleEntry } from '../../../data/types';
import { useTheme } from '../../../theme/ThemeProvider';

export default function TodayDashboard() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const d = useDayDashboard();
  const { loadSample } = useData();
  const nextClient = useClient(d?.nextClientId);

  if (!d) {
    return (
      <Screen>
        <PageHeader eyebrow="Get ready" title="Your day, when it starts" subtitle="Nothing is scheduled yet." />
        <ZeroState
          mood="encouraging"
          title="No sessions scheduled"
          body="When you have clients, today's sessions and a calm countdown show up here. Capture a session to begin, or load the sample cohort to see a full day."
          primary={{ label: 'Start a session', onPress: () => router.push('/(app)/session') }}
          secondary={{ label: 'Load sample data', onPress: () => void loadSample() }}
          note="Everything stays on this device — nothing is synced to a server."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader eyebrow={d.dateLabel} title="Get ready for your next" subtitle={d.subtitle} />

      {/* Countdown banner over today's sessions (Lyssna/Heidi pattern). */}
      <Card elevation="md" radius="lg" style={{ backgroundColor: c.brandStrong, borderColor: 'transparent', padding: theme.spacing.xl }}>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <Row gap={18} style={{ flex: 1, minWidth: 260 }}>
            <View>
              <Eyebrow color="onBrand">Next session in</Eyebrow>
              <Row gap={4} style={{ alignItems: 'flex-end' }}>
                <AppText variant="display" tint={c.onBrand} style={{ fontSize: 40, lineHeight: 42 }}>
                  {d.nextInMinutes}
                </AppText>
                <AppText variant="body" tint="onBrand" style={{ opacity: 0.85, marginBottom: 6 }}>
                  min
                </AppText>
              </Row>
            </View>
            <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.16)' }} />
            <View style={{ flex: 1 }}>
              <AppText variant="small" tint={c.onBrand} style={{ opacity: 0.85 }}>
                {nextClient?.summaryLine.includes('Session') ? '10:30 · INDIVIDUAL' : ''}
              </AppText>
              <AppText variant="h2" tint={c.onBrand}>
                {nextClient?.name ?? 'Your next client'}
              </AppText>
              <AppText variant="small" tint={c.onBrand} style={{ opacity: 0.85, marginTop: 2 }}>
                Session 5 · academic anxiety, sleep · PHQ-9 trending down
              </AppText>
            </View>
          </Row>
          <Pressable
            onPress={() => router.push(`/(app)/today/${d.nextClientId}`)}
            style={({ pressed }) => ({
              alignSelf: 'center',
              backgroundColor: 'rgba(255,255,255,0.14)',
              borderRadius: theme.radii.xs,
              paddingVertical: 12,
              paddingHorizontal: 18,
              opacity: pressed ? 0.82 : 1,
            })}
          >
            <Row gap={8}>
              <AppText variant="bodyStrong" tint={c.onBrand}>
                Review & prep
              </AppText>
              <ArrowRight size={18} color={c.onBrand} />
            </Row>
          </Pressable>
        </Row>
      </Card>

      <View style={{ height: theme.spacing.xl }} />

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: theme.spacing.xl, alignItems: 'flex-start' }}>
        {/* Today's sessions */}
        <View style={{ flex: wide ? 2 : undefined, width: '100%', gap: 12 }}>
          <Eyebrow>Today’s sessions</Eyebrow>
          {d.schedule.map((s) => (
            <SessionCard key={s.clientId} entry={s} onPress={() => router.push(`/(app)/today/${s.clientId}`)} />
          ))}
        </View>

        {/* Day at a glance + standing safety */}
        <View style={{ flex: wide ? 1 : undefined, width: '100%', gap: theme.spacing.md }}>
          <Card>
            <AppText variant="h2">Your day at a glance</AppText>
            <AppText variant="small" color="ink3" style={{ marginTop: 4 }}>
              On-device summary · nothing synced to a server
            </AppText>
            <View style={{ height: 12 }} />
            {d.glance.map((g, i) => (
              <View key={g.label}>
                {i > 0 && <Divider />}
                <Row style={{ justifyContent: 'space-between', paddingVertical: 12 }}>
                  <AppText variant="body" color="ink2">
                    {g.label}
                  </AppText>
                  <AppText variant="h2" tint={g.tone === 'risk' ? c.risk : c.ink}>
                    {g.value}
                  </AppText>
                </Row>
              </View>
            ))}
          </Card>

          <Card>
            <AppText variant="h2">Standing safety</AppText>
            <AppText variant="small" color="ink3" style={{ marginTop: 4 }}>
              Escalation is always one tap away, top-right.
            </AppText>
            <Row gap={8} style={{ marginTop: 14, marginBottom: 12 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.riskFill }} />
              <AppText variant="bodyStrong" tint={c.risk}>
                {d.standingSafety.note}
              </AppText>
            </Row>
            <Pressable
              onPress={() => router.push(`/(app)/patterns/${d.standingSafety.clientId}?risk=1`)}
              style={({ pressed }) => ({
                backgroundColor: c.elevated,
                borderWidth: 1,
                borderColor: c.line,
                borderRadius: theme.radii.xs,
                paddingVertical: 12,
                alignItems: 'center',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <AppText variant="bodyStrong">Open safety review →</AppText>
            </Pressable>
          </Card>
        </View>
      </View>
    </Screen>
  );
}

function SessionCard({ entry, onPress }: { entry: ScheduleEntry; onPress: () => void }) {
  const theme = useTheme();
  const c = theme.colors;
  const client = useClient(entry.clientId);
  if (!client) return null;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
      <Card elevation="sm" padded={false} style={{ padding: theme.spacing.md }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={14} style={{ flex: 1 }}>
            <View style={{ alignItems: 'center', width: 54 }}>
              <AppText variant="bodyStrong" style={{ fontSize: 16 }}>
                {entry.time}
              </AppText>
              <AppText variant="small" color="ink3" style={{ fontSize: 11 }}>
                {entry.meridiem}
              </AppText>
              <AppText variant="small" color="ink3" style={{ fontSize: 11, marginTop: 2 }}>
                {entry.durationMin} min
              </AppText>
            </View>
            <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: c.lineSoft }} />
            <Avatar initials={client.initials} size={40} tone={client.risk === 'acute' ? 'risk' : 'brand'} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong" style={{ fontSize: 16 }}>
                {client.name}
              </AppText>
              <AppText variant="small" color="ink3" style={{ marginTop: 2 }}>
                {entry.kind} · {entry.sessionLabel}
              </AppText>
              <Row gap={8} wrap style={{ marginTop: 8 }}>
                {client.focusTags.map((t) => (
                  <Badge key={t} label={t} tone="neutral" />
                ))}
                <RiskDot level={client.risk} />
              </Row>
            </View>
          </Row>
          <Row gap={10}>
            <View style={{ backgroundColor: c.brandBg, borderRadius: theme.radii.pill, paddingVertical: 6, paddingHorizontal: 12 }}>
              <AppText variant="small" tint={c.brand} style={{ fontSize: 12.5 }}>
                {entry.prepCount} prep item{entry.prepCount === 1 ? '' : 's'}
              </AppText>
            </View>
            <ChevronRight size={20} color={c.ink3} />
          </Row>
        </Row>
      </Card>
    </Pressable>
  );
}
