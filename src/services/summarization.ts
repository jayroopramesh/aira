/**
 * SummarizationService — the clinical-drafting seam: a de-identified transcript in, a structured
 * SOAP DraftNote out. Nothing here is authoritative; the clinician reviews and signs every note.
 *
 * DEMO mode uses Groq chat completions (openai/gpt-oss-120b) with a clinical system prompt that
 * produces SOAP sections + a routine risk & safety check + plan items (which feed the Prescriptions
 * rail). This is a CLOUD hop over the transcript text — disclosed by the demo-mode banner. It reaches
 * Groq through the server-side groq-proxy Edge Function (the Groq key is a Supabase secret, not a
 * client var). With no proxy configured — or with one configured but nobody signed in — drafting
 * degrades to a deterministic on-device mock over the same text, and the note records that it was
 * drafted on this device. Drafting the clinician's own words on-device is honest degradation;
 * inventing a transcript is not, which is why transcription refuses where drafting falls back.
 *
 * The transcript (plus a bare session number) is the only thing sent — never the client's name,
 * never audio, never stored records. The prompt instructs
 * the model to avoid echoing raw identifiers, since demo transcription skips the on-device de-id hop.
 */

import { env, hasGroq } from '../config/env';
import { getAccessToken } from './supabase';
import { DraftNote, NoteSection, PrepItem, ReviewCode, RiskLevel } from '../data/types';

export type SummaryInput = {
  transcript: string;
  clientName?: string;
  sessionNumber?: number;
  durationMs?: number;
  /**
   * Did this capture's audio leave the device? True from the moment the upload is issued, so a cloud
   * call that fails afterwards is still disclosed. Absent → nothing was sent.
   */
  audioLeftDevice?: boolean;
  /**
   * Is the `transcript` above what the cloud transcriber returned? True only on a successful cloud
   * transcription; false for the on-device mock and for anything the clinician typed or pasted. These
   * are two different facts — an upload can succeed and the transcription still fail — and the note's
   * `sourceLine` reports each one from its own truth rather than collapsing them.
   */
  transcriptFromCloud?: boolean;
  /**
   * Is this the built-in `mock://` demo clip rather than a session with a real person in it? Only the
   * sample may receive the on-device stub's canned walkthrough content; see `MockSummarizationService`.
   * Absent → treated as a real session, so the safe mode is the default.
   */
  sampleCapture?: boolean;
};

export interface SummarizationService {
  /** Draft SOAP-structured clinical sections from a transcript. Resolves once. */
  summarize(input: SummaryInput, opts?: { signal?: AbortSignal }): Promise<DraftNote>;
}

/** The JSON shape we ask the model for, then map onto the app's DraftNote. */
type LlmDraft = {
  subjective?: { body?: string[]; quote?: string };
  objective?: { body?: string[] };
  riskSafety?: { summary?: string; rows?: { label: string; value: string }[]; level?: string };
  assessment?: { body?: string[] };
  plan?: { bullets?: string[] };
  reviewCodes?: { code: string; label: string; relevance?: 'high' | 'med' | 'low' }[];
};

/** Coerce the model's risk-tier string to a RiskLevel; unknown/absent → undefined (UI derives). */
function toRiskLevel(level?: string): RiskLevel | undefined {
  const v = level?.trim().toLowerCase();
  return v === 'clear' || v === 'watch' || v === 'elevated' || v === 'acute' ? v : undefined;
}

