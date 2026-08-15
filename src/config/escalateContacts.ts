/**
 * Pure data + target-resolution for the Escalate sheet (F6/F7). Kept RN-free — no Linking/Modal/
 * router imports — so `scripts/escalate-targets-harness.mjs` can assert every control's resolved
 * `tel:`/`https:`/`mailto:` target without rendering the component. That gap (a control with no
 * onPress at all) is exactly how this surface went inert once already, so the resolved target is
 * proved here rather than only eyeballed in the UI.
 *
 * The main crisis line is config-driven (`crisisLine`/`onCallEmail` in `../config/env`, honest
 * fallback when unset). The emergency/non-urgent tier contacts below are fixed UAE safety-net
 * numbers transcribed verbatim from the captain's brief — never configurable, never localised.
 */
import { crisisLine, onCallEmail } from './env.ts';

type CrisisLineConfig = typeof crisisLine;
type OnCallEmailConfig = typeof onCallEmail;

export type EscalateActionKind = 'tel' | 'url' | 'mailto' | 'route';

export type EscalateAction = {
  key: string;
  title: string;
  sub: string;
  kind: EscalateActionKind;
  disabled?: boolean;
  /** Resolved `tel:`/`https:`/`mailto:` target for kind tel|url|mailto. */
  href?: string;
  /** Resolved in-app route for kind route. */
  route?: string;
};

export type EscalateSectionTone = 'crisis' | 'emergency' | 'nonUrgent' | 'tools';

export type EscalateSection = {
  key: string;
  tone: EscalateSectionTone;
  label?: string;
  description?: string;
  actions: EscalateAction[];
};

/** Strips a display number down to the digits (+leading `+`) Linking needs for a `tel:` URL. */
function telHref(displayNumber: string): string {
  return `tel:${displayNumber.replace(/[^\d+]/g, '')}`;
}

/**
 * The bare number / address / URL behind an action, for the counselor to use BY HAND when the
 * device refuses to open it (a `tel:` press on a desktop browser with no dialer registered, a
 * platform that rejects the scheme). A row that promises "opens your dialer" and then silently does
 * nothing is the same dead promise as no onPress at all — so the failure path has to hand back
 * something dialable rather than swallow the rejection.
 */
export function manualTargetLabel(action: EscalateAction): string {
  if (!action.href) return '';
  if (action.kind === 'mailto') return action.href.replace(/^mailto:/, '').split('?')[0];
  if (action.kind === 'tel') return action.href.replace(/^tel:/, '');
  return action.href;
}

/** Honest copy for a target the device would not open, naming what to reach by hand instead. */
export function openFailureMessage(action: EscalateAction): string {
  const target = manualTargetLabel(action);
  switch (action.kind) {
    case 'tel':
      return `This device wouldn’t open the dialer. Dial ${target} yourself.`;
    case 'mailto':
      return `This device wouldn’t open your email app. Write to ${target} yourself.`;
    case 'url':
      return `This device wouldn’t open the browser. Visit ${target} yourself.`;
    case 'route':
      return 'This screen wouldn’t open.';
  }
}

/** "If you feel you or someone else is at risk of harm." Fixed UAE emergency contacts. */
export const EMERGENCY_SECTION: EscalateSection = {
  key: 'emergency',
  tone: 'emergency',
  label: 'If this is an emergency',
  description: 'If you feel you or someone else is at risk of harm',
  actions: [
    { key: 'police', title: 'Police', sub: '999 · opens your dialer', kind: 'tel', href: telHref('999') },
    {
      key: 'rashid-hospital',
      title: 'Rashid Hospital',
      sub: '04 219 2000 · opens your dialer',
      kind: 'tel',
      href: telHref('04 219 2000'),
    },
    {
      key: 'dha',
      title: 'Dubai Health Authority',
      sub: 'https://www.dha.gov.ae/ · opens your browser',
      kind: 'url',
      href: 'https://www.dha.gov.ae/',
    },
  ],
};

