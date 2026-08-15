/**
 * Component-level tests, run alongside the `scripts/*-harness.mjs` suites by `npm test`.
 *
 * The harnesses prove the pure modules (`src/config/escalateContacts.ts` and friends) in isolation;
 * this preset exists for the cases where the WIRING is the thing under test — an Escalate row whose
 * `onPress` is deleted still passes every pure-data assertion, which is exactly how that surface
 * went inert once already.
 *
 * `jest-expo/ios` is the single-platform preset (no jsdom, no per-platform fan-out); nothing under
 * test here is platform-specific, and `Linking` is stubbed by the test either way.
 */
module.exports = {
  preset: 'jest-expo/ios',
  testMatch: ['<rootDir>/src/**/*.test.tsx', '<rootDir>/src/**/*.test.ts'],
  // Concatenated after the preset's own setup files, not a replacement for them.
  setupFiles: ['<rootDir>/jest.setup.js'],
  // The first render in a suite pays for compiling the RN/Expo module graph, which alone can beat
  // Jest's 5s default on a cold CI runner.
  testTimeout: 30000,
};
