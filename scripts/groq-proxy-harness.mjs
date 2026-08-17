/**
 * groq-proxy harness. Proves the five promises the server-side Groq key rests on, by RUNNING the real
 * `supabase/functions/groq-proxy/index.ts` over real HTTP rather than by reading it.
 *
 *   1. Only a signed-in counselor spends quota — anonymous, anon-key and anonymous-sign-in callers 401.
 *   2. The Groq key is the SERVER's: the caller's session token is never forwarded upstream, the
 *      upstream Authorization is the function's own secret, and the secret never appears in a response.
 *   3. The per-caller rate limit actually stops the (N+1)th call, with a Retry-After.
 *   4. A payload carrying a client identifier is REJECTED (400) and never reaches Groq — not stripped.
 *   5. Upstream Groq errors come back faithfully: same status, same body, back-off headers preserved.
 *   (+ the models are pinned server-side, so a caller-supplied `model` cannot redirect the quota.)
 *
 * The function is Deno code. Deno/Docker are not required to run this: `Deno.env.get`/`Deno.serve` are
 * shimmed onto Node's http + fetch, and the function's two dependencies — GoTrue (`/auth/v1/user`) and
 * Groq — are stood up as local servers so every request/response below is a real one over the wire.
 *
 * Run (Node ≥ 22.13, e.g. ~/.cache/fm-node/node-v22.23.2-darwin-arm64/bin/node):
 *   node scripts/groq-proxy-harness.mjs           # assert, print the transcript, exit non-zero on failure
 *   node scripts/groq-proxy-harness.mjs --serve    # keep the proxy up so you can curl it by hand
 */
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { register } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

register('./ts-service-loader.mjs', import.meta.url);

/* ---------------------------------------------------------------- test doubles --- */

const SESSION_TOKEN = 'counselor-session-jwt';
const SESSION_TOKEN_2 = 'other-counselor-session-jwt';
const ANONYMOUS_SIGNIN_TOKEN = 'anonymous-signin-jwt';
const ANON_PUBLISHABLE_KEY = 'sb_publishable_anonkeyisitselfavalidjwt';
const SERVER_GROQ_KEY = 'gsk_SERVER_SIDE_SECRET_NEVER_IN_THE_BUNDLE';

/** Start an http server on an ephemeral port; resolves its base URL. */
function listen(handler) {
  const server = createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

function sendJson(res, status, body, headers = {}) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(text);
}

// GoTrue stand-in: only a real user session token resolves to a user, exactly as Supabase behaves.
const gotrue = await listen((req, res) => {
  if (!req.url.startsWith('/auth/v1/user')) return sendJson(res, 404, { message: 'not found' });
  const bearer = (req.headers.authorization ?? '').replace(/^Bearer /, '');
  if (bearer === SESSION_TOKEN) return sendJson(res, 200, { id: 'user-counselor-1', role: 'authenticated' });
  if (bearer === SESSION_TOKEN_2) return sendJson(res, 200, { id: 'user-counselor-2', role: 'authenticated' });
  // A Supabase anonymous sign-in: role "authenticated", but not a counselor.
  if (bearer === ANONYMOUS_SIGNIN_TOKEN)
    return sendJson(res, 200, { id: 'user-anonymous-1', role: 'authenticated', is_anonymous: true });
  // The anon publishable key is itself a valid JWT, and GoTrue answers it with 401 (no user).
  return sendJson(res, 401, { message: 'invalid claim: missing sub claim' });
});

/** Every request the fake Groq saw: { path, authorization, model, body, fields }. */
const groqCalls = [];
let groqNextFailure = null; // { status, body, headers } — consumed by the next upstream call

const groq = await listen(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const rawBody = Buffer.concat(chunks).toString('utf8');
  const call = { path: req.url, authorization: req.headers.authorization ?? null, rawBody };

  if (req.url.endsWith('/chat/completions')) {
    const parsed = JSON.parse(rawBody);
    call.model = parsed.model;
    call.body = parsed;
  } else {
    // Multipart: pull the field names and the model out of the raw body without a parser dependency.
    call.fields = [...rawBody.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
    call.model = rawBody.match(/name="model"\r?\n\r?\n([^\r\n]+)/)?.[1];
  }
  groqCalls.push(call);

  if (groqNextFailure) {
    const { status, body, headers } = groqNextFailure;
    groqNextFailure = null;
    return sendJson(res, status, body, headers);
  }
  if (req.url.endsWith('/chat/completions')) {
    return sendJson(res, 200, {
      id: 'chatcmpl-stub',
      model: call.model,
      choices: [{ message: { role: 'assistant', content: '{"subjective":{"body":["Reported a steadier fortnight."]}}' } }],
    });
  }
  return sendJson(res, 200, { text: 'Client reported a steadier fortnight.', segments: [] });
});

