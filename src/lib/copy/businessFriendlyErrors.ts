/**
 * Turn technical / Zod / tool failures into plain business language
 * for dashboards, emails, and Bonnie chat — never show schema jargon to operators.
 */

/** Plain operator-safe copy for any internal/server failure. */
export const USER_FACING_SERVER_ERROR_MESSAGE =
  'This action failed due to a server error. Please contact AlphaClone Systems support or try again in a few minutes.';

const TOOL_ACTIVITY_LABELS: Record<string, string> = {
  define_outcome: 'Checked whether the work succeeded',
  find_and_qualify_leads: 'Found and scored leads',
  parse_lead_criteria: 'Saved your ideal lead profile',
  create_invoice: 'Prepared an invoice',
  send_invoice: 'Sent an invoice',
  create_deal: 'Created a deal',
  update_deal: 'Updated a deal',
  send_email: 'Sent an email',
  draft_email: 'Drafted an email',
  create_client: 'Added a customer',
  search_contacts: 'Searched customers',
  get_clients: 'Looked up customers',
  publish_social_post: 'Published a social post',
  publish_post: 'Published a social post',
  upload_social_media: 'Uploaded social media',
  schedule_social_post: 'Scheduled a social post',
  create_task: 'Created a task',
  orchestrate_task: 'Ran a multi-step work plan',
  trigger_bonnie_dream: 'Reviewed recent work overnight',
};

export function businessToolActivity(toolName: string | null | undefined): string {
  const key = String(toolName || '').trim();
  if (!key) return 'Completed a workspace action';
  if (TOOL_ACTIVITY_LABELS[key]) return TOOL_ACTIVITY_LABELS[key];
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bId\b/g, '')
    .trim();
}

function looksLikeZodIssuesJson(text: string): boolean {
  const t = text.trim();
  if (!t.startsWith('[')) return false;
  return (
    t.includes('"code"') &&
    (t.includes('invalid_type') ||
      t.includes('invalid_value') ||
      t.includes('invalid_enum_value') ||
      t.includes('invalid_format') ||
      t.includes('"expected"'))
  );
}

function parseZodIssues(text: string): Array<{ path?: unknown; code?: string; message?: string }> {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Extract a human message from nested MCP / Error / JSON shapes. */
export function extractErrorMessage(raw: unknown): string | null {
  if (raw == null) return null;

  if (typeof raw === 'string') {
    const text = raw.trim();
    if (!text) return null;
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        return extractErrorMessage(JSON.parse(text));
      } catch {
        return text;
      }
    }
    return text;
  }

  if (raw instanceof Error) {
    return raw.message || null;
  }

  if (Array.isArray(raw)) {
    return JSON.stringify(raw);
  }

  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (obj.error && typeof obj.error === 'object') {
      const nested = extractErrorMessage((obj.error as { message?: unknown }).message);
      if (nested) return nested;
    }
    if (typeof obj.error === 'string') return obj.error;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.summary === 'string') return obj.summary;
    if (typeof obj.reason === 'string') return obj.reason;
    // Never surface "[object Object]" — keep something a human can read.
    try {
      const json = JSON.stringify(raw);
      return json && json !== '{}' ? json.slice(0, 500) : null;
    } catch {
      return null;
    }
  }

  const fallback = String(raw).trim();
  return fallback || null;
}

