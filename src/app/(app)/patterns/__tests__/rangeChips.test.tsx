/**
 * fix-these #9: the 3m/6m/1y range chips on a client's patterns view updated local state that was
 * never read by the chart — switching ranges was a dead control. Mounts the real screen so a chip
 * press that stops reaching `BandedChart` (or the visit-count copy above it) fails this test.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { ThemeProvider } from '../../../../theme/ThemeProvider';
import { Client } from '../../../../data/types';
import ClientPatterns from '../[clientId]';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useLocalSearchParams: () => ({ clientId: 'noor' }),
}));

jest.mock('../../../../services/auth', () => ({ authService: { getClinicianName: () => 'Dr. Test' } }));

const NOOR: Client = {
  id: 'noor',
  name: 'Noor A.',
  initials: 'NA',
  tokenId: '1a2-NA',
  age: 28,
  status: 'active',
  risk: 'watch',
  clientSince: '1 Jan',
  sessionNumber: 9,
  lastSessionLabel: '12 Aug',
  followUp: 'in 2 weeks',
  latestScore: 9,
  sparkline: [],
  focusTags: [],
  summaryLine: '',
  measures: [
    {
      key: 'phq9',
      name: 'PHQ-9',
      readings: [
        { date: '2026-01-12', label: '12 Jan', value: 18 },
        { date: '2026-01-26', label: '26 Jan', value: 17 },
        { date: '2026-02-09', label: '9 Feb', value: 16 },
        { date: '2026-05-03', label: '3 May', value: 10 },
        { date: '2026-08-12', label: '12 Aug', value: 9 },
      ],
      latest: 9,
      band: 'mild',
    },
  ],
  timeline: [],
  lastPlan: [],
};

jest.mock('../../../../data/DataProvider', () => ({
  useClient: () => NOOR,
  useClientNotes: () => [],
}));

function renderScreen() {
  render(
    <ThemeProvider>
      <ClientPatterns />
    </ThemeProvider>,
  );
}

afterEach(() => {
  jest.useRealTimers();
});

it('3m shows fewer visits than 6m, which shows fewer than 1y, for the same series', () => {
  jest.useFakeTimers({ now: new Date('2026-08-17T00:00:00Z') });
  renderScreen();

  // Default range is 6m: 3 May and 12 Aug fall inside the last 6 months of 17 Aug (cutoff 17 Feb).
  expect(screen.getByText(/across 2 visits/)).toBeTruthy();

  act(() => {
    fireEvent.press(screen.getByText('3m'));
  });
  // Only 12 Aug is within 3 months of 17 Aug.
  expect(screen.getByText(/across 1 visits/)).toBeTruthy();

  act(() => {
    fireEvent.press(screen.getByText('1y'));
  });
  // Every reading in this series is within a year of 17 Aug.
  expect(screen.getByText(/across 5 visits/)).toBeTruthy();
});
