/**
 * Session capture screen — wiring tests for the three captain additions (2026-08-17) that live on
 * the "recording" phase: pause/resume (a paused-then-resumed recording stays ONE segment), and the
 * live waveform being driven by the SAME `ActiveRecording` rather than always falling back to the
 * ambient canned animation. Mounts the real screen (not the pieces in isolation) so a dropped prop —
 * `activeRecording` never reaching `Recording`, `getLevels` never reaching `Waveform` — fails this
 * test the way other wiring tests in this app catch a deleted `onPress`/prop the same way.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../../theme/ThemeProvider';
import SessionCapture from '../index';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => ({ clientId: undefined }),
}));

// Shared across renders so the comments-survive-stop test below can assert on the exact note the
// screen handed to the save path (name prefixed "mock" — required by babel-plugin-jest-hoist for a
// jest.mock() factory to reference an out-of-scope variable).
const mockSaveSessionNote = jest.fn(async (_note: unknown, _identity?: unknown) => ({ clientId: 'c-1' }));

jest.mock('../../../../data/DataProvider', () => ({
  useClient: () => undefined,
  useClientNotes: () => [],
  useData: () => ({ saveSessionNote: mockSaveSessionNote, appendRecording: jest.fn(), hydrated: true }),
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
// `stop()` resolves immediately by default; a test that needs the real double-tap window (a stop
// still in flight when the second tap lands) flips `mockStopDeferred` and resolves by hand.
let mockStopDeferred = false;
let mockStopResolve: ((ref: { uri: string; durationMs: number }) => void) | undefined;
const mockStop = jest.fn(() =>
  mockStopDeferred
    ? new Promise<{ uri: string; durationMs: number }>((resolve) => {
        mockStopResolve = resolve;
      })
    : Promise.resolve({ uri: 'blob:https://app.example/test', durationMs: 1000 }),
);
const mockStartRecording = jest.fn(() =>
  Promise.resolve({
    stop: mockStop,
    pause: mockPause,
    resume: mockResume,
    get supportsPause() {
      return mockSupportsPause;
    },
    getLevels: mockGetLevels,
  }),
);

jest.mock('../../../../services/audioCapture', () => ({
  isRecordingSupported: () => true,
  isUploadSupported: () => false,
  pickAudioFile: () => Promise.resolve(null),
  failedCaptureRef: (durationMs = 0) => ({ uri: 'capture://unavailable', durationMs }),
  // Lazy indirection on purpose: the hoisted factory runs before the const above initialises, so a
  // direct `startRecording: mockStartRecording` captures undefined.
  startRecording: () => mockStartRecording(),
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
  mockStopDeferred = false;
  mockStopResolve = undefined;
  mockPause.mockClear();
  mockResume.mockClear();
  mockGetLevels.mockClear();
  mockSaveSessionNote.mockClear();
  mockStop.mockClear();
  mockStartRecording.mockClear();
});

// An AnnoMI-style dictated recap — ≥12 varied words so the F11 quality guard lets it draft.
const MI_TRANSCRIPT =
  'Client reflected on cutting back drinking to weekends only. We explored what a typical evening ' +
  'looks like and he named stress after work as the main trigger. Agreed to track urges this week ' +
  'and revisit the plan at the next session.';

/** Drive the type/paste recovery (this mock build refuses to transcribe a real capture) to a saved
 *  note, so tests can assert on exactly what reached the persistence seam. */
async function stopTypeAndDraft() {
  fireEvent.press(screen.getByText('Stop & transcribe'));
  await waitFor(() => expect(screen.getByPlaceholderText('Transcript will appear here.')).toBeTruthy());
  fireEvent.changeText(screen.getByPlaceholderText('Transcript will appear here.'), MI_TRANSCRIPT);
  fireEvent.press(screen.getByText('Next → draft the note'));
  await waitFor(() => expect(mockSaveSessionNote).toHaveBeenCalledTimes(1));
  return mockSaveSessionNote.mock.calls[0][0] as { recordingComments?: { ts: string; text: string }[] };
}

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

// ---- "Comment on your recording" — the strip promises comments are KEPT with the note, so they must
// survive the recording phase and reach the note handed to the save path (they used to die in the
// strip's local state the moment recording stopped, silently discarding what the clinician typed).

it('a comment added during recording survives stop and lands on the drafted note', async () => {
  await goToRecording();
  fireEvent.changeText(screen.getByPlaceholderText('Type a comment…'), 'Change talk here — client named the weekend plan himself');
  fireEvent.press(screen.getByLabelText('Add comment at this moment'));
  const note = await stopTypeAndDraft();
  expect(note.recordingComments).toEqual([
    { ts: expect.any(String), text: 'Change talk here — client named the weekend plan himself' },
  ]);
});

it('a comment still sitting un-submitted in the add card survives stop too', async () => {
  await goToRecording();
  fireEvent.changeText(screen.getByPlaceholderText('Type a comment…'), 'Ask about sleep next time');
  const note = await stopTypeAndDraft();
  expect(note.recordingComments).toEqual([{ ts: expect.any(String), text: 'Ask about sleep next time' }]);
});

it('a capture with no comments stamps none onto the note', async () => {
  await goToRecording();
  const note = await stopTypeAndDraft();
  expect(note.recordingComments).toBeUndefined();
});

// ---- Double-tap guards (2026-08-18) — both capture transitions hold an `await` open while their
// button is still on screen, so an impatient second tap used to re-enter mid-transition. On Stop
// that meant the no-recorder branch answered a REALLY-recorded anonymous session with the demo
// sample's canned transcript ("Denies passive ideation on screening today" is a safety finding
// nobody made); on Record it opened a second mic stream and leaked the first.

it('a double-tap on Stop & transcribe never swaps the real recording for the demo sample', async () => {
  mockStopDeferred = true;
  await goToRecording();
  fireEvent.press(screen.getByText('Stop & transcribe'));
  fireEvent.press(screen.getByText('Stop & transcribe'));
  // The recording phase must hold until the real stop() resolves — if the second tap had taken the
  // no-recorder branch, the screen would already be analysing the mock:// sample clip.
  expect(screen.getByText('Stop & transcribe')).toBeTruthy();
  expect(mockStop).toHaveBeenCalledTimes(1);
  await act(async () => {
    mockStopResolve!({ uri: 'blob:https://app.example/test', durationMs: 1000 });
  });
  // The REAL capture finalised: this build refuses to transcribe it (typed recovery), and the
  // canned sample transcript is nowhere on screen.
  await waitFor(() => expect(screen.getByPlaceholderText('Transcript will appear here.')).toBeTruthy());
  expect(screen.queryByDisplayValue(/steadier fortnight/)).toBeNull();
});

it('a double-tap on Tap to start capture opens one recorder, not two', async () => {
  renderScreen();
  fireEvent.press(screen.getByLabelText('Tap to start capture'));
  fireEvent.press(screen.getByLabelText('Tap to start capture'));
  await waitFor(() => expect(screen.getByText('Pause')).toBeTruthy());
  expect(mockStartRecording).toHaveBeenCalledTimes(1);
});
