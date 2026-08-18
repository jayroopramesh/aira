import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { ClientLink } from '../../../components/ClientLink';
import { Highlights } from '../../../components/Highlights';
import { Screen } from '../../../components/Screen';
import { Waveform } from '../../../components/Waveform';
import { AlertTriangleIcon, FileUpIcon, MicIcon, PauseIcon, PencilIcon, PlayIcon, PlusIcon, ShieldIcon, SparklesIcon, StopIcon } from '../../../components/icons';
import { AppText, Button, Card, Row, TrustPill } from '../../../components/ui';
import { useClient, useClientNotes, useData } from '../../../data/DataProvider';
import { isValidEmiratesId } from '../../../data/sessionClient';
import { DraftNote, RecordingComment } from '../../../data/types';
import { RecordingAddition } from '../../../data/appendRecording';
import { formatTimestamp } from '../../../utils/formatTimestamp';
import { addAudioSegment, setOriginalAudioSegment } from '../../../services/audioVault';
import {
  ActiveRecording,
  failedCaptureRef,
  isRecordingSupported,
  isUploadSupported,
  pickAudioFile,
  startRecording,
} from '../../../services/audioCapture';
import { hasGroq } from '../../../config/env';
import { cloudSessionReady, isCloudSessionRequiredError } from '../../../services/cloudSession';
import { speakerSeparationService, SpeakerTurn } from '../../../services/speakerSeparation';
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

/**
 * Scribe options (round-2 item 1, 2026-08-17): "patient session" is a real session that can carry more
 * than one voice, so it gets the speaker-separation pass; "retrospective" is the clinician talking to
 * themselves about a session that already happened, so the whole transcript is assumed to be the
 * therapist and no separation pass runs.
 */
type ScribeMode = 'patient' | 'retrospective';