const SYSTEM_PROMPT = `You are a clinical documentation assistant for a licensed mental-health counselor.
You turn a single-session, English, single-speaker-assumed therapy transcript into a DRAFT progress note.
The note is NOT authoritative — the clinician reviews, edits, and signs it. Be faithful to the transcript;
never invent facts, diagnoses, scores, or safety findings that are not supported by it. Use plain, sober,
non-alarming clinical language. Do not echo raw personal identifiers (names, ID numbers, phone numbers,
addresses) in the body — refer to "the client". Always include a routine Risk & Safety check even when the
session is unremarkable (state plainly if nothing of concern was raised). The riskSafety.summary sentence
MUST be consistent with riskSafety.rows — never say "no concerns were raised" if a row records ideation,
self-harm, or that risk could not be assessed; if risk was not assessable, say so in the summary too.
riskSafety.level is the caseload risk TIER for this session and drives a risk queue, so rate it for
safety, not reassurance: "clear" only when suicidal ideation and self-harm were both screened and
denied; "acute" for ANY disclosed/endorsed current suicidal ideation — passive, transient, fleeting,
"better off not here", with or without a plan (a stated plan/means/intent is still acute); "elevated"
for endorsed self-harm without suicidal ideation; "watch" when risk could not be assessed this session.

Return ONLY a JSON object (no prose, no markdown fences) with EXACTLY this shape:
{
  "subjective": { "body": ["1-3 short paragraphs, the client's reported experience"], "quote": "one short verbatim-style client quote or empty string" },
  "objective": { "body": ["1-2 short paragraphs: observed presentation, engagement, mental status observations"] },
  "riskSafety": { "summary": "one plain sentence on risk screened this session", "rows": [ { "label": "Suicidal ideation", "value": "Denied / Passive / ..." }, { "label": "Self-harm", "value": "..." }, { "label": "Safety plan", "value": "..." } ], "level": "clear | watch | elevated | acute" },
  "assessment": { "body": ["1-2 short paragraphs: clinical impression and progress toward goals"] },
  "plan": { "bullets": ["3-6 concrete, actionable next-step items — these become prescriptions"] },
  "reviewCodes": [ { "code": "e.g. F41.1", "label": "human-readable label", "relevance": "high|med|low" } ]
}`;

/**
 * GroqSummarizationService — DEMO-mode drafting (gpt-oss-120b) via the server-side groq-proxy Edge
 * Function, NOT Groq directly: the Groq key is a Supabase secret and never ships in the bundle. The
 * transcript text is POSTed to the proxy with the counselor's Supabase session token; only the
 * transcript + a bare session number are sent — never the client's name (the proxy also rejects any
 * payload that carries a client identifier). Not signed in (no token) DELEGATES to the on-device
 * MockSummarizationService over the same text, which for a real session means its derive-only mode.
 * That is not fabrication: it restates the clinician's own typed/pasted words and leaves every
 * section it cannot derive — the assessment, the plan, the prescriptions, the diagnosis chips — as
 * "review required" rather than inventing them. Inventing a transcript is transcription's job to
 * refuse (see
 * `GroqTranscriptionService`, which still rejects). Because the fallback runs `buildDraft` with
 * `draftedInCloud: false`, a note drafted this way says so, and says a keyword stub wrote it.
 */
export class GroqSummarizationService implements SummarizationService {
  private readonly mock = new MockSummarizationService();

  constructor(
    private readonly proxyUrl: string,
    private readonly getToken: () => Promise<string | null>,
    private readonly model: string,
  ) {}

