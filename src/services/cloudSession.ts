/**
 * Cloud-session helpers for the two Groq-backed seams.
 *
 * The line this file draws — the one rule everything here serves:
 *   FABRICATION is the app INVENTING clinical text, i.e. standing a canned transcript in for a real
 *   recording. That is never acceptable, so TRANSCRIPTION with no session token REJECTS with the
 *   error below rather than returning the mock's prose.
 *   DRAFTING the clinician's OWN typed/pasted words with the on-device summarizer is NOT fabrication
 *   — it is the accepted no-keys degradation — so drafting may fall back on-device, stamped honestly
 *   as drafted-on-device.
 *
 * Callers identify the error by `name` rather than `instanceof` — the transpiled subclass prototype
 * chain is not reliable across the app's targets, and this must never silently stop matching.
 */
import { hasGroq } from '../config/env';
import { getAccessToken } from './supabase';

export const CLOUD_SESSION_REQUIRED = 'CloudSessionRequiredError';

export class CloudSessionRequiredError extends Error {
  readonly name = CLOUD_SESSION_REQUIRED;
}

export function isCloudSessionRequiredError(e: unknown): boolean {
  return (e as Error | undefined)?.name === CLOUD_SESSION_REQUIRED;
}

/**
 * Can a cloud call actually run right now? Both halves must hold: the proxy is configured AND a live
 * Supabase session token exists. Only email/password sign-in mints that token — a recovery-code
 * unlock opens the vault but carries no Supabase credentials, and on native the session is memory-only
 * — so this is a RUNTIME question the capture screen asks before recording, never `hasGroq` alone.
 */
export async function cloudSessionReady(): Promise<boolean> {
  if (!hasGroq) return false;
  return (await getAccessToken()) != null;
}
