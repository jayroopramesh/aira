/**
 * Escalate-targets harness. Proves every control on the Escalate sheet resolves to a real,
 * verified `tel:`/`https:`/`mailto:`/route target — not the `onPress={() => {}}` dead promise
 * that left this surface inert once already. Runs against `buildEscalateSections`
 * (`src/config/escalateContacts.ts`), the pure data the component renders, so a future refactor
 * that drops an onPress or mistypes a number fails here without needing to render the UI.
 *
 * Numbers/URLs below are transcribed character-for-character from the safety brief:
 *   crisis line 800 4673 · police 999 · Rashid Hospital 04 219 2000 · DHA https://www.dha.gov.ae/
 *   LightHouse Arabia 04 380 2088 · https://www.lighthousearabia.com/
 *
 * Run (Node ≥ 22.13, e.g. ~/.cache/fm-node/node-v22.23.2-darwin-arm64/bin/node):
 *   node --experimental-strip-types scripts/escalate-targets-harness.mjs
 * Exits non-zero on the first failed assertion.
 */
import { buildEscalateSections } from '../src/config/escalateContacts.ts';

let failed = 0;
function check(name, ok, detail) {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (${detail})`}`);
}

function findAction(sections, key) {
  for (const section of sections) {
    const found = section.actions.find((a) => a.key === key);
    if (found) return found;
  }
  return undefined;
}

/** Fabricated crisis-line/on-call config, matching the shape `../config/env` derives at runtime. */
const configured = { crisisLine: { configured: true, display: '800 4673', tel: 'tel:8004673' }, onCallEmail: { configured: false, address: 'on-call@clinic.example' } };
const blank = { crisisLine: { configured: false, display: '999 · local emergency services', tel: 'tel:999' }, onCallEmail: { configured: false, address: 'on-call@clinic.example' } };

// --- Default build: EXPO_PUBLIC_CRISIS_LINE at its .env.example default (800 4673) --------------
{
  const sections = buildEscalateSections({}, configured);

  const crisis = findAction(sections, 'crisis');
  check('crisis line is configured (800 4673 default)', crisis?.href === 'tel:8004673', crisis?.href);
  check('crisis line sub shows the number, no fallback copy', crisis?.sub === '800 4673 · opens your dialer', crisis?.sub);

  const police = findAction(sections, 'police');
  check('police tel: target is exactly 999', police?.href === 'tel:999', police?.href);
  check('police is a tel action', police?.kind === 'tel', police?.kind);

  const hospital = findAction(sections, 'rashid-hospital');
  check('Rashid Hospital tel: target matches 04 219 2000 digit-for-digit', hospital?.href === 'tel:042192000', hospital?.href);
  check('Rashid Hospital sub displays the number verbatim', hospital?.sub.startsWith('04 219 2000'), hospital?.sub);

  const dha = findAction(sections, 'dha');
  check('DHA url target matches the brief exactly', dha?.href === 'https://www.dha.gov.ae/', dha?.href);
  check('DHA is a url action (opens browser, not dialer)', dha?.kind === 'url', dha?.kind);

  const lighthousePhone = findAction(sections, 'lighthouse-phone');
  check(
    'LightHouse Arabia tel: target matches 04 380 2088 digit-for-digit',
    lighthousePhone?.href === 'tel:043802088',
    lighthousePhone?.href,
  );

  const lighthouseSite = findAction(sections, 'lighthouse-site');
  check(
    'LightHouse Arabia url target matches the brief exactly',
    lighthouseSite?.href === 'https://www.lighthousearabia.com/',
    lighthouseSite?.href,
  );

  // No control on the surface may be a dead promise: every action either has a resolvable
  // href/route or is explicitly (and honestly) disabled.
  const allActions = sections.flatMap((s) => s.actions);
  check('surface has the expected 8 controls', allActions.length === 8, allActions.length);
  for (const action of allActions) {
    const resolvable =
      action.kind === 'route'
        ? typeof action.route === 'string' && action.route.length > 0
        : typeof action.href === 'string' && action.href.length > 0;
    check(`"${action.title}" (${action.key}) resolves to a real target or is disabled`, resolvable || action.disabled === true, JSON.stringify(action));
  }

  // Tiers are visually distinct and in the captain's order: crisis line, then emergency, then
  // non-urgent, then clinician tools.
  check('crisis line section is first (reachable first)', sections[0].key === 'crisis', sections[0].key);
  check('emergency tier is second', sections[1].key === 'emergency', sections[1].key);
  check('non-urgent tier is third', sections[2].key === 'non-urgent', sections[2].key);
  check('emergency and non-urgent tiers use different tones', sections[1].tone !== sections[2].tone, `${sections[1].tone} vs ${sections[2].tone}`);
}

// --- Blanked build: EXPO_PUBLIC_CRISIS_LINE unset — honest local-emergency fallback preserved ---
{
  const sections = buildEscalateSections({}, blank);
  const crisis = findAction(sections, 'crisis');
  check('blanked build falls back to 999 (local emergency)', crisis?.href === 'tel:999', crisis?.href);
  check('blanked build says honestly no dedicated line is configured', crisis?.sub.includes('no dedicated line configured'), crisis?.sub);

  // The fixed emergency/non-urgent tiers never depend on config — same in every build.
  const dha = findAction(sections, 'dha');
  check('emergency tier is unaffected by crisis-line config', dha?.href === 'https://www.dha.gov.ae/', dha?.href);
}

// --- The real shipped default (no injected config) matches the .env.example value ---------------
{
  const realCrisis = findAction(buildEscalateSections(), 'crisis');
  check(
    'with the process env exactly as this test process started, crisis line resolves to a real href',
    typeof realCrisis?.href === 'string' && realCrisis.href.startsWith('tel:'),
    realCrisis,
  );
}

// --- Safety plan: honest disable with no client, real route with one -----------------------------
{
  const withoutClient = buildEscalateSections({}, configured);
  const disabledSafety = findAction(withoutClient, 'safety');
  check('safety plan disables honestly with no client in context', disabledSafety?.disabled === true, disabledSafety);
  check('a disabled safety plan carries no stale route', disabledSafety?.route === undefined, disabledSafety?.route);

  const withClient = buildEscalateSections({ activeClientId: 'client-42' }, configured);
  const enabledSafety = findAction(withClient, 'safety');
  check(
    'safety plan routes to the exact client when one is in context',
    enabledSafety?.route === '/(app)/patterns/safety-plan?clientId=client-42',
    enabledSafety?.route,
  );
  check('an enabled safety plan is not disabled', enabledSafety?.disabled !== true, enabledSafety);

  const blankClient = buildEscalateSections({ activeClientId: '   ' }, configured);
  check('a whitespace-only clientId is treated as no client', findAction(blankClient, 'safety')?.disabled === true, findAction(blankClient, 'safety'));
}

// --- Warm handoff: mailto target reflects on-call config and never leaks a raw client id --------
{
  const sections = buildEscalateSections({ activeClientId: 'client-42', clientToken: 'TOKEN-9' }, configured);
  const handoff = findAction(sections, 'handoff');
  check('warm handoff is a mailto action', handoff?.kind === 'mailto', handoff?.kind);
  check(
    'warm handoff mailto references the local token, not the raw client id',
    handoff?.href.includes('TOKEN-9') && !handoff.href.includes('client-42'),
    handoff?.href,
  );
}

console.log(`\n${failed === 0 ? 'all checks passed' : `${failed} assertion(s) failed`}`);
if (failed) process.exit(1);
