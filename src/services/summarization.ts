/**
 * SummarizationService — the clinical-drafting seam: a de-identified transcript in, a structured
 * SOAP DraftNote out. Nothing here is authoritative; the clinician reviews and signs every note.
 *
 * DEMO mode uses Groq chat completions (llama-3.3-70b-versatile) with a clinical system prompt that
 * produces SOAP sections + a routine risk & safety check + plan items (which feed the Prescriptions
 * rail). This is a CLOUD hop over the transcript text — disclosed by the demo-mode banner. With no
 * key configured it degrades to a deterministic on-device mock so the flow still demos.
 *
 * The transcript (plus a bare session number) is the only thing sent — never the client's name,
 * never audio, never stored records. The prompt instructs
 * the model to avoid echoing raw identifiers, since demo transcription skips the on-device de-id hop.
 */

import { env, hasGroq } from '../config/env';
import { DraftNote, NoteSection, PrepItem, ReviewCode } from '../data/types';

export type SummaryInput = {
  transcript: string;
  clientName?: string;
  sessionNumber?: number;
  durationMs?: number;
};

export interface SummarizationService {
  /** Draft SOAP-structured clinical sections from a transcript. Resolves once. */
  summarize(input: SummaryInput, opts?: { signal?: AbortSignal }): Promise<DraftNote>;
}

/** The JSON shape we ask the model for, then map onto the app's DraftNote. */
type LlmDraft = {
  subjective?: { body?: string[]; quote?: string };
  objective?: { body?: string[] };
  riskSafety?: { summary?: string; rows?: { label: string; value: string }[] };
  assessment?: { body?: string[] };
  plan?: { bullets?: string[] };
  reviewCodes?: { code: string; label: string; relevance?: 'high' | 'med' | 'low' }[];
};

const SYSTEM_PROMPT = `You are a clinical documentation assistant for a licensed mental-health counselor.
You turn a single-session, English, single-speaker-assumed therapy transcript into a DRAFT progress note.
The note is NOT authoritative — the clinician reviews, edits, and signs it. Be faithful to the transcript;
never invent facts, diagnoses, scores, or safety findings that are not supported by it. Use plain, sober,
non-alarming clinical language. Do not echo raw personal identifiers (names, ID numbers, phone numbers,
addresses) in the body — refer to "the client". Always include a routine Risk & Safety check even when the
session is unremarkable (state plainly if nothing of concern was raised).

Return ONLY a JSON object (no prose, no markdown fences) with EXACTLY this shape:
{
  "subjective": { "body": ["1-3 short paragraphs, the client's reported experience"], "quote": "one short verbatim-style client quote or empty string" },
  "objective": { "body": ["1-2 short paragraphs: observed presentation, engagement, mental status observations"] },
  "riskSafety": { "summary": "one plain sentence on risk screened this session", "rows": [ { "label": "Suicidal ideation", "value": "Denied / Passive / ..." }, { "label": "Self-harm", "value": "..." }, { "label": "Safety plan", "value": "..." } ] },
  "assessment": { "body": ["1-2 short paragraphs: clinical impression and progress toward goals"] },
  "plan": { "bullets": ["3-6 concrete, actionable next-step items — these become prescriptions"] },
  "reviewCodes": [ { "code": "e.g. F41.1", "label": "human-readable label", "relevance": "high|med|low" } ]
}`;

export class GroqSummarizationService implements SummarizationService {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async summarize(input: SummaryInput, opts?: { signal?: AbortSignal }): Promise<DraftNote> {
    const userPrompt = [
      input.sessionNumber ? `Session number: ${input.sessionNumber}.` : '',
      'Transcript:',
      '"""',
      input.transcript.slice(0, 24000),
      '"""',
    ]
      .filter(Boolean)
      .join('\n');

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
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
    return buildDraft(parsed, input);
  }
}

