import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Highlights } from '../../../components/Highlights';
import { Screen } from '../../../components/Screen';
import { Waveform } from '../../../components/Waveform';
import { AlertTriangleIcon, FileUpIcon, MicIcon, PencilIcon, PlusIcon, ShieldIcon, StopIcon } from '../../../components/icons';
import { AppText, Avatar, Button, Card, Row, TrustPill } from '../../../components/ui';
import { useClient, useData } from '../../../data/DataProvider';
import { DraftNote } from '../../../data/types';
import { ActiveRecording, isRecordingSupported, isUploadSupported, pickAudioFile, startRecording } from '../../../services/audioCapture';
import { hasGroq } from '../../../config/env';
import { summarizationService } from '../../../services/summarization';
import { CaptureRef, MockTranscriptionService, transcriptionService } from '../../../services/transcription';
import { useTheme } from '../../../theme/ThemeProvider';

type Phase = 'precapture' | 'recording' | 'analysing';

/** A local mock audio clip (silence) so the flow demos end-to-end with no mic and no upload. */
function mockCaptureRef(): CaptureRef {
  return { uri: 'mock://session', durationMs: 47 * 60 * 1000 };
}

export default function SessionCapture() {
  const router = useRouter();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const client = useClient(clientId);
  const { saveSessionNote } = useData();

  const [phase, setPhase] = useState<Phase>('precapture');
  const [name, setName] = useState('');
  const capture = useRef<CaptureRef | null>(null);
  const recording = useRef<ActiveRecording | null>(null);

  const displayName = client?.name ?? (name.trim() || 'this session');

  const beginRecording = async () => {
    try {
      recording.current = await startRecording();
    } catch {
      recording.current = null; // mic denied/unsupported — the recording screen offers fallbacks
    }
    setPhase('recording');
  };

  const goAnalyse = (ref: CaptureRef) => {
    capture.current = ref;
    setPhase('analysing');
  };

  const stopAndAnalyse = async () => {
    if (recording.current) {
      const ref = await recording.current.stop().catch(() => mockCaptureRef());
      recording.current = null;
      goAnalyse(ref);
    } else {
      goAnalyse(mockCaptureRef());
    }
  };

  const onUpload = async () => {
    const ref = await pickAudioFile();
    if (ref) {
      if (recording.current) {
        await recording.current.stop().catch(() => {});
        recording.current = null;
      }
      goAnalyse(ref);
    }
  };

  const onDrafted = async (note: DraftNote) => {
    const id = await saveSessionNote(note, { clientId: client?.id, name: client ? undefined : name });
    router.replace(`/(app)/session/review?clientId=${id}`);
  };

  return (
    <Screen maxWidth={720}>
      {phase === 'precapture' && (
        <PreCapture
          client={client}
          name={name}
          onName={setName}
          onRecord={beginRecording}
          onUpload={onUpload}
          onUseSample={() => goAnalyse(mockCaptureRef())}
        />
      )}
      {phase === 'recording' && (
        <Recording
          displayName={displayName}
          sessionNumber={client?.sessionNumber ?? 1}
          live={!!recording.current}
          onStop={stopAndAnalyse}
          onUpload={onUpload}
        />
      )}
      {phase === 'analysing' && (
        <Analysing capture={capture.current ?? mockCaptureRef()} client={client ?? undefined} name={name} onDrafted={onDrafted} />
      )}
    </Screen>
  );
}

/* ------------------------------------------------------------- pre-capture */

