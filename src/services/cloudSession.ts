/**
 * The one error both Groq-backed cloud seams raise when there is no Supabase session token.
 *
 * Why it exists rather than a silent mock swap: the cloud services must NEVER substitute canned
 * clinical prose for a counselor's real recording. A mocked transcript would attach fabricated
 * findings ("Denies passive ideation on screening today") to a real session, and the note's
 * provenance would still claim the cloud hop that never happened. So a missing token fails loudly
 * and the capture screen turns it into a calm "sign in, or paste the transcript" recovery.
 *
 * Callers identify it by `name` rather than `instanceof` — the transpiled subclass prototype chain
 * is not reliable across the app's targets, and this must never silently stop matching.
 */
export const CLOUD_SESSION_REQUIRED = 'CloudSessionRequiredError';

export class CloudSessionRequiredError extends Error {
  readonly name = CLOUD_SESSION_REQUIRED;
}

export function isCloudSessionRequiredError(e: unknown): boolean {
  return (e as Error | undefined)?.name === CLOUD_SESSION_REQUIRED;
}
