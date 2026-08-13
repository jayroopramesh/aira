import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClientNotFound } from '../../../components/ClientNotFound';
import { HistoryTimeline, StatTile } from '../../../components/clinical';
import { Highlights } from '../../../components/Highlights';
import { ArrowRight, CheckIcon, CloseIcon, FileUpIcon } from '../../../components/icons';
import { AppText, Avatar, Button, Card, Eyebrow, Row, TrustPill } from '../../../components/ui';
import { Client } from '../../../data/types';
import { useClient, useData, usePatientDetails } from '../../../data/DataProvider';
import { useTheme } from '../../../theme/ThemeProvider';

/**
 * In-place client drawer (Heidi/Time2book pattern): latest scores, history timeline, and
 * the last signed plan — surfaced as read-only prep reminders (Highlights).
 * Presented as a bottom sheet on phone / modal on web.
 */
export default function ClientDrawer() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const client = useClient(clientId);

  if (!client) return <ClientNotFound />;

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
                  ID {client.tokenId} · {client.age ?? '—'} · Session {client.sessionNumber} · client since {client.clientSince}
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

          {/* Patient details + mock external-records connection (round-5 item 3). */}
          <View style={{ height: theme.spacing.xl }} />
          <PatientDetails client={client} />
          <View style={{ height: theme.spacing.md }} />
          <EhrCard />

          {/* History timeline */}
          <View style={{ height: theme.spacing.xl }} />
          <Eyebrow>History timeline</Eyebrow>
          <View style={{ height: 12 }} />
          <HistoryTimeline entries={client.timeline} />

          {/* Last plan → read-only reminders (no checkboxes; prep is a reminder, not a task). */}
          <View style={{ height: theme.spacing.sm }} />
          <Eyebrow>Last plan &amp; next steps · from {client.lastPlan[0]?.source.replace('from Plan & Next Steps · ', '') ?? 'last session'}, signed</Eyebrow>
          <Card tone="sunken" elevation="none" radius="md" style={{ marginTop: 10, borderColor: c.brandBd, backgroundColor: c.brandBg }}>
            <AppText variant="bodyStrong" tint={c.brand} style={{ marginBottom: 12 }}>
              Highlights to keep in mind today
            </AppText>
            <Highlights items={client.lastPlan.map((p) => ({ text: p.text }))} />
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
            title="Open prep reminder"
            variant="primary"
            rightIcon={<ArrowRight size={18} color={c.onBrand} />}
            onPress={() => router.replace(`/(app)/today/prep?clientId=${client.id}`)}
          />
        </Row>
      </View>
    </View>
  );
}

/* ---------------------------------------------------------- patient details --- */

/**
 * Therapist-facing patient-details card (round-5 item 3). Fictional intake data, consistent with
 * each client's narrative — never real PHI. Sits beside the clinical scores in the drawer.
 */
/**
 * Editable patient-details card (C2). Sits beside the client's name, ABOVE the optional SALAMA
 * integration. The clinician can tap "Add details" to edit each field inline and jot a free-text
 * note. Edits persist per client through the vault seam ("Done" saves) — device-local, no PHI
 * leaves the device.
 */
