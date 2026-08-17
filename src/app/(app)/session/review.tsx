import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, CheckIcon, CopyIcon, PauseIcon, PlayIcon, PlusIcon, ShieldIcon, SparklesIcon } from '../../../components/icons';
import { BackLink, PageHeader, Screen } from '../../../components/Screen';
import { ClientLink } from '../../../components/ClientLink';
import { AppText, Badge, Button, Card, Divider, Eyebrow, Row, TrustPill } from '../../../components/ui';
import { ZeroState } from '../../../components/ZeroState';
import { hasGroq } from '../../../config/env';
import { useClient, useClientNotes, useData, useDraftNote } from '../../../data/DataProvider';
import { DraftNote, NoteSection, PrepItem, RecordingComment } from '../../../data/types';
import { authService } from '../../../services/auth';
import { AudioSegment, getAudioSegments } from '../../../services/audioVault';
import { useTheme } from '../../../theme/ThemeProvider';
import { formatTimestamp } from '../../../utils/formatTimestamp';

const TABS = ['Note', 'Transcript', 'Context', '+ Screening tools'] as const;
type Tab = (typeof TABS)[number];

/**
 * Serialize the full note to plain text for the clipboard — the exact SOAP content the clinician
 * reviewed, in reading order, so it can be pasted into an EHR. Sections, risk rows, plan bullets, the
 * subjective quote, and the measures table are all included; nothing is invented.
 *
 * The text carries its OWN status, because pasting strips every on-screen cue: a signed note ends with
 * its attestation line, and an unsigned one LEADS with a draft marker, so nothing can land in a
 * patient record looking authoritative when it hasn't been signed.
 */
function noteToPlainText(draft: DraftNote): string {
  const isSigned = draft.status === 'signed';
  const lines: string[] = isSigned
    ? [draft.sessionLabel, '']
    : ['DRAFT — not signed; review before entering into the record.', '', draft.sessionLabel, ''];
  for (const s of draft.sections) {
    lines.push(s.isRisk ? s.title : `${s.marker} — ${s.title}`);
    for (const p of s.body) lines.push(p);
    if (s.quote) lines.push(`"${s.quote}"`);
    for (const b of s.bullets ?? []) lines.push(`• ${b}`);
    for (const r of s.rows ?? []) lines.push(`- ${r.label}: ${r.value}`);
    lines.push('');
  }
  if (draft.measures.length) {
    lines.push('Measures');
    for (const m of draft.measures) lines.push(`- ${m.measure}: today ${m.today} · prev ${m.prev} · band ${m.band}`);
    lines.push('');
  }
  if (isSigned) {
    const attestation = [draft.signedBy ? `Signed by ${draft.signedBy}` : 'Signed', draft.signedAt].filter(Boolean).join(' · ');
    lines.push(`— ${attestation}`);
  }
  return `${lines.join('\n').trim()}\n`;
}

/**
 * Copy the whole note to the clipboard, with a truthful confirmation (F12 / no-dead-promise): the
 * "Copied" state flips ONLY after a real successful clipboard write, and a REJECTED write (permission
 * denied) says so instead of failing silently.
 *
 * The disabled state is gated on the ACTUAL capability (`navigator.clipboard`), not on `Platform.OS`:
 * there is no clipboard on native, but there is equally none on web in an insecure context (an http://
 * LAN dev origin) or an old webview. Gating on the platform proxy left the button enabled-but-dead
 * exactly there — the failure this control was written to eliminate.
 */
function CopyNoteButton({ draft }: { draft: DraftNote }) {
  const theme = useTheme();
  const c = theme.colors;
  const canCopy = typeof navigator !== 'undefined' && !!navigator.clipboard;
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const flash = (next: 'copied' | 'failed') => {
    setState(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), next === 'copied' ? 2000 : 4000);
  };

  const copy = () => {
    const clip = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
    if (!clip) return flash('failed'); // only ever confirm after a real write
    clip
      .writeText(noteToPlainText(draft))
      .then(() => flash('copied'))
      .catch(() => flash('failed'));
  };

  const copied = state === 'copied';
  return (
    <View>
      <Button
        title={copied ? 'Copied ✓' : 'Copy note'}
        variant="ghost"
        leftIcon={copied ? <CheckIcon size={15} color={c.positive} /> : <CopyIcon size={15} color={c.brand} />}
        onPress={copy}
        disabled={!canCopy}
        accessibilityLabel="Copy the full note to the clipboard"
      />
      {!canCopy ? (
        <AppText variant="small" color="ink3" style={{ marginTop: 4, fontSize: 11, maxWidth: 260, lineHeight: 15 }}>
          Copy isn’t available on this device — open the note on web to copy it into your record.
        </AppText>
      ) : state === 'failed' ? (
        <AppText variant="small" tint={c.caution} style={{ marginTop: 4, fontSize: 11, maxWidth: 260, lineHeight: 15 }}>
          Couldn’t copy — your browser blocked clipboard access. Select the note text and copy it manually.
        </AppText>
      ) : null}
    </View>
  );
}

/**
 * The one banner shape the duplicate-identity outcomes speak through: a fold into an existing record
 * (brand tone, shield) and the two deliberate forks (caution tone, "!" badge — `strong` draws the
 * border in the caution colour for the sharper mis-entry warning). One component so three cautions
 * about the same subject cannot drift apart visually as the copy is edited.
 */
function IdentityNotice({
  tone,
  heading,
  strong,
  children,
}: {
  tone: 'brand' | 'caution';
  heading: string;
  strong?: boolean;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const tint = tone === 'brand' ? c.brand : c.caution;
  const background = tone === 'brand' ? c.brandBg : c.cautionBg;
  const border = tone === 'brand' ? c.brandBd : strong ? c.caution : c.cautionBg;

  return (
    <Row
      gap={9}
      style={{
        marginTop: theme.spacing.md,
        alignItems: 'flex-start',
        backgroundColor: background,
        borderColor: border,
        borderWidth: 1,
        borderRadius: theme.radii.md,
        padding: theme.spacing.md,
      }}
    >
      {tone === 'brand' ? (
        <View style={{ marginTop: 1 }}>
          <ShieldIcon size={15} color={c.brand} />
        </View>
      ) : (
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            borderWidth: 2,
            borderColor: c.caution,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 1,
          }}
        >
          <AppText variant="label" tint={c.caution} style={{ fontSize: 11 }}>
            !
          </AppText>
        </View>
      )}
      <AppText variant="small" color="ink2" style={{ flex: 1, lineHeight: 17 }}>
        <AppText variant="bodyStrong" tint={tint} style={{ fontSize: 12.5 }}>
          {heading}
        </AppText>{' '}
        {children}
      </AppText>
    </Row>
  );
}

