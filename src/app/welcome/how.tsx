import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { AuthHello, AuthLink, AuthProgress, AuthScaffold, AuthSubmit, AuthTitle, INK, INK2, MINT, PagerDots } from '../../components/auth';
import { MascotMood } from '../../components/mascotMoods';
import { ShieldIcon } from '../../components/icons';
import { AppText, Row } from '../../components/ui';
import { recoveryStrings as R } from '../../strings/recovery';

/** Welcome step 2 — what Aira does: the loop in three beats + the privacy close. */
export default function WelcomeHow() {
  const router = useRouter();
  return (
    <AuthScaffold maxWidth={460}>
      <MascotMood mood="encouraging" size={92} />
      <View style={{ height: 14 }} />
      <AuthProgress percent={45} label="Setup · 45%" />
      <PagerDots count={2} active={1} />
      <AuthHello>{R.onboard2Eyebrow}</AuthHello>
      <AuthTitle>{R.onboard2Title}</AuthTitle>

      <View style={{ width: '100%', gap: 10, marginTop: 22 }}>
        {R.onboard2Beats.map((beat, i) => (
          <Row
            key={beat.title}
            gap={12}
            style={{
              alignItems: 'flex-start',
              padding: 13,
              borderRadius: 14,
              // Round-5 item 1: all three step boxes share ONE lighter seafoam green.
              backgroundColor: 'rgba(127,206,192,0.12)',
              borderWidth: 1,
              borderColor: 'rgba(127,206,192,0.28)',
            }}
          >
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: 'rgba(127,206,192,0.24)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppText variant="bodyStrong" tint="#EAFBF7" style={{ fontSize: 13 }}>
                {i + 1}
              </AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong" tint={INK} style={{ fontSize: 13.5 }}>
                {beat.title}
              </AppText>
              <AppText variant="small" tint={INK2} style={{ marginTop: 2, lineHeight: 17 }}>
                {beat.body}
              </AppText>
            </View>
          </Row>
        ))}
      </View>

      <Row
        gap={10}
        style={{
          alignItems: 'flex-start',
          marginTop: 22,
          maxWidth: 360,
          paddingHorizontal: 4,
        }}
      >
        <View style={{ marginTop: 2 }}>
          <ShieldIcon size={16} color={MINT} />
        </View>
        <AppText variant="small" tint="rgba(234,247,243,0.9)" style={{ flex: 1, lineHeight: 19 }}>
          {R.onboard2Privacy}
        </AppText>
      </Row>

      <View style={{ height: 24 }} />
      <AuthSubmit title={R.onboard2Cta} onPress={() => router.push('/welcome/create')} style={{ maxWidth: 300 }} />
      <View style={{ height: 16 }} />
      <AuthLink label={R.onboardSkip} onPress={() => router.replace('/unlock')} tint="rgba(191,234,225,0.82)" />
    </AuthScaffold>
  );
}
