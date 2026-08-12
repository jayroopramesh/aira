import { Tabs } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PatternsTabIcon, ReadyTabIcon, SessionTabIcon } from '../../components/tabIcons';
import { TopBar } from '../../components/TopBar';
import { AppText } from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';

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

export default function AppLayout() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <TopBar />
      <Tabs
        tabBar={(props) => <WorkflowTabBar {...(props as unknown as TabBarProps)} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: theme.colors.surface } }}
      >
        <Tabs.Screen name="today" />
        <Tabs.Screen name="session" />
        <Tabs.Screen name="patterns" />
      </Tabs>
    </View>
  );
}
