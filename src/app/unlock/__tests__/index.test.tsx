/**
 * fix-these #11: once a sign-in attempt failed, there was no in-app path back to the clean login
 * view — the create-account link and vault/HIPAA footer stayed hidden until a SUCCESSFUL sign-in.
 * Mounts the real screen so a deleted `onPress` on the "back to sign in" link fails this test.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EscalateProvider } from '../../../components/Escalate';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import UnlockScreen from '../index';

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

// The shared chrome mounts the app-wide TopBar, which pulls in routing/risk plumbing unrelated to
// this screen — stub it so the test stays scoped to the unlock form (matches welcome/create's test).
jest.mock('../../../components/TopBar', () => ({ TopBar: () => null }));

const mockAuthState = { knownEmail: null as string | null, clinicianName: null as string | null };

jest.mock('../../../services/auth', () => ({
  authService: {
    signIn: jest.fn(),
    signInWithRecoveryCode: jest.fn(),
    getKnownEmail: () => mockAuthState.knownEmail,
    getClinicianName: () => mockAuthState.clinicianName,
    whenHydrated: () => Promise.resolve(),
  },
}));

const METRICS = { frame: { x: 0, y: 0, width: 800, height: 900 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function renderScreen() {
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider>
        <EscalateProvider>
          <UnlockScreen />
        </EscalateProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

const { authService } = jest.requireMock('../../../services/auth');

beforeEach(() => {
  authService.signIn.mockReset();
  mockAuthState.knownEmail = null;
  mockAuthState.clinicianName = null;
});

it('greets the returning clinician by their hydrated name, and prefills their email (round 5, Yuki)', async () => {
  mockAuthState.knownEmail = 'yuki.tanaka@clinic.ae';
  mockAuthState.clinicianName = 'Yuki Tanaka';
  renderScreen();

  // The name arrives via async device-store hydration and must land in state — a bare render-time
  // service read gets frozen by the React Compiler in the compiled bundle (greeting stuck on
  // "Doctor" while jest passed), so this asserts the state-driven path.
  await waitFor(() => expect(screen.getByText('Good morning, Yuki Tanaka')).toBeTruthy());
  expect(screen.getByDisplayValue('yuki.tanaka@clinic.ae')).toBeTruthy();
});

it('a failed sign-in has a way back to the clean login view', async () => {
  authService.signIn.mockResolvedValue({ ok: false });
  renderScreen();

  fireEvent.press(screen.getByText('Sign in & unlock'));
  await waitFor(() => expect(screen.getByText('Let’s try once more')).toBeTruthy());
  // The create-account link and HIPAA footer are gone in the wrong-password view.
  expect(screen.queryByText('New to Airava? Create an account')).toBeNull();

  fireEvent.press(screen.getByText('← Back to sign in'));
  expect(screen.getByText('Your vault is locked')).toBeTruthy();
  expect(screen.getByText('New to Airava? Create an account')).toBeTruthy();
});
