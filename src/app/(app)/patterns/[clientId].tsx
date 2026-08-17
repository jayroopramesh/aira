import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { BackLink, Screen } from '../../../components/Screen';
import { ClientLink } from '../../../components/ClientLink';
import { ClientNotFound } from '../../../components/ClientNotFound';
import { useEscalate } from '../../../components/Escalate';
import { BandedChart, DotStrip, ScaleChart } from '../../../components/charts';
import { ArrowRight, PhoneIcon, ShieldIcon } from '../../../components/icons';
import { AppText, Button, Card, Chip, Eyebrow, Row, RiskDot, TrustPill } from '../../../components/ui';
import { AMARA_SCALES } from '../../../data/scales';
import { useClient, useClientNotes } from '../../../data/DataProvider';
import { Client } from '../../../data/types';
import { deriveTrajectory, MIN_SESSIONS_FOR_TRAJECTORY } from '../../../data/trajectory';
import { filterReadingsByRange, MeasureRange } from '../../../data/measureRange';
import { useTheme } from '../../../theme/ThemeProvider';

export default function ClientPatterns() {
  const { clientId, risk } = useLocalSearchParams<{ clientId: string; risk?: string }>();
  const client = useClient(clientId);
  // The client route can outlive its client (e.g. caseload cleared while mounted) — show an honest
  // not-found with a way back, never a blank page (N2).
  if (!client) return <ClientNotFound />;
  const showRisk = risk === '1' || client.risk === 'acute';
  // The acute-risk review must be reachable for an app-flagged acute client even when no structured
  // `safety` object exists (captured sessions never mint one) — otherwise the caseload's `?risk=1`
  // deep-link lands on the sparse patterns page with no acute affordance and no route to the safety
  // plan. RiskReview degrades honestly when `safety` is absent; a stray `?risk=1` on a non-acute,
  // no-safety client still falls through to the patterns view rather than fabricating an acute banner.
  return showRisk && (client.safety || client.risk === 'acute') ? (
    <RiskReview clientId={client.id} />
  ) : (
    <PatternsView clientId={client.id} />
  );
}

/**
 * The doors out of a client's file: their session history, and — when notes are actually retained —
 * the note itself. Without the note door, a captured note and its sign-off are only reachable in the
 * moments right after a capture (F5 / C4), so the client file must offer a way back in.
 */
function ClientFileDoors({ clientId }: { clientId: string }) {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const notes = useClientNotes(clientId);

  const door = (label: string, onPress: () => void) => (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      <Card elevation="sm" padded={false} radius="sm" style={{ paddingVertical: 10, paddingHorizontal: 16 }}>
        <Row gap={8}>
          <AppText variant="bodyStrong">{label}</AppText>
          <ArrowRight size={16} color={c.ink} />
        </Row>
      </Card>
    </Pressable>
  );

  return (
    <Row gap={theme.spacing.sm} style={{ flexWrap: 'wrap' }}>
      {notes.length
        ? door('Open session note', () => router.push(`/(app)/session/review?clientId=${encodeURIComponent(clientId)}`))
        : null}
      {door('Session history', () => router.push(`/(app)/patterns/history?clientId=${encodeURIComponent(clientId)}`))}
    </Row>
  );
}

/**
 * Sparse patterns state for a freshly-captured client with no assessment series yet. Honours the
 * sparse-series rule (no trend line before there are readings) and points at what does exist.
 */
function NoReadingsYet({ client }: { client: Client }) {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  return (
    <Screen>
      <BackLink label="Back to caseload" onPress={() => router.replace('/(app)/patterns')} />
      <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: theme.spacing.sm }}>
        <ClientLink client={client} avatarSize={52} gap={14} style={{ flex: 1, minWidth: 220 }}>
          <View style={{ flex: 1 }}>
            <AppText variant="h1">{client.name}</AppText>
            <AppText variant="small" color="ink3" style={{ marginTop: 4 }}>
              ID {client.tokenId} · client since {client.clientSince}
            </AppText>
          </View>
        </ClientLink>
        {/* A freshly-captured client's signed note is only reachable through here (F5) — the sparse
            state must still surface the note and history doors, not just the full patterns view. */}
        <ClientFileDoors clientId={client.id} />
      </Row>
      <View style={{ height: theme.spacing.lg }} />
      <Card tone="sunken" elevation="none" radius="lg" style={{ backgroundColor: c.brandBg, borderColor: c.brandBd }}>
        <Eyebrow color="brand">Patterns</Eyebrow>
        <AppText variant="h2" style={{ marginTop: 8 }}>
          Not enough readings yet
        </AppText>
        <AppText variant="body" color="ink2" style={{ marginTop: 8, lineHeight: 22 }}>
          Trends appear once this client has a few scored sessions. A single visit is shown as a point, never a
          trend line. The shape only means something with readings behind it.
        </AppText>
        {client.lastPlan.length ? (
          <>
            <View style={{ height: theme.spacing.md }} />
            <Eyebrow>From the last session</Eyebrow>
            <View style={{ height: 8 }} />
            {client.lastPlan.map((p) => (
              <Row key={p.id} gap={8} style={{ alignItems: 'flex-start', marginBottom: 6 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.brand, marginTop: 7 }} />
                <AppText variant="body" color="ink" style={{ flex: 1 }}>
                  {p.text}
                </AppText>
              </Row>
            ))}
          </>
        ) : null}
      </Card>
    </Screen>
  );
}

