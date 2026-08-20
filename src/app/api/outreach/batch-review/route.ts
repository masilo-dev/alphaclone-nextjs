import { NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { isEmailSuppressed } from '@/lib/email/suppression';
import { enqueueMcpEvent } from '@/services/mcp/MCPServer';

type OutreachRecord = Record<string, unknown> & {
  id: string;
  email?: string | null;
  contact_email?: string | null;
  emails?: unknown;
  name?: string | null;
  business_name?: string | null;
  marketing_opt_in?: boolean | null;
  email_opt_in?: boolean | null;
  metadata?: Record<string, unknown> | null;
};

type EligibleRecipient = {
  id: string;
  kind: 'lead' | 'client';
  name: string;
  email: string;
};

const MAX_BATCH_RECIPIENTS = 120;

function resolveDirectEmail(record: OutreachRecord): string | null {
  const candidates = [
    record.email,
    record.contact_email,
    ...(Array.isArray(record.emails) ? record.emails : []),
  ];
  const match = candidates.find((value) => typeof value === 'string' && value.trim().includes('@'));
  return typeof match === 'string' ? match.trim().toLowerCase() : null;
}

function hasRecordedMarketingConsent(record: OutreachRecord): boolean {
  const metadata = record.metadata && typeof record.metadata === 'object' ? record.metadata : {};
  return record.marketing_opt_in === true ||
    record.email_opt_in === true ||
    metadata.marketing_opt_in === true ||
    metadata.email_opt_in === true ||
    metadata.marketingConsent === true;
}

/**
 * POST /api/outreach/batch-review
 *
 * A browser-confirmed batch is never sent from the browser. This endpoint
 * validates tenant ownership, direct recipient addresses, recorded marketing
 * consent, and suppression status; writes an audit event; then creates a
 * deferred server-side queue item. The cron worker remains the sole delivery
 * executor and must re-check its own final-confirmation flag.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      tenantId,
      leadIds = [],
      clientIds = [],
      tone = 'professional',
      customContext = '',
      deliveryProvider = 'sendgrid',
      languageMode = 'auto',
      finalConfirmation,
      preview = false,
    } = body as Record<string, unknown>;

    if (typeof tenantId !== 'string' || !tenantId) {
      return NextResponse.json({ error: 'A workspace is required.' }, { status: 400 });
    }
    if (preview !== true && finalConfirmation !== true) {
      return NextResponse.json(
        { error: 'Review the recipient list and confirm the final approval before scheduling outreach.' },
        { status: 400 },
      );
    }

    const normalizedLeadIds = [...new Set(Array.isArray(leadIds) ? leadIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0) : [])];
    const normalizedClientIds = [...new Set(Array.isArray(clientIds) ? clientIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0) : [])];
    const recipientCount = normalizedLeadIds.length + normalizedClientIds.length;

    if (!recipientCount) {
      return NextResponse.json({ error: 'Select at least one recipient.' }, { status: 400 });
    }
    if (recipientCount > MAX_BATCH_RECIPIENTS) {
      return NextResponse.json(
        { error: `A reviewed batch may include up to ${MAX_BATCH_RECIPIENTS} recipients. Split this selection into smaller batches.` },
        { status: 400 },
      );
    }

    const { user, admin } = await requireTenantAccess(tenantId);
    const [leadResult, clientResult] = await Promise.all([
      normalizedLeadIds.length
        ? admin.from('leads').select('*').eq('tenant_id', tenantId).in('id', normalizedLeadIds)
        : Promise.resolve({ data: [] as OutreachRecord[], error: null }),
      normalizedClientIds.length
        ? admin.from('business_clients').select('*').eq('tenant_id', tenantId).in('id', normalizedClientIds)
        : Promise.resolve({ data: [] as OutreachRecord[], error: null }),
    ]);

    if (leadResult.error || clientResult.error) {
      throw leadResult.error || clientResult.error;
    }

    const candidates: Array<{ record: OutreachRecord; kind: 'lead' | 'client' }> = [
      ...((leadResult.data || []) as OutreachRecord[]).map((record) => ({ record, kind: 'lead' as const })),
      ...((clientResult.data || []) as OutreachRecord[]).map((record) => ({ record, kind: 'client' as const })),
    ];

    const preflight = await Promise.all(candidates.map(async ({ record, kind }) => {
      const email = resolveDirectEmail(record);
      const consented = hasRecordedMarketingConsent(record);
      const suppressed = email ? await isEmailSuppressed(tenantId, email) : false;
      const name = String(record.business_name || record.name || email || 'Unnamed recipient');
      const reason = !email
        ? 'missing_direct_email'
        : !consented
          ? 'marketing_consent_not_recorded'
          : suppressed
            ? 'suppressed'
            : null;
      return { record, kind, name, email, reason };
    }));

    const eligible: EligibleRecipient[] = preflight
      .filter((item): item is typeof item & { email: string; reason: null } => Boolean(item.email) && item.reason === null)
      .map((item) => ({ id: item.record.id, kind: item.kind, name: item.name, email: item.email }));
    const excluded = preflight
      .filter((item) => item.reason !== null)
      .map((item) => ({ id: item.record.id, kind: item.kind, name: item.name, reason: item.reason }));

    if (!eligible.length) {
      return NextResponse.json(
        {
          error: 'No recipients passed review. Each recipient needs a direct email address, recorded marketing consent, and a clear suppression status.',
          excluded,
        },
        { status: 400 },
      );
    }

    if (preview === true) {
      return NextResponse.json({
        success: true,
        status: 'review',
        recipientCount: eligible.length,
        recipients: eligible,
        excluded,
        maxRecipients: MAX_BATCH_RECIPIENTS,
        message: `${eligible.length} recipient${eligible.length === 1 ? '' : 's'} passed the preflight. No outreach was sent or queued.`,
      });
    }

    const reviewedAt = new Date().toISOString();
    const queuedLeadIds = eligible.filter((recipient) => recipient.kind === 'lead').map((recipient) => recipient.id);
    const queuedClientIds = eligible.filter((recipient) => recipient.kind === 'client').map((recipient) => recipient.id);
    const batchId = await enqueueMcpEvent(admin, tenantId, user.id, 'send_batch_outreach', {
      lead_ids: queuedLeadIds,
      client_ids: queuedClientIds,
      tone: typeof tone === 'string' ? tone : 'professional',
      custom_context: typeof customContext === 'string' ? customContext : '',
      delivery_provider: typeof deliveryProvider === 'string' ? deliveryProvider : 'sendgrid',
      language_mode: typeof languageMode === 'string' ? languageMode : 'auto',
      final_confirmation: true,
      reviewed_at: reviewedAt,
      reviewed_by: user.id,
      review_version: 1,
      recipient_snapshot: eligible.map(({ id, kind, name, email }) => ({ id, kind, name, email })),
    });

    const { error: auditError } = await admin.from('audit_logs').insert({
      tenant_id: tenantId,
      user_id: user.id,
      action: 'bulk_outreach_reviewed_and_queued',
      entity_type: 'mcp_event_queue',
      entity_id: batchId || null,
      new_values: {
        status: 'pending',
        reviewed_at: reviewedAt,
        recipient_count: eligible.length,
        excluded_count: excluded.length,
        recipient_ids: eligible.map((recipient) => recipient.id),
        exclusions: excluded,
      },
      created_at: reviewedAt,
    });
    if (auditError) {
      console.error('[outreach/batch-review] audit event could not be recorded:', auditError.message);
    }

    return NextResponse.json({
      success: true,
      status: 'queued',
      batchId,
      recipientCount: eligible.length,
      excluded,
      reviewedAt,
      message: `${eligible.length} reviewed recipient${eligible.length === 1 ? '' : 's'} queued for server-side processing. Nothing was sent from this screen.`,
    }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, 'Unable to review and queue this outreach batch');
  }
}
