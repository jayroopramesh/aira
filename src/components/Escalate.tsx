import React, { createContext, useContext, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { CloseIcon, PhoneIcon, ShieldIcon } from './icons';
import { AppText, Card, Divider, Eyebrow, Row } from './ui';

type EscalateContextValue = { open: () => void; close: () => void; isOpen: boolean };
const EscalateContext = createContext<EscalateContextValue | null>(null);

export function useEscalate() {
  const ctx = useContext(EscalateContext);
  if (!ctx) throw new Error('useEscalate must be used within an EscalateProvider');
  return ctx;
}

const OPTIONS = [
  { key: 'crisis', title: 'Call a crisis line', sub: 'Regional 24/7 line · opens your dialer' },
  { key: 'handoff', title: 'Warm handoff to on-call', sub: 'Route to the on-call clinician — the client is never auto-messaged' },
  { key: 'safety', title: 'Open the safety plan', sub: 'Review coping steps and trusted contacts together' },
];

/**
 * The standing Escalate affordance. Calm clay tones — never alarm-red. Presented as a
 * dismissible panel/sheet, never a blocking alarm. Nothing here auto-acts or messages the
 * client; every option routes to the clinician.
 */
export function EscalateProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const value = useMemo(() => ({ open: () => setOpen(true), close: () => setOpen(false), isOpen }), [isOpen]);
  return (
    <EscalateContext.Provider value={value}>
      {children}
      <EscalateSheet visible={isOpen} onClose={() => setOpen(false)} />
    </EscalateContext.Provider>
  );
}

function EscalateSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();

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
            {OPTIONS.map((o, i) => (
              <View key={o.key}>
                {i > 0 && <Divider />}
                <Pressable
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 14,
                    opacity: pressed ? 0.7 : 1,
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