function PatientDetails({ client }: { client: Client }) {
  const theme = useTheme();
  const c = theme.colors;
  const initial: { label: string; value: string }[] = [
    { label: 'Age / DOB', value: client.age != null ? `${client.age} · 14 Mar ${2026 - client.age}` : '—' },
    { label: 'Contact', value: '+971 50 · redacted · via clinic portal' },
    { label: 'Programme / year', value: client.id === 'amara' ? 'BSc Statistics · Year 2 (first-gen)' : 'University counselling programme' },
    { label: 'Emergency contact', value: 'On file · consented to contact' },
    { label: 'Consent status', value: `Signed ${client.clientSince} · current` },
  ];
  const saved = usePatientDetails(client.id);
  const { savePatientDetails } = useData();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<string[]>(() => saved.values ?? initial.map((d) => d.value));
  const [extra, setExtra] = useState(saved.extra ?? '');

  const inputStyle = {
    flex: 1,
    textAlign: 'right' as const,
    color: c.ink,
    fontFamily: theme.type.body.fontFamily,
    fontSize: 15,
    borderBottomWidth: 1,
    borderBottomColor: c.brandBd,
    paddingVertical: 2,
  };

  return (
    <View>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Eyebrow>Patient details</Eyebrow>
        <Pressable
          onPress={() => {
            if (editing) savePatientDetails(client.id, { values, extra });
            setEditing((e) => !e);
          }}
          accessibilityRole="button"
          accessibilityLabel={editing ? 'Done editing patient details' : 'Add details'}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <AppText variant="small" tint={c.brand}>
            {editing ? 'Done' : 'Add details'}
          </AppText>
        </Pressable>
      </Row>
      <Card tone="elevated" elevation="sm" radius="md" style={{ marginTop: 10 }}>
        {initial.map((d, i) => (
          <Row
            key={d.label}
            style={{
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: 9,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: c.lineSoft,
              gap: 16,
            }}
          >
            <AppText variant="small" color="ink3" style={{ flexShrink: 0 }}>
              {d.label}
            </AppText>
            {editing ? (
              <TextInput
                value={values[i]}
                onChangeText={(t) => setValues((v) => v.map((x, j) => (j === i ? t : x)))}
                style={inputStyle}
              />
            ) : (
              <AppText variant="body" color="ink" style={{ flex: 1, textAlign: 'right' }}>
                {values[i]}
              </AppText>
            )}
          </Row>
        ))}

        {editing ? (
          <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: c.lineSoft, paddingTop: 10 }}>
            <AppText variant="small" color="ink3" style={{ marginBottom: 6 }}>
              Add details
            </AppText>
            <TextInput
              multiline
              value={extra}
              onChangeText={setExtra}
              placeholder="Notes about this patient (stays on this device)…"
              placeholderTextColor={c.ink3}
              style={{
                minHeight: 54,
                color: c.ink,
                fontFamily: theme.type.body.fontFamily,
                fontSize: 14,
                lineHeight: 20,
                textAlignVertical: 'top',
                borderWidth: 1,
                borderColor: c.line,
                borderRadius: theme.radii.sm,
                padding: 10,
              }}
            />
          </View>
        ) : extra.trim() ? (
          <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: c.lineSoft, paddingTop: 10 }}>
            <AppText variant="small" color="ink3" style={{ marginBottom: 4 }}>
              Details
            </AppText>
            <AppText variant="body" color="ink" style={{ lineHeight: 21 }}>
              {extra}
            </AppText>
          </View>
        ) : null}
      </Card>
    </View>
  );
}

/* ------------------------------------------------------------- mock EHR card --- */

/**
 * Mock external-records connection (round-5 item 3). "SALAMA — Not connected · Connect" toggles to
 * a connected state showing three pulled record lines. A persistent disclaimer makes clear this is
 * a visual mock — no external system is contacted, no network call is made.
 */
function EhrCard() {
  const theme = useTheme();
  const c = theme.colors;
  const [connected, setConnected] = useState(false);
  const pulled = ['Discharge summary · 3 Jan 2026', 'Medications · 2 active', 'Allergies · none recorded'];

  return (
    <Card tone="elevated" elevation="sm" radius="md" style={{ borderColor: c.line }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <Row gap={11} style={{ flex: 1 }}>
          <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: c.brandBg, alignItems: 'center', justifyContent: 'center' }}>
            <FileUpIcon size={17} color={c.brand} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">Load external health records</AppText>
            <Row gap={7} style={{ alignItems: 'center', marginTop: 3 }}>
              <AppText variant="small" color="ink3">
                SALAMA
              </AppText>
              <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: c.ink3 }} />
              {connected ? (
                <Row gap={5} style={{ alignItems: 'center' }}>
                  <CheckIcon size={12} color={c.positive} />
                  <AppText variant="small" tint={c.positive}>
                    Connected · demo
                  </AppText>
                </Row>
              ) : (
                <AppText variant="small" color="ink3">
                  Not connected
                </AppText>
              )}
            </Row>
          </View>
        </Row>
        <Button
          title={connected ? 'Disconnect' : 'Connect'}
          variant={connected ? 'ghost' : 'secondary'}
          onPress={() => setConnected((v) => !v)}
        />
      </Row>

      {connected ? (
        <View style={{ marginTop: 14, backgroundColor: c.sunken, borderRadius: theme.radii.sm, padding: 12 }}>
          {pulled.map((p, i) => (
            <Row key={p} gap={9} style={{ alignItems: 'center', paddingVertical: 6, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.lineSoft }}>
              <CheckIcon size={13} color={c.brand} />
              <AppText variant="small" color="ink2" style={{ flex: 1 }}>
                {p}
              </AppText>
            </Row>
          ))}
        </View>
      ) : null}

      <AppText variant="small" color="ink3" style={{ marginTop: 12, lineHeight: 16, fontSize: 11 }}>
        Mock connection for this prototype — no external system is contacted and nothing leaves this device.
      </AppText>
    </Card>
  );
}
