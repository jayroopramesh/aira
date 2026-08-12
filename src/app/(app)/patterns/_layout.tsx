import { Stack } from 'expo-router';
import React from 'react';
import { useTheme } from '../../../theme/ThemeProvider';

export default function PatternsLayout() {
  const theme = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.surface }, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[clientId]" />
      <Stack.Screen name="history" />
    </Stack>
  );
}
