import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { AuthHello, AuthLede, AuthLink, AuthScaffold, AuthSubmit, AuthTitle, INK2, MINT, PagerDots } from '../../components/auth';
import { Mascot } from '../../components/Mascot';
import { PencilIcon, ShieldIcon, TrendingIcon } from '../../components/icons';
import { AppText, Row } from '../../components/ui';
import { recoveryStrings as R } from '../../strings/recovery';

/** Welcome step 1 — what Aira is. Full mascot moment on the human seafoam surface. */
export default function WelcomeIntro() {
  const router = useRouter();
  const CHIP_ICONS = [ShieldIcon, PencilIcon, TrendingIcon];
  return (
    <AuthScaffold>
      <Mascot size={148} float />
      <View style={{ height: 14 }} />
      <PagerDots count={2} active={0} />
      <AuthHello>{R.onboard1Eyebrow}</AuthHello>
      <AuthTitle>{R.onboard1Title}</AuthTitle>
      <AuthLede>{R.onboard1Lede}</AuthLede>

      <Row gap={9} wrap style={{ justifyContent: 'center', marginTop: 22, marginBottom: 6 }}>
        {R.onboard1Chips.map((chip, i) => {
          const Icon = CHIP_ICONS[i];
          return (
            <Row
              key={chip}
              gap={7}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: 'rgba(234,247,243,0.2)',
                backgroundColor: 'rgba(234,247,243,0.06)',
              }}
            >
              <Icon size={14} color={MINT} />
              <AppText variant="small" tint={INK2} style={{ fontSize: 12.5 }}>
                {chip}
              </AppText>
            </Row>
          );
        })}
      </Row>

      <View style={{ height: 24 }} />
      <AuthSubmit title={R.onboard1Cta} onPress={() => router.push('/welcome/how')} style={{ maxWidth: 300 }} />
      <View style={{ height: 16 }} />
      <AuthLink label={R.onboardSkip} onPress={() => router.replace('/unlock')} tint="rgba(191,234,225,0.82)" />
    </AuthScaffold>
  );
}
