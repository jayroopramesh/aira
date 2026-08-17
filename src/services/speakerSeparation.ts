/**
 * SpeakerSeparationService — the post-transcription speaker-labelling seam (round-2 item 1,
 * 2026-08-17). Whisper (`transcriptionService`) does NOT diarize, so this is a SEPARATE pass: the
 * already-transcribed text goes to the same groq-proxy `/chat/completions` route the summarizer uses
 * (openai/gpt-oss-120b, pinned server-side), asked to label each turn from conversational cues —
 * Therapist / Client / Speaker 2 (a catch-all for anyone else in the room). SAME privacy envelope as
 * summarization: transcript text only, never a client identifier, and the proxy's server-side
 * identifier guard applies exactly as it does there.
 *
 * HONESTY RULES:
 *  • This is a GUESS, not ground truth — every caller must present it as machine-attributed, for
 *    review, never as an established fact about who said what.
 *  • No session, no fake diarization. With no signed-in Supabase session there is no cloud path to
 *    take, so this REJECTS with `CloudSessionRequiredError` exactly like `GroqTranscriptionService` —
 *    it never falls back to a local heuristic standing in for a real model. `speakerSeparationService`
 *    is `null` outright when Groq isn't configured at all, so a caller can check for capability without
 *    triggering a network call first.
 *  • It must never disturb the note's three-fact provenance line (`audioLeftDevice` /
 *    `transcriptFromCloud` / `draftedInCloud`, see `buildDraft`) — this pass runs independently of
 *    those and stamps nothing onto them.
 */

import { env, hasGroq } from '../config/env';
import { CloudSessionRequiredError } from './cloudSession';
import { getAccessToken } from './supabase';

/** A catch-all label for anyone in the room besides the therapist and the client being seen. */
export type SpeakerLabel = 'Therapist' | 'Client' | 'Speaker 2';

export type SpeakerTurn = { speaker: SpeakerLabel; text: string };

export type SpeakerSeparationResult = { turns: SpeakerTurn[] };

export interface SpeakerSeparationService {
  /** Label each turn of an already-transcribed session. Resolves once. Rejects with
   *  `CloudSessionRequiredError` when there is no live cloud session to run it. */
  separate(transcript: string, opts?: { signal?: AbortSignal }): Promise<SpeakerSeparationResult>;
}

const VALID_SPEAKERS = new Set<SpeakerLabel>(['Therapist', 'Client', 'Speaker 2']);

function stripFences(s: string): string {
  return s.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
}

const SYSTEM_PROMPT = `You label speaker turns in a therapy-session transcript. This is a SINGLE patient session that
may have more than one voice in the room (the therapist, the client, and occasionally someone else —
a family member, an interruption). You do NOT diagnose, summarize, or add content — you only split the
given text into turns and label who is speaking, using conversational cues (who asks clinical
questions, who reports personal experience, turn-taking, self-reference).

Use EXACTLY one of these three labels per turn: "Therapist", "Client", "Speaker 2" (Speaker 2 is a
catch-all for anyone who is neither the therapist nor the client being seen). Preserve the transcript's
own words and order — never paraphrase, translate, or invent text that is not in the transcript. If the
whole transcript reads as one continuous, undifferentiated block with no clear turn boundaries, return
it as a single "Client" turn rather than guessing false boundaries.

Return ONLY a JSON object (no prose, no markdown fences) with EXACTLY this shape:
{ "turns": [ { "speaker": "Therapist | Client | Speaker 2", "text": "the turn's own words, verbatim from the transcript" } ] }`;

/**
 * GroqSpeakerSeparationService — the only live implementation. There is deliberately no mock/stub
 * fallback: a fabricated speaker split would misattribute words to "the therapist" or "the client"
 * without a real model behind it, which is the same class of fabrication `MockTranscriptionService`
 * refuses for a real recording.
 */
export class GroqSpeakerSeparationService implements SpeakerSeparationService {
  constructor(
    private readonly proxyUrl: string,
    private readonly getToken: () => Promise<string | null>,
    private readonly model: string,
  ) {}

  async separate(transcript: string, opts?: { signal?: AbortSignal }): Promise<SpeakerSeparationResult> {
    const token = await this.getToken();
    if (!token) {
      throw new CloudSessionRequiredError('Sign in to use speaker separation — there is no active session.');
    }

    const res = await fetch(`${this.proxyUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Transcript:\n"""\n${transcript.slice(0, 24000)}\n"""` },
        ],
      }),
      signal: opts?.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Speaker separation failed (${res.status}). ${detail.slice(0, 300)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? '{}';
    let parsed: { turns?: { speaker?: string; text?: string }[] };
    try {
      parsed = JSON.parse(content) as typeof parsed;
    } catch {
      parsed = JSON.parse(stripFences(content)) as typeof parsed;
    }
    const turns: SpeakerTurn[] = (parsed.turns ?? [])
      .filter((t): t is { speaker: string; text: string } => !!t.speaker && !!t.text?.trim())
      // An unrecognised label (the model drifting from the three-value enum) falls back to the
      // neutral catch-all rather than being silently dropped or mislabelled as a real participant.
      .map((t) => ({ speaker: (VALID_SPEAKERS.has(t.speaker as SpeakerLabel) ? t.speaker : 'Speaker 2') as SpeakerLabel, text: t.text.trim() }));
    return { turns };
  }
}

/**
 * The app-wide handle. `null` when Groq isn't configured at all — callers check for this rather than
 * calling `separate()` and catching, so the capture screen can degrade honestly (no separation
 * offered) without an unnecessary network round-trip. When Groq IS configured but nobody is signed in,
 * `separate()` itself throws `CloudSessionRequiredError` (the runtime, not build-time, question —
 * mirrors `cloudSessionReady()`).
 */
export const speakerSeparationService: SpeakerSeparationService | null = hasGroq
  ? new GroqSpeakerSeparationService(env.groq.proxyUrl, getAccessToken, env.groq.summaryModel)
  : null;
