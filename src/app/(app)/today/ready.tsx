import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { Screen } from '../../../components/Screen';
import { ArrowRight, CheckIcon, ShieldIcon } from '../../../components/icons';
import { AppText, Button, Card, Eyebrow, Row, TrustPill } from '../../../components/ui';
import { CLIENTS_BY_ID } from '../../../data/fixtures';
import { useTheme } from '../../../theme/ThemeProvider';

/** "You're ready" — prep complete → start the session (hands off to the Session workflow). */
export default function ReadyScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const client = CLIENTS_BY_ID[clientId ?? 'amara'];
  const first = client?.name.split(' ')[0] ?? 'your client';

  return (
    <Screen maxWidth={620}>
      <View style={{ height: theme.spacing.xxl }} />
      <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: c.positiveBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CheckIcon size={30} color={c.positive} />
        </View>
        <View style={{ height: 18 }} />
        <Eyebrow color="brand">Ready</Eyebrow>
        <AppText variant="display" style={{ fontSize: 26, lineHeight: 30, marginTop: 8 }} center>
          You’re ready for {first}
        </AppText>
        <AppText variant="body" color="ink2" center style={{ marginTop: 10, maxWidth: 400 }}>
          Last session’s highlights are fresh in mind. When you begin, Aira captures on-device and drafts a note against the SOAP sections.
        </AppText>
        <View style={{ height: 22 }} />
        <Row gap={12}>
          <Button title="Back to today" variant="secondary" onPress={() => router.replace('/(app)/today')} />
          <Button
            title="Start the session"
            variant="primary"
            rightIcon={<ArrowRight size={18} color={c.onBrand} />}
            onPress={() => router.replace(`/(app)/session?clientId=${client?.id ?? 'amara'}`)}
          />
        </Row>
        <View style={{ height: 18 }} />
        <TrustPill label="Prep & notes stay encrypted on this device" icon={<ShieldIcon size={14} color={c.brand} />} />
      </Card>
    </Screen>
  );
}
