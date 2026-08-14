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
import { cloudSessionReady, isCloudSessionRequiredError } from '../../../services/cloudSession';
import { summarizationService } from '../../../services/summarization';
import {
  CaptureRef,
  MockTranscriptionService,
  isSampleCapture,
  isTranscriptionUnavailableError,
  transcriptionService,
} from '../../../services/transcription';
import { useTheme } from '../../../theme/ThemeProvider';

type Phase = 'precapture' | 'recording' | 'analysing';

/** A local mock audio clip (silence) so the flow demos end-to-end with no mic and no upload. */
function mockCaptureRef(): CaptureRef {
  return { uri: 'mock://session', durationMs: 47 * 60 * 1000 };
}

/**
 * The one route to a Supabase session token: the unlock screen's email/password sign-in. `next`
 * brings the counselor back here afterwards (validated there by `safeNext`).
 */
function SignInToCloud({ label, returnTo }: { label: string; returnTo: string }) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/unlock?next=${encodeURIComponent(returnTo)}`)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <Row gap={7}>
        <ShieldIcon size={14} color={theme.colors.brand} />
        <AppText variant="bodyStrong" tint={theme.colors.brand} style={{ fontSize: 13 }}>
          {label}
        </AppText>
      </Row>
    </Pressable>
  );
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

  const returnTo = client ? `/(app)/session?clientId=${client.id}` : '/(app)/session';

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
          returnTo={returnTo}
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
        <Analysing
          capture={capture.current ?? mockCaptureRef()}
          client={client ?? undefined}
          name={name}
          onDrafted={onDrafted}
          returnTo={returnTo}
        />
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
  returnTo,
}: {
  client: ReturnType<typeof useClient>;
  name: string;
  onName: (v: string) => void;
  onRecord: () => void;
  onUpload: () => void;
  onUseSample: () => void;
  returnTo: string;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const canRecord = isRecordingSupported();
  const canUpload = isUploadSupported();
  // Say BEFORE the mic opens that the cloud isn't reachable, so the choice is informed rather than
  // discovered after a session has been recorded. Never a gate — recording stays available either way.
  const [cloudReady, setCloudReady] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    cloudSessionReady().then((ready) => {
      if (alive) setCloudReady(ready);
    });
    return () => {
      alive = false;
    };
  }, []);
  const cloudSignedOut = hasGroq && cloudReady === false;

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
          ? 'In demo mode Airava transcribes and drafts in the cloud (Groq). You review and sign every note; the draft and transcript stay on this device.'
          : 'Demo services aren’t configured, so this build has no automatic transcription. You can still record: type or paste the transcript afterwards and Airava drafts the note on this device, with nothing sent anywhere. “Use sample audio” runs the full walkthrough on a built-in demo clip.'}
      </AppText>

      {cloudSignedOut ? (
        <Row
          gap={10}
          style={{
            alignItems: 'flex-start',
            marginTop: theme.spacing.lg,
            maxWidth: 460,
            backgroundColor: c.sunken,
            borderColor: c.line,
            borderWidth: 1,
            borderRadius: theme.radii.md,
            padding: theme.spacing.md,
          }}
        >
          <View style={{ marginTop: 1 }}>
            <ShieldIcon size={15} color={c.ink3} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="small" color="ink2" style={{ lineHeight: 17 }}>
              Cloud transcription needs a live sign-in, and this device doesn’t have one right now. You can
              record anyway — you’ll type or paste the transcript afterwards and Airava will draft the note
              on this device, with nothing sent anywhere. Or sign in first to transcribe this session in the
              cloud.
            </AppText>
            <View style={{ height: 10 }} />
            <SignInToCloud label="Sign in to use cloud transcription" returnTo={returnTo} />
          </View>
        </Row>
      ) : null}

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
        When you stop, Airava transcribes, drafts the note, then deletes the recording (unless you keep it).
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

/**
 * Guard against drafting a confident clinical note from a failed/empty/near-silent recording (F11).
 * A dead mic, a muted input or a failed upload yields transcripts like "you you you you" or a few
 * stray words; those must NOT be written up as clinical findings about the patient. The clinician can
 * still fix the transcript by hand and retry — this only blocks auto-drafting from noise.
 */
function transcriptQuality(text: string): 'ok' | 'too-short' | 'low-signal' {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 12) return 'too-short';
  const norm = words.map((w) => w.toLowerCase().replace(/[^\p{L}]/gu, '')).filter(Boolean);
  const unique = new Set(norm);
  if (norm.length && unique.size / norm.length < 0.3) return 'low-signal';
  const counts = new Map<string, number>();
  norm.forEach((w) => counts.set(w, (counts.get(w) ?? 0) + 1));
  const dominant = Math.max(0, ...counts.values());
  if (norm.length && dominant / norm.length > 0.5) return 'low-signal';
  return 'ok';
}

/**
 * A lightweight, NON-blocking check (C3): does the transcript read like clinical/session content, or
 * like passive room noise / a phone call / off-topic chatter? Uses length, clinical-keyword variety,
 * and first-person self-report shape. It only drives a dismissible banner — it never blocks drafting.
 */
function looksLikeClinicalText(text: string): boolean {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 20) return true; // too short to judge — emptiness/noise is F11's job, don't nag
  const lower = ` ${text.toLowerCase()} `;
  const CLINICAL = [
    'session', 'feel', 'anxi', 'depress', 'sleep', 'mood', 'therap', 'counsel', 'stress', 'worry',
    'worried', 'cope', 'coping', 'support', 'exam', 'panic', 'medication', 'safety', 'symptom',
    'emotion', 'relationship', 'family', 'school', 'overwhelm', 'breathing', 'plan', 'week',
    // Clinician-voice (third-person) framing: a real note-taking transcript is often written ABOUT
    // the client rather than in their own first-person words, so the vocabulary must cover both.
    'client', 'patient', 'report', 'present', 'attend', 'screen', 'ideation', 'self-harm',
    'cognitive', 'reframe', 'fortnight', 'academic', 'pressure', 'engag', 'affect', 'discuss',
    'denie', 'denied', 'agreed', 'goal', 'homework', 'referral', 'follow-up', 'intake',
  ];
  const keywordHits = CLINICAL.filter((k) => lower.includes(k)).length;
  const firstPerson = (lower.match(/\b(i|i'm|im|my|me|myself|we)\b/g) ?? []).length;
  // Clinical if it has a spread of clinical vocabulary, or reads as first-person self-report that
  // is at least ON a clinical topic — first-person density alone is ordinary conversational shape
  // (a phone call about an invoice scores the same as a client describing their week).
  return keywordHits >= 3 || (keywordHits >= 1 && firstPerson >= words.length * 0.04);
}

function Analysing({
  capture,
  client,
  name,
  onDrafted,
  returnTo,
}: {
  capture: CaptureRef;
  client: ReturnType<typeof useClient>;
  name: string;
  onDrafted: (note: DraftNote) => void;
  returnTo: string;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const [stage, setStage] = useState<Stage>('preparing');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Only the missing-Supabase-session case, so the sign-in affordance below tells the counselor what
  // to DO — a generic transcription/drafting failure gets the message alone.
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [clinicalWarnDismissed, setClinicalWarnDismissed] = useState(false);
  // Whether a cloud draft is actually reachable, so the in-flight label can name the drafting hop
  // truthfully — the summarizer drafts on-device when there is no session token.
  const [cloudReady, setCloudReady] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    cloudSessionReady().then((ready) => {
      if (alive) setCloudReady(ready);
    });
    return () => {
      alive = false;
    };
  }, []);
  const controller = useRef(new AbortController());
  const isMockCapture = isSampleCapture(capture.uri);
  // TWO separate facts, both observed rather than configured, because they come apart. The upload is
  // disclosed from the moment it is ISSUED — the cloud transcriber POSTs the audio and only then sees
  // a 429/5xx, so a failure after that point still means the recording left this device. The
  // transcript is only CLAIMED as machine-produced when a cloud transcription actually returned one:
  // after a failed upload the clinician types the text themselves, and the note must not call that
  // whisper output. A `mock://` capture uploads nothing and a rejected no-session call sends nothing,
  // so both stay false there.
  const [audioLeftDevice, setAudioLeftDevice] = useState(false);
  const [transcriptFromCloud, setTranscriptFromCloud] = useState(false);

  useEffect(() => {
    const ctrl = controller.current;
    // The "sample audio" path can't be sent to the cloud (there's no real clip) — transcribe it
    // with the on-device mock so it yields a real canned transcript for the summarizer.
    const wentToCloud = hasGroq && !isMockCapture;
    const service = isMockCapture ? new MockTranscriptionService(1) : transcriptionService;
    (async () => {
      setAudioLeftDevice(false);
      setTranscriptFromCloud(false);
      setNeedsSignIn(false);
      try {
        const result = await service.transcribe(capture, {
          onStage: (s) => {
            // `transcribing` is the cloud transcriber's hand-off to the network (see its doc).
            if (s === 'transcribing' && wentToCloud) setAudioLeftDevice(true);
            setStage(s);
          },
          signal: ctrl.signal,
        });
        // A 200 carrying no text is not a transcript: whisper answers a silent or badly-encoded clip
        // with `{text: ""}`. The upload still happened, but there is nothing of the model's in the
        // note, so only the disclosure flips — anything the clinician then types stays their own.
        const cloudText = (result.text ?? '').trim();
        setTranscript(cloudText);
        setAudioLeftDevice(wentToCloud);
        setTranscriptFromCloud(wentToCloud && cloudText.length > 0);
        setStage('ready');
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        const noSession = isCloudSessionRequiredError(e);
        // Signing in fixes a missing session; it cannot conjure an engine that isn't in this build,
        // so the sign-in affordance stays off for that one.
        setNeedsSignIn(noSession);
        setError(
          noSession
            ? 'Cloud transcription needs a live sign-in — nothing was sent and this recording stayed on this device. Type or paste the transcript below and Airava will draft the note on this device. Signing in enables cloud transcription for your next capture; it can’t transcribe the recording you just made, and leaving this screen discards it.'
            : isTranscriptionUnavailableError(e)
              ? 'This build has no automatic transcription, so nothing was transcribed and nothing was sent anywhere. Type or paste the transcript below and Airava will draft the note on this device.'
              : 'Transcription failed — type or paste the transcript below, then draft the note.',
        );
        setStage('ready');
      }
    })();
    return () => ctrl.abort();
  }, [capture, isMockCapture]);

  const draftAndContinue = async () => {
    const trimmed = transcript.trim();
    if (!trimmed) return;
    // Don't draft a clinical note from silence/noise — surface why and let the clinician fix the
    // transcript first (F11). Editing the text below to real content clears this.
    const quality = transcriptQuality(trimmed);
    if (quality !== 'ok') {
      setNeedsSignIn(false);
      setError(
        quality === 'too-short'
          ? 'This capture is too short to draft a reliable note. Check the recording or upload, or paste the session transcript below, then draft.'
          : 'This capture didn’t contain enough clear speech to draft from (a dead mic, muted input, or failed upload can cause this). Re-capture or paste the real transcript below — Airava won’t write up a note from an unclear recording.',
      );
      return;
    }
    setError(null);
    setNeedsSignIn(false);
    setStage('drafting');
    const input = {
      transcript: trimmed,
      clientName: client?.name ?? name,
      sessionNumber: client?.sessionNumber ?? 1,
      durationMs: capture.durationMs,
      audioLeftDevice,
      transcriptFromCloud,
      sampleCapture: isMockCapture,
    };
    try {
      const note = await summarizationService.summarize(input, { signal: controller.current.signal });
      // Persist the real transcript alongside the note (the exact text the clinician reviewed and drafted
      // from) so the review screen's Transcript tab can show the actual session — not placeholder prose —
      // and a clinician can later check the note against it. Rides on the note through the vault seam,
      // together with how this capture was actually transcribed and drafted (the summarizer stamps
      // every provenance field itself, from the input it was given and the service that really
      // produced this draft), so every provenance line on the review screen stays true for this note
      // however the app is configured when it is read.
      onDrafted({ ...note, transcript: trimmed });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      // Drafting has no no-session failure mode: with no token the summarizer drafts on-device over
      // this same text. Anything reaching here is a real failure (network, proxy, malformed reply).
      setError('Drafting failed — nothing was drafted. Check your connection, review the transcript below, and try again.');
      setStage('ready');
    }
  };

  const label =
    stage === 'deidentifying'
      ? // F9: in demo mode the audio goes to the cloud and nothing is de-identified on the way —
        // only the no-keys on-device path may claim that step.
        hasGroq
        ? 'Finalising…'
        : 'De-identifying…'
      : stage === 'transcribing'
        ? 'Transcribing…'
        : stage === 'drafting'
          ? 'Drafting the note…'
          : stage === 'ready'
            ? 'Transcript ready — review before drafting'
            : 'Preparing…';

  // The sublabel names the hop the CURRENT stage is running, because the two hops route
  // independently: a `mock://` capture is transcribed on-device yet its transcript text is still
  // drafted in the cloud when the proxy is configured AND a session token exists. Claiming
  // "on-device mock" while the transcript is in flight to Groq would under-disclose a real cloud hop;
  // while the check is still in flight we assume the cloud, which errs toward disclosure.
  const cloudHop =
    stage === 'drafting' ? cloudReady ?? hasGroq : stage === 'ready' ? audioLeftDevice : hasGroq && !isMockCapture;

  const working = stage === 'preparing' || stage === 'transcribing' || stage === 'deidentifying' || stage === 'drafting';
  const transcriptEmpty = transcript.trim().length === 0;
  // C3: a non-blocking nudge when the transcript doesn't read like clinical/session content.
  const showClinicalWarn = !working && !transcriptEmpty && !clinicalWarnDismissed && !looksLikeClinicalText(transcript);

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
                {label} · {cloudHop ? 'demo mode (cloud)' : 'on-device mock'}
              </AppText>
            </View>
          </Row>
        </Row>
      </Card>

      {error ? (
        <View style={{ marginTop: theme.spacing.md }}>
          <Row gap={9} style={{ alignItems: 'flex-start' }}>
            <View style={{ marginTop: 1 }}>
              <AlertTriangleIcon size={15} color={c.caution} />
            </View>
            <AppText variant="small" tint={c.caution} style={{ flex: 1, lineHeight: 17 }}>
              {error}
            </AppText>
          </Row>
          {needsSignIn ? (
            <View style={{ marginTop: 10, marginLeft: 24 }}>
              <SignInToCloud label="Sign in for cloud transcription on the next capture" returnTo={returnTo} />
            </View>
          ) : null}
        </View>
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

      {/* C3: dismissible "doesn't look like clinical text" banner ABOVE the transcript — never blocks. */}
      {showClinicalWarn ? (
        <Row
          gap={10}
          style={{
            marginTop: theme.spacing.md,
            alignItems: 'flex-start',
            backgroundColor: c.cautionBg,
            borderRadius: theme.radii.md,
            borderWidth: 1,
            borderColor: c.cautionBg,
            padding: theme.spacing.md,
          }}
        >
          <View style={{ marginTop: 1 }}>
            <AlertTriangleIcon size={15} color={c.caution} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong" tint={c.caution} style={{ fontSize: 13 }}>
              This doesn’t look like clinical text
            </AppText>
            <AppText variant="small" color="ink2" style={{ marginTop: 2, lineHeight: 17 }}>
              It may be room noise, a phone call, or off-topic. Review the transcript below before drafting —
              you can still proceed.
            </AppText>
          </View>
          <Pressable
            onPress={() => setClinicalWarnDismissed(true)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingHorizontal: 4 })}
          >
            <AppText variant="small" tint={c.caution} style={{ fontSize: 12 }}>
              Dismiss
            </AppText>
          </Pressable>
        </Row>
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
