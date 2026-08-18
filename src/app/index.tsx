import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { authService } from '../services/auth';
import { vaultStorage } from '../services/storage';

/**
 * Boot routing — decided from the device's own evidence, not a hardcoded "everyone is new".
 *
 * A returning clinician's device already carries their account (persisted known email + clinician
 * name, hydrated by the auth service) and their caseload; routing them to the first-run Welcome
 * onboarding on every reopen reads as "the app forgot me" in the exact moment — coming back from an
 * interruption — when they most need to resume. So: vault already open → straight to the day board;
 * device shows an existing account → the unlock screen; genuinely fresh device → Welcome onboarding.
 * The unlock screen keeps its "New to Airava? Create an account" link and Welcome keeps its skip
 * link, so neither audience is ever trapped on the wrong side.
 */
export default function Index() {
  // The vault-open check is safe to make synchronously; the account evidence needs the async device
  // store, so a fresh mount renders nothing for the one tick hydration takes.
  const [dest, setDest] = useState<string | null>(() => (vaultStorage.isUnlocked() ? '/(app)/today' : null));
  useEffect(() => {
    let alive = true;
    authService.whenHydrated().then(() => {
      if (!alive) return;
      const returning = authService.getKnownEmail() || authService.getClinicianName();
      setDest((prev) => prev ?? (returning ? '/unlock' : '/welcome'));
    });
    return () => {
      alive = false;
    };
  }, []);
  if (!dest) return null;
  return <Redirect href={dest as Parameters<typeof Redirect>[0]['href']} />;
}
