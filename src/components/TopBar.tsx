import { usePathname, useGlobalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useThemeControls } from '../theme/ThemeProvider';
import { useEscalate } from './Escalate';
import { MoonIcon, SunIcon } from './icons';
import { appBarMood, MascotMood } from './mascotMoods';
import { AppText, Row } from './ui';

/**
 * The app bar. Carries the mascot + wordmark (the one place on non-human surfaces the
 * mascot is allowed), the standing Escalate pill (calm clay, never alarm-red), and the
 * theme toggle. `transparent` mode is used over the unlock gradient.
 */
export function TopBar({
  transparent = false,
  inkColor,
}: {
  transparent?: boolean;
  inkColor?: string;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const { toggle } = useThemeControls();
  const escalate = useEscalate();
  const ink = inkColor ?? c.ink;
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ risk?: string; clientId?: string }>();
  const onRisk = params?.risk === '1' || params?.clientId === 'leah';
  const mood = appBarMood(pathname, onRisk);

  return (
    <View
      style={{
        paddingTop: insets.top + 8,
        paddingBottom: 10,
        paddingHorizontal: theme.spacing.lg,
        backgroundColor: transparent ? 'transparent' : c.surface,
        borderBottomWidth: transparent ? 0 : 1,
        borderBottomColor: c.lineSoft,
      }}
    >
      <Row style={{ justifyContent: 'space-between', maxWidth: 1120, width: '100%', alignSelf: 'center' }}>
        <Row gap={9}>
          <MascotMood mood={mood} size={30} />
          <AppText variant="h2" tint={ink} style={{ fontSize: 21 }}>
            Aira
          </AppText>
        </Row>

        <Row gap={10}>
          {/* Escalate — calm clay pill, standing on every screen. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Escalate — open calm options"
            onPress={escalate.open}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: theme.radii.pill,
              backgroundColor: c.riskBg,
              borderWidth: 1,
              borderColor: transparent ? 'transparent' : c.riskBg,
              opacity: pressed ? 0.82 : 1,
            })}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.riskFill }} />
            <AppText variant="bodyStrong" tint={c.risk} style={{ fontSize: 14 }}>
              Escalate
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle light and dark theme"
            onPress={toggle}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: theme.radii.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: transparent ? 'rgba(255,255,255,0.12)' : c.elevated,
              borderWidth: 1,
              borderColor: transparent ? 'rgba(255,255,255,0.18)' : c.line,
              opacity: pressed ? 0.82 : 1,
            })}
          >
            {theme.mode === 'dark' ? <SunIcon size={19} color={ink} /> : <MoonIcon size={19} color={ink} />}
          </Pressable>
        </Row>
      </Row>
    </View>
  );
}
