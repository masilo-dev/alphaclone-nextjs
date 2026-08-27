/**
 * Pratfall-effect failure copy — honest, specific, protective.
 * WHAT failed · WHY · WHAT WAS SAVED · WHAT TO DO NEXT
 */

import { humanizeTechnicalFailure } from '@/lib/copy/businessFriendlyErrors';

export interface UserFacingFailure {
  title: string;
  detail: string;
  saved?: string;
  nextStep?: string;
  reconnectHref?: string;
}

export interface FormatFailureInput {
  action: string;
  rawError?: unknown;
  saved?: string;
  nextStep?: string;
  reconnectHref?: string;
  tool?: string | null;
}

const LINKEDIN_PATTERNS: Array<{ test: RegExp; failure: UserFacingFailure }> = [
  {
    test: /token|expired|unauthorized|401/i,
    failure: {
      title: 'LinkedIn connection expired',
      detail: 'LinkedIn rejected the request because your access token is no longer valid.',
      saved: 'Your post draft is saved.',
      nextStep: 'Reconnect LinkedIn, then publish again.',
      reconnectHref: '/dashboard/business/linkedin',
    },
  },
  {
    test: /rate.?limit|429/i,
    failure: {
      title: 'LinkedIn rate limit reached',
      detail: 'LinkedIn is temporarily limiting publishing from this account.',
      saved: 'Your draft is unchanged.',
      nextStep: 'Wait a few minutes or schedule the post for later.',
    },
  },
];

const GMAIL_PATTERNS: Array<{ test: RegExp; failure: UserFacingFailure }> = [
  {
    test: /token|expired|unauthorized/i,
    failure: {
      title: 'Gmail connection issue',
      detail: 'We had trouble connecting to Gmail.',
      saved: 'Your CRM records and drafts were not affected.',
      nextStep: 'Reconnect Gmail in Settings → Integrations.',
      reconnectHref: '/dashboard/business/settings',
    },
  },
];

function matchPattern(
  text: string,
  patterns: Array<{ test: RegExp; failure: UserFacingFailure }>
): UserFacingFailure | null {
  for (const { test, failure } of patterns) {
    if (test.test(text)) return failure;
  }
  return null;
}

/** Format a failure for toast or inline UI — never generic when detail is available. */
export function formatFailureForUser(input: FormatFailureInput): UserFacingFailure {
  const action = input.action.trim() || 'This action';
  const raw = String(input.rawError ?? '').trim();

  if (raw) {
    const linkedIn = matchPattern(raw, LINKEDIN_PATTERNS);
    if (linkedIn) {
      return {
        ...linkedIn,
        saved: input.saved ?? linkedIn.saved,
        nextStep: input.nextStep ?? linkedIn.nextStep,
      };
    }
    const gmail = matchPattern(raw, GMAIL_PATTERNS);
    if (gmail) {
      return {
        ...gmail,
        saved: input.saved ?? gmail.saved,
        nextStep: input.nextStep ?? gmail.nextStep,
      };
    }

    if (/not confident|low confidence|uncertain/i.test(raw)) {
      return {
        title: 'Bonnie needs your review',
        detail: 'Bonnie could not confidently complete this automatically. Nothing was changed.',
        saved: input.saved ?? 'Your existing data is unchanged.',
        nextStep: input.nextStep ?? 'Review the suggestion and approve manually.',
      };
    }
  }

  const humanized = raw
    ? humanizeTechnicalFailure(raw, { tool: input.tool })
    : `${action} did not finish.`;

  return {
    title: `We couldn't complete ${action.toLowerCase()}`,
    detail: humanized,
    saved: input.saved,
    nextStep: input.nextStep ?? 'Try again in a moment or contact support if this persists.',
    reconnectHref: input.reconnectHref,
  };
}

/** Single string for toast.error — still specific, not "Something went wrong." */
export function formatFailureToastMessage(input: FormatFailureInput): string {
  const f = formatFailureForUser(input);
  const parts = [f.detail];
  if (f.saved) parts.push(f.saved);
  if (f.nextStep) parts.push(f.nextStep);
  return parts.join(' ');
}
