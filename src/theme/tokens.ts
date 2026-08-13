/**
 * Aira design tokens — ported verbatim from the source-of-truth token system in
 * `aira-ui-s3/design-direction.html` (seafoam palette, Lexend ramp, radius 16 default,
 * elevation md default, motion fast 120ms). Light + dark.
 *
 * The palette was derived from the mascot (sampled seafoam body #70B8B0, deep outline
 * #2E7370, mint belly #B8D8D4). All colour pairings were WCAG-measured AA/AAA in the s3
 * report; consuming these exact roles on the same surfaces preserves those ratios.
 */

/** Colour-token keys whose value is a plain colour string (excludes the gradient tuple). */
export type StringColorKey = Exclude<keyof ColorTokens, 'unlockGradient'>;

/** Colour roles that differ between light and dark. */
export type ColorTokens = {
  // Surfaces
  surface: string;
  elevated: string;
  sunken: string;
  line: string;
  lineSoft: string;
  // Ink (text)
  ink: string;
  ink2: string;
  ink3: string;
  // Brand (seafoam)
  brand: string;
  brandStrong: string;
  brandBg: string;
  brandBd: string;
  // Accent (warm coral/clay)
  accent: string;
  accentFill: string;
  accentBg: string;
  accentBd: string;
  // Positive (improving)
  positive: string;
  positiveFill: string;
  positiveBg: string;
  // Caution (watch)
  caution: string;
  cautionFill: string;
  cautionBg: string;
  // Risk (clay — never alarm-red)
  risk: string;
  riskFill: string;
  riskBg: string;
  // Severity bands for clinical charts
  bandMin: string;
  bandMild: string;
  bandMod: string;
  bandModSev: string;
  bandSev: string;
  // Sand (draft chips / naturalistic surfaces)
  sand: string;
  sandBd: string;
  // On-brand ink (text placed on a solid brand fill)
  onBrand: string;
  // Full-bleed unlock gradient stops (deep seafoam wash)
  unlockGradient: readonly [string, string];
  unlockInk: string;
  unlockInk2: string;
};

export const lightColors: ColorTokens = {
  surface: '#F3F8F6',
  elevated: '#FFFFFF',
  sunken: '#E9F1EE',
  line: '#D7E5E0',
  lineSoft: '#E6EFEB',
  ink: '#122E2A',
  ink2: '#42574F',
  ink3: '#586C66',
  brand: '#0F6E60',
  brandStrong: '#0B564B',
  brandBg: '#E1F1ED',
  brandBd: '#BFE2D9',
  accent: '#B0472A',
  accentFill: '#E68A66',
  accentBg: '#FBEEE3',
  accentBd: '#F1D3C2',
  positive: '#1E6E48',
  positiveFill: '#2F8F63',
  positiveBg: '#E4F2EA',
  caution: '#8A610E',
  cautionFill: '#C79328',
  cautionBg: '#F7EED8',
  risk: '#A83F38',
  riskFill: '#C15A50',
  riskBg: '#F7E7E4',
  bandMin: '#EAF4EF',
  bandMild: '#F0F5EC',
  bandMod: '#FBF3DE',
  bandModSev: '#F9EBDD',
  bandSev: '#F7E7E4',
  sand: '#F4EDDD',
  sandBd: '#E7DBC1',
  onBrand: '#FFFFFF',
  unlockGradient: ['#0C4139', '#0B3730'],
  unlockInk: '#EAF7F3',
  unlockInk2: 'rgba(234,247,243,0.78)',
};

