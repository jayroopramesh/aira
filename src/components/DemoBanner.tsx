/**
 * DemoBanner — a calm, honest, dismissible indication of pilot-mode processing.
 *
 * The app's trust copy says a lot about on-device processing. In demo mode, transcription and
 * summarization run OFF-DEVICE, and accounts are created off-device too — so we say so plainly,
 * once, without alarm. Copy stays vendor/tech-free on purpose: the pilot's brief + consent form
 * carry which services are involved. When no keys are configured, the same slot honestly reports
 * that off-device services are OFF and the app is running on-device only (so nothing overclaims
 * either way).
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

  const cloudBits = [hasGroq ? 'transcription + summarization' : null, hasSupabase ? 'accounts' : null].filter(Boolean);

  const configured = demoServicesConfigured;
  const message = configured
    ? `Pilot mode · ${cloudBits.join(' and ')} are processed securely off this device. ${
        hasGroq
          ? 'Session audio and text leave this device for those steps.'
          : 'Transcription and summarization still run on this device.'
      } Your clinical notes stay on this device. Your pilot consent form has the details.`
    : 'Off-device services not configured · running on-device only for accounts, transcription and summarization.';

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
