/**
 * Today's schedule list — a session row's whole surface (including the client's own name/avatar)
 * must open that client's patient page. Mounts the real screen so a deleted `onPress` here would
 * fail this test, the same wiring-not-just-data guarantee `Escalate.test.tsx` uses.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { ThemeProvider } from '../../../../theme/ThemeProvider';
import { Client, DayDashboard } from '../../../../data/types';
import TodayDashboard from '../index';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

const AMARA: Client = {
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

const DASHBOARD: DayDashboard = {
  dateLabel: 'TUESDAY · 18 AUGUST',
  subtitle: '1 session today',
  nextInMinutes: 12,
  nextClientId: 'amara',
  glance: [],
  schedule: [
    { clientId: 'amara', time: '10:30', meridiem: 'AM', durationMin: 45, kind: 'Individual', sessionLabel: 'Session 5', prepCount: 2 },
  ],
  standingSafety: { clientId: 'amara', note: 'Nothing flagged' },
};

jest.mock('../../../../data/DataProvider', () => ({
  useData: () => ({ hydrated: true, loadSample: jest.fn() }),
  useDayDashboard: () => DASHBOARD,
  useClient: () => AMARA,
}));

function renderScreen() {
  render(
    <ThemeProvider>
      <TodayDashboard />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  mockPush.mockClear();
});

it('opens the client’s patient page when the session row is pressed', () => {
  renderScreen();
  // The client's name renders twice on this screen (the countdown banner and the schedule row), so
  // press on text unique to the row itself — the whole row shares the row's single Pressable.
  fireEvent.press(screen.getByText('Individual · Session 5'));
  expect(mockPush).toHaveBeenCalledWith(`/(app)/today/${AMARA.id}`);
});

it('links the next-session banner name to the same patient page', () => {
  renderScreen();
  const link = screen.getByRole('link', { name: `Open ${AMARA.name}’s page` });
  fireEvent.press(link);
  expect(mockPush).toHaveBeenCalledWith(`/(app)/today/${AMARA.id}`);
});

// fix-these #8: the countdown banner's subline used to be a hardcoded literal ("10:30 · INDIVIDUAL",
// "Session 5 · academic anxiety, sleep · PHQ-9 trending down") regardless of the real schedule entry.
it('derives the countdown banner subline from the real schedule entry, not a hardcoded literal', () => {
  renderScreen();
  expect(screen.getByText('10:30 AM · INDIVIDUAL')).toBeTruthy();
  expect(screen.getByText('Session 5')).toBeTruthy();
  expect(screen.queryByText(/academic anxiety, sleep/)).toBeNull();
});
