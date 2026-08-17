/**
 * Session review header — the client name/avatar chip must be a real link to the patient page
 * (`/(app)/today/<clientId>`), never a dead promise. Mounts the real screen (not just the shared
 * `ClientLink` in isolation) so a deleted `onPress` here would fail this test the way the Escalate
 * sheet's wiring tests are designed to catch the same class of regression.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../../theme/ThemeProvider';
import { Client, DraftNote } from '../../../../data/types';
import ReviewNote from '../review';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => ({ clientId: 'amara' }),
}));

jest.mock('../../../../services/auth', () => ({
  authService: { getClinicianName: () => 'Test Clinician' },
}));

// A mutable module-scope fixture the mock reads on every render (same pattern as `mockDraft` below),
// so individual tests can control what `audioVault` claims is kept for THIS note without touching
// the real in-memory registry (which `session/index.tsx` alone writes to).
let mockAudioSegments: { uri: string; durationMs: number; kind: 'original' | 'added'; label: string }[] = [];
jest.mock('../../../../services/audioVault', () => ({
  getAudioSegments: () => mockAudioSegments,
}));

const CLIENT: Client = {
  id: 'amara',
  name: 'Amara K.',
  initials: 'AK',
  tokenId: '4c9-AK',
  age: 21,
  status: 'active',
  risk: 'watch',
  clientSince: 'Jan 2026',
  sessionNumber: 5,
  lastSessionLabel: '5 Aug',
  followUp: 'in 2 weeks',
  latestScore: 9,
  sparkline: [],
  focusTags: [],
  summaryLine: '',
  measures: [],
  timeline: [],
  lastPlan: [],
};

const DRAFT: DraftNote = {
  sessionLabel: 'Session 5 — 12 Aug',
  sourceLine: 'From a 47-min voice note',
  status: 'draft',
  sections: [],
  measures: [],
  reviewCodes: [],
  prescriptions: [],
};

const SIGNED_DRAFT: DraftNote = {
  ...DRAFT,
  status: 'signed',
  signedBy: 'Test Clinician',
  signedAt: '17 Aug 09:00',
};

const REOPENED_DRAFT: DraftNote = {
  ...DRAFT,
  status: 'draft',
  signedBy: 'Test Clinician',
  signedAt: '17 Aug 09:00',
};

const DRAFT_WITH_PLAN: DraftNote = {
  ...DRAFT,
  sections: [{ id: 'sec-p', marker: 'P', title: 'Plan', body: [], bullets: ['Continue the sleep log'] }],
};

const ALREADY_GENERATED_DRAFT: DraftNote = {
  ...DRAFT_WITH_PLAN,
  prescriptionsGenerated: true,
  prescriptions: [{ id: 'gen-0', text: 'Continue the sleep log', source: 'from Plan', done: false, generated: true }],
};

// A mutable module-scope fixture the mock reads on every render, so individual tests can swap in a
// signed/reopened draft without re-mocking the module (name prefixed "mock" — required by
// babel-plugin-jest-hoist for a jest.mock() factory to reference an out-of-scope variable).
let mockDraft: DraftNote = DRAFT;
const mockSignNote = jest.fn();
const mockUnlockNote = jest.fn();
const mockGeneratePrescriptions = jest.fn();

jest.mock('../../../../data/DataProvider', () => ({
  useClient: () => CLIENT,
  useClientNotes: () => [mockDraft],
  useDraftNote: () => mockDraft,
  useData: () => ({
    signNote: mockSignNote,
    unlockNote: mockUnlockNote,
    updateNoteSection: jest.fn(),
    generatePrescriptions: mockGeneratePrescriptions,
  }),
}));

const METRICS = { frame: { x: 0, y: 0, width: 1200, height: 900 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function renderScreen() {
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider>
        <ReviewNote />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
  mockSignNote.mockClear();
  mockUnlockNote.mockClear();
  mockGeneratePrescriptions.mockClear();
});

afterEach(() => {
  mockDraft = DRAFT;
  mockAudioSegments = [];
});

it('links the header client chip to the patient page', () => {
  renderScreen();
  const link = screen.getByRole('link', { name: `Open ${CLIENT.name}’s page` });
  fireEvent.press(link);
  expect(mockPush).toHaveBeenCalledWith(`/(app)/today/${CLIENT.id}`);
});

it('shows the ordinary draft trust pill for a note that was never signed', () => {
  renderScreen();
  expect(screen.getByText('Draft stays on this device')).toBeTruthy();
});

it('shows a signed & locked trust pill once the note is signed', () => {
  mockDraft = SIGNED_DRAFT;
  renderScreen();
  expect(screen.getByText('Signed & locked · stays on this device')).toBeTruthy();
});

it('shows an unlocked-for-edits trust pill for a draft reopened after being signed', () => {
  mockDraft = REOPENED_DRAFT;
  renderScreen();
  expect(screen.getByText('Unlocked for edits · stays on this device')).toBeTruthy();
});

it('requires an explicit confirm before unlocking a signed note', () => {
  mockDraft = SIGNED_DRAFT;
  renderScreen();
  fireEvent.press(screen.getByText('Unlock note'));
  expect(mockUnlockNote).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Confirm unlock'));
  expect(mockUnlockNote).toHaveBeenCalledWith(CLIENT.id, 0);
});

it('cancel disarms the unlock confirm without unlocking', () => {
  mockDraft = SIGNED_DRAFT;
  renderScreen();
  fireEvent.press(screen.getByText('Unlock note'));
  fireEvent.press(screen.getByText('Cancel'));
  expect(mockUnlockNote).not.toHaveBeenCalled();
  expect(screen.queryByText('Confirm unlock')).toBeNull();
});

// Signing is a one-way door (the note becomes read-only), so a single tap must never attest the
// note — the first press only arms the control, and only the explicit confirm calls signNote.
it('requires an explicit confirm before signing', () => {
  renderScreen();
  fireEvent.press(screen.getAllByText('Sign off')[0]);
  expect(mockSignNote).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Confirm sign-off'));
  expect(mockSignNote).toHaveBeenCalledTimes(1);
});

it('cancel disarms the sign-off confirm without signing', () => {
  renderScreen();
  fireEvent.press(screen.getAllByText('Sign off')[0]);
  fireEvent.press(screen.getByText('Cancel'));
  expect(mockSignNote).not.toHaveBeenCalled();
  expect(screen.queryByText('Confirm sign-off')).toBeNull();
});

it('"Generate from notes" is once per note: pressing it persists the pull and disables the control', async () => {
  mockDraft = DRAFT_WITH_PLAN;
  renderScreen();
  const button = screen.getByRole('button', { name: 'Generate from notes' });
  fireEvent.press(button);
  await waitFor(() =>
    expect(mockGeneratePrescriptions).toHaveBeenCalledWith(
      CLIENT.id,
      0,
      expect.arrayContaining([expect.objectContaining({ text: 'Continue the sleep log', generated: true })]),
    ),
  );
});

it('a note already generated for (persisted, survives reload) stays disabled without a fresh click', () => {
  mockDraft = ALREADY_GENERATED_DRAFT;
  renderScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Generate from notes' }));
  // The persisted flag — not a local click — is what disables it, so a re-render with the SAME
  // persisted note never re-fires the pull, exactly the reload case the captain asked for.
  expect(mockGeneratePrescriptions).not.toHaveBeenCalled();
});

it('re-record on an unsigned draft requires an explicit confirm before navigating', () => {
  mockDraft = DRAFT;
  renderScreen();
  fireEvent.press(screen.getByText('Re-record this session'));
  expect(mockReplace).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Start new recording'));
  expect(mockReplace).toHaveBeenCalledWith(`/(app)/session?clientId=${CLIENT.id}`);
});

it('re-record on a signed note navigates immediately with no confirm', () => {
  mockDraft = SIGNED_DRAFT;
  renderScreen();
  fireEvent.press(screen.getByText('Re-record this session'));
  expect(mockReplace).toHaveBeenCalledWith(`/(app)/session?clientId=${CLIENT.id}`);
});

// "Continue recording" (captain, 2026-08-17) — visible next to Re-record on an unsigned draft, and never
// on a signed note (read-only), with no confirm dialog to bypass either way (append is additive).
it('"Continue recording" is offered on an unsigned draft and navigates in append mode for this note', () => {
  mockDraft = DRAFT;
  renderScreen();
  fireEvent.press(screen.getByText('Continue recording'));
  expect(mockReplace).toHaveBeenCalledWith(`/(app)/session?clientId=${CLIENT.id}&mode=append&note=0`);
});

it('"Continue recording" is absent on a signed note', () => {
  mockDraft = SIGNED_DRAFT;
  renderScreen();
  expect(screen.queryByText('Continue recording')).toBeNull();
});

/**
 * Stitched-playback wiring (captain addition, 2026-08-17): "Keep the audio" only offers real
 * sequential playback when `audioVault` actually has something for THIS note — mounts the real
 * `AudioTrust` card (via the full review screen) so a dropped `clientId`/`noteIndex` prop, or the
 * `window.Audio` construction, fails this test the way other wiring tests here catch a deleted
 * `onPress`. A minimal fake `window.Audio` stands in for the browser constructor (absent by default
 * in this RN test environment), matching the "no live stream / API → honest fallback" posture used
 * elsewhere in this app rather than skipping the interaction entirely.
 */
