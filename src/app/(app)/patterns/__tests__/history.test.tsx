/**
 * Session-history header — the client name/avatar chip must link to the patient page
 * (`/(app)/today/<clientId>`). Mounts the real screen so a deleted `onPress` fails this test.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { ThemeProvider } from '../../../../theme/ThemeProvider';
import { Client } from '../../../../data/types';
import SessionHistory from '../history';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => ({ clientId: 'marcus' }),
}));

const CLIENT: Client = {
  id: 'marcus',
  name: 'Marcus T.',
  initials: 'MT',
  tokenId: '7f1-MT',
  age: 34,
  status: 'active',
  risk: 'clear',
  clientSince: 'Feb 2026',
  sessionNumber: 3,
  lastSessionLabel: '2 Aug',
  followUp: 'in 1 week',
  latestScore: 5,
  sparkline: [],
  focusTags: [],
  summaryLine: '',
  measures: [],
  timeline: [],
  lastPlan: [],
};

jest.mock('../../../../data/DataProvider', () => ({
  useClient: () => CLIENT,
  useClientNotes: () => [],
}));

function renderScreen() {
  render(
    <ThemeProvider>
      <SessionHistory />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  mockPush.mockClear();
});

it('links the client chip in the history header to the patient page', () => {
  renderScreen();
  const link = screen.getByRole('link', { name: `Open ${CLIENT.name}’s page` });
  fireEvent.press(link);
  expect(mockPush).toHaveBeenCalledWith(`/(app)/today/${CLIENT.id}`);
});