export default function ReviewNote() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 1040;
  const { clientId, note: noteParam, existing, adopted, conflict, idconflict } = useLocalSearchParams<{
    clientId: string;
    note?: string;
    existing?: string;
    adopted?: string;
    conflict?: string;
    idconflict?: string;
  }>();
  // Set when this capture's Emirates ID matched a client already on the caseload: the session folded
  // into that existing record rather than creating a duplicate patient, and we say so plainly.
  const foldedIntoExisting = existing === '1';
  // The ADOPTION fold: no record held this Emirates ID, so the match was made on the NAME and the id
  // was saved onto that record by this capture. It must not borrow the sentence above — claiming the id
  // was "already on your caseload" would invent corroboration on the one fold the counselor alone can
  // check, and this is where a same-named different patient would be caught.
  const foldedAndSavedTheId = !foldedIntoExisting && adopted === '1';
  // The sharpest warning: the Emirates ID entered is already on file under a materially DIFFERENT name.
  // Two strong signals disagreeing is a mis-entry far more often than a match, so a separate record was
  // minted rather than merging two patients — and the counselor is told to check the id before signing.
  const idOnFileUnderAnotherName = !foldedIntoExisting && !foldedAndSavedTheId && idconflict === '1';
  // The app could not tell which patient this is: a namesake holds a different Emirates ID, or more
  // than one client shares the name. Ambiguity is never resolved by merging, so a separate record was
  // minted deliberately — said plainly here, because an unexplained second identical-looking row is how
  // a caseload quietly fragments.
  const mintedDespiteSameName = !foldedIntoExisting && !foldedAndSavedTheId && !idOnFileUnderAnotherName && conflict === '1';
  // Up to 3 notes are retained per client (C4); `note` selects which retained note to review (newest = 0).
  const notes = useClientNotes(clientId);
  const parsedIndex = noteParam ? Number(noteParam) : 0;
  const noteIndex = Number.isInteger(parsedIndex) && parsedIndex >= 0 && parsedIndex < notes.length ? parsedIndex : 0;
  const draft = useDraftNote(clientId, noteIndex);
  const client = useClient(clientId);
  const { signNote, unlockNote } = useData();

  // The C4 rail switches notes via router.replace(...&note=i) without remounting, and notes rotate
  // newest-first, so index alone can't identify the reviewed note. Per-note UI state (the tab here,
  // and the section editors / prescriptions rail via the React key below) is tied to this identity
  // so one note's clinical content can never render under another note's label.
  const noteKey = `${clientId ?? ''}::${draft?.sessionLabel ?? noteIndex}`;
  const [tabState, setTabState] = useState<{ key: string; tab: Tab }>({ key: noteKey, tab: 'Note' });
  const tab = tabState.key === noteKey ? tabState.tab : 'Note';
  const setTab = (t: Tab) => setTabState({ key: noteKey, tab: t });
  // Sign-off attribution (F8): the clinician who actually signed in, and the moment they signed —
  // this is the legal attestation line, so neither may be hardcoded. The sign-off lives ON the
  // stored note (status/signedBy/signedAt persisted through the vault seam), so each note renders
  // its OWN status — switching or rotating notes can never carry an attestation across, and a
  // completed sign-off survives navigation and reload.
  const clinician = authService.getClinicianName() ?? 'You';
  const signed = draft?.status === 'signed';
  const signedAt = (signed ? draft?.signedAt : null) ?? null;
  const signedByName = (signed ? draft?.signedBy : null) ?? clinician;
  // A draft-status note that still carries a `signedAt` was signed once, then unlocked for edits —
  // distinct from a note that was never signed, so the trust pill (and the rail) can say plainly that
  // it needs re-review and re-signing rather than reading as an ordinary first-pass draft.
  const reopenedFromSigned = !signed && !!draft?.signedAt;
  // Sections register a flush here while they hold an uncommitted edit. Signing runs them FIRST, so a
  // correction typed but not "Done"-ed still lands in the note that gets signed instead of being
  // silently dropped — the clinician pressed Sign off, not Discard. Each flush persists through the
  // same seam, and `persist` advances the provider's snapshot synchronously, so the sign write that
  // follows in this same tick already carries the edit.
  const pendingEdits = useRef(new Map<string, () => void>());
  const sign = () => {
    if (!clientId) return;
    pendingEdits.current.forEach((flush) => flush());
    signNote(clientId, noteIndex, clinician, formatTimestamp(new Date()));
  };
  // Reopens a signed note for editing. The read-only rule stays enforced at the `updateNoteSection`
  // seam (it refuses a signed note) — this flips `status` back to 'draft' so that seam honestly
  // permits edits again, rather than any caller bypassing the check.
  const unlock = () => {
    if (!clientId) return;
    unlockNote(clientId, noteIndex);
  };

  if (!draft) {
    return (
      <Screen maxWidth={760}>
        <PageHeader eyebrow="Session" title="No note to review" subtitle="Capture a session and Airava will draft a note here for you to review and sign." />
        <ZeroState
          mood="thinking"
          title="Nothing drafted yet"
          body="Record or upload a session on the Session tab. Once it's transcribed and drafted, the SOAP note opens here."
          primary={{ label: 'Go to Session', onPress: () => router.replace('/(app)/session') }}
        />
      </Screen>
    );
  }

  // Show the session sidebar when there is more than one retained note to switch between (C4).
  const showSessions = notes.length > 1;

  const rail = (
    <ReviewRail
      key={noteKey}
      draft={draft}
      signed={signed}
      onSign={sign}
      onUnlock={unlock}
      clinician={signedByName}
      signedAt={signedAt}
      clientId={clientId}
      noteIndex={noteIndex}
    />
  );
  const sessions =
    client && showSessions ? (
      <SessionList clientId={client.id} clientName={client.name} notes={notes} activeIndex={noteIndex} clinician={clinician} />
    ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <ScrollView contentContainerStyle={{ paddingBottom: signed ? 60 : 140 }}>
        <View style={{ flexDirection: wide ? 'row' : 'column', maxWidth: 1320, width: '100%', alignSelf: 'center', gap: wide ? 0 : theme.spacing.lg }}>
          {/* Left: session list (only when there's a real history — sample clients). */}
          {wide && showSessions ? (
            <View style={{ width: 232, borderRightWidth: 1, borderRightColor: c.line, paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.lg }}>
              {sessions}
            </View>
          ) : null}

          {/* Center: note */}
          <View style={{ flex: 1, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg, minWidth: 0 }}>
            {/* A note is now openable from the client file and session history, so review needs its
                own way back — the tab bar won't re-navigate the tab it is already on. */}
            <BackLink label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)/today'))} />
            {/* A note carrying no resolvable client (e.g. a fresh capture that never matched) has
                nothing to link to — `client` stays undefined and this renders nothing rather than a
                dead link. */}
            {client ? (
              <ClientLink client={client} avatarSize={28} gap={8} style={{ marginTop: 6, marginBottom: 4, alignSelf: 'flex-start' }}>
                <AppText variant="bodyStrong" style={{ fontSize: 14 }}>
                  {client.name}
                </AppText>
              </ClientLink>
            ) : null}
            <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <Row gap={10} style={{ flexWrap: 'wrap' }}>
                <AppText variant="h1" style={{ fontSize: 23 }}>
                  {draft.sessionLabel}
                </AppText>
                {signed ? <SignedChip clinician={signedByName} signedAt={signedAt} /> : <Badge label="Draft · review" tone="draft" />}
              </Row>
              {/* Honest scope (F9): the DRAFT is device-local; there is no de-identification hop in demo
                  mode, so this must not claim "de-identified". The cloud transcription hop is disclosed
                  by the demo banner and the audio-trust note below. The label reflects the note's REAL
                  state — signed & locked, unlocked for re-review after being signed, or an ordinary
                  never-signed draft — never the stale "Draft stays on this device" copy once it's
                  actually signed. */}
              <TrustPill
                label={
                  signed
                    ? 'Signed & locked · stays on this device'
                    : reopenedFromSigned
                      ? 'Unlocked for edits · stays on this device'
                      : 'Draft stays on this device'
                }
                icon={
                  signed ? (
                    <CheckIcon size={13} color={c.brand} />
                  ) : (
                    <ShieldIcon size={13} color={c.brand} />
                  )
                }
              />
            </Row>
            <AppText variant="small" color="ink3" style={{ marginTop: 8 }}>
              {draft.sourceLine}
            </AppText>

            {foldedIntoExisting ? (
              <IdentityNotice tone="brand" heading="You already see this client.">
                This Emirates ID is already on your caseload, so the session was added to their existing
                record instead of creating a second — this is that record.
              </IdentityNotice>
            ) : null}

            {foldedAndSavedTheId ? (
              <IdentityNotice tone="brand" heading="You already see this client.">
                The session was added to {client?.name ? `${client.name}’s` : 'their'} existing record — matched
                by name — and the Emirates ID you entered was saved onto it. If that isn’t who you saw, check
                the name and the ID.
              </IdentityNotice>
            ) : null}

            {idOnFileUnderAnotherName ? (
              <IdentityNotice tone="caution" strong heading="Check the Emirates ID.">
                That Emirates ID is already on your caseload under a different name, so this session was kept
                as a separate record rather than added to theirs. Check the ID for a mistake — this note stays
                on its own record either way.
              </IdentityNotice>
            ) : null}

            {mintedDespiteSameName ? (
              <IdentityNotice tone="caution" heading="Check whether this is the same client.">
                {client?.name ? `A client named ${client.name}` : 'A client with this name'} is already on your
                caseload — under a different Emirates ID, or more than one client shares this name — so this
                session was saved as a separate record rather than added to theirs.
              </IdentityNotice>
            ) : null}

            {/* Tabs */}
            <View style={{ height: theme.spacing.md }} />
            <Row gap={20} style={{ borderBottomWidth: 1, borderBottomColor: c.lineSoft }}>
              {TABS.map((t) => {
                const active = t === tab;
                return (
                  <Pressable key={t} onPress={() => setTab(t)} style={{ paddingBottom: 10 }}>
                    <AppText variant="bodyStrong" tint={active ? c.brand : c.ink3}>
                      {t}
                    </AppText>
                    {active ? <View style={{ height: 2, backgroundColor: c.brand, marginTop: 8, borderRadius: 1 }} /> : null}
                  </Pressable>
                );
              })}
            </Row>

            <View style={{ height: theme.spacing.lg }} />

            {tab === 'Note' ? (
              <NotePane key={noteKey} draft={draft} signed={signed} clientId={clientId} noteIndex={noteIndex} pendingEdits={pendingEdits} />
            ) : tab === 'Transcript' ? (
              <TranscriptPane
                transcript={draft.transcript}
                auxiliaryNotes={draft.auxiliaryNotes}
                recordingComments={draft.recordingComments}
                audioLeftDevice={draft.audioLeftDevice}
                transcriptFromCloud={draft.transcriptFromCloud}
                transcriptMixedProvenance={draft.transcriptMixedProvenance}
                draftedInCloud={draft.draftedInCloud}
                signed={signed}
              />
            ) : (
              <OtherPane tab={tab} />
            )}

            {/* On phone, the note-switcher and the rail (prescriptions / codes / sign-off) stack
                below the note — earlier retained notes must stay reachable on narrow too (C4). */}
            {!wide && sessions ? (
              <View style={{ marginTop: theme.spacing.xl }}>
                <Divider />
                <View style={{ height: theme.spacing.lg }} />
                {sessions}
              </View>
            ) : null}
            {!wide ? (
              <View style={{ marginTop: theme.spacing.xl }}>
                <Divider />
                <View style={{ height: theme.spacing.lg }} />
                {rail}
              </View>
            ) : null}
          </View>

          {/* Right: rail */}
          {wide ? (
            <View style={{ width: 320, borderLeftWidth: 1, borderLeftColor: c.line, paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.lg }}>
              {rail}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Bottom action bar — hidden once signed (note becomes read-only). */}
      {!signed ? (
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
          {/* Copy is the clinician's most common real action (note → EHR) and does a real clipboard
              write. Editing lives inline per section, where "Done" persists the edit through the vault
              seam, so the former dead "Regenerate / Add / Replace / Edit note" bar controls were removed
              rather than left as no-ops — the product's no-dead-promise rule. */}
          <Row style={{ justifyContent: 'space-between', maxWidth: 1320, width: '100%', alignSelf: 'center', flexWrap: 'wrap', gap: 10 }}>
            <CopyNoteButton draft={draft} />
            <SignOffButton onSign={sign} />
          </Row>
        </View>
      ) : (
        <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: insets.bottom + 16, maxWidth: 1320, width: '100%', alignSelf: 'center' }}>
          {/* A signed note is most often the one a clinician needs to paste into an EHR, so Copy stays
              available here too, alongside the way back. */}
          <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <CopyNoteButton draft={draft} />
            <Button
              title="Back to today"
              variant="secondary"
              rightIcon={<ArrowRight size={18} color={c.ink} />}
              onPress={() => router.replace('/(app)/today')}
            />
          </Row>
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------- note pane --- */

type NoteFormat = 'SOAP' | 'DAP';

function NotePane({
  draft,
  signed,
  clientId,
  noteIndex,
  pendingEdits,
}: {
  draft: DraftNote;
  signed: boolean;
  clientId?: string;
  noteIndex: number;
  pendingEdits: React.MutableRefObject<Map<string, () => void>>;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const [format, setFormat] = useState<NoteFormat>('SOAP');
  const { updateNoteSection } = useData();

  // A section edit is only a real edit if it survives navigation and reload, so "Done" writes it back
  // through the same vault seam the sign-off uses. A signed note is read-only, and a note we can't
  // address (no clientId) can't be written — those render no editor at all rather than a lost edit.
  const editable = !signed && !!clientId;
  const saveSection = (sectionId: string, body: string[], bullets?: string[]) => {
    if (!clientId) return;
    void updateNoteSection(clientId, noteIndex, sectionId, body, bullets);
  };

  const subjective = draft.sections.find((s) => s.marker === 'S');
  const objective = draft.sections.find((s) => s.marker === 'O');
  const risk = draft.sections.find((s) => s.isRisk);
  const assessment = draft.sections.find((s) => s.marker === 'A');
  const plan = draft.sections.find((s) => s.marker === 'P');

  return (
    <View>
      {/* Standing review-before-sign banner (never modal). Hidden once signed. */}
      {!signed ? (
        <Card tone="elevated" elevation="none" radius="md" style={{ backgroundColor: c.cautionBg, borderColor: c.cautionBg, marginBottom: theme.spacing.lg }}>
          <Row gap={10}>
            <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: c.caution, alignItems: 'center', justifyContent: 'center' }}>
              <AppText variant="label" tint={c.caution} style={{ fontSize: 11 }}>
                !
              </AppText>
            </View>
            <AppText variant="bodyStrong" tint={c.caution} style={{ flex: 1 }}>
              Review your note before you sign — nothing is authoritative until you do.
            </AppText>
          </Row>
        </Card>
      ) : null}

      {/* Note-format switcher (round-4 item 5). Re-lays the note in place: DAP merges Subjective +
          Objective (incl. the measures table) under one D — Data section, then A, then P; Risk & Safety
          Check stays its own always-present section, now LAST (captain round 2, 2026-08-17) so the
          clinical narrative reads before the routine safety check. SOAP is the default. */}
      <Row gap={10} style={{ alignItems: 'center', marginBottom: theme.spacing.lg, flexWrap: 'wrap' }}>
        <AppText variant="label" color="ink3" uppercase>
          Note format
        </AppText>
        <Row style={{ borderWidth: 1, borderColor: c.line, borderRadius: theme.radii.pill, overflow: 'hidden' }}>
          {(['SOAP', 'DAP'] as NoteFormat[]).map((f) => {
            const active = f === format;
            return (
              <Pressable key={f} onPress={() => setFormat(f)} style={{ paddingVertical: 6, paddingHorizontal: 16, backgroundColor: active ? c.brandBg : 'transparent' }}>
                <AppText variant="bodyStrong" tint={active ? c.brand : c.ink3} style={{ fontSize: 13 }}>
                  {f}
                </AppText>
              </Pressable>
            );
          })}
        </Row>
      </Row>

      {format === 'SOAP' ? (
        draft.sections.map((s) => <Section key={s.id} section={s} measures={draft.measures} editable={editable} onSave={saveSection} pendingEdits={pendingEdits} />)
      ) : (
        <>
          {subjective && objective ? <DataSection subjective={subjective} objective={objective} measures={draft.measures} /> : null}
          {assessment ? <Section key={assessment.id} section={assessment} measures={draft.measures} editable={editable} onSave={saveSection} pendingEdits={pendingEdits} /> : null}
          {plan ? <Section key={plan.id} section={plan} measures={draft.measures} editable={editable} onSave={saveSection} pendingEdits={pendingEdits} /> : null}
          {risk ? <Section key={risk.id} section={risk} measures={draft.measures} editable={editable} onSave={saveSection} pendingEdits={pendingEdits} /> : null}
        </>
      )}
    </View>
  );
}

