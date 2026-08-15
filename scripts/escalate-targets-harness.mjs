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
const { buildEscalateSections, manualTargetLabel, openFailureMessage, visibleTarget } = await import(
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

/**
 * Independently derives what an action's `href` actually points at, so a `displayTarget` that has
 * drifted from the target the button really opens is caught. Deliberately NOT `manualTargetLabel` —
 * comparing that function against itself would prove nothing.
 */
function hrefTarget(action) {
  if (action.kind === 'tel') return action.href.replace(/^tel:/, '');
  if (action.kind === 'mailto') return action.href.replace(/^mailto:/, '').split('?')[0];
  return action.href;
}

/** Fabricated crisis-line/on-call config, matching the shape `../config/env` derives at runtime. */
const configured = { crisisLine: { configured: true, display: '800 4673', tel: 'tel:8004673' }, onCallEmail: { configured: false, address: 'on-call@clinic.example' } };
const blank = { crisisLine: { configured: false, display: '999 · local emergency services', tel: 'tel:999' }, onCallEmail: { configured: false, address: 'on-call@clinic.example' } };
const withOnCall = { crisisLine: configured.crisisLine, onCallEmail: { configured: true, address: 'oncall@clinic.ae' } };

// --- Injected config: crisis line resolved to 800 4673 ------------------------------------------
{
  const sections = buildEscalateSections({}, configured);

  const crisis = findAction(sections, 'crisis');
  check('crisis line is configured (800 4673 default)', crisis?.href === 'tel:8004673', crisis?.href);
  check('crisis line has no fallback copy in its sub', crisis?.sub === 'Opens your dialer', crisis?.sub);
  check(
    'crisis line inline target is grouped exactly "800 4673", never "8004673"',
    visibleTarget(crisis) === '800 4673',
    visibleTarget(crisis),
  );

  const police = findAction(sections, 'police');
  check('police tel: target is exactly 999', police?.href === 'tel:999', police?.href);
  check('police is a tel action', police?.kind === 'tel', police?.kind);
  check('police inline target is exactly 999', visibleTarget(police) === '999', visibleTarget(police));

  const hospital = findAction(sections, 'rashid-hospital');
  check('Rashid Hospital tel: target matches 04 219 2000 digit-for-digit', hospital?.href === 'tel:042192000', hospital?.href);
  check(
    'Rashid Hospital inline target is grouped exactly "04 219 2000", never "042192000"',
    visibleTarget(hospital) === '04 219 2000',
    visibleTarget(hospital),
  );

  const dha = findAction(sections, 'dha');
  check('DHA url target matches the brief exactly', dha?.href === 'https://www.dha.gov.ae/', dha?.href);
  check('DHA is a url action (opens browser, not dialer)', dha?.kind === 'url', dha?.kind);
  check('DHA inline target shows the full URL', visibleTarget(dha) === 'https://www.dha.gov.ae/', visibleTarget(dha));

  const lighthousePhone = findAction(sections, 'lighthouse-phone');
  check(
    'LightHouse Arabia tel: target matches 04 380 2088 digit-for-digit',
    lighthousePhone?.href === 'tel:043802088',
    lighthousePhone?.href,
  );
  check(
    'LightHouse Arabia inline target is grouped exactly "04 380 2088", never "043802088"',
    visibleTarget(lighthousePhone) === '04 380 2088',
    visibleTarget(lighthousePhone),
  );

  const lighthouseSite = findAction(sections, 'lighthouse-site');
  check(
    'LightHouse Arabia url target matches the brief exactly',
    lighthouseSite?.href === 'https://www.lighthousearabia.com/',
    lighthouseSite?.href,
  );
  check(
    'LightHouse Arabia website inline target shows the full URL',
    visibleTarget(lighthouseSite) === 'https://www.lighthousearabia.com/',
    visibleTarget(lighthouseSite),
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
    realCrisis?.sub === 'Opens your dialer',
    realCrisis?.sub,
  );
  check(
    'unconfigured build shows the crisis line inline target grouped as 800 4673',
    visibleTarget(realCrisis) === '800 4673',
    visibleTarget(realCrisis),
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
    check(`"${action.key}" failure copy is non-empty`, openFailureMessage(action).length > 0, openFailureMessage(action));
    if (!action.failureMessage) {
      check(
        `"${action.key}" failure copy quotes its target`,
        openFailureMessage(action).includes(manualTargetLabel(action)) && manualTargetLabel(action).length > 0,
        openFailureMessage(action),
      );
    }
    // A hand-target that drifts from what the button actually opens would send the counselor
    // somewhere else entirely — the one way carrying two representations can hurt. Checked for
    // EVERY kind, not just `tel`, so a stale `displayTarget` on a url/mailto cannot hide either.
    const declared = manualTargetLabel(action);
    check(
      `"${action.key}" hand-target matches what it actually opens`,
      action.kind === 'tel' ? declared.replace(/[^\d+]/g, '') === hrefTarget(action) : declared === hrefTarget(action),
      `${declared} vs ${action.href}`,
    );
  }
}

// --- Warm handoff: the failure copy never names an address that isn't real ----------------------
{
  const unconfigured = findAction(buildEscalateSections({}, configured), 'handoff');
  const copy = openFailureMessage(unconfigured);
  check(
    'an unconfigured on-call build does not tell the counselor to write to the placeholder',
    !copy.includes('on-call@clinic.example'),
    copy,
  );
  check(
    'it says plainly that no on-call address is configured instead',
    copy.includes('no on-call address is configured'),
    copy,
  );

  const real = findAction(buildEscalateSections({}, withOnCall), 'handoff');
  check('a configured on-call build drafts to the real address', real?.href.startsWith('mailto:oncall@clinic.ae?'), real?.href);
  check(
    'and its failure copy hands that real address back to write by hand',
    openFailureMessage(real).includes('oncall@clinic.ae'),
    openFailureMessage(real),
  );
}

// --- Inline visible target: shown for every real target, hidden for the known placeholder --------
{
  // The placeholder-backed on-call address must never render as if it were reachable — the row
  // keeps its honest "no on-call address is set" copy instead (rule preserved from PR 20).
  const unconfiguredHandoff = findAction(buildEscalateSections({}, configured), 'handoff');
  check('unconfigured handoff is marked to hide its target', unconfiguredHandoff?.hideTarget === true, unconfiguredHandoff);
  check(
    'unconfigured handoff shows no inline target (would be the placeholder)',
    visibleTarget(unconfiguredHandoff) === '',
    visibleTarget(unconfiguredHandoff),
  );

  // A configured on-call address, by contrast, is real and must show inline.
  const configuredHandoff = findAction(buildEscalateSections({}, withOnCall), 'handoff');
  check('configured handoff does not hide its target', configuredHandoff?.hideTarget !== true, configuredHandoff);
  check(
    'configured handoff shows its real inline target',
    visibleTarget(configuredHandoff) === 'oncall@clinic.ae',
    visibleTarget(configuredHandoff),
  );

  // A route action (the safety plan) has nothing to dial/browse/mail — no inline target either way.
  const safetyEnabled = findAction(buildEscalateSections({ activeClientId: 'client-42' }, configured), 'safety');
  check('the safety-plan route shows no inline target', visibleTarget(safetyEnabled) === '', visibleTarget(safetyEnabled));

  // Every non-route, non-hidden action on the live sheet must show a real, non-empty inline target —
  // "readable, not just tappable" holds for the whole surface, not just the rows spot-checked above.
  const allSections = buildEscalateSections({ activeClientId: 'client-42' }, configured);
  for (const action of allSections.flatMap((s) => s.actions)) {
    if (action.kind === 'route' || action.hideTarget) continue;
    check(`"${action.key}" shows a non-empty inline target`, visibleTarget(action).length > 0, action);
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
