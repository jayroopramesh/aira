import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import {
  AuthLede,
  AuthProgress,
  AuthScaffold,
  AuthSubmit,
  AuthTitle,
  INK,
  INK2,
  MINT,
} from '../../components/auth';
import { MascotMood } from '../../components/mascotMoods';
import { AlertTriangleIcon, CopyIcon, DownloadIcon, EyeIcon } from '../../components/icons';
import { authService } from '../../services/auth';
import { AppText, Row } from '../../components/ui';
import { recoveryStrings as R } from '../../strings/recovery';

const ERROR_INK = '#F0C9BE';

/** Space-joined 12 words, for the Copy affordance. */
function plainCode(words: string[]) {
  return words.join(' ');
}

/** A numbered, human-readable file body, for the Save affordance. */
function fileBody(words: string[]) {
  return `Airava recovery code — keep this private.\n\n${words.map((w, i) => `${String(i + 1).padStart(2, '0')}. ${w}`).join('\n')}\n`;
}

/**
 * One-time recovery code (round-3 change #1). The 12-word code is generated once by the
 * mock auth service and shown ONCE here: blurred behind a "Tap to reveal" overlay, with
 * Copy / Save affordances, a stern-but-truthful warning, and an "I've saved it" checkbox
 * that gates the Enter Aira button. Fresh component state resets it to blurred + ungated on
 * every entry, so the gate always applies.
 */
