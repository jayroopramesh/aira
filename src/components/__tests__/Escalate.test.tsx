/**
 * Escalate sheet — render-and-press wiring.
 *
 * `scripts/escalate-targets-harness.mjs` proves the DATA (every action resolves to the right
 * `tel:`/`https:`/`mailto:`/route target). It cannot prove the component still HANDS that target to
 * anything: delete `onPress` from the row, or gut `runAction`, and the pure-data harness stays
 * green while the surface goes inert — the exact regression this sheet already suffered once.
 *
 * So these tests mount the real sheet, press each real row, and assert the press reaches
 * `Linking.openURL` / `router.push` with the exact expected target — and that the honestly-disabled
 * safety-plan row reaches neither.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Linking, Pressable, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { EscalateProvider, useEscalate } from '../Escalate';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function OpenEscalate({ clientId, clientToken }: { clientId?: string; clientToken?: string }) {
  const { open } = useEscalate();
  return (
    <Pressable testID="open-escalate" onPress={() => open({ clientId, clientToken })}>
      <Text>open</Text>
    </Pressable>
  );
}

/** Mounts the real provider + sheet and opens it, exactly as a screen's Escalate button does. */
function openSheet(opts: { clientId?: string; clientToken?: string } = {}) {
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider>
        <EscalateProvider>
          <OpenEscalate clientId={opts.clientId} clientToken={opts.clientToken} />
        </EscalateProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  fireEvent.press(screen.getByTestId('open-escalate'));
}

let openURL: jest.SpyInstance;

beforeEach(() => {
  mockPush.mockClear();
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

afterEach(() => {
  openURL.mockRestore();
});

describe('pressing a row hands its exact target to the platform', () => {
  // Row label -> the target the press must produce. Transcribed from the safety brief, same
  // numbers the pure-data harness pins.
  const ROWS: [string, string][] = [
    ['Call a crisis line', 'tel:8004673'],
    ['Police', 'tel:999'],
    ['Rashid Hospital', 'tel:042192000'],
    ['Dubai Health Authority', 'https://www.dha.gov.ae/'],
    ['The LightHouse Arabia Centre for Wellbeing', 'tel:043802088'],
    ['LightHouse Arabia website', 'https://www.lighthousearabia.com/'],
  ];

  it.each(ROWS)('"%s" opens %s', async (title, href) => {
    openSheet();
    fireEvent.press(screen.getByText(title));

    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledWith(href);
    expect(mockPush).not.toHaveBeenCalled();

    // The sheet dismisses only once the hand-off actually succeeded.
    await waitFor(() => expect(screen.queryByText(title)).toBeNull());
  });

  it('the warm handoff drafts a mailto and never carries the raw client id', async () => {
    openSheet({ clientId: 'client-42', clientToken: 'TOKEN-9' });
    fireEvent.press(screen.getByText('Warm handoff to on-call'));

    expect(openURL).toHaveBeenCalledTimes(1);
    const [href] = openURL.mock.calls[0] as [string];
    expect(href.startsWith('mailto:on-call@clinic.example?')).toBe(true);
    expect(href).toContain('TOKEN-9');
    expect(href).not.toContain('client-42');
    await act(async () => {});
  });
});

describe('the safety plan row', () => {
  it('routes to the exact client route when a client is in context', async () => {
    openSheet({ clientId: 'client-42' });
    fireEvent.press(screen.getByText('Open the safety plan'));

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/(app)/patterns/safety-plan?clientId=client-42');
    expect(openURL).not.toHaveBeenCalled();
  });

  it('is honestly disabled with no client, and pressing it does nothing at all', () => {
    openSheet();
    const row = screen.getByText('Open the safety plan');
    expect(screen.getByText(/a safety plan belongs to a specific client/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Open the safety plan/ }).props.accessibilityState).toMatchObject({
      disabled: true,
    });

    fireEvent.press(row);

    expect(openURL).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    // ...and it does not silently dismiss either, which would read as "something happened".
    expect(screen.getByText('Open the safety plan')).toBeTruthy();
  });
});

describe('when the device refuses to open a target', () => {
  it('keeps the sheet open and hands back the number to dial by hand', async () => {
    openURL.mockRejectedValue(new Error('no registered handler'));
    openSheet();

    fireEvent.press(screen.getByText('Police'));

    expect(await screen.findByText(/Dial 999 yourself/)).toBeTruthy();
    // The sheet is still open — the row that promised "opens your dialer" has not dismissed onto
    // nothing.
    expect(screen.getByText('Police')).toBeTruthy();
  });

  it('hands back a grouped number exactly as the brief writes it, not the dialled digits', async () => {
    openURL.mockRejectedValue(new Error('no registered handler'));
    openSheet();

    fireEvent.press(screen.getByText('Rashid Hospital'));

    expect(await screen.findByText(/Dial 04 219 2000 yourself/)).toBeTruthy();
    expect(screen.queryByText(/Dial 042192000 yourself/)).toBeNull();
  });

  it('does not tell the counselor to write to the placeholder on-call address', async () => {
    // This lane runs with EXPO_PUBLIC_ONCALL_EMAIL scrubbed (jest.setup.js), i.e. the CI and
    // fresh-clone build, whose address is the deliberately undeliverable on-call@clinic.example.
    openURL.mockRejectedValue(new Error('no registered handler'));
    openSheet({ clientId: 'client-42', clientToken: 'TOKEN-9' });

    fireEvent.press(screen.getByText('Warm handoff to on-call'));

    expect(await screen.findByText(/no on-call address is configured for this build/)).toBeTruthy();
    expect(screen.queryByText(/Write to on-call@clinic\.example yourself/)).toBeNull();
  });

  it('names the web address when a url will not open', async () => {
    openURL.mockRejectedValue(new Error('no registered handler'));
    openSheet();

    fireEvent.press(screen.getByText('Dubai Health Authority'));

    // Matched on the failure sentence, not the bare URL — the row's own subtitle already carries
    // that URL, so a looser matcher would pass with the onPress wiring removed entirely.
    expect(await screen.findByText(/Visit https:\/\/www\.dha\.gov\.ae\/ yourself/)).toBeTruthy();
  });

  it('clears a previous failure when the sheet is reopened', async () => {
    openURL.mockRejectedValue(new Error('no registered handler'));
    openSheet();

    fireEvent.press(screen.getByText('Police'));
    expect(await screen.findByText(/Dial 999 yourself/)).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Close'));
    fireEvent.press(screen.getByTestId('open-escalate'));

    expect(screen.queryByText(/Dial 999 yourself/)).toBeNull();
  });
});
