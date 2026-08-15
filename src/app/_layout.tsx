import { Lexend_400Regular, Lexend_500Medium, Lexend_600SemiBold, Lexend_700Bold, useFonts } from '@expo-google-fonts/lexend';
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
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Lexend_400Regular,
    Lexend_500Medium,
    Lexend_600SemiBold,
    Lexend_700Bold,
    // Wordmark-only display face (the `brandFont` token). Interface text stays on Lexend.
    'AtkinsonHyperlegibleMono-Medium': require('../../assets/fonts/AtkinsonHyperlegibleMono-Medium.ttf'),
  });

  // Fonts are the type ramp's backbone; hold render until they resolve — but never past a failure.
  // If any face (including the decorative wordmark one) can't load, render on the fallback glyphs:
  // a blank screen would also take the standing Escalate affordance down with it.
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
