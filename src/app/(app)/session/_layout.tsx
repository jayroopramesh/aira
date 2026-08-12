import { Stack } from 'expo-router';
import React from 'react';
import { useTheme } from '../../../theme/ThemeProvider';

export default function SessionLayout() {
  const theme = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.surface }, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="review" />
    </Stack>
  );
}
