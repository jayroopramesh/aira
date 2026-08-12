import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Keypad, PasscodeDots } from '../../components/Keypad';
import { Mascot } from '../../components/Mascot';
import { TopBar } from '../../components/TopBar';
import { ShieldIcon } from '../../components/icons';
import { AppText, Row } from '../../components/ui';
import { vaultStorage } from '../../services/storage';
import { recoveryStrings as R } from '../../strings/recovery';
import { useTheme } from '../../theme/ThemeProvider';

const CLINICIAN = 'Dr. Okafor';
const CODE_LEN = 6;

type Phase = 'entry' | 'wrong' | 'decrypting';

export default function UnlockScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<Phase>('entry');

  const ink = c.unlockInk;
  const ink2 = c.unlockInk2;

  const attempt = useCallback(
    async (finalCode: string) => {
      const res = await vaultStorage.unlock(finalCode);
      if (res.ok) {
        setPhase('decrypting');
        setTimeout(() => router.replace('/(app)/today'), 1400);
      } else {
        setPhase('wrong');
        setCode('');
      }
    },
    [router],
  );

  const onDigit = useCallback(
    (d: string) => {
      if (phase === 'decrypting') return;
      setCode((prev) => {
        if (prev.length >= CODE_LEN) return prev;
        const next = prev + d;
        if (next.length === CODE_LEN) attempt(next);
        return next;
      });
    },
    [attempt, phase],
  );

  const onBackspace = useCallback(() => setCode((p) => p.slice(0, -1)), []);
  // Biometric shortcut demo: unlock straight through (not the wrong-key sentinel).
  const onBiometric = useCallback(() => attempt('123456'), [attempt]);

  const keyBg = 'rgba(255,255,255,0.06)';
  const keyBorder = 'rgba(255,255,255,0.14)';

  return (
    <LinearGradient colors={c.unlockGradient} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ flex: 1 }}>
      <TopBar transparent inkColor={ink} />
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: insets.bottom + 20,
        }}
      >
        {phase === 'decrypting' ? (
          <View style={{ alignItems: 'center', gap: 18 }}>
            <Mascot size={132} float />
            <AppText variant="h1" tint={ink} center>
              {R.decryptingTitle}
            </AppText>
            <Row gap={10}>
              <ActivityIndicator color={ink} />
              <AppText variant="body" tint={ink2}>
                {R.decryptingSubtitle}
              </AppText>
            </Row>
          </View>
        ) : (
          <View style={{ alignItems: 'center', width: '100%', maxWidth: 420 }}>
            <Mascot size={132} float />
            <View style={{ height: 18 }} />
            <AppText variant="label" tint={ink2} uppercase center>
              {phase === 'wrong' ? R.wrongKeyEyebrow : R.lockedEyebrow(CLINICIAN)}
            </AppText>
            <AppText variant="display" tint={ink} center style={{ fontSize: 30, lineHeight: 34, marginTop: 8 }}>
              {phase === 'wrong' ? R.wrongKeyTitle : R.lockedTitle}
            </AppText>
            <AppText variant="body" tint={ink2} center style={{ marginTop: 10, maxWidth: 360 }}>
              {phase === 'wrong' ? R.wrongKeySubtitle : R.lockedSubtitle}
            </AppText>

            <View style={{ height: 26 }} />
            <PasscodeDots count={CODE_LEN} filled={code.length} ink={ink} />
            {phase === 'wrong' ? (
              <AppText variant="small" tint={ink2} center style={{ marginTop: 16 }}>
                {R.wrongKeyAttempt}
              </AppText>
            ) : null}
            <View style={{ height: 22 }} />

            <Keypad onDigit={onDigit} onBackspace={onBackspace} onBiometric={onBiometric} ink={ink} keyBg={keyBg} keyBorder={keyBorder} />

            <Pressable onPress={() => router.push('/unlock/recovery')} style={({ pressed }) => ({ marginTop: 22, opacity: pressed ? 0.7 : 1 })}>
              <AppText variant="bodyStrong" tint={ink} style={{ textDecorationLine: 'underline' }}>
                {phase === 'wrong' ? R.wrongKeyRecoveryLink : R.useRecoveryLink}
              </AppText>
            </Pressable>

            {phase === 'entry' ? (
              <Row gap={8} style={{ marginTop: 20 }}>
                <ShieldIcon size={13} color={ink2} />
                <AppText variant="small" tint={ink2}>
                  {R.onDeviceSubtitle}
                </AppText>
              </Row>
            ) : null}
          </View>
        )}
      </View>
    </LinearGradient>
  );
}
