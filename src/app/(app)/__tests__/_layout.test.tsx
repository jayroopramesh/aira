/**
 * (app) layout wiring on native — the default platform under `jest-expo/ios`, so no Platform mock
 * is needed here. See `_layout.web.test.tsx` for the web counterpart (left rail replaces the bottom
 * bar) and the PR body / CLAUDE.md for the diagnosed defect this split fixes: on desktop-width web
 * viewports the bottom bar's tap targets sat inside a maxWidth:560 row left-anchored within a
 * full-bleed background band, leaving most of the visible bar dead. Native never hit that (screens
 * rarely exceed 560px wide) and must keep the original bottom bar unchanged — this proves it still
 * does, with the same items/order and real navigation on tap.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import AppLayout from '../_layout';

const mockNavigate = jest.fn();
const mockRedirects: unknown[] = [];

jest.mock('expo-router', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const Tabs = ({ tabBar, children }: any) => {
    const state = {
      index: 0,
      routes: [
        { key: 'today', name: 'today' },
        { key: 'session', name: 'session' },
        { key: 'patterns', name: 'patterns' },
        { key: 'settings', name: 'settings' },
      ],
    };
    const navigation = { emit: () => ({ defaultPrevented: false }), navigate: mockNavigate };
    return ReactActual.createElement(
      View,
      { testID: 'tabs-navigator' },
      tabBar ? tabBar({ state, navigation }) : null,
      children,
    );
  };
  Tabs.Screen = () => null;
  return {
    Redirect: (props: { href: unknown }) => {
      mockRedirects.push(props.href);
      return null;
    },
    Tabs,
    usePathname: () => '/today/amara',
    useRouter: () => ({ navigate: mockNavigate, push: jest.fn() }),
    useGlobalSearchParams: () => ({}),
  };
});

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

let mockUnlocked = true;
jest.mock('../../../services/storage', () => ({
  vaultStorage: { isUnlocked: () => mockUnlocked },
}));

jest.mock('../../../data/DataProvider', () => {
  const ReactActual = require('react');
  return {
    DataProvider: ({ children }: { children: React.ReactNode }) => ReactActual.createElement(ReactActual.Fragment, null, children),
    useClient: () => undefined,
  };
});

jest.mock('../../../components/Escalate', () => ({
  useEscalate: () => ({ open: jest.fn(), close: jest.fn(), isOpen: false }),
}));

beforeEach(() => {
  mockNavigate.mockClear();
  mockRedirects.length = 0;
  mockUnlocked = true;
});

it('keeps the bottom bar, same items, and navigates on tap', () => {
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemeProvider>
        <AppLayout />
      </ThemeProvider>
    </SafeAreaProvider>,
  );

  expect(screen.getByText('Get ready')).toBeTruthy();
  expect(screen.getByText('Session')).toBeTruthy();
  expect(screen.getByText('Patterns')).toBeTruthy();

  fireEvent.press(screen.getByText('Session'));
  expect(mockNavigate).toHaveBeenCalledWith('session');
});

it('a locked vault bounces to unlock CARRYING the interrupted location as next (round 5, Yuki)', () => {
  mockUnlocked = false;
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemeProvider>
        <AppLayout />
      </ThemeProvider>
    </SafeAreaProvider>,
  );

  // The caseload chrome must not render while locked.
  expect(screen.queryByText('Get ready')).toBeNull();
  expect(mockRedirects).toHaveLength(1);
  const href = mockRedirects[0] as { pathname: string; params: { next: string } };
  expect(href.pathname).toBe('/unlock');
  // safeNext only honours /(app)/-prefixed routes; the guard must hand it one, preserving the page
  // the clinician was interrupted on rather than discarding it.
  expect(href.params.next).toBe('/(app)/today/amara');
});
