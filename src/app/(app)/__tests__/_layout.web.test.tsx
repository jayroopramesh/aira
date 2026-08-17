/**
 * (app) layout wiring on web — see `_layout.test.tsx` for the native counterpart and the full
 * rationale. Split into its own file (rather than toggling Platform.OS mid-file) because mocking
 * `Platform.OS` for just one test via `jest.resetModules()` + dynamic `require()` pulls in a SECOND
 * copy of `react` alongside the statically-imported one this file's JSX compiles against, and two
 * React copies rendering the same tree throws ("Cannot read properties of null, reading 'useState'").
 * A file-level `jest.mock`, hoisted before any import runs, avoids that: there is only ever one
 * `react` instance for this file's lifetime.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../theme/ThemeProvider';

jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  __esModule: true,
  default: {
    OS: 'web',
    select: (spec: Record<string, unknown>) => ('web' in spec ? spec.web : spec.default),
  },
}));

const mockNavigate = jest.fn();
const mockUsePathname = jest.fn();

jest.mock('expo-router', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const Tabs = ({ tabBar, children }: any) => {
    const state = { index: 0, routes: [{ key: 'today', name: 'today' }] };
    const navigation = { emit: () => ({ defaultPrevented: false }), navigate: mockNavigate };
    return ReactActual.createElement(View, { testID: 'tabs-navigator' }, tabBar ? tabBar({ state, navigation }) : null, children);
  };
  Tabs.Screen = () => null;
  return {
    Redirect: () => null,
    Tabs,
    usePathname: () => mockUsePathname(),
    useRouter: () => ({ navigate: mockNavigate, push: jest.fn() }),
    useGlobalSearchParams: () => ({}),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context/jest/mock').default,
}));

jest.mock('../../../services/storage', () => ({
  vaultStorage: { isUnlocked: () => true },
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

function renderLayout() {
  const AppLayout = require('../_layout').default;
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 1440, height: 1024 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemeProvider>
        <AppLayout />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockNavigate.mockClear();
  mockUsePathname.mockReturnValue('/today');
});

it('renders the left rail instead of the bottom bar, with the same items/order', () => {
  renderLayout();

  // The rail's items use accessibilityRole="link" (WorkflowTabBar's bottom-bar items use "button"
  // with a bare label, not "Open <label>") — this distinguishes the rail from the bottom bar and
  // proves the same items/order survived the swap.
  const items = screen.getAllByRole('link').filter((el) => el.props.accessibilityLabel?.startsWith('Open '));
  expect(items.map((el) => el.props.accessibilityLabel)).toEqual(['Open Get ready', 'Open Session', 'Open Patterns']);
});

it('navigates via router.navigate when a rail item is pressed, and skips it when already on that tab', () => {
  renderLayout();

  fireEvent.press(screen.getByLabelText('Open Session'));
  expect(mockNavigate).toHaveBeenCalledWith('/(app)/session');

  mockNavigate.mockClear();
  // mockUsePathname resolves to '/today', so pressing "Get ready" again must not navigate.
  fireEvent.press(screen.getByLabelText('Open Get ready'));
  expect(mockNavigate).not.toHaveBeenCalled();
});
