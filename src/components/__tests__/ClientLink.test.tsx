/**
 * `ClientLink` is the one place a client's name/avatar becomes a link to their patient page — every
 * screen listed in the aira-patient-nav PR body reuses it, so its own wiring is proved once here
 * rather than re-asserted identically in every screen's test.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { Client } from '../../data/types';
import { ClientLink } from '../ClientLink';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const CLIENT: Pick<Client, 'id' | 'name' | 'initials' | 'risk'> = {
  id: 'leah',
  name: 'Leah C.',
  initials: 'LC',
  risk: 'acute',
};

beforeEach(() => {
  mockPush.mockClear();
});

it('is a link role labelled with the client’s name, and navigates to their patient page', () => {
  render(
    <ThemeProvider>
      <ClientLink client={CLIENT}>
        <Text>Leah C.</Text>
      </ClientLink>
    </ThemeProvider>,
  );

  const link = screen.getByRole('link', { name: 'Open Leah C.’s page' });
  fireEvent.press(link);

  expect(mockPush).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith('/(app)/today/leah');
});