/**
 * DAP "D — Data" section: the merged Subjective + Objective view (incl. the measures table),
 * derived from the same SOAP sections so content never diverges from the SOAP layout.
 */
function DataSection({ subjective, objective, measures }: { subjective: NoteSection; objective: NoteSection; measures: DraftNote['measures'] }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View style={{ marginBottom: theme.spacing.xl }}>
      <Row gap={10}>
        <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: c.brandBg, alignItems: 'center', justifyContent: 'center' }}>
          <AppText variant="label" tint={c.brand} style={{ fontSize: 12 }}>
            D
          </AppText>
        </View>
        <Eyebrow color="brand">Data</Eyebrow>
      </Row>
      <View style={{ height: 10 }} />

      <AppText variant="label" color="ink3" uppercase style={{ marginBottom: 8 }}>
        Subjective
      </AppText>
      {subjective.body.map((p, i) => (
        <AppText key={i} variant="body" color="ink" style={{ marginBottom: 8 }}>
          {p}
        </AppText>
      ))}
      {subjective.quote ? (
        <View style={{ borderLeftWidth: 3, borderLeftColor: c.brandBd, paddingLeft: 12, marginTop: 6, marginBottom: 8 }}>
          <AppText variant="body" color="ink2" style={{ fontStyle: 'italic' }}>
            “{subjective.quote}”
          </AppText>
        </View>
      ) : null}

      <View style={{ height: 8 }} />
      <AppText variant="label" color="ink3" uppercase style={{ marginBottom: 8 }}>
        Objective
      </AppText>
      {objective.body.map((p, i) => (
        <AppText key={i} variant="body" color="ink" style={{ marginBottom: 8 }}>
          {p}
        </AppText>
      ))}
      {objective.hasMeasures ? <MeasureTable measures={measures} /> : null}
    </View>
  );
}

