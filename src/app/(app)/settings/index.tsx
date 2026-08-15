import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { BackLink, PageHeader, Screen } from '../../../components/Screen';
import { CheckIcon, CloudIcon, DatabaseIcon, ShieldIcon } from '../../../components/icons';
import { AppText, Button, Card, Divider, Eyebrow, Row, TrustPill } from '../../../components/ui';
import { configuredServices, demoServicesConfigured } from '../../../config/env';
import { useData } from '../../../data/DataProvider';
import { authService } from '../../../services/auth';
import { useTheme } from '../../../theme/ThemeProvider';

/**
 * Settings — the developer/demo controls. Houses the "Load sample data" affordance (the Amara K.
 * cohort that used to boot by default), the live-services status, and sign-out. Everything the app
 * stores lives on this device.
 */
export default function Settings() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const { clients, sampleLoaded, loadSample, clearAll } = useData();
  const [busy, setBusy] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [confirmingLoad, setConfirmingLoad] = useState(false);

  const hasData = clients.length > 0 || sampleLoaded;

  const doLoad = async () => {
    setBusy(true);
    await loadSample();
    setBusy(false);
    setConfirmingLoad(false);
    router.push('/(app)/patterns');
  };
  const requestLoad = () => {
    if (clients.length > 0) setConfirmingLoad(true);
    else void doLoad();
  };
  const doClear = async () => {
    setBusy(true);
    await clearAll();
    setBusy(false);
    setConfirmingClear(false);
  };
  const signOut = async () => {
    await authService.signOut();
    router.replace('/unlock');
  };

  return (
    <Screen maxWidth={760}>
      <BackLink label="Back to the app" onPress={() => router.back()} />
      <PageHeader eyebrow="Settings" title="Settings & demo controls" subtitle="Everything Airava stores stays on this device. These controls are for the demo build." />

      {/* Sample data */}
      <Card>
        <Row gap={11}>
          <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: c.brandBg, alignItems: 'center', justifyContent: 'center' }}>
            <DatabaseIcon size={17} color={c.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">Sample data</AppText>
            <AppText variant="small" color="ink3" style={{ marginTop: 2, lineHeight: 17 }}>
              A fresh install starts empty. Load the fictional Amara K. cohort (no real PHI) to explore the
              caseload, patterns and a fully-drafted note.
            </AppText>
          </View>
        </Row>
        <View style={{ height: 14 }} />
        {confirmingClear ? (
          <View style={{ backgroundColor: c.riskBg, borderRadius: 10, padding: 14 }}>
            <AppText variant="bodyStrong" style={{ fontSize: 14 }}>
              Clear all data?
            </AppText>
            <AppText variant="small" color="ink2" style={{ marginTop: 4, lineHeight: 17 }}>
              This deletes every note, transcript and prescription on this device — this cannot be undone.
            </AppText>
            <View style={{ height: 12 }} />
            <Row gap={10} wrap>
              <Button title="Yes, clear all data" variant="danger" loading={busy} onPress={doClear} />
              <Button title="Cancel" variant="secondary" disabled={busy} onPress={() => setConfirmingClear(false)} />
            </Row>
          </View>
        ) : confirmingLoad ? (
          <View style={{ backgroundColor: c.riskBg, borderRadius: 10, padding: 14 }}>
            <AppText variant="bodyStrong" style={{ fontSize: 14 }}>
              Replace your data with the sample?
            </AppText>
            <AppText variant="small" color="ink2" style={{ marginTop: 4, lineHeight: 17 }}>
              Loading sample data replaces every note, transcript and prescription on this device — this cannot be undone.
            </AppText>
            <View style={{ height: 12 }} />
            <Row gap={10} wrap>
              <Button title="Yes, load sample data" variant="danger" loading={busy} onPress={doLoad} />
              <Button title="Cancel" variant="secondary" disabled={busy} onPress={() => setConfirmingLoad(false)} />
            </Row>
          </View>
        ) : (
          <Row gap={10} wrap>
            <Button
              title={sampleLoaded ? 'Reload sample data' : 'Load sample data'}
              variant="primary"
              loading={busy}
              onPress={requestLoad}
            />
            {hasData ? (
              <Button title="Clear all data" variant="secondary" disabled={busy} onPress={() => setConfirmingClear(true)} />
            ) : null}
          </Row>
        )}
        <AppText variant="small" color="ink3" style={{ marginTop: 12, fontSize: 11.5 }}>
          {hasData ? `${clients.length} client${clients.length === 1 ? '' : 's'} on this device.` : 'No clients on this device yet.'}
        </AppText>
      </Card>

      <View style={{ height: theme.spacing.lg }} />

      {/* Live services status */}
      <Card>
        <Row gap={11}>
          <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: c.brandBg, alignItems: 'center', justifyContent: 'center' }}>
            <CloudIcon size={17} color={c.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">Demo services</AppText>
            <AppText variant="small" color="ink3" style={{ marginTop: 2, lineHeight: 17 }}>
              {demoServicesConfigured
                ? 'Cloud services are configured for this build. Transcription and summarization send session text to the cloud; accounts run against Supabase.'
                : 'No keys configured — accounts, transcription and summarization run on on-device mocks.'}
            </AppText>
          </View>
        </Row>
        <View style={{ height: 12 }} />
        {configuredServices().map((s, i) => (
          <View key={s.label}>
            {i > 0 ? <Divider /> : null}
            <Row style={{ justifyContent: 'space-between', paddingVertical: 11 }}>
              <AppText variant="body" color="ink2" style={{ flex: 1 }}>
                {s.label}
              </AppText>
              {s.on ? (
                <Row gap={6}>
                  <CheckIcon size={14} color={c.positive} />
                  <AppText variant="bodyStrong" tint={c.positive} style={{ fontSize: 13 }}>
                    Live
                  </AppText>
                </Row>
              ) : (
                <AppText variant="bodyStrong" color="ink3" style={{ fontSize: 13 }}>
                  Mock
                </AppText>
              )}
            </Row>
          </View>
        ))}
      </Card>

      <View style={{ height: theme.spacing.lg }} />

      {/* Session */}
      <Card>
        <AppText variant="bodyStrong">Session</AppText>
        <AppText variant="small" color="ink3" style={{ marginTop: 2, lineHeight: 17 }}>
          Signing out re-locks the vault on this device.
        </AppText>
        <View style={{ height: 14 }} />
        <Button title="Sign out & lock" variant="secondary" onPress={signOut} />
      </Card>

      <View style={{ height: theme.spacing.lg }} />
      <Eyebrow>On this device</Eyebrow>
      <View style={{ height: 8 }} />
      <TrustPill label="Notes and client records are stored only on this device" icon={<ShieldIcon size={13} color={c.brand} />} />
    </Screen>
  );
}
