import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { BackspaceIcon, BiometricIcon } from './icons';
import { AppText } from './ui';

/** Passcode dots. `filled` of `count` are solid; light `error` tints them calmly. */
export function PasscodeDots({ count, filled, ink }: { count: number; filled: number; ink: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 18, justifyContent: 'center' }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            borderWidth: 1.6,
            borderColor: ink,
            backgroundColor: i < filled ? ink : 'transparent',
          }}
        />
      ))}
    </View>
  );
}

type KeypadProps = {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onBiometric?: () => void;
  /** Ink colour for glyphs (light over the dark unlock gradient). */
  ink: string;
  keyBg: string;
  keyBorder: string;
};

/** The unlock keypad — digits, a biometric shortcut, and backspace. */
export function Keypad({ onDigit, onBackspace, onBiometric, ink, keyBg, keyBorder }: KeypadProps) {
  const theme = useTheme();
  const keys: (string | 'bio' | 'del')[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'];

  return (
    <View style={{ width: 300, maxWidth: '100%', alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
      {keys.map((k, i) => {
        const isDigit = k !== 'bio' && k !== 'del';
        return (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={k === 'bio' ? 'Unlock with biometrics' : k === 'del' ? 'Delete' : `Digit ${k}`}
            onPress={() => (k === 'bio' ? onBiometric?.() : k === 'del' ? onBackspace() : onDigit(k as string))}
            style={({ pressed }) => ({
              width: 90,
              height: 62,
              borderRadius: theme.radii.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: keyBg,
              borderWidth: 1,
              borderColor: keyBorder,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            {isDigit ? (
              <AppText variant="h2" tint={ink} style={{ fontSize: 22 }}>
                {k}
              </AppText>
            ) : k === 'bio' ? (
              <BiometricIcon size={24} color={ink} />
            ) : (
              <BackspaceIcon size={24} color={ink} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
