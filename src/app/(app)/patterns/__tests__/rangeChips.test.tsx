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

let mockCurrentClient: Client;
beforeEach(() => {
  mockCurrentClient = NOOR;
});

jest.mock('../../../../data/DataProvider', () => ({
  useClient: () => mockCurrentClient,
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
  // The caption is derived from the plotted readings: 10 → 9, down 1 since the range's first visit.
  expect(screen.getByText(/10 → 9 across 2 visits/)).toBeTruthy();
  expect(screen.getByText(/down 1 since 3 May/)).toBeTruthy();

  act(() => {
    fireEvent.press(screen.getByText('3m'));
  });
  // Only 12 Aug is within 3 months of 17 Aug — one reading is a point, not an arrow ("9 → 9").
  expect(screen.getByText(/One visit in this range · PHQ-9 9/)).toBeTruthy();

  act(() => {
    fireEvent.press(screen.getByText('1y'));
  });
  // Every reading in this series is within a year of 17 Aug.
  expect(screen.getByText(/18 → 9 across 5 visits/)).toBeTruthy();
  expect(screen.getByText(/down 9 since 12 Jan/)).toBeTruthy();
});

it('a worsening series reads "up", never a canned improvement claim', () => {
  jest.useFakeTimers({ now: new Date('2026-08-17T00:00:00Z') });
  // Sofia-shaped ground truth: 10 → 11 → 12 is a rise. The old fixed caption called every client
  // "down from moderate-severe at intake", contradicting the headline right above it.
  mockCurrentClient = {
    ...NOOR,
    measures: [
      {
        key: 'phq9',
        name: 'PHQ-9',
        readings: [
          { date: '2026-06-01', label: '1 Jun', value: 10 },
          { date: '2026-07-01', label: '1 Jul', value: 11 },
          { date: '2026-08-12', label: '12 Aug', value: 12 },
        ],
        latest: 12,
        band: 'moderate',
      },
    ],
  };
  renderScreen();

  expect(screen.getByText(/10 → 12 across 3 visits/)).toBeTruthy();
  expect(screen.getByText(/up 2 since 1 Jun/)).toBeTruthy();
  expect(screen.queryByText(/down from moderate-severe at intake/)).toBeNull();
});
