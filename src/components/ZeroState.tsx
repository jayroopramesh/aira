/**
 * ZeroState — the calm empty-state used across a blank-boot install (no clients, no sessions yet).
 * A soft mascot presence (this is a human surface, not a chart/table), a plain headline + lede, and
 * up to two actions. Stays within the existing tokens.
 */

import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { MascotMood, Mood } from './mascotMoods';
import { AppText, Button, Card } from './ui';

export function ZeroState({
  mood = 'curious',
  showMascot = true,
  title,
  body,
  primary,
  secondary,
  note,
}: {
  mood?: Mood;
  /** Human surfaces only (locked rule) — a data surface (charts/tables/risk queue) passes false. */
  showMascot?: boolean;
  title: string;
  body: string;
  primary?: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
  note?: string;
}) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <Card elevation="sm" radius="lg" style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
      {showMascot ? (
        <>
          <MascotMood mood={mood} size={92} float />
          <View style={{ height: 14 }} />
        </>
      ) : null}
      <AppText variant="h1" style={{ fontSize: 22 }} center>
        {title}
      </AppText>
      <AppText variant="body" color="ink2" center style={{ marginTop: 10, maxWidth: 460, lineHeight: 22 }}>
        {body}
      </AppText>
      {primary || secondary ? (
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
          {primary ? <Button title={primary.label} variant="primary" onPress={primary.onPress} /> : null}
          {secondary ? <Button title={secondary.label} variant="secondary" onPress={secondary.onPress} /> : null}
        </View>
      ) : null}
      {note ? (
        <AppText variant="small" color="ink3" center style={{ marginTop: 16, maxWidth: 420, fontSize: 11.5, lineHeight: 16 }}>
          {note}
        </AppText>
      ) : null}
    </Card>
  );
}
