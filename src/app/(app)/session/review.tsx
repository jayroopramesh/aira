import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, CheckIcon, CopyIcon, PlayIcon, PlusIcon, ShieldIcon, SparklesIcon } from '../../../components/icons';
import { BackLink, PageHeader, Screen } from '../../../components/Screen';
import { AppText, Badge, Button, Card, Divider, Eyebrow, Row, TrustPill } from '../../../components/ui';
import { ZeroState } from '../../../components/ZeroState';
import { hasGroq } from '../../../config/env';
import { useClient, useClientNotes, useData, useDraftNote } from '../../../data/DataProvider';
import { DraftNote, NoteSection, PrepItem } from '../../../data/types';
import { authService } from '../../../services/auth';
import { useTheme } from '../../../theme/ThemeProvider';

const TABS = ['Note', 'Transcript', 'Context', '+ Screening tools'] as const;
type Tab = (typeof TABS)[number];

/** "13 Aug 14:18" — the real moment the clinician signed (F8), not a hardcoded timestamp. */
function formatSignedAt(d: Date): string {
  const date = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} ${time}`;
}

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

export default function ReviewNote() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 1040;
  const { clientId, note: noteParam } = useLocalSearchParams<{ clientId: string; note?: string }>();
  // Up to 3 notes are retained per client (C4); `note` selects which retained note to review (newest = 0).
  const notes = useClientNotes(clientId);
  const parsedIndex = noteParam ? Number(noteParam) : 0;
  const noteIndex = Number.isInteger(parsedIndex) && parsedIndex >= 0 && parsedIndex < notes.length ? parsedIndex : 0;
  const draft = useDraftNote(clientId, noteIndex);
  const client = useClient(clientId);
  const { signNote } = useData();

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
  // Sections register a flush here while they hold an uncommitted edit. Signing runs them FIRST, so a
  // correction typed but not "Done"-ed still lands in the note that gets signed instead of being
  // silently dropped — the clinician pressed Sign off, not Discard. Each flush persists through the
  // same seam, and `persist` advances the provider's snapshot synchronously, so the sign write that
  // follows in this same tick already carries the edit.
  const pendingEdits = useRef(new Map<string, () => void>());
  const sign = () => {
    if (!clientId) return;
    pendingEdits.current.forEach((flush) => flush());
    signNote(clientId, noteIndex, clinician, formatSignedAt(new Date()));
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

  const rail = <ReviewRail key={noteKey} draft={draft} signed={signed} onSign={sign} clinician={signedByName} signedAt={signedAt} />;
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
            <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <Row gap={10} style={{ flexWrap: 'wrap' }}>
                <AppText variant="h1" style={{ fontSize: 23 }}>
                  {draft.sessionLabel}
                </AppText>
                {signed ? <SignedChip clinician={signedByName} signedAt={signedAt} /> : <Badge label="Draft · review" tone="draft" />}
              </Row>
              {/* Honest scope (F9): the DRAFT is device-local; there is no de-identification hop in demo
                  mode, so this must not claim "de-identified". The cloud transcription hop is disclosed
                  by the demo banner and the audio-trust note below. */}
              <TrustPill label="Draft stays on this device" icon={<ShieldIcon size={13} color={c.brand} />} />
            </Row>
            <AppText variant="small" color="ink3" style={{ marginTop: 8 }}>
              {draft.sourceLine}
            </AppText>

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
                transcribedInCloud={draft.transcribedInCloud}
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
            <Button title="Sign off" variant="primary" onPress={sign} />
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
          Objective (incl. the measures table) under one D — Data section; Risk & Safety Check stays
          its own always-present section, then A, then P. SOAP is the default. */}
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
          {risk ? <Section key={risk.id} section={risk} measures={draft.measures} editable={editable} onSave={saveSection} pendingEdits={pendingEdits} /> : null}
          {assessment ? <Section key={assessment.id} section={assessment} measures={draft.measures} editable={editable} onSave={saveSection} pendingEdits={pendingEdits} /> : null}
          {plan ? <Section key={plan.id} section={plan} measures={draft.measures} editable={editable} onSave={saveSection} pendingEdits={pendingEdits} /> : null}
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
 * note is read back. Only the both-recorded-on-device branch may say nothing was sent anywhere: with
 * keys configured the transcript text goes to Groq to draft even when the audio never left the device.
 * When a hop wasn't recorded (older notes) nothing is claimed about it in either direction.
 */
function TranscriptPane({
  transcript,
  transcribedInCloud,
  draftedInCloud,
  signed,
}: {
  transcript?: string;
  transcribedInCloud?: boolean;
  draftedInCloud?: boolean;
  signed: boolean;
}) {
  const text = transcript?.trim();

  if (!text) {
    return (
      <Card tone="sunken" elevation="none" radius="md">
        <AppText variant="body" color="ink2">
          No transcript is stored for this note. Sample data and notes captured before transcripts were
          saved don’t include the session text — nothing is shown here rather than standing in a placeholder
          for the real session.
        </AppText>
      </Card>
    );
  }

  return (
    <View>
      <AppText variant="small" color="ink3" style={{ marginBottom: 10 }}>
        {(transcribedInCloud === true
          ? 'The transcript of this session, kept on this device. The audio was sent to the cloud (Groq) to transcribe, then deleted — only this text remains. There is no on-device de-identification hop in demo mode.'
          : transcribedInCloud === false && draftedInCloud === true
            ? 'The transcript of this session, produced and kept on this device — the audio was never sent for transcription. The note was drafted in the cloud, so this text was sent to Groq to draft from (see the demo banner). There is no on-device de-identification hop in demo mode.'
            : transcribedInCloud === false && draftedInCloud === false
              ? 'The transcript of this session, produced and kept on this device — nothing was sent anywhere, and no de-identification step runs.'
              : 'The transcript of this session, kept on this device. This note doesn’t record where it was transcribed or drafted, so nothing is claimed either way.') +
          (signed ? '' : ' Check the note against it before signing.')}
      </AppText>
      <Card tone="sunken" elevation="none" radius="md">
        <AppText variant="body" color="ink2" selectable style={{ lineHeight: 22 }}>
          {text}
        </AppText>
      </Card>
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
  clinician,
  signedAt,
}: {
  draft: DraftNote;
  signed: boolean;
  onSign: () => void;
  clinician: string;
  signedAt: string | null;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.lg }}>
      <PrescriptionsRail draft={draft} />
      <Divider />
      <ReviewCodes draft={draft} />
      <Divider />
      {signed ? <AudioTrust transcribedInCloud={draft.transcribedInCloud} /> : null}
      <SignOff signed={signed} onSign={onSign} clinician={clinician} signedAt={signedAt} />
    </View>
  );
}

/* -------------------------------------------------------- prescriptions --- */

type Rx = PrepItem & { generated?: boolean; checked?: boolean; isNew?: boolean };

/**
 * Prescriptions rail (round-2 change #6, renamed from "Tasks for next session"). The
 * clinician writes prescriptions ("+ Add", inline editable) or pulls them from the Plan
 * section ("Generate from notes", tagged "generated"). Checklist ticking lives here.
 */
function PrescriptionsRail({ draft }: { draft: DraftNote }) {
  const theme = useTheme();
  const c = theme.colors;
  const [items, setItems] = useState<Rx[]>(draft.prescriptions.map((p) => ({ ...p })));
  const [generated, setGenerated] = useState(false);
  const nextRxId = useRef(0);

  const toggle = (id: string) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, checked: !x.checked } : x)));
  const setText = (id: string, text: string) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, text } : x)));

  const generateFromNotes = () => {
    if (generated) return;
    const plan = draft.sections.find((s) => s.marker === 'P');
    const pulled: Rx[] = (plan?.bullets ?? []).map((b, i) => ({
      id: `gen-${i}`,
      text: b,
      source: 'from Plan',
      done: false,
      generated: true,
    }));
    setItems((xs) => [...xs, ...pulled]);
    setGenerated(true);
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
          disabled={generated}
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
 * Audio-trust moment (round-2 change #7). Deletion is the DEFAULT — the honest copy says the
 * recording is already gone. A visible "Keep the audio" toggle lets the clinician retain it;
 * kept, the copy is equally honest and notes that replay-with-notes becomes available.
 *
 * This card speaks about the AUDIO, so it reads the same recorded transcription provenance the
 * Transcript tab does — the two can never disagree about the same note. Legacy signed notes drafted
 * before provenance was recorded carry no value; those fall back to the build's configuration.
 */
function AudioTrust({ transcribedInCloud }: { transcribedInCloud?: boolean }) {
  const theme = useTheme();
  const c = theme.colors;
  const [kept, setKept] = useState(false);
  const audioWentToCloud = transcribedInCloud ?? hasGroq;

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
        <Row gap={7} style={{ marginTop: 10, alignItems: 'flex-start' }}>
          <View style={{ marginTop: 1 }}>
            <PlayIcon size={13} color={c.brand} />
          </View>
          <AppText variant="small" tint={c.brand} style={{ flex: 1, fontSize: 11.5, lineHeight: 16 }}>
            Replay-with-notes is now available — your timestamped notes highlight as it plays.
          </AppText>
        </Row>
      ) : null}
    </Card>
  );
}

function SignOff({ signed, onSign, clinician, signedAt }: { signed: boolean; onSign: () => void; clinician: string; signedAt: string | null }) {
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
        <Button title="Sign off" variant="primary" leftIcon={<CheckIcon size={16} color={c.onBrand} />} onPress={onSign} />
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