/** Deterministic on-device fallback so the flow demos with no Groq key. */
export class MockSummarizationService implements SummarizationService {
  async summarize(input: SummaryInput): Promise<DraftNote> {
    const t = input.transcript.replace(/\s+/g, ' ').trim();
    const sentences = t ? t.split(/(?<=[.!?])\s+/).slice(0, 8) : [];
    const first = sentences.slice(0, 3).join(' ') || 'The client reported on the week since the last session.';
    const rest = sentences.slice(3, 6).join(' ') || 'Engaged and reflective throughout; no acute distress observed.';
    const draft: LlmDraft = {
      subjective: { body: [first], quote: '' },
      objective: { body: [rest] },
      riskSafety: {
        summary: 'Risk screened this session · routine.',
        rows: [
          { label: 'Suicidal ideation', value: 'Denied on screening today' },
          { label: 'Self-harm', value: 'None reported' },
          { label: 'Safety plan', value: 'Existing plan reaffirmed' },
        ],
      },
      assessment: { body: ['Draft impression pending clinician review. Progress consistent with the working plan.'] },
      plan: {
        bullets: ['Continue the agreed between-session practice', 'Review progress at the next session', 'Revisit any items the client raised today'],
      },
      reviewCodes: [{ code: 'F41.1', label: 'Generalized anxiety (working)', relevance: 'med' }],
    };
    return buildDraft(draft, input);
  }
}

/* ------------------------------------------------------------------ mapping --- */

function stripFences(s: string): string {
  return s.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
}

function toPrep(bullets: string[]): PrepItem[] {
  return bullets.filter(Boolean).map((text, i) => ({ id: `rx-${i}`, text, source: 'from Plan', done: false }));
}

function buildDraft(d: LlmDraft, input: SummaryInput): DraftNote {
  const sections: NoteSection[] = [];

  sections.push({
    id: 'subjective',
    marker: 'S',
    title: 'Subjective',
    body: d.subjective?.body?.filter(Boolean) ?? ['The client reported on the week since the last session.'],
    quote: d.subjective?.quote || undefined,
  });

  sections.push({
    id: 'objective',
    marker: 'O',
    title: 'Objective',
    body: d.objective?.body?.filter(Boolean) ?? ['Engaged and reflective throughout the session.'],
    hasMeasures: false,
  });

  sections.push({
    id: 'risk',
    marker: 'R',
    title: 'Risk & Safety Check',
    body: d.riskSafety?.summary ? [d.riskSafety.summary] : ['Risk screened this session · routine.'],
    rows: d.riskSafety?.rows?.length
      ? d.riskSafety.rows
      : [{ label: 'Suicidal ideation', value: 'Denied on screening today' }],
    isRisk: true,
  });

  sections.push({
    id: 'assessment',
    marker: 'A',
    title: 'Assessment',
    body: d.assessment?.body?.filter(Boolean) ?? ['Draft impression pending clinician review.'],
  });

  const planBullets = d.plan?.bullets?.filter(Boolean) ?? ['Continue the agreed between-session practice'];
  sections.push({
    id: 'plan',
    marker: 'P',
    title: 'Plan & Next Steps',
    body: [],
    bullets: planBullets,
  });

  const reviewCodes: ReviewCode[] = (d.reviewCodes ?? []).map((rc) => ({
    code: rc.code,
    label: rc.label,
    relevance: rc.relevance === 'high' || rc.relevance === 'low' ? rc.relevance : 'med',
  }));

  const durMin = input.durationMs ? Math.max(1, Math.round(input.durationMs / 60000)) : null;
  const sessionLabel = input.sessionNumber ? `Session ${input.sessionNumber}` : 'New session';

  return {
    sessionLabel,
    sourceLine: durMin
      ? `From a ${durMin}-min voice note · transcribed in demo mode (cloud) · drafted for your review`
      : 'Transcribed in demo mode (cloud) · drafted for your review',
    status: 'draft',
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
  ? new GroqSummarizationService(env.groq.apiKey, env.groq.baseUrl, env.groq.summaryModel)
  : new MockSummarizationService();
