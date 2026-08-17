/**
 * Create-account form — every field must start EMPTY with a faint placeholder showing the expected
 * shape, never a baked-in demo identity that reads as pre-filled (captain feedback: "seems
 * prefilled"). The three identity fields the captain called mandatory (Emirates ID, phone, full
 * name) carry a visible star AND accessible "required" semantics on the input itself — a screen
 * reader must not rely on the glyph alone.
 */
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EscalateProvider } from '../../../components/Escalate';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import WelcomeCreate from '../create';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

// The shared chrome mounts the app-wide TopBar, which pulls in routing/risk plumbing unrelated to
// this form — stub it so the test stays scoped to the fields under test.
jest.mock('../../../components/TopBar', () => ({ TopBar: () => null }));

jest.mock('../../../services/auth', () => ({
  AccountExistsError: class AccountExistsError extends Error {},
  authService: { createAccount: jest.fn() },
}));

const METRICS = { frame: { x: 0, y: 0, width: 1200, height: 900 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function renderScreen() {
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider>
        <EscalateProvider>
          <WelcomeCreate />
        </EscalateProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

it('starts every identity field empty rather than pre-filled with a demo identity', () => {
  renderScreen();
  expect(screen.getByLabelText('Emirates ID number, required').props.value).toBe('');
  expect(screen.getByLabelText('Phone number, required').props.value).toBe('');
  expect(screen.getByLabelText('Full name, required').props.value).toBe('');
  expect(screen.getByLabelText('Email').props.value).toBe('');
});

it('shows a faint placeholder hinting at the expected shape for each field', () => {
  renderScreen();
  expect(screen.getByPlaceholderText('784-XXXX-XXXXXXX-X')).toBeTruthy();
  expect(screen.getByPlaceholderText('+971 50 000 0000')).toBeTruthy();
  expect(screen.getByPlaceholderText('Enter your full name…')).toBeTruthy();
  expect(screen.getByPlaceholderText('you@clinic.ae')).toBeTruthy();
});

it('marks Emirates ID, phone and full name as required, both visually and to assistive tech', () => {
  renderScreen();
  // The accessible name carries the "required" semantics the visual star alone can't guarantee.
  expect(screen.getByLabelText('Emirates ID number, required')).toBeTruthy();
  expect(screen.getByLabelText('Phone number, required')).toBeTruthy();
  expect(screen.getByLabelText('Full name, required')).toBeTruthy();
  // Email is real-required-to-submit but wasn't in the captain's starred list, so it keeps its plain label.
  expect(screen.getByLabelText('Email')).toBeTruthy();
});
