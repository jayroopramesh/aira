import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { ChevronLeft } from './icons';
import { AppText, Row } from './ui';

/**
 * Standard page scaffold: a scroll surface that centres content at a comfortable web
 * width while staying full-bleed on phones. Wide layouts (tables, three-pane) scroll
 * inside their own containers, never the page body.
 */
export function Screen({
  children,
  maxWidth = 1120,
  padded = true,
  scroll = true,
}: {
  children: React.ReactNode;
  maxWidth?: number;
  padded?: boolean;
  scroll?: boolean;
}) {
  const theme = useTheme();
  const inner = (
    <View
      style={{
        width: '100%',
        maxWidth,
        alignSelf: 'center',
        paddingHorizontal: padded ? theme.spacing.lg : 0,
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxxl,
      }}
    >
      {children}
    </View>
  );

  if (!scroll) return <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>{inner}</View>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.surface }} contentContainerStyle={{ flexGrow: 1 }}>
      {inner}
    </ScrollView>
  );
}

/** A "← Back to …" inline link used inside detail flows. */
export function BackLink({ label, onPress }: { label: string; onPress?: () => void }) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <Pressable
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/(app)/patterns')))}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, marginBottom: theme.spacing.sm })}
    >
      <Row gap={6}>
        <ChevronLeft size={18} color={theme.colors.ink3} />
        <AppText variant="bodyStrong" color="ink2">
          {label}
        </AppText>
      </Row>
    </Pressable>
  );
}

/** Page heading block: eyebrow + big title + optional subtitle. */
export function PageHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: theme.spacing.lg }}>
      {eyebrow ? (
        <AppText variant="label" color="brand" uppercase style={{ marginBottom: 6 }}>
          {eyebrow}
        </AppText>
      ) : null}
      <AppText variant="display" style={{ fontSize: 30, lineHeight: 34 }}>
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="body" color="ink2" style={{ marginTop: 8, maxWidth: 640 }}>
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}
