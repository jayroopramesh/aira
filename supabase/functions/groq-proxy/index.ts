// groq-proxy — a Supabase Edge Function that fronts Groq for Aira's demo cloud services, so the
// Groq API key lives as a server-side Supabase secret instead of shipping in the client bundle.
//
// Why this exists: `EXPO_PUBLIC_*` vars are inlined into the web/native bundle at build time, so an
// `EXPO_PUBLIC_GROQ_API_KEY` is readable by anyone who opens the page — and anyone could spend the
// captain's Groq quota. This function moves the key behind the server: the app calls the function
// with the signed-in counselor's Supabase session JWT, the function verifies that JWT, then calls
// Groq with the secret key that never leaves the server.
//
// It proxies BOTH Groq calls the app uses:
//   • POST /groq-proxy/transcriptions   — multipart audio → whisper-large-v3 (audio/transcriptions)
//   • POST /groq-proxy/chat/completions — JSON messages   → llama-3.3-70b   (chat/completions)
//
// Guarantees:
//   • Only signed-in counselors spend quota. The Authorization bearer must be a valid *user* session
//     token (role "authenticated", not an anonymous sign-in); the anon publishable key and anonymous
//     callers are rejected 401. Note the honest limit: signup is open with the public anon key and
//     email confirmation is OFF, so a valid user JWT proves "someone registered", not "an authorized
//     counselor" — restricting signup is a production concern (see README).
//   • The Groq key is read from GROQ_API_KEY (a Supabase secret), never from an EXPO_PUBLIC_ var.
//   • The models are PINNED server-side (CHAT_MODEL / TRANSCRIPTION_MODEL); a caller-supplied `model`
//     is ignored, so no one can point the quota at an arbitrary, more expensive Groq model.
//   • A per-caller rate limit (see RATE_LIMIT_* below) — best-effort, honestly documented.
//   • A server-side identifier guard: any payload carrying a client/patient identifier or name is
//     rejected with a clear error (never silently stripped), backing the "identifiers never leave the
//     device" promise on the server as well as the client.
//   • Upstream Groq errors are passed through faithfully, status code and body preserved.
//
// Residency note: Supabase Edge Functions run on Supabase's global edge (Deno Deploy); this project
// is ap-south-1 (Mumbai). For production the same proxy pattern moves to the in-region Azure
// container (see infra/). Deploy: see README → "Groq proxy (Edge Function)".

// verify_jwt is disabled for this function (supabase/config.toml) on purpose: we verify the user
// token ourselves so anonymous/anon-key callers get our own clear JSON 401 rather than a platform
// error, and so the identifier guard and rate limit run for every request.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const GROQ_BASE_URL = (Deno.env.get("GROQ_BASE_URL") ?? "https://api.groq.com/openai/v1").replace(/\/$/, "");

// The models this proxy is allowed to spend quota on. PINNED SERVER-SIDE: the caller's own `model`
// is ignored and overwritten, so a rogue account (signup is open — see README) cannot point the
// project's Groq quota at an arbitrary, more expensive model.
const CHAT_MODEL = "llama-3.3-70b-versatile";
const TRANSCRIPTION_MODEL = "whisper-large-v3";

// Per-caller rate limit. Best-effort in-memory fixed window, keyed by Supabase user id.
// A malformed secret must never silently disable the limit (Number("abc") is NaN and every
// comparison against it is false), so anything not a positive finite number falls back to the
// documented default.
function positiveNumberEnv(name: string, fallback: number): number {
  const parsed = Number(Deno.env.get(name));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const RATE_LIMIT_MAX = positiveNumberEnv("RATE_LIMIT_MAX", 20);
const RATE_LIMIT_WINDOW_MS = positiveNumberEnv("RATE_LIMIT_WINDOW_MS", 60_000);

// LIMITATION (documented honestly): this counter lives in the isolate's memory. Edge Functions are
// horizontally scaled and cold-start, so the window is per-isolate and resets when an isolate is
// recycled — it throttles a hot caller on a warm isolate but is not a hard, cluster-wide quota. It is
// a cheap abuse backstop, not a billing control. A hard limit needs a shared store (a Postgres table
// with an atomic upsert, or Redis); that is the production upgrade path and is called out in README.
const hits = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  // Prune EVERY stale entry, not just this caller's: pruning only the caller in hand would still keep
  // an array alive for the lifetime of the isolate for every user id that ever called and never came
  // back. The map now holds only callers seen within the current window.
  for (const [id, times] of hits) {
    const live = times.filter((t) => t > windowStart);
    if (live.length === 0) hits.delete(id);
    else hits.set(id, live);
  }

  const recent = hits.get(userId) ?? [];
  // A REJECTED request is not recorded. Counting it would keep the window permanently full for a
  // client that keeps retrying, so the 429's Retry-After would be a promise the limiter never keeps.
  if (recent.length >= RATE_LIMIT_MAX) return true;
  recent.push(now);
  hits.set(userId, recent);
  return false;
}

// Back-off headers we relay from Groq. A browser caller can only READ them cross-origin when they are
// also exposed, so Access-Control-Expose-Headers below is part of the same promise.
const RELAYED_HEADERS = new Set(["retry-after"]);
const RELAYED_HEADER_PREFIXES = ["x-ratelimit-", "ratelimit-"];

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Expose-Headers": "retry-after, x-ratelimit-limit-requests, x-ratelimit-limit-tokens, x-ratelimit-remaining-requests, x-ratelimit-remaining-tokens, x-ratelimit-reset-requests, x-ratelimit-reset-tokens",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json", ...extra },
  });
}