function Section({
  section,
  measures,
  editable,
  onSave,
  pendingEdits,
}: {
  section: NoteSection;
  measures: DraftNote['measures'];
  editable: boolean;
  onSave: (sectionId: string, body: string[], bullets?: string[]) => void;
  pendingEdits: React.MutableRefObject<Map<string, () => void>>;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState([...section.body, ...(section.bullets ?? [])].join('\n\n'));

  const isRisk = section.isRisk;

  /**
   * Round-trip the editor text back into the section's own body/bullets shape. The editor shows body
   * paragraphs followed by bullets, so the first `body.length` blocks go back to the body and the rest
   * stay bullets — a bulleted section (Plan) keeps its bullets, and any block the clinician adds joins
   * them. Nothing typed is dropped.
   *
   * Scope: this persists the edited SECTION onto the note and deliberately nothing else. It does not
   * retroactively rewrite `draft.prescriptions` (which the rail seeds from, copied from the plan
   * bullets at draft time) or a client's `lastPlan`. The prescriptions rail is independently editable,
   * and "Generate from notes" re-pulls from the current Plan bullets on demand.
   */
  const commitEdit = () => {
    const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
    if (section.bullets === undefined) return onSave(section.id, blocks);
    const cut = Math.min(section.body.length, blocks.length);
    onSave(section.id, blocks.slice(0, cut), blocks.slice(cut));
  };

  // Every exit from the editor must persist, not just "Done": blur, unmount, and the sign-off flush
  // all route through here. `touched` makes it write once per edit session and, once flushed, become a
  // no-op — so a flush arriving after the note is signed can never rewrite a signed record.
  const touched = useRef(false);
  const flush = () => {
    if (!touched.current) return;
    touched.current = false;
    commitEdit();
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;

  const edit = (t: string) => {
    touched.current = true;
    setText(t);
  };

  useEffect(() => {
    const registry = pendingEdits.current;
    const id = section.id;
    registry.set(id, () => flushRef.current());
    return () => {
      flushRef.current();
      registry.delete(id);
    };
  }, [pendingEdits, section.id]);

  // Editability can be lost underneath an open editor (signing from the bottom bar while a section is
  // being edited). The pending text is already captured by the sign-off flush, so all that remains is
  // to close the box — a signed note must never carry a live text input.
  useEffect(() => {
    if (!editable) setEditing(false);
  }, [editable]);

  return (
    <View
      style={[
        { marginBottom: theme.spacing.xl },
        isRisk ? { backgroundColor: c.riskBg, borderRadius: theme.radii.lg, padding: theme.spacing.lg } : null,
      ]}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={10}>
          {/* SOAP gutter marker — a letter for S/O/A/P, a shield for the risk section. */}
          {isRisk ? (
            <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: c.riskBg, alignItems: 'center', justifyContent: 'center' }}>
              <ShieldIcon size={14} color={c.risk} strokeWidth={2.4} />
            </View>
          ) : (
            <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: c.brandBg, alignItems: 'center', justifyContent: 'center' }}>
              <AppText variant="label" tint={c.brand} style={{ fontSize: 12 }}>
                {section.marker}
              </AppText>
            </View>
          )}
          <Eyebrow color={isRisk ? 'risk' : 'brand'}>{section.title}</Eyebrow>
        </Row>
        {/* Per-section Edit only — the former "Regenerate" dimmed the text for 900ms and re-drafted
            nothing, and single-section re-drafting isn't wired, so it was removed rather than left as
            a dead promise. */}
        {editable ? (
          <Pressable
            onPress={() => {
              if (editing) flush();
              setEditing((e) => !e);
            }}
            accessibilityRole="button"
            accessibilityLabel={editing ? `Save your edits to ${section.title}` : `Edit ${section.title}`}
          >
            <AppText variant="small" tint={c.brand}>
              {editing ? 'Done' : 'Edit'}
            </AppText>
          </Pressable>
        ) : null}
      </Row>

      <View style={{ height: 10 }} />

      {isRisk ? (
        <View style={{ marginBottom: 12 }}>
          <Row gap={8} style={{ marginBottom: 12 }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.riskFill }} />
            <AppText variant="bodyStrong" tint={c.risk}>
              Screened this session · routine · always present
            </AppText>
          </Row>
          {section.rows?.map((r, i) => (
            <View key={r.label}>
              {i > 0 && <View style={{ height: 1, backgroundColor: c.risk, opacity: 0.18, marginVertical: 10 }} />}
              <Row style={{ justifyContent: 'space-between' }}>
                <AppText variant="body" color="ink2" style={{ flex: 1 }}>
                  {r.label}
                </AppText>
                <AppText variant="bodyStrong">{r.value}</AppText>
              </Row>
            </View>
          ))}
          <View style={{ height: 14 }} />
        </View>
      ) : null}

      {editing && editable ? (
        <TextInput
          multiline
          value={text}
          onChangeText={edit}
          onBlur={flush}
          style={{
            fontFamily: theme.type.body.fontFamily,
            fontSize: 15,
            lineHeight: 23,
            color: c.ink,
            borderWidth: 1,
            borderColor: c.brandBd,
            borderRadius: theme.radii.sm,
            padding: 12,
            minHeight: 120,
            backgroundColor: c.elevated,
          }}
        />
      ) : (
        <View>
          {section.body.map((p, i) => (
            <AppText key={i} variant="body" color="ink" style={{ marginBottom: 8 }}>
              {p}
            </AppText>
          ))}
          {section.bullets?.map((b, i) => (
            <Row key={i} gap={8} style={{ alignItems: 'flex-start', marginBottom: 6 }}>
              <AppText variant="body" color="ink2">
                •
              </AppText>
              <AppText variant="body" color="ink" style={{ flex: 1 }}>
                {b}
              </AppText>
            </Row>
          ))}
          {section.quote ? (
            <View style={{ borderLeftWidth: 3, borderLeftColor: c.brandBd, paddingLeft: 12, marginTop: 6 }}>
              <AppText variant="body" color="ink2" style={{ fontStyle: 'italic' }}>
                “{section.quote}”
              </AppText>
            </View>
          ) : null}
          {section.marker === 'P' ? (
            <AppText variant="small" color="ink3" style={{ marginTop: 10 }}>
              ↳ These items become the reminders you’ll see when prepping this client’s next session.
            </AppText>
          ) : null}
        </View>
      )}

      {/* Symptom-measures table sits under the Objective section. */}
      {section.hasMeasures ? <MeasureTable measures={measures} /> : null}
    </View>
  );
}

function MeasureTable({ measures }: { measures: DraftNote['measures'] }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View style={{ marginTop: 14, borderWidth: 1, borderColor: c.line, borderRadius: theme.radii.md, overflow: 'hidden' }}>
      <Row style={{ backgroundColor: c.sunken, paddingVertical: 10, paddingHorizontal: 14 }}>
        <AppText variant="label" color="ink3" style={{ flex: 2 }}>
          MEASURE
        </AppText>
        <AppText variant="label" color="ink3" style={{ flex: 1, textAlign: 'right' }}>
          TODAY
        </AppText>
        <AppText variant="label" color="ink3" style={{ flex: 1, textAlign: 'right' }}>
          PREV
        </AppText>
        <AppText variant="label" color="ink3" style={{ flex: 1.4, textAlign: 'right' }}>
          BAND
        </AppText>
      </Row>
      {measures.map((m, i) => (
        <Row key={m.measure} style={{ paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.lineSoft }}>
          <AppText variant="body" style={{ flex: 2 }}>
            {m.measure}
          </AppText>
          <AppText variant="bodyStrong" style={{ flex: 1, textAlign: 'right', fontFamily: theme.type.numeric.fontFamily }}>
            {m.today}
          </AppText>
          <AppText variant="bodyStrong" color="ink3" style={{ flex: 1, textAlign: 'right', fontFamily: theme.type.numeric.fontFamily }}>
            {m.prev}
          </AppText>
          <AppText variant="small" tint={c.caution} style={{ flex: 1.4, textAlign: 'right' }}>
            {m.band}
          </AppText>
        </Row>
      ))}
    </View>
  );
}