class FakeAudio {
  static instances: FakeAudio[] = [];
  src: string;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(src?: string) {
    this.src = src ?? '';
    FakeAudio.instances.push(this);
  }
  play() {
    return Promise.resolve();
  }
  pause() {}
}

const SEGMENTS = [
  { uri: 'blob:https://app.example/original', durationMs: 60000, kind: 'original' as const, label: 'Original recording' },
  { uri: 'blob:https://app.example/added-1', durationMs: 30000, kind: 'added' as const, label: 'Added · 17 Aug 21:11' },
];

beforeEach(() => {
  FakeAudio.instances = [];
  (globalThis as unknown as { window: { Audio: unknown } }).window.Audio = FakeAudio;
});

it('"Keep the audio" with real segments offers a real stitched play control', async () => {
  mockDraft = SIGNED_DRAFT;
  mockAudioSegments = SEGMENTS;
  renderScreen();
  fireEvent.press(screen.getByRole('switch'));
  const playButton = await screen.findByText(/Play the stitched recording: the original plus 1 added segment, in order/);
  fireEvent.press(playButton);
  expect(FakeAudio.instances).toHaveLength(1);
  expect(FakeAudio.instances[0].src).toBe(SEGMENTS[0].uri);
  // `play()` resolves asynchronously (real `HTMLMediaElement.play()` returns a Promise) and flips the
  // label to "Pause" — let that settle before the test ends so the update lands inside `act`.
  await screen.findByText('Pause');
});

it('"Keep the audio" with no real segments says so honestly instead of offering a dead Play button', () => {
  mockDraft = SIGNED_DRAFT;
  mockAudioSegments = [];
  renderScreen();
  fireEvent.press(screen.getByRole('switch'));
  expect(screen.getByText(/Nothing to play back/)).toBeTruthy();
  expect(screen.queryByText(/Play the stitched recording/)).toBeNull();
});