  async summarize(input: SummaryInput, opts?: { signal?: AbortSignal }): Promise<DraftNote> {
    const token = await this.getToken();
    // No signed-in session → no server-side cloud path. Draft the text we were given on-device
    // instead: it is the clinician's own transcript, so nothing is invented, and the fallback stamps
    // the note drafted-on-device. Refusing here would leave the paste-the-transcript recovery with
    // nowhere to go.
    if (!token) return this.mock.summarize(input);

    const userPrompt = [
      input.sessionNumber ? `Session number: ${input.sessionNumber}.` : '',
      'Transcript:',
      '"""',
      input.transcript.slice(0, 24000),
      '"""',
    ]
      .filter(Boolean)
      .join('\n');

    const res = await fetch(`${this.proxyUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: opts?.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Groq summarization failed (${res.status}). ${detail.slice(0, 300)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? '{}';
    let parsed: LlmDraft;
    try {
      parsed = JSON.parse(content) as LlmDraft;
    } catch {
      parsed = JSON.parse(stripFences(content)) as LlmDraft;
    }
    // Reaching here means the proxy call succeeded with a real session token, so the cloud drafting
    // hop demonstrably happened — that, not the build-time config, is what the note records.
    return buildDraft(parsed, input, { draftedInCloud: true });
  }
}

/**
 * Deterministic on-device drafting. It is a STUB — no clinical model runs — so it must never fabricate
 * a "Denied / clear" risk finding it did not assess (F4-mock-clear); it derives the risk row + tier
 * from a lightweight scan of the transcript (disclosed ideation → acute, self-harm → elevated, clear
 * only when nothing was raised), so a real dictated transcript that discloses ideation is never rated
 * "clear" here.
 *
 * WHAT IT MAY WRITE depends on WHOSE session it is — decided per call from `input.sampleCapture`, not
 * from how the build is configured, because both configurations can hand it either kind of session:
 *  • The built-in `mock://` SAMPLE (`sampleCapture: true`) is a demo clip with no real person in it,
 *    so the stub fills a complete walkthrough note — a placeholder assessment, plan bullets and a
 *    working code chip. That content is scaffolding for a demo, not a finding about anyone.
 *  • ANY OTHER session is real, whatever the build. The same scaffolding there would be invented
 *    clinical content attached to a real client — an anxiety code and prescriptions nobody derived
 *    from the session — so the stub emits ONLY what the transcript supports (subjective, objective,
 *    the risk scan) and leaves assessment, plan, prescriptions and codes at `NOT_CAPTURED` for the
 *    clinician to complete. The note's source line says a keyword stub wrote it, so "drafted on this
 *    device" is never mistaken for an on-device model.
 * Defaulting the flag to absent means a caller that forgets it gets the safe mode.
 */
export class MockSummarizationService implements SummarizationService {
  async summarize(input: SummaryInput): Promise<DraftNote> {
    const t = input.transcript.replace(/\s+/g, ' ').trim();
    const sentences = t ? t.split(/(?<=[.!?])\s+/).slice(0, 8) : [];
    const first = sentences.slice(0, 3).join(' ');
    const rest = sentences.slice(3, 6).join(' ');
    const riskSafety = scanTranscriptRisk(t);

    if (input.sampleCapture !== true) {
      const draft: LlmDraft = {
        subjective: { body: first ? [first] : [], quote: '' },
        objective: { body: rest ? [rest] : [] },
        riskSafety,
      };
      return buildDraft(draft, input, { draftedInCloud: false, keywordStub: true });
    }

    const draft: LlmDraft = {
      subjective: { body: [first || 'The client reported on the week since the last session.'], quote: '' },
      objective: { body: [rest || 'Engaged and reflective throughout; no acute distress observed.'] },
      riskSafety,
      assessment: { body: ['Draft impression pending clinician review. Progress consistent with the working plan.'] },
      plan: {
        bullets: ['Continue the agreed between-session practice', 'Review progress at the next session', 'Revisit any items the client raised today'],
      },
      reviewCodes: [{ code: 'F41.1', label: 'Generalized anxiety (working)', relevance: 'med' }],
    };
    return buildDraft(draft, input, { draftedInCloud: false });
  }
}

/**
 * A conservative keyword scan the no-keys mock uses so it never asserts a safety finding the
 * transcript did not contain. Errs toward flagging: any ideation cue → acute; else self-harm → elevated;
 * else it says plainly that safety was not explicitly addressed (never a fabricated "Denied").
 *
 * Two honesty rules the stub must respect, since a keyword hit is not a clinical finding:
 *  • A cue that is PURELY denied ("denied suicidal ideation", "no self-harm", with nothing marking
 *    the client as experiencing it) is not a disclosure — flagging it would fabricate a finding the
 *    transcript explicitly contradicts. A denial alongside a disclosure still flags: see `disclosed`.
 *  • Even when it does flag, the row says a possible REFERENCE was seen and asks the clinician to
 *    confirm — it never asserts "Disclosed in session", which the stub cannot establish.
 */
function scanTranscriptRisk(transcript: string): NonNullable<LlmDraft['riskSafety']> {
  const s = transcript.toLowerCase();
  const has = (...kws: string[]) => kws.some((k) => s.includes(k));
  const ideation = has(
    'suicid',
    'kill myself',
    'end my life',
    'end it all',
    'better off dead',
    'better off not here',
    'better off gone',
    "don't want to be here",
    'do not want to be here',
    "don't want to be alive",
    'not want to be alive',
    'not worth living',
    "wasn't here anymore",
    'wasnt here anymore',
  );
  const selfHarm = has('self-harm', 'self harm', 'cut myself', 'cutting myself', 'hurt myself', 'harm myself');

  // Whether the transcript NEGATES a cue ("denied suicidal ideation", "no self-harm").
  const deniedNear = (cues: string) =>
    new RegExp(`\\b(?:denied|denies)\\b[^.?!]{0,40}?(?:${cues})|\\b(?:no|not|without(?: any)?)\\s+(?:[\\w'-]+\\s+){0,2}(?:${cues})`).test(s);
  // A denial phrase is not enough to clear a cue: clinicians routinely deny the PLAN while recording
  // the ideation ("denies plan or intent; reports fleeting suicidal thoughts"), and a denial of
  // plan/intent/means must NEVER downgrade disclosed ideation. So a denial only clears a cue when
  // nothing in the transcript marks the client as actually experiencing it — otherwise it stays
  // flagged. Ambiguity is resolved toward over-rating, which is the safe direction here.
  const disclosed = has(
    'described',
    'describes',
    'reports',
    'reported',
    'experiencing',
    'experienced',
    'endorsed',
    'admitted',
    'expressed',
    'disclosed',
    'voiced',
    'passive',
    'fleeting',
    'recurrent',
    'intermittent',
    'most evenings',
    'most nights',
    'this week',
    'ongoing',
  );
  const ideationDenied =
    !disclosed && deniedNear('suicid|ideation|thoughts of|wanting to die|kill (?:her|him|my|them)sel(?:f|ves)');
  const selfHarmDenied =
    !disclosed && deniedNear('self[- ]?harm|(?:cut|harm|hurt)(?:ting|ming|ing)? (?:her|him|my|them)sel(?:f|ves)');
  const REVIEW = 'Possible reference in transcript — clinician to review and confirm';
  const DENIED = 'Denied on an automated read of the transcript — clinician to confirm';

  if (ideation && !ideationDenied) {
    return {
      summary: 'A possible reference to suicidal ideation was picked up in the transcript — review and confirm with the client.',
      rows: [
        { label: 'Suicidal ideation', value: REVIEW },
        { label: 'Self-harm', value: selfHarm && !selfHarmDenied ? REVIEW : 'Not explicitly addressed' },
        { label: 'Safety plan', value: 'Review or establish a safety plan this session' },
      ],
      level: 'acute',
    };
  }
  if (selfHarm && !selfHarmDenied) {
    return {
      summary: 'A possible reference to self-harm was picked up in the transcript — review and confirm with the client.',
      rows: [
        { label: 'Suicidal ideation', value: 'Not explicitly addressed' },
        { label: 'Self-harm', value: REVIEW },
        { label: 'Safety plan', value: 'Review coping steps this session' },
      ],
      level: 'elevated',
    };
  }
  if (ideation || selfHarm) {
    return {
      summary: 'Ideation / self-harm appear to have been raised and denied in this session — confirm with the client.',
      rows: [
        { label: 'Suicidal ideation', value: ideationDenied ? DENIED : 'Not raised this session' },
        { label: 'Self-harm', value: selfHarmDenied ? DENIED : 'Not raised this session' },
        { label: 'Safety plan', value: 'Not discussed this session' },
      ],
      level: 'clear',
    };
  }
  return {
    summary: 'No suicidal ideation or self-harm was raised in this session on an automated review.',
    rows: [
      { label: 'Suicidal ideation', value: 'Not raised this session' },
      { label: 'Self-harm', value: 'Not raised this session' },
      { label: 'Safety plan', value: 'Not discussed this session' },
    ],
    level: 'watch',
  };
}

/* ------------------------------------------------------------------ mapping --- */

function stripFences(s: string): string {
  return s.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
}

function toPrep(bullets: string[]): PrepItem[] {
  return bullets.filter(Boolean).map((text, i) => ({ id: `rx-${i}`, text, source: 'from Plan', done: false }));
}

/**
 * Shown when a section has no content the draft can honestly stand behind. Never backfill it with
 * plausible clinical content — a synthesized "Denied" or invented prose would attach fabricated
 * findings to a real transcript. Two things surface it: a gap in the live model's reply, and every
 * section the `deriveOnly` stub cannot read out of the clinician's own words.
 */
const NOT_CAPTURED = 'Not captured in this draft — review required';

function nonEmpty(items?: string[]): string[] | null {
  const filtered = items?.filter(Boolean) ?? [];
  return filtered.length ? filtered : null;
}

function buildDraft(
  d: LlmDraft,
  input: SummaryInput,
  origin: { draftedInCloud: boolean; keywordStub?: boolean },
): DraftNote {
  const { draftedInCloud, keywordStub = false } = origin;
  const sections: NoteSection[] = [];

  sections.push({
    id: 'subjective',
    marker: 'S',
    title: 'Subjective',
    body: nonEmpty(d.subjective?.body) ?? [NOT_CAPTURED],
    quote: d.subjective?.quote || undefined,
  });

  sections.push({
    id: 'objective',
    marker: 'O',
    title: 'Objective',
    body: nonEmpty(d.objective?.body) ?? [NOT_CAPTURED],
    hasMeasures: false,
  });

  sections.push({
    id: 'risk',
    marker: 'R',
    title: 'Risk & Safety Check',
    body: d.riskSafety?.summary ? [d.riskSafety.summary] : [NOT_CAPTURED],
    rows: d.riskSafety?.rows?.length ? d.riskSafety.rows : [{ label: 'Risk screening', value: NOT_CAPTURED }],
    isRisk: true,
  });

  sections.push({
    id: 'assessment',
    marker: 'A',
    title: 'Assessment',
    body: nonEmpty(d.assessment?.body) ?? [NOT_CAPTURED],
  });

  const planBullets = d.plan?.bullets?.filter(Boolean) ?? [];
  sections.push({
    id: 'plan',
    marker: 'P',
    title: 'Plan & Next Steps',
    body: [],
    bullets: planBullets.length ? planBullets : [NOT_CAPTURED],
  });

  const reviewCodes: ReviewCode[] = (d.reviewCodes ?? [])
    // Drop codes the model returned without a code OR a label — a blank chip with a bare "low"
    // confidence is not a real suggestion (F16).
    .filter((rc) => rc.code?.trim() && rc.label?.trim())
    .map((rc) => ({
      code: rc.code.trim(),
      label: rc.label.trim(),
      relevance: rc.relevance === 'high' || rc.relevance === 'low' ? rc.relevance : 'med',
    }));

  const durMin = input.durationMs ? Math.max(1, Math.round(input.durationMs / 60000)) : null;
  const sessionLabel = input.sessionNumber ? `Session ${input.sessionNumber}` : 'New session';

  // THREE independent facts, never collapsed into one: whether the audio left the device, whether the
  // text below is machine-transcribed, and where this draft was written. They come apart in practice —
  // a `mock://` capture is transcribed here yet drafted in the cloud, and an upload that 429s means the
  // audio left the device while the transcript is the clinician's own typing. Each is reported from
  // what ACTUALLY ran for this note, never from the build-time config.
  const cloudTranscript = input.transcriptFromCloud === true;
  const audioLeft = input.audioLeftDevice === true || cloudTranscript;
  const where = (cloud: boolean) => (cloud ? 'in demo mode (cloud)' : 'on this device');

  const transcriptHop = cloudTranscript
    ? 'transcribed in demo mode (cloud)'
    : audioLeft
      ? 'audio sent to the cloud to transcribe but no transcript came back, so the text was entered by hand'
      : 'transcribed on this device';
  const draftHop = keywordStub
    ? 'drafted on this device by a keyword stub, not a clinical model — assessment, plan and codes are left for you'
    : `drafted ${where(draftedInCloud)}`;
  const hops =
    !keywordStub && audioLeft === cloudTranscript && cloudTranscript === draftedInCloud
      ? `transcribed and drafted ${where(draftedInCloud)}`
      : `${transcriptHop}, ${draftHop}`;
  const tail = !audioLeft && !draftedInCloud ? 'nothing was sent anywhere' : 'for your review';
  const provenance = `${hops} · ${tail}`;

  return {
    sessionLabel,
    sourceLine: durMin
      ? `From a ${durMin}-min voice note · ${provenance}`
      : provenance.charAt(0).toUpperCase() + provenance.slice(1),
    status: 'draft',
    // Rides on the note itself — the single source of truth for the Transcript tab — rather than a
    // caller re-attaching it after the fact. A blank/whitespace-only transcript stores as absent, same
    // honesty rule as every other "nothing to show" case in this note.
    transcript: input.transcript?.trim() || undefined,
    audioLeftDevice: audioLeft,
    transcriptFromCloud: cloudTranscript,
    draftedInCloud,
    riskLevel: toRiskLevel(d.riskSafety?.level),
    sections,
    measures: [],
    reviewCodes,
    prescriptions: toPrep(planBullets),
  };
}

/**
 * The app-wide summarization handle. Groq-backed when configured, otherwise the on-device mock.
 */
export const summarizationService: SummarizationService = hasGroq
  ? new GroqSummarizationService(env.groq.proxyUrl, getAccessToken, env.groq.summaryModel)
  : new MockSummarizationService();