/** Verify the caller's Supabase session JWT via GoTrue. Returns the user id, or null if the token is
 *  missing/invalid/not a real user (the anon key has no user and is rejected here). */
async function verifyUser(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: string; role?: string; is_anonymous?: boolean };
    // GoTrue returns the user only for an authenticated session; role must not be "anon".
    if (!user?.id || user.role === "anon") return null;
    // A Supabase anonymous sign-in carries role "authenticated" but is not a signed-in counselor;
    // reject it here so enabling that provider later can't quietly open the quota.
    if (user.is_anonymous === true) return null;
    return user.id;
  } catch {
    return null;
  }
}

// Keys that identify a client/patient. If any appears in a request we reject it rather than forward
// it to Groq — a server-side backstop for "identifiers never leave the device". Matched
// case-insensitively against JSON object keys and multipart field names.
const FORBIDDEN_KEYS = new Set([
  "clientname", "client_name", "clientid", "client_id",
  "patientname", "patient_name", "patientid", "patient_id",
  "firstname", "first_name", "lastname", "last_name",
  "fullname", "full_name", "mrn", "dob", "dateofbirth", "date_of_birth",
]);

/** Recursively scan a parsed JSON value for a forbidden identifier key with a non-empty value.
 *  Returns the offending key, or null. */
function findForbiddenKey(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = findForbiddenKey(item);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(k.toLowerCase()) && v != null && v !== "") return k;
      const hit = findForbiddenKey(v);
      if (hit) return hit;
    }
  }
  return null;
}

/** Faithfully relay a Groq upstream response — same status, JSON body preserved when possible, plus
 *  the back-off headers (Retry-After, x-ratelimit-*) a caller needs to actually retry correctly on a
 *  429. Other upstream headers are dropped: they describe Groq's connection to us, not ours to the
 *  caller. */
async function relayUpstream(upstream: Response): Promise<Response> {
  const text = await upstream.text();
  const headers: Record<string, string> = {
    ...CORS_HEADERS,
    "Content-Type": upstream.headers.get("content-type") ?? "application/json",
  };
  for (const [name, value] of upstream.headers) {
    const key = name.toLowerCase();
    if (RELAYED_HEADERS.has(key) || RELAYED_HEADER_PREFIXES.some((p) => key.startsWith(p))) {
      headers[name] = value;
    }
  }
  return new Response(text, { status: upstream.status, headers });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed. Use POST." }, 405);

  if (!GROQ_API_KEY) {
    return json({ error: "Server misconfigured: GROQ_API_KEY secret is not set on the function." }, 500);
  }

  // 1) Only signed-in counselors may spend quota.
  const userId = await verifyUser(req.headers.get("authorization"));
  if (!userId) {
    return json({ error: "Unauthorized: a valid signed-in Supabase session is required." }, 401);
  }

  // 2) Per-caller rate limit (best-effort; see note above).
  if (rateLimited(userId)) {
    return json(
      { error: `Rate limit exceeded: at most ${RATE_LIMIT_MAX} requests per ${Math.round(RATE_LIMIT_WINDOW_MS / 1000)}s.` },
      429,
      { "Retry-After": String(Math.round(RATE_LIMIT_WINDOW_MS / 1000)) },
    );
  }

  // 3) Route on the trailing path segment.
  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  const contentType = req.headers.get("content-type") ?? "";

  try {
    if (path.endsWith("/transcriptions")) {
      // Multipart audio → Groq audio/transcriptions.
      if (!contentType.includes("multipart/form-data")) {
        return json({ error: "Transcription expects multipart/form-data." }, 415);
      }
      const form = await req.formData();
      for (const key of form.keys()) {
        if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
          return json({ error: `Rejected: request carried a client identifier field ("${key}"). Identifiers must not leave the device.` }, 400);
        }
      }
      // Pin the model server-side — whatever the caller asked for is discarded.
      form.set("model", TRANSCRIPTION_MODEL);
      const upstream = await fetch(`${GROQ_BASE_URL}/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
        body: form,
      });
      return await relayUpstream(upstream);
    }

    if (path.endsWith("/chat/completions") || path.endsWith("/chat")) {
      // JSON messages → Groq chat/completions.
      if (!contentType.includes("application/json")) {
        return json({ error: "Chat completions expects application/json." }, 415);
      }
      const raw = await req.text();
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        return json({ error: "Invalid JSON body." }, 400);
      }
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return json({ error: "Chat completions expects a JSON object body." }, 400);
      }
      const forbidden = findForbiddenKey(body);
      if (forbidden) {
        return json({ error: `Rejected: request carried a client identifier field ("${forbidden}"). Identifiers must not leave the device.` }, 400);
      }
      // Pin the model server-side — messages/response_format/temperature are the caller's, the model
      // is not. Forward the re-serialized payload, not `raw`, so the pin cannot be bypassed.
      const payload = { ...(body as Record<string, unknown>), model: CHAT_MODEL };
      const upstream = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return await relayUpstream(upstream);
    }

    return json({ error: `Unknown route "${path}". Use /transcriptions or /chat/completions.` }, 404);
  } catch (e) {
    return json({ error: `Proxy error: ${(e as Error).message}` }, 502);
  }
});
