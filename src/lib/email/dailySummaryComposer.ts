/**
 * Consolidated owner summary — pure scheduling and composition helpers.
 *
 * Frequency rule:
 *  - Default: ONE daily summary at 18:00 owner-local time (customisable hour). Max 7/week.
 *  - Opt-in:  morning (08:00) + evening (18:00 or custom hour). Max 14/week.
 *
 * Summaries go to the tenant owner only. Nothing in here ever addresses a lead or client.
 * Kept free of framework imports so it can be unit tested directly.
 */

export type DigestType = 'morning' | 'evening';
export type SummarySchedule = 'daily' | 'morning_evening';

export interface SummaryPreferences {
  schedule: SummarySchedule;
  eveningHour: number;
  morningHour: number;
  enabled: boolean;
}

export const DEFAULT_EVENING_HOUR = 18;
export const DEFAULT_MORNING_HOUR = 8;

function clampHour(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : fallback;
}

export function normalizeSummaryPreferences(raw: Record<string, unknown> | null | undefined): SummaryPreferences {
  const prefs = raw || {};
  const schedule: SummarySchedule = prefs.summary_schedule === 'morning_evening' ? 'morning_evening' : 'daily';
  const enabled = prefs.daily_summary !== false && prefs.email_notifications !== false;
  return {
    schedule,
    eveningHour: clampHour(prefs.summary_hour, DEFAULT_EVENING_HOUR),
    morningHour: clampHour(prefs.summary_morning_hour, DEFAULT_MORNING_HOUR),
    enabled,
  };
}

export function localDateHour(now: Date, timeZone: string): { date: string; hour: number } {
  const format = (tz: string) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    }).formatToParts(now);
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value || '';
    return { date: `${value('year')}-${value('month')}-${value('day')}`, hour: Number(value('hour')) };
  };
  try {
    return format(timeZone || 'UTC');
  } catch {
    return format('UTC');
  }
}

/** Returns the summary that is due in this hour for the recipient, or null. */
export function resolveDueSummary(
  now: Date,
  timeZone: string,
  prefs: SummaryPreferences = normalizeSummaryPreferences(null),
): { date: string; type: DigestType } | null {
  if (!prefs.enabled) return null;
  const local = localDateHour(now, timeZone);
  if (local.hour === prefs.eveningHour) return { date: local.date, type: 'evening' };
  if (prefs.schedule === 'morning_evening' && local.hour === prefs.morningHour && prefs.morningHour !== prefs.eveningHour) {
    return { date: local.date, type: 'morning' };
  }
  return null;
}

/** Weekly ceiling implied by the schedule (used for verification/reporting). */
export function maxSummariesPerWeek(prefs: SummaryPreferences): number {
  if (!prefs.enabled) return 0;
  return prefs.schedule === 'morning_evening' ? 14 : 7;
}

// ---------------------------------------------------------------------------
// Stalled-work (Universal Chaser) section
// ---------------------------------------------------------------------------

export interface ChaseSummaryRow {
  policy_key: string;
  severity?: string | null;
  reason_code?: string | null;
  context_snapshot?: Record<string, unknown> | null;
}

const POLICY_SECTIONS: Array<{ key: string; label: string; policies: string[] }> = [
  { key: 'projects', label: 'Stalled projects', policies: ['project_chaser'] },
  { key: 'milestones', label: 'Overdue milestones', policies: ['milestone_chaser'] },
  { key: 'tasks', label: 'Overdue tasks', policies: ['task_chaser'] },
  { key: 'leads', label: 'Leads and deals needing attention', policies: ['lead_chaser', 'prospect_deal_chaser', 'contact_chaser'] },
  { key: 'quotes', label: 'Quotes awaiting a decision', policies: ['quote_proposal_chaser'] },
  { key: 'contracts', label: 'Contracts awaiting signature', policies: ['contract_chaser'] },
  { key: 'approvals', label: 'Client approvals / documents awaiting review', policies: ['approval_chaser', 'document_chaser'] },
  { key: 'invoices', label: 'Invoices due or overdue', policies: ['invoice_chaser', 'payment_chaser'] },
  { key: 'clients', label: 'Clients waiting on a response', policies: ['client_response_chaser', 'client_chaser'] },
  { key: 'other', label: 'Other follow-ups', policies: [] },
];

function chaseItemName(row: ChaseSummaryRow): string {
  const c = row.context_snapshot || {};
  const pick = ['name', 'title', 'business_name', 'contact_name', 'invoice_number', 'quote_number', 'client_name', 'subject', 'account_name']
    .map((k) => c[k])
    .find((v) => typeof v === 'string' && v.trim());
  return (pick as string | undefined)?.trim() || 'Untitled item';
}

