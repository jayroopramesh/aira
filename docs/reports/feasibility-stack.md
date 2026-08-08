# Aira — Full-Stack Feasibility Assessment (fully-local, browser-first)

**Scout task:** `aira-stack-s1`  ·  **Date:** 2026-08-07  ·  **Deliverable:** this report (no code shipped into `aira`).

**One-line verdict:** The fully-local, browser-first architecture is **buildable and genuinely differentiated**, but three of its stated V1 pieces have hard edges — **iOS is the fragile leg, Arabic transcription at browser-model sizes is not good enough, and "OpenMed de-identification" is not the thing the founder thinks it is.** Encryption/portability and longitudinal analysis are solid. Ship it as an **installable PWA** (not a naked tab) or the iOS promise breaks. Details, measured numbers, and the decisions I need from the founder are below.

---

## 0. What I actually did (evidence trail)

This is a scout report, but I did not assess from memory. I ran real spikes and three parallel evidence sweeps against current (2025–2026) docs, model cards, and browser-support tables.

**Local spikes** (Apple-Silicon Mac, Node 22.6, `@huggingface/transformers` latest, `onnxruntime-node` CPU backend — this is *native* CPU, a generous proxy; real in-browser WASM is ~2–4× slower, in-browser WebGPU can be faster on desktop):

| Spike | What I measured | Result |
|---|---|---|
| `whisper-base` (q8) transcribing a 14.7 s synthesized clinical utterance | on-disk weights, cold download, warm load, inference, real-time factor (RTF), accuracy | **73 MB weights** (22.1 enc + 51.2 dec), first-run download+init **48 s**, **warm load 627 ms**, inference **1.77 s → RTF 0.12**, English transcription **accurate** ("…On the PHQ-9 you scored 14, which is up from 9 in January…") |
| `whisper-small` (q8), same clip | same | **237 MB weights** (88 enc + 149.5 dec), inference **4.16 s → RTF 0.28**, English **accurate** |
| `bert-base-NER` (q8) token-classification over a synthetic clinical paragraph | model size, warm inference, entity extraction | **104 MB**, inference **74 ms**, correctly tagged `Amara Khalid`→PER, `Abu Dhabi`→LOC, `Yusuf`→PER |

These prove browser-class ASR and NER models load and run at real-time-plus speeds *on a laptop-class CPU*. The download-once cost and the iOS story are the caveats.

**Research sweeps** (full source URLs are inline in each section below): (1) browser Whisper — transformers.js/whisper.cpp/WebGPU support, model sizes, iOS memory ceilings, Arabic/Indic WER; (2) OpenMed — what it actually is, sizes, licence, PHI-de-id-vs-biomedical distinction; (3) WebCrypto/storage/portability — KDF, AEAD, IndexedDB/OPFS/File System Access eviction, iOS 7-day cap, PDPL/GDPR posture.

**Source material read:** `handoff.md` (the superseded cloud-hybrid brief), the original idea PDF (data model + shared risk-rules spec — extracted via `pypdf`), and the two mockups (`aira-mvp 3.html`, `aira-screens.html` — the counselor asks things like *"Show Amara K.'s PHQ-9 trend Jan–Apr"*, *"Who's due for follow-up this week?"*, *"Build the Q1 wellbeing snapshot"*; explicitly **not a chatbot**).

---

## 1. The pivot: what fully-local browser-first costs vs `handoff.md`

The founder's current instruction (fully-local, browser, nothing uploaded, password-encrypted, portable by user transfer) **directly overrides** the "Locked decisions" in `handoff.md`. The founder's instruction wins; here is the honest bill for it, invariant by invariant.

| `handoff.md` locked decision | Status under fully-local browser | Cost of the pivot |
|---|---|---|
| **In-region UAE backend** (Azure UAE North / AWS me-central-1), hosted Postgres, therapist auth | **Deleted.** No backend at all. | You lose central backup, multi-user clinic isolation-by-server, server-side auth/lockout, and audit infrastructure. Data lives and dies on the therapist's device. |
| **Self-hosted LLM on in-region GPU** (Qwen/DeepSeek, 7–14B) for the note-drafting "Agent 1" | **Impossible in-browser.** A 7–14B model is 4–8 GB+ even quantized; it will not run on a therapist's laptop browser and *cannot* run on their iPhone. | **The generative "voice → structured clinical note" narration step is off the table for a pure browser build.** This is the single biggest capability loss (see §3, transcription→note). |
| **OpenMed de-identification before any LLM call** (invariant 1) | Survives *mechanically* (runs on-device) but its *purpose* changes — there's no cloud LLM to protect anymore. | The de-id step becomes about *user-facing redaction / structured extraction*, not about safely shipping tokens to a server. And "OpenMed" turns out to be mostly the wrong tool (§3). |
| **Deterministic analysis module** (SQL/Python, "numbers are deterministic") | **Survives perfectly.** Trivial in-browser. | None — this is the part the browser is *best* at. |
| **In-region data residency / pseudonymised = still personal data** (legal framing) | Changes shape: data never leaves the device, so "residency" becomes "wherever the therapist's laptop is." | Stronger privacy posture, but *not* a regulatory exemption (§5). And "portable by email/USB" reintroduces a residency/exfiltration surface the in-region design had closed. |

