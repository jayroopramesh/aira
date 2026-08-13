import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  AuthField,
  AuthHello,
  AuthLede,
  AuthLink,
  AuthPasswordField,
  AuthProgress,
  AuthScaffold,
  AuthSubmit,
  AuthTitle,
  INK2,
  MINT,
} from '../../components/auth';
import { InfoIcon } from '../../components/icons';
import { authService } from '../../services/auth';
import { AppText, Row } from '../../components/ui';
import { recoveryStrings as R } from '../../strings/recovery';

/**
 * Create account — single-column form. Collects the captain-mandated identity set
 * (Emirates ID + phone + name + email + password) with a "Why do we need this?" disclosure
 * on the Emirates ID (the identity checked for the manual-recovery path). On submit the mock
 * auth service generates the one-time recovery code and hands off to the recovery screen.
 */
export default function WelcomeCreate() {
  const router = useRouter();
  const [emiratesId, setEmiratesId] = useState('784-1988-1234567-1');
  const [phone, setPhone] = useState('+971 50 123 4567');
  const [fullName, setFullName] = useState('Dr. Amina Okafor');
  const [email, setEmail] = useState('a.okafor@clinic.ae');
  const [password, setPassword] = useState('seafoam-harbor-42');
  const [confirm, setConfirm] = useState('seafoam-harbor-42');
  const [whyOpen, setWhyOpen] = useState(false);
  const [consent, setConsent] = useState(true);

  const onSubmit = async () => {
    await authService.createAccount({ emiratesId, phone, fullName, email, password });
    router.push('/welcome/recovery');
  };

  return (
    <AuthScaffold maxWidth={440}>
      <AuthProgress percent={72} label="Setup · 72%" />
      <AuthHello>{R.createEyebrow}</AuthHello>
      <AuthTitle>{R.createTitle}</AuthTitle>
      <AuthLede>{R.createLede}</AuthLede>

      <View style={{ width: '100%', gap: 14, marginTop: 26 }}>
        <AuthField
          label={R.emiratesIdLabel}
          value={emiratesId}
          onChangeText={setEmiratesId}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
        >
          <Pressable
            onPress={() => setWhyOpen((o) => !o)}
            accessibilityRole="button"
            accessibilityState={{ expanded: whyOpen }}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, marginTop: 2 })}
          >
            <Row gap={5}>
              <InfoIcon size={12} color={MINT} />
              <AppText variant="small" tint={MINT} style={{ fontSize: 11.5 }}>
                {R.emiratesIdWhyLink}
              </AppText>
            </Row>
          </Pressable>
          {whyOpen ? (
            <View
              style={{
                marginTop: 8,
                padding: 12,
                borderRadius: 10,
                backgroundColor: 'rgba(234,247,243,0.07)',
                borderWidth: 1,
                borderColor: 'rgba(234,247,243,0.12)',
              }}
            >
              <AppText variant="small" tint="rgba(234,247,243,0.85)" style={{ lineHeight: 18 }}>
                {R.emiratesIdWhy}
              </AppText>
            </View>
          ) : null}
        </AuthField>

        <AuthField label={R.phoneLabel} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <AuthField label={R.fullNameLabel} value={fullName} onChangeText={setFullName} autoCapitalize="words" />
        <AuthField
          label={R.emailLabel}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <AuthPasswordField label={R.passwordLabel} value={password} onChangeText={setPassword} autoComplete="new-password" />
        <AuthPasswordField
          label={R.confirmPasswordLabel}
          value={confirm}
          onChangeText={setConfirm}
          autoComplete="new-password"
        />

        <Pressable
          onPress={() => setConsent((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          <Row gap={10} style={{ alignItems: 'flex-start', marginTop: 2 }}>
            <View
              style={{
                width: 19,
                height: 19,
                borderRadius: 5,
                marginTop: 1,
                borderWidth: 1.6,
                borderColor: consent ? MINT : 'rgba(234,247,243,0.4)',
                backgroundColor: consent ? MINT : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {consent ? (
                <AppText variant="label" tint="#0B3B34" style={{ fontSize: 12, lineHeight: 14 }}>
                  ✓
                </AppText>
              ) : null}
            </View>
            <AppText variant="small" tint="rgba(234,247,243,0.85)" style={{ flex: 1, lineHeight: 18 }}>
              {R.consentText}
            </AppText>
          </Row>
        </Pressable>

        <View style={{ height: 2 }} />
        <AuthSubmit title={R.createCta} onPress={onSubmit} disabled={!consent} />
      </View>

      <View style={{ height: 16 }} />
      <AuthLink label={R.createSignInLink} onPress={() => router.replace('/unlock')} tint="rgba(191,234,225,0.82)" />
      <View style={{ height: 4 }} />
      <AppText variant="small" tint={INK2} center style={{ fontSize: 11, opacity: 0.7 }}>
        Details are pre-filled for this demo · nothing is sent anywhere.
      </AppText>
    </AuthScaffold>
  );
}