/**
 * The Transcript tab shows the REAL session transcript persisted with the note (device-local, through
 * the vault seam) — the exact text the clinician reviewed and drafted from, so they can check the note
 * against it later. HONESTY INVARIANT: when a note has no stored transcript (sample fixtures, or notes
 * captured before transcripts were saved) it says so plainly and never renders placeholder prose as if
 * it were the session. The caption reports the two cloud hops separately, each from the value recorded
 * on THIS note when it was drafted — never from the app-wide config, which can differ by the time the
 * note is read back. Only the everything-stayed-here branch may say nothing was sent anywhere: with
 * keys configured the transcript text goes to Groq to draft even when the audio never left the device.
 * When a hop wasn't recorded (older notes) nothing is claimed about it in either direction.
 *
 * The audio hop and the text's ORIGIN are reported separately, because an upload can be made and the
 * transcription still fail: this caption must disclose that the recording was sent while saying
 * plainly that the text below is the clinician's own, so nobody later audits it as a mishearing.
 */
function TranscriptPane({
  transcript,
  auxiliaryNotes,
  recordingComments,
  audioLeftDevice,
  transcriptFromCloud,
  transcriptMixedProvenance,
  draftedInCloud,
  signed,
}: {
  transcript?: string;
  /** The other speaker's turns, stripped from the main transcript by the capture screen's speaker
   *  separation (round-2 item 1). Shown as its own distinct card, never blended into the transcript
   *  above it — it was deliberately excluded from what the note was drafted from. */
  auxiliaryNotes?: string;
  /** Comments the clinician typed on the recording screen while the capture ran, each stamped with
   *  the recording clock. The comment strip PROMISES they're kept with the note, so this card is
   *  where that promise is honoured — their own card, clinician-authored, never blended into the
   *  transcript above and never sent to the summarizer. */
  recordingComments?: RecordingComment[];
  audioLeftDevice?: boolean;
  transcriptFromCloud?: boolean;
  /** True once "Continue recording" spliced in a segment whose own cloud/typed origin disagrees with the
   *  rest of the transcript (`appendRecording.ts`) — `transcriptFromCloud` alone can no longer describe
   *  the WHOLE transcript truthfully, so this switches the caption to say so instead of picking one
   *  claim that would misstate the other segment. The per-segment truth is in each divider line below. */
  transcriptMixedProvenance?: boolean;
  draftedInCloud?: boolean;
  signed: boolean;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const text = transcript?.trim();
  const aux = auxiliaryNotes?.trim();
  const comments = recordingComments?.filter((x) => x.text.trim()) ?? [];

  // Rendered whether or not a transcript is stored — a typed-recovery capture can carry comments
  // even when transcription produced nothing, and losing them here would re-break the promise.
  const commentsCard = comments.length ? (
    <View style={{ marginTop: theme.spacing.lg }}>
      <AppText variant="small" color="ink3" style={{ marginBottom: 10, lineHeight: 17 }}>
        Comments you typed while the recording ran, each stamped with the recording clock at that
        moment. They’re kept with the note on this device — never merged into the transcript, never
        sent to drafting.
      </AppText>
      <Card tone="sunken" elevation="none" radius="md">
        {comments.map((x, i) => (
          <Row key={i} gap={10} style={{ alignItems: 'flex-start', marginTop: i === 0 ? 0 : 10 }}>
            <AppText variant="small" tint={c.brand} style={{ fontFamily: theme.type.numeric.fontFamily, marginTop: 2 }}>
              {x.ts}
            </AppText>
            <AppText variant="body" color="ink2" selectable style={{ flex: 1, lineHeight: 22 }}>
              {x.text}
            </AppText>
          </Row>
        ))}
      </Card>
    </View>
  ) : null;

  if (!text) {
    return (
      <View>
        <Card tone="sunken" elevation="none" radius="md">
          <AppText variant="body" color="ink2">
            No transcript is stored for this note. Sample data and notes captured before transcripts were
            saved don’t include the session text — nothing is shown here rather than standing in a placeholder
            for the real session.
          </AppText>
        </Card>
        {commentsCard}
      </View>
    );
  }

  return (
    <View>
      <AppText variant="small" color="ink3" style={{ marginBottom: 10 }}>
        {(transcriptMixedProvenance
          ? 'This transcript combines more than one recording, added at different times, and they weren’t all produced the same way — each "Added recording" line below says whether that part was transcribed in the cloud or typed by hand.'
          : transcriptFromCloud === true
          ? 'The transcript of this session, kept on this device. The audio was sent to the cloud (Groq) to transcribe, then deleted — only this text remains. There is no on-device de-identification hop in demo mode.'
          : transcriptFromCloud === false && audioLeftDevice === true
            ? 'This text was entered by the clinician, not produced by transcription — the audio was sent to the cloud (Groq) to transcribe, but no transcript came back. The recording has since been deleted, so this typed text is the only record of the session.' +
              (draftedInCloud === true
                ? ' The note was drafted in the cloud, so this text was sent to Groq to draft from (see the demo banner).'
                : '')
            : transcriptFromCloud === false && draftedInCloud === true
              ? 'The transcript of this session, produced and kept on this device — the audio was never sent for transcription. The note was drafted in the cloud, so this text was sent to Groq to draft from (see the demo banner). There is no on-device de-identification hop in demo mode.'
              : transcriptFromCloud === false && draftedInCloud === false
                ? 'The transcript of this session, produced and kept on this device — nothing was sent anywhere, and no de-identification step runs.'
                : 'The transcript of this session, kept on this device. This note doesn’t record where it was transcribed or drafted, so nothing is claimed either way.') +
          (signed ? '' : ' Check the note against it before signing.')}
      </AppText>
      <Card tone="sunken" elevation="none" radius="md">
        <AppText variant="body" color="ink2" selectable style={{ lineHeight: 22 }}>
          {text}
        </AppText>
      </Card>

      {aux ? (
        <View style={{ marginTop: theme.spacing.lg }}>
          <AppText variant="small" color="ink3" style={{ marginBottom: 10, lineHeight: 17 }}>
            A second speaker was identified and removed from the transcript above (machine-attributed —
            for review). Their turns are kept here as auxiliary notes rather than folded into the session.
          </AppText>
          <Card tone="sunken" elevation="none" radius="md" style={{ backgroundColor: c.cautionBg, borderColor: c.cautionBg }}>
            <AppText variant="body" color="ink2" selectable style={{ lineHeight: 22 }}>
              {aux}
            </AppText>
          </Card>
        </View>
      ) : null}

      {commentsCard}
    </View>
  );
}

function OtherPane({ tab }: { tab: Tab }) {
  const copy: Record<string, string> = {
    Context:
      'Prior-session context Airava grounded the draft against: last plan, latest measures, and standing safety items. Companion-app journal entries are shown separately and never blended with clinical scores.',
    '+ Screening tools':
      'Generated outputs (e.g. a PHQ-9 / GAD-7 screening summary) appear here as sibling tabs on the same session — added on demand, never overwriting the note.',
  };
  return (
    <Card tone="sunken" elevation="none" radius="md">
      <AppText variant="body" color="ink2">
        {copy[tab]}
      </AppText>
    </Card>
  );
}

/* ------------------------------------------------------------------ rail --- */

function ReviewRail({
  draft,
  signed,
  onSign,
  onUnlock,
  clinician,
  signedAt,
  clientId,
  noteIndex,
}: {
  draft: DraftNote;
  signed: boolean;
  onSign: () => void;
  onUnlock: () => void;
  clinician: string;
  signedAt: string | null;
  clientId?: string;
  noteIndex: number;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.lg }}>
      <PrescriptionsRail draft={draft} clientId={clientId} noteIndex={noteIndex} />
      <Divider />
      <ReviewCodes draft={draft} />
      <Divider />
      {signed ? <AudioTrust audioLeftDevice={draft.audioLeftDevice} clientId={clientId} noteIndex={noteIndex} /> : null}
      <SignOff signed={signed} onSign={onSign} onUnlock={onUnlock} clinician={clinician} signedAt={signedAt} />
      {clientId ? (
        <Row gap={10} style={{ flexWrap: 'wrap' }}>
          <ReRecordAction clientId={clientId} signed={signed} />
          <ContinueRecordingAction clientId={clientId} noteIndex={noteIndex} signed={signed} />
        </Row>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------- prescriptions --- */

type Rx = PrepItem & { checked?: boolean; isNew?: boolean };

/**
 * Prescriptions rail (round-2 change #6, renamed from "Tasks for next session"). The
 * clinician writes prescriptions ("+ Add", inline editable) or pulls them from the Plan
 * section ("Generate from notes", tagged "generated"). Checklist ticking lives here.
 *
 * "Generate from notes" is ONCE PER NOTE (round-2 item 2, 2026-08-17): a fresh capture always mints
 * a brand-new DraftNote, so this is equivalently once per transcript. `draft.prescriptionsGenerated`
 * is the persisted source of truth — not local component state — so the button stays disabled across
 * a reload/remount instead of resurrecting for the same already-generated note.
 */
function PrescriptionsRail({ draft, clientId, noteIndex }: { draft: DraftNote; clientId?: string; noteIndex: number }) {
  const theme = useTheme();
  const c = theme.colors;
  const { generatePrescriptions } = useData();
  const [items, setItems] = useState<Rx[]>(draft.prescriptions.map((p) => ({ ...p })));
  const alreadyGenerated = !!draft.prescriptionsGenerated;
  const [pending, setPending] = useState(false);
  const nextRxId = useRef(0);

  const toggle = (id: string) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, checked: !x.checked } : x)));
  const setText = (id: string, text: string) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, text } : x)));

  const generateFromNotes = async () => {
    if (alreadyGenerated || pending || !clientId) return;
    const plan = draft.sections.find((s) => s.marker === 'P');
    // "Continue recording" re-enables this control because the TRANSCRIPT genuinely changed
    // (`appendRecording.ts` clears `prescriptionsGenerated`), but the Plan bullets themselves only
    // change when the clinician edits that section by hand — so a bullet identical to one already
    // pulled isn't new, and a second click over the same Plan must not duplicate it.
    const already = new Set(items.filter((x) => x.generated).map((x) => x.text.trim().toLowerCase()));
    const bullets = (plan?.bullets ?? []).filter((b) => !already.has(b.trim().toLowerCase()));
    const base = items.length;
    const pulled: Rx[] = bullets.map((b, i) => ({
      id: `gen-${base + i}`,
      text: b,
      source: 'from Plan',
      done: false,
      generated: true,
    }));
    setPending(true);
    setItems((xs) => [...xs, ...pulled]);
    try {
      await generatePrescriptions(clientId, noteIndex, pulled);
    } finally {
      setPending(false);
    }
  };

  const add = () => {
    const id = `rx-new-${++nextRxId.current}`;
    setItems((xs) => [...xs, { id, text: '', source: 'added by you', done: false, isNew: true }]);
  };

  const commit = (id: string) =>
    setItems((xs) => xs.flatMap((x) => (x.id === id ? (x.text.trim() === '' ? [] : [{ ...x, text: x.text.trim(), isNew: false }]) : [x])));

  return (
    <View>
      <Row style={{ justifyContent: 'space-between' }}>
        <Eyebrow>Prescriptions</Eyebrow>
        <Badge label={String(items.length)} tone="neutral" />
      </Row>

      <Row gap={8} style={{ marginTop: 12, flexWrap: 'wrap' }}>
        <Button
          title="Generate from notes"
          variant="ghost"
          leftIcon={<SparklesIcon size={15} color={c.brand} />}
          onPress={generateFromNotes}
          disabled={alreadyGenerated || pending || !clientId}
        />
        <Button title="Add" variant="secondary" leftIcon={<PlusIcon size={15} color={c.ink} />} onPress={add} />
      </Row>

      <View style={{ height: 12 }} />
      {items.map((t) => (
        <Row key={t.id} gap={10} style={{ alignItems: 'flex-start', marginBottom: 14 }}>
          <Pressable
            onPress={() => toggle(t.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!t.checked }}
            hitSlop={6}
            style={{
              width: 18,
              height: 18,
              borderRadius: 5,
              borderWidth: 1.5,
              borderColor: t.checked ? c.brandStrong : c.line,
              backgroundColor: t.checked ? c.brandStrong : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 1,
            }}
          >
            {t.checked ? <CheckIcon size={12} color={c.onBrand} /> : null}
          </Pressable>
          <View style={{ flex: 1 }}>
            {t.isNew ? (
              <TextInput
                autoFocus
                placeholder="New prescription…"
                placeholderTextColor={c.ink3}
                value={t.text}
                onChangeText={(v) => setText(t.id, v)}
                onBlur={() => commit(t.id)}
                onSubmitEditing={() => commit(t.id)}
                style={{ color: c.ink, fontFamily: theme.type.body.fontFamily, fontSize: 15, borderBottomWidth: 1, borderBottomColor: c.line, paddingVertical: 2 }}
              />
            ) : (
              <Row gap={7} style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                <AppText variant="body" style={{ textDecorationLine: t.checked ? 'line-through' : 'none', color: t.checked ? c.ink3 : c.ink }}>
                  {t.text}
                </AppText>
                {t.generated ? <Badge label="generated" tone="brand" /> : null}
              </Row>
            )}
            <AppText variant="small" color="ink3" style={{ marginTop: 2 }}>
              {t.source}
            </AppText>
          </View>
        </Row>
      ))}
      <AppText variant="small" color="ink3" style={{ marginTop: 2, lineHeight: 17 }}>
        Your prescriptions — write them, or <AppText variant="bodyStrong" color="ink3">Generate from notes</AppText> to pull actions from the Plan section. Tick as you assign.
      </AppText>
    </View>
  );
}

