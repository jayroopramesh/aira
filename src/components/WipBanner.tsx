/**
 * WipBanner — a standing, non-dismissible strip on EVERY screen (pre-auth and app alike), for the
 * invite-only beta at airavacare.com. Purely expectation-setting: this is a therapist documentation
 * app with crisis-escalation features, and a tester must never mistake the preview for a live
 * medical service, nor enter real patient data. Mounted once at the root layout — see `_layout.tsx`
 * — so every route gets it without per-screen copies.
 *
 * Caution tone (never risk/alarm-red — that tone is reserved for the Escalate sheet's crisis tier)
 * and non-dismissible: unlike `DemoBanner`, this is a standing safety notice, not a one-time note.
 */
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { AlertTriangleIcon } from './icons';
import { AppText } from './ui';

export function WipBanner() {
  const theme = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        backgroundColor: c.cautionBg,
        borderBottomWidth: 1,
        borderBottomColor: c.caution,
        paddingTop: insets.top,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: 6,
          paddingVertical: 6,
          paddingHorizontal: theme.spacing.sm,
        }}
      >
        <AlertTriangleIcon size={13} color={c.caution} />
        <AppText variant="small" tint={c.caution} center style={{ fontSize: 11.5, lineHeight: 15 }}>
          Preview — not a live medical service. Test with fictional client data only.
        </AppText>
      </View>
    </View>
  );
}
