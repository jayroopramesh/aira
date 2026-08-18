/**
 * Boot routing (round 5, Yuki Tanaka): `/` must route from the device's own evidence, never a
 * hardcoded "everyone is new". A returning clinician — persisted account email/name, full caseload —
 * reopening the app after an interruption was dumped into the first-run "Setup · 20% started"
 * onboarding, reading as "the app forgot me". These tests mount the real root index and assert the
 * three destinations: open vault → day board, existing account → unlock, fresh device → welcome.
 */
import { render, waitFor } from '@testing-library/react-native';
import React from 'react';
import Index from '../index';

const mockRedirects: string[] = [];

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: unknown }) => {
    mockRedirects.push(typeof href === 'string' ? href : JSON.stringify(href));
    return null;
  },
}));

const mockAuthState = {
  knownEmail: null as string | null,
  clinicianName: null as string | null,
};

jest.mock('../../services/auth', () => ({
  authService: {
    whenHydrated: () => Promise.resolve(),
    getKnownEmail: () => mockAuthState.knownEmail,
    getClinicianName: () => mockAuthState.clinicianName,
  },
}));

const mockVaultState = { unlocked: false };
jest.mock('../../services/storage', () => ({
  vaultStorage: { isUnlocked: () => mockVaultState.unlocked },
}));

beforeEach(() => {
  mockRedirects.length = 0;
  mockAuthState.knownEmail = null;
  mockAuthState.clinicianName = null;
  mockVaultState.unlocked = false;
});

it('a genuinely fresh device boots into Welcome onboarding', async () => {
  render(<Index />);
  await waitFor(() => expect(mockRedirects).toContain('/welcome'));
});

it('a device holding an account (persisted email) boots to the unlock screen, not onboarding', async () => {
  mockAuthState.knownEmail = 'yuki.tanaka@clinic.ae';
  render(<Index />);
  await waitFor(() => expect(mockRedirects).toContain('/unlock'));
  expect(mockRedirects).not.toContain('/welcome');
});

it('a persisted clinician name alone is also account evidence', async () => {
  mockAuthState.clinicianName = 'Yuki Tanaka';
  render(<Index />);
  await waitFor(() => expect(mockRedirects).toContain('/unlock'));
});

it('an already-open vault goes straight to the day board', async () => {
  mockVaultState.unlocked = true;
  render(<Index />);
  await waitFor(() => expect(mockRedirects).toContain('/(app)/today'));
  expect(mockRedirects).not.toContain('/welcome');
  expect(mockRedirects).not.toContain('/unlock');
});
