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
const mockUpdateNoteSection = jest.fn();
const mockUpdatePrescriptions = jest.fn();

jest.mock('../../../../data/DataProvider', () => ({
  useClient: () => CLIENT,
  useClientNotes: () => [mockDraft],
  useDraftNote: () => mockDraft,
  useData: () => ({
    signNote: mockSignNote,
    unlockNote: mockUnlockNote,
    updateNoteSection: mockUpdateNoteSection,
    generatePrescriptions: mockGeneratePrescriptions,
    updatePrescriptions: mockUpdatePrescriptions,
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
  mockUpdateNoteSection.mockClear();
  mockUpdatePrescriptions.mockClear();
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
  const playButton = await screen.findByText(/Play the stitched recording — the original plus 1 added segment, in order/);
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

it('recording comments persisted on the note render on the Transcript tab, stamped with their clock', () => {
  mockDraft = {
    ...DRAFT,
    transcript: 'Client reflected on cutting back drinking to weekends only.',
    recordingComments: [{ ts: '03:12', text: 'Change talk here — client named the weekend plan himself' }],
  };
  renderScreen();
  fireEvent.press(screen.getByText('Transcript'));
  expect(screen.getByText('03:12')).toBeTruthy();
  expect(screen.getByText('Change talk here — client named the weekend plan himself')).toBeTruthy();
});

it('recording comments still render when no transcript is stored (typed-recovery edge)', () => {
  mockDraft = { ...DRAFT, recordingComments: [{ ts: '00:41', text: 'Ask about sleep next time' }] };
  renderScreen();
  fireEvent.press(screen.getByText('Transcript'));
  expect(screen.getByText(/No transcript is stored/)).toBeTruthy();
  expect(screen.getByText('00:41')).toBeTruthy();
  expect(screen.getByText('Ask about sleep next time')).toBeTruthy();
});

/**
 * Section-editor list handling (round 3, 2026-08-18): a clinician typing a Plan list presses Enter
 * once between items — the editor must not silently merge those lines into ONE bullet (which then
 * becomes one merged reminder on prep and one merged prescription in "Generate from notes"). Each
 * line in the bullets region is its own item, typed `- `/`• ` markers are stripped (the list renders
 * its own glyph), and prose sections keep blank-line paragraph splitting so a manual line wrap
 * doesn't shatter a paragraph.
 */
const EDITABLE_DRAFT: DraftNote = {
  ...DRAFT,
  sections: [
    { id: 'subjective', marker: 'S', title: 'Subjective', body: ['Original subjective text.'] },
    { id: 'plan', marker: 'P', title: 'Plan & Next Steps', body: [], bullets: ['Not captured in this draft — review required'] },
  ],
};

it('plan items typed one per line become separate bullets, not one merged bullet', () => {
  mockDraft = EDITABLE_DRAFT;
  renderScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Edit Plan & Next Steps' }));
  const editor = screen.getByDisplayValue('Not captured in this draft — review required');
  fireEvent.changeText(editor, 'Send sister one short message\nNo screens after 23:00\nWorry journal once nightly');
  fireEvent.press(screen.getByRole('button', { name: 'Save your edits to Plan & Next Steps' }));
  expect(mockUpdateNoteSection).toHaveBeenCalledWith(CLIENT.id, 0, 'plan', [], [
    'Send sister one short message',
    'No screens after 23:00',
    'Worry journal once nightly',
  ]);
});

it('typed bullet markers are stripped from list items; a bare leading hyphen is kept', () => {
  mockDraft = EDITABLE_DRAFT;
  renderScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Edit Plan & Next Steps' }));
  const editor = screen.getByDisplayValue('Not captured in this draft — review required');
  fireEvent.changeText(editor, '- Sleep log daily\n• Message sister\n* Review next session\n-5 on the PHQ-9 is the target');
  fireEvent.press(screen.getByRole('button', { name: 'Save your edits to Plan & Next Steps' }));
  expect(mockUpdateNoteSection).toHaveBeenCalledWith(CLIENT.id, 0, 'plan', [], [
    'Sleep log daily',
    'Message sister',
    'Review next session',
    '-5 on the PHQ-9 is the target',
  ]);
});

it('prose sections keep blank-line paragraph splitting — a manual line wrap stays one paragraph', () => {
  mockDraft = EDITABLE_DRAFT;
  renderScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Edit Subjective' }));
  const editor = screen.getByDisplayValue('Original subjective text.');
  fireEvent.changeText(editor, 'Low mood for two weeks,\nworse at night.\n\nDenies thoughts of self-harm.');
  fireEvent.press(screen.getByRole('button', { name: 'Save your edits to Subjective' }));
  expect(mockUpdateNoteSection).toHaveBeenCalledWith(
    CLIENT.id,
    0,
    'subjective',
    ['Low mood for two weeks,\nworse at night.', 'Denies thoughts of self-harm.'],
    undefined,
  );
});

/**
 * Prescriptions-rail persistence (round 3, 2026-08-18): the rail's copy invites the clinician to
 * "write them … Tick as you assign", so a hand-written "+ Add" item and every tick must persist onto
 * the note through `updatePrescriptions` — before this they lived only in component state, and
 * switching notes in the session rail (a keyed remount) or reloading silently discarded them. The
 * tick writes the item's own persisted `done` field, and rendering reads that same field back, so a
 * remount shows exactly what was persisted.
 */
it('ticking a prescription persists done=true onto the note, not a throwaway local flag', () => {
  mockDraft = ALREADY_GENERATED_DRAFT;
  renderScreen();
  fireEvent.press(screen.getByRole('checkbox'));
  // Exact deep equality on the persisted item: the tick flips `done`, and no screen-local flag
  // (`isNew`) leaks into the stored note.
  expect(mockUpdatePrescriptions).toHaveBeenCalledWith(CLIENT.id, 0, [
    { id: 'gen-0', text: 'Continue the sleep log', source: 'from Plan', done: true, generated: true },
  ]);
});

it('committing a hand-written "+ Add" prescription persists it onto the note', () => {
  renderScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Add' }));
  const input = screen.getByPlaceholderText('New prescription…');
  fireEvent.changeText(input, 'Thought record — one entry each evening');
  fireEvent(input, 'submitEditing');
  expect(mockUpdatePrescriptions).toHaveBeenCalledWith(CLIENT.id, 0, [
    { id: expect.stringMatching(/^rx-new-/), text: 'Thought record — one entry each evening', source: 'added by you', done: false },
  ]);
});

it('an uncommitted "+ Add" draft row is never persisted', () => {
  renderScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Add' }));
  expect(mockUpdatePrescriptions).not.toHaveBeenCalled();
});

it('a prescription persisted as done renders ticked after a remount', () => {
  mockDraft = {
    ...DRAFT,
    prescriptions: [{ id: 'rx-1', text: 'Continue nightly sleep log', source: 'added by you', done: true }],
  };
  renderScreen();
  expect(screen.getByRole('checkbox', { checked: true })).toBeTruthy();
});

it('an existing multi-bullet list opens in the editor one item per line', () => {
  mockDraft = {
    ...DRAFT,
    sections: [{ id: 'plan', marker: 'P', title: 'Plan & Next Steps', body: [], bullets: ['Sleep log daily', 'Message sister'] }],
  };
  renderScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Edit Plan & Next Steps' }));
  expect(screen.getByDisplayValue('Sleep log daily\nMessage sister')).toBeTruthy();
});
