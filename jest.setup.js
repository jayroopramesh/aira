/**
 * Runs before each test file's module graph is evaluated (appended to `jest-expo`'s own
 * `setupFiles`, which Jest concatenates rather than replaces).
 *
 * `src/config/env.ts` reads `process.env` at module-evaluation time, and jest inherits the
 * developer's shell. Scrubbing the safety vars here makes this lane observe the same fresh-clone
 * environment `scripts/escalate-targets-harness.mjs` deliberately reconstructs, so the pinned
 * targets (`tel:8004673`, `mailto:on-call@clinic.example`) don't turn red for whoever happens to
 * have an override exported.
 */
delete process.env.EXPO_PUBLIC_CRISIS_LINE;
delete process.env.EXPO_PUBLIC_ONCALL_EMAIL;