function ReviewCodes({ draft }: { draft: DraftNote }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View>
      <Row style={{ justifyContent: 'space-between' }}>
        <Eyebrow>Suggested review codes</Eyebrow>
        <Badge label={String(draft.reviewCodes.length)} tone="neutral" />
      </Row>
      <View style={{ height: 12 }} />
      {draft.reviewCodes.map((rc) => (
        <Row key={rc.code} gap={12} style={{ alignItems: 'flex-start', marginBottom: 14 }}>
          <View style={{ backgroundColor: c.brandBg, borderRadius: theme.radii.xs, paddingVertical: 4, paddingHorizontal: 8 }}>
            <AppText variant="small" tint={c.brand} style={{ fontFamily: theme.type.numeric.fontFamily, fontSize: 12 }}>
              {rc.code}
            </AppText>
          </View>
          <AppText variant="body" color="ink2" style={{ flex: 1 }}>
            {rc.label}
          </AppText>
          <AppText variant="small" color="ink3">
            {rc.relevance}
          </AppText>
        </Row>
      ))}
      <AppText variant="small" color="ink3" style={{ marginTop: 2 }}>
        Suggestions only · you confirm or replace each. The risk &amp; safety check lives in the note body, not here.
      </AppText>
    </View>
  );
}

/* ------------------------------------------------------------ audio trust --- */

/**
 * Sequential playback of every real audio segment kept for this note — the original recording, then
 * each later "Continue recording" append, in order, as ONE continuous listen. Gated entirely on
 * `segments` being non-empty (real `blob:` captures only, from `audioVault.ts` — never the sample
 * clip or a failed capture), so this never offers to play audio that doesn't exist. Advances to the
 * next segment on `ended`; a segment the browser refuses to play (autoplay policy, revoked blob after
 * a reload) stops playback and says so rather than silently going quiet.
 */
