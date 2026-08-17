/**
 * The client drawer's "Last plan & next steps" caption and the prep reminder's subtitle may only
 * call the plan "signed" when the note that produced it really is — `lastPlan` is refreshed at
 * CAPTURE time, before any sign-off, and both surfaces used to hardcode the claim. A freshly
 * captured client's page simultaneously showed "Draft · review" on the note and "…, SIGNED" on the
 * plan drawn from that same note. These tests mount the real screens over a signed and an unsigned
 * backing note and pin that the caption tells the truth in each case (and makes no claim when the
 * backing note can't be identified).
 */
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { ThemeProvider } from '../../../../theme/ThemeProvider';
import { Client, DraftNote } from '../../../../data/types';
import { lastPlanProvenance } from '../../../../data/sessionClient';
import ClientDrawer from '../[clientId]';
import PrepReminder from '../prep';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ clientId: 'c1' }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

function makeNote(status: 'signed' | 'draft', sessionLabel: string): DraftNote {
  return {
    sessionLabel,
    sourceLine: 'test',
    status,
    riskLevel: 'clear',
    sections: [],
    measures: [],
    reviewCodes: [],
    prescriptions: [],
  };
}

const CLIENT: Client = {
  id: 'c1',
  name: 'New client',
  initials: 'NC',
  tokenId: 'c1-NC',
  age: null,
  status: 'intake',
  risk: 'clear',
  clientSince: 'Aug 18',
  sessionNumber: 1,
  lastSessionLabel: 'Today · Aug 18',
  followUp: 'Set at next session',
  latestScore: null,
  sparkline: [],
  focusTags: [],
  summaryLine: '',
  measures: [],
  timeline: [],
  lastPlan: [{ id: 'plan-0', text: 'Continue the agreed between-session practice', source: 'from Plan & Next Steps · Aug 18', done: false }],
};

// Mutable holders so each test can vary what the mocked hooks return (jest.mock factories may only
// reference `mock`-prefixed out-of-scope variables).
let mockNotes: DraftNote[] = [];
jest.mock('../../../../data/DataProvider', () => ({
  useClient: () => CLIENT,
  useClientNotes: () => mockNotes,
  useData: () => ({ savePatientDetails: jest.fn() }),
  usePatientDetails: () => ({}),
}));

function renderDrawer() {
  render(
    <ThemeProvider>
      <ClientDrawer />
    </ThemeProvider>,
  );
}

it('captions the plan "signed" only when the backing note really is signed', () => {
  mockNotes = [makeNote('signed', 'Session 1 — Aug 18')];
  renderDrawer();
  expect(screen.getByText(/Last plan & next steps · from Aug 18, signed/)).toBeTruthy();
});

it('captions a plan from an unsigned draft as such, never "signed"', () => {
  mockNotes = [makeNote('draft', 'Session 1 — Aug 18')];
  renderDrawer();
  expect(screen.getByText(/Last plan & next steps · from Aug 18, unsigned draft/)).toBeTruthy();
  expect(screen.queryByText(/, signed/)).toBeNull();
});

it('makes no attestation claim when the backing note cannot be identified', () => {
  mockNotes = [];
  renderDrawer();
  expect(screen.getByText(/Last plan & next steps · from Aug 18$/)).toBeTruthy();
  expect(screen.queryByText(/signed/)).toBeNull();
});

it('prep reminder says the plan is an unsigned draft when it is', () => {
  mockNotes = [makeNote('draft', 'Session 1 — Aug 18')];
  render(
    <ThemeProvider>
      <PrepReminder />
    </ThemeProvider>,
  );
  expect(screen.getByText(/drawn from the plan in the latest note \(Aug 18\), still an unsigned draft/)).toBeTruthy();
  expect(screen.queryByText(/last signed plan/)).toBeNull();
});

it('prep reminder keeps the "last signed plan" wording when the backing note is signed', () => {
  mockNotes = [makeNote('signed', 'Session 1 — Aug 18')];
  render(
    <ThemeProvider>
      <PrepReminder />
    </ThemeProvider>,
  );
  expect(screen.getByText(/drawn from the last signed plan \(Aug 18\)/)).toBeTruthy();
});

// The pure derivation itself: the fixture-shaped source formats (a different section prefix, a
// prose tail with no date, the plan rotated out of retention) all resolve honestly.
it('lastPlanProvenance reads the date past any section prefix and returns null status when unmatched', () => {
  const leahLike = { lastPlan: [{ id: 'lp1', text: 'x', source: 'from Risk & Safety Check · 5 Aug', done: false }] };
  expect(lastPlanProvenance(leahLike, [makeNote('signed', 'Session 8 — 5 Aug')])).toEqual({ dateLabel: '5 Aug', status: 'signed' });
  expect(lastPlanProvenance(leahLike, [])).toEqual({ dateLabel: '5 Aug', status: null });
  const proseTail = { lastPlan: [{ id: 'p3', text: 'x', source: 'standing safety item · re-screen every session', done: false }] };
  expect(lastPlanProvenance(proseTail, [makeNote('signed', 'Session 8 — 5 Aug')])).toEqual({ dateLabel: null, status: null });
  expect(lastPlanProvenance({ lastPlan: [] }, [])).toEqual({ dateLabel: null, status: null });
});
