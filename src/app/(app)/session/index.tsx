import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Highlights } from '../../../components/Highlights';
import { Screen } from '../../../components/Screen';
import { Waveform } from '../../../components/Waveform';
import { FileUpIcon, MicIcon, PencilIcon, PlusIcon, ShieldIcon, StopIcon } from '../../../components/icons';
import { AppText, Avatar, Button, Card, Row, TrustPill } from '../../../components/ui';
import { CLIENTS_BY_ID } from '../../../data/fixtures';
import { transcriptionService } from '../../../services/transcription';
import { useTheme } from '../../../theme/ThemeProvider';

type Phase = 'precapture' | 'recording' | 'analysing';

export default function SessionCapture() {
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
        {/* Read-only prep reminder — same family as the drawer / prep screen (no checkboxes). */}
        <Card tone="sunken" elevation="none" radius="md" style={{ marginTop: 14, backgroundColor: c.brandBg, borderColor: c.brandBd }}>
          <AppText variant="bodyStrong" tint={c.brand} style={{ marginBottom: 12 }}>
            Reminders from last session
          </AppText>
          <Highlights items={client.lastPlan.map((p) => ({ text: p.text }))} />
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
    <View style={{ alignItems: 'center', paddingTop: theme.spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.riskBg, borderRadius: theme.radii.pill, paddingVertical: 8, paddingHorizontal: 16 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.riskFill }} />
        <AppText variant="bodyStrong" tint={c.risk}>
          Recording · Session {client.sessionNumber} with {client.name}
        </AppText>
      </View>
      <AppText variant="display" style={{ fontSize: 56, lineHeight: 62, marginTop: 20, fontFamily: theme.type.numeric.fontFamily }}>
        {mm}:{ss}
      </AppText>
      <View style={{ height: 18 }} />
      <Waveform bars={13} />

      {/* Current-word live-transcript readout, under the waveform. */}
      <View style={{ alignItems: 'center', marginTop: 22, maxWidth: 520 }}>
        <AppText variant="label" color="ink3" uppercase>
          Transcribing on-device
        </AppText>
        <AppText variant="body" color="ink2" center style={{ marginTop: 6, fontSize: 17, lineHeight: 25 }}>
          …the mornings are easier now, it’s the{' '}
          <AppText variant="bodyStrong" tint={c.brand} style={{ fontSize: 17, textDecorationLine: 'underline', textDecorationColor: c.brandBd }}>
            nights
          </AppText>
        </AppText>
        <AppText variant="small" color="ink3" center style={{ marginTop: 8 }}>
          Words appear as they’re transcribed — one at a time, never uploaded
        </AppText>
      </View>

      {/* Comment-on-your-recording strip: a dotted "add" card first, earlier comments to its
          right (newest-first), each editable with a pencil signal and its timestamp pill. */}
      <RecordingNotes liveTs={`${mm}:${ss}`} />

      <View style={{ height: 22 }} />
      <TrustPill label="Audio stays on this device · nothing is uploaded" icon={<ShieldIcon size={13} color={c.brand} />} />
      {/* Supanote-style compliance note — HIPAA-ALIGNED phrasing only (never "compliant/certified"). */}
      <Row gap={7} style={{ alignItems: 'center', marginTop: 10, maxWidth: 520, paddingHorizontal: 8 }}>
        <ShieldIcon size={12} color={c.ink3} />
        <AppText variant="small" color="ink3" center style={{ flex: 1, fontSize: 11, lineHeight: 16 }}>
          HIPAA-aligned safeguards · de-identified on your device · audio deleted after transcription by default
        </AppText>
      </Row>
      <View style={{ height: 22 }} />
      <Button title="Stop & transcribe" variant="secondary" size="lg" leftIcon={<StopIcon size={16} color={c.risk} />} onPress={onStop} />
      <AppText variant="small" color="ink3" center style={{ marginTop: 18, maxWidth: 420, lineHeight: 18 }}>
        <AppText variant="bodyStrong" color="ink2" style={{ fontSize: 12.5 }}>
          Nothing is authoritative yet — this is a draft you will review and sign.
        </AppText>{' '}
        When you stop, Aira transcribes on-device, drafts the note, then deletes the recording (unless you choose to keep it).
      </AppText>
    </View>
  );
}

