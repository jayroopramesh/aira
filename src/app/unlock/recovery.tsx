import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mascot } from '../../components/Mascot';
import { TopBar } from '../../components/TopBar';
import { FileUpIcon } from '../../components/icons';
import { AppText } from '../../components/ui';
import { vaultStorage } from '../../services/storage';
import { recoveryStrings as R } from '../../strings/recovery';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * Recovery-file screen. PENDING captain decision: recovery-key policy — this depicts the
 * recovery-file model exactly as the prototype commits to it; all copy lives in
 * strings/recovery.ts. Do not build recovery behaviour beyond this depicted screen.
 */
export default function RecoveryScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const ink = c.unlockInk;
  const ink2 = c.unlockInk2;

  const onDrop = async () => {
    // Depicted-only: a real file picker + Argon2id recovery envelope slots in later.
    const res = await vaultStorage.unlockWithRecoveryFile('mock');
    if (res.ok) router.replace('/(app)/today');
  };

  return (
    <LinearGradient colors={c.unlockGradient} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ flex: 1 }}>
      <TopBar transparent inkColor={ink} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.lg, paddingBottom: insets.bottom + 20 }}>
        <View style={{ alignItems: 'center', width: '100%', maxWidth: 460 }}>
          <Mascot size={116} float />
          <View style={{ height: 16 }} />
          <AppText variant="label" tint={ink2} uppercase center>
            {R.recoveryEyebrow}
          </AppText>
          <AppText variant="display" tint={ink} center style={{ fontSize: 28, lineHeight: 32, marginTop: 8 }}>
            {R.recoveryTitle}
          </AppText>
          <AppText variant="body" tint={ink2} center style={{ marginTop: 12, maxWidth: 400 }}>
            {R.recoverySubtitle}
          </AppText>

          <Pressable
            onPress={onDrop}
            accessibilityRole="button"
            accessibilityLabel={R.recoveryDropPrimary}
            style={({ pressed }) => ({
              marginTop: 28,
              width: '100%',
              maxWidth: 400,
              borderRadius: theme.radii.lg,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: 'rgba(255,255,255,0.28)',
              backgroundColor: pressed ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
              paddingVertical: 40,
              alignItems: 'center',
              gap: 14,
            })}
          >
            <FileUpIcon size={30} color={ink} />
            <AppText variant="bodyStrong" tint={ink}>
              {R.recoveryDropPrimary}
            </AppText>
            <AppText variant="body" tint={ink2}>
              {R.recoveryDropSecondary}
            </AppText>
          </Pressable>

          <Pressable onPress={() => router.back()} style={({ pressed }) => ({ marginTop: 26, opacity: pressed ? 0.7 : 1 })}>
            <AppText variant="bodyStrong" tint={ink} style={{ textDecorationLine: 'underline' }}>
              ← {R.recoveryBackLink}
            </AppText>
          </Pressable>

          <AppText variant="small" tint={ink2} center style={{ marginTop: 26, maxWidth: 380 }}>
            {R.recoveryNoFile}
          </AppText>
        </View>
      </View>
    </LinearGradient>
  );
}
