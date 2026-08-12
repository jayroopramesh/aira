import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Screen } from '../../../components/Screen';
import { Waveform } from '../../../components/Waveform';
import { CheckIcon, MicIcon, ShieldIcon, StopIcon } from '../../../components/icons';
import { AppText, Avatar, Button, Card, Row, TrustPill } from '../../../components/ui';
import { CLIENTS_BY_ID } from '../../../data/fixtures';
import { transcriptionService } from '../../../services/transcription';
import { useTheme } from '../../../theme/ThemeProvider';

type Phase = 'precapture' | 'recording' | 'analysing';

export default function SessionCapture() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const client = CLIENTS_BY_ID[clientId ?? 'amara'];
  const [phase, setPhase] = useState<Phase>('precapture');

  if (!client) return null;

  return (
    <Screen maxWidth={720}>
      {phase === 'precapture' && <PreCapture client={client} onStart={() => setPhase('recording')} />}
      {phase === 'recording' && <Recording client={client} onStop={() => setPhase('analysing')} />}
      {phase === 'analysing' && <Analysing onDone={() => router.replace(`/(app)/session/review?clientId=${client.id}`)} />}
    </Screen>
  );
}

/* ------------------------------------------------------------- pre-capture */

function PreCapture({ client, onStart }: { client: (typeof CLIENTS_BY_ID)[string]; onStart: () => void }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View style={{ alignItems: 'center', paddingTop: theme.spacing.lg }}>
      <AppText variant="label" color="brand" uppercase center>
        10:30 · Individual · Session {client.sessionNumber}
      </AppText>
      <AppText variant="display" style={{ fontSize: 28, lineHeight: 32, marginTop: 8 }} center>
        Ready to capture — {client.name}
      </AppText>
      <AppText variant="body" color="ink2" center style={{ marginTop: 10, maxWidth: 440 }}>
        Aira listens on this device, transcribes, then discards the audio. You review and sign every note.
      </AppText>

      <Card style={{ width: '100%', marginTop: theme.spacing.xl }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={12}>
            <Avatar initials={client.initials} size={44} />
            <View>
              <AppText variant="bodyStrong" style={{ fontSize: 16 }}>
                {client.name}
              </AppText>
              <AppText variant="small" color="ink3">
                Session {client.sessionNumber} · last seen 5 Apr · PHQ-9 {client.latestScore} (▼ down)
              </AppText>
            </View>
          </Row>
        </Row>
        <Card tone="sunken" elevation="none" radius="md" style={{ marginTop: 14, backgroundColor: c.brandBg, borderColor: c.brandBd }}>
          <AppText variant="bodyStrong" tint={c.brand}>
            You prepped {client.lastPlan.length} items for today
          </AppText>
          {client.lastPlan.map((p) => (
            <Row key={p.id} gap={8} style={{ marginTop: 8 }}>
              <View style={{ width: 18, height: 18, borderRadius: 5, backgroundColor: c.brandStrong, alignItems: 'center', justifyContent: 'center' }}>
                <CheckIcon size={12} color={c.onBrand} />
              </View>
              <AppText variant="body" color="ink3" style={{ textDecorationLine: 'line-through' }}>
                {p.text}
              </AppText>
            </Row>
          ))}
        </Card>
      </Card>

      <View style={{ height: theme.spacing.xxl }} />
      <Pressable
        onPress={onStart}
        accessibilityRole="button"
        accessibilityLabel="Tap to start capture"
        style={({ pressed }) => ({
          width: 104,
          height: 104,
          borderRadius: 52,
          backgroundColor: c.brandStrong,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.88 : 1,
          ...theme.elevation.md,
        })}
      >
        <MicIcon size={38} color={c.onBrand} />
      </Pressable>
      <AppText variant="h2" style={{ marginTop: 18 }} center>
        Tap to start capture
      </AppText>
      <AppText variant="small" color="ink3" center style={{ marginTop: 6, maxWidth: 420 }}>
        The mascot stays away here — recording a real session isn’t a cute moment.
      </AppText>
      <View style={{ height: 16 }} />
      <TrustPill label="On-device · nothing uploaded" icon={<ShieldIcon size={13} color={c.brand} />} />
    </View>
  );
}