export interface ChaseSection {
  key: string;
  label: string;
  count: number;
  critical: number;
  items: string[];
}

export function groupChaseItemsForSummary(rows: ChaseSummaryRow[], perSection = 5): ChaseSection[] {
  const sections = new Map<string, ChaseSection>();
  for (const row of rows) {
    const def = POLICY_SECTIONS.find((s) => s.policies.includes(row.policy_key)) || POLICY_SECTIONS[POLICY_SECTIONS.length - 1];
    const section = sections.get(def.key) || { key: def.key, label: def.label, count: 0, critical: 0, items: [] };
    section.count += 1;
    if (row.severity === 'critical' || row.severity === 'high') section.critical += 1;
    if (section.items.length < perSection) {
      const reason = row.reason_code ? ` (${row.reason_code.replace(/_/g, ' ')})` : '';
      section.items.push(`${chaseItemName(row)}${reason}`);
    }
    sections.set(def.key, section);
  }
  return POLICY_SECTIONS.map((s) => sections.get(s.key)).filter((s): s is ChaseSection => Boolean(s));
}

// ---------------------------------------------------------------------------
// Body composition
// ---------------------------------------------------------------------------

export interface AggregatedActivity {
  title: string;
  summary: string;
  severity: string;
  count: number;
}

export function escapeSummaryHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const NO_OUTSTANDING_ACTIONS = 'No outstanding actions today.';

export function composeSummaryBody(input: {
  type: DigestType;
  date: string;
  activity: AggregatedActivity[];
  eventCount: number;
  chaseSections: ChaseSection[];
}): { subject: string; bodyHtml: string; bodyText: string; isQuiet: boolean } {
  const { type, date, activity, eventCount, chaseSections } = input;
  const subject = type === 'morning'
    ? `Good morning — your AlphaClone business brief (${date})`
    : `Your AlphaClone daily summary — ${date}`;
  const stalledTotal = chaseSections.reduce((sum, s) => sum + s.count, 0);
  const attention = activity.filter((a) => ['critical', 'error', 'warning'].includes(a.severity));
  const isQuiet = stalledTotal === 0 && activity.length === 0;

  if (isQuiet) {
    return {
      subject,
      isQuiet,
      bodyHtml: `<p><strong>${NO_OUTSTANDING_ACTIONS}</strong></p><p>No stalled projects, overdue milestones, pending quotes, unsigned contracts, or unpaid invoices were detected.</p>`,
      bodyText: `${NO_OUTSTANDING_ACTIONS}\nNo stalled projects, overdue milestones, pending quotes, unsigned contracts, or unpaid invoices were detected.`,
    };
  }

  const html: string[] = [];
  const text: string[] = [];

  if (stalledTotal > 0) {
    html.push(`<h2>Needs your attention (${stalledTotal})</h2>`);
    text.push(`NEEDS YOUR ATTENTION (${stalledTotal})`);
    for (const section of chaseSections) {
      const more = section.count > section.items.length ? `<li>…and ${section.count - section.items.length} more</li>` : '';
      html.push(`<h3>${escapeSummaryHtml(section.label)} — ${section.count}</h3><ul>${section.items.map((i) => `<li>${escapeSummaryHtml(i)}</li>`).join('')}${more}</ul>`);
      text.push(`${section.label}: ${section.count}`);
      for (const item of section.items) text.push(`  - ${item}`);
    }
  }

  if (activity.length > 0) {
    html.push(`<h2>${type === 'morning' ? 'Since your last summary' : 'Today\u2019s activity'}</h2>`);
    html.push(`<p>${eventCount} event(s) consolidated into ${activity.length} update(s)${attention.length ? `, ${attention.length} flagged` : ''}.</p>`);
    text.push('', `ACTIVITY: ${eventCount} event(s) consolidated into ${activity.length} update(s)`);
    const rows = activity.slice(0, 30).map((item) => {
      const icon = item.severity === 'error' || item.severity === 'critical' ? '⚠' : '✓';
      const prefix = item.count > 1 ? `${item.count} × ` : '';
      const detail = item.count === 1 && item.summary ? ` — ${escapeSummaryHtml(item.summary)}` : '';
      text.push(`  ${icon} ${prefix}${item.title}${item.count === 1 && item.summary ? ` — ${item.summary}` : ''}`);
      return `<li>${icon} <strong>${prefix}${escapeSummaryHtml(item.title)}</strong>${detail}</li>`;
    });
    html.push(`<ul>${rows.join('')}</ul>`);
  }

  html.push('<p style="color:#64748b;font-size:12px;">Internal owner summary. No client or lead has been contacted as a result of these detections — follow-ups require your action or approval.</p>');
  return { subject, isQuiet, bodyHtml: html.join(''), bodyText: text.join('\n') };
}