function PreCapture({
  client,
  name,
  onName,
  onRecord,
  onUpload,
  onUseSample,
}: {
  client: ReturnType<typeof useClient>;
  name: string;
  onName: (v: string) => void;
  onRecord: () => void;
  onUpload: () => void;
  onUseSample: () => void;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const canRecord = isRecordingSupported();
  const canUpload = isUploadSupported();

  return (
    <View style={{ alignItems: 'center', paddingTop: theme.spacing.lg }}>
      <AppText variant="label" color="brand" uppercase center>
        {client ? `10:30 · Individual · Session ${client.sessionNumber}` : 'New session'}
      </AppText>
      <AppText variant="display" style={{ fontSize: 28, lineHeight: 32, marginTop: 8 }} center>
        {client ? `Ready to capture — ${client.name}` : 'Ready to capture a session'}
      </AppText>
      <AppText variant="body" color="ink2" center style={{ marginTop: 10, maxWidth: 460 }}>
        {hasGroq
          ? 'In demo mode Aira transcribes and drafts in the cloud (Groq). You review and sign every note; the draft and transcript stay on this device.'
          : 'Aira transcribes then drafts a note. You review and sign every note. (Demo services aren’t configured — this runs on a sample transcript.)'}
      </AppText>

      {client ? (
        <Card style={{ width: '100%', marginTop: theme.spacing.xl }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={12}>
              <Avatar initials={client.initials} size={44} />
              <View>
                <AppText variant="bodyStrong" style={{ fontSize: 16 }}>
                  {client.name}
                </AppText>
                <AppText variant="small" color="ink3">
                  Session {client.sessionNumber} · latest PHQ-9 {client.latestScore ?? '—'}
                </AppText>
              </View>
            </Row>
          </Row>
          {client.lastPlan.length ? (
            <Card tone="sunken" elevation="none" radius="md" style={{ marginTop: 14, backgroundColor: c.brandBg, borderColor: c.brandBd }}>
              <AppText variant="bodyStrong" tint={c.brand} style={{ marginBottom: 12 }}>
                Reminders from last session
              </AppText>
              <Highlights items={client.lastPlan.map((p) => ({ text: p.text }))} />
            </Card>
          ) : null}
        </Card>
      ) : (
        <Card style={{ width: '100%', marginTop: theme.spacing.xl }}>
          <AppText variant="label" color="ink3" uppercase style={{ marginBottom: 8 }}>
            Client name (optional)
          </AppText>
          <TextInput
            value={name}
            onChangeText={onName}
            placeholder="e.g. a first name or initials"
            placeholderTextColor={c.ink3}
            autoCapitalize="words"
            style={{
              borderWidth: 1,
              borderColor: c.line,
              borderRadius: theme.radii.sm,
              paddingVertical: 12,
              paddingHorizontal: 14,
              color: c.ink,
              fontFamily: theme.type.body.fontFamily,
              fontSize: 15,
            }}
          />
          <AppText variant="small" color="ink3" style={{ marginTop: 8, fontSize: 11.5 }}>
            The captured session is added to your caseload afterwards. Names stay on this device.
          </AppText>
        </Card>
      )}

      <View style={{ height: theme.spacing.xxl }} />
      <Pressable
        onPress={onRecord}
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
        {canRecord ? 'Tap to start capture' : 'Tap to begin'}
      </AppText>
      <AppText variant="small" color="ink3" center style={{ marginTop: 6, maxWidth: 420 }}>
        The mascot stays away here — recording a real session isn’t a cute moment.
      </AppText>

      {/* Alternative inputs — upload a clip, or use a sample when there's no mic. */}
      <Row gap={16} style={{ marginTop: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
        {canUpload ? (
          <Pressable onPress={onUpload} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Row gap={7}>
              <FileUpIcon size={15} color={c.brand} strokeWidth={2} />
              <AppText variant="bodyStrong" tint={c.brand} style={{ fontSize: 13 }}>
                Upload an audio file
              </AppText>
            </Row>
          </Pressable>
        ) : null}
        <Pressable onPress={onUseSample} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <AppText variant="bodyStrong" color="ink3" style={{ fontSize: 13 }}>
            Use sample audio
          </AppText>
        </Pressable>
      </Row>

      <View style={{ height: 16 }} />
      <TrustPill label={hasGroq ? 'Draft & transcript stay on this device' : 'On-device · nothing uploaded'} icon={<ShieldIcon size={13} color={c.brand} />} />
    </View>
  );
}

/* ---------------------------------------------------------------- recording */

function Recording({
  displayName,
  sessionNumber,
  live,
  onStop,
  onUpload,
}: {
  displayName: string;
  sessionNumber: number;
  live: boolean;
  onStop: () => void;
  onUpload: () => void;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const [seconds, setSeconds] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!live) return;
    timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [live]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <View style={{ alignItems: 'center', paddingTop: theme.spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.riskBg, borderRadius: theme.radii.pill, paddingVertical: 8, paddingHorizontal: 16 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.riskFill }} />
        <AppText variant="bodyStrong" tint={c.risk}>
          {live ? 'Recording' : 'Ready'} · Session {sessionNumber} with {displayName}
        </AppText>
      </View>
      <AppText variant="display" style={{ fontSize: 56, lineHeight: 62, marginTop: 20, fontFamily: theme.type.numeric.fontFamily }}>
        {mm}:{ss}
      </AppText>
      <View style={{ height: 18 }} />
      <Waveform bars={13} />

      {!live ? (
        <Card tone="sunken" elevation="none" radius="md" style={{ marginTop: 20, maxWidth: 520, backgroundColor: c.cautionBg, borderColor: c.cautionBg }}>
          <Row gap={9} style={{ alignItems: 'flex-start' }}>
            <View style={{ marginTop: 1 }}>
              <AlertTriangleIcon size={15} color={c.caution} />
            </View>
            <AppText variant="small" tint={c.caution} style={{ flex: 1, lineHeight: 17 }}>
              Live microphone capture isn’t available here. Upload an audio clip, or stop to transcribe a sample
              session so you can see the draft.
            </AppText>
          </Row>
        </Card>
      ) : (
        <View style={{ alignItems: 'center', marginTop: 22, maxWidth: 520 }}>
          <AppText variant="label" color="ink3" uppercase>
            Capturing on this device
          </AppText>
          <AppText variant="small" color="ink3" center style={{ marginTop: 8 }}>
            Audio is held on this device; in demo mode it’s sent for transcription when you stop.
          </AppText>
        </View>
      )}

      <RecordingNotes liveTs={`${mm}:${ss}`} />

      <View style={{ height: 22 }} />
      <Row gap={12} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button title="Stop & transcribe" variant="secondary" size="lg" leftIcon={<StopIcon size={16} color={c.risk} />} onPress={onStop} />
        {isUploadSupported() ? (
          <Button title="Upload a clip instead" variant="ghost" leftIcon={<FileUpIcon size={15} color={c.brand} strokeWidth={2} />} onPress={onUpload} />
        ) : null}
      </Row>
      <AppText variant="small" color="ink3" center style={{ marginTop: 18, maxWidth: 420, lineHeight: 18 }}>
        <AppText variant="bodyStrong" color="ink2" style={{ fontSize: 12.5 }}>
          Nothing is authoritative yet — this is a draft you will review and sign.
        </AppText>{' '}
        When you stop, Aira transcribes, drafts the note, then deletes the recording (unless you keep it).
      </AppText>
    </View>
  );
}

type Comment = { id: string; ts: string; text: string };

/** "Comment on your recording" strip — the dotted add card is first; comments are editable. */
function RecordingNotes({ liveTs }: { liveTs: string }) {
  const theme = useTheme();
  const c = theme.colors;
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const nextId = useRef(0);
  const scroller = useRef<ScrollView>(null);

  const add = () => {
    const text = draft.trim();
    if (!text) return;
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

function TimePill({ label, live }: { label: string; live?: boolean }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View style={{ backgroundColor: live ? c.riskBg : c.brandBg, borderRadius: theme.radii.xs, paddingVertical: 3, paddingHorizontal: 7 }}>
      <AppText variant="small" tint={live ? c.risk : c.brand} style={{ fontSize: 11, fontFamily: theme.type.numeric.fontFamily }}>
        {label}
      </AppText>
    </View>
  );
}

/* ---------------------------------------------------------------- analysing */

type Stage = 'preparing' | 'transcribing' | 'deidentifying' | 'ready' | 'drafting' | 'error';

function Analysing({
  capture,
  client,
  name,
  onDrafted,
}: {
  capture: CaptureRef;
  client: ReturnType<typeof useClient>;
  name: string;
  onDrafted: (note: DraftNote) => void;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const [stage, setStage] = useState<Stage>('preparing');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const controller = useRef(new AbortController());

  useEffect(() => {
    const ctrl = controller.current;
    // The "sample audio" path can't be sent to the cloud (there's no real clip) — transcribe it
    // with the on-device mock so it yields a real canned transcript for the summarizer.
    const service = capture.uri.startsWith('mock://') ? new MockTranscriptionService(1) : transcriptionService;
    (async () => {
      try {
        const result = await service.transcribe(capture, { onStage: setStage, signal: ctrl.signal });
        setTranscript(result.text || '');
        setStage('ready');
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setError('Transcription failed — type or paste the transcript below, then draft the note.');
        setStage('ready');
      }
    })();
    return () => ctrl.abort();
  }, [capture]);

  const draftAndContinue = async () => {
    const trimmed = transcript.trim();
    if (!trimmed) return;
    setError(null);
    setStage('drafting');
    const input = {
      transcript: trimmed,
      clientName: client?.name ?? name,
      sessionNumber: client?.sessionNumber ?? 1,
      durationMs: capture.durationMs,
    };
    try {
      const note = await summarizationService.summarize(input, { signal: controller.current.signal });
      onDrafted(note);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError('Drafting failed — nothing was drafted. Check your connection, review the transcript below, and try again.');
      setStage('ready');
    }
  };

  const label =
    stage === 'deidentifying'
      ? 'De-identifying…'
      : stage === 'transcribing'
        ? 'Transcribing…'
        : stage === 'drafting'
          ? 'Drafting the note…'
          : stage === 'ready'
            ? 'Transcript ready — review before drafting'
            : 'Preparing…';

  const working = stage === 'preparing' || stage === 'transcribing' || stage === 'deidentifying' || stage === 'drafting';
  const transcriptEmpty = transcript.trim().length === 0;

  return (
    <View style={{ paddingTop: theme.spacing.lg }}>
      <Card tone="sunken" elevation="none" radius="lg" style={{ backgroundColor: c.brandBg, borderColor: c.brandBd }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={12} style={{ flex: 1 }}>
            {working ? (
              <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 3, borderColor: c.brandBd, borderTopColor: c.brand }} />
            ) : (
              <ShieldIcon size={22} color={c.brand} />
            )}
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{stage === 'drafting' ? 'Drafting clinical sections…' : 'Analysing transcript…'}</AppText>
              <AppText variant="small" color="ink3" style={{ marginTop: 2 }}>
                {label} · {hasGroq ? 'demo mode (cloud)' : 'on-device mock'}
              </AppText>
            </View>
          </Row>
        </Row>
      </Card>

      {error ? (
        <Row gap={9} style={{ alignItems: 'flex-start', marginTop: theme.spacing.md }}>
          <View style={{ marginTop: 1 }}>
            <AlertTriangleIcon size={15} color={c.caution} />
          </View>
          <AppText variant="small" tint={c.caution} style={{ flex: 1, lineHeight: 17 }}>
            {error}
          </AppText>
        </Row>
      ) : null}

      {working && stage !== 'drafting' ? (
        <>
          <View style={{ height: theme.spacing.xl }} />
          {[0.42, 0.9, 0.85, 0.6, 0, 0.4, 0.82].map((w, i) => (
            <View
              key={i}
              style={{ height: w === 0 ? 14 : 12, width: w === 0 ? 0 : `${w * 100}%`, backgroundColor: c.brandBg, borderRadius: 6, marginBottom: 14 }}
            />
          ))}
        </>
      ) : null}

      {/* Editable transcript — fix mishears/names before drafting. */}
      <View style={{ marginTop: theme.spacing.md, backgroundColor: c.positiveBg, borderRadius: theme.radii.lg, borderWidth: 1, borderColor: c.positiveBg, padding: theme.spacing.lg }}>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          <FileUpIcon size={15} color={c.positive} strokeWidth={2} />
          <AppText variant="bodyStrong" tint={c.positive} style={{ fontSize: 12.5 }}>
            Transcript · editable
          </AppText>
          <AppText variant="small" color="ink3" style={{ fontSize: 11 }}>
            fix any mishears or names before the draft is finalised
          </AppText>
        </Row>
        <View style={{ height: 10 }} />
        <TextInput
          multiline
          value={transcript}
          onChangeText={setTranscript}
          editable={!working}
          placeholder={working ? 'Transcribing…' : 'Transcript will appear here.'}
          placeholderTextColor={c.ink3}
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
        {!working && transcriptEmpty ? (
          <AppText variant="small" color="ink3" style={{ marginBottom: 8 }}>
            Add or edit the transcript before drafting.
          </AppText>
        ) : null}
        <Button
          title={stage === 'drafting' ? 'Drafting…' : 'Next → draft the note'}
          variant="primary"
          loading={stage === 'drafting'}
          disabled={working || transcriptEmpty}
          onPress={draftAndContinue}
        />
      </View>
    </View>
  );
}