**Net:** the pivot buys a much stronger privacy story and a zero-backend cost structure, and it **removes the entire in-region-GPU LLM pillar**. Anything in the old plan that depended on a real LLM (fluent note narration, "sounds like you" voice-matching, free-text summarization) either drops to a template/extractive approach or moves to an optional bring-your-own-cloud path that breaks invariant 2. Say this out loud to the founder — it is the load-bearing consequence.

---

## 2. Section A — Browser feasibility, per capability

Device targets I score against: **(L)** ordinary laptop (mid-range, 8–16 GB RAM, Chrome/Edge/Safari 26); **(A)** mid-range Android phone (Chrome, WebGPU on Android 12+); **(I)** iPhone/iPad Safari — *the hard case, and the one the founder specifically wants.*

### A1. Transcription — **WORKS WITH CAVEATS (laptop) / DOES NOT WORK WELL (iPhone + Arabic)**

**Tech:** `@huggingface/transformers` v4 (current; the old `@xenova/transformers` is frozen legacy) running Whisper ONNX, `device:'webgpu'` with `'wasm'` fallback; or `whisper.cpp` WASM. Both are real and shipping in 2026.

**Measured & sourced numbers:**

| Model (q8/int8) | Weights to download | Laptop RTF | iPhone viability | English quality | Arabic quality (FLEURS WER, clean MSA) |
|---|---|---|---|---|---|
| whisper-tiny | ~40 MB | fastest | OK (quantized) | weak | **63% — unusable** |
| **whisper-base** | **73 MB (measured)** | **0.12 native / ~0.3–0.6 in-browser** | OK on recent devices | **good (measured)** | **49% — unusable** |
| whisper-small | **237 MB (measured)** | 0.28 native / ~0.6–1.2 in-browser | marginal, Pro devices only | good | **31% — gist-only, marginal** |
| whisper-large-v3-turbo | 440–645 MB (q8) | best quality | **OOMs on iPhone** | best | ~13–16% |

*Arabic WER from OpenAI Whisper paper Table 13 (arxiv 2212.04356). Dialect makes it worse: even large-v2 goes 11.6% (MSA read speech) → 34.7% on MGB-2 multi-dialect incl. Gulf → 43.5% Egyptian (Talafha et al., arxiv 2306.02902). Whisper is MSA-centric; Gulf/Khaleeji conversational speech is materially harder.*

**WebGPU availability (caniuse.com/webgpu, WebKit Safari-26 notes):** Chrome/Edge desktop since 113 (2023); Chrome Android since 121 (2024); **Safari macOS since 26.0 (fall 2025); iOS/iPadOS Safari WebGPU is on-by-default only from iOS 26.0** — anyone on iOS 18.x has *no WebGPU* and falls back to WASM CPU. So WebGPU reach on iPhone depends entirely on the client's iOS-26 install base.