function StitchedAudioPlayer({ segments, tint }: { segments: AudioSegment[]; tint: string }) {
  const theme = useTheme();
  const c = theme.colors;
  const [state, setState] = useState<'idle' | 'playing' | 'blocked'>('idle');
  const [index, setIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
    },
    [],
  );

  const playFrom = (i: number) => {
    if (i >= segments.length) {
      setState('idle');
      setIndex(0);
      return;
    }
    const AudioCtor = (globalThis as { window?: { Audio?: new (src?: string) => HTMLAudioElement } }).window?.Audio;
    if (!AudioCtor) {
      setState('blocked');
      return;
    }
    const el = new AudioCtor(segments[i].uri);
    audioRef.current = el;
    setIndex(i);
    el.onended = () => playFrom(i + 1);
    el.onerror = () => setState('blocked');
    el
      .play()
      .then(() => setState('playing'))
      // Browsers can refuse an unprompted play() (autoplay policy) even from a real tap in some
      // embeds — say so rather than leaving a "Playing" label over silence.
      .catch(() => setState('blocked'));
  };

  const pause = () => {
    audioRef.current?.pause();
    setState('idle');
  };

  const playing = state === 'playing';
  const multi = segments.length > 1;

  return (
    <View style={{ marginTop: 10 }}>
      <Pressable
        onPress={playing ? pause : () => playFrom(state === 'blocked' ? 0 : index)}
        accessibilityRole="button"
        accessibilityLabel={
          playing
            ? 'Pause playback'
            : multi
              ? `Play the stitched recording — ${segments.length} segments in order`
              : 'Play the recording'
        }
        style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
      >
        <Row gap={7} style={{ alignItems: 'flex-start' }}>
          <View style={{ marginTop: 1 }}>
            {playing ? <PauseIcon size={13} color={tint} /> : <PlayIcon size={13} color={tint} />}
          </View>
          <AppText variant="small" tint={tint} style={{ flex: 1, fontSize: 11.5, lineHeight: 16 }}>
            {playing
              ? 'Pause'
              : multi
                ? `Play the stitched recording — the original plus ${segments.length - 1} added segment${segments.length - 1 === 1 ? '' : 's'}, in order`
                : 'Play the recording'}
          </AppText>
        </Row>
      </Pressable>
      {playing ? (
        <AppText variant="small" color="ink3" style={{ marginTop: 4, fontSize: 11, marginLeft: 20 }}>
          Playing {index + 1} of {segments.length} — {segments[index].label}
        </AppText>
      ) : null}
      {state === 'blocked' ? (
        <AppText variant="small" tint={c.caution} style={{ marginTop: 4, fontSize: 11, marginLeft: 20, lineHeight: 15 }}>
          Couldn’t play — your browser blocked it, or this audio was only kept for the tab that recorded it and
          this is a different one.
        </AppText>
      ) : null}
    </View>
  );
}

/**
 * Audio-trust moment (round-2 change #7). Deletion is the DEFAULT — the honest copy says the
 * recording is already gone. A visible "Keep the audio" toggle lets the clinician retain it;
 * kept, a real `StitchedAudioPlayer` plays back whatever was actually captured for this note THIS
 * SESSION (`audioVault.ts` — in-memory only, so a reload genuinely loses it, matching "for this
 * session" in the copy below rather than quietly under-delivering on it).
 *
 * This card speaks about the AUDIO, so it reads the note's recorded upload disclosure — not whether
 * the transcription actually returned anything, which is a separate fact the Transcript tab reports.
 * A recording that was uploaded and then 429'd still left this device, and this card must say so.
 * Legacy signed notes drafted before provenance was recorded carry no value; those fall back to the
 * build's configuration.
 */
function AudioTrust({ audioLeftDevice, clientId, noteIndex }: { audioLeftDevice?: boolean; clientId?: string; noteIndex: number }) {
  const theme = useTheme();
  const c = theme.colors;
  const [kept, setKept] = useState(false);
  const audioWentToCloud = audioLeftDevice ?? hasGroq;
  // Read once — nothing can add a segment to an already-SIGNED note (Continue recording is gated off
  // the moment a note is signed), so the list is final by the time this card can render at all.
  const segments = useMemo(() => (clientId ? getAudioSegments(clientId, noteIndex) : []), [clientId, noteIndex]);

  const tint = kept ? c.brand : c.positive;
  const bg = kept ? c.brandBg : c.positiveBg;

  return (
    <Card tone="elevated" elevation="none" radius="md" style={{ backgroundColor: bg, borderColor: bg }}>
      <Row gap={9}>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
          <CheckIcon size={12} color={c.surface} />
        </View>
        <AppText variant="bodyStrong" tint={tint}>
          {kept ? 'Audio kept for this session' : 'Recording deleted'}
        </AppText>
      </Row>
      <AppText variant="small" color="ink2" style={{ marginTop: 8, lineHeight: 18 }}>
        {/* Honest audio provenance (F9): when the audio was sent to the cloud to transcribe, we must
            not claim it "never left this device". */}
        {kept
          ? audioWentToCloud
            ? 'You chose to keep this recording. A copy was sent to the cloud (Groq) to transcribe; the copy you kept stays on this device and makes replay-with-notes possible for this session.'
            : 'You chose to keep this recording. It stays on this device and never leaves it. Keeping the audio is what makes replay-with-notes possible for this session.'
          : audioWentToCloud
            ? 'This recording was sent to the cloud (Groq) to transcribe, then deleted — deletion is the default after every session. Only the draft you reviewed remains.'
            : 'The recording never left this device, and it’s now gone — deletion is the default after every session. Only the draft you reviewed remains.'}
      </AppText>

      <Pressable
        onPress={() => setKept((v) => !v)}
        accessibilityRole="switch"
        accessibilityState={{ checked: kept }}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, marginTop: 12 })}
      >
        <Row gap={9}>
          <View
            style={{
              width: 34,
              height: 19,
              borderRadius: 999,
              padding: 1,
              backgroundColor: kept ? c.brand : c.sunken,
              borderWidth: 1,
              borderColor: kept ? c.brand : c.line,
              alignItems: kept ? 'flex-end' : 'flex-start',
              justifyContent: 'center',
            }}
          >
            <View style={{ width: 15, height: 15, borderRadius: 8, backgroundColor: c.elevated }} />
          </View>
          <AppText variant="small" tint={c.ink2} style={{ fontSize: 12 }}>
            Keep the audio for this session instead
          </AppText>
        </Row>
      </Pressable>

      {kept ? (
        segments.length ? (
          <StitchedAudioPlayer segments={segments} tint={c.brand} />
        ) : (
          <Row gap={7} style={{ marginTop: 10, alignItems: 'flex-start' }}>
            <View style={{ marginTop: 1 }}>
              <PlayIcon size={13} color={c.ink3} />
            </View>
            <AppText variant="small" color="ink3" style={{ flex: 1, fontSize: 11.5, lineHeight: 16 }}>
              Nothing to play back — either this session used the demo sample, or this browser tab has
              reloaded since it was recorded (kept audio only lasts the tab that captured it).
            </AppText>
          </Row>
        )
      ) : null}
    </Card>
  );
}

/**
 * Unlock is a one-way-door reversal in the other direction: it reopens a signed, read-only note for
 * editing, so a single stray tap must never do it — the same reasoning that keeps sign-off itself a
 * two-step confirm (arm, then an explicit confirm; Cancel is the only way back, and the armed state
 * never times out). The note becomes an unsigned draft on confirm and needs a fresh sign-off before it
 * is authoritative again.
 */
function UnlockNoteButton({ onUnlock }: { onUnlock: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return <Button title="Unlock note" variant="secondary" onPress={() => setConfirming(true)} />;
  }
  return (
    <View>
      <AppText variant="small" color="ink2">
        Unlock this note for editing? It will need to be signed again before it’s authoritative.
      </AppText>
      <Row gap={10} style={{ marginTop: 10 }}>
        <Button title="Cancel" variant="secondary" onPress={() => setConfirming(false)} />
        <Button
          title="Confirm unlock"
          variant="secondary"
          accessibilityLabel="Confirm unlock — the note returns to an unsigned draft"
          onPress={onUnlock}
        />
      </Row>
    </View>
  );
}

/**
 * Sign-off is a one-way door — the note becomes read-only the moment it is signed
 * (`updateNoteSection` refuses a signed note), so a single stray tap must never be able to attest a
 * note the clinician hasn't finished reviewing. First tap arms the control; the attestation only
 * happens on an explicit "Confirm sign-off". The confirm is inline on the same control, not a
 * modal — RN's Alert renders nothing on web — and Cancel is the only way back; the armed state
 * never times out under the clinician's hands.
 */
