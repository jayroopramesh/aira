# Decision: Second-market font/script roadmap

**Captain's answer (2026-08-08):** English first, Arabic second. "We can move to Arabic after."

**What this settles:**

- V1 ships English UI only. Lexend is the shipping UI face.
- Arabic (IBM Plex Sans Arabic) plus full RTL is the immediate next market after V1, not a V1
  requirement, but the codebase must not foreclose it.
- Devanagari / Noto Sans Devanagari stays a documented later market with no V1 obligation.

**Engineering constraint that follows:** build V1 with a real i18n layer and logical CSS
properties (`margin-inline`, `padding-inline`, `text-align: start`) from day one, so the Arabic
phase is a translation + font-loading job rather than a layout rewrite. This costs almost nothing
now and is expensive to retrofit.
