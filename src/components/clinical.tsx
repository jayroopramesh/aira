import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { TimelineEntry } from '../data/types';
import { AppText, Card, Eyebrow, Row } from './ui';

/** A single latest-score tile (PHQ-9 / GAD-7 / Sleep) with a small trend caption. */
export function StatTile({
  label,
  value,
  unit,
  delta,
  deltaTone = 'positive',
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaTone?: 'positive' | 'caution' | 'neutral';
}) {
  const theme = useTheme();
  const c = theme.colors;
  const tone = deltaTone === 'positive' ? c.positive : deltaTone === 'caution' ? c.caution : c.ink3;
  return (
    <Card tone="elevated" elevation="none" radius="md" padded={false} style={{ flex: 1, minWidth: 120, padding: theme.spacing.md }}>
      <Eyebrow>{label}</Eyebrow>
      <Row gap={2} style={{ alignItems: 'flex-end', marginTop: 6 }}>
        <AppText variant="display" style={{ fontSize: 28, lineHeight: 30 }}>
          {value}
        </AppText>
        {unit ? (
          <AppText variant="body" color="ink3" style={{ marginBottom: 4 }}>
            {unit}
          </AppText>
        ) : null}
      </Row>
      {delta ? (
        <AppText variant="small" tint={tone} style={{ marginTop: 6 }}>
          {delta}
        </AppText>
      ) : null}
    </Card>
  );
}

const KIND_STYLE: Record<TimelineEntry['kind'], { label: string; tone: 'brand' | 'accent' | 'risk' }> = {
  session: { label: 'Session', tone: 'brand' },
  intake: { label: 'Intake', tone: 'brand' },
  journal: { label: 'Companion app', tone: 'accent' },
  safety: { label: 'Safety', tone: 'risk' },
};

/** Chronological history feed. Types are always labelled and never blurred (stoic. pattern). */
export function HistoryTimeline({ entries, cards = false }: { entries: TimelineEntry[]; cards?: boolean }) {
  const theme = useTheme();
  const c = theme.colors;
  const dotColor = (kind: TimelineEntry['kind']) =>
    kind === 'safety' ? c.riskFill : kind === 'journal' ? c.accentFill : c.brand;
  const labelColor = (t: 'brand' | 'accent' | 'risk') => (t === 'risk' ? c.risk : t === 'accent' ? c.accent : c.brand);
  const labelBg = (t: 'brand' | 'accent' | 'risk') => (t === 'risk' ? c.riskBg : t === 'accent' ? c.accentBg : c.brandBg);

  return (
    <View>
      {entries.map((e, i) => {
        const ks = KIND_STYLE[e.kind];
        return (
          <View key={e.id} style={{ flexDirection: 'row', gap: 14 }}>
            {/* rail */}
            <View style={{ alignItems: 'center', width: 14 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: dotColor(e.kind), marginTop: 4 }} />
              {i < entries.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: c.lineSoft, marginTop: 2 }} /> : null}
            </View>
            <View
              style={[
                { flex: 1, paddingBottom: theme.spacing.lg },
                cards
                  ? {
                      backgroundColor: c.elevated,
                      borderWidth: 1,
                      borderColor: c.line,
                      borderRadius: theme.radii.md,
                      padding: theme.spacing.md,
                      marginBottom: theme.spacing.sm,
                      paddingBottom: theme.spacing.md,
                    }
                  : null,
              ]}
            >
              <Row style={{ justifyContent: 'space-between' }}>
                <View
                  style={{
                    alignSelf: 'flex-start',
                    backgroundColor: labelBg(ks.tone),
                    borderRadius: theme.radii.pill,
                    paddingVertical: 3,
                    paddingHorizontal: 10,
                  }}
                >
                  <AppText variant="label" tint={labelColor(ks.tone)} uppercase>
                    {ks.label}
                  </AppText>
                </View>
                <AppText variant="small" color="ink3">
                  {e.date}
                </AppText>
              </Row>
              {e.title ? (
                <AppText variant="bodyStrong" style={{ marginTop: 8 }}>
                  {e.title}
                </AppText>
              ) : null}
              <AppText variant="body" color="ink2" style={{ marginTop: e.title ? 4 : 8 }}>
                {e.body}
              </AppText>
              {e.scores ? (
                <AppText variant="small" color="ink3" style={{ marginTop: 8, fontFamily: theme.type.numeric.fontFamily }}>
                  {e.scores}
                </AppText>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