/* --------------------------------------------------------- patterns view --- */

function PatternsView({ clientId }: { clientId: string }) {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const client = useClient(clientId);
  const [range, setRange] = useState<MeasureRange>('6m');
  const phq = client?.measures.find((m) => m.key === 'phq9');
  const sleep = client?.measures.find((m) => m.key === 'sleep');
  const phqReadingsInRange = phq ? filterReadingsByRange(phq.readings, range, new Date()) : [];

  if (!client) return null;
  // A freshly-captured client has no assessment series yet — respect the sparse-series rule.
  if (!phq) return <NoReadingsYet client={client} />;

  const headline =
    clientId === 'amara'
      ? 'Amara’s depression has halved since January. PHQ-9 fell from 18 to 9 across nine readings, with the steepest drop after sleep became the focus. Anxiety is following the same path.'
      : `${client.name.split(' ')[0]}’s PHQ-9 latest reading is ${phq.latest}${phq.deltaSinceStart ? `, ${phq.deltaSinceStart < 0 ? 'down' : 'up'} ${Math.abs(phq.deltaSinceStart)} since intake` : ''}.`;

  return (
    <Screen>
      <BackLink label="Back to caseload" onPress={() => router.replace('/(app)/patterns')} />

      <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <ClientLink client={client} avatarSize={52} gap={14} style={{ flex: 1, minWidth: 260 }}>
          <View>
            <AppText variant="h1">{client.name}</AppText>
            <Row gap={8} style={{ marginTop: 4, flexWrap: 'wrap' }}>
              <AppText variant="small" color="ink3">
                ID {client.tokenId} · {client.age ?? '—'} · client since {client.clientSince}
              </AppText>
              <RiskDot level={client.risk} />
            </Row>
          </View>
        </ClientLink>
        <ClientFileDoors clientId={client.id} />
      </Row>

      {/* Plain-language headline FIRST — before any chart (stoic. pattern). */}
      <Card tone="sunken" elevation="none" radius="lg" style={{ marginTop: theme.spacing.lg, backgroundColor: c.brandBg, borderColor: c.brandBd }}>
        <Eyebrow color="brand">Read this first</Eyebrow>
        <AppText variant="h2" style={{ marginTop: 10, lineHeight: 27 }}>
          {headline}
        </AppText>
      </Card>

      <View style={{ height: theme.spacing.lg }} />
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: theme.spacing.lg, alignItems: 'flex-start' }}>
        {/* Assessment-scale chart. Amara carries the full multi-scale set (PHQ-9 · GAD-7 · MHI-5 ·
            DASS-21) as tabs; each scale keeps the sparse ≤2-reading rule (MHI-5 → dot-strip). */}
        {clientId === 'amara' ? (
          <View style={{ flex: wide ? 1.3 : undefined, width: '100%' }}>
            <ScaleCard clientLabel={client.name.split(' ')[0]} />
          </View>
        ) : (
          <Card style={{ flex: wide ? 1.3 : undefined, width: '100%' }}>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <AppText variant="h2">PHQ-9 over time</AppText>
              <Row gap={8}>
                {(['3m', '6m', '1y'] as MeasureRange[]).map((r) => (
                  <Chip key={r} label={r} active={range === r} onPress={() => setRange(r)} />
                ))}
              </Row>
            </Row>
            {phqReadingsInRange.length > 0 ? (
              <>
                <AppText variant="body" color="ink2" style={{ marginTop: 8 }}>
                  {phqReadingsInRange[0].value} → {phq.latest} across {phqReadingsInRange.length} visits · now in
                  the <AppText variant="bodyStrong">{phq.band}</AppText> band, down from moderate-severe at intake.
                </AppText>
                <View style={{ height: 14 }} />
                <BandedChart readings={phqReadingsInRange} />
              </>
            ) : (
              <AppText variant="body" color="ink2" style={{ marginTop: 8 }}>
                No readings in the last {range}.
              </AppText>
            )}
          </Card>
        )}

        {/* Sleep sparse dot-strip + naturalistic block */}
        <View style={{ flex: wide ? 1 : undefined, width: '100%', gap: theme.spacing.lg }}>
          {sleep ? (
            <Card>
              <AppText variant="h2">Sleep (self-report)</AppText>
              <AppText variant="body" color="ink2" style={{ marginTop: 8 }}>
                Only <AppText variant="bodyStrong">{sleep.readings.length} readings</AppText> logged so far. Shown as points, not a trend.
              </AppText>
              <View style={{ height: 14 }} />
              <DotStrip readings={sleep.readings} unit="h" />
              <AppText variant="small" color="ink3" style={{ marginTop: 12 }}>
                {sleep.readings.length} readings. Not enough for a trend yet.
              </AppText>
            </Card>
          ) : null}

          {client.naturalistic ? (
            <Card tone="sunken" elevation="none" style={{ backgroundColor: c.sand, borderColor: c.sandBd }}>
              <AppText variant="bodyStrong" tint={c.accent}>
                On her mind, not on your report
              </AppText>
              <AppText variant="body" color="ink2" style={{ marginTop: 8 }}>
                From {client.name.split(' ')[0]}’s <AppText variant="bodyStrong" color="ink2">companion app</AppText>: journal entries she chooses to share. Unsigned · self-reported · never blended with clinical scores.
              </AppText>
              {client.naturalistic.map((n, i) => (
                <View key={i} style={{ marginTop: 14 }}>
                  <AppText variant="small" color="ink3">
                    {n.date}
                  </AppText>
                  <AppText variant="body" color="ink" style={{ marginTop: 4 }}>
                    {n.body}
                  </AppText>
                </View>
              ))}
            </Card>
          ) : null}
        </View>
      </View>

      <View style={{ height: theme.spacing.lg }} />
      <TrajectoryCard clientId={clientId} />
    </Screen>
  );
}