export default function WelcomeRecovery() {
  const router = useRouter();
  const words = authService.getRecoveryCode();
  // Revisiting this screen after setup shows no code — Copy/Save must be inert then, or "Save as file"
  // would download an EMPTY aira-recovery-code.txt over the user's real one (N4).
  const hasCode = words.length > 0;
  // Copy needs navigator.clipboard and Save needs a document to trigger a download — neither exists
  // on native, so both affordances are DISABLED there with honest guidance (write the words down)
  // rather than sitting tappable and silently doing nothing for a code shown exactly once.
  const canUseWebTools = Platform.OS === 'web';
  const [revealed, setRevealed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedFile, setSavedFile] = useState(false);

  const copy = () => {
    if (!hasCode) return;
    // The honesty rule has NO platform exceptions (F12): only ever confirm "Copied" after a real
    // successful clipboard write. A native mock with no real write, or a web build without a clipboard
    // API (insecure context / older webview), must NOT claim success for a code shown exactly once —
    // the user would navigate on having lost it. Use "Save as file" instead when no write is possible.
    const clip = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
    if (clip) {
      clip
        .writeText(plainCode(words))
        .then(() => setCopied(true))
        .catch(() => setCopied(false));
    }
  };

  const save = () => {
    if (!hasCode) return;
    // Only confirm "Saved" after a real download was triggered (F12 — no platform exceptions):
    // on native no file is written, so claiming success would lose a code shown exactly once.
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([fileBody(words)], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'aira-recovery-code.txt';
      a.click();
      URL.revokeObjectURL(url);
      setSavedFile(true);
    }
  };

  const enter = () => {
    authService.markRecoverySaved();
    router.replace('/unlock');
  };

  return (
    <AuthScaffold maxWidth={440}>
      <AuthProgress percent={100} label="Setup · last step" />
      {/* Rev 7: a modest supportive hero over the "shown once" badge — sober, reassuring. */}
      <MascotMood mood="supportive" size={92} float />
      <View style={{ height: 12 }} />
      <Row
        gap={7}
        style={{
          paddingVertical: 7,
          paddingHorizontal: 12,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: 'rgba(240,201,190,0.4)',
          backgroundColor: 'rgba(240,201,190,0.1)',
          marginBottom: 14,
        }}
      >
        <AlertTriangleIcon size={13} color={ERROR_INK} />
        <AppText variant="label" tint={ERROR_INK} uppercase style={{ letterSpacing: 0.4 }}>
          {R.recoveryBadge}
        </AppText>
      </Row>

      <AuthTitle>{R.recoveryTitle}</AuthTitle>
      <AuthLede>{R.recoveryLede}</AuthLede>

      {/* Word grid — masked behind a reveal overlay until tapped. */}
      <View
        style={{
          width: '100%',
          maxWidth: 360,
          marginTop: 22,
          padding: 16,
          borderRadius: 16,
          backgroundColor: 'rgba(234,247,243,0.08)',
          borderWidth: 1,
          borderColor: 'rgba(234,247,243,0.16)',
        }}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {words.map((w, i) => (
            <View key={i} style={{ width: '33.333%', padding: 4.5 }}>
              <Row
                gap={7}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 9,
                  borderRadius: 8,
                  backgroundColor: 'rgba(234,247,243,0.1)',
                }}
              >
                <AppText variant="label" tint="rgba(191,234,225,0.7)" style={{ fontSize: 9.5 }}>
                  {String(i + 1).padStart(2, '0')}
                </AppText>
                <AppText variant="bodyStrong" tint={INK} style={{ fontSize: 12.5 }}>
                  {revealed ? w : '••••'}
                </AppText>
              </Row>
            </View>
          ))}
        </View>

        {!revealed ? (
          <Pressable
            onPress={() => setRevealed(true)}
            accessibilityRole="button"
            accessibilityLabel={R.recoveryReveal}
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              right: 16,
              bottom: 16,
              borderRadius: 10,
              backgroundColor: 'rgba(11,55,52,0.72)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Row
              gap={8}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: 999,
                backgroundColor: MINT,
              }}
            >
              <EyeIcon size={14} color="#0B3B34" />
              <AppText variant="bodyStrong" tint="#0B3B34" style={{ fontSize: 13 }}>
                {R.recoveryReveal}
              </AppText>
            </Row>
          </Pressable>
        ) : null}
      </View>

      {/* Copy / Save affordances — inert when there is no code to give (N4), disabled on native. */}
      <Row gap={10} style={{ justifyContent: 'center', marginTop: 14 }}>
        <RecTool
          icon={<CopyIcon size={14} color={MINT} />}
          label={copied ? R.recoveryCopied : R.recoveryCopy}
          onPress={copy}
          disabled={!hasCode || !canUseWebTools}
        />
        <RecTool
          icon={<DownloadIcon size={14} color={MINT} />}
          label={savedFile ? R.recoverySaved : R.recoverySave}
          onPress={save}
          disabled={!hasCode || !canUseWebTools}
        />
      </Row>
      {!canUseWebTools ? (
        <AppText variant="small" tint="rgba(234,247,243,0.9)" center style={{ marginTop: 10, maxWidth: 360, lineHeight: 18 }}>
          Copy and Save as file aren’t available on this device yet — write the 12 words down before continuing.
        </AppText>
      ) : null}

      {/* Stern-but-truthful warning */}
      <Row gap={9} style={{ alignItems: 'flex-start', marginTop: 20, maxWidth: 360 }}>
        <View style={{ marginTop: 2 }}>
          <AlertTriangleIcon size={16} color={ERROR_INK} />
        </View>
        <AppText variant="small" tint="rgba(234,247,243,0.9)" style={{ flex: 1, lineHeight: 19 }}>
          {R.recoveryWarning}
        </AppText>
      </Row>

      {/* "I've saved it" gate */}
      <Pressable
        onPress={() => setSaved((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: saved }}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, marginTop: 20, maxWidth: 360, width: '100%' })}
      >
        <Row gap={10} style={{ alignItems: 'flex-start' }}>
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 5,
              marginTop: 1,
              borderWidth: 1.6,
              borderColor: saved ? MINT : 'rgba(234,247,243,0.4)',
              backgroundColor: saved ? MINT : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {saved ? (
              <AppText variant="label" tint="#0B3B34" style={{ fontSize: 12, lineHeight: 14 }}>
                ✓
              </AppText>
            ) : null}
          </View>
          <AppText variant="small" tint="rgba(234,247,243,0.9)" style={{ flex: 1, lineHeight: 18 }}>
            {R.recoveryGate}
          </AppText>
        </Row>
      </Pressable>

      <View style={{ height: 22 }} />
      <AuthSubmit title={R.recoveryEnterCta} onPress={enter} disabled={!saved} style={{ maxWidth: 300 }} />
      <View style={{ height: 6 }} />
      <AppText variant="small" tint={INK2} center style={{ fontSize: 11, opacity: 0.6 }}>
        On this device only · the code is never sent to Airava.
      </AppText>
    </AuthScaffold>
  );
}

function RecTool({ icon, label, onPress, disabled }: { icon: React.ReactNode; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingVertical: 9,
        paddingHorizontal: 14,
        borderRadius: 999,
        opacity: disabled ? 0.4 : 1,
        backgroundColor: pressed && !disabled ? 'rgba(234,247,243,0.18)' : 'rgba(234,247,243,0.1)',
      })}
    >
      {icon}
      <AppText variant="small" tint={INK} style={{ fontSize: 12.5 }}>
        {label}
      </AppText>
    </Pressable>
  );
}