type Comment = { id: string; ts: string; text: string };

/**
 * "Comment on your recording" strip (round-4 item 4 + round-5 item 4). The dotted "add" card is
 * FIRST/leftmost so the affordance is visible with zero scroll; earlier comments follow to the
 * right, newest-first. Each comment carries a pencil icon (editable signal), its timestamp pill,
 * and editable text. Each comment syncs to the recording timestamp (jumps back on replay).
 */
function RecordingNotes({ liveTs }: { liveTs: string }) {
  const theme = useTheme();
  const c = theme.colors;
  const [comments, setComments] = useState<Comment[]>([
    { id: 'c-1247', ts: '12:47', text: 'Exam anxiety resurfaces the nights before deadlines.' },
    { id: 'c-0812', ts: '08:12', text: 'Sleep log clearly improving — worth reinforcing as a win.' },
  ]);
  const [draft, setDraft] = useState('');
  const nextId = useRef(0);
  const scroller = useRef<ScrollView>(null);

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    // Commit AFTER the add card (keeps it first) and reset scroll to 0 so the add card stays visible.
    setComments((xs) => [{ id: `c-new-${++nextId.current}`, ts: liveTs, text }, ...xs]);
    setDraft('');
    scroller.current?.scrollTo({ x: 0, animated: true });
  };

  const editComment = (id: string, text: string) => setComments((xs) => xs.map((x) => (x.id === id ? { ...x, text } : x)));

  return (
    <Card radius="md" style={{ width: '100%', maxWidth: 520, marginTop: 22 }} padded={false}>
      <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
        <AppText variant="bodyStrong" style={{ fontSize: 13 }}>
          Comment on your recording
        </AppText>
        <AppText variant="small" color="ink3" style={{ marginTop: 2, lineHeight: 16 }}>
          Each comment syncs to the recording timestamp · on replay it jumps back to that moment
        </AppText>
      </View>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingVertical: 14 }}
        style={{ marginTop: 4 }}
      >
        {/* Dotted add card — first/leftmost. */}
        <View
          style={{
            width: 208,
            borderRadius: theme.radii.md,
            borderWidth: 2,
            borderStyle: 'dotted',
            borderColor: c.brand,
            backgroundColor: c.brandBg,
            padding: 12,
          }}
        >
          <Row gap={8} style={{ alignItems: 'center' }}>
            <TimePill label={liveTs} live />
            <Row gap={5} style={{ alignItems: 'center' }}>
              <PlusIcon size={13} color={c.brand} />
              <AppText variant="small" tint={c.brand} style={{ fontSize: 11.5 }}>
                Add at this moment
              </AppText>
            </Row>
          </Row>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={add}
            onBlur={add}
            placeholder="Type a comment…"
            placeholderTextColor={c.ink3}
            multiline
            style={{
              marginTop: 8,
              minHeight: 54,
              color: c.ink,
              fontFamily: theme.type.body.fontFamily,
              fontSize: 12.5,
              lineHeight: 18,
              textAlignVertical: 'top',
            }}
          />
        </View>

        {/* Earlier comments — newest-first, each editable with a pencil signal. */}
        {comments.map((n) => (
          <View
            key={n.id}
            style={{
              width: 208,
              borderRadius: theme.radii.md,
              borderWidth: 1,
              borderColor: c.line,
              backgroundColor: c.sunken,
              padding: 12,
            }}
          >
            <Row gap={8} style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <TimePill label={n.ts} />
              <PencilIcon size={13} color={c.ink3} />
            </Row>
            <TextInput
              value={n.text}
              onChangeText={(t) => editComment(n.id, t)}
              multiline
              style={{
                marginTop: 8,
                minHeight: 54,
                color: c.ink2,
                fontFamily: theme.type.body.fontFamily,
                fontSize: 12.5,
                lineHeight: 18,
                textAlignVertical: 'top',
              }}
            />
          </View>
        ))}
      </ScrollView>
    </Card>
  );
}

