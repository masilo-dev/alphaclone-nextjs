import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePlatformSuperAdmin, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmail } from '@/lib/email/sendEmail';
import { logPlatformAdminAction } from '@/lib/security/adminAuditLog';

export const dynamic = 'force-dynamic';

const sendSchema = z.object({
  audience: z.enum(['all', 'tenant', 'user']),
  tenantId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  subject: z.string().trim().min(1).max(180),
  message: z.string().trim().min(1).max(20000),
});

type Recipient = {
  email: string;
  tenantId: string;
  userId?: string;
};

async function listAllAuthUsers(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const users: Array<{ id: string; email?: string | null }> = [];
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...(data.users || []));
    if ((data.users || []).length < 1000) break;
  }
  return users;
}

async function resolveRecipients(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  body: z.infer<typeof sendSchema>,
): Promise<Recipient[]> {
  const { data: memberships, error: membershipError } = await admin
    .from('tenant_users')
    .select('tenant_id,user_id');
  if (membershipError) throw membershipError;

  const firstTenantByUser = new Map<string, string>();
  for (const row of memberships || []) {
    if (!firstTenantByUser.has(row.user_id)) firstTenantByUser.set(row.user_id, row.tenant_id);
  }

  const users = await listAllAuthUsers(admin);
  const byId = new Map(users.map((user) => [user.id, user]));
  const recipients: Recipient[] = [];

  if (body.audience === 'tenant') {
    if (!body.tenantId) throw new Error('tenantId is required for tenant audience');
    for (const row of memberships || []) {
      if (row.tenant_id !== body.tenantId) continue;
      const user = byId.get(row.user_id);
      if (user?.email) recipients.push({ email: user.email, tenantId: row.tenant_id, userId: user.id });
    }
  } else if (body.audience === 'user') {
    if (!body.email) throw new Error('email is required for user audience');
    const normalized = body.email.trim().toLowerCase();
    const user = users.find((entry) => entry.email?.trim().toLowerCase() === normalized);
    if (!user?.email) return [];
    const tenantId = firstTenantByUser.get(user.id);
    if (!tenantId) return [];
    recipients.push({ email: user.email, tenantId, userId: user.id });
  } else {
    for (const user of users) {
      if (!user.email) continue;
      const tenantId = firstTenantByUser.get(user.id);
      if (!tenantId) continue;
      recipients.push({ email: user.email, tenantId, userId: user.id });
    }
  }

  const seen = new Set<string>();
  return recipients.filter((recipient) => {
    const key = recipient.email.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function sendInBatches(recipients: Recipient[], subject: string, message: string) {
  const batchSize = 10;
  let sent = 0;
  let failed = 0;
  const failures: Array<{ email: string; error: string }> = [];

  for (let index = 0; index < recipients.length; index += batchSize) {
    const batch = recipients.slice(index, index + batchSize);
    const results = await Promise.all(
      batch.map(async (recipient) => {
        const result = await sendEmail(recipient.tenantId, {
          to: recipient.email,
          subject,
          text: message,
          isPlatformNotification: true,
          skipRecipientGate: true,
          skipBonnieQualityCheck: true,
          userId: recipient.userId,
          auditMetadata: {
            source: 'super_admin_control_center',
            audience: recipients.length === 1 ? 'individual' : 'broadcast',
          },
        });
        return { recipient, result };
      }),
    );

    for (const { recipient, result } of results) {
      if (result.success) {
        sent += 1;
      } else {
        failed += 1;
        failures.push({ email: recipient.email, error: result.error || 'Unknown delivery error' });
      }
    }
  }

  return { sent, failed, failures: failures.slice(0, 20) };
}

export async function GET() {
  try {
    await requirePlatformSuperAdmin();
    const admin = createSupabaseAdminClient();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [tenantResult, errorResult, emailResult, auditResult, users] = await Promise.all([
      admin.from('tenants').select('id,name,subscription_status,subscription_tier', { count: 'exact' }).is('deletion_pending_at', null).order('created_at', { ascending: false }).limit(100),
      admin.from('error_logs').select('id,tenant_id,error_type,error_message,message,endpoint,status_code,severity,created_at').gte('created_at', since24h).order('created_at', { ascending: false }).limit(50),
      admin.from('email_logs').select('id,status,provider,to_email,subject,error,created_at').gte('created_at', since24h).order('created_at', { ascending: false }).limit(50),
      admin.from('security_logs').select('id,event_type,severity,created_at,event_details').order('created_at', { ascending: false }).limit(25),
      listAllAuthUsers(admin),
    ]);

    if (tenantResult.error) throw tenantResult.error;
    if (errorResult.error) throw errorResult.error;
    if (emailResult.error) throw emailResult.error;
    if (auditResult.error) throw auditResult.error;

    const errors = errorResult.data || [];
    const emails = emailResult.data || [];
    const tenants = tenantResult.data || [];

    return NextResponse.json({
      success: true,
      summary: {
        tenants: tenantResult.count ?? tenants.length,
        users: users.filter((user) => Boolean(user.email)).length,
        errors24h: errors.length,
        criticalErrors24h: errors.filter((row) => ['critical', 'error'].includes(String(row.severity || '').toLowerCase())).length,
        emails24h: emails.filter((row) => row.status === 'sent').length,
        emailFailures24h: emails.filter((row) => row.status === 'failed').length,
      },
      tenants: tenants.map((tenant) => ({
        id: tenant.id,
        name: tenant.name,
        status: tenant.subscription_status || 'active',
        plan: tenant.subscription_tier || 'free',
      })),
      recentErrors: errors,
      recentEmails: emails,
      recentAdminActivity: auditResult.data || [],
    });
  } catch (err) {
    return routeErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requirePlatformSuperAdmin();
    const parsed = sendSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const recipients = await resolveRecipients(admin, parsed.data);
    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No deliverable recipients found for that audience.' }, { status: 404 });
    }

    const result = await sendInBatches(recipients, parsed.data.subject, parsed.data.message);

    await logPlatformAdminAction({
      adminUserId: user.id,
      tenantId: parsed.data.audience === 'tenant' ? parsed.data.tenantId ?? null : null,
      eventType: 'PLATFORM_ADMIN_EMAIL_SEND',
      severity: result.failed > 0 ? 'warning' : 'info',
      eventDetails: {
        audience: parsed.data.audience,
        recipientCount: recipients.length,
        sent: result.sent,
        failed: result.failed,
        subject: parsed.data.subject,
      },
    });

    return NextResponse.json({ success: result.failed === 0, recipientCount: recipients.length, ...result });
  } catch (err) {
    return routeErrorResponse(err);
  }
}
