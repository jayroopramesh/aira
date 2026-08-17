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
import { hasSupabase } from '../../config/env';
import { AccountExistsError, authService } from '../../services/auth';
import { AppText, Row } from '../../components/ui';
import { recoveryStrings as R } from '../../strings/recovery';
import { isValidEmiratesId } from '../../data/sessionClient';

type FieldErrors = {
  emiratesId?: string;
  phone?: string;
  fullName?: string;
  confirm?: string;
};

/**
 * Create account — single-column form. Collects the captain-mandated identity set
 * (Emirates ID + phone + name + email + password) with a "Why do we need this?" disclosure
 * on the Emirates ID (the identity checked for the manual-recovery path). On submit the mock
 * auth service generates the one-time recovery code and hands off to the recovery screen.
 */
export default function WelcomeCreate() {
  const router = useRouter();
  const [emiratesId, setEmiratesId] = useState('');
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [whyOpen, setWhyOpen] = useState(false);
  const [consent, setConsent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!emiratesId.trim()) errors.emiratesId = 'Emirates ID is required.';
    else if (!isValidEmiratesId(emiratesId)) errors.emiratesId = 'Enter a well-formed Emirates ID (784-XXXX-XXXXXXX-X).';
    if (!phone.trim()) errors.phone = 'Phone number is required.';
    if (!fullName.trim()) errors.fullName = 'Full name is required.';
    if (confirm !== password) errors.confirm = 'Passwords don’t match.';
    return errors;
  };

  const onSubmit = async () => {
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Please fix the highlighted fields before continuing.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await authService.createAccount({ emiratesId, phone, fullName, email, password });
      router.push('/welcome/recovery');
    } catch (e) {
      // Already-registered is NOT a form error to retry — the account (and the saved recovery code)
      // already exist. Send them to sign in with the email prefilled and a calm notice, rather than
      // silently minting a new code over the one they saved.
      if (e instanceof AccountExistsError) {
        router.replace(`/unlock?notice=account-exists&email=${encodeURIComponent(e.email)}`);
        return;
      }
      setError((e as Error).message || 'Could not create the account. Please check the details and try again.');
    } finally {
      setSubmitting(false);
    }
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
          required
          value={emiratesId}
          onChangeText={(v) => {
            setEmiratesId(v);
            setFieldErrors((f) => ({ ...f, emiratesId: undefined }));
          }}
          placeholder="784-XXXX-XXXXXXX-X"
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          error={!!fieldErrors.emiratesId}
          hint={fieldErrors.emiratesId}
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

        <AuthField
          label={R.phoneLabel}
          required
          value={phone}
          onChangeText={(v) => {
            setPhone(v);
            setFieldErrors((f) => ({ ...f, phone: undefined }));
          }}
          placeholder="+971 50 000 0000"
          keyboardType="phone-pad"
          error={!!fieldErrors.phone}
          hint={fieldErrors.phone}
        />
        <AuthField
          label={R.fullNameLabel}
          required
          value={fullName}
          onChangeText={(v) => {
            setFullName(v);
            setFieldErrors((f) => ({ ...f, fullName: undefined }));
          }}
          placeholder="Enter your full name…"
          autoCapitalize="words"
          error={!!fieldErrors.fullName}
          hint={fieldErrors.fullName}
        />
        <AuthField
          label={R.emailLabel}
          value={email}
          onChangeText={setEmail}
          placeholder="you@clinic.ae"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <AuthPasswordField label={R.passwordLabel} value={password} onChangeText={setPassword} autoComplete="new-password" />
        <AuthPasswordField
          label={R.confirmPasswordLabel}
          value={confirm}
          onChangeText={(v) => {
            setConfirm(v);
            setFieldErrors((f) => ({ ...f, confirm: undefined }));
          }}
          autoComplete="new-password"
          error={!!fieldErrors.confirm}
          hint={fieldErrors.confirm}
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

        {error ? (
          <AppText variant="small" tint="#F0C9BE" style={{ lineHeight: 17 }}>
            {error}
          </AppText>
        ) : null}

        <View style={{ height: 2 }} />
        <AuthSubmit title={submitting ? 'Creating account…' : R.createCta} onPress={onSubmit} disabled={!consent || submitting} />
      </View>

      <View style={{ height: 16 }} />
      <AuthLink label={R.createSignInLink} onPress={() => router.replace('/unlock')} tint="rgba(191,234,225,0.82)" />
      <View style={{ height: 4 }} />
      <AppText variant="small" tint={INK2} center style={{ fontSize: 11, opacity: 0.7 }}>
        {hasSupabase
          ? 'Your account is created in Supabase; clinical data stays on this device.'
          : 'Demo services aren’t configured, so nothing is sent anywhere.'}
      </AppText>
    </AuthScaffold>
  );
}
