/**
 * Caseload row click behavior (captain feedback round 2, item 1): the row's primary tap — ANYWHERE on
 * it — must open that client's patterns view; ONLY the underlined client name opens the patient page.
 * Mounts the real screen so a row rebuilt back into one link-swallowing Pressable (or a deleted
 * onPress) fails this test, in both the wide (table) and narrow (stacked) row layouts.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import * as ReactNative from 'react-native';
import { ThemeProvider } from '../../../../theme/ThemeProvider';
import { Client } from '../../../../data/types';
import Caseload from '../index';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

jest.mock('../../../../services/auth', () => ({ authService: { getClinicianName: () => 'Dr. Test' } }));

const windowDimensionsSpy = jest.spyOn(ReactNative, 'useWindowDimensions');

const CLIENTS: Client[] = [
  {
    id: 'leah',
    name: 'Leah C.',
    initials: 'LC',
    tokenId: '7f2-LC',
    age: 21,
    status: 'active',
    risk: 'acute',
    clientSince: '3 Feb',
    sessionNumber: 8,
    lastSessionLabel: 'today · 1:00',
    followUp: 'Safety review',
    followUpDue: true,
    latestScore: 16,
    sparkline: [17, 17, 16],
    focusTags: [],
    summaryLine: '',
    measures: [],
    timeline: [],
    lastPlan: [],
  },
];

jest.mock('../../../../data/DataProvider', () => ({
  useClients: () => CLIENTS,
  useCaseloadKpis: () => [],
  useData: () => ({ hydrated: true, loadSample: jest.fn() }),
}));

function renderScreen() {
  render(
    <ThemeProvider>
      <Caseload />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  mockPush.mockClear();
  windowDimensionsSpy.mockReturnValue({ width: 1200, height: 900, scale: 1, fontScale: 1 });
});

it('wide row: the name link opens the patient page, not patterns', () => {
  renderScreen();
  const nameLink = screen.getByRole('link', { name: 'Open Leah C.’s page' });
  fireEvent.press(nameLink);
  expect(mockPush).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith('/(app)/today/leah');
});

it('wide row: pressing elsewhere on the row (the status/session/risk area) opens patterns, not the patient page', () => {
  renderScreen();
  const patternsButtons = screen.getAllByRole('button', { name: 'Open Leah C.’s patterns' });
  expect(patternsButtons.length).toBeGreaterThan(1); // avatar + tokenId + the main row body are all siblings
  fireEvent.press(patternsButtons[patternsButtons.length - 1]); // the main status/session/risk region
  expect(mockPush).toHaveBeenCalledTimes(1);
  // Leah is acute → the caseload risk-review deep link.
  expect(mockPush).toHaveBeenCalledWith('/(app)/patterns/leah?risk=1');
});

it('wide row: pressing the avatar also opens patterns, never the patient page', () => {
  renderScreen();
  const patternsButtons = screen.getAllByRole('button', { name: 'Open Leah C.’s patterns' });
  fireEvent.press(patternsButtons[0]); // the avatar
  expect(mockPush).toHaveBeenCalledWith('/(app)/patterns/leah?risk=1');
});

it('narrow row: same split — name links to the patient, the row body opens patterns', () => {
  windowDimensionsSpy.mockReturnValue({ width: 500, height: 900, scale: 1, fontScale: 1 });
  renderScreen();

  const nameLink = screen.getByRole('link', { name: 'Open Leah C.’s page' });
  fireEvent.press(nameLink);
  expect(mockPush).toHaveBeenCalledWith('/(app)/today/leah');

  mockPush.mockClear();
  const patternsButtons = screen.getAllByRole('button', { name: 'Open Leah C.’s patterns' });
  fireEvent.press(patternsButtons[patternsButtons.length - 1]);
  expect(mockPush).toHaveBeenCalledWith('/(app)/patterns/leah?risk=1');
});
