import { Stack } from 'expo-router';
import React from 'react';

/** Welcome flow: onboarding (2) → create account → one-time recovery code → login. */
export default function WelcomeLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />;
}
