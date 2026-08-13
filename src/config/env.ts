/**
 * Live-services configuration for the demo phase.
 *
 * Aira's clinical data is device-local and always stays that way. The ONLY cloud surfaces are:
 *   • Accounts   — Supabase (create-account + login).
 *   • Transcription + summarization — Groq (whisper-large-v3 + llama-3.3-70b-versatile), used in
 *     demo mode to turn a session recording into a SOAP draft. See DemoBanner for the honest
 *     "this leaves the device" disclosure.
 *
 * Keys come from `.env.local` (gitignored) as EXPO_PUBLIC_* vars, inlined at build time. When a
 * block is absent (e.g. CI, or a fresh clone with no secrets), the matching service degrades to
 * its on-device MOCK and the UI shows a calm "demo services not configured" notice — never a crash.
 */

const raw = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '',
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '',
  groqKey: process.env.EXPO_PUBLIC_GROQ_API_KEY?.trim() ?? '',
  groqBaseUrl: (process.env.EXPO_PUBLIC_GROQ_BASE_URL?.trim() || 'https://api.groq.com/openai/v1').replace(/\/$/, ''),
};

/** A placeholder (from .env.example) is treated as "not configured". */
function isRealValue(v: string): boolean {
  if (!v) return false;
  return !/YOUR-PROJECT|xxxx|placeholder/i.test(v);
}

export const env = {
  supabase: {
    url: raw.supabaseUrl,
    publishableKey: raw.supabaseKey,
  },
  groq: {
    apiKey: raw.groqKey,
    baseUrl: raw.groqBaseUrl,
    transcriptionModel: 'whisper-large-v3',
    summaryModel: 'llama-3.3-70b-versatile',
  },
} as const;

/** Supabase-backed accounts are available (real create-account + login). */
export const hasSupabase = isRealValue(raw.supabaseUrl) && isRealValue(raw.supabaseKey);

/** Groq-backed transcription + summarization are available. */
export const hasGroq = isRealValue(raw.groqKey);

/** Any cloud service is wired — drives the demo-mode banner. */
export const demoServicesConfigured = hasSupabase || hasGroq;

/** Which cloud services are live, for the demo banner / settings copy. */
export function configuredServices(): { label: string; on: boolean }[] {
  return [
    { label: 'Accounts (Supabase)', on: hasSupabase },
    { label: 'Transcription (Groq · whisper-large-v3)', on: hasGroq },
    { label: 'Summarization (Groq · llama-3.3-70b)', on: hasGroq },
  ];
}