/* ---------------------------------------------------------------- recording */

function Recording({ client, onStop }: { client: (typeof CLIENTS_BY_ID)[string]; onStop: () => void }) {
  const theme = useTheme();
  const c = theme.colors;
  const [seconds, setSeconds] = useState(862); // starts mid-session like the prototype (14:22)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <View style={{ alignItems: 'center', paddingTop: theme.spacing.xxl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.riskBg, borderRadius: theme.radii.pill, paddingVertical: 8, paddingHorizontal: 16 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.riskFill }} />
        <AppText variant="bodyStrong" tint={c.risk}>
          Recording · Session {client.sessionNumber} with {client.name}
        </AppText>
      </View>
      <AppText variant="display" style={{ fontSize: 56, lineHeight: 62, marginTop: 24, fontFamily: theme.type.numeric.fontFamily }}>
        {mm}:{ss}
      </AppText>
      <View style={{ height: 20 }} />
      <Waveform bars={13} />
      <View style={{ height: 28 }} />
      <TrustPill label="Audio stays on this device · nothing is uploaded" icon={<ShieldIcon size={13} color={c.brand} />} />
      <View style={{ height: 24 }} />
      <Button
        title="Stop & transcribe"
        variant="secondary"
        size="lg"
        leftIcon={<StopIcon size={16} color={c.risk} />}
        onPress={onStop}
      />
      <AppText variant="small" color="ink3" center style={{ marginTop: 18, maxWidth: 380 }}>
        When you stop, Aira transcribes on-device, drafts the note, then deletes the recording.
      </AppText>
    </View>
  );
}

/* ---------------------------------------------------------------- analysing */

function Analysing({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const c = theme.colors;
  const [stage, setStage] = useState<string>('preparing');
  const controller = useRef(new AbortController());

  useEffect(() => {
    const ctrl = controller.current;
    // One-shot post-session transcription (mocked). The seam models the real whisper.rn
    // pipeline: preparing → transcribing → on-device de-identification → draft.
    transcriptionService
      .transcribe({ uri: 'mock://session', durationMs: 47 * 60 * 1000 }, { onStage: setStage, signal: ctrl.signal })
      .then(() => onDone())
      .catch(() => {
        /* aborted via Stop — fall through to the draft with what's ready */
      });
    return () => ctrl.abort();
  }, [onDone]);

  const label =
    stage === 'deidentifying' ? 'De-identifying on-device…' : stage === 'transcribing' ? 'Transcribing on-device…' : 'Preparing…';

  return (
    <View style={{ paddingTop: theme.spacing.lg }}>
      <Card tone="sunken" elevation="none" radius="lg" style={{ backgroundColor: c.brandBg, borderColor: c.brandBd }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={12} style={{ flex: 1 }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 3, borderColor: c.brandBd, borderTopColor: c.brand }} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">Analysing transcript…</AppText>
              <AppText variant="small" color="ink3" style={{ marginTop: 2 }}>
                {label} · Drafting clinical sections from a 47-minute session · on-device
              </AppText>
            </View>
          </Row>
          <Button title="Stop" variant="secondary" onPress={() => { controller.current.abort(); onDone(); }} />
        </Row>
      </Card>

      {/* Skeletons */}
      <View style={{ height: theme.spacing.xl }} />
      {[0.42, 0.9, 0.85, 0.6, 0, 0.4, 0.82, 0.95, 0.72, 0, 0.38, 0.78].map((w, i) => (
        <View
          key={i}
          style={{
            height: w === 0 ? 14 : 12,
            width: w === 0 ? 0 : `${w * 100}%`,
            backgroundColor: c.brandBg,
            borderRadius: 6,
            marginBottom: 14,
          }}
        />
      ))}
      <AppText variant="body" color="ink2" style={{ marginTop: 8 }}>
        Nothing is authoritative yet — this is a draft you will review and sign. Press <AppText variant="bodyStrong">Stop</AppText> anytime to work with what’s drafted so far.
      </AppText>
    </View>
  );
}
