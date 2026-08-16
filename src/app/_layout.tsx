import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EscalateProvider } from '../components/Escalate';
import { WipBanner } from '../components/WipBanner';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';

export const unstable_settings = {
  // Boot into the Welcome flow (signed out); it hands off to unlock, then the app.
  initialRouteName: 'index',
};

function RootStack() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <WipBanner />
      {/* The banner above already consumes the window's top inset (its own paddingTop), so screens
          must not pad for it again: this nested provider re-measures the safe area relative to its
          own frame — which starts below the notch — so descendants observe a ~0 top inset instead
          of the raw window one. Web is unaffected (all insets are already 0 there). */}
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.surface },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="welcome" />
          <Stack.Screen name="unlock" />
          <Stack.Screen name="(app)" />
        </Stack>
      </SafeAreaProvider>
    </View>
  );
}

export default function RootLayout() {
  // Loaded as local files under assets/fonts/ (vendored from @expo-google-fonts/lexend, OFL-1.1 —
  // see assets/fonts/Lexend-LICENSE.txt), NOT via the npm package's named exports. Metro's static web
  // export names an asset's dist path after its source module's path relative to the project root, so
  // requiring the fonts straight from `node_modules/@expo-google-fonts/lexend` puts them under
  // `dist/assets/node_modules/...`. Cloudflare Pages' deploy uploader silently drops any asset whose
  // path contains a `node_modules` segment (verified: the sibling wordmark asset under `assets/fonts/`
  // deploys fine; every `dist/assets/node_modules/**` file — Lexend included — 200s with the SPA
  // fallback `index.html` instead of the real file, so `document.fonts` reports those faces `error`
  // and text renders in the system fallback). Vendoring keeps every interface-font asset under
  // `assets/`, matching the wordmark face, so none of them can land under `node_modules` again.
  const [loaded, error] = useFonts({
    Lexend_400Regular: require('../../assets/fonts/Lexend_400Regular.ttf'),
    Lexend_500Medium: require('../../assets/fonts/Lexend_500Medium.ttf'),
    Lexend_600SemiBold: require('../../assets/fonts/Lexend_600SemiBold.ttf'),
    Lexend_700Bold: require('../../assets/fonts/Lexend_700Bold.ttf'),
    // Wordmark-only display face (the `brandFont` token). Interface text stays on Lexend.
    'AtkinsonHyperlegibleMono-Medium': require('../../assets/fonts/AtkinsonHyperlegibleMono-Medium.ttf'),
  });

  // Fonts are the type ramp's backbone; hold render until they resolve — but never past a failure.
  // If any face (including the decorative wordmark one) can't load, render on the fallback glyphs:
  // a blank screen would also take the standing Escalate affordance down with it. That fallback is a
  // silent visual regression (system font instead of Lexend) unless something says so loudly.
  if (error) {
    console.error('[aira] a type-ramp font failed to load — interface text is falling back to the system font:', error);
  }
  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      {/* Default web tab title — the product name. Fills expo-router's managed <title> so the
          static export renders a single "Airava" title (no empty react-helmet placeholder). */}
      <Head>
        <title>Airava</title>
      </Head>
      <ThemeProvider>
        {/* Escalate is a standing affordance on every screen, including the locked vault. */}
        <EscalateProvider>
          <RootStack />
        </EscalateProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