// Round-4 item 6: dark palette shifted turquoise-green (blue channel lifted) rather than
// fully green. Contrast recomputed — every text pairing meets AA/AAA and white-on-brandStrong
// primary buttons went from 1.70:1 (FAIL) to 4.79:1 (AA). Contrast table:
// aira-ui-screens-s4/revision-4-notes.md (prototype workspace, alongside screens.html).
export const darkColors: ColorTokens = {
  surface: '#0C1B1D',
  elevated: '#132829',
  sunken: '#081517',
  line: '#264241',
  lineSoft: '#1D3433',
  ink: '#E6F2F1',
  ink2: '#A6C1C0',
  ink3: '#849D9C',
  brand: '#48CAC4',
  brandStrong: '#118079',
  brandBg: '#0F3A38',
  brandBd: '#1E5450',
  accent: '#F0997A',
  accentFill: '#D9714E',
  accentBg: '#3A241B',
  accentBd: '#5A3223',
  positive: '#63C48F',
  positiveFill: '#2F8F63',
  positiveBg: '#123528',
  caution: '#E0B65A',
  cautionFill: '#C79328',
  cautionBg: '#3A2F12',
  risk: '#E88A80',
  riskFill: '#C15A50',
  riskBg: '#3A1E1B',
  bandMin: '#102826',
  bandMild: '#12251F',
  bandMod: '#2A2413',
  bandModSev: '#2E2018',
  bandSev: '#301A18',
  sand: '#221D14',
  sandBd: '#34291A',
  onBrand: '#FFFFFF',
  unlockGradient: ['#0A3D3A', '#04120F'],
  unlockInk: '#EAF7F3',
  unlockInk2: 'rgba(234,247,243,0.72)',
};

/** Radii — default 16, 8 xs, 22 lg, pill. (design-direction --r-*) */
export const radii = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  pill: 999,
} as const;

/** Spacing scale (4px base). */
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Motion — fast 120ms hover/press, base 180ms, slow 320ms; mascot float 5.5s. */
export const motion = {
  fast: 120,
  base: 180,
  slow: 320,
  mascotFloat: 5500,
} as const;

/**
 * Elevation presets. `md` is the default card shadow (design-direction locked decision).
 * `sm` for nested feed cards, `lg` for drawers / escalation overlays.
 * Expressed as React Native shadow props (react-native-web maps these to box-shadow).
 */
export type Elevation = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

export const lightElevation: Record<'sm' | 'md' | 'lg', Elevation> = {
  sm: { shadowColor: '#0E3C36', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 1 },
  md: { shadowColor: '#0E3C36', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 18, elevation: 4 },
  lg: { shadowColor: '#0E3C36', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.14, shadowRadius: 40, elevation: 12 },
};

export const darkElevation: Record<'sm' | 'md' | 'lg', Elevation> = {
  sm: { shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.4, shadowRadius: 2, elevation: 1 },
  md: { shadowColor: '#000000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 4 },
  lg: { shadowColor: '#000000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.6, shadowRadius: 44, elevation: 12 },
};

/**
 * Type ramp (Lexend). Each entry: fontSize / lineHeight / weight (+ tracking where locked).
 * Verbatim from design-direction §type ramp.
 */
export type TypeStyle = {
  fontSize: number;
  lineHeight: number;
  fontFamily: string; // resolves to a loaded Lexend weight
  letterSpacing?: number;
};

// Lexend family keys registered in ThemeProvider via @expo-google-fonts/lexend.
export const fontFamily = {
  regular: 'Lexend_400Regular',
  medium: 'Lexend_500Medium',
  semibold: 'Lexend_600SemiBold',
  bold: 'Lexend_700Bold',
} as const;

export const typeRamp = {
  display: { fontSize: 34, lineHeight: 38, fontFamily: fontFamily.semibold, letterSpacing: -0.85 },
  h1: { fontSize: 25, lineHeight: 30, fontFamily: fontFamily.semibold, letterSpacing: -0.5 },
  h2: { fontSize: 19, lineHeight: 25, fontFamily: fontFamily.semibold },
  body: { fontSize: 15, lineHeight: 23, fontFamily: fontFamily.regular },
  bodyStrong: { fontSize: 15, lineHeight: 23, fontFamily: fontFamily.semibold },
  small: { fontSize: 12.5, lineHeight: 18, fontFamily: fontFamily.medium },
  label: { fontSize: 11.5, lineHeight: 15, fontFamily: fontFamily.semibold, letterSpacing: 0.6 },
  numeric: { fontSize: 21, lineHeight: 22, fontFamily: fontFamily.semibold },
} satisfies Record<string, TypeStyle>;

export type TypeVariant = keyof typeof typeRamp;