/** True when text looks like JS/Postgres/schema noise that must not reach users. */
export function isInternalTechnicalError(text: string): boolean {
  const t = String(text || '');
  if (!t.trim()) return false;
  if (isTechnicalJargonText(t)) return true;
  if (/cannot read propert(y|ies) of (undefined|null)/i.test(t)) return true;
  if (/violates check constraint|violates foreign key|violates not-null/i.test(t)) return true;
  if (/\brelation\s+"[^"]+"|\bcolumn\s+"[^"]+"|\bconstraint\s+"[^"]+"/i.test(t)) return true;
  if (/\b(PGRST\d+|42703|23514|23503|42P01)\b/.test(t)) return true;
  if (/\bstack trace\b|at\s+\w+\s+\([^)]+\:\d+\:\d+\)/i.test(t)) return true;
  if (/^\s*[\[{]/.test(t) && /"ok"\s*:\s*false/.test(t)) return true;
  if (/^An unknown error occurred\.?$/i.test(t)) return true;
  if (/^Tool execution failed\.?$/i.test(t)) return true;
  return false;
}

/**
 * Operator-safe failure line for emails, notifications, and MCP error.message fields.
 * Keeps short business-safe copy; replaces internal failures with a generic server message.
 */
export function sanitizeUserFacingError(
  raw: unknown,
  opts?: { tool?: string | null; preferGeneric?: boolean }
): string {
  if (opts?.preferGeneric) {
    return USER_FACING_SERVER_ERROR_MESSAGE;
  }

  const extracted = extractErrorMessage(raw);
  if (!extracted) {
    return USER_FACING_SERVER_ERROR_MESSAGE;
  }

  if (looksLikeZodIssuesJson(extracted)) {
    const humanized = humanizeTechnicalFailure(extracted, { tool: opts?.tool });
    if (!isInternalTechnicalError(humanized)) {
      return humanized;
    }
  }

  if (isInternalTechnicalError(extracted)) {
    return USER_FACING_SERVER_ERROR_MESSAGE;
  }

  const humanized = humanizeTechnicalFailure(extracted, { tool: opts?.tool });
  if (isInternalTechnicalError(humanized)) {
    return USER_FACING_SERVER_ERROR_MESSAGE;
  }
  return humanized;
}

/** Map Zod / validation dumps to operator-safe copy. */
export function humanizeTechnicalFailure(
  raw: unknown,
  opts?: { tool?: string | null }
): string {
  const tool = opts?.tool || null;
  const activity = businessToolActivity(tool);

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const err = raw as { name?: string; issues?: unknown; message?: string };
    if (err.name === 'ZodError' || Array.isArray(err.issues)) {
      return humanizeZodIssues(
        (Array.isArray(err.issues) ? err.issues : []) as Array<{
          path?: unknown;
          code?: string;
          message?: string;
        }>,
        activity
      );
    }
  }

  const text = String(raw ?? '').trim();
  if (!text) {
    return `${activity} didn’t finish. Ask Bonnie to try again.`;
  }

  if (looksLikeZodIssuesJson(text)) {
    return humanizeZodIssues(parseZodIssues(text), activity);
  }

  // Nested: Failed: [ { zod… } ] or {"error":true,"message":"[…]"}
  if (text.includes('invalid_type') || text.includes('invalid_value') || text.includes('invalid_format')) {
    const bracket = text.indexOf('[');
    if (bracket >= 0) {
      const maybe = text.slice(bracket);
      if (looksLikeZodIssuesJson(maybe)) {
        return humanizeZodIssues(parseZodIssues(maybe), activity);
      }
    }
    try {
      const obj = JSON.parse(text);
      if (obj?.message && looksLikeZodIssuesJson(String(obj.message))) {
        return humanizeZodIssues(parseZodIssues(String(obj.message)), activity);
      }
    } catch {
      // fall through
    }
    return `${activity} needed clearer details. Ask Bonnie to retry in plain language.`;
  }

  if (/tool not found|not available to Bonnie/i.test(text)) {
    return 'Bonnie doesn’t have that capability enabled in this workspace yet.';
  }

  if (/Failed to record outcome/i.test(text)) {
    return 'Bonnie couldn’t save the result checklist. Please try again in a moment.';
  }

  // Strip leading Failed: / Error: for cleaner chat
  return text.replace(/^(Failed|Error):\s*/i, '').slice(0, 280);
}

function humanizeZodIssues(
  issues: Array<{ path?: unknown; code?: string; message?: string }>,
  activity: string
): string {
  const paths = issues
    .map((i) => (Array.isArray(i.path) ? i.path.join('.') : String(i.path || '')))
    .map((p) => p.toLowerCase());

  if (paths.some((p) => p.includes('criteria')) && paths.some((p) => p.includes('status'))) {
    return `${activity}, but the success checklist wasn’t filled in correctly. Ask Bonnie to check the results again.`;
  }
  if (paths.some((p) => p.includes('criteria'))) {
    return `${activity}, but the success checklist was missing. Ask Bonnie to confirm what got done.`;
  }
  if (paths.some((p) => p.includes('status'))) {
    return `${activity}, but the result status wasn’t clear. Ask Bonnie to mark it done, partial, or needs follow-up.`;
  }
  if (paths.some((p) => p.includes('tenant'))) {
    return 'Bonnie couldn’t run that for this workspace. Refresh and try again.';
  }

  return `${activity} needed clearer details. Ask Bonnie to try again.`;
}

/** Success / failure line for “What Bonnie handled” style feeds. */
export function businessOutcomeSummary(params: {
  tool?: string | null;
  success?: boolean | null;
  errorMessage?: string | null;
  notes?: string | null;
}): string {
  const activity = businessToolActivity(params.tool || 'define_outcome');
  if (params.success) {
    return params.notes?.trim()
      ? `${activity}: ${params.notes.trim().slice(0, 120)}`
      : `${activity}.`;
  }
  if (params.errorMessage) {
    return sanitizeUserFacingError(params.errorMessage, { tool: params.tool });
  }
  return `${activity} didn’t fully finish.`;
}

/** True when a string looks like developer/schema noise and should not be shown raw. */
export function isTechnicalJargonText(text: string): boolean {
  const t = String(text || '');
  if (looksLikeZodIssuesJson(t.trim())) return true;
  if (/"code"\s*:\s*"invalid_/.test(t)) return true;
  if (/\binvalid_type\b|\binvalid_value\b|\binvalid_format\b/.test(t)) return true;
  if (/\bZodError\b|\.passthrough\(|inputSchema/.test(t)) return true;
  if (/"ok"\s*:\s*false/.test(t)) return true;
  if (/cannot read propert/i.test(t)) return true;
  if (/violates check constraint|violates foreign key/i.test(t)) return true;
  return false;
}
