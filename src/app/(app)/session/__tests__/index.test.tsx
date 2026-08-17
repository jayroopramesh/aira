/**
 * Session capture screen — wiring tests for the three captain additions (2026-08-17) that live on
 * the "recording" phase: pause/resume (a paused-then-resumed recording stays ONE segment), and the
 * live waveform being driven by the SAME `ActiveRecording` rather than always falling back to the
 * ambient canned animation. Mounts the real screen (not the pieces in isolation) so a dropped prop —
 * `activeRecording` never reaching `Recording`, `getLevels` never reaching `Waveform` — fails this
 * test the way other wiring tests in this app catch a deleted `onPress`/prop the same way.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../../theme/ThemeProvider';
import SessionCapture from '../index';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => ({ clientId: undefined }),
}));

jest.mock('../../../../data/DataProvider', () => ({
  useClient: () => undefined,
  useClientNotes: () => [],
  useData: () => ({ saveSessionNote: jest.fn(), appendRecording: jest.fn(), hydrated: true }),
}));

jest.mock('../../../../services/cloudSession', () => ({
  cloudSessionReady: () => Promise.resolve(false),
  isCloudSessionRequiredError: () => false,
}));

// A fake ActiveRecording standing in for a real MediaRecorder + AnalyserNode — the exact shape
// `audioCapture.ts`'s `startRecording()` resolves in the browser, so the screen is exercised through
// its real prop-threading rather than a shortcut.
const mockPause = jest.fn();
const mockResume = jest.fn();
const mockGetLevels = jest.fn((bars: number) => new Array(bars).fill(0.6));
let mockSupportsPause = true;

jest.mock('../../../../services/audioCapture', () => ({
  isRecordingSupported: () => true,
  isUploadSupported: () => false,
  pickAudioFile: () => Promise.resolve(null),
  failedCaptureRef: (durationMs = 0) => ({ uri: 'capture://unavailable', durationMs }),
  startRecording: () =>
    Promise.resolve({
      stop: () => Promise.resolve({ uri: 'blob:https://app.example/test', durationMs: 1000 }),
      pause: mockPause,
      resume: mockResume,
      get supportsPause() {
        return mockSupportsPause;
      },
      getLevels: mockGetLevels,
    }),
}));

// The live-mode branch of Waveform (real levels vs the ambient fallback) is proved directly by its
// own unit behaviour; here we only need to see WHICH mode it was handed, so a lightweight spy stands
// in for the real component without pulling in Animated/requestAnimationFrame timing into this test.
jest.mock('../../../../components/Waveform', () => {
  const { Text } = require('react-native');
  return {
    Waveform: ({ getLevels }: { getLevels?: (bars: number) => number[] | null }) => (
      <Text>{getLevels ? 'live-waveform' : 'ambient-waveform'}</Text>
    ),
  };
});

const METRICS = { frame: { x: 0, y: 0, width: 800, height: 900 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function renderScreen() {
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider>
        <SessionCapture />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

async function goToRecording() {
  renderScreen();
  fireEvent.press(screen.getByLabelText('Tap to start capture'));
  await waitFor(() => expect(screen.getByText('Pause')).toBeTruthy());
}

beforeEach(() => {
  mockSupportsPause = true;
  mockPause.mockClear();
  mockResume.mockClear();
  mockGetLevels.mockClear();
});

it('the live waveform is driven by the real ActiveRecording, not the ambient fallback', async () => {
  await goToRecording();
  expect(screen.getByText('live-waveform')).toBeTruthy();
  expect(screen.queryByText('ambient-waveform')).toBeNull();
});

it('Pause calls the recorder and flips the label to Resume without ending the recording', async () => {
  await goToRecording();
  fireEvent.press(screen.getByText('Pause'));
  expect(mockPause).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.getByText('Resume')).toBeTruthy());
  expect(screen.getAllByText('Paused', { exact: false }).length).toBeGreaterThan(0);
});

it('Resume calls the recorder and flips the label back to Pause — one segment, not a new capture', async () => {
  await goToRecording();
  fireEvent.press(screen.getByText('Pause'));
  await waitFor(() => expect(screen.getByText('Resume')).toBeTruthy());
  fireEvent.press(screen.getByText('Resume'));
  expect(mockResume).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.getByText('Pause')).toBeTruthy());
});

it('degrades honestly when the recorder does not support pause/resume — no dead control offered', async () => {
  mockSupportsPause = false;
  renderScreen();
  fireEvent.press(screen.getByLabelText('Tap to start capture'));
  await waitFor(() => expect(screen.getByText('Stop & transcribe')).toBeTruthy());
  expect(screen.queryByText('Pause')).toBeNull();
});