/**
 * The built-in sample clip, so the flow demos end-to-end with no mic and no upload.
 *
 * ONLY the two paths where the counselor knowingly asked for the demo may use this — "Use sample
 * audio", and stopping when there is no live recorder (the Recording screen says so on screen). It is
 * never a fallback for a real recording that went wrong: `mock://` is what licenses the canned
 * transcript and the canned walkthrough note, so pointing it at a real session would attach invented
 * words and an invented diagnosis to an actual client. Use `failedCaptureRef()` for that.
 */
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
  const { clientId, mode: routeMode, note: noteParam } = useLocalSearchParams<{ clientId: string; mode?: string; note?: string }>();
  const client = useClient(clientId);
  const { saveSessionNote, appendRecording, hydrated } = useData();

  // "Continue recording" (as opposed to "Re-record", the ordinary entry to this screen) — the review
  // screen's ContinueRecordingAction threads `mode=append&note=<noteIndex>` alongside `clientId`, mirroring
  // how re-record threads its own context. The target note must exist and be unsigned (a signed note
  // is read-only, enforced again at `appendRecording`'s own seam) — anything else bounces back to
  // review rather than silently starting an unrelated fresh capture under an append URL.
  const notes = useClientNotes(clientId);
  const appendNoteIndex = routeMode === 'append' && noteParam !== undefined && /^\d+$/.test(noteParam) ? Number(noteParam) : undefined;
  const appendTarget = appendNoteIndex !== undefined ? notes[appendNoteIndex] : undefined;
  const appendMode = appendNoteIndex !== undefined && !!appendTarget && appendTarget.status !== 'signed';
  useEffect(() => {
    if (!hydrated || appendNoteIndex === undefined || appendMode) return;
    router.replace(client ? `/(app)/session/review?clientId=${encodeURIComponent(client.id)}` : '/(app)/today');
  }, [hydrated, appendNoteIndex, appendMode, client, router]);

  const [phase, setPhase] = useState<Phase>('precapture');
  const [mode, setMode] = useState<ScribeMode>('patient');
  const [name, setName] = useState('');
  // Optional Emirates ID for a NEW client — the local uniqueness key. When it matches someone already
  // on the caseload the capture folds into that record instead of minting a duplicate patient.
  const [emiratesId, setEmiratesId] = useState('');
  const capture = useRef<CaptureRef | null>(null);
  const recording = useRef<ActiveRecording | null>(null);
  // Set when the recorder ends on its OWN (mic unplugged, permission revoked mid-session) rather than
  // from an explicit Stop tap — lets the Recording screen say plainly why it stopped short instead of
  // silently finalising whatever partial audio exists like an ordinary Stop.
  const [streamInterrupted, setStreamInterrupted] = useState(false);
  // Comments typed on the recording screen (RecordingNotes reports every change up here, in
  // chronological order, including a still-unsubmitted draft). They outlive the recording phase so
  // the "kept with the note" promise holds: `onDrafted` stamps them onto the freshly drafted note
  // and `onAppended` threads them into the append merge — they must never die with the recording
  // UI's local state.
  const recordingComments = useRef<RecordingComment[]>([]);
  // Asked once for the whole screen so the pre-capture notice, the in-flight recording copy and the
  // analysing label all promise the same thing. `null` while the check is in flight.
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

  const displayName = client?.name ?? (name.trim() || 'this session');

  // WHOSE session is this? A linked client, a typed name, or a typed Emirates ID makes it a real
  // person's session — and the fabrication line says the canned sample may never analyse under a
  // real identity, because its invented transcript, working code and "47-min voice note" provenance
  // would be saved into that person's record as an ordinary (non-sample) note. Only a fully
  // anonymous capture may fall back to the demo clip.
  const hasRealIdentity = !!client || name.trim().length > 0 || emiratesId.trim().length > 0;

  // Double-tap guards for the two async capture transitions. Both hold an `await` open while their
  // trigger button is still on screen, so a second tap used to re-enter mid-transition: on Record it
  // opened a SECOND mic stream (the first leaked, never stopped); on Stop it found `recording.current`
  // already nulled and fell into the no-recorder branch — answering a session someone REALLY recorded
  // with the demo sample's canned transcript (anonymous) or discarding it into the failed-capture
  // path (named). Refs, not state: they must flip synchronously, before the second tap's handler runs.
  // `stopping` stays latched until a new recording phase begins (`beginRecording` resets it) because
  // the Stop button remains pressable until React unmounts the Recording screen — a reset any earlier
  // reopens the same no-recorder branch to a third rapid tap.
  const starting = useRef(false);
  const stopping = useRef(false);

  const beginRecording = async () => {
    if (starting.current) return;
    starting.current = true;
    setStreamInterrupted(false);
    try {
      recording.current = await startRecording(() => setStreamInterrupted(true));
    } catch {
      recording.current = null; // mic denied/unsupported — the recording screen offers fallbacks
    } finally {
      starting.current = false;
    }
    stopping.current = false;
    setPhase('recording');
  };

  // Explicit Cancel on the recording screen (fix-these #12): stops any live tracks (no mic leak) and
  // discards the in-progress clip rather than analysing it, back to precapture.
  const cancelRecording = async () => {
    if (recording.current) {
      const active = recording.current;
      recording.current = null;
      await active.stop().catch(() => {});
    }
    setStreamInterrupted(false);
    setPhase('precapture');
  };

  const goAnalyse = (ref: CaptureRef) => {
    capture.current = ref;
    setPhase('analysing');
  };

  const stopAndAnalyse = async () => {
    if (stopping.current) return;
    stopping.current = true;
    if (recording.current) {
      const active = recording.current;
      recording.current = null;
      // A real session was just recorded. If it cannot be finalised the capture stays REAL, so it
      // takes the real path and is refused rather than answered with the sample's canned words.
      const ref = await active.stop().catch(() => failedCaptureRef());
      goAnalyse(ref);
    } else {
      // No recorder ever started — the Recording screen said so. With no identity attached there is
      // nobody to misattribute the demo clip to, so the sample is the honest thing to analyse. But a
      // capture that names a real client must NEVER be answered with the sample's canned words
      // ("Denies passive ideation on screening today" is a safety finding nobody made about them) —
      // it takes the failed-capture path instead, which lands in the type/paste recovery the
      // pre-capture screen promised.
      goAnalyse(hasRealIdentity ? failedCaptureRef() : mockCaptureRef());
    }
  };

  const onUpload = async () => {
    const ref = await pickAudioFile();
    if (ref) {
      if (recording.current) {
        await recording.current.stop().catch(() => {});
        recording.current = null;
      }
      // A picked file is the capture now — latch the stop guard so a straggling Stop tap can't
      // find the recorder gone and overwrite this capture with the demo sample.
      stopping.current = true;
      goAnalyse(ref);
    }
  };

  const onDrafted = async (note: DraftNote) => {
    // Recording-screen comments ride on the note here — the capture UI is their ONLY source (they
    // never pass through the summarizer, whose input text is what goes to the cloud), so the one
    // call site that has them is the honest place to attach them.
    const comments = recordingComments.current;
    if (comments.length) note = { ...note, recordingComments: comments };
    const { clientId: id, isDuplicate, adoptedEmiratesId, nameConflict, idNameConflict } = await saveSessionNote(note, {
      clientId: client?.id,
      name: client ? undefined : name,
      emiratesId: client ? undefined : emiratesId,
    });
    // A duplicate Emirates ID folded into an existing client — open that record and tell the counselor
    // plainly, rather than silently landing on what looks like a brand-new note. An ADOPTION folded too,
    // but on the NAME (the id was saved onto that record just now, not already on file), so it gets its
    // own honest wording. Otherwise a separate record was minted on purpose (never merge two people) and
    // review says why: the Emirates ID is on file under another NAME (the likelier mis-entry, so it
    // wins), or a same-named client exists that the id vetoed folding into. Mutually exclusive.
    const notice = isDuplicate
      ? adoptedEmiratesId
        ? '&adopted=1'
        : '&existing=1'
      : idNameConflict
        ? '&idconflict=1'
        : nameConflict
          ? '&conflict=1'
          : '';
    // `withNote` (saveSession.ts) always prepends the newest note, so a just-drafted note — folded or
    // freshly minted alike — is always index 0. Real audio only (a mock/failed capture's uri is
    // never a `blob:`, so this is a silent no-op for those, never a fabricated "kept" playback).
    const cap = capture.current;
    if (cap) setOriginalAudioSegment(id, 0, { uri: cap.uri, durationMs: cap.durationMs, kind: 'original', label: 'Original recording' });
    router.replace(`/(app)/session/review?clientId=${id}${notice}`);
  };

  // The append counterpart of `onDrafted`: no summarization runs, no note is minted or folded — the
  // new capture's transcript is spliced onto the SAME note (`appendRecording.ts` owns the merge, the
  // separator, and the provenance honesty) and review re-opens on that exact note.
  const onAppended = async (addition: RecordingAddition) => {
    if (!client || appendNoteIndex === undefined) return;
    const timestampLabel = formatTimestamp(new Date());
    const comments = recordingComments.current;
    if (comments.length) addition = { ...addition, recordingComments: comments };
    await appendRecording(client.id, appendNoteIndex, addition, timestampLabel);
    const cap = capture.current;
    if (cap) addAudioSegment(client.id, appendNoteIndex, { uri: cap.uri, durationMs: cap.durationMs, kind: 'added', label: `Added · ${timestampLabel}` });
    router.replace(`/(app)/session/review?clientId=${encodeURIComponent(client.id)}&note=${appendNoteIndex}`);
  };

  const returnTo = client ? `/(app)/session?clientId=${client.id}` : '/(app)/session';

  return (
    <Screen maxWidth={720}>
      {phase === 'precapture' && (
        <PreCapture
          client={client}
          name={name}
          onName={setName}
          emiratesId={emiratesId}
          onEmiratesId={setEmiratesId}
          mode={mode}
          onMode={setMode}
          onRecord={beginRecording}
          onUpload={onUpload}
          onUseSample={() => goAnalyse(mockCaptureRef())}
          sampleBlocked={hasRealIdentity}
          returnTo={returnTo}
          cloudReady={cloudReady}
          appendTarget={appendMode ? appendTarget : undefined}
        />
      )}
      {phase === 'recording' && (
        <Recording
          displayName={displayName}
          sessionNumber={client?.sessionNumber ?? 1}
          live={!!recording.current}
          activeRecording={recording.current ?? undefined}
          sampleOnStop={!hasRealIdentity}
          onStop={stopAndAnalyse}
          onCancel={cancelRecording}
          streamInterrupted={streamInterrupted}
          onUpload={onUpload}
          onComments={(xs) => {
            recordingComments.current = xs;
          }}
          cloudReady={cloudReady}
          appendTarget={appendMode ? appendTarget : undefined}
        />
      )}
      {phase === 'analysing' && (
        <Analysing
          capture={capture.current ?? failedCaptureRef()}
          client={client ?? undefined}
          name={name}
          mode={mode}
          onDrafted={onDrafted}
          returnTo={returnTo}
          cloudReady={cloudReady}
          appendTarget={appendMode ? appendTarget : undefined}
          onAppend={onAppended}
        />
      )}
    </Screen>
  );
}

