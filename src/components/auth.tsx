import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, TextInputProps, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { TopBar } from './TopBar';
import { AppText, Row } from './ui';

/**
 * Shared chrome for the pre-login "human" surfaces — the Welcome onboarding, create-account,
 * one-time recovery code, and Unlock login/wrong/decrypt screens. They all sit on the same
 * seafoam vault gradient (the one place the mascot is allowed) so they read as one family.
 *
 * Ink tokens are the fixed light-on-deep-seafoam values from the s3 design system; they are
 * intentionally the same in both themes because the gradient itself doesn't invert.
 */
export const INK = '#EAF7F3';
export const INK2 = 'rgba(234,247,243,0.78)';
export const INK3 = 'rgba(234,247,243,0.62)';
export const MINT = '#BFEAE1';
const FIELD_BORDER = 'rgba(234,247,243,0.28)';
const FIELD_BG = 'rgba(234,247,243,0.08)';
const FIELD_BG_FOCUS = 'rgba(234,247,243,0.14)';
const SUBMIT_BG = '#EAF7F3';
const SUBMIT_FG = '#0B3B34';
const ERROR_INK = '#F0C9BE';

/** The gradient + top bar + centred scroll column every auth screen shares. */
export function AuthScaffold({ children, maxWidth = 420 }: { children: React.ReactNode; maxWidth?: number }) {
  const theme = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={c.unlockGradient} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ flex: 1 }}>
      <TopBar transparent inkColor={INK} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.lg,
            paddingBottom: insets.bottom + 28,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ width: '100%', maxWidth, alignItems: 'center' }}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

/** Eyebrow greeting line (e.g. "Good morning, Dr. Okafor"). */
export function AuthHello({ children }: { children: React.ReactNode }) {
  return (
    <AppText variant="label" tint={MINT} uppercase center style={{ marginBottom: 8 }}>
      {children}
    </AppText>
  );
}

/** The large title used across the auth surfaces. */
export function AuthTitle({ children }: { children: React.ReactNode }) {
  return (
    <AppText variant="display" tint={INK} center style={{ fontSize: 27, lineHeight: 32 }}>
      {children}
    </AppText>
  );
}

/** The muted supporting paragraph. */
export function AuthLede({ children }: { children: React.ReactNode }) {
  return (
    <AppText variant="body" tint={INK2} center style={{ marginTop: 12, maxWidth: 400, lineHeight: 22 }}>
      {children}
    </AppText>
  );
}

/** A labelled text field styled for the dark seafoam surface, with optional error hint. */
export function AuthField({
  label,
  error,
  hint,
  children,
  ...input
}: TextInputProps & { label: string; error?: boolean; hint?: string; children?: React.ReactNode }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ width: '100%', gap: 6 }}>
      <AppText variant="label" tint={INK2} uppercase>
        {label}
      </AppText>
      <TextInput
        // Tie the visible label to the field so screen readers announce a name (WCAG 3.3.2/4.1.2) —
        // RN doesn't infer one from the sibling AppText. Placed before the spread so a caller can still
        // override with its own accessibilityLabel.
        accessibilityLabel={label}
        placeholderTextColor="rgba(234,247,243,0.5)"
        {...input}
        onFocus={(e) => {
          setFocused(true);
          input.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          input.onBlur?.(e);
        }}
        style={{
          height: 46,
          borderRadius: 12,
          borderWidth: 1.4,
          borderColor: error ? ERROR_INK : focused ? MINT : FIELD_BORDER,
          backgroundColor: focused ? FIELD_BG_FOCUS : FIELD_BG,
          paddingHorizontal: 14,
          color: INK,
          fontSize: 15,
          fontFamily: 'Lexend_400Regular',
        }}
      />
      {children}
      {hint ? (
        <AppText variant="small" tint={error ? ERROR_INK : INK2} style={{ lineHeight: 17 }}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

/** A password field with an inline Show/Hide toggle. */
export function AuthPasswordField({
  label,
  value,
  onChangeText,
  autoComplete,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  autoComplete?: TextInputProps['autoComplete'];
}) {
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ width: '100%', gap: 6 }}>
      <AppText variant="label" tint={INK2} uppercase>
        {label}
      </AppText>
      <View style={{ justifyContent: 'center' }}>
        <TextInput
          // Tie the visible label to the field so screen readers announce a name (WCAG 3.3.2/4.1.2).
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={hidden}
          autoComplete={autoComplete}
          autoCapitalize="none"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            height: 46,
            borderRadius: 12,
            borderWidth: 1.4,
            borderColor: focused ? MINT : FIELD_BORDER,
            backgroundColor: focused ? FIELD_BG_FOCUS : FIELD_BG,
            paddingLeft: 14,
            paddingRight: 62,
            color: INK,
            fontSize: 15,
            fontFamily: 'Lexend_400Regular',
          }}
        />
        <Pressable
          onPress={() => setHidden((h) => !h)}
          accessibilityRole="button"
          accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          style={({ pressed }) => ({
            position: 'absolute',
            right: 8,
            paddingHorizontal: 8,
            paddingVertical: 6,
            borderRadius: 8,
            backgroundColor: pressed ? 'rgba(234,247,243,0.12)' : 'transparent',
          })}
        >
          <AppText variant="small" tint={MINT} style={{ fontSize: 12 }}>
            {hidden ? 'Show' : 'Hide'}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

/** The pale primary CTA used on every auth surface. */
export function AuthSubmit({
  title,
  onPress,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: object;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          height: 46,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: SUBMIT_BG,
          opacity: disabled ? 0.45 : pressed ? 0.9 : 1,
          width: '100%',
        },
        style,
      ]}
    >
      <AppText variant="bodyStrong" tint={SUBMIT_FG} style={{ fontSize: 15 }}>
        {title}
      </AppText>
    </Pressable>
  );
}

/** A quiet underlined text link on the auth surface. */
export function AuthLink({ label, onPress, tint = MINT }: { label: string; onPress: () => void; tint?: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <AppText variant="bodyStrong" tint={tint} style={{ fontSize: 13 }}>
        {label}
      </AppText>
    </Pressable>
  );
}

/**
 * Endowed-progress bar for the account-setup flow (round-5 item 2). Pre-filled 20% on the very
 * first Welcome screen and advancing 20 → 45 → 72 → 100% across the four steps, so setup feels
 * already-under-way (the endowed-progress effect). Sits above the pager dots on the intros.
 */
export function AuthProgress({ percent, label }: { percent: number; label: string }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={{ width: '100%', maxWidth: 300, marginBottom: 16 }}
    >
      <View style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(234,247,243,0.16)', overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${percent}%`, borderRadius: 3, backgroundColor: MINT }} />
      </View>
      <AppText variant="label" tint={INK2} uppercase style={{ marginTop: 7, fontSize: 10.5, letterSpacing: 0.5 }}>
        {label}
      </AppText>
    </View>
  );
}

/** The onboarding pager dots (2 steps). `active` is the 0-based current step. */
export function PagerDots({ count, active }: { count: number; active: number }) {
  return (
    <Row gap={8} style={{ justifyContent: 'center', marginBottom: 20 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: i === active ? 20 : 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: i === active ? INK : 'rgba(234,247,243,0.34)',
          }}
        />
      ))}
    </Row>
  );
}

/** The standing "Stored on this device · unlocked with your login" vault line. */
export function VaultLine({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <Row gap={8} style={{ marginTop: 22, justifyContent: 'center' }}>
      {icon}
      <AppText variant="small" tint={INK2} center style={{ fontSize: 12 }}>
        {children}
      </AppText>
    </Row>
  );
}
