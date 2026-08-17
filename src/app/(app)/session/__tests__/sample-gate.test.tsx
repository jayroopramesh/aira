/**
 * The fabrication line at the capture screen — canned sample content may only ever analyse for a
 * fully ANONYMOUS capture. A capture that names a real person (typed client name or Emirates ID, or
 * an attached client) must never be answered with the sample clip: its invented transcript ("Denies
 * passive ideation on screening today" is a safety finding nobody made), its working code and its
 * "47-min voice note" provenance would be saved into that person's record as an ordinary,
 * non-sample note that "Undo sample data" can never remove. This mounts the real screen and drives
 * the two routes to the sample (stopping with no live recorder, and "Use sample audio") because the
 * gate is pure wiring in this component — no harness can prove it from outside.
 *
 * (Split from index.test.tsx during the rebase over the Continue-recording work: the two suites
 * need incompatible audioCapture/DataProvider module mocks, so each keeps its own file.)
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../../theme/ThemeProvider';
import SessionCapture from '../index';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => ({}),
}));

const mockSaveSessionNote = jest.fn(async () => ({ clientId: 'c-new' }));
jest.mock('../../../../data/DataProvider', () => ({
  useClient: () => undefined,
  useClientNotes: () => [],
  useData: () => ({ saveSessionNote: mockSaveSessionNote, appendRecording: jest.fn(), hydrated: true }),
}));

// No mic and no upload in this environment, so "Tap to begin" lands on the Recording screen with no
// live recorder — the exact state whose Stop used to substitute the sample clip regardless of who
// the session was for. failedCaptureRef stays real so the analysing screen sees the true uri.
jest.mock('../../../../services/audioCapture', () => ({
  ...jest.requireActual('../../../../services/audioCapture'),
  isRecordingSupported: () => false,
  isUploadSupported: () => false,
  startRecording: async () => {
    throw new Error('no mic in tests');
  },
}));

jest.mock('../../../../services/cloudSession', () => ({
  cloudSessionReady: async () => false,
  isCloudSessionRequiredError: () => false,
}));

jest.mock('../../../../services/speakerSeparation', () => ({
  speakerSeparationService: null,
}));

const METRICS = { frame: { x: 0, y: 0, width: 1200, height: 900 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

// The first sentence of the canned sample transcript (MOCK_TRANSCRIPT_TEXT) — if any of it appears
// in the transcript box for a named capture, invented words are one "draft" tap from a real record.
const SAMPLE_WORDS = /steadier fortnight/;

function renderScreen() {
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider>
        <SessionCapture />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

async function startCapture() {
  fireEvent.press(screen.getByLabelText('Tap to start capture'));
  await waitFor(() => expect(screen.getByText('Stop & transcribe')).toBeTruthy());
}

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
  mockSaveSessionNote.mockClear();
});

it('stopping with no recorder and a typed client name refuses the sample and lands in type/paste recovery', async () => {
  renderScreen();
  fireEvent.changeText(screen.getByPlaceholderText('e.g. a first name or initials'), 'Rashid');
  await startCapture();
  // The mic-unavailable caution must already say the sample will not run under this client.
  expect(screen.getByText(/the fictional sample won’t run under Rashid’s record/)).toBeTruthy();
  fireEvent.press(screen.getByText('Stop & transcribe'));
  await waitFor(() => expect(screen.getByText(/type or paste the transcript below/i)).toBeTruthy());
  expect(screen.queryByDisplayValue(SAMPLE_WORDS)).toBeNull();
});

it('stopping with no recorder and a typed Emirates ID also refuses the sample', async () => {
  renderScreen();
  fireEvent.changeText(screen.getByPlaceholderText('784-XXXX-XXXXXXX-X'), '784-1992-7654321-1');
  await startCapture();
  fireEvent.press(screen.getByText('Stop & transcribe'));
  await waitFor(() => expect(screen.getByText(/type or paste the transcript below/i)).toBeTruthy());
  expect(screen.queryByDisplayValue(SAMPLE_WORDS)).toBeNull();
});

it('stopping an anonymous capture with no recorder still runs the sample walkthrough', async () => {
  renderScreen();
  await startCapture();
  fireEvent.press(screen.getByText('Stop & transcribe'));
  await waitFor(() => expect(screen.getByDisplayValue(SAMPLE_WORDS)).toBeTruthy(), { timeout: 6000 });
}, 10000);

it('"Use sample audio" with a typed client name explains instead of running the walkthrough', async () => {
  renderScreen();
  fireEvent.changeText(screen.getByPlaceholderText('e.g. a first name or initials'), 'Amina');
  fireEvent.press(screen.getByText('Use sample audio'));
  await waitFor(() => expect(screen.getByText(/fictional walkthrough, so it can’t be filed under a real client/)).toBeTruthy());
  // Still on the pre-capture screen — the sample never started analysing.
  expect(screen.getByLabelText('Tap to start capture')).toBeTruthy();
});

it('"Use sample audio" with no identity attached runs the walkthrough', async () => {
  renderScreen();
  fireEvent.press(screen.getByText('Use sample audio'));
  await waitFor(() => expect(screen.getByDisplayValue(SAMPLE_WORDS)).toBeTruthy(), { timeout: 6000 });
}, 10000);
