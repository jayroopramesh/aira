import React, { useEffect } from 'react';
import { AccessibilityInfo, Platform, Text, View } from 'react-native';

/**
 * Visually-hidden polite live region for screen-reader status announcements.
 *
 * The app's state transitions (recording started/paused/stopped, analysing, etc.) are otherwise
 * silent to a screen-reader user — the screen swaps content with no announcement, so a blind
 * clinician pressing "Tap to start capture" has no way to know the microphone is now live. Keep
 * one SrStatus MOUNTED for the whole life of a screen and update `message` on each transition:
 * live regions announce *changes* to an existing region, not content present at mount, so a region
 * that mounts together with the state it describes announces nothing.
 *
 * Web/Android ride the `aria-live` prop; iOS has no live-region concept, so the change is spoken
 * via `announceForAccessibility` there instead (never on web too — that would double-announce).
 */
export function SrStatus({ message }: { message: string }) {
  useEffect(() => {
    if (message && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
  return (
    <View
      aria-live="polite"
      testID="sr-status"
      style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}
    >
      {message ? <Text>{message}</Text> : null}
    </View>
  );
}
