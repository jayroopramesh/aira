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

/**
 * The app's own crisis line — the UAE Mental Support Line, 800-HOPE ("800 4673"). Baked in as a
 * literal, NOT sourced from `.env.example`, so it is the resolved line in EVERY build: CI, a fresh
 * clone, no `.env.local`. A safety number that only appears once someone copies a template is a
 * number the counselor doesn't have when it matters.
 */
const DEFAULT_CRISIS_LINE = '800 4673';

const raw = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '',
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '',
  groqProxyUrl: (process.env.EXPO_PUBLIC_GROQ_PROXY_URL?.trim() ?? '').replace(/\/$/, ''),
  crisisLine: process.env.EXPO_PUBLIC_CRISIS_LINE?.trim() || DEFAULT_CRISIS_LINE,
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

/**
 * Any cloud service is wired — drives the demo-mode banner. Equal to `hasSupabase` because `hasGroq`
 * implies it: the proxy authenticates with a Supabase session, so a Groq-only configuration does not
 * exist.
 */
export const demoServicesConfigured = hasSupabase;

/**
 * The crisis line the Escalate + safety surfaces dial (F6/F7). It resolves to
 * `DEFAULT_CRISIS_LINE` ("800 4673", the UAE Mental Support Line) in every build; a deployment
 * overrides it with its own regional line via EXPO_PUBLIC_CRISIS_LINE.
 *
 * The `configured: false` branch below is the honest-fallback mechanism, kept for a deployment that
 * signals "this build has NO dedicated mental-health line" — today that signal is a placeholder
 * value (see `isRealValue`), and it remains the seam for a future distinct override. On that branch
 * we do NOT fabricate a mental-health number: we dial local emergency services (999), label it as
 * such, and the UI says a dedicated line isn't set for this build. `configured` drives that copy.
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
