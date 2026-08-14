/**
 * Live-services configuration for the demo phase.
 *
 * Aira's clinical data is device-local and always stays that way. The ONLY cloud surfaces are:
 *   • Accounts   — Supabase (create-account + login).
 *   • Transcription + summarization — Groq (whisper-large-v3 + llama-3.3-70b-versatile), used in
 *     demo mode to turn a session recording into a SOAP draft. See DemoBanner for the honest
 *     "this leaves the device" disclosure.
 *
 * The Groq API key is NO LONGER a client var: it moved server-side behind a Supabase Edge Function
 * (`supabase/functions/groq-proxy`) so it never ships in the app bundle and only a signed-in
 * counselor can spend the quota. The app now points at that proxy's URL (EXPO_PUBLIC_GROQ_PROXY_URL,
 * client-safe — it's just a public function endpoint) and calls it with the user's Supabase session
 * token. Because the proxy authenticates with the Supabase session, Groq features require Supabase
 * accounts to be configured too.
 *
 * Vars come from `.env.local` (gitignored) as EXPO_PUBLIC_* vars, inlined at build time. When a
 * block is absent (e.g. CI, or a fresh clone with no secrets), the matching service degrades to
 * its on-device MOCK and the UI shows a calm "demo services not configured" notice — never a crash.
 */

const raw = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '',
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '',
  groqProxyUrl: (process.env.EXPO_PUBLIC_GROQ_PROXY_URL?.trim() ?? '').replace(/\/$/, ''),
  crisisLine: process.env.EXPO_PUBLIC_CRISIS_LINE?.trim() ?? '',
  onCallEmail: process.env.EXPO_PUBLIC_ONCALL_EMAIL?.trim() ?? '',
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
    /** The Supabase Edge Function base URL that proxies Groq (server holds the key). */
    proxyUrl: raw.groqProxyUrl,
    transcriptionModel: 'whisper-large-v3',
    summaryModel: 'llama-3.3-70b-versatile',
  },
} as const;

/** Supabase-backed accounts are available (real create-account + login). */
export const hasSupabase = isRealValue(raw.supabaseUrl) && isRealValue(raw.supabaseKey);

/**
 * Groq-backed transcription + summarization are available — i.e. the server-side proxy is configured.
 * It needs BOTH the proxy URL and Supabase accounts (the proxy authenticates the caller with the
 * user's Supabase session token), so a proxy URL without Supabase is treated as not configured.
 */
export const hasGroq = hasSupabase && isRealValue(raw.groqProxyUrl);

/** Any cloud service is wired — drives the demo-mode banner. */
export const demoServicesConfigured = hasSupabase || hasGroq;

/**
 * The crisis line the Escalate + safety surfaces dial (F6/F7). A deployment sets its regional 24/7
 * line via EXPO_PUBLIC_CRISIS_LINE. When none is configured we do NOT fabricate a mental-health
 * number — we fall back to local emergency services (always a correct 24/7 path) and label it
 * honestly, and the UI says a dedicated line isn't set for this build. `configured` drives that copy.
 */
export const crisisLine: { configured: boolean; display: string; tel: string } = (() => {
  if (isRealValue(raw.crisisLine)) {
    const digits = raw.crisisLine.replace(/[^\d+]/g, '');
    return { configured: true, display: raw.crisisLine, tel: `tel:${digits}` };
  }
  return { configured: false, display: '999 · local emergency services', tel: 'tel:999' };
})();

/**
 * The on-call clinician's email the Escalate warm-handoff drafts to (F6). A deployment sets it via
 * EXPO_PUBLIC_ONCALL_EMAIL. Same "no dead promise" rule as the crisis line: when it isn't configured
 * we do NOT claim a handoff address exists — the UI says so and drafts to a clearly-placeholder
 * address the clinician must edit, so nothing silently goes nowhere.
 */
export const onCallEmail: { configured: boolean; address: string } = (() => {
  if (isRealValue(raw.onCallEmail)) return { configured: true, address: raw.onCallEmail };
  return { configured: false, address: 'on-call@clinic.example' };
})();

/** Which cloud services are live, for the demo banner / settings copy. */
export function configuredServices(): { label: string; on: boolean }[] {
  return [
    { label: 'Accounts (Supabase)', on: hasSupabase },
    { label: 'Transcription (Groq · whisper-large-v3)', on: hasGroq },
    { label: 'Summarization (Groq · llama-3.3-70b)', on: hasGroq },
  ];
}
