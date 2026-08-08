# Aira documentation

Everything an incoming engineer or agent needs to understand *why* Aira is built the way it is. The
short version lives in the repository [`README.md`](../README.md) and the caveats live in
[`AGENTS.md`](../AGENTS.md); this folder is the long version behind both.

Read in this order: the **decisions** tell you what is settled, and the **reports** tell you why.
When a decision and a report disagree, the decision wins — it is the captain's later answer.

## Decision records — read these first

The settled answers, with reasoning. These are what stop questions being re-litigated. If you are
about to make a product or architecture choice, check here before you assume.

| Decision | What it settles |
|---|---|
| [Delivery target](decisions/aira-delivery-target.md) | Installable web app (PWA), not a native store app and not a naked tab. On iPhone, installing is required. |
| [Storage model](decisions/aira-storage-model.md) | The vault is a real file in a user-owned folder, behind one storage-adapter interface. Binding engineering constraint. |
| [Note fluency](decisions/aira-note-fluency.md) | Structured extraction for V1, **no AI narration**. A later self-hosted server may enrich notes; never the default, never raw transcripts. |
| [Arabic transcription strategy](decisions/aira-arabic-transcription-strategy.md) | English first, Arabic later. V1 does not promise Arabic speech-to-text. |
| [Multilingual roadmap](decisions/aira-multiling-roadmap.md) | English UI ships in V1; Arabic + RTL is the next market. Build i18n and logical CSS from day one. |
| [Recovery policy](decisions/aira-recovery-policy.md) | Recovery file plus a printable copy. No emailed reset code — that would need a server holding key material. Lost both = data gone. |
| [Ground warmth](decisions/aira-ground-warmth.md) | Canvas is cool seafoam off-white. Iterable — keep `--surface` a one-token change. |
| [Mascot dosage](decisions/aira-mascot-dosage.md) | The seafoam elephant is present on human surfaces, banned from data-dense clinical ones. |
| [Risk red exception](decisions/aira-risk-red-exception.md) | The acute suicidal-ideation flag gets muted maroon + a warning glyph + a text label. Colour is never the only signal. |

## Research reports — the reasoning

Longer scout reports. Read the feasibility report before you write any claim about what V1 can do.

| Report | Read it when |
|---|---|
| [Feasibility & stack](reports/feasibility-stack.md) | **Before promising any capability.** What the fully-local browser architecture can and cannot do, measured; the stack recommendation; the build sequence; and the OpenMed de-identification trap. |
| [Market & competitive](reports/market-competitive.md) | Positioning, the competitive map, the UAE regulatory context, and where privacy actually wins or loses a deal. |
| [Design direction](reports/design-direction.md) | Building any UI. The token set, typography, the soft-shell/sober-numbers rule, and the local-first screens. |
| [Competitor site study](reports/competitor-site-study.md) | Reviewing how competitors present themselves — messaging, onboarding, and trust cues. |

## Assets

[`assets/`](assets/) holds the mascot art and the early wireframe screenshots used in the
repository README. The wireframes are **early, near-greyscale, and still pending the captain's
review** — not an approved design.
