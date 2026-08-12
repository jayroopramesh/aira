import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, CheckIcon, ShieldIcon } from '../../../components/icons';
import { AppText, Badge, Button, Card, Divider, Eyebrow, Row, TrustPill } from '../../../components/ui';
import { AMARA_DRAFT } from '../../../data/fixtures';
import { DraftNote, NoteSection } from '../../../data/types';
import { useTheme } from '../../../theme/ThemeProvider';

const TABS = ['Note', 'Transcript', 'Context', '+ Screening tools'] as const;
type Tab = (typeof TABS)[number];

export default function ReviewNote() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 1040;
  const draft = AMARA_DRAFT;

  const [tab, setTab] = useState<Tab>('Note');
  const [signed, setSigned] = useState(false);

  const rail = <ReviewRail draft={draft} signed={signed} onSign={() => setSigned(true)} />;
  const sessions = <SessionList signed={signed} />;

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <ScrollView contentContainerStyle={{ paddingBottom: signed ? 60 : 140 }}>
        <View style={{ flexDirection: wide ? 'row' : 'column', maxWidth: 1320, width: '100%', alignSelf: 'center', gap: wide ? 0 : theme.spacing.lg }}>
          {/* Left: session list */}
          {wide ? (
            <View style={{ width: 232, borderRightWidth: 1, borderRightColor: c.line, paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.lg }}>
              {sessions}
            </View>
          ) : null}

          {/* Center: note */}
          <View style={{ flex: 1, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg, minWidth: 0 }}>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <Row gap={10} style={{ flexWrap: 'wrap' }}>
                <AppText variant="h1" style={{ fontSize: 23 }}>
                  {draft.sessionLabel}
                </AppText>
                {signed ? <SignedChip /> : <Badge label="Draft · review" tone="draft" />}
              </Row>
              <TrustPill label="De-identified on this device" icon={<ShieldIcon size={13} color={c.brand} />} />
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
              <NotePane draft={draft} signed={signed} />
            ) : (
              <OtherPane tab={tab} />
            )}

            {/* On phone, the rail (tasks / codes / sign-off) stacks below the note. */}
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
          <Row style={{ justifyContent: 'space-between', maxWidth: 1320, width: '100%', alignSelf: 'center', flexWrap: 'wrap', gap: 10 }}>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              <Button title="Regenerate" variant="ghost" onPress={() => {}} />
              <Button title="Add" variant="ghost" onPress={() => {}} />
              <Button title="Replace" variant="ghost" onPress={() => {}} />
              <Button title="Copy" variant="ghost" onPress={() => {}} />
            </Row>
            <Row gap={10}>
              <Button title="Edit note" variant="secondary" onPress={() => {}} />
              <Button title="Sign off" variant="primary" onPress={() => setSigned(true)} />
            </Row>
          </Row>
        </View>
      ) : (
        <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: insets.bottom + 16, maxWidth: 1320, width: '100%', alignSelf: 'center' }}>
          <Button
            title="Back to today"
            variant="secondary"
            rightIcon={<ArrowRight size={18} color={c.ink} />}
            onPress={() => router.replace('/(app)/today')}
          />
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------- note pane --- */

function NotePane({ draft, signed }: { draft: DraftNote; signed: boolean }) {
  const theme = useTheme();
  const c = theme.colors;
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

      {draft.sections.map((s) => (
        <Section key={s.id} section={s} measures={draft.measures} editable={!signed} />
      ))}
    </View>
  );
}