/**
 * Longitudinal trajectory (captain round-2 item 2): across this client's retained session notes,
 * recurring review codes, repeated plan/prescription items, and the risk-tier trend. Purely derived
 * from `deriveTrajectory` (on-device, no cloud call) — every row here is traceable to a real note.
 */
function TrajectoryCard({ clientId }: { clientId: string }) {
  const theme = useTheme();
  const notes = useClientNotes(clientId);
  const trajectory = deriveTrajectory(notes);

  return (
    <Card>
      <Eyebrow>Trajectory</Eyebrow>
      <AppText variant="h2" style={{ marginTop: 8 }}>
        Across {notes.length} retained session{notes.length === 1 ? '' : 's'}
      </AppText>
      {!trajectory ? (
        <AppText variant="body" color="ink2" style={{ marginTop: 8, lineHeight: 22 }}>
          At least {MIN_SESSIONS_FOR_TRAJECTORY} sessions needed to show a trajectory. Recurring review codes,
          repeated plan items, and the risk trend appear once there’s enough history.
        </AppText>
      ) : (
        <View style={{ marginTop: 12, gap: theme.spacing.lg }}>
          <View>
            <AppText variant="bodyStrong" style={{ fontSize: 13.5 }}>
              Risk tier over time
            </AppText>
            <Row gap={16} wrap style={{ marginTop: 8, alignItems: 'center' }}>
              {trajectory.riskTrend.map((p, i) => (
                <Row key={`${p.sessionLabel}-${i}`} gap={6} style={{ alignItems: 'center' }}>
                  <RiskDot level={p.riskLevel} />
                  <AppText variant="small" color="ink3">
                    {p.sessionLabel.replace(/^Session \d+ — /, '')}
                  </AppText>
                  {i < trajectory.riskTrend.length - 1 ? (
                    <AppText variant="small" color="ink3">
                      →
                    </AppText>
                  ) : null}
                </Row>
              ))}
            </Row>
          </View>

          <View>
            <AppText variant="bodyStrong" style={{ fontSize: 13.5 }}>
              Recurring review codes
            </AppText>
            {trajectory.recurringCodes.length ? (
              trajectory.recurringCodes.map((rc) => (
                <Row key={rc.code} style={{ justifyContent: 'space-between', marginTop: 8, gap: 8 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText variant="body" color="ink" style={{ fontFamily: theme.type.numeric.fontFamily }}>
                      {rc.code}
                    </AppText>
                    <AppText variant="small" color="ink3">
                      {rc.label}
                    </AppText>
                  </View>
                  <AppText variant="small" color="ink3">
                    {rc.count}× · {rc.sessions[0].replace(/^Session \d+ — /, '')} → {rc.sessions[rc.sessions.length - 1].replace(/^Session \d+ — /, '')}
                  </AppText>
                </Row>
              ))
            ) : (
              <AppText variant="small" color="ink3" style={{ marginTop: 6 }}>
                No review code repeats across these sessions yet.
              </AppText>
            )}
          </View>

          <View>
            <AppText variant="bodyStrong" style={{ fontSize: 13.5 }}>
              Repeated plan &amp; prescription items
            </AppText>
            {trajectory.repeatedPrescriptions.length ? (
              trajectory.repeatedPrescriptions.map((item) => (
                <Row key={item.text} style={{ justifyContent: 'space-between', marginTop: 8, gap: 8 }}>
                  <AppText variant="body" color="ink" style={{ flex: 1, minWidth: 0 }}>
                    {item.text}
                  </AppText>
                  <AppText variant="small" color="ink3">
                    {item.count}×
                  </AppText>
                </Row>
              ))
            ) : (
              <AppText variant="small" color="ink3" style={{ marginTop: 6 }}>
                No plan or prescription item repeats across these sessions yet.
              </AppText>
            )}
          </View>
        </View>
      )}
      <AppText variant="small" color="ink3" style={{ marginTop: 14, fontSize: 11 }}>
        Derived on this device from {notes.length} retained note{notes.length === 1 ? '' : 's'}. Nothing here is inferred beyond what’s already in a signed note.
      </AppText>
    </Card>
  );
}

/**
 * The multi-scale chart card. Scale tabs above the plot swap the data, severity bands, and the
 * plain-language headline in place; the sparse ≤2-reading rule is kept per scale.
 */
function ScaleCard({ clientLabel }: { clientLabel: string }) {
  const theme = useTheme();
  const c = theme.colors;
  const [key, setKey] = useState('PHQ-9');
  const scale = AMARA_SCALES.find((s) => s.key === key) ?? AMARA_SCALES[0];

  return (
    <Card style={{ width: '100%' }}>
      {/* Scale tabs */}
      <Row gap={6} style={{ flexWrap: 'wrap' }}>
        {AMARA_SCALES.map((s) => (
          <Chip key={s.key} label={s.key} active={s.key === key} onPress={() => setKey(s.key)} />
        ))}
      </Row>
      <View style={{ height: 12 }} />
      <Row gap={8} style={{ alignItems: 'baseline', flexWrap: 'wrap' }}>
        <AppText variant="h2">{scale.key} over time</AppText>
        {scale.sub ? (
          <AppText variant="small" color="ink3">
            {scale.sub}
          </AppText>
        ) : null}
      </Row>
      {/* Plain-language, headline-first reading for this scale. */}
      <AppText variant="body" color="ink2" style={{ marginTop: 8, lineHeight: 22 }}>
        {scale.read}
      </AppText>
      <View style={{ height: 14 }} />
      <ScaleChart scale={scale} clientLabel={clientLabel} />
    </Card>
  );
}

/* ------------------------------------------------------------ risk review --- */

function RiskReview({ clientId }: { clientId: string }) {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const escalate = useEscalate();
  const client = useClient(clientId);
  const notes = useClientNotes(clientId);
  if (!client) return null;
  // `safety` is the structured risk snapshot only sample/fixture clients carry. A captured client the
  // app rated acute has none — we still render the acute review (banner + escalation + safety-plan
  // route), degrading honestly to a pointer at the session note rather than fabricating a snapshot.
  const safety = client.safety;

  return (
    <Screen maxWidth={860}>
      <BackLink label="Back to caseload" onPress={() => router.replace('/(app)/patterns')} />

      <ClientLink client={client} avatarSize={52} avatarTone="risk" gap={14} style={{ flexWrap: 'wrap' }}>
        <View style={{ flex: 1 }}>
          <AppText variant="h1">{client.name}</AppText>
          <Row gap={8} style={{ marginTop: 4, flexWrap: 'wrap' }}>
            <AppText variant="small" color="ink3">
              {/* Only the fixture snapshot carries a scheduled session time; a captured client's meta
                  line stays to what's actually known, never a fabricated "today 1:00". */}
              ID {client.tokenId} · {client.age ?? '—'} · Session {client.sessionNumber}
              {safety ? ' · today 1:00' : ''}
            </AppText>
            <TrustPill label="Re-identified locally" icon={<ShieldIcon size={12} color={c.brand} />} />
          </Row>
        </View>
      </ClientLink>

      {/* Acute banner — clay, calm, the literal word "review". Never alarm-red, never modal. */}
      <Card tone="elevated" elevation="none" radius="lg" style={{ marginTop: theme.spacing.lg, backgroundColor: c.riskBg, borderColor: c.riskBg }}>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          {/* flex + minWidth:0 lets the most safety-critical heading WRAP at phone width instead of
              being clipped mid-word (N5). The dot stays fixed and aligns to the first line. */}
          <Row gap={10} style={{ flex: 1, minWidth: 220, alignItems: 'flex-start' }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.riskFill, marginTop: 7 }} />
            <AppText variant="h2" tint={c.risk} style={{ flex: 1 }}>
              {safety ? safety.headline : 'Flagged acute. Review this client’s session and safety plan'}
            </AppText>
          </Row>
          {safety?.item9Positive ? (
            <AppText variant="small" tint={c.risk}>
              PHQ-9 item 9 positive
            </AppText>
          ) : null}
        </Row>
        <AppText variant="body" color="ink" style={{ marginTop: 12, lineHeight: 23 }}>
          {safety
            ? safety.detail
            : 'Airava rated this client acute from a documented session. Open the session note below to see exactly what was disclosed, review or start a safety plan, and use the escalation options as needed. This tier is never lowered automatically.'}
        </AppText>
      </Card>

      {safety ? (
        <>
          {/* Safety snapshot */}
          <Card style={{ marginTop: theme.spacing.lg }}>
            <Eyebrow>Safety snapshot</Eyebrow>
            <Row gap={12} wrap style={{ marginTop: 12 }}>
              {safety.snapshot.map((s) => (
                <Card key={s.label} tone="elevated" elevation="none" radius="md" style={{ flex: 1, minWidth: 150, borderColor: c.line }}>
                  <AppText variant="small" color="ink3">
                    {s.label}
                  </AppText>
                  <AppText variant="display" tint={s.tone === 'risk' ? c.risk : c.ink} style={{ fontSize: 26, lineHeight: 28, marginTop: 6 }}>
                    {s.value}
                  </AppText>
                  <AppText variant="small" tint={s.tone === 'positive' ? c.positive : s.tone === 'risk' ? c.risk : c.ink3} style={{ marginTop: 4 }}>
                    {s.sub}
                  </AppText>
                </Card>
              ))}
            </Row>
          </Card>

          {/* Last risk note */}
          <Card style={{ marginTop: theme.spacing.lg }}>
            <Eyebrow>Last risk note · {safety.lastRiskNoteDate}, signed</Eyebrow>
            <AppText variant="body" color="ink" style={{ marginTop: 10, lineHeight: 23 }}>
              {safety.lastRiskNote}
            </AppText>
          </Card>
        </>
      ) : (
        // No structured snapshot on file for a captured acute client — say so plainly and point at the
        // real evidence (the session note) rather than inventing a snapshot or last-risk-note.
        <Card style={{ marginTop: theme.spacing.lg }}>
          <Eyebrow>Safety snapshot</Eyebrow>
          <AppText variant="body" color="ink2" style={{ marginTop: 10, lineHeight: 23 }}>
            No structured risk snapshot is on file for this client yet. The risk lives in the session note
            Airava drafted. Open the note to review what was documented, then complete a safety plan to record
            coping steps and a trusted contact.
          </AppText>
        </Card>
      )}

      <View style={{ height: theme.spacing.lg }} />
      <Row gap={12} wrap>
        <Button title="Open escalation options" variant="danger" leftIcon={<PhoneIcon size={18} color={c.risk} />} onPress={() => escalate.open({ clientId: client.id, clientToken: client.tokenId })} />
        <Button title="Review safety plan" variant="secondary" onPress={() => router.push(`/(app)/patterns/safety-plan?clientId=${client.id}`)} />
        {notes.length ? (
          <Button title="Open session note" variant="secondary" onPress={() => router.push(`/(app)/session/review?clientId=${encodeURIComponent(client.id)}`)} />
        ) : null}
        <Button title="See history" variant="secondary" onPress={() => router.push(`/(app)/patterns/history?clientId=${client.id}`)} />
      </Row>
      <AppText variant="small" color="ink3" style={{ marginTop: 14 }}>
        The same standing Escalate affordance sits top-right on every screen. This review state just brings the details forward.
      </AppText>
    </Screen>
  );
}
