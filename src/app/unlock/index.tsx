import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { authService } from '../../services/auth';
import { AppText, Row } from '../../components/ui';
import { recoveryStrings as R } from '../../strings/recovery';

type Phase = 'login' | 'wrong' | 'decrypting';

const HOME = '/(app)/today';

/**
 * Where to land after a successful unlock. A caller inside the app can hand us a `next` route (the
 * capture screen does this when cloud transcription needs a real session), but only an in-app route
 * is honoured — a deep link must never be able to bounce the counselor to an arbitrary destination.
 */
function safeNext(next?: string): string {
  if (!next) return HOME;
  const decoded = (() => {
    try {
      return decodeURIComponent(next);
    } catch {
      return '';
    }
  })();
  return decoded.startsWith('/(app)/') ? decoded : HOME;
}

/**
 * Unlock — username + password (round-2 change #1, replacing the passcode keypad). A calm
 * wrong-password state (nothing is locked out) exposes an inline recovery-code fallback, and
 * a brief transition opens the vault. "Stored on this device · unlocked with your login"
 * throughout — the vault is not encrypted today, so the copy claims only what's true.
 */
export default function UnlockScreen() {
  const router = useRouter();
  const { next, email, notice } = useLocalSearchParams<{ next?: string; email?: string; notice?: string }>();
  const [phase, setPhase] = useState<Phase>('login');
  // A returning counselor who tapped "Create account" for an existing email is bounced here with a
  // calm notice (and their email), rather than having their saved recovery code silently overwritten.
  const accountExists = notice === 'account-exists';
  const prefillEmail = typeof email === 'string' ? email : '';
  // Prefill the email the caller handed us (the account they tried to re-create), else ONLY the
  // account's own (persisted) email — never a demo identity, and never a password, so a returning user
  // is never handed someone else's credentials (F17). knownEmail is persisted at account creation /
  // sign-in and hydrated on boot, so it's the real user's email after a reload.
  const [username, setUsername] = useState(() => prefillEmail || authService.getKnownEmail() || '');
  const [password, setPassword] = useState('');
  // Hydration from the device store is async, so the first render can precede it; once it resolves,
  // land the persisted email (only if the field is still empty) and the clinician's name. The name
  // must live in STATE, not be read from the service during render — this build runs the React
  // Compiler, which memoizes a bare `authService.getClinicianName()` render read on its (empty)
  // deps forever, so the greeting stayed "Doctor" in the compiled bundle while jest passed (same
  // trap as the audio-vault card; see CLAUDE.md).
  const [clinicianName, setClinicianName] = useState(() => authService.getClinicianName());
  useEffect(() => {
    let alive = true;
    authService.whenHydrated().then(() => {
      if (!alive) return;
      setClinicianName(authService.getClinicianName());
      const known = authService.getKnownEmail();
      if (known) setUsername((prev) => prev || known);
    });
    return () => {
      alive = false;
    };
  }, []);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryError, setRecoveryError] = useState(false);

  // Whether the sign-in that just succeeded actually reached a server — observed from the auth
  // service, never assumed, so the transition screen's copy can't claim a hop that didn't happen.
  const [reachedServer, setReachedServer] = useState(false);

  const goDecrypt = useCallback(
    (dest: string, viaServer: boolean) => {
      setReachedServer(viaServer);
      setPhase('decrypting');
      setTimeout(() => router.replace(dest as Parameters<typeof router.replace>[0]), 1500);
    },
    [router],
  );

  const signIn = useCallback(async () => {
    const res = await authService.signIn(username, password);
    if (res.ok) goDecrypt(safeNext(next), res.reachedServer === true);
    else setPhase('wrong');
  }, [username, password, next, goDecrypt]);

  // Recovery-code unlock opens the local vault but mints NO Supabase session, so it deliberately
  // ignores `next`: sending the counselor back to a screen that needs a cloud session would just
  // reproduce the failure they came here to fix.
  const unlockWithRecovery = useCallback(async () => {
    const res = await authService.signInWithRecoveryCode(recoveryCode);
    if (res.ok) goDecrypt(HOME, res.reachedServer === true);
    else setRecoveryError(true);
  }, [recoveryCode, goDecrypt]);

  if (phase === 'decrypting') return <Decrypting reachedServer={reachedServer} />;

  const wrong = phase === 'wrong';

  return (
    <AuthScaffold>
      <MascotMood mood={wrong ? 'empathetic' : 'encouraging'} size={124} float />
      <View style={{ height: 16 }} />
      <AuthHello>{wrong ? R.wrongEyebrow : R.loginEyebrow(clinicianName ?? 'Doctor')}</AuthHello>
      <AuthTitle>{wrong ? R.wrongTitle : R.loginTitle}</AuthTitle>
      <AuthLede>{wrong ? R.wrongSubtitle : R.loginSubtitle}</AuthLede>

      {accountExists && !wrong ? (
        <View
          style={{
            width: '100%',
            maxWidth: 320,
            marginTop: 18,
            padding: 12,
            borderRadius: 12,
            backgroundColor: 'rgba(191,234,225,0.10)',
            borderWidth: 1,
            borderColor: 'rgba(191,234,225,0.30)',
          }}
        >
          <Row gap={8} style={{ alignItems: 'flex-start' }}>
            <View style={{ marginTop: 1 }}>
              <ShieldIcon size={14} color={MINT} />
            </View>
            <AppText variant="small" tint="rgba(234,247,243,0.9)" style={{ flex: 1, lineHeight: 18 }}>
              {R.accountExistsNotice}
            </AppText>
          </Row>
        </View>
      ) : null}

      <View style={{ width: '100%', maxWidth: 300, gap: 14, marginTop: 26 }}>
        <AuthField
          label={R.usernameLabel}
          value={username}
          onChangeText={setUsername}
          placeholder="you@clinic.ae"
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
          <View style={{ height: 16 }} />
          <AuthLink
            label={R.backToSignInLink}
            onPress={() => {
              setPhase('login');
              setRecoveryOpen(false);
              setRecoveryCode('');
              setRecoveryError(false);
              setPassword('');
            }}
          />
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

function Decrypting({ reachedServer }: { reachedServer: boolean }) {
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
      <AuthLede>{reachedServer ? R.decryptingSubtitleServer : R.decryptingSubtitleLocal}</AuthLede>

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
