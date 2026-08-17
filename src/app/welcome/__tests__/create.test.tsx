/**
 * Create-account form — every field must start EMPTY with a faint placeholder showing the expected
 * shape, never a baked-in demo identity that reads as pre-filled (captain feedback: "seems
 * prefilled"). The three identity fields the captain called mandatory (Emirates ID, phone, full
 * name) carry a visible star AND accessible "required" semantics on the input itself — a screen
 * reader must not rely on the glyph alone.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
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

// fix-these #3/#10: required fields must actually gate submit, not just carry a "*" that nothing enforces.
describe('submit validation (fix-these #3/#10)', () => {
  const { authService } = jest.requireMock('../../../services/auth');

  beforeEach(() => {
    authService.createAccount.mockClear();
  });

  it('blocks submit and shows inline errors when the required fields are all blank', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Create account'));
    expect(authService.createAccount).not.toHaveBeenCalled();
    expect(screen.getByText('Emirates ID is required.')).toBeTruthy();
    expect(screen.getByText('Phone number is required.')).toBeTruthy();
    expect(screen.getByText('Full name is required.')).toBeTruthy();
  });

  it('blocks submit on a malformed Emirates ID even when every other field is filled', () => {
    renderScreen();
    fireEvent.changeText(screen.getByLabelText('Emirates ID number, required'), '784-1988');
    fireEvent.changeText(screen.getByLabelText('Phone number, required'), '+971500000000');
    fireEvent.changeText(screen.getByLabelText('Full name, required'), 'Dr. Zayed');
    fireEvent.changeText(screen.getByLabelText('Password'), 'correct-horse-battery');
    fireEvent.changeText(screen.getByLabelText('Confirm password'), 'correct-horse-battery');
    fireEvent.press(screen.getByText('Create account'));
    expect(authService.createAccount).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a well-formed Emirates ID (784-XXXX-XXXXXXX-X).')).toBeTruthy();
  });

  it('blocks submit when confirm password does not match password', () => {
    renderScreen();
    fireEvent.changeText(screen.getByLabelText('Emirates ID number, required'), '784111111111111');
    fireEvent.changeText(screen.getByLabelText('Phone number, required'), '+971500000000');
    fireEvent.changeText(screen.getByLabelText('Full name, required'), 'Dr. Zayed');
    fireEvent.changeText(screen.getByLabelText('Password'), 'correct-horse-battery');
    fireEvent.changeText(screen.getByLabelText('Confirm password'), 'a-typo-here');
    fireEvent.press(screen.getByText('Create account'));
    expect(authService.createAccount).not.toHaveBeenCalled();
    expect(screen.getByText('Passwords don’t match.')).toBeTruthy();
  });

  it('submits once every field is valid and passwords match', async () => {
    renderScreen();
    fireEvent.changeText(screen.getByLabelText('Emirates ID number, required'), '784111111111111');
    fireEvent.changeText(screen.getByLabelText('Phone number, required'), '+971500000000');
    fireEvent.changeText(screen.getByLabelText('Full name, required'), 'Dr. Zayed');
    fireEvent.changeText(screen.getByLabelText('Password'), 'correct-horse-battery');
    fireEvent.changeText(screen.getByLabelText('Confirm password'), 'correct-horse-battery');
    await act(async () => {
      fireEvent.press(screen.getByText('Create account'));
    });
    expect(authService.createAccount).toHaveBeenCalledTimes(1);
  });
});
