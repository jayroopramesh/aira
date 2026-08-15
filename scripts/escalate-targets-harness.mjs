/**
 * Escalate-targets harness. Proves every control on the Escalate sheet resolves to a real,
 * verified `tel:`/`https:`/`mailto:`/route target — not the `onPress={() => {}}` dead promise
 * that left this surface inert once already. Runs against `buildEscalateSections`
 * (`src/config/escalateContacts.ts`), the pure data the component renders, so a future refactor
 * that mistypes a number fails here without needing to render the UI. (The component's own onPress
 * wiring is a different question and pure data cannot see it — that is
 * `src/components/__tests__/Escalate.test.tsx`.)
 *
 * Numbers/URLs below are transcribed character-for-character from the safety brief:
 *   crisis line 800 4673 · police 999 · Rashid Hospital 04 219 2000 · DHA https://www.dha.gov.ae/
 *   LightHouse Arabia 04 380 2088 · https://www.lighthousearabia.com/
 *
 * Run (Node ≥ 22.13, e.g. ~/.cache/fm-node/node-v22.23.2-darwin-arm64/bin/node):
 *   node --experimental-strip-types scripts/escalate-targets-harness.mjs
 * Exits non-zero on the first failed assertion.
 */
// Loaded dynamically, AFTER scrubbing the safety env vars, so the "real shipped default" block
// below observes the fresh-clone/CI environment (no `.env.local`, nothing exported) rather than
// whatever the developer running this happens to have set. `src/config/env.ts` reads process.env at
// module-evaluation time, so the scrub has to happen before the import evaluates — hence not a
// static import.
delete process.env.EXPO_PUBLIC_CRISIS_LINE;
delete process.env.EXPO_PUBLIC_ONCALL_EMAIL;
const { buildEscalateSections, manualTargetLabel, openFailureMessage } = await import(
  '../src/config/escalateContacts.ts'
);

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

// --- Injected config: crisis line resolved to 800 4673 ------------------------------------------
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

// --- The real shipped default: NO env vars set at all (CI, a fresh clone, no `.env.local`) ------
// This is the every-build guarantee. `800 4673` is baked into src/config/env.ts as a literal, so it
// must resolve here without any configuration — a `tel:` prefix alone would also be satisfied by
// the 999 local-emergency fallback, which is exactly how a missing default went unnoticed.
{
  const realCrisis = findAction(buildEscalateSections(), 'crisis');
  check('unconfigured build dials 800 4673', realCrisis?.href === 'tel:8004673', realCrisis?.href);
  check(
    'unconfigured build presents the crisis line as configured, no fallback copy',
    realCrisis?.sub === '800 4673 · opens your dialer',
    realCrisis?.sub,
  );

  // The fixed tiers likewise need no configuration to be real.
  check('unconfigured build still dials police 999', findAction(buildEscalateSections(), 'police')?.href === 'tel:999');
  check(
    'unconfigured build still opens the DHA site',
    findAction(buildEscalateSections(), 'dha')?.href === 'https://www.dha.gov.ae/',
  );
}

// --- Honest failure copy: a refused hand-off hands back something usable by hand -----------------
{
  const sections = buildEscalateSections({ activeClientId: 'client-42' }, configured);
  const police = findAction(sections, 'police');
  check('a refused tel: hands back the bare number to dial', manualTargetLabel(police) === '999', manualTargetLabel(police));
  check('tel failure copy names that number', openFailureMessage(police).includes('999'), openFailureMessage(police));

  const dha = findAction(sections, 'dha');
  check(
    'a refused url hands back the full address',
    manualTargetLabel(dha) === 'https://www.dha.gov.ae/',
    manualTargetLabel(dha),
  );

  const handoff = findAction(sections, 'handoff');
  check(
    'a refused mailto hands back the bare address, without the subject/body query',
    manualTargetLabel(handoff) === 'on-call@clinic.example',
    manualTargetLabel(handoff),
  );

  // The hand-dial number keeps the brief's own grouping — this is the one place a human reads and
  // keys it, so it must not be handed back as the stripped `tel:` digits.
  const grouped = [
    ['crisis', '800 4673'],
    ['rashid-hospital', '04 219 2000'],
    ['lighthouse-phone', '04 380 2088'],
  ];
  for (const [key, expected] of grouped) {
    const action = findAction(sections, key);
    check(
      `"${key}" hands back the number grouped exactly as the brief writes it`,
      manualTargetLabel(action) === expected,
      manualTargetLabel(action),
    );
  }

  for (const action of sections.flatMap((s) => s.actions)) {
    if (action.disabled || action.kind === 'route') continue;
    check(
      `"${action.key}" failure copy is non-empty and quotes its target`,
      openFailureMessage(action).includes(manualTargetLabel(action)) && manualTargetLabel(action).length > 0,
      openFailureMessage(action),
    );
    // A display form that drifts from the dialed form would have the counselor key a different
    // number than the button dials — the one way carrying two representations can hurt.
    if (action.kind === 'tel') {
      check(
        `"${action.key}" displayed digits match the digits it actually dials`,
        manualTargetLabel(action).replace(/[^\d+]/g, '') === action.href.replace(/^tel:/, ''),
        `${manualTargetLabel(action)} vs ${action.href}`,
      );
    }
  }
}

// --- The no-dedicated-line fallback still hands back something dialable -------------------------
{
  const crisis = findAction(buildEscalateSections({}, blank), 'crisis');
  check(
    'the 999 fallback hands back a bare number, not its prose display string',
    manualTargetLabel(crisis) === '999',
    manualTargetLabel(crisis),
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
