import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  Text,
  TextProps,
  TextStyle,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { StringColorKey, TypeVariant } from '../theme/tokens';

/* ------------------------------------------------------------------ Text --- */

type AppTextProps = TextProps & {
  variant?: TypeVariant;
  color?: StringColorKey;
  /** Raw colour override (wins over `color`). */
  tint?: string;
  center?: boolean;
  uppercase?: boolean;
};

/** Typed text bound to the Lexend type ramp and the semantic ink roles. */
export function AppText({ variant = 'body', color = 'ink', tint, center, uppercase, style, ...rest }: AppTextProps) {
  const theme = useTheme();
  const t = theme.type[variant];
  const resolved: TextStyle = {
    fontSize: t.fontSize,
    lineHeight: t.lineHeight,
    fontFamily: t.fontFamily,
    letterSpacing: uppercase ? (t.letterSpacing ?? 0) + 0.4 : t.letterSpacing,
    color: tint ?? theme.colors[color],
    textAlign: center ? 'center' : undefined,
    textTransform: uppercase ? 'uppercase' : undefined,
  };
  return <Text style={[resolved, style]} {...rest} />;
}

/** Eyebrow / section label (11.5 · 600 · caps · ink3). */
export function Eyebrow({ children, color = 'ink3', style }: { children: React.ReactNode; color?: StringColorKey; style?: StyleProp<TextStyle> }) {
  return (
    <AppText variant="label" color={color} uppercase style={style}>
      {children}
    </AppText>
  );
}

/* ------------------------------------------------------------------ Card --- */

type CardProps = ViewProps & {
  elevation?: 'sm' | 'md' | 'lg' | 'none';
  radius?: 'sm' | 'md' | 'lg';
  padded?: boolean;
  /** Use the sunken surface instead of elevated (e.g. nested tiles). */
  tone?: 'elevated' | 'sunken' | 'surface';
};

/** The default surface. Elevation `md` is the locked default card shadow. */
export function Card({ elevation = 'md', radius = 'lg', padded = true, tone = 'elevated', style, ...rest }: CardProps) {
  const theme = useTheme();
  const base: ViewStyle = {
    backgroundColor: theme.colors[tone],
    borderRadius: theme.radii[radius],
    borderWidth: 1,
    borderColor: theme.colors.line,
    padding: padded ? theme.spacing.lg : 0,
  };
  const shadow = elevation === 'none' ? {} : theme.elevation[elevation];
  return <View style={[base, shadow, style]} {...rest} />;
}

/* ---------------------------------------------------------------- Button --- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = Omit<PressableProps, 'style'> & {
  title: string;
  variant?: ButtonVariant;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  variant = 'primary',
  leftIcon,
  rightIcon,
  loading,
  fullWidth,
  size = 'md',
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const c = theme.colors;

  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: c.brandStrong, fg: c.onBrand, border: 'transparent' },
    secondary: { bg: c.elevated, fg: c.ink, border: c.line },
    // Ghost buttons carry ~30% brand outline (locked decision — not borderless).
    ghost: { bg: 'transparent', fg: c.brand, border: withAlpha(c.brand, 0.3) },
    danger: { bg: c.riskBg, fg: c.risk, border: 'transparent' },
  };
  const p = palette[variant];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: p.bg,
          borderColor: p.border,
          borderWidth: 1,
          borderRadius: theme.radii.xs,
          paddingVertical: size === 'lg' ? 14 : 11,
          paddingHorizontal: size === 'lg' ? 22 : 16,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={p.fg} />
      ) : (
        <>
          {leftIcon}
          <AppText variant="bodyStrong" tint={p.fg} style={{ fontSize: 14 }}>
            {title}
          </AppText>
          {rightIcon}
        </>
      )}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ Chip --- */