**iOS memory ceiling (the near-universal iOS killer):** a single large `WebAssembly.Memory` allocation of 2 GB fails on iOS (Godot #70621, Emscripten #19144); single-allocation JS heap ~200–400 MB; whole-tab Jetsam kill around 1.5–3 GB depending on device and uptime. **Practical rule: keep total in-memory footprint a few hundred MB to ~1 GB.** That caps the iPhone to quantized **tiny/base**, maybe small on a recent Pro — and kills turbo/large outright.

**Verdicts:**
- **Laptop, English/European:** works with caveats (one-time model download; WASM fallback slower but still ≥ real-time for base). ✅
- **iPhone, English:** works with caveats — base only, iOS 26 for WebGPU, must be a PWA to keep the model cached (§5). ⚠️
- **Arabic (the launch market's headline language):** **does not work at browser sizes.** whisper-base 49% / small 31% WER on *easy* MSA, worse on Gulf dialect. Do **not** ship Whisper-base/small for Arabic therapy audio. There is a credible fix — **Moonshine Tiny Arabic (27M params)** reports FLEURS Arabic WER **20.8**, matching Whisper-Medium (769M) at ~1/28th the size, ONNX/browser-runnable (arxiv 2509.02523) — but its multilingual ONNX/web build is still emerging (sherpa-onnx #3231) and must be verified before committing. This is a **founder decision** (see §7, Decision-1). ❌ for Whisper; ⚠️ pending for Moonshine.

**A hard consequence to state plainly:** transcription in a pure browser gives you *text*, not a *clinical note*. Turning a raw transcript into the structured, signed note that mockup workflow 1 promises normally uses an LLM — and per §1 there is no in-browser LLM. In a zero-backend build, "structured note" degrades to **extractive/templated structuring** (entities + rule-tagged sections the clinician edits), not fluent AI narration. That is honest and arguably *better* for a "draft-until-sign" clinical tool, but it is not what "AI scribe" buyers expect.

### A2. "OpenMed" semantic extraction / PHI de-identification — **WORKS IN BROWSER, BUT THE PREMISE IS WRONG**

This is the finding I most want the founder to read. **"OpenMed" is two different things, and the brief conflates them:**

1. **OpenMed-NER-\*** — the flagship, the arxiv paper (2508.01630), the "SOTA on biomedical benchmarks" family. It is **biomedical entity recognition**: diseases, drugs/chemicals, genes, anatomy, species. It is **English-only** (stated limitation) and it **does not do PHI de-identification at all.** Diseases-and-drugs ≠ names-and-dates.
2. **OpenMed-PII-\* / `privacy-filter-multilingual`** — a *separate, newer* sub-family that *does* do PHI/PII de-id (54 categories: names, DOB, addresses, MRN, phone, email…), and *is* multilingual (16 languages incl. **Arabic and Hindi**). Publisher Maziyar Panahi (CNRS); **Apache-2.0 confirmed**.

So the handoff's claim — *"OpenMed … masks/tokenizes; Arabic + 11 other langs"* — is **true only of the PII sub-family, not the headline biomedical NER.** If someone wires up the famous OpenMed-NER model expecting de-identification, they will get a disease/drug tagger that redacts nothing and speaks only English.

**Browser-runnability (good news):** token-classification BERT/DeBERTa converts to ONNX and runs in transformers.js. **Community ONNX builds already exist**, including `OpenMed-PII-SuperClinical-Small-44M-v1-ONNX` and INT8 variants — browser-viable sizes. My own NER spike (bert-base-NER, 104 MB, **74 ms/paragraph**) proves the class works fast in-browser. **Verdict: works in browser.** ✅ *Caveat:* prefer a DistilBERT/BERT-base checkpoint over DeBERTa-v3 — DeBERTa-v3's SentencePiece tokenizer + disentangled attention is the trickiest architecture for transformers.js; test the tokenizer path early.

**But two accuracy caveats that are product-critical:**
- **Domain mismatch.** These models are trained on hospital/clinical/synthetic text (Nemotron-PII synthetic data for the PII family; PubMed/discharge notes for biomedical). **None are trained or validated on counseling/psychotherapy transcripts** — conversational, first-person, "my sister Dana", "back in March when my ex…". Real-world recall on messy conversational PHI is **unverified and is a known-hard problem.** OpenMed's own card says use it as *one stage in a pipeline with deterministic rules + human review* — take that literally.
- **De-id you can't fully trust is dangerous**, because it invites the therapist to relax. For a mental-health tool, a **missed** name is a confidentiality breach. Treat automated de-id as *assistive redaction the clinician confirms*, never as a silent guarantee — which fits the product's existing "draft until sign" invariant.

**Alternatives worth benchmarking against OpenMed-PII:** `obi/deid_roberta_i2b2` and `StanfordAIMI/stanford-deidentifier-base` have *real* clinical-de-id validation (i2b2), but are English-focused and larger. For Arabic PHI de-id specifically, expect to do your own labeled validation pass — no off-the-shelf model advertises safe-harbor-grade Arabic conversational recall.

### A3. Longitudinal analysis (deterministic) — **WORKS IN BROWSER (this is the easy, strong part)**

The original idea PDF is explicit and the founder's instruction reinforces it: **no black-box model.** The analysis is:
- **Instrument thresholds** — PHQ-9 item-9 > 0, PHQ-9 total ≥ 20 or single-visit jump ≥ 5, GAD-7 ≥ 15, DASS-21 severe band.
- **Trajectory** — instrument worsening across ≥ 2 consecutive visits beyond a configured delta.
- **Lexical** — curated, clinician-reviewed multilingual phrase lists for SI/self-harm/abuse; *transparent* matching ("you can see why it fired"), not a classifier.
- **Engagement** — missed follow-ups × any worsening signal.
- **Reporting** — per-caseload rollups ("of 80 students: 20% academic, 30% followed through, 10% risk-flagged"), filtering, PHQ-9-trend-over-time charts, per-student summaries.

This is **arithmetic and string-matching over local structured records, plus charts.** It is exactly what a browser does best, needs zero ML, is fully auditable/versionable, and is the product's actual whitespace (workflow 3). **Verdict: works in browser, on every device including iPhone.** ✅ The only real work is data-model discipline (clinical vs naturalistic never merged; signed-only counts in scores) — a spec concern, not a feasibility one.

---

## 3. Section B — Options where the browser doesn't fully deliver, and my recommendation

Two gaps: **(1) Arabic transcription quality**, and **(2) the missing LLM for fluent note narration**. iOS persistence is a storage problem, handled in §5 (answer: PWA).

| Option | What it buys | Cost against the privacy invariant | Verdict |
|---|---|---|---|
| **Installable PWA, on-device only** (base/Moonshine models, extractive notes) | Keeps invariant 2 fully intact; generous cached storage; survives iOS 7-day eviction | None — data never leaves device | **Recommended baseline.** Not "any browser tab", but "any browser, installed." Honest and still browser-delivered. |
| **Smaller/better-fit model** (Moonshine Tiny Arabic 27M instead of Whisper) | Arabic WER ~21% at tiny size, iPhone-friendly | None | **Recommended for Arabic** — *pending* verification of its web/ONNX build (Decision-1). |
| **Drop Arabic from V1**, ship English/European transcription only; Arabic sessions get manual/typed notes + de-id + longitudinal | Ships something honest now; de-risks the hardest leg | None | **Recommended fallback if Moonshine doesn't pan out.** The first client is bilingual (the pilot client is English-medium); English transcription + Arabic *analysis* may be enough for the pilot. |
| **Small native/Electron companion** for heavy model work (large Whisper, bigger de-id, even a small local LLM) | Real note narration; better Arabic; no cloud | Keeps data local, but **breaks "any browser"** — it's an install, per-OS packaging, updates | Fallback if browser ASR quality is a dealbreaker. Contradicts the stated browser-first requirement; flag to founder. |
| **Bring-your-own-key cloud model** (therapist pastes an OpenAI/Anthropic key for note narration / hard Arabic) | Best quality, trivially | **Breaks invariant 2 — audio/transcript leaves the device to a US API.** Also breaks the old in-region rule. | **Only as an explicit, off-by-default, clearly-labelled "you are sending data to X" toggle.** Never the default. Say so loudly. |

**My recommendation:** **Installable PWA, on-device only, extractive/templated notes, Moonshine-Tiny for Arabic (verify first) with English-Whisper-base as the proven path and "type the note yourself" as the always-available floor.** Keep a bring-your-own-key cloud toggle designed but *dark* for V1. This preserves the privacy invariant, ships on the timeline, and is honest about what on-device buys.

---

## 4. Section C — Encryption & portability design (the heart of the promise)

Treated as a real security design. All parameters below are concrete and sourced.

### 4.1 Key derivation
- **WebCrypto SubtleCrypto supports PBKDF2 but NOT Argon2/scrypt** (MDN `deriveKey`). Node's WebCrypto is adding Argon2, but that's Node-only — irrelevant in the browser.
- **Use Argon2id via WASM** (`hash-wasm`, or the more-recently-maintained `@openpgpjs/argon2id`). It is memory-hard and far more GPU/ASIC-resistant than PBKDF2 — and **the entire threat model here is offline brute-force of an exported file**, so this matters enormously.
- **Baseline params (OWASP, live cheat sheet):** Argon2id `m=19 MiB, t=2, p=1` (tune up to 46–64 MiB on desktop; keep memory modest on low-end mobile). Store params + a ≥16-byte random salt in the file header so they're portable and tunable.
- **Fallback:** PBKDF2-HMAC-SHA256 at **≥ 600,000 iterations** (OWASP current) only where you want zero WASM dependency — much weaker deterrent, use reluctantly.
- *Maintenance note:* `hash-wasm` latest is v4.12.0 (Nov 2024) — mature/stable but not recently updated; `@openpgpjs/argon2id` (RFC 9106) is the fresher option.

### 4.2 AEAD + key architecture — envelope pattern (strongly recommended)
1. Generate one random 256-bit **Data Encryption Key (DEK)** per vault.
2. Encrypt all patient data under the DEK with an AEAD.
3. Derive a **Key-Encryption Key (KEK)** from the password via Argon2id; **wrap (encrypt) the DEK** with it.
4. Store `salt · KDF-params · wrapped-DEK · nonce(s) · ciphertext · tag`.

Changing the password only re-wraps the small DEK (no re-encrypting everything), and this is the foundation for recovery keys (§4.4).

**AEAD choice:** **AES-256-GCM (native WebCrypto) is fine** *if* you generate a fresh random 96-bit IV per operation and never reuse it — a single-user local vault is nowhere near GCM's ~2³²-message safety ceiling (Neil Madden, NIST). If you want to erase all nonce-reuse reasoning (many per-record encryptions over years), use **XChaCha20-Poly1305 via libsodium.js** (192-bit nonce, random-nonce-safe) at the cost of a WASM dependency. Both are sound; I lean **AES-GCM native** for simplicity + zero dependency, with per-record fresh IVs.

### 4.3 Where the encrypted store lives, and eviction risk

| Store | Support incl. iOS 2026 | Size | Eviction risk |
|---|---|---|---|
| **IndexedDB** | Universal | Chrome up to ~60% disk; Firefox min(10% disk, 10 GiB); Safari ~1 GB then prompts | **Evictable** unless persisted |
| **OPFS** | Chrome/Firefox/**Safari all ship it** | shared origin quota | Same as IndexedDB |
| **File System Access API** (real disk pickers) | **Chromium-only — NOT Safari, NOT Firefox** | user's real disk, no quota | **Not browser-evictable** |

**The two eviction hazards to design around:**
- **Best-effort eviction under storage pressure** — browsers evict non-persistent origins LRU-first, which *can delete your vault*. Mitigation: always call **`navigator.storage.persist()`** and check the result. Firefox prompts; Chrome/Safari auto-decide on engagement (installed PWA, bookmarks, interaction).
- **Safari/iOS 7-day cap (verified still in force, WebKit ITP):** all script-writable storage (IndexedDB, OPFS, Cache, localStorage) is deleted after **7 days of Safari use without interaction with your site.** **This is the single biggest data-loss risk on iOS** — and it is why a naked browser tab cannot be the iOS story. **Installed PWA (Add to Home Screen) is exempt** from the 7-day cap (well-documented; not re-restated by Apple for 2026 — verify empirically).

**Design rule:** treat in-browser storage as a *working cache*, and make the **exported encrypted file the source of truth** (§4.4). Ship as a **PWA**; call `persist()`; on Chromium desktop, additionally offer File System Access to keep the vault as a real file immune to eviction.

### 4.4 Export / import (email + USB portability)
- **Single self-describing file:** `magic · version · KDF-id · Argon2-params · salt · AEAD-id · wrapped-DEK · nonce(s) · ciphertext · tag`. Everything needed to decrypt *except the password* is in the file, so it opens on any of the therapist's devices. Binary, or base64 if it must survive text channels.
- **Size:** the vault is structured text + numbers (audio is deleted post-transcription, §V1). A caseload of hundreds of sessions is **well under 25 MB** — comfortably emailable (Gmail 25 MB cap) and trivially USB-portable. This is realistic precisely *because* you don't keep audio.
- **Call out the risk:** emailing PHI — even ciphertext — deposits copies on third-party mail servers indefinitely. Confidentiality holds *iff* the password is strong (§4.6). Prefer USB / direct transfer; at minimum warn the user. This is a consent/policy point, not just crypto.

### 4.5 Forgotten password — be blunt
**With true E2E encryption and no backend, a forgotten password means the data is gone. There is no reset, no escrow, no recovery by us — by design.** Mitigation, built on the envelope:
- At setup, generate a high-entropy **recovery key** (printable, e.g. `XXXX-XXXX-XXXX-…`), shown **once**.
- **Wrap the DEK twice** — once under the password-KEK, once under a recovery-key-KEK — and store both wrapped copies. **Either** unlocks the vault; a password reset re-wraps under a new password using the recovery key.
- Trade-off to state to users: the recovery key is a second credential of equal power. Generate client-side, show once, never transmit, tell them to print it and store it offline.

This is the honest maximum: we can make loss *recoverable-by-the-user*, never recoverable-by-us.

### 4.6 What an attacker with the exported file can/can't do
Assuming Argon2id + AES-GCM/XChaCha20, correctly implemented:
- **Cannot** decrypt without password or recovery key; the AEAD tag also detects tampering. No known break of the primitives.
- **The only avenue is offline brute-force / dictionary attack** against the password (and recovery key) — at full hardware speed, no rate limiting, because they hold the file.
- **The KDF is the whole defense, and it cannot save a weak password.** Argon2id makes each guess expensive; a short/common password still falls. → **Enforce a strong passphrase**, use generous Argon2 params, treat the recovery key as equally sensitive. There is no server lockout to fall back on — that safety net does not exist in this architecture, and the user must understand that.

### 4.7 What "privacy-first" does and doesn't buy — *not legal advice; get counsel*
- On-device E2E encryption is a **strong security measure, not a legal exemption.** Under GDPR it's exactly the "appropriate technical measure" Art. 32 asks for; it does **not** remove controller obligations.
- **The therapist/clinic is still the data controller** and still owes data-subject rights (access, rectification, erasure) regardless of on-device storage.
- **Real, concrete benefit:** GDPR Art. 34 — if breached data is rendered unintelligible (strong encryption), breach *notification to data subjects may not be required.* On-device-only also shrinks the breach surface dramatically.
- **UAE PDPL** (Federal Decree-Law 45/2021) treats health data as sensitive with heightened requirements and highlights encryption as a core control; several Executive Regulations were still settling through 2025 — verify current state with UAE counsel.
- **The email/USB portability feature partly reopens what on-device closed:** once the therapist emails the bundle to themselves, ciphertext copies live on Gmail's servers. Still encrypted, but no longer "never leaves the device." Worth an explicit consent line.

---

## 5. Section D — Recommended stack

Optimizing for the founder's stated preference: **quality, simplicity, robustness, long-term maintainability** over dev cost. Zero backend ⇒ **fully static site is the natural, correct fit — confirmed** (nothing here needs a server; hosting is a CDN drop).

| Layer | Choice | Why |
|---|---|---|
| **Framework** | **SvelteKit** (static adapter) or **React + Vite**. Lean SvelteKit. | Small bundle (matters when you're also shipping ML weights), first-class static build, PWA-friendly, RTL-friendly. React is the safe hire-for-it alternative. |
| **PWA** | **Vite PWA plugin / Workbox** service worker; `manifest.json`; precache app shell, runtime-cache model weights | Installability is *required* (iOS 7-day cap, §4.3), not optional. Cache the ONNX weights so they download once. |
| **Local data layer** | **IndexedDB via `Dexie.js`** for the working store; **encrypted single-file export** as source of truth | Dexie is the mature, boring, well-maintained IndexedDB wrapper. Keep the schema explicit (clinical vs naturalistic separation from the PDF spec). |
| **Crypto** | **Native WebCrypto AES-256-GCM** for AEAD + **`@openpgpjs/argon2id` (WASM)** for the KDF; envelope with DEK + recovery-key | Minimal dependencies, audited primitives, memory-hard KDF where it counts. |
| **ASR runtime** | **`@huggingface/transformers` v4**, WebGPU with WASM fallback; Whisper-base (English) + **Moonshine-Tiny (Arabic, pending verify)** | Current, maintained, handles model download/caching. whisper.cpp WASM is the alternative if you want tighter control. |
| **De-id / NER runtime** | Same transformers.js runtime; **OpenMed-PII-Small-44M ONNX** (or DistilBERT-based de-id) as *assistive* redaction + deterministic rules | Reuse one runtime. Prefer BERT/DistilBERT over DeBERTa-v3 for tokenizer sanity. Always clinician-confirmed. |
| **Longitudinal analysis** | **Plain TypeScript** over the local store — no ML | Deterministic, auditable, versioned rule set (matches invariants). |
| **Charting** | **Observable Plot** (or ECharts if you need heavier interactivity) | Plot is small, modern, declarative, great for clinical time-series; renders crisp/precise (the "never make numbers cute" tension from the brand brief). ECharts if you want zoomable dashboards. Avoid heavyweight BI libs. |
| **i18n / RTL** | Arabic RTL first-class; Lexend + IBM Plex Sans Arabic / Noto per the brand brief | Launch market is Abu Dhabi; RTL is not a nice-to-have. |
| **Build/test** | **Vite** build; **Vitest** unit; **Playwright** E2E (incl. real model-load + crypto round-trip + PWA-install paths) | Playwright can drive the actual browser model download and IndexedDB persistence — test the scary parts for real. |
| **Hosting** | **Static site on any CDN** (Cloudflare Pages / Netlify / static in-region bucket). HTTPS + strict CSP + COOP/COEP headers (needed for WASM threads/SharedArrayBuffer). | Zero backend confirmed. The only server config that matters is the cross-origin-isolation headers for threaded WASM. |

**One stack subtlety worth flagging:** threaded WASM (for faster CPU ASR) needs `SharedArrayBuffer`, which needs **COOP/COEP cross-origin-isolation headers** — trivial on a static host but easy to forget, and it interacts with loading cross-origin model weights (host them same-origin or with correct CORP).

---

## 6. Section E — Build sequence (vertical slices, each demoable to the pilot counselor)

Sizes are rough engineering effort, assuming one strong full-stack dev. The point of vertical slices is that each ends in something you can *show*.

| # | Slice | Demoable outcome | Size | Risk |
|---|---|---|---|---|
| **0** | **Encrypted local vault + PWA shell.** Argon2id envelope, DEK + recovery key, IndexedDB via Dexie, `persist()`, single-file export/import, installable PWA. | "Create a password, enter a fake patient, close the browser, reopen on another device from the exported file, unlock." | **M** | Low–med (well-trodden crypto; iOS persistence needs real-device testing). **Build first — it's the product's spine and everything else writes into it.** |
| **1** | **Deterministic longitudinal analysis + charts** over *manually-entered* structured data (PHQ-9/GAD-7/DASS scores, visits). Rule engine (thresholds/trajectory/engagement), PHQ-9 trend chart, Q-snapshot rollup, risk-changes filter. | The exact mockup screens: *"Amara K. PHQ-9 Jan–Apr"*, *"Who's due for follow-up"*, *"Q1 wellbeing snapshot"*. | **M** | **Low. This is the whitespace and the easiest to build — demo it early to win the client.** |
| **2** | **English transcription → editable structured draft.** Whisper-base in-browser (WebGPU/WASM), audio deleted post-transcription, extractive/templated note the clinician edits and signs. | "Record a mock session, watch it transcribe on-device, edit the draft, sign it — audio is gone." | **M–L** | Med (model download UX, iOS memory, "extractive not narrated" expectation-setting). |
| **3** | **On-device de-id / entity extraction** (OpenMed-PII-Small or DistilBERT de-id) as *assistive redaction* over the transcript, clinician-confirmed; feeds structured fields into slice 1's store. | "Transcript comes back with names/dates highlighted for one-tap redaction before it's saved." | **M** | Med (accuracy on counseling text unverified; must be confirm-not-trust). |
| **4** | **★ Arabic transcription** (Moonshine-Tiny or decision fallback) + RTL polish. | "Record an Arabic session; get usable Arabic text." | **L** | **HIGHEST RISK — de-risk before promising it.** Whisper-size Arabic is not good enough; Moonshine's web build is unverified. |
| **5** | Hardening: recovery-key UX, storage-pressure warnings, export hygiene, CSP/COEP, accessibility, brand polish. | Pilot-ready. | **M** | Low–med. |

**Sequencing logic:** Slice 0 and 1 are low-risk and *fully demonstrate the differentiated product* (private local vault + deterministic caseload insight) **without any ML** — that's your fastest credible demo to the pilot counselor and it de-risks the whole business case before you spend effort on the fragile ASR legs. **Slice 4 (Arabic) carries the most technical risk and should be spiked in parallel from day one** (the Moonshine web-build verification is cheap and decisive — do it before committing the slice).

**Highest-risk item overall to de-risk first:** *Arabic transcription in-browser* (Slice 4). Second: *iOS persistence + memory* (touches Slices 0 and 2 — test on a real mid-range iPhone early, not the simulator).

---

## 7. Section F — The things that will bite us (blunt list)

1. **Arabic transcription quality.** The launch market's headline language is the weakest link. Browser-size Whisper is 30–49% WER on *easy* MSA and worse on Gulf dialect — not usable for a clinical record. Moonshine-Tiny is the credible fix but its multilingual web build is unproven. **This can invalidate the "Arabic/Indic differentiator" the earlier brief sold.**
2. **iOS is the fragile leg, twice over.** (a) **Memory** — iPhones OOM/reload tabs above ~a few hundred MB single-alloc / ~1.5–3 GB total; caps you to tiny/base models. (b) **Storage** — the 7-day script-storage cap deletes the vault unless installed as a PWA. Naked-tab-on-iPhone is not a viable product; **"any browser" realistically means "any browser, installed as a PWA."** Set that expectation with the founder.
3. **"OpenMed" is misunderstood in the brief.** The famous OpenMed-NER is biomedical (disease/drug), English-only, and does **not** de-identify. Only the separate OpenMed-PII sub-family de-identifies and is multilingual. Wiring up the wrong one silently redacts nothing.
4. **Clinical NER accuracy on counseling text is unvalidated.** Every candidate is trained on hospital/synthetic data, not psychotherapy dialogue. A missed name is a confidentiality breach. De-id must be *clinician-confirmed*, never a silent guarantee — and needs a labeled validation pass on real (consented) transcripts before you can claim it works.
5. **No LLM ⇒ no fluent notes.** The pivot deletes the in-region GPU model. "AI scribe" buyers expect narrated notes; a pure browser build gives *extractive/templated* structuring. Either reframe the pitch (draft-until-sign, precision-over-fluency) or accept a bring-your-own-key cloud toggle that breaks invariant 2.
6. **Model-download UX (first-run tax).** First use downloads 70–250 MB before anything works (measured: base 73 MB / small 237 MB). On a hospital/university network or a phone on cellular, that's a rough first impression. Needs a deliberate "downloading your private engine, one time" onboarding and PWA precache.
7. **Forgotten password = irrecoverable data.** True and unavoidable. The recovery-key mitigation helps only if the user actually kept the printed key. Support-load and churn risk; be very clear in onboarding.
8. **Portability reopens the exfiltration surface.** Emailing the encrypted bundle deposits ciphertext on third-party servers. Fine if the password is strong; still a story to tell honestly and a possible clash with clinic data-handling policy.
9. **Storage eviction even on desktop.** Best-effort eviction under disk pressure can delete a non-persisted vault. `persist()` mitigates but isn't guaranteed on every browser; the exported-file-as-source-of-truth pattern is the real safety net.
10. **DeBERTa-v3 tokenizer friction** in transformers.js — pick BERT/DistilBERT-based de-id checkpoints unless you've verified the SentencePiece path.
11. **Cross-origin-isolation headers** (COOP/COEP) for threaded WASM are easy to misconfigure on a static host and will silently drop you to slow single-thread WASM.
12. **Regulatory reality.** On-device encryption is a strong posture but not an exemption; the clinic is still the controller with full data-subject-rights obligations under PDPL/GDPR. Not legal advice — get UAE counsel, especially as PDPL executive regulations settle.

---

## 8. Decisions I need from the founder (Captain's Call)

These are genuine product/architecture choices, not things I should pick unilaterally. Registered as durable decision holds per the decision-hold lifecycle.

- **Decision-1 — Arabic transcription strategy.** Whisper base/small are not accurate enough for Arabic clinical audio. Options: (a) **pilot Moonshine-Tiny-Arabic** (best on-device quality, but verify its web build first); (b) **drop Arabic transcription from V1**, ship English transcription + Arabic *analysis/typed notes*; (c) **bring-your-own-key cloud ASR** for Arabic (breaks invariant 2 — data leaves device); (d) **small native companion** for a bigger Arabic model (breaks browser-first). My lean: (a) with (b) as the shipping floor.
- **Decision-2 — "Any browser" vs "installable PWA."** The iOS 7-day storage cap and memory limits mean a naked browser tab is not a durable product on iPhone. Accept **installable PWA** as the real delivery target? My lean: **yes** — it's still browser-delivered and it's the only honest way to keep data on iPhone.
- **Decision-3 — The missing LLM / note fluency.** Pure-browser build cannot run the note-narrating LLM from the old plan. Ship **extractive/templated notes** (reframe the pitch to precision + draft-until-sign), or add an **off-by-default bring-your-own-key cloud toggle** (breaks invariant 2)? My lean: extractive for V1, cloud toggle designed-but-dark.

*(Longitudinal analysis and the encryption/portability design need no captain choice — they are settled recommendations above.)*

---

## 9. Bottom line

- **Buildable, and the differentiated core (private local vault + deterministic longitudinal caseload insight) is the *easiest* and lowest-risk part — demo it first.**
- **The privacy/encryption promise is real and designable** with standard, audited primitives (Argon2id envelope + AES-GCM + recovery key + single-file export), with the honest caveats that forgotten-password = data-gone and email-portability reopens a copy surface.
- **The ML legs are where it hurts:** Arabic transcription at browser sizes is not good enough (Moonshine is the bet), iPhone forces small models + PWA install, "OpenMed" needs the PII sub-family not the famous biomedical one, and de-id on counseling text is unvalidated. None of these are fatal; all need explicit expectation-setting.
- **The pivot's real price** is the deletion of the in-region-GPU LLM, i.e. fluent AI note narration. Reframe around extractive, clinician-signed precision — which arguably suits a skeptical clinical buyer better than a black box.

*No code was written into the `aira` project. Spikes live only in the disposable scratch worktree; their measured numbers are captured above.*