/** "Get in touch with counselors, therapists, care centres." Fixed non-urgent crisis support. */
export const NON_URGENT_SECTION: EscalateSection = {
  key: 'non-urgent',
  tone: 'nonUrgent',
  label: 'Crisis, but not urgent',
  description: 'Get in touch with counselors, therapists, care centres',
  actions: [
    {
      key: 'lighthouse-phone',
      title: 'The LightHouse Arabia Centre for Wellbeing',
      sub: '04 380 2088 · opens your dialer',
      kind: 'tel',
      href: telHref('04 380 2088'),
    },
    {
      key: 'lighthouse-site',
      title: 'LightHouse Arabia website',
      sub: 'https://www.lighthousearabia.com/ · opens your browser',
      kind: 'url',
      href: 'https://www.lighthousearabia.com/',
    },
  ],
};

/**
 * Warm handoff to the on-call clinician — a mailto the clinician sends; the client is never
 * messaged. clientToken is the LOCALLY re-identified token (Client.tokenId), never the raw
 * clientId — a readable client identifier must never leave the device, fixtures included
 * (escalate-clientid-in-mailto).
 */
function onCallMailto(onCall: OnCallEmailConfig, clientToken?: string): string {
  const ref = clientToken ? ` (re: locally re-identified client ${clientToken})` : '';
  const subject = 'Warm handoff — on-call review requested';
  const notConfigured = onCall.configured
    ? ''
    : '\n\n[No on-call address is configured for this build — set the recipient before sending.]';
  const body = `Hi,\n\nRequesting a warm handoff${ref} to the on-call clinician for review. Please advise on availability.\n\n(No message has been sent to the client.)${notConfigured}`;
  return `mailto:${onCall.address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * The full Escalate sheet, in display order: the standing configured crisis line (reachable
 * first), the emergency tier, the non-urgent tier, then the clinician-facing tools (warm handoff,
 * safety plan). No option is a dead promise (F6): every tel/url/mailto action resolves to a real
 * href, and the safety plan honestly disables itself with an explanation when there is no client
 * in context, rather than appearing live.
 *
 * `config` defaults to the real env-derived crisis line / on-call address; tests inject a
 * fabricated config directly instead of reloading `../config/env` under different environments,
 * matching this project's pure-function harness convention (build fake data, call the function).
 */
export function buildEscalateSections(
  opts: { activeClientId?: string; clientToken?: string } = {},
  config: { crisisLine: CrisisLineConfig; onCallEmail: OnCallEmailConfig } = { crisisLine, onCallEmail },
): EscalateSection[] {
  const crisisAction: EscalateAction = {
    key: 'crisis',
    title: 'Call a crisis line',
    sub: config.crisisLine.configured
      ? `${config.crisisLine.display} · opens your dialer`
      : `Opens your dialer — no dedicated line configured, dials ${config.crisisLine.display}`,
    kind: 'tel',
    href: config.crisisLine.tel,
  };

  const handoffAction: EscalateAction = {
    key: 'handoff',
    title: 'Warm handoff to on-call',
    sub: config.onCallEmail.configured
      ? `Drafts an email to ${config.onCallEmail.address} — the client is never auto-messaged`
      : 'Drafts a handoff email — no on-call address is set for this build, so add the recipient before sending',
    kind: 'mailto',
    href: onCallMailto(config.onCallEmail, opts.clientToken),
  };

  // Normalise a missing/blank id to undefined so an empty string is never treated as a real client.
  const activeClientId = opts.activeClientId?.trim() ? opts.activeClientId.trim() : undefined;
  const safetyAction: EscalateAction = activeClientId
    ? {
        key: 'safety',
        title: 'Open the safety plan',
        sub: 'Review the safety information on file for this client',
        kind: 'route',
        route: `/(app)/patterns/safety-plan?clientId=${encodeURIComponent(activeClientId)}`,
      }
    : {
        key: 'safety',
        title: 'Open the safety plan',
        sub: 'Open a client’s review first — a safety plan belongs to a specific client',
        kind: 'route',
        disabled: true,
      };

  return [
    { key: 'crisis', tone: 'crisis', actions: [crisisAction] },
    EMERGENCY_SECTION,
    NON_URGENT_SECTION,
    { key: 'tools', tone: 'tools', label: 'Clinician tools', actions: [handoffAction, safetyAction] },
  ];
}
