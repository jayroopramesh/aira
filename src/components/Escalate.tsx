import { useRouter } from 'expo-router';
import React, { createContext, useContext, useMemo, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { crisisLine } from '../config/env';
import { useTheme } from '../theme/ThemeProvider';
import { CloseIcon, PhoneIcon, ShieldIcon } from './icons';
import { AppText, Card, Divider, Eyebrow, Row } from './ui';

type OpenOpts = { clientId?: string };
type EscalateContextValue = { open: (opts?: OpenOpts) => void; close: () => void; isOpen: boolean };
const EscalateContext = createContext<EscalateContextValue | null>(null);

export function useEscalate() {
  const ctx = useContext(EscalateContext);
  if (!ctx) throw new Error('useEscalate must be used within an EscalateProvider');
  return ctx;
}

/** Warm handoff to the on-call clinician — a mailto the clinician sends; the client is never messaged. */
function onCallMailto(clientId?: string): string {
  const ref = clientId ? ` (re: locally-identified client ${clientId})` : '';
  const subject = 'Warm handoff — on-call review requested';
  const body = `Hi,\n\nRequesting a warm handoff${ref} to the on-call clinician for review. Please advise on availability.\n\n(No message has been sent to the client.)`;
  return `mailto:on-call@clinic.example?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * The standing Escalate affordance. Calm clay tones — never alarm-red. Presented as a
 * dismissible panel/sheet, never a blocking alarm. Nothing here auto-acts or messages the
 * client; every option routes to the clinician. No option is a dead promise (F6): the crisis
 * line dials a real number, the handoff opens a real mailto, and the safety plan opens the
 * client's plan when there is a client in context — otherwise it says so honestly (F19).
 */
export function EscalateProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [clientId, setClientId] = useState<string | undefined>(undefined);
  const value = useMemo(
    () => ({
      open: (opts?: OpenOpts) => {
        // Normalise a missing/blank id to undefined, so an empty string can never be treated as a
        // real client downstream (or land in a ...?clientId= URL).
        const id = opts?.clientId?.trim();
        setClientId(id ? id : undefined);
        setOpen(true);
      },
      close: () => setOpen(false),
      isOpen,
    }),
    [isOpen],
  );
  return (
    <EscalateContext.Provider value={value}>
      {children}
      <EscalateSheet visible={isOpen} clientId={clientId} onClose={() => setOpen(false)} />
    </EscalateContext.Provider>
  );
}

function EscalateSheet({ visible, clientId, onClose }: { visible: boolean; clientId?: string; onClose: () => void }) {
  const theme = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Narrow to a definite string once, so the safety-plan branch below can never route with undefined.
  const activeClientId: string | undefined = clientId && clientId.trim() ? clientId : undefined;

  const options: { key: string; title: string; sub: string; disabled?: boolean; onPress?: () => void }[] = [
    {
      key: 'crisis',
      title: 'Call a crisis line',
      sub: crisisLine.configured
        ? `${crisisLine.display} · opens your dialer`
        : `Opens your dialer — no dedicated line configured, dials ${crisisLine.display}`,
      onPress: () => {
        Linking.openURL(crisisLine.tel).catch(() => {});
        onClose();
      },
    },
    {
      key: 'handoff',
      title: 'Warm handoff to on-call',
      sub: 'Opens an email to the on-call clinician — the client is never auto-messaged',
      onPress: () => {
        Linking.openURL(onCallMailto(clientId)).catch(() => {});
        onClose();
      },
    },
    activeClientId
      ? {
          key: 'safety',
          title: 'Open the safety plan',
          sub: 'Review the safety information on file for this client',
          onPress: () => {
            onClose();
            router.push(`/(app)/patterns/safety-plan?clientId=${encodeURIComponent(activeClientId)}`);
          },
        }
      : {
          key: 'safety',
          title: 'Open the safety plan',
          sub: 'Open a client’s review first — a safety plan belongs to a specific client',
          disabled: true,
        },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Light scrim — this is a calm panel, not an alarm; tap outside to dismiss. */}
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(12,28,25,0.32)', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: c.elevated,
            borderTopLeftRadius: theme.radii.lg,
            borderTopRightRadius: theme.radii.lg,
            borderWidth: 1,
            borderColor: c.line,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.md,
            paddingBottom: insets.bottom + theme.spacing.lg,
            maxWidth: 560,
            width: '100%',
            alignSelf: 'center',
            ...theme.elevation.lg,
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: theme.spacing.sm }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: c.line }} />
          </View>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Row gap={8}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.riskFill }} />
                <Eyebrow color="risk">Escalate · calm options</Eyebrow>
              </Row>
              <AppText variant="body" color="ink2" style={{ marginTop: 6 }}>
                Always one tap away. Nothing here alarms the client or auto-messages anyone — every path routes to you.
              </AppText>
            </View>
            <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={8} style={{ padding: 6 }}>
              <CloseIcon size={20} color={c.ink3} />
            </Pressable>
          </Row>

          <View style={{ height: theme.spacing.md }} />

          <ScrollView style={{ maxHeight: 360 }}>
            {options.map((o, i) => (
              <View key={o.key}>
                {i > 0 && <Divider />}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !!o.disabled }}
                  disabled={o.disabled}
                  onPress={o.onPress}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 14,
                    opacity: o.disabled ? 0.45 : pressed ? 0.7 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: theme.radii.sm,
                      backgroundColor: c.riskBg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <PhoneIcon size={18} color={c.risk} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyStrong">{o.title}</AppText>
                    <AppText variant="small" color="ink3" style={{ marginTop: 2 }}>
                      {o.sub}
                    </AppText>
                  </View>
                </Pressable>
              </View>
            ))}
          </ScrollView>

          <Card tone="sunken" elevation="none" radius="md" style={{ marginTop: theme.spacing.sm, padding: theme.spacing.md }}>
            <Row gap={8}>
              <ShieldIcon size={16} color={c.brand} />
              <AppText variant="small" color="ink2" style={{ flex: 1 }}>
                Escalation is a standing, sober affordance — the same on every screen. It never blocks your work.
              </AppText>
            </Row>
          </Card>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
