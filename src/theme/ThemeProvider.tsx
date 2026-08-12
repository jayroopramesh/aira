import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import {
  ColorTokens,
  darkColors,
  darkElevation,
  Elevation,
  lightColors,
  lightElevation,
  motion,
  radii,
  spacing,
  typeRamp,
  TypeStyle,
  TypeVariant,
} from './tokens';

export type ColorMode = 'light' | 'dark';
/** User preference: follow the system, or force a mode (the manual override). */
export type ThemePreference = 'system' | 'light' | 'dark';

export type Theme = {
  mode: ColorMode;
  colors: ColorTokens;
  elevation: Record<'sm' | 'md' | 'lg', Elevation>;
  radii: typeof radii;
  spacing: typeof spacing;
  motion: typeof motion;
  type: Record<TypeVariant, TypeStyle>;
};

type ThemeContextValue = {
  theme: Theme;
  preference: ThemePreference;
  /** Cycle / set the manual override. `system` re-follows the OS setting. */
  setPreference: (p: ThemePreference) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function buildTheme(mode: ColorMode): Theme {
  return {
    mode,
    colors: mode === 'dark' ? darkColors : lightColors,
    elevation: mode === 'dark' ? darkElevation : lightElevation,
    radii,
    spacing,
    motion,
    type: typeRamp,
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');

  const mode: ColorMode = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<ThemeContextValue>(() => {
    const theme = buildTheme(mode);
    return {
      theme,
      preference,
      setPreference,
      // Toggle flips the *effective* mode and pins it as a manual override.
      toggle: () => setPreference(mode === 'dark' ? 'light' : 'dark'),
    };
  }, [mode, preference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx.theme;
}

export function useThemeControls(): Pick<ThemeContextValue, 'preference' | 'setPreference' | 'toggle'> {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeControls must be used within a ThemeProvider');
  const { preference, setPreference, toggle } = ctx;
  return { preference, setPreference, toggle };
}
