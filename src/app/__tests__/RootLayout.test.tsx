/**
 * Root-layout wiring — proves the WIP preview banner is actually MOUNTED by the root layout, not
 * just that the component renders in isolation (`WipBanner.test.tsx` covers that). A deleted — or
 * commented-out — `<WipBanner />` in `_layout.tsx` would leave every route quietly missing the
 * preview notice while the component's own test stayed green; rendering the real layout is what
 * catches it. Only the pieces that cannot resolve under jest are stubbed (fonts, the router's
 * navigator, the native safe-area measurer); RootLayout → RootStack → banner is the real code.
 */
import { render, screen, within } from '@testing-library/react-native';
import React from 'react';
import RootLayout from '../_layout';

const BANNER_COPY = 'Preview — not a live medical service. Test with fictional client data only.';

const mockUseFonts = jest.fn();

jest.mock('@expo-google-fonts/lexend', () => ({
  useFonts: () => mockUseFonts(),
  Lexend_400Regular: 'Lexend_400Regular',
  Lexend_500Medium: 'Lexend_500Medium',
  Lexend_600SemiBold: 'Lexend_600SemiBold',
  Lexend_700Bold: 'Lexend_700Bold',
}));

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('expo-router', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const Stack = ({ children }: { children?: React.ReactNode }) =>
    ReactActual.createElement(View, { testID: 'route-navigator' }, children);
  Stack.Screen = () => null;
  return { Stack, useRouter: () => ({ push: jest.fn() }) };
});

jest.mock('expo-router/head', () => ({ __esModule: true, default: () => null }));

beforeEach(() => {
  mockUseFonts.mockReturnValue([true, null]);
});

it('mounts the standing preview banner outside the navigator, so every route nests under it', () => {
  render(<RootLayout />);

  expect(screen.getByText(BANNER_COPY)).toBeTruthy();

  // The banner sits ABOVE the navigator, not inside any one route — that placement is what makes
  // it appear on welcome/unlock/(app) alike without per-screen copies.
  const navigator = screen.getByTestId('route-navigator');
  expect(within(navigator).queryByText(BANNER_COPY)).toBeNull();
});

it('still shows the banner when fonts fail to load (the fallback-glyph render path)', () => {
  mockUseFonts.mockReturnValue([false, new Error('font failed to load')]);
  render(<RootLayout />);

  expect(screen.getByText(BANNER_COPY)).toBeTruthy();
});

it('renders nothing while fonts are still resolving', () => {
  mockUseFonts.mockReturnValue([false, null]);
  render(<RootLayout />);

  expect(screen.toJSON()).toBeNull();
});
