import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Pressable, useWindowDimensions, View } from 'react-native';
import { PageHeader, Screen } from '../../../components/Screen';
import { Sparkline } from '../../../components/charts';
import { HeartIcon, MailIcon, SearchIcon, SendIcon } from '../../../components/icons';
import { AppText, Avatar, Badge, Card, Chip, Eyebrow, Row, RiskDot } from '../../../components/ui';
import { CASELOAD_KPIS, CLIENTS } from '../../../data/fixtures';
import { Client } from '../../../data/types';
import { useTheme } from '../../../theme/ThemeProvider';

export default function Caseload() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 860;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'due' | 'risk'>('all');

  const filtered = CLIENTS.filter((cl) => {
    if (query && !cl.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === 'due') return cl.followUpDue;
    if (filter === 'risk') return cl.risk === 'acute' || cl.risk === 'elevated';
    return true;
  });

  return (
    <Screen>
      <PageHeader eyebrow="Caseload · 24 active clients" title="Patterns across your caseload" subtitle="Everything here is re-identified locally · nothing synced to a server" />

      {/* KPI tiles */}
      <Row gap={12} wrap>
        {CASELOAD_KPIS.map((k) => (
          <Card key={k.label} elevation="sm" radius="md" style={{ flex: 1, minWidth: 160 }}>
            <AppText variant="small" color="ink2">
              {k.label}
            </AppText>
            <Row gap={2} style={{ alignItems: 'flex-end', marginTop: 6 }}>
              <AppText variant="display" tint={k.tone === 'risk' ? c.risk : c.ink} style={{ fontSize: 30, lineHeight: 32 }}>
                {k.value}
              </AppText>
              {k.unit ? (
                <AppText variant="body" color="ink3" style={{ marginBottom: 4 }}>
                  {k.unit}
                </AppText>
              ) : null}
            </Row>
            <AppText variant="small" color="ink3" style={{ marginTop: 6 }}>
              {k.sub}
            </AppText>
          </Card>
        ))}
      </Row>

      {/* Search + filters */}
      <View style={{ height: theme.spacing.lg }} />
      <Row gap={12} wrap>
        <View style={{ flex: 1, minWidth: 220, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: c.elevated, borderWidth: 1, borderColor: c.line, borderRadius: theme.radii.sm, paddingHorizontal: 14 }}>
          <SearchIcon size={18} color={c.ink3} />
          <TextInputCompat value={query} onChangeText={setQuery} placeholder="Search caseload" />
        </View>
        <Chip label="All statuses" active={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="Follow-up due" active={filter === 'due'} onPress={() => setFilter('due')} />
        <Chip label="Risk" active={filter === 'risk'} onPress={() => setFilter('risk')} />
      </Row>

      {/* Clients table */}
      <View style={{ height: theme.spacing.lg }} />
      <Card padded={false} elevation="md">
        <Row style={{ justifyContent: 'space-between', padding: theme.spacing.lg }}>
          <AppText variant="h2">Clients</AppText>
          <View style={{ backgroundColor: c.elevated, borderWidth: 1, borderColor: c.line, borderRadius: theme.radii.pill, paddingVertical: 6, paddingHorizontal: 14 }}>
            <AppText variant="small" color="ink2">
              Sorted · follow-up due first
            </AppText>
          </View>
        </Row>

        {wide ? (
          <View>
            {/* header row */}
            <Row style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: 10, backgroundColor: c.sunken }}>
              <Eyebrow style={{ flex: 2.4 }}>Client</Eyebrow>
              <Eyebrow style={{ flex: 1.1 }}>Status</Eyebrow>
              <Eyebrow style={{ flex: 1.3 }}>Last session</Eyebrow>
              <Eyebrow style={{ flex: 1.2 }}>Trend (PHQ-9)</Eyebrow>
              <Eyebrow style={{ flex: 0.8 }}>Latest</Eyebrow>
              <Eyebrow style={{ flex: 1.3 }}>Follow-up</Eyebrow>
              <Eyebrow style={{ flex: 1 }}>Risk</Eyebrow>
              <Eyebrow style={{ flex: 1.2 }}>Outreach</Eyebrow>
            </Row>
            {filtered.map((cl, i) => (
              <ClientRowWide key={cl.id} client={cl} first={i === 0} onPress={() => go(router, cl)} />
            ))}
          </View>
        ) : (
          <View>
            {filtered.map((cl, i) => (
              <ClientRowNarrow key={cl.id} client={cl} first={i === 0} onPress={() => go(router, cl)} />
            ))}
          </View>
        )}
      </Card>
      <AppText variant="small" color="ink3" style={{ marginTop: 12 }}>
        Click any client to open their patterns · Leah C. opens the safety-review state.
      </AppText>
    </Screen>
  );
}

function go(router: ReturnType<typeof useRouter>, cl: Client) {
  if (cl.risk === 'acute') router.push(`/(app)/patterns/${cl.id}?risk=1`);
  else router.push(`/(app)/patterns/${cl.id}`);
}

const STATUS_TONE = { active: 'brand', intake: 'draft', 'wind-down': 'neutral' } as const;