/* ------------------------------------------------------ the real Edge Function --- */

let handler = null;
globalThis.Deno = {
  env: {
    get: (name) =>
      ({
        SUPABASE_URL: gotrue.base,
        SUPABASE_ANON_KEY: ANON_PUBLISHABLE_KEY,
        GROQ_API_KEY: SERVER_GROQ_KEY, // the secret lives here — server-side only
        GROQ_BASE_URL: groq.base,
        // The window is per-isolate, so the rate-limit case gets its own process (see RATE_LIMIT_CASE
        // below) — otherwise the other scenarios would burn the very window it is trying to measure.
        RATE_LIMIT_MAX: process.env.HARNESS_RATE_LIMIT_MAX ?? '200',
        RATE_LIMIT_WINDOW_MS: '60000',
      })[name],
  },
  serve: (h) => {
    handler = h;
  },
};

await import('../supabase/functions/groq-proxy/index.ts');
if (!handler) throw new Error('the function did not register a Deno.serve handler');

// Bridge Node's http server onto the function's (Request) => Response handler.
const proxy = await listen(async (nodeReq, nodeRes) => {
  const hasBody = nodeReq.method !== 'GET' && nodeReq.method !== 'HEAD';
  const request = new Request(`http://127.0.0.1${nodeReq.url}`, {
    method: nodeReq.method,
    headers: nodeReq.headers,
    body: hasBody ? Readable.toWeb(nodeReq) : undefined,
    duplex: 'half',
  });
  const response = await handler(request);
  const headers = {};
  for (const [k, v] of response.headers) headers[k] = v;
  nodeRes.writeHead(response.status, headers);
  nodeRes.end(Buffer.from(await response.arrayBuffer()));
});

const PROXY = `${proxy.base}/groq-proxy`;

const RATE_LIMIT_CASE = process.argv.includes('--rate-limit-case');

if (process.argv.includes('--serve')) {
  console.log(`proxy      ${PROXY}`);
  console.log(`session    Authorization: Bearer ${SESSION_TOKEN}`);
  console.log(`anon key   Authorization: Bearer ${ANON_PUBLISHABLE_KEY}`);
  console.log('\nserving — ctrl-c to stop');
} else {
  await runScenarios();
}

/* ------------------------------------------------------------------- scenarios --- */

