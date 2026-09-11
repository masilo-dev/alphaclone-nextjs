import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type ActivityDigestSummary = {
  tenantId: string;
  tenantName: string;
  since: string;
  until: string;
  leads: number;
  deals: number;
  tasks: number;
  invoices: number;
  socialPosts: number;
  messages: number;
  assignedTasks: number;
  total: number;
  lines: string[];
};

const DIGEST_WINDOW_MS = 3 * 60 * 60 * 1000;

export function digestWindowStart(lastSentAt: string | null): string {
  const threeHoursAgo = new Date(Date.now() - DIGEST_WINDOW_MS).toISOString();
  if (!lastSentAt) return threeHoursAgo;
  const last = new Date(lastSentAt);
  if (Number.isNaN(last.getTime())) return threeHoursAgo;
  return last.toISOString() > threeHoursAgo ? last.toISOString() : threeHoursAgo;
}

async function countSince(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  table: string,
  tenantId: string,
  since: string,
  extra?: (q: ReturnType<typeof admin.from>) => ReturnType<typeof admin.from>
): Promise<number> {
  let query = admin
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', since);
  if (extra) query = extra(query);
  const { count, error } = await query;
  if (error) {
    console.warn(`[activityDigest] count ${table}:`, error.message);
    return 0;
  }
  return count ?? 0;
}

export async function collectActivityDigest(
  tenantId: string,
  userId: string,
  since: string
): Promise<ActivityDigestSummary> {
  const admin = createSupabaseAdminClient();
  const until = new Date().toISOString();

  const { data: tenantRow } = await admin
    .from('tenants')
    .select('name, business_name')
    .eq('id', tenantId)
    .maybeSingle();

  const tenantName =
    String(tenantRow?.business_name || tenantRow?.name || 'Your workspace').trim() || 'Your workspace';

  const [leads, deals, tasks, invoices, socialPosts, messages, assignedTasks] = await Promise.all([
    countSince(admin, 'leads', tenantId, since),
    countSince(admin, 'deals', tenantId, since),
    countSince(admin, 'tasks', tenantId, since),
    countSince(admin, 'business_invoices', tenantId, since),
    countSince(admin, 'social_posts', tenantId, since),
    countSince(admin, 'messages', tenantId, since),
    countSince(admin, 'tasks', tenantId, since, (q) =>
      q.eq('assigned_to', userId).neq('status', 'completed')
    ),
  ]);

  const lines: string[] = [];
  if (leads > 0) lines.push(`${leads} new lead${leads === 1 ? '' : 's'}`);
  if (deals > 0) lines.push(`${deals} new deal${deals === 1 ? '' : 's'}`);
  if (tasks > 0) lines.push(`${tasks} new task${tasks === 1 ? '' : 's'}`);
  if (invoices > 0) lines.push(`${invoices} new invoice${invoices === 1 ? '' : 's'}`);
  if (socialPosts > 0) lines.push(`${socialPosts} social post${socialPosts === 1 ? '' : 's'}`);
  if (messages > 0) lines.push(`${messages} new message${messages === 1 ? '' : 's'}`);
  if (assignedTasks > 0) lines.push(`${assignedTasks} open task${assignedTasks === 1 ? '' : 's'} assigned to you`);

  const total = leads + deals + tasks + invoices + socialPosts + messages;

  return {
    tenantId,
    tenantName,
    since,
    until,
    leads,
    deals,
    tasks,
    invoices,
    socialPosts,
    messages,
    assignedTasks,
    total,
    lines,
  };
}

export function formatDigestEmailHtml(params: {
  userName: string;
  tenantName: string;
  summary: ActivityDigestSummary;
  dashboardUrl: string;
}): string {
  const { userName, tenantName, summary, dashboardUrl } = params;
  const period = `${new Date(summary.since).toLocaleString()} – ${new Date(summary.until).toLocaleString()}`;

  if (summary.lines.length === 0) {
    return `<p>Hi ${userName},</p><p>No new activity in <strong>${tenantName}</strong> during the last check (${period}).</p><p><a href="${dashboardUrl}">Open dashboard</a></p>`;
  }

  const list = summary.lines.map((line) => `<li>${line}</li>`).join('');
  return `<p>Hi ${userName},</p>
<p>Here's what was added in <strong>${tenantName}</strong> (${period}):</p>
<ul>${list}</ul>
<p><a href="${dashboardUrl}">Open dashboard</a></p>
<p style="color:#666;font-size:12px;">You're receiving this every 3 hours because activity digest is enabled on your account.</p>`;
}
