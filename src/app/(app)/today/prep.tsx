import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { BackLink, PageHeader, Screen } from '../../../components/Screen';
import { ArrowRight, CheckIcon } from '../../../components/icons';
import { AppText, Button, Card, Eyebrow, Row } from '../../../components/ui';
import { CLIENTS_BY_ID } from '../../../data/fixtures';
import { useTheme } from '../../../theme/ThemeProvider';

/** Prep checklist — auto-derived from the last signed plan (Heidi task-rail pattern). */
export default function PrepChecklist() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const client = CLIENTS_BY_ID[clientId ?? 'amara'];
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  if (!client) return null;
  const items = client.lastPlan;
  const doneCount = items.filter((i) => checked[i.id]).length;
  const allDone = doneCount === items.length;

  const toggle = (id: string) => setChecked((s) => ({ ...s, [id]: !s[id] }));
  const markAll = () => setChecked(Object.fromEntries(items.map((i) => [i.id, true])));

  return (
    <Screen maxWidth={760}>
      <BackLink label={`Back to ${client.name.split(' ')[0]}’s file`} onPress={() => router.replace(`/(app)/today/${client.id}`)} />
      <PageHeader
        eyebrow={`Prep · ${client.name} · 10:30`}
        title="Get ready for this session"
        subtitle="Auto-derived from the last signed plan. Check items off as you prepare · stale items archive in 30 days."
      />

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Eyebrow>Prep checklist</Eyebrow>
          <View style={{ backgroundColor: c.brandBg, borderRadius: theme.radii.pill, paddingVertical: 4, paddingHorizontal: 12 }}>
            <AppText variant="small" tint={c.brand}>
              {doneCount} / {items.length}
            </AppText>
          </View>
        </Row>
        <View style={{ height: 12 }} />
        {items.map((item, i) => {
          const on = !!checked[item.id];
          return (
            <Pressable key={item.id} onPress={() => toggle(item.id)} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
              <Row gap={12} style={{ alignItems: 'flex-start', paddingVertical: 12, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: c.lineSoft }}>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    borderWidth: 1.5,
                    borderColor: on ? c.brandStrong : c.line,
                    backgroundColor: on ? c.brandStrong : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 1,
                  }}
                >
                  {on ? <CheckIcon size={14} color={c.onBrand} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong" style={{ textDecorationLine: on ? 'line-through' : 'none', color: on ? c.ink3 : c.ink }}>
                    {item.text}
                  </AppText>
                  <AppText variant="small" color="ink3" style={{ marginTop: 2 }}>
                    {item.source}
                  </AppText>
                </View>
              </Row>
            </Pressable>
          );
        })}
        <View style={{ height: 8 }} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Button title="Mark all done" variant="secondary" onPress={markAll} />
          <Button
            title="I’m ready"
            variant="primary"
            rightIcon={<ArrowRight size={18} color={c.onBrand} />}
            onPress={() => router.push(`/(app)/today/ready?clientId=${client.id}`)}
          />
        </Row>
      </Card>
    </Screen>
  );
}
