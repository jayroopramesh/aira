/**
 * fix-these #18: the caseload footnote used to hardcode "Leah C. opens the safety-review state" —
 * a name that drifts the moment the sample fixture set changes. It must be derived from whichever
 * client is actually at acute risk, and degrade to generic copy when none is.
 */
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import * as ReactNative from 'react-native';
import { ThemeProvider } from '../../../../theme/ThemeProvider';
import { Client } from '../../../../data/types';
import Caseload from '../index';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('../../../../services/auth', () => ({ authService: { getClinicianName: () => 'Dr. Test' } }));

jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 1200, height: 900, scale: 1, fontScale: 1 });

let mockClients: Client[] = [];

jest.mock('../../../../data/DataProvider', () => ({
  useClients: () => mockClients,
  useCaseloadKpis: () => [],
  useData: () => ({ hydrated: true, loadSample: jest.fn() }),
}));

function baseClient(overrides: Partial<Client>): Client {
  return {
    id: 'x',
    name: 'X',
    initials: 'X',
    tokenId: 'tok',
    age: 30,
    status: 'active',
    risk: 'clear',
    clientSince: '1 Jan',
    sessionNumber: 1,
    lastSessionLabel: '1 Jan',
    followUp: 'none',
    latestScore: null,
    sparkline: [],
    focusTags: [],
    summaryLine: '',
    measures: [],
    timeline: [],
    lastPlan: [],
    ...overrides,
  };
}

function renderScreen() {
  render(
    <ThemeProvider>
      <Caseload />
    </ThemeProvider>,
  );
}

it('names whichever client is actually at acute risk, not a hardcoded fixture name', () => {
  mockClients = [
    baseClient({ id: 'sami', name: 'Sami R.', risk: 'acute' }),
    baseClient({ id: 'noor', name: 'Noor A.', risk: 'watch' }),
  ];
  renderScreen();
  expect(screen.getByText(/Sami R\. opens the safety-review state\./)).toBeTruthy();
  expect(screen.queryByText(/Leah C\./)).toBeNull();
});

it('falls back to generic copy when no client is at acute risk', () => {
  mockClients = [baseClient({ id: 'noor', name: 'Noor A.', risk: 'watch' })];
  renderScreen();
  expect(screen.getByText(/a client at acute risk opens the safety-review state\./)).toBeTruthy();
});