function Section({ section, measures, editable }: { section: NoteSection; measures: DraftNote['measures']; editable: boolean }) {
  const theme = useTheme();
  const c = theme.colors;
  const [regenerating, setRegenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(section.body.join('\n\n'));

  const isRisk = section.isRisk;

  return (
    <View
      style={[
        { marginBottom: theme.spacing.xl },
        isRisk ? { backgroundColor: c.riskBg, borderRadius: theme.radii.lg, padding: theme.spacing.lg } : null,
      ]}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={10}>
          <AppText variant="label" tint={c.brand}>
            {section.index}
          </AppText>
          <Eyebrow color={isRisk ? 'risk' : 'brand'}>{section.title}</Eyebrow>
        </Row>
        {editable ? (
          <Row gap={12}>
            <Pressable onPress={() => { setRegenerating(true); setTimeout(() => setRegenerating(false), 900); }}>
              <AppText variant="small" tint={c.brand}>
                {regenerating ? 'Regenerating…' : 'Regenerate'}
              </AppText>
            </Pressable>
            <Pressable onPress={() => setEditing((e) => !e)}>
              <AppText variant="small" tint={c.brand}>
                {editing ? 'Done' : 'Edit'}
              </AppText>
            </Pressable>
          </Row>
        ) : null}
      </Row>

      <View style={{ height: 10 }} />

      {isRisk ? (
        <View style={{ marginBottom: 12 }}>
          <Row gap={8} style={{ marginBottom: 12 }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.riskFill }} />
            <AppText variant="bodyStrong" tint={c.risk}>
              Screened this session · routine
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

      {editing ? (
        <TextInput
          multiline
          value={text}
          onChangeText={setText}
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
        <View style={{ opacity: regenerating ? 0.45 : 1 }}>
          {(editing ? [text] : section.body).map((p, i) => (
            <AppText key={i} variant="body" color={isRisk ? 'ink' : 'ink'} style={{ marginBottom: 8 }}>
              {p}
            </AppText>
          ))}
          {section.quote ? (
            <View style={{ borderLeftWidth: 3, borderLeftColor: c.brandBd, paddingLeft: 12, marginTop: 6 }}>
              <AppText variant="body" color="ink2" style={{ fontStyle: 'italic' }}>
                “{section.quote}”
              </AppText>
            </View>
          ) : null}
        </View>
      )}

      {/* Symptom-check measures table sits under section 2. */}
      {section.index === 2 ? <MeasureTable measures={measures} /> : null}
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

function OtherPane({ tab }: { tab: Tab }) {
  const theme = useTheme();
  const c = theme.colors;
  const copy: Record<string, string> = {
    Transcript: 'The de-identified transcript lives here. Identifiers were tokenized on-device before drafting and the audio is deleted after transcription — only this reviewed text remains.',
    Context: 'Prior-session context Aira grounded the draft against: last plan, latest measures, and standing safety items. Naturalistic journal entries are shown separately and never blended with clinical scores.',
    '+ Screening tools': 'Generated outputs (e.g. a PHQ-9 / GAD-7 screening summary) appear here as sibling tabs on the same session — added on demand, never overwriting the note.',
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

function ReviewRail({ draft, signed, onSign }: { draft: DraftNote; signed: boolean; onSign: () => void }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View style={{ gap: theme.spacing.lg }}>
      {/* Tasks for next session */}
      <View>
        <Row style={{ justifyContent: 'space-between' }}>
          <Eyebrow>Tasks for next session</Eyebrow>
          <Badge label={String(draft.tasks.length)} tone="neutral" />
        </Row>
        <View style={{ height: 12 }} />
        {draft.tasks.map((t) => (
          <Row key={t.id} gap={10} style={{ alignItems: 'flex-start', marginBottom: 14 }}>
            <View style={{ width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: c.line, marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <AppText variant="body">{t.text}</AppText>
              <AppText variant="small" color="ink3" style={{ marginTop: 2 }}>
                {t.source}
              </AppText>
            </View>
          </Row>
        ))}
      </View>

      <Divider />

      {/* Suggested review codes */}
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

      <Divider />

      {/* Sign-off / audio-deleted */}
      {signed ? (
        <>
          <Card tone="elevated" elevation="none" radius="md" style={{ backgroundColor: c.positiveBg, borderColor: c.positiveBg }}>
            <Row gap={8}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c.positive, alignItems: 'center', justifyContent: 'center' }}>
                <CheckIcon size={14} color={c.onBrand} />
              </View>
              <AppText variant="bodyStrong" tint={c.positive}>
                Recording deleted
              </AppText>
            </Row>
            <AppText variant="body" color="ink2" style={{ marginTop: 10 }}>
              The recording never left this device, and it’s now gone. Only the de-identified draft you reviewed remains. This happens after every session — a promise you can watch keep itself.
            </AppText>
          </Card>
          <Card tone="elevated" elevation="none" radius="md" style={{ backgroundColor: c.positiveBg, borderColor: c.positiveBg }}>
            <AppText variant="bodyStrong">Sign-off</AppText>
            <Row gap={8} style={{ marginTop: 8 }}>
              <CheckIcon size={16} color={c.positive} />
              <AppText variant="body" color="ink2" style={{ flex: 1 }}>
                Signed by Dr. Okafor · 12 Aug 11:18 · read-only
              </AppText>
            </Row>
          </Card>
        </>
      ) : (
        <Card tone="elevated" radius="md" elevation="sm">
          <AppText variant="bodyStrong">Sign-off</AppText>
          <AppText variant="body" color="ink2" style={{ marginTop: 8 }}>
            You are the final authority. Signing marks this note authoritative and makes it read-only. You can still append an addendum later.
          </AppText>
          <View style={{ height: 14 }} />
          <Row gap={10}>
            <Button title="Edit first" variant="secondary" onPress={() => {}} />
            <Button title="Sign off" variant="primary" leftIcon={<CheckIcon size={16} color={c.onBrand} />} onPress={onSign} />
          </Row>
        </Card>
      )}
    </View>
  );
}

function SessionList({ signed = false }: { signed?: boolean }) {
  const theme = useTheme();
  const c = theme.colors;
  const rows = [
    {
      label: 'Session 5 · today',
      time: '10:30',
      sub: 'Presenting concerns, symptom che…',
      status: signed ? 'Signed · you' : 'Draft · review',
      active: true,
      tone: (signed ? 'positive' : 'draft') as 'positive' | 'draft',
    },
    { label: 'Session 4', time: '5 Apr', sub: 'Sleep hygiene focus; PHQ-9 11.', status: 'Signed · you', active: false, tone: 'positive' as const },
    { label: 'Session 3', time: '8 Mar', sub: 'First-gen pressure; values action.', status: 'Signed · you', active: false, tone: 'positive' as const },
    { label: 'Session 2', time: '9 Feb', sub: 'Passive ideation screened — no plan.', status: 'Signed · you', active: false, tone: 'positive' as const },
    { label: 'Intake', time: '12 Jan', sub: 'PHQ-9 18 · GAD-7 14.', status: 'Signed · you', active: false, tone: 'positive' as const },
  ];
  return (
    <View>
      <Eyebrow>Sessions · Amara K.</Eyebrow>
      <View style={{ height: 12 }} />
      {rows.map((r) => (
        <View
          key={r.label}
          style={{
            backgroundColor: r.active ? c.brandBg : 'transparent',
            borderRadius: theme.radii.sm,
            padding: 12,
            marginBottom: 6,
            borderLeftWidth: r.active ? 3 : 0,
            borderLeftColor: c.brand,
          }}
        >
          <Row style={{ justifyContent: 'space-between' }}>
            <AppText variant="bodyStrong" style={{ fontSize: 14 }}>
              {r.label}
            </AppText>
            <AppText variant="small" color="ink3" style={{ fontSize: 11 }}>
              {r.time}
            </AppText>
          </Row>
          <AppText variant="small" color="ink3" numberOfLines={1} style={{ marginTop: 4 }}>
            {r.sub}
          </AppText>
          <View style={{ marginTop: 8 }}>
            <Badge label={r.status} tone={r.tone} />
          </View>
        </View>
      ))}
    </View>
  );
}

function SignedChip() {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.positiveBg, borderRadius: theme.radii.pill, paddingVertical: 4, paddingHorizontal: 10 }}>
      <CheckIcon size={13} color={c.positive} />
      <AppText variant="bodyStrong" tint={c.positive} style={{ fontSize: 12 }}>
        Signed · Dr. Okafor · 12 Aug 11:18
      </AppText>
    </View>
  );
}