function ClientRowWide({ client, first, onPress }: { client: Client; first: boolean; onPress: () => void }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ backgroundColor: pressed ? c.sunken : 'transparent' })}>
      <Row style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: 14, borderTopWidth: first ? 0 : 1, borderTopColor: c.lineSoft }}>
        <Row gap={12} style={{ flex: 2.4 }}>
          <Avatar initials={client.initials} size={38} tone={client.risk === 'acute' ? 'risk' : 'brand'} />
          <View>
            <AppText variant="bodyStrong">{client.name}</AppText>
            <AppText variant="small" color="ink3" style={{ fontFamily: theme.type.numeric.fontFamily, fontSize: 11.5 }}>
              {client.tokenId}
            </AppText>
          </View>
        </Row>
        <View style={{ flex: 1.1 }}>
          <Badge label={cap(client.status)} tone={STATUS_TONE[client.status]} />
        </View>
        <AppText variant="body" color="ink2" style={{ flex: 1.3 }}>
          {client.lastSessionLabel}
        </AppText>
        <View style={{ flex: 1.2, justifyContent: 'center' }}>
          <Sparkline values={client.sparkline} />
        </View>
        <AppText variant="bodyStrong" style={{ flex: 0.8, fontFamily: theme.type.numeric.fontFamily }}>
          {client.latestScore}
        </AppText>
        <AppText variant="body" tint={client.followUpDue ? c.caution : c.ink2} style={{ flex: 1.3 }}>
          {client.followUp}
        </AppText>
        <View style={{ flex: 1 }}>
          <RiskDot level={client.risk} />
        </View>
        <View style={{ flex: 1.2 }}>
          <Outreach client={client} />
        </View>
      </Row>
    </Pressable>
  );
}

/**
 * Outreach quick-actions (round-5 item 5). Three editable mailto: templates per client — a
 * follow-up email, a thank-you-for-dropping-in, and a fresh email. Each opens the mail client
 * with a preloaded template; the glyph greys out once used (mock state). Two are pre-greyed so the
 * used state is visible (Amara → thanks, Marcus → follow-up). Clicks don't open the client row.
 */
type OutreachKind = 'followup' | 'thanks' | 'fresh';

const PREGREYED: Record<string, OutreachKind> = { amara: 'thanks', marcus: 'followup' };

function buildMailto(client: Client, kind: OutreachKind): string {
  const first = client.name.split(' ')[0];
  const to = `${first.toLowerCase()}@clients.example`;
  const sig = '\n\nWarm regards,\nDr. A. Okafor';
  const templates: Record<OutreachKind, { subject: string; body: string }> = {
    followup: {
      subject: `Following up after our session`,
      body: `Dear ${first},\n\nI hope you are well. Thank you for meeting me last week — I wanted to follow up and see how things have been since.${sig}`,
    },
    thanks: {
      subject: `Thank you for dropping in`,
      body: `Dear ${first},\n\nThank you for dropping in today. It was good to see you, and I'm here if anything comes up before our next session.${sig}`,
    },
    fresh: {
      subject: ``,
      body: `Dear ${first},\n${sig}`,
    },
  };
  const t = templates[kind];
  return `mailto:${to}?subject=${encodeURIComponent(t.subject)}&body=${encodeURIComponent(t.body)}`;
}

function Outreach({ client }: { client: Client }) {
  const theme = useTheme();
  const c = theme.colors;
  const [used, setUsed] = useState<Set<OutreachKind>>(() => {
    const s = new Set<OutreachKind>();
    if (PREGREYED[client.id]) s.add(PREGREYED[client.id]);
    return s;
  });

  const fire = (kind: OutreachKind) => {
    Linking.openURL(buildMailto(client, kind)).catch(() => {});
    setUsed((prev) => new Set(prev).add(kind));
  };

  const actions: { kind: OutreachKind; label: string; Icon: typeof SendIcon }[] = [
    { kind: 'followup', label: 'Send a follow-up email', Icon: SendIcon },
    { kind: 'thanks', label: 'Send a thank-you email', Icon: HeartIcon },
    { kind: 'fresh', label: 'Start a fresh email', Icon: MailIcon },
  ];

  return (
    <Row gap={8}>
      {actions.map(({ kind, label, Icon }) => {
        const isUsed = used.has(kind);
        return (
          <Pressable
            key={kind}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled: isUsed }}
            onPress={(e) => {
              // Don't let the row's open-client handler fire.
              (e as unknown as { stopPropagation?: () => void }).stopPropagation?.();
              if (isUsed) return;
              fire(kind);
            }}
            hitSlop={6}
            style={({ pressed }) => ({ opacity: isUsed ? 0.32 : pressed ? 0.6 : 1 })}
          >
            <Icon size={16} color={isUsed ? c.ink3 : c.brand} />
          </Pressable>
        );
      })}
    </Row>
  );
}

function ClientRowNarrow({ client, first, onPress }: { client: Client; first: boolean; onPress: () => void }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ backgroundColor: pressed ? c.sunken : 'transparent' })}>
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: theme.spacing.lg, paddingVertical: 14, borderTopWidth: first ? 0 : 1, borderTopColor: c.lineSoft }}>
        <Row gap={12} style={{ flex: 1 }}>
          <Avatar initials={client.initials} size={40} tone={client.risk === 'acute' ? 'risk' : 'brand'} />
          <View style={{ flex: 1 }}>
            <Row gap={8}>
              <AppText variant="bodyStrong">{client.name}</AppText>
              <Badge label={cap(client.status)} tone={STATUS_TONE[client.status]} />
            </Row>
            <AppText variant="small" color="ink3" style={{ marginTop: 2 }}>
              {client.lastSessionLabel} · latest {client.latestScore}
            </AppText>
            <Row gap={12} style={{ marginTop: 8, alignItems: 'center' }}>
              <Sparkline values={client.sparkline} width={70} />
              <RiskDot level={client.risk} />
              <Outreach client={client} />
            </Row>
          </View>
        </Row>
      </Row>
    </Pressable>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* Small controlled text input matching the field style (kept local to avoid a new file). */
import { TextInput } from 'react-native';
function TextInputCompat({ value, onChangeText, placeholder }: { value: string; onChangeText: (t: string) => void; placeholder: string }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={c.ink3}
      style={{ flex: 1, paddingVertical: 12, fontFamily: theme.type.body.fontFamily, fontSize: 15, color: c.ink }}
    />
  );
}
