import { useRouter } from 'expo-router';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  buildEscalateSections,
  openFailureMessage,
  type EscalateAction,
  type EscalateSectionTone,
} from '../config/escalateContacts';
import { useTheme } from '../theme/ThemeProvider';
import { CloseIcon, GlobeIcon, MailIcon, PhoneIcon, ShieldIcon } from './icons';
import { AppText, Card, Divider, Eyebrow, Row } from './ui';
import type { StringColorKey } from '../theme/tokens';

// clientToken is the LOCALLY re-identified token (Client.tokenId), never the raw clientId — a readable
// client identifier must never leave the device, fixtures included (escalate-clientid-in-mailto).
type OpenOpts = { clientId?: string; clientToken?: string };
type EscalateContextValue = { open: (opts?: OpenOpts) => void; close: () => void; isOpen: boolean };
const EscalateContext = createContext<EscalateContextValue | null>(null);

export function useEscalate() {
  const ctx = useContext(EscalateContext);
  if (!ctx) throw new Error('useEscalate must be used within an EscalateProvider');
  return ctx;
}

/** Icon + colour per section tone — the emergency tier reads in the app's clay risk tone (never
 * alarm-red), the non-urgent tier and clinician tools read calmer, so the tiers can't be mistaken
 * for each other at a glance. */
function toneColors(tone: EscalateSectionTone, c: ReturnType<typeof useTheme>['colors']): { bg: string; fg: string; eyebrow: StringColorKey } {
  switch (tone) {
    case 'crisis':
    case 'emergency':
      return { bg: c.riskBg, fg: c.risk, eyebrow: 'risk' };
    case 'nonUrgent':
      return { bg: c.brandBg, fg: c.brand, eyebrow: 'brand' };
    case 'tools':
      return { bg: c.sunken, fg: c.ink3, eyebrow: 'ink3' };
  }
}

function ActionIcon({ action, color }: { action: EscalateAction; color: string }) {
  switch (action.kind) {
    case 'tel':
      return <PhoneIcon size={18} color={color} />;
    case 'url':
      return <GlobeIcon size={18} color={color} />;
    case 'mailto':
      return <MailIcon size={18} color={color} />;
    case 'route':
      return <ShieldIcon size={18} color={color} />;
  }
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
  const [clientToken, setClientToken] = useState<string | undefined>(undefined);
  const value = useMemo(
    () => ({
      open: (opts?: OpenOpts) => {
        // Normalise a missing/blank id to undefined, so an empty string can never be treated as a
        // real client downstream (or land in a ...?clientId= URL).
        const id = opts?.clientId?.trim();
        const token = opts?.clientToken?.trim();
        setClientId(id ? id : undefined);
        setClientToken(token ? token : undefined);
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
      <EscalateSheet visible={isOpen} clientId={clientId} clientToken={clientToken} onClose={() => setOpen(false)} />
    </EscalateContext.Provider>
  );
}

function EscalateSheet({ visible, clientId, clientToken, onClose }: { visible: boolean; clientId?: string; clientToken?: string; onClose: () => void }) {
  const theme = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Narrow to a definite string once, so the safety-plan branch below can never route with undefined.
  const activeClientId: string | undefined = clientId && clientId.trim() ? clientId : undefined;

  const sections = buildEscalateSections({ activeClientId, clientToken });

  // The last action the device refused to open, so the sheet can say so instead of dismissing onto
  // nothing. Cleared whenever the sheet is reopened.
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  useEffect(() => {
    if (!visible) setFailure(null);
  }, [visible]);

  // Every option resolves to a real target here — no onPress may be a no-op (F6). tel/url/mailto
  // hand off to Linking; route hands off to the router; a disabled action (no client in context)
  // never reaches this at all (the Pressable below is itself disabled).
  //
  // The sheet closes only once the hand-off actually succeeded. If openURL rejects — a `tel:` on a
  // desktop web build with no dialer, a platform refusing the scheme — we keep the sheet open and
  // surface the bare number/address to use by hand, because a row saying "opens your dialer" that
  // dismisses and does nothing is the dead promise this surface exists to remove.
  const runAction = (action: EscalateAction) => {
    setFailure(null);
    if (action.kind === 'route') {
      onClose();
      if (action.route) router.push(action.route as Parameters<typeof router.push>[0]);
      return;
    }
    if (!action.href) return;
    Linking.openURL(action.href).then(
      () => onClose(),
      () => setFailure({ key: action.key, message: openFailureMessage(action) }),
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Light scrim — this is a calm panel, not an alarm; tap outside to dismiss. */}
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(12,28,25,0.32)', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={(e) => e?.stopPropagation?.()}
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

          <ScrollView style={{ maxHeight: 440 }}>
            {sections.map((section, si) => {
              const tone = toneColors(section.tone, c);
              return (
                <View key={section.key}>
                  {si > 0 && <Divider />}
                  {section.label && (
                    <View style={{ marginTop: si > 0 ? theme.spacing.sm : 0, marginBottom: 6 }}>
                      <Eyebrow color={tone.eyebrow}>{section.label}</Eyebrow>
                      {section.description && (
                        <AppText variant="small" color="ink3" style={{ marginTop: 2 }}>
                          {section.description}
                        </AppText>
                      )}
                    </View>
                  )}
                  {section.actions.map((action, ai) => (
                    <View key={action.key}>
                      {ai > 0 && <Divider />}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !!action.disabled }}
                        disabled={action.disabled}
                        onPress={() => runAction(action)}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                          paddingVertical: 14,
                          opacity: action.disabled ? 0.45 : pressed ? 0.7 : 1,
                        })}
                      >
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: theme.radii.sm,
                            backgroundColor: tone.bg,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <ActionIcon action={action} color={tone.fg} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <AppText variant="bodyStrong">{action.title}</AppText>
                          <AppText variant="small" color="ink3" style={{ marginTop: 2 }}>
                            {action.sub}
                          </AppText>
                        </View>
                      </Pressable>
                      {failure?.key === action.key && (
                        <View
                          accessibilityLiveRegion="polite"
                          style={{
                            backgroundColor: c.riskBg,
                            borderRadius: theme.radii.sm,
                            paddingHorizontal: theme.spacing.sm,
                            paddingVertical: 10,
                            marginBottom: theme.spacing.sm,
                          }}
                        >
                          <AppText variant="small" color="risk" selectable>
                            {failure.message}
                          </AppText>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              );
            })}
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
