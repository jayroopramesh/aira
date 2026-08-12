import { Lexend_400Regular, Lexend_500Medium, Lexend_600SemiBold, Lexend_700Bold, useFonts } from '@expo-google-fonts/lexend';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EscalateProvider } from '../components/Escalate';
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
  const [loaded] = useFonts({
    Lexend_400Regular,
    Lexend_500Medium,
    Lexend_600SemiBold,
    Lexend_700Bold,
  });

  // Fonts are the type ramp's backbone; hold render until they resolve.
  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {/* Escalate is a standing affordance on every screen, including the locked vault. */}
        <EscalateProvider>
          <RootStack />
        </EscalateProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
