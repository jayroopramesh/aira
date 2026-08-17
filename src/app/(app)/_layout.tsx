import { Redirect, Tabs, usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DemoBanner } from '../../components/DemoBanner';
import { PatternsTabIcon, ReadyTabIcon, SessionTabIcon } from '../../components/tabIcons';
import { TopBar } from '../../components/TopBar';
import { AppText } from '../../components/ui';
import { DataProvider } from '../../data/DataProvider';
import { vaultStorage } from '../../services/storage';
import { useTheme } from '../../theme/ThemeProvider';

/** Web renders a left rail instead of the bottom bar (see WebSideNav below); native is
 * untouched. Not a width breakpoint: today/patterns/session already use their own wide-screen
 * breakpoints (900/860/1040px) to toggle CONTENT layout on any platform, including wide native
 * tablets, which must keep the bottom tab bar regardless of width. */
const IS_WEB = Platform.OS === 'web';

const TAB_META: Record<string, { label: string; Icon: React.ComponentType<{ size?: number; color?: string }> }> = {
  today: { label: 'Get ready', Icon: ReadyTabIcon },
  session: { label: 'Session', Icon: SessionTabIcon },
  patterns: { label: 'Patterns', Icon: PatternsTabIcon },
};

/** Minimal shape of the bottom-tab-bar props we consume (avoids a direct react-navigation dep). */
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

/** The workflow switcher — phone-adapted from the prototype's 4-way switcher to a bottom bar. */
function WorkflowTabBar({ state, navigation }: TabBarProps) {
  const theme = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: c.elevated,
        borderTopWidth: 1,
        borderTopColor: c.line,
        paddingBottom: insets.bottom,
        paddingTop: 8,
        paddingHorizontal: 8,
      }}
    >
      <View style={{ flexDirection: 'row', maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        {state.routes
          .filter((r) => TAB_META[r.name])
          .map((route) => {
            const meta = TAB_META[route.name];
            const idx = state.routes.findIndex((r) => r.key === route.key);
            const focused = state.index === idx;
            const color = focused ? c.brand : c.ink3;
            const Icon = meta.Icon;
            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                onPress={() => {
                  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
                }}
                style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 4 }}
              >
                <Icon size={22} color={color} />
                <AppText variant="small" tint={color} style={{ fontSize: 12 }}>
                  {meta.label}
                </AppText>
              </Pressable>
            );
          })}
      </View>
    </View>
  );
}

/**
 * Web-only left rail — replaces the bottom bar on web (see the CLAUDE.md sharp edge this fix
 * added for why the bottom bar's tap targets went dead on desktop-width web viewports). Same
 * items/order/active states as WorkflowTabBar; driven by the URL instead of the Tabs navigator's
 * {state, navigation} props so it can sit beside the Tabs content in a row layout rather than in
 * the tabBar slot (which the underlying navigator always docks below the content, not beside it).
 */
function WebSideNav() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View
      style={{
        width: 220,
        borderRightWidth: 1,
        borderRightColor: c.line,
        backgroundColor: c.elevated,
        paddingVertical: theme.spacing.lg,
        paddingHorizontal: theme.spacing.sm,
        gap: 4,
      }}
    >
      {Object.entries(TAB_META).map(([key, meta]) => {
        const focused = pathname.includes(`/${key}`);
        const color = focused ? c.brand : c.ink3;
        const Icon = meta.Icon;
        return (
          <Pressable
            key={key}
            accessibilityRole="link"
            accessibilityLabel={`Open ${meta.label}`}
            accessibilityState={focused ? { selected: true } : {}}
            onPress={() => {
              if (!focused) router.navigate(`/(app)/${key}` as Parameters<typeof router.navigate>[0]);
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: theme.radii.sm,
              backgroundColor: focused ? c.brandBg : 'transparent',
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Icon size={20} color={color} />
            <AppText variant="bodyStrong" tint={color} style={{ fontSize: 14 }}>
              {meta.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function AppLayout() {
  const theme = useTheme();
  // Route guard (F2): the (app) group holds the entire caseload. It renders ONLY when the vault is
  // open. Signing out (and a plain reload) locks the vault, so any direct navigation here — e.g.
  // typing /patterns while signed out — is bounced back to the unlock screen instead of exposing
  // client data. isUnlocked() is in-memory, so a reload also re-locks and re-challenges.
  if (!vaultStorage.isUnlocked()) {
    return <Redirect href="/unlock" />;
  }
  return (
    <DataProvider>
      <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <TopBar />
        <DemoBanner />
        <View style={{ flex: 1, flexDirection: IS_WEB ? 'row' : 'column' }}>
          {IS_WEB && <WebSideNav />}
          <View style={{ flex: 1 }}>
            <Tabs
              tabBar={IS_WEB ? () => null : (props) => <WorkflowTabBar {...(props as unknown as TabBarProps)} />}
              screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: theme.colors.surface } }}
            >
              <Tabs.Screen name="today" />
              <Tabs.Screen name="session" />
              <Tabs.Screen name="patterns" />
              {/* Reachable from the top-bar gear; hidden from the workflow tab bar (not in TAB_META). */}
              <Tabs.Screen name="settings" options={{ href: null }} />
            </Tabs>
          </View>
        </View>
      </View>
    </DataProvider>
  );
}
