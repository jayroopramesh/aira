import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import {
  AuthField,
  AuthHello,
  AuthLede,
  AuthLink,
  AuthPasswordField,
  AuthScaffold,
  AuthSubmit,
  AuthTitle,
  INK,
  MINT,
  VaultLine,
} from '../../components/auth';
import { MascotMood } from '../../components/mascotMoods';
import { KeyIcon, LockIcon, ShieldIcon } from '../../components/icons';
import { hasSupabase } from '../../config/env';
import { authService } from '../../services/auth';
import { AppText, Row } from '../../components/ui';
import { recoveryStrings as R } from '../../strings/recovery';

type Phase = 'login' | 'wrong' | 'decrypting';

// With real accounts (Supabase), sign-in uses an email; defaults follow the create-account form so
// the guided create → recovery → login walkthrough succeeds in one pass. With no keys, the mock
// demo defaults apply.
const DEFAULT_USERNAME = hasSupabase ? 'a.okafor@clinic.ae' : 'dr.okafor';
const DEFAULT_PASSWORD = hasSupabase ? 'seafoam-harbor-42' : 'clinicvault';

/**
 * Unlock — username + password (round-2 change #1, replacing the passcode keypad). A calm
 * wrong-password state (nothing is locked out) exposes an inline recovery-code fallback, and
 * a decrypt transition opens the vault. "Encrypted with your login" throughout.
 */
export default function UnlockScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('login');
  const [username, setUsername] = useState(() => authService.getKnownEmail() ?? DEFAULT_USERNAME);
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryError, setRecoveryError] = useState(false);

  const goDecrypt = useCallback(() => {
    setPhase('decrypting');
    setTimeout(() => router.replace('/(app)/today'), 1500);
  }, [router]);

  const signIn = useCallback(async () => {
    const res = await authService.signIn(username, password);
    if (res.ok) goDecrypt();
    else setPhase('wrong');
  }, [username, password, goDecrypt]);

  const unlockWithRecovery = useCallback(async () => {
    const res = await authService.signInWithRecoveryCode(recoveryCode);
    if (res.ok) goDecrypt();
    else setRecoveryError(true);
  }, [recoveryCode, goDecrypt]);

  if (phase === 'decrypting') return <Decrypting />;

  const wrong = phase === 'wrong';

  return (
    <AuthScaffold>
      <MascotMood mood={wrong ? 'empathetic' : 'encouraging'} size={124} float />
      <View style={{ height: 16 }} />
      <AuthHello>{wrong ? R.wrongEyebrow : R.loginEyebrow(authService.getClinicianName() ?? 'Doctor')}</AuthHello>
      <AuthTitle>{wrong ? R.wrongTitle : R.loginTitle}</AuthTitle>
      <AuthLede>{wrong ? R.wrongSubtitle : R.loginSubtitle}</AuthLede>

      <View style={{ width: '100%', maxWidth: 300, gap: 14, marginTop: 26 }}>
        <AuthField
          label={R.usernameLabel}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoComplete="username"
        />
        <AuthPasswordField
          label={R.passwordLabel}
          value={password}
          onChangeText={setPassword}
          autoComplete="current-password"
        />
        {wrong ? (
          <AppText variant="small" tint="#F0C9BE" style={{ marginTop: -4, lineHeight: 17 }}>
            {R.wrongHint}
          </AppText>
        ) : null}
        <AuthSubmit title={R.signInCta} onPress={signIn} />
      </View>

      {wrong ? (
        <View style={{ width: '100%', maxWidth: 300, marginTop: 18 }}>
          {!recoveryOpen ? (
            <Pressable onPress={() => setRecoveryOpen(true)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Row gap={7}>
                <KeyIcon size={14} color={MINT} />
                <AppText variant="bodyStrong" tint={MINT} style={{ fontSize: 13 }}>
                  {R.forgotLink}
                </AppText>
              </Row>
            </Pressable>
          ) : (
            <View style={{ gap: 10 }}>
              <AuthField
                label={R.recoveryCodeLabel}
                value={recoveryCode}
                onChangeText={(v) => {
                  setRecoveryCode(v);
                  setRecoveryError(false);
                }}
                placeholder={R.recoveryCodePlaceholder}
                autoCapitalize="none"
                error={recoveryError}
                hint={recoveryError ? R.recoveryCodeError : R.recoveryCodeHint}
              />
              <AuthSubmit title={R.recoveryCodeCta} onPress={unlockWithRecovery} />
            </View>
          )}
        </View>
      ) : (
        <>
          <View style={{ height: 18 }} />
          <AuthLink label={R.demoWrongLink} onPress={() => setPhase('wrong')} />
          <View style={{ height: 14 }} />
          <AuthLink label={R.createAccountLink} onPress={() => router.push('/welcome/create')} tint="rgba(191,234,225,0.82)" />
          <VaultLine icon={<ShieldIcon size={13} color={INK} />}>{R.vaultLine}</VaultLine>
          <View style={{ height: 10 }} />
          <Row
            gap={7}
            style={{
              alignItems: 'center',
              alignSelf: 'center',
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: 'rgba(191,234,225,0.28)',
              backgroundColor: 'rgba(234,247,243,0.06)',
            }}
          >
            <LockIcon size={12} color={MINT} />
            <AppText variant="small" tint="rgba(234,247,243,0.82)" style={{ fontSize: 11.5 }}>
              {R.hipaaLine}
            </AppText>
          </Row>
        </>
      )}
    </AuthScaffold>
  );
}

/* ------------------------------------------------------------ decrypting --- */

function Decrypting() {
  // Held in state (created once) rather than a ref so the animated value can be read in render.
  const [width] = useState(() => new Animated.Value(0.08));
  useEffect(() => {
    Animated.timing(width, {
      toValue: 1,
      duration: 1400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [width]);

  return (
    <AuthScaffold>
      <MascotMood mood="breathing" size={124} float />
      <View style={{ height: 16 }} />
      <AuthHello>{R.decryptingEyebrow}</AuthHello>
      <AuthTitle>{R.decryptingTitle}</AuthTitle>
      <AuthLede>{R.decryptingSubtitle}</AuthLede>

      <View style={{ width: 220, height: 5, borderRadius: 3, backgroundColor: 'rgba(234,247,243,0.22)', marginTop: 24, overflow: 'hidden' }}>
        <Animated.View
          style={{
            height: '100%',
            borderRadius: 3,
            backgroundColor: '#BFEAE1',
            width: width.interpolate({ inputRange: [0, 1], outputRange: ['8%', '100%'] }),
          }}
        />
      </View>

      <VaultLine icon={<ShieldIcon size={13} color={INK} />}>{R.decryptingVaultLine}</VaultLine>
    </AuthScaffold>
  );
}
