/**
 * Session review header — the client name/avatar chip must be a real link to the patient page
 * (`/(app)/today/<clientId>`), never a dead promise. Mounts the real screen (not just the shared
 * `ClientLink` in isolation) so a deleted `onPress` here would fail this test the way the Escalate
 * sheet's wiring tests are designed to catch the same class of regression.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../../theme/ThemeProvider';
import { Client, DraftNote } from '../../../../data/types';
import ReviewNote from '../review';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => ({ clientId: 'amara' }),
}));

jest.mock('../../../../services/auth', () => ({
  authService: { getClinicianName: () => 'Test Clinician' },
}));

const CLIENT: Client = {
  id: 'amara',
  name: 'Amara K.',
  initials: 'AK',
  tokenId: '4c9-AK',
  age: 21,
  status: 'active',
  risk: 'watch',
  clientSince: 'Jan 2026',
  sessionNumber: 5,
  lastSessionLabel: '5 Aug',
  followUp: 'in 2 weeks',
  latestScore: 9,
  sparkline: [],
  focusTags: [],
  summaryLine: '',
  measures: [],
  timeline: [],
  lastPlan: [],
};

const DRAFT: DraftNote = {
  sessionLabel: 'Session 5 — 12 Aug',
  sourceLine: 'From a 47-min voice note',
  status: 'draft',
  sections: [],
  measures: [],
  reviewCodes: [],
  prescriptions: [],
};

jest.mock('../../../../data/DataProvider', () => ({
  useClient: () => CLIENT,
  useClientNotes: () => [DRAFT],
  useDraftNote: () => DRAFT,
  useData: () => ({ signNote: jest.fn(), updateNoteSection: jest.fn() }),
}));

const METRICS = { frame: { x: 0, y: 0, width: 1200, height: 900 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function renderScreen() {
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider>
        <ReviewNote />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
});

it('links the header client chip to the patient page', () => {
  renderScreen();
  const link = screen.getByRole('link', { name: `Open ${CLIENT.name}’s page` });
  fireEvent.press(link);
  expect(mockPush).toHaveBeenCalledWith(`/(app)/today/${CLIENT.id}`);
});
