/**
 * WipBanner — proves the standing preview notice actually renders with the exact required copy.
 * `scripts/wip-banner-mount-harness.mjs` proves the WIRING (that the root layout actually mounts
 * it, so every route inherits it); this proves the component itself.
 */
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { WipBanner } from '../WipBanner';

it('renders the exact preview copy', () => {
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemeProvider>
        <WipBanner />
      </ThemeProvider>
    </SafeAreaProvider>,
  );

  expect(screen.getByText('Preview — not a live medical service. Test with fictional client data only.')).toBeTruthy();
});