/**
 * Shared honesty banner for the three capture phases while `appendTarget` is set — says PLAINLY what
 * "Continue recording" actually does (splice onto the existing note's transcript) so it's never mistaken
 * for Re-record's fresh-note behaviour mid-flow, only readable from a different screen entirely.
 */
function AppendBanner({ sessionLabel }: { sessionLabel: string }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <Row
      gap={9}
      style={{
        alignItems: 'flex-start',
        marginTop: theme.spacing.lg,
        maxWidth: 460,
        alignSelf: 'center',
        backgroundColor: c.brandBg,
        borderColor: c.brandBd,
        borderWidth: 1,
        borderRadius: theme.radii.md,
        padding: theme.spacing.md,
      }}
    >
      <View style={{ marginTop: 1 }}>
        <ShieldIcon size={15} color={c.brand} />
      </View>
      <AppText variant="small" tint={c.brand} style={{ flex: 1, lineHeight: 17 }}>
        Continuing {sessionLabel}. This recording's transcript will be appended to that note, not saved
        as a new one. Nothing else on the note changes automatically.
      </AppText>
    </Row>
  );
}

/* ------------------------------------------------------------- pre-capture */

function PreCapture({
  client,
  name,
  onName,
  emiratesId,
  onEmiratesId,
  mode,
  onMode,
  onRecord,
  onUpload,
  onUseSample,
  sampleBlocked,
  returnTo,
  cloudReady,
  appendTarget,
}: {
  client: ReturnType<typeof useClient>;
  name: string;
  onName: (v: string) => void;
  emiratesId: string;
  onEmiratesId: (v: string) => void;
  mode: ScribeMode;
  onMode: (m: ScribeMode) => void;
  onRecord: () => void;
  onUpload: () => void;
  onUseSample: () => void;
  /** A real identity (linked client or typed name/ID) is attached, so the fictional sample must not
   *  run — tapping it explains instead of filing invented content under that person. */
  sampleBlocked: boolean;
  returnTo: string;
  cloudReady: boolean | null;
  /** Set only in "Continue recording" mode — the note this capture will be appended to, not saved fresh. */
  appendTarget?: DraftNote;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const canRecord = isRecordingSupported();
  const canUpload = isUploadSupported();
  const [sampleRefused, setSampleRefused] = useState(false);
  // Say BEFORE the mic opens that the cloud isn't reachable, so the choice is informed rather than
  // discovered after a session has been recorded. Never a gate — recording stays available either way.
  const cloudSignedOut = hasGroq && cloudReady === false;

  return (
    <View style={{ alignItems: 'center', paddingTop: theme.spacing.lg }}>
      <AppText variant="label" color="brand" uppercase center>
        {client ? `10:30 · Individual · Session ${client.sessionNumber}` : 'New session'}
      </AppText>
      <AppText variant="display" style={{ fontSize: 28, lineHeight: 32, marginTop: 8 }} center>
        {client ? `Ready to capture ${client.name}’s session` : 'Ready to capture a session'}
      </AppText>
      <AppText variant="body" color="ink2" center style={{ marginTop: 10, maxWidth: 460 }}>
        {hasGroq
          ? 'In demo mode Airava transcribes and drafts in the cloud (Groq). You review and sign every note; the draft and transcript stay on this device.'
          : 'Demo services aren’t configured, so this build has no automatic transcription. You can still record: type or paste the transcript afterwards and Airava drafts the note on this device, with nothing sent anywhere. “Use sample audio” runs the full walkthrough on a built-in demo clip.'}
      </AppText>

      {appendTarget ? <AppendBanner sessionLabel={appendTarget.sessionLabel} /> : null}

      <ScribeOptions mode={mode} onMode={onMode} />

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
              record anyway. You’ll type or paste the transcript afterwards and Airava will draft the note
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
            <ClientLink client={client} avatarSize={44} gap={12}>
              <View>
                <AppText variant="bodyStrong" style={{ fontSize: 16 }}>
                  {client.name}
                </AppText>
                <AppText variant="small" color="ink3">
                  Session {client.sessionNumber} · latest PHQ-9 {client.latestScore ?? '—'}
                </AppText>
              </View>
            </ClientLink>
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
          <View style={{ height: 14 }} />
          <AppText variant="label" color="ink3" uppercase style={{ marginBottom: 8 }}>
            Emirates ID (optional)
          </AppText>
          <TextInput
            value={emiratesId}
            onChangeText={onEmiratesId}
            placeholder="784-XXXX-XXXXXXX-X"
            placeholderTextColor={c.ink3}
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
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
          {/* A malformed entry is not treated as an identity (a placeholder two patients might both
              type would otherwise merge them), so say so here rather than letting the counselor believe
              the field is doing work it isn't. Non-blocking — capture proceeds either way. */}
          {emiratesId.trim() && !isValidEmiratesId(emiratesId) ? (
            <AppText variant="small" tint={c.caution} style={{ marginTop: 8, fontSize: 11.5, lineHeight: 16 }}>
              That isn’t a recognised Emirates ID (784 followed by 12 digits), so it won’t be used to identify
              this client. You can still capture the session. It’ll be matched by name instead.
            </AppText>
          ) : null}
          <AppText variant="small" color="ink3" style={{ marginTop: 8, fontSize: 11.5, lineHeight: 16 }}>
            The captured session is added to your caseload afterwards. A valid Emirates ID (784 + 12 digits)
            opens the client saved under it when the name agrees too, or, if the ID is new, saves it onto the
            one client of that name who has no ID yet. If the ID is on file under a different name, or a client
            of that name has a different ID, or more than one shares the name, a separate record is created and
            you’ll be told. Without an ID, the session is matched by name to a client you’ve already captured.
            It stays on this device.
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
        The mascot stays away here. Recording a real session isn’t a cute moment.
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
        <Pressable
          onPress={() => (sampleBlocked ? setSampleRefused(true) : onUseSample())}
          accessibilityRole="button"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <AppText variant="bodyStrong" color="ink3" style={{ fontSize: 13 }}>
            Use sample audio
          </AppText>
        </Pressable>
      </Row>
      {sampleRefused && sampleBlocked ? (
        <AppText variant="small" tint={c.caution} center style={{ marginTop: 10, maxWidth: 420, fontSize: 11.5, lineHeight: 16 }}>
          The sample is a fictional walkthrough, so it can’t be filed under a real client’s record.{' '}
          {client
            ? `Start a new session without ${client.name} attached to see it. Or capture their real session here.`
            : 'Clear the client name and Emirates ID above to see it. Or capture their real session here.'}
        </AppText>
      ) : null}

      <View style={{ height: 16 }} />
      <TrustPill label={hasGroq ? 'Draft & transcript stay on this device' : 'On-device · nothing uploaded'} icon={<ShieldIcon size={13} color={c.brand} />} />
    </View>
  );
}

/**
 * Scribe options (round-2 item 1). "Patient session" is a real session that can carry more than one
 * voice — Airava runs a post-transcription speaker-separation pass and offers to pull a second speaker
 * out into auxiliary notes. "Retrospective" is the clinician talking through a session on their own
 * afterwards — the whole transcript is assumed to be them, so no separation pass runs. Styled after the
 * SOAP/DAP pill switcher on the review screen for a consistent segmented-control shape app-wide.
 */
function ScribeOptions({ mode, onMode }: { mode: ScribeMode; onMode: (m: ScribeMode) => void }) {
  const theme = useTheme();
  const c = theme.colors;
  const OPTIONS: { key: ScribeMode; label: string }[] = [
    { key: 'patient', label: 'Patient session' },
    { key: 'retrospective', label: 'Retrospective' },
  ];
  return (
    <View style={{ width: '100%', marginTop: theme.spacing.lg, alignItems: 'center' }}>
      <AppText variant="label" color="ink3" uppercase style={{ marginBottom: 8 }}>
        Scribe options
      </AppText>
      <Row style={{ borderWidth: 1, borderColor: c.line, borderRadius: theme.radii.pill, overflow: 'hidden' }}>
        {OPTIONS.map((o) => {
          const active = o.key === mode;
          return (
            <Pressable
              key={o.key}
              onPress={() => onMode(o.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={{ paddingVertical: 8, paddingHorizontal: 18, backgroundColor: active ? c.brandBg : 'transparent' }}
            >
              <AppText variant="bodyStrong" tint={active ? c.brand : c.ink3} style={{ fontSize: 13 }}>
                {o.label}
              </AppText>
            </Pressable>
          );
        })}
      </Row>
      <AppText variant="small" color="ink3" center style={{ marginTop: 8, maxWidth: 420, lineHeight: 16 }}>
        {mode === 'patient'
          ? 'This session can have more than one voice. Airava identifies speakers after transcription.'
          : 'Just you talking through the session afterwards. The whole transcript is treated as your own words.'}
      </AppText>
    </View>
  );
}

/* ---------------------------------------------------------------- recording */

function Recording({
  displayName,
  sessionNumber,
  live,
  activeRecording,
  sampleOnStop,
  onStop,
  onCancel,
  streamInterrupted,
  onUpload,
  onComments,
  cloudReady,
  appendTarget,
}: {
  displayName: string;
  sessionNumber: number;
  live: boolean;
  /** The recorder itself — read for pause/resume + real waveform levels only; `live` alone still
   *  decides whether a recorder exists at all. */
  activeRecording?: ActiveRecording;
  /** With no live recorder, whether Stop analyses the demo sample (anonymous capture) or lands in
   *  the type/paste recovery (a real client is attached, so the sample must not run under them). */
  sampleOnStop: boolean;
  onStop: () => void;
  /** Stops any live tracks and discards the in-progress clip, back to precapture (fix-these #12). */
  onCancel: () => void;
  /** The recorder ended on its own (stream loss) rather than from a Stop tap (fix-these #13). */
  streamInterrupted: boolean;
  onUpload: () => void;
  /** Reports the comment strip's current comments (chronological) up to the screen on every change,
   *  so stopping the recording never discards what the clinician typed mid-session. */
  onComments: (comments: RecordingComment[]) => void;
  cloudReady: boolean | null;
  appendTarget?: DraftNote;
}) {
  const theme = useTheme();
  const c = theme.colors;
  // What can this build actually do when Stop is pressed? Promising automatic transcription that
  // will then refuse is a broken promise made at the worst moment — while the counselor is still
  // deciding whether to keep recording. Without a live recorder the sample clip is what gets
  // analysed (and the on-device stub really does transcribe that) — but only for an anonymous
  // capture; with a real client attached, stopping goes to the type/paste recovery instead.
  const willTranscribe = live ? hasGroq && cloudReady !== false : sampleOnStop;
  const [seconds, setSeconds] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // A paused-then-resumed recording is still ONE segment (MediaRecorder keeps writing into the same
  // clip) — distinct from "Continue recording", which appends a whole new segment to an
  // already-drafted note. Gated on `activeRecording.supportsPause` so a build/browser without
  // MediaRecorder.pause() never offers a control that would silently do nothing.
  const [paused, setPaused] = useState(false);
  const canPause = live && !streamInterrupted && !!activeRecording?.supportsPause;
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  useEffect(() => {
    if (!live || paused || streamInterrupted) return;
    timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [live, paused, streamInterrupted]);

  // Pausing/resuming never changes screens, so this can't rely on a remount to reset — flip back to
  // false if a fresh (non-live) Recording mount somehow inherited a stale true from elsewhere.
  useEffect(() => {
    if (!live) setPaused(false);
  }, [live]);

  const togglePause = () => {
    if (!canPause) return;
    if (paused) {
      activeRecording?.resume();
      setPaused(false);
    } else {
      activeRecording?.pause();
      setPaused(true);
    }
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  // Nothing captured yet (mic never opened) needs no confirm — Cancel is a plain no-op return. A real
  // in-progress clip does, mirroring the app's existing discard-confirm pattern (Re-record, Clear data).
  // Stopping the tracks (no mic leak) is owned by the parent's `onCancel` — it holds the recorder ref.
  const requestCancel = () => (live ? setConfirmingCancel(true) : onCancel());
  const confirmCancel = () => {
    setConfirmingCancel(false);
    onCancel();
  };

  return (
    <View style={{ alignItems: 'center', paddingTop: theme.spacing.xl }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: paused ? c.sunken : c.riskBg,
          borderRadius: theme.radii.pill,
          paddingVertical: 8,
          paddingHorizontal: 16,
        }}
      >
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: paused ? c.ink3 : c.riskFill }} />
        <AppText variant="bodyStrong" tint={paused ? c.ink2 : c.risk}>
          {paused ? 'Paused' : streamInterrupted ? 'Stopped' : live ? 'Recording' : 'Ready'} · Session {sessionNumber}{' '}
          with {displayName}
        </AppText>
      </View>
      {appendTarget ? <AppendBanner sessionLabel={appendTarget.sessionLabel} /> : null}
      <AppText variant="display" style={{ fontSize: 56, lineHeight: 62, marginTop: 20, fontFamily: theme.type.numeric.fontFamily }}>
        {mm}:{ss}
      </AppText>
      <View style={{ height: 18 }} />
      <Waveform bars={13} getLevels={live ? activeRecording?.getLevels : undefined} />
      {paused ? (
        <AppText variant="small" color="ink3" center style={{ marginTop: 8, maxWidth: 420 }}>
          Paused. Nothing new is being captured. Resume to keep recording this same clip.
        </AppText>
      ) : null}

      {streamInterrupted ? (
        <Card tone="sunken" elevation="none" radius="md" style={{ marginTop: 20, maxWidth: 520, backgroundColor: c.cautionBg, borderColor: c.cautionBg }}>
          <Row gap={9} style={{ alignItems: 'flex-start' }}>
            <View style={{ marginTop: 1 }}>
              <AlertTriangleIcon size={15} color={c.caution} />
            </View>
            <AppText variant="small" tint={c.caution} style={{ flex: 1, lineHeight: 17 }}>
              The recording stopped on its own. The microphone stream ended (unplugged, permission revoked, or a
              device change), not a Stop tap. Everything captured up to that point is saved; stop to transcribe it.
            </AppText>
          </Row>
        </Card>
      ) : !live ? (
        <Card tone="sunken" elevation="none" radius="md" style={{ marginTop: 20, maxWidth: 520, backgroundColor: c.cautionBg, borderColor: c.cautionBg }}>
          <Row gap={9} style={{ alignItems: 'flex-start' }}>
            <View style={{ marginTop: 1 }}>
              <AlertTriangleIcon size={15} color={c.caution} />
            </View>
            <AppText variant="small" tint={c.caution} style={{ flex: 1, lineHeight: 17 }}>
              {sampleOnStop
                ? 'Live microphone capture isn’t available here. Upload an audio clip, or stop to transcribe a sample session so you can see the draft.'
                : `Live microphone capture isn’t available here, and the fictional sample won’t run under ${displayName}’s record. Upload an audio clip, or stop and type or paste the session transcript.`}
            </AppText>
          </Row>
        </Card>
      ) : (
        <View style={{ alignItems: 'center', marginTop: 22, maxWidth: 520 }}>
          <AppText variant="label" color="ink3" uppercase>
            Capturing on this device
          </AppText>
          <AppText variant="small" color="ink3" center style={{ marginTop: 8, lineHeight: 17 }}>
            {willTranscribe
              ? 'Audio is held on this device; in demo mode it’s sent to the cloud (Groq) to transcribe when you stop.'
              : hasGroq
                ? 'Audio is held on this device and won’t be sent anywhere. Cloud transcription needs a live sign-in, and there isn’t one, so you’ll type or paste the transcript after you stop.'
                : 'Audio is held on this device and won’t be sent anywhere. This build has no automatic transcription, so you’ll type or paste the transcript after you stop.'}
          </AppText>
        </View>
      )}

      <RecordingNotes liveTs={`${mm}:${ss}`} onComments={onComments} />

      <View style={{ height: 22 }} />
      {confirmingCancel ? (
        <Card tone="sunken" elevation="none" radius="md" style={{ maxWidth: 420, backgroundColor: c.riskBg, borderColor: c.riskBg }}>
          <AppText variant="bodyStrong" style={{ fontSize: 14 }}>
            Discard this recording?
          </AppText>
          <AppText variant="small" color="ink2" style={{ marginTop: 4, lineHeight: 17 }}>
            This stops the microphone and throws away everything captured so far. It can’t be recovered.
          </AppText>
          <View style={{ height: 12 }} />
          <Row gap={10} wrap>
            <Button title="Yes, discard" variant="danger" onPress={confirmCancel} />
            <Button title="Keep recording" variant="secondary" onPress={() => setConfirmingCancel(false)} />
          </Row>
        </Card>
      ) : (
        <Row gap={12} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          {canPause ? (
            <Button
              title={paused ? 'Resume' : 'Pause'}
              variant="secondary"
              size="lg"
              leftIcon={paused ? <PlayIcon size={15} color={c.brand} /> : <PauseIcon size={15} color={c.brand} />}
              accessibilityLabel={paused ? 'Resume recording' : 'Pause recording. Resume later without starting a new segment'}
              onPress={togglePause}
            />
          ) : null}
          <Button title="Stop & transcribe" variant="secondary" size="lg" leftIcon={<StopIcon size={16} color={c.risk} />} onPress={onStop} />
          {isUploadSupported() ? (
            <Button title="Upload a clip instead" variant="ghost" leftIcon={<FileUpIcon size={15} color={c.brand} strokeWidth={2} />} onPress={onUpload} />
          ) : null}
          <Button title="Cancel" variant="ghost" accessibilityLabel="Cancel recording and discard it" onPress={requestCancel} />
        </Row>
      )}
      <AppText variant="small" color="ink3" center style={{ marginTop: 18, maxWidth: 420, lineHeight: 18 }}>
        <AppText variant="bodyStrong" color="ink2" style={{ fontSize: 12.5 }}>
          Nothing is authoritative yet. This is a draft you’ll review and sign.
        </AppText>{' '}
        {willTranscribe
          ? 'When you stop, Airava transcribes, drafts the note, then deletes the recording (unless you keep it).'
          : 'When you stop, you’ll type or paste the transcript and Airava drafts the note on this device, then deletes the recording (unless you keep it).'}
      </AppText>
    </View>
  );
}

type Comment = { id: string; ts: string; text: string };

/**
 * "Comment on your recording" strip — the dotted add card is first; comments are editable.
 *
 * The strip's own copy promises the comments are KEPT, so they must never exist only in this
 * component's local state (that is how they used to be silently discarded the moment recording
 * stopped): every change — including a comment still sitting un-submitted in the dotted card —
 * is reported up through `onComments` in chronological order, for the screen to stamp onto the
 * note it drafts or appends.
 */
function RecordingNotes({ liveTs, onComments }: { liveTs: string; onComments: (comments: RecordingComment[]) => void }) {
  const theme = useTheme();
  const c = theme.colors;
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const nextId = useRef(0);
  const scroller = useRef<ScrollView>(null);

  // Newest-first is the strip's display order; the note keeps them chronological. The un-submitted
  // draft rides along (stamped with the clock as it stands now) so pressing Stop mid-sentence still
  // keeps the words — blur usually commits it first, but that must not be load-bearing.
  useEffect(() => {
    const chronological = comments
      .slice()
      .reverse()
      .map(({ ts, text }) => ({ ts, text: text.trim() }))
      .filter((x) => x.text.length > 0);
    const pending = draft.trim();
    onComments(pending ? [...chronological, { ts: liveTs, text: pending }] : chronological);
  }, [comments, draft, liveTs, onComments]);

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
          Each comment is stamped with the recording clock and kept with the note. You’ll find them on
          the review screen’s Transcript tab
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
            <Pressable
              onPress={add}
              accessibilityRole="button"
              accessibilityLabel="Add comment at this moment"
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Row gap={5} style={{ alignItems: 'center' }}>
                <PlusIcon size={13} color={c.brand} />
                <AppText variant="small" tint={c.brand} style={{ fontSize: 11.5 }}>
                  Add at this moment
                </AppText>
              </Row>
            </Pressable>
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
  mode,
  onDrafted,
  returnTo,
  cloudReady,
  appendTarget,
  onAppend,
}: {
  capture: CaptureRef;
  client: ReturnType<typeof useClient>;
  name: string;
  mode: ScribeMode;
  onDrafted: (note: DraftNote) => void;
  returnTo: string;
  /** Whether a cloud draft is actually reachable, so the in-flight label names the drafting hop
   *  truthfully — the summarizer drafts on-device when there is no session token. */
  cloudReady: boolean | null;
  /** Set only in "Continue recording" mode. When present, the terminal action splices this capture's
   *  transcript onto that note (`onAppend`) instead of running the summarizer to draft a new one. */
  appendTarget?: DraftNote;
  onAppend: (addition: RecordingAddition) => void | Promise<void>;
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
  // "Continue recording" mode's own in-flight flag — no summarizer call runs, so `stage` never moves to
  // 'drafting' for this path; this is what disables the transcript editor and the terminal button
  // while `onAppend` persists.
  const [appending, setAppending] = useState(false);
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
  // A THIRD observed fact: an on-device transcriber actually produced the text (today, only the
  // sample clip's mock replay). Stays false when transcription failed and the clinician typed the
  // transcript themselves — the note then says "entered by hand" rather than claiming an on-device
  // transcription that never ran.
  const [transcribedOnDevice, setTranscribedOnDevice] = useState(false);

  // Speaker separation (round-2 item 1) — a POST-transcription LLM pass, "patient session" mode only.
  // `speakerState` degrades honestly: 'unavailable' when there's no live cloud session to run it,
  // never a faked local split. `separatedFor` pins the turns to the exact transcript text they were
  // derived from, so an edit to the transcript afterwards visibly retires the stale panel rather than
  // silently applying a removal against text the model never saw.
  const [speakerState, setSpeakerState] = useState<'idle' | 'loading' | 'ready' | 'unavailable' | 'error'>('idle');
  const [speakerTurns, setSpeakerTurns] = useState<SpeakerTurn[] | null>(null);
  const [separatedFor, setSeparatedFor] = useState<string | null>(null);
  const [speakersApplied, setSpeakersApplied] = useState(false);
  const [auxiliaryNotes, setAuxiliaryNotes] = useState<string | undefined>(undefined);
  const autoSeparateRan = useRef(false);

  useEffect(() => {
    const ctrl = controller.current;
    // The "sample audio" path can't be sent to the cloud (there's no real clip) — transcribe it
    // with the on-device mock so it yields a real canned transcript for the summarizer.
    const wentToCloud = hasGroq && !isMockCapture;
    const service = isMockCapture ? new MockTranscriptionService(1) : transcriptionService;
    (async () => {
      setAudioLeftDevice(false);
      setTranscriptFromCloud(false);
      setTranscribedOnDevice(false);
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
        setTranscribedOnDevice(!wentToCloud && cloudText.length > 0);
        setStage('ready');
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        const noSession = isCloudSessionRequiredError(e);
        // Signing in fixes a missing session; it cannot conjure an engine that isn't in this build,
        // so the sign-in affordance stays off for that one.
        setNeedsSignIn(noSession);
        setError(
          noSession
            ? 'Cloud transcription needs a live sign-in. Nothing was sent, and this recording stayed on this device. Type or paste the transcript below and Airava will draft the note on this device. Signing in enables cloud transcription for your next capture; it can’t transcribe the recording you just made, and leaving this screen discards it.'
            : isTranscriptionUnavailableError(e)
              ? 'This build has no automatic transcription, so nothing was transcribed and nothing was sent anywhere. Type or paste the transcript below and Airava will draft the note on this device.'
              : 'Transcription failed. Type or paste the transcript below, then draft the note.',
        );
        setStage('ready');
      }
    })();
    return () => ctrl.abort();
  }, [capture, isMockCapture]);

  // Speaker separation runs automatically once, right after transcription lands — "patient session"
  // mode only (retrospective assumes a single therapist voice and never runs this). Never fires for an
  // empty transcript, and never re-fires for the same transcript text (autoSeparateRan) — editing the
  // transcript afterwards just retires the stale panel below rather than re-triggering a fresh call.
  useEffect(() => {
    if (stage !== 'ready' || mode !== 'patient' || autoSeparateRan.current) return;
    const text = transcript.trim();
    if (!text) return;
    autoSeparateRan.current = true;
    if (!speakerSeparationService || cloudReady !== true) {
      setSpeakerState('unavailable');
      return;
    }
    const ctrl = new AbortController();
    setSpeakerState('loading');
    speakerSeparationService
      .separate(text, { signal: ctrl.signal })
      .then((result) => {
        setSpeakerTurns(result.turns);
        setSeparatedFor(text);
        setSpeakerState('ready');
      })
      .catch((e) => {
        if ((e as Error).name === 'AbortError') return;
        // A no-session rejection reads the same as build-unconfigured here — either way there is no
        // cloud path to run this pass, and the honest thing is to say so, not to fake a local split.
        setSpeakerState(isCloudSessionRequiredError(e) ? 'unavailable' : 'error');
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, mode, cloudReady]);

  // The transcript no longer matches what the speaker panel was derived from (the clinician edited it,
  // or applied the removal already) — never apply a stale split against text the model didn't see.
  const speakerPanelStale = speakerTurns !== null && separatedFor !== transcript;

  const applySpeakerRemoval = () => {
    if (!speakerTurns || speakerPanelStale || speakersApplied) return;
    const kept = speakerTurns.filter((t) => t.speaker !== 'Speaker 2');
    const removed = speakerTurns.filter((t) => t.speaker === 'Speaker 2');
    if (!removed.length) return;
    const nextTranscript = kept.map((t) => t.text).join(' ');
    setTranscript(nextTranscript);
    setSeparatedFor(nextTranscript);
    setAuxiliaryNotes(removed.map((t) => t.text).join(' '));
    setSpeakersApplied(true);
  };

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
          : 'This capture didn’t contain enough clear speech to draft from (a dead mic, muted input, or failed upload can cause this). Re-capture or paste the real transcript below. Airava won’t write up a note from an unclear recording.',
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
      transcribedOnDevice,
      sampleCapture: isMockCapture,
      auxiliaryNotes,
    };
    try {
      // The summarizer stamps transcript + every provenance field itself, from the input it was given
      // and the service that really produced this draft, so the review screen's Transcript tab and its
      // provenance line stay true for this note however the app is configured when it is later read.
      const note = await summarizationService.summarize(input, { signal: controller.current.signal });
      onDrafted(note);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      // Drafting has no no-session failure mode: with no token the summarizer drafts on-device over
      // this same text. Anything reaching here is a real failure (network, proxy, malformed reply).
      setError('Drafting failed. Nothing was drafted. Check your connection, review the transcript below, and try again.');
      setStage('ready');
    }
  };

  /** "Continue recording"'s terminal action — mirrors `draftAndContinue`'s F11 quality guard (garbage audio
   *  must not land in a real note's transcript either), but never calls the summarizer: the merge is
   *  `onAppend` → `appendRecording.ts`, not a fresh draft. */
  const appendAndContinue = async () => {
    const trimmed = transcript.trim();
    if (!trimmed) return;
    const quality = transcriptQuality(trimmed);
    if (quality !== 'ok') {
      setNeedsSignIn(false);
      setError(
        quality === 'too-short'
          ? 'This capture is too short to append reliably. Check the recording or upload, or paste the transcript below, then add it.'
          : 'This capture didn’t contain enough clear speech to append (a dead mic, muted input, or failed upload can cause this). Re-capture or paste the real transcript below.',
      );
      return;
    }
    setError(null);
    setNeedsSignIn(false);
    setAppending(true);
    try {
      await onAppend({ transcript: trimmed, audioLeftDevice, transcriptFromCloud, auxiliaryNotes });
    } finally {
      setAppending(false);
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
            ? appendTarget
              ? 'Transcript ready. Review before adding it to the note'
              : 'Transcript ready. Review before drafting'
            : 'Preparing…';

  // The sublabel names the hop the CURRENT stage is running, because the two hops route
  // independently: a `mock://` capture is transcribed on-device yet its transcript text is still
  // drafted in the cloud when the proxy is configured AND a session token exists. Claiming
  // "on-device mock" while the transcript is in flight to Groq would under-disclose a real cloud hop;
  // while the check is still in flight we assume the cloud, which errs toward disclosure.
  const cloudHop =
    stage === 'drafting' ? cloudReady ?? hasGroq : stage === 'ready' ? audioLeftDevice : hasGroq && !isMockCapture;

  const working = stage === 'preparing' || stage === 'transcribing' || stage === 'deidentifying' || stage === 'drafting' || appending;
  const transcriptEmpty = transcript.trim().length === 0;
  // C3: a non-blocking nudge when the transcript doesn't read like clinical/session content.
  const showClinicalWarn = !working && !transcriptEmpty && !clinicalWarnDismissed && !looksLikeClinicalText(transcript);

  return (
    <View style={{ paddingTop: theme.spacing.lg }}>
      {appendTarget ? <AppendBanner sessionLabel={appendTarget.sessionLabel} /> : null}
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
              It may be room noise, a phone call, or off-topic. Review the transcript below before drafting.
              You can still proceed.
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

      {mode === 'patient' && !working ? (
        <SpeakersPanel
          state={speakerState}
          turns={speakerTurns}
          stale={speakerPanelStale}
          applied={speakersApplied}
          onApply={applySpeakerRemoval}
          returnTo={returnTo}
        />
      ) : null}

      <View style={{ height: theme.spacing.lg }} />
      <View style={{ alignItems: 'flex-end' }}>
        {!working && transcriptEmpty ? (
          <AppText variant="small" color="ink3" style={{ marginBottom: 8 }}>
            {appendTarget ? 'Add or edit the transcript before appending.' : 'Add or edit the transcript before drafting.'}
          </AppText>
        ) : null}
        <Button
          title={appendTarget ? (appending ? 'Adding…' : 'Add to transcript') : stage === 'drafting' ? 'Drafting…' : 'Next → draft the note'}
          variant="primary"
          loading={appendTarget ? appending : stage === 'drafting'}
          disabled={working || transcriptEmpty}
          onPress={appendTarget ? appendAndContinue : draftAndContinue}
        />
      </View>
    </View>
  );
}

/* -------------------------------------------------------------- speakers --- */

/**
 * Speakers panel (round-2 item 1). Renders the machine-attributed turn split for "patient session"
 * mode once transcription lands, with the offer to remove Speaker 2's turns into auxiliary notes.
 * HONESTY: every state here either shows real model output labelled as a guess, or says plainly that
 * separation didn't run — never a fabricated split. Renders nothing while stale (the transcript has
 * since diverged from what the turns were derived from) or idle (still waiting on transcription).
 */
function SpeakersPanel({
  state,
  turns,
  stale,
  applied,
  onApply,
  returnTo,
}: {
  state: 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';
  turns: SpeakerTurn[] | null;
  stale: boolean;
  applied: boolean;
  onApply: () => void;
  returnTo: string;
}) {
  const theme = useTheme();
  const c = theme.colors;

  if (state === 'idle' || stale) return null;

  if (state === 'loading') {
    return (
      <Card tone="sunken" elevation="none" radius="md" style={{ marginTop: theme.spacing.md }}>
        <Row gap={10}>
          <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2.5, borderColor: c.brandBd, borderTopColor: c.brand }} />
          <AppText variant="bodyStrong" style={{ fontSize: 13 }}>
            Identifying speakers…
          </AppText>
        </Row>
      </Card>
    );
  }

  if (state === 'unavailable') {
    return (
      <Row
        gap={10}
        style={{
          marginTop: theme.spacing.md,
          alignItems: 'flex-start',
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
            {hasGroq
              ? 'Speaker separation needs a live cloud session, and this device doesn’t have one right now. The transcript above is used as-is.'
              : 'This build has no automatic speaker separation. The transcript above is used as-is.'}
          </AppText>
          {hasGroq ? (
            <View style={{ height: 8 }} />
          ) : null}
          {hasGroq ? <SignInToCloud label="Sign in to identify speakers on your next capture" returnTo={returnTo} /> : null}
        </View>
      </Row>
    );
  }

  if (state === 'error') {
    return (
      <Row gap={9} style={{ marginTop: theme.spacing.md, alignItems: 'flex-start' }}>
        <View style={{ marginTop: 1 }}>
          <AlertTriangleIcon size={15} color={c.caution} />
        </View>
        <AppText variant="small" tint={c.caution} style={{ flex: 1, lineHeight: 17 }}>
          Couldn’t identify speakers for this transcript. The transcript above is used as-is; you can still
          draft the note.
        </AppText>
      </Row>
    );
  }

  const hasSecondSpeaker = (turns ?? []).some((t) => t.speaker === 'Speaker 2');

  return (
    <Card tone="sunken" elevation="none" radius="md" style={{ marginTop: theme.spacing.md, backgroundColor: c.brandBg, borderColor: c.brandBd }}>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        <SparklesIcon size={14} color={c.brand} />
        <AppText variant="bodyStrong" tint={c.brand} style={{ fontSize: 12.5 }}>
          Speakers · machine-attributed
        </AppText>
        <AppText variant="small" color="ink3" style={{ fontSize: 11 }}>
          a guess from conversational cues. Review before relying on it
        </AppText>
      </Row>
      <View style={{ height: 10 }} />
      {(turns ?? []).map((t, i) => (
        <Row key={i} gap={8} style={{ alignItems: 'flex-start', marginBottom: 8 }}>
          <View
            style={{
              backgroundColor: t.speaker === 'Speaker 2' ? c.cautionBg : c.elevated,
              borderRadius: theme.radii.xs,
              paddingVertical: 3,
              paddingHorizontal: 7,
              minWidth: 68,
            }}
          >
            <AppText variant="small" tint={t.speaker === 'Speaker 2' ? c.caution : c.ink2} style={{ fontSize: 11 }}>
              {t.speaker}
            </AppText>
          </View>
          <AppText variant="body" color="ink2" style={{ flex: 1, fontSize: 13.5 }}>
            {t.text}
          </AppText>
        </Row>
      ))}
      <View style={{ height: 4 }} />
      {applied ? (
        <Row gap={7} style={{ alignItems: 'flex-start' }}>
          <View style={{ marginTop: 1 }}>
            <ShieldIcon size={13} color={c.brand} />
          </View>
          <AppText variant="small" tint={c.brand} style={{ flex: 1, fontSize: 12, lineHeight: 16 }}>
            Speaker 2 removed from the transcript above and saved as auxiliary notes on this session.
          </AppText>
        </Row>
      ) : hasSecondSpeaker ? (
        <Button title="Remove Speaker 2 + add as auxiliary notes" variant="ghost" leftIcon={<SparklesIcon size={14} color={c.brand} />} onPress={onApply} />
      ) : (
        <AppText variant="small" color="ink3" style={{ fontSize: 11.5 }}>
          Only the therapist and client were identified. Nothing to remove.
        </AppText>
      )}
    </Card>
  );
}
