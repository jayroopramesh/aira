/**
 * "Undo sample data" (captain feedback round 2, item 4) — mounts the real Settings screen so a
 * deleted onPress or a dropped two-step confirm fails this test, not just the pure `computeSampleUndo`
 * derivation (proved separately in scripts/sample-undo-harness.mjs).
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { ThemeProvider } from '../../../../theme/ThemeProvider';
import Settings from '../index';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn() }) }));

jest.mock('../../../../services/auth', () => ({ authService: { signOut: jest.fn() } }));

const mockUndoSample = jest.fn();
let mockHasSampleData = true;

jest.mock('../../../../data/DataProvider', () => ({
  useData: () => ({
    clients: [{ id: 'amara' }],
    sampleLoaded: true,
    hasSampleData: mockHasSampleData,
    loadSample: jest.fn(),
    clearAll: jest.fn(),
    undoSample: mockUndoSample,
  }),
}));

function renderScreen() {
  render(
    <ThemeProvider>
      <Settings />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  mockUndoSample.mockReset();
  mockHasSampleData = true;
});

it('offers no "Undo sample data" control when nothing sample-origin remains', () => {
  mockHasSampleData = false;
  renderScreen();
  expect(screen.queryByText('Undo sample data')).toBeNull();
});

it('two-step confirms before calling undoSample, and reports the result', async () => {
  mockUndoSample.mockResolvedValue({ removedClients: 2, keptWithUserData: 1 });
  renderScreen();

  fireEvent.press(screen.getByText('Undo sample data'));
  // Confirm step: the destructive action is not fired by the first tap alone.
  expect(screen.getByText('Undo sample data?')).toBeTruthy();
  expect(mockUndoSample).not.toHaveBeenCalled();

  await act(async () => {
    fireEvent.press(screen.getByText('Yes, undo sample data'));
  });
  expect(mockUndoSample).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/Removed 2 sample clients you hadn’t touched\..*Kept 1 sample client you added a session or edit to/)).toBeTruthy();
});

it('Cancel on the confirm step never calls undoSample', () => {
  renderScreen();
  fireEvent.press(screen.getByText('Undo sample data'));
  fireEvent.press(screen.getByText('Cancel'));
  expect(mockUndoSample).not.toHaveBeenCalled();
  expect(screen.queryByText('Undo sample data?')).toBeNull();
});