async function runScenarios() {
  let failed = 0;
  const check = (name, ok, detail) => {
    if (!ok) failed++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  → ${detail}`}`);
  };

  /** Issue a request and print it the way an operator running curl would see it. */
  async function call(label, url, init = {}) {
    const res = await fetch(url, init);
    const text = await res.text();
    const auth = (init.headers?.Authorization ?? '(none)').replace(/^Bearer /, 'Bearer ');
    console.log(`\n$ ${init.method ?? 'POST'} ${url.replace(proxy.base, '')}   [${auth}]`);
    console.log(`< HTTP ${res.status}`);
    const retryAfter = res.headers.get('retry-after');
    if (retryAfter) console.log(`< Retry-After: ${retryAfter}`);
    const limit = res.headers.get('x-ratelimit-remaining-requests');
    if (limit) console.log(`< x-ratelimit-remaining-requests: ${limit}`);
    console.log(`< ${text.slice(0, 260)}`);
    return { res, text, json: safeJson(text) };
  }

  const chatBody = (extra = {}) => ({
    // A caller asking for a different, more expensive model — the proxy must ignore it.
    model: 'moonshot-please-spend-my-quota',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You are a clinical documentation assistant.' },
      { role: 'user', content: 'Transcript: the client reported a steadier fortnight.' },
    ],
    ...extra,
  });
  const jsonPost = (token, body) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

  if (RATE_LIMIT_CASE) {
    await rateLimitCase(check);
    console.log(failed ? `\n${failed} assertion(s) failed` : '\nrate-limit case passed');
    process.exit(failed ? 1 : 0);
  }

  console.log('\n=== 1. Only a signed-in counselor spends quota ==================================');
  {
    const before = groqCalls.length;
    const anon = await call('anonymous', `${PROXY}/chat/completions`, jsonPost(null, chatBody()));
    check('no Authorization header → 401', anon.res.status === 401, anon.res.status);
    check('and the 401 explains itself', /signed-in Supabase session/i.test(anon.json?.error ?? ''), anon.text);

    const anonKey = await call('anon key', `${PROXY}/chat/completions`, jsonPost(ANON_PUBLISHABLE_KEY, chatBody()));
    check('the anon publishable key (itself a valid JWT) → 401', anonKey.res.status === 401, anonKey.res.status);

    const anonymousUser = await call('anonymous sign-in', `${PROXY}/chat/completions`, jsonPost(ANONYMOUS_SIGNIN_TOKEN, chatBody()));
    check('an anonymous sign-in (role authenticated) → 401', anonymousUser.res.status === 401, anonymousUser.res.status);

    check('and no rejected call reached Groq', groqCalls.length === before, `${groqCalls.length - before} did`);
  }

  console.log('\n=== 2. The Groq key is the server\'s, and the models are pinned ==================');
  {
    const ok = await call('signed in', `${PROXY}/chat/completions`, jsonPost(SESSION_TOKEN, chatBody()));
    const upstream = groqCalls.at(-1);
    check('a signed-in counselor gets a completion (200)', ok.res.status === 200, ok.res.status);
    check('the completion body is Groq\'s own', !!ok.json?.choices?.[0]?.message?.content, ok.text);
    check('upstream saw the SERVER secret, not the session token',
      upstream.authorization === `Bearer ${SERVER_GROQ_KEY}`, upstream.authorization);
    check('the caller\'s session token never left the proxy',
      !upstream.rawBody.includes(SESSION_TOKEN) && upstream.authorization !== `Bearer ${SESSION_TOKEN}`, upstream.authorization);
    check('the caller-supplied model was overwritten with the pinned chat model',
      upstream.model === 'openai/gpt-oss-120b', upstream.model);
    check('the clinical messages were forwarded intact', upstream.body.messages.length === 2, JSON.stringify(upstream.body.messages));
    check('no response ever echoes the Groq secret', !ok.text.includes(SERVER_GROQ_KEY), 'it did');
  }

  console.log('\n=== 2b. Transcription: multipart audio, model pinned ============================');
  {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/webm' }), 'session.webm');
    form.append('model', 'whisper-tiny-please'); // again: the caller does not get to choose
    form.append('response_format', 'verbose_json');
    const res = await call('transcribe', `${PROXY}/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SESSION_TOKEN}` },
      body: form,
    });
    const upstream = groqCalls.at(-1);
    check('multipart audio proxies through (200)', res.res.status === 200, res.res.status);
    check('and returns whisper\'s text', res.json?.text === 'Client reported a steadier fortnight.', res.text);
    check('it hit Groq\'s audio/transcriptions endpoint', upstream.path.endsWith('/audio/transcriptions'), upstream.path);
    check('with the pinned transcription model', upstream.model === 'whisper-large-v3', upstream.model);
    check('carrying the audio file', upstream.fields.includes('file'), JSON.stringify(upstream.fields));
    check('and the server secret, not the session token',
      upstream.authorization === `Bearer ${SERVER_GROQ_KEY}`, upstream.authorization);

    const json = await call('wrong content-type', `${PROXY}/transcriptions`, jsonPost(SESSION_TOKEN, { hello: 'world' }));
    check('a non-multipart transcription is refused (415)', json.res.status === 415, json.res.status);
  }

  console.log('\n=== 3. Client identifiers are rejected, never silently stripped =================');
  {
    const before = groqCalls.length;
    const flat = await call('clientName', `${PROXY}/chat/completions`, jsonPost(SESSION_TOKEN, chatBody({ clientName: 'Amara Haddad' })));
    check('a payload carrying clientName → 400', flat.res.status === 400, flat.res.status);
    check('the error names the offending field', /clientName/.test(flat.json?.error ?? ''), flat.text);
    check('and says identifiers must not leave the device', /must not leave the device/i.test(flat.json?.error ?? ''), flat.text);

    const nested = await call('nested mrn', `${PROXY}/chat/completions`,
      jsonPost(SESSION_TOKEN, chatBody({ metadata: { patient: { mrn: 'MRN-99213' } } })));
    check('a NESTED identifier is caught too → 400', nested.res.status === 400, nested.res.status);
    check('the error names it', /mrn/i.test(nested.json?.error ?? ''), nested.text);

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/webm' }), 'session.webm');
    form.append('client_id', 'c-amara');
    const multipart = await call('client_id field', `${PROXY}/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SESSION_TOKEN}` },
      body: form,
    });
    check('a multipart identifier field → 400', multipart.res.status === 400, multipart.res.status);

    check('NONE of the three reached Groq (rejected, not stripped-and-forwarded)',
      groqCalls.length === before, `${groqCalls.length - before} did`);
  }

  console.log('\n=== 4. Upstream Groq errors are relayed faithfully ==============================');
  {
    groqNextFailure = {
      status: 429,
      body: { error: { message: 'Rate limit reached for model openai/gpt-oss-120b', type: 'rate_limit_exceeded' } },
      headers: { 'retry-after': '17', 'x-ratelimit-remaining-requests': '0' },
    };
    const relayed = await call('upstream 429', `${PROXY}/chat/completions`, jsonPost(SESSION_TOKEN, chatBody()));
    check('Groq\'s 429 status comes back as a 429', relayed.res.status === 429, relayed.res.status);
    check('with Groq\'s own error body', /rate_limit_exceeded/.test(relayed.text), relayed.text);
    check('and the Retry-After a client needs to back off', relayed.res.headers.get('retry-after') === '17',
      relayed.res.headers.get('retry-after'));
    check('and the x-ratelimit-* budget headers', relayed.res.headers.get('x-ratelimit-remaining-requests') === '0',
      relayed.res.headers.get('x-ratelimit-remaining-requests'));

    groqNextFailure = { status: 413, body: { error: { message: 'Audio file too large', type: 'invalid_request_error' } } };
    const tooLarge = await call('upstream 413', `${PROXY}/chat/completions`, jsonPost(SESSION_TOKEN, chatBody()));
    check('a 413 is relayed as a 413, not flattened to 500', tooLarge.res.status === 413, tooLarge.res.status);
    check('with the upstream message intact', /Audio file too large/.test(tooLarge.text), tooLarge.text);
  }

  console.log('\n=== 5. Per-caller rate limit (run in its own isolate, RATE_LIMIT_MAX=3) ========');
  {
    // The limiter's window is in-memory and per-isolate, so measuring it here would collide with the
    // scenarios above. Same code, fresh process, a limit small enough to hit deliberately.
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--rate-limit-case'], {
      env: { ...process.env, HARNESS_RATE_LIMIT_MAX: '3' },
      encoding: 'utf8',
    });
    process.stdout.write(child.stdout ?? '');
    if (child.stderr?.trim()) process.stderr.write(child.stderr);
    check('the rate-limit case passed in its own isolate', child.status === 0, `child exited ${child.status}`);
  }

  console.log('\n=== 6. Routing =================================================================');
  {
    const unknown = await call('unknown route', `${PROXY}/embeddings`, jsonPost(SESSION_TOKEN, chatBody()));
    check('an unknown route → 404 naming the real ones', unknown.res.status === 404 && /transcriptions/.test(unknown.text), unknown.text);

    const get = await call('GET', `${PROXY}/chat/completions`, { method: 'GET' });
    check('GET → 405', get.res.status === 405, get.res.status);
  }

  console.log(failed ? `\n${failed} assertion(s) failed` : '\nAll groq-proxy assertions passed');
  process.exit(failed ? 1 : 0);

  /** Scenario 5, in a fresh isolate: the 4th call from one counselor inside the window is refused. */
  async function rateLimitCase(childCheck) {
    const max = Number(process.env.HARNESS_RATE_LIMIT_MAX);
    const before = groqCalls.length;
    const statuses = [];
    let limitedBody = '';
    let limitedRetryAfter = null;
    for (let i = 0; i <= max; i++) {
      const r = await fetch(`${PROXY}/chat/completions`, jsonPost(SESSION_TOKEN_2, chatBody()));
      statuses.push(r.status);
      if (r.status === 429) {
        limitedBody = await r.text();
        limitedRetryAfter = r.headers.get('retry-after');
      }
    }
    console.log(`\n$ POST /groq-proxy/chat/completions  ×${max + 1}   [Bearer counselor-2]`);
    console.log(`< HTTP ${statuses.join(', ')}`);
    console.log(`< Retry-After: ${limitedRetryAfter}`);
    console.log(`< ${limitedBody}`);
    childCheck(`the first ${max} calls are served`, statuses.slice(0, max).every((s) => s === 200), statuses.join(','));
    childCheck(`call ${max + 1} in the window is limited (429)`, statuses.at(-1) === 429, statuses.at(-1));
    childCheck('with a Retry-After the caller can honour', Number(limitedRetryAfter) === 60, limitedRetryAfter);
    childCheck('and a message stating the limit', new RegExp(`at most ${max} requests per 60s`).test(limitedBody), limitedBody);
    childCheck('the throttled call never reached Groq', groqCalls.length - before === max, String(groqCalls.length - before));

    // The other counselor is unaffected — the window is keyed by Supabase user id.
    const other = await fetch(`${PROXY}/chat/completions`, jsonPost(SESSION_TOKEN, chatBody()));
    console.log(`\n$ POST /groq-proxy/chat/completions   [Bearer counselor-1, same window]`);
    console.log(`< HTTP ${other.status}`);
    childCheck('a DIFFERENT counselor is not throttled by it', other.status === 200, other.status);
  }
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
