# Aira — MVP architecture

Everything the MVP touches, from the counselor's voice to the signed note. Solid boxes run today
(demo); dashed are the committed production path. Data that identifies a client never crosses the
dotted privacy line.

- 🟩 **on the counselor's device**
- 🟧 **demo cloud (free tiers)**
- ⬜ **production path (built, not live)**
- 🟦 **engineering pipeline**

```mermaid
flowchart TB
  subgraph DEVICE["📱 Counselor's device — Expo app (iOS · Android · web)"]
    UI["App UI · Expo SDK 57 + expo-router\nWelcome→login · today/prep · session · patterns\nSOAP/DAP notes · Prescriptions · Outreach\nseafoam tokens · mascot moods"]
    REC["🎙 Session capture\naudio recorded locally\ndeleted after transcription (default)"]
    VAULT["🔐 Local vault (seam)\nnotes · transcripts · prescriptions\ndemo: device storage\nprod: Argon2id-encrypted, key from login"]
    PAT["📊 Patterns engine\nPHQ-9 / GAD-7 / MHI-5 trends\ncomputed locally"]
    UI --> REC
    REC --> VAULT
    VAULT --> PAT
  end

  subgraph DEMO["☁️ Demo services (free tiers, no client PII by design)"]
    SUPA["Supabase Auth\naccounts: email+password\ncreate-account · recovery code"]
    PROXY["Supabase Edge Function · groq-proxy\nholds GROQ_API_KEY as a server secret\nverifies the counselor's session JWT\npins models · rate-limits · rejects identifiers"]
    GROQW["Groq · whisper-large-v3\ntranscription (demo)"]
    GROQL["Groq · llama-3.3-70b\nSOAP draft generation (demo)"]
  end

  subgraph PROD["🏗 Production path — built and parked"]
    WHIS["on-device whisper.cpp small.en\nbenchmarked 12.4x realtime"]:::planned
    OMED["OpenMed de-identification\n434M NER · on-device · Apache-2.0"]:::planned
    PC["Home GPU · RTX 5070 Ti\nOllama + Caddy key gate + Tailscale\nDeepSeek-14B / MedGemma-27B Q3\nunsloth fine-tune loop"]:::planned
    AZ["Azure UAE North (OpenTofu, merged)\nContainer Apps API · Postgres\nKey Vault escrow · GPU VM (off)"]:::planned
  end

  subgraph ENG["🔧 Engineering pipeline"]
    GH["GitHub repo + Actions (OIDC)\nREADME · screenshots"]
    NM["no-mistakes validation\nreview→test→lint→docs→PR→CI"]
    TOFU["OpenTofu IaC\ntofu validate clean"]
    LAV["Prototype review loop\n8 revision rounds, captain-driven"]
  end

  UI -- "sign in / sign up" --> SUPA
  REC -- "audio (demo only) + session JWT" --> PROXY
  PROXY -- "audio + server-side Groq key" --> GROQW
  GROQW -- transcript --> PROXY
  PROXY -- "transcript text + server-side Groq key" --> GROQL
  GROQL -- "SOAP draft" --> PROXY
  PROXY -- "SOAP draft → counselor signs" --> VAULT
  REC -. "prod: audio never leaves" .-> WHIS
  WHIS -. transcript .-> OMED
  OMED -. "de-identified text only" .-> PC
  PC -. "SOAP draft" .-> VAULT
  SUPA -. "prod: accounts+escrow move in-region" .-> AZ
  NM --> GH
  TOFU --> AZ
  LAV --> NM

  classDef planned stroke-dasharray:6 4,stroke:#586C66,fill:#ffffff;
  style DEVICE fill:#D2ECE6,stroke:#0F6E60,stroke-width:2px
  style DEMO fill:#FBEEE3,stroke:#B0472A,stroke-width:2px
  style PROD fill:#ffffff,stroke:#586C66,stroke-dasharray:6 4
  style ENG fill:#EAF7F3,stroke:#45B4A3,stroke-width:2px
```

**The one rule the diagram encodes:** identity lives with Supabase (and later Azure UAE), thinking
happens wherever the model runs (Groq today, your GPU or Azure tomorrow), but **what the client
said and what the counselor signed exists only on the device**. Demo mode's honest exceptions are the
two Groq hops the diagram shows — the audio to transcribe, then the transcript text to draft from —
and neither one talks to Groq directly: both go through the `groq-proxy` Edge Function, which holds
the Groq key server-side and only serves a signed-in counselor. Both hops are temporary and labeled
in-app on the note itself, and they disappear as transcription moves on-device and drafting moves to
the parked production path.