/** A small mono time chip; the "live" variant uses the calm clay tint (the current moment). */
function TimePill({ label, live }: { label: string; live?: boolean }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View
      style={{
        backgroundColor: live ? c.riskBg : c.brandBg,
        borderRadius: theme.radii.xs,
        paddingVertical: 3,
        paddingHorizontal: 7,
      }}
    >
      <AppText variant="small" tint={live ? c.risk : c.brand} style={{ fontSize: 11, fontFamily: theme.type.numeric.fontFamily }}>
        {label}
      </AppText>
    </View>
  );
}

/* ---------------------------------------------------------------- analysing */

const TRANSCRIPT_LINES: { speaker: string; text: string }[] = [
  { speaker: 'Amara', text: 'The mornings are easier now — it’s the nights before a deadline that still get me.' },
  { speaker: 'Dr. Okafor', text: 'And the sleep log — has it been possible to keep it up this fortnight?' },
  { speaker: 'Amara', text: 'Mostly. I slept through the night for the first time in weeks. Stats is still hanging over me though.' },
  { speaker: 'Dr. Okafor', text: 'Let’s stay with the worry-window we trialled and shape one that’s specific to the exam.' },
];

function Analysing({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const c = theme.colors;
  const [stage, setStage] = useState<string>('preparing');
  const [transcript, setTranscript] = useState(
    TRANSCRIPT_LINES.map((l) => `${l.speaker}: ${l.text}`).join('\n\n'),
  );
  const controller = useRef(new AbortController());

  useEffect(() => {
    const ctrl = controller.current;
    // One-shot post-session transcription (mocked): preparing → transcribing → de-identify.
    transcriptionService
      .transcribe({ uri: 'mock://session', durationMs: 47 * 60 * 1000 }, { onStage: setStage, signal: ctrl.signal })
      .catch(() => {
        /* aborted via Stop — the drafted-so-far transcript stays editable below */
      });
    return () => ctrl.abort();
  }, []);

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

      {/* Skeletons of the drafting note. */}
      <View style={{ height: theme.spacing.xl }} />
      {[0.42, 0.9, 0.85, 0.6, 0, 0.4, 0.82, 0.95, 0.72].map((w, i) => (
        <View
          key={i}
          style={{ height: w === 0 ? 14 : 12, width: w === 0 ? 0 : `${w * 100}%`, backgroundColor: c.brandBg, borderRadius: 6, marginBottom: 14 }}
        />
      ))}

      {/* The transcript in the same window: faint-green rounded box, editable. */}
      <View style={{ marginTop: theme.spacing.md, backgroundColor: c.positiveBg, borderRadius: theme.radii.lg, borderWidth: 1, borderColor: c.positiveBg, padding: theme.spacing.lg }}>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          <FileUpIcon size={15} color={c.positive} strokeWidth={2} />
          <AppText variant="bodyStrong" tint={c.positive} style={{ fontSize: 12.5 }}>
            Transcript · editable
          </AppText>
          <AppText variant="small" color="ink3" style={{ fontSize: 11 }}>
            on-device · fix any mishears or names before the draft is finalised
          </AppText>
        </Row>
        <View style={{ height: 10 }} />
        <TextInput
          multiline
          value={transcript}
          onChangeText={setTranscript}
          style={{
            backgroundColor: c.elevated,
            borderWidth: 1,
            borderColor: c.lineSoft,
            borderRadius: theme.radii.sm,
            padding: 14,
            color: c.ink,
            fontFamily: theme.type.body.fontFamily,
            fontSize: 14,
            lineHeight: 22,
            minHeight: 150,
          }}
        />
      </View>

      <View style={{ height: theme.spacing.lg }} />
      <View style={{ alignItems: 'flex-end' }}>
        <Button
          title="Next → review the draft note"
          variant="primary"
          onPress={() => { controller.current.abort(); onDone(); }}
        />
      </View>
    </View>
  );
}
