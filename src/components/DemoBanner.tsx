/**
 * DemoBanner — a calm, honest, dismissible indication of demo mode.
 *
 * The app's trust copy says a lot about on-device processing. In demo mode, transcription and
 * summarization run in the CLOUD (Groq), and accounts run against Supabase — so we say so plainly,
 * once, without alarm. When no keys are configured, the same slot honestly reports that cloud
 * services are OFF and the app is running on-device mocks (so nothing overclaims either way).
 *
 * Clinical notes/transcripts/prescriptions still stay device-local behind the vault seam — that
 * line stays true in both states.
 */

import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { demoServicesConfigured, hasGroq, hasSupabase } from '../config/env';
import { useTheme } from '../theme/ThemeProvider';
import { CloseIcon, CloudIcon, InfoIcon } from './icons';
import { AppText, Row } from './ui';

export function DemoBanner() {
  const theme = useTheme();
  const c = theme.colors;
  const [open, setOpen] = useState(true);
  if (!open) return null;

  const cloudBits = [hasGroq ? 'transcription + summarization (Groq)' : null, hasSupabase ? 'accounts (Supabase)' : null].filter(
    Boolean,
  );

  const configured = demoServicesConfigured;
  const message = configured
    ? `Demo mode · ${cloudBits.join(' and ')} use cloud services. ${
        hasGroq
          ? 'Session audio text leaves this device for those steps.'
          : 'Transcription and summarization still run on-device.'
      } Your clinical notes stay on this device.`
    : 'Demo services not configured · running on-device mocks for accounts, transcription and summarization. Add keys in .env.local to use the cloud demo.';

  const tint = configured ? c.brand : c.ink2;
  const bg = configured ? c.brandBg : c.sunken;
  const border = configured ? c.brandBd : c.line;

  return (
    <View style={{ backgroundColor: c.surface, paddingHorizontal: theme.spacing.lg }}>
      <View style={{ maxWidth: 1120, width: '100%', alignSelf: 'center' }}>
        <Row
          gap={10}
          style={{
            alignItems: 'flex-start',
            backgroundColor: bg,
            borderColor: border,
            borderWidth: 1,
            borderRadius: theme.radii.sm,
            paddingVertical: 9,
            paddingHorizontal: 12,
            marginBottom: 8,
          }}
        >
          <View style={{ marginTop: 1 }}>{configured ? <CloudIcon size={15} color={tint} /> : <InfoIcon size={15} color={tint} />}</View>
          <AppText variant="small" tint={tint} style={{ flex: 1, fontSize: 11.5, lineHeight: 16 }}>
            {message}
          </AppText>
          <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Dismiss demo notice" hitSlop={8}>
            <CloseIcon size={15} color={tint} />
          </Pressable>
        </Row>
      </View>
    </View>
  );
}