export function Chip({
  label,
  active,
  onPress,
  leftIcon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  leftIcon?: React.ReactNode;
}) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 7,
        paddingHorizontal: 14,
        borderRadius: theme.radii.pill,
        borderWidth: 1,
        borderColor: active ? c.brandBd : c.line,
        backgroundColor: active ? c.brandBg : c.elevated,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {leftIcon}
      <AppText variant="small" tint={active ? c.brand : c.ink2} style={{ fontSize: 13 }}>
        {label}
      </AppText>
    </Pressable>
  );
}

/* ----------------------------------------------------------------- Badge --- */

export type BadgeTone = 'brand' | 'positive' | 'caution' | 'risk' | 'draft' | 'neutral';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const theme = useTheme();
  const c = theme.colors;
  const map: Record<BadgeTone, { bg: string; fg: string; border?: string }> = {
    brand: { bg: c.brandBg, fg: c.brand },
    positive: { bg: c.positiveBg, fg: c.positive },
    caution: { bg: c.cautionBg, fg: c.caution },
    risk: { bg: c.riskBg, fg: c.risk },
    draft: { bg: c.sand, fg: c.accent, border: c.sandBd },
    neutral: { bg: c.sunken, fg: c.ink2 },
  };
  const s = map[tone];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: s.bg,
        borderRadius: theme.radii.pill,
        borderWidth: s.border ? 1 : 0,
        borderColor: s.border,
        paddingVertical: 3,
        paddingHorizontal: 10,
      }}
    >
      <AppText variant="bodyStrong" tint={s.fg} style={{ fontSize: 12 }}>
        {label}
      </AppText>
    </View>
  );
}

/* --------------------------------------------------------------- RiskDot --- */

export type RiskLevel = 'clear' | 'watch' | 'elevated' | 'acute';

/** A risk marker. Colour is NEVER the sole signal — always paired with the word. */
export function RiskDot({ level, label }: { level: RiskLevel; label?: string }) {
  const theme = useTheme();
  const c = theme.colors;
  const map: Record<RiskLevel, { color: string; word: string }> = {
    clear: { color: c.positiveFill, word: 'Clear' },
    watch: { color: c.cautionFill, word: 'Watch' },
    elevated: { color: c.accentFill, word: 'Elevated' },
    acute: { color: c.riskFill, word: 'Acute · review' },
  };
  const s = map[level];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
      <AppText variant="bodyStrong" tint={level === 'acute' ? c.risk : c.ink2} style={{ fontSize: 12.5 }}>
        {label ?? s.word}
      </AppText>
    </View>
  );
}

/* ------------------------------------------------------------ Trust pill --- */

/** The on-device trust pill ("Audio stays on this device", etc). */
export function TrustPill({ label, icon }: { label: string; icon?: React.ReactNode }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        alignSelf: 'center',
        backgroundColor: c.brandBg,
        borderColor: c.brandBd,
        borderWidth: 1,
        borderRadius: theme.radii.pill,
        paddingVertical: 7,
        paddingHorizontal: 14,
      }}
    >
      {icon}
      <AppText variant="small" tint={c.brand} style={{ fontSize: 12.5 }}>
        {label}
      </AppText>
    </View>
  );
}

/* --------------------------------------------------------------- Avatar --- */

export function Avatar({ initials, size = 44, tone = 'brand' }: { initials: string; size?: number; tone?: 'brand' | 'risk' }) {
  const theme = useTheme();
  const c = theme.colors;
  const bg = tone === 'risk' ? c.riskBg : c.brandBg;
  const fg = tone === 'risk' ? c.risk : c.brand;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AppText variant="bodyStrong" tint={fg} style={{ fontSize: size * 0.34 }}>
        {initials}
      </AppText>
    </View>
  );
}

/* --------------------------------------------------------------- helpers --- */

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[{ height: 1, backgroundColor: theme.colors.lineSoft }, style]} />;
}

export function Row({ children, gap = 8, style, wrap }: { children: React.ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

/** Adds alpha to a hex colour (for the ~30% ghost outline etc). */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