function SignOffButton({ onSign }: { onSign: () => void }) {
  const theme = useTheme();
  const c = theme.colors;
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button
        title="Sign off"
        variant="primary"
        leftIcon={<CheckIcon size={16} color={c.onBrand} />}
        onPress={() => setConfirming(true)}
      />
    );
  }
  return (
    <Row gap={10} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
      <AppText variant="small" color="ink2">
        Sign &amp; lock this note?
      </AppText>
      <Button title="Cancel" variant="secondary" onPress={() => setConfirming(false)} />
      <Button
        title="Confirm sign-off"
        variant="primary"
        leftIcon={<CheckIcon size={16} color={c.onBrand} />}
        accessibilityLabel="Confirm sign-off — the note becomes read-only"
        onPress={onSign}
      />
    </Row>
  );
}

/**
 * Re-record affordance (round-2 item 3, 2026-08-17). "There is no rerecord option for the analysis
 * page" — the review screen previously had no way back to capture other than the generic Back link,
 * which returns to wherever the counselor came from rather than starting a fresh capture for this
 * client. This returns to `/(app)/session` for the SAME client (the exact route `today/ready.tsx`
 * uses to begin a session), via `router.replace` — same navigation shape as that entry point.
 *
 * Two-step confirm (mirrors `UnlockNoteButton`'s arm/confirm shape — Cancel is the only way back, no
 * timeout) ONLY when it would actually discard something: an UNSIGNED draft is a review-in-progress
 * that a fresh recording could bury (up to 3 notes are retained per client — C4 — so a 4th capture
 * rotates the oldest out). A SIGNED note is already a finalised record nothing here can lose, so that
 * case re-records immediately with no confirm.
 */
function ReRecordAction({ clientId, signed }: { clientId: string; signed: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const goRecord = () => router.replace(`/(app)/session?clientId=${encodeURIComponent(clientId)}`);

  if (!confirming) {
    return (
      <Button
        title="Re-record this session"
        variant="secondary"
        onPress={() => (signed ? goRecord() : setConfirming(true))}
      />
    );
  }
  return (
    <View>
      <AppText variant="small" color="ink2">
        Start a new recording for this client? This draft stays saved as one of your recent notes — but
        it hasn’t been signed yet, and only the 3 most recent notes are kept per client, so it can be
        rotated out later. Sign or note it down first if you need to keep it front and center.
      </AppText>
      <Row gap={10} style={{ marginTop: 10 }}>
        <Button title="Cancel" variant="secondary" onPress={() => setConfirming(false)} />
        <Button
          title="Start new recording"
          variant="secondary"
          accessibilityLabel="Confirm re-record — returns to capture for this client"
          onPress={goRecord}
        />
      </Row>
    </View>
  );
}

/**
 * "Continue recording" (captain, 2026-08-17) — next to Re-record, but the opposite shape: Re-record starts a
 * FRESH note (the old draft rotates in the C4 retention list); Continue recording appends the new capture's
 * transcript onto THIS SAME note (`DataProvider.appendRecording`, threaded through as `mode=append` +
 * `note=<noteIndex>` — mirroring how Re-record threads `clientId`) so nothing is discarded and no
 * duplicate note is minted.
 *
 * Never available on a signed note (`signed` hides it entirely, no confirm dialog to bypass) — a
 * signed note is read-only, the same rule `updateNoteSection` and `appendRecording` both enforce at
 * their own seam, so this is belt-and-suspenders with those, not the only guard. No two-step confirm:
 * appending is additive and nothing on the note is discarded, unlike Re-record's fresh-note risk to the
 * C4 retention cap.
 */
function ContinueRecordingAction({ clientId, noteIndex, signed }: { clientId: string; noteIndex: number; signed: boolean }) {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  if (signed) return null;
  return (
    <Button
      title="Continue recording"
      variant="secondary"
      leftIcon={<PlusIcon size={15} color={c.ink} />}
      accessibilityLabel="Continue recording — record more and append it to this note"
      onPress={() => router.replace(`/(app)/session?clientId=${encodeURIComponent(clientId)}&mode=append&note=${noteIndex}`)}
    />
  );
}

function SignOff({
  signed,
  onSign,
  onUnlock,
  clinician,
  signedAt,
}: {
  signed: boolean;
  onSign: () => void;
  onUnlock: () => void;
  clinician: string;
  signedAt: string | null;
}) {
  const theme = useTheme();
  const c = theme.colors;
  if (signed) {
    return (
      <Card tone="elevated" elevation="none" radius="md" style={{ backgroundColor: c.positiveBg, borderColor: c.positiveBg }}>
        <AppText variant="bodyStrong">Sign-off</AppText>
        <Row gap={8} style={{ marginTop: 8 }}>
          <CheckIcon size={16} color={c.positive} />
          <AppText variant="body" color="ink2" style={{ flex: 1 }}>
            Signed by {clinician}{signedAt ? ` · ${signedAt}` : ''} · read-only
          </AppText>
        </Row>
        <View style={{ height: 14 }} />
        <UnlockNoteButton onUnlock={onUnlock} />
      </Card>
    );
  }
  return (
    <Card tone="elevated" radius="md" elevation="sm">
      <AppText variant="bodyStrong">Sign-off</AppText>
      <AppText variant="body" color="ink2" style={{ marginTop: 8 }}>
        You are the final authority. Signing marks this note authoritative and makes it read-only. You can still append an addendum later.
      </AppText>
      <View style={{ height: 14 }} />
      <Row gap={10}>
        {/* Editing happens inline per section — each section's Edit toggle persists on "Done" — so the
            former dead "Edit first" no-op was removed rather than left as a broken promise. */}
        <SignOffButton onSign={onSign} />
      </Row>
    </Card>
  );
}

/**
 * The session rail — the client's OWN retained notes (up to 3, newest first — C4), never a hardcoded
 * fixture list (N1). Each entry switches the review pane to that note, so an earlier session's full
 * note text stays reachable instead of being overwritten. Every row — active or not — reads its own
 * persisted status and signer, so an attestation is never attributed to the wrong clinician.
 */
function SessionList({
  clientId,
  clientName,
  notes,
  activeIndex,
  clinician,
}: {
  clientId: string;
  clientName: string;
  notes: DraftNote[];
  activeIndex: number;
  clinician: string;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();

  return (
    <View>
      <Eyebrow>Sessions · {clientName}</Eyebrow>
      <View style={{ height: 12 }} />
      {notes.map((n, i) => {
        const active = i === activeIndex;
        const status: { label: string; tone: 'positive' | 'draft' | 'neutral' } =
          n.status === 'signed'
            ? { label: `Signed · ${!n.signedBy || n.signedBy === clinician ? 'you' : n.signedBy}`, tone: 'positive' }
            : active
              ? { label: 'Draft · review', tone: 'draft' }
              : { label: 'Earlier note', tone: 'neutral' };
        return (
          <Pressable
            key={i}
            onPress={() => router.replace(`/(app)/session/review?clientId=${encodeURIComponent(clientId)}&note=${i}`)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${n.sessionLabel}`}
            accessibilityState={{ selected: active }}
            style={{
              backgroundColor: active ? c.brandBg : 'transparent',
              borderRadius: theme.radii.sm,
              padding: 12,
              marginBottom: 6,
              borderLeftWidth: active ? 3 : 0,
              borderLeftColor: c.brand,
            }}
          >
            <AppText variant="bodyStrong" style={{ fontSize: 14 }}>
              {n.sessionLabel}
            </AppText>
            <AppText variant="small" color="ink3" numberOfLines={1} style={{ marginTop: 4 }}>
              {n.sourceLine}
            </AppText>
            <View style={{ marginTop: 8 }}>
              <Badge label={status.label} tone={status.tone} />
            </View>
          </Pressable>
        );
      })}
      <AppText variant="small" color="ink3" style={{ marginTop: 2, fontSize: 11 }}>
        Up to 3 recent notes are kept per client.
      </AppText>
    </View>
  );
}

function SignedChip({ clinician, signedAt }: { clinician: string; signedAt: string | null }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.positiveBg, borderRadius: theme.radii.pill, paddingVertical: 4, paddingHorizontal: 10 }}>
      <CheckIcon size={13} color={c.positive} />
      <AppText variant="bodyStrong" tint={c.positive} style={{ fontSize: 12 }}>
        Signed · {clinician}{signedAt ? ` · ${signedAt}` : ''}
      </AppText>
    </View>
  );
}
