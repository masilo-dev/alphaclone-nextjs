import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { captureUnifiedMessageFromWebhook } from '@/services/intelligence/signalCaptureAdminService';
import { quantumDealIntelligenceService } from '@/services/intelligence/quantumDealIntelligenceService';

export const dynamic = 'force-dynamic';

const schema = z.object({
  tenantId: z.string().uuid(),
  source: z
    .enum(['internal', 'gmail', 'zoho', 'sms', 'slack', 'teams', 'brevo', 'resend', 'sendgrid', 'facebook', 'whatsapp', 'linkedin', 'mcp'])
    .default('mcp'),
  channel: z.enum(['email', 'chat', 'sms', 'call']),
  direction: z.enum(['inbound', 'outbound']),
  from: z.string().min(1),
  to: z.string().min(1),
  subject: z.string().optional(),
  text: z.string().optional(),
  html: z.string().optional(),
  externalId: z.string().optional(),
  threadId: z.string().optional(),
  dealId: z.string().uuid().optional(),
  eventType: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const input = parsed.data;
    await requireTenantAccess(input.tenantId);
    const admin = createAdminSupabaseClientOrThrow();

    const captured = await captureUnifiedMessageFromWebhook({
      supabase: admin as any,
      tenantId: input.tenantId,
      source: input.source,
      channel: input.channel,
      direction: input.direction,
      externalId: input.externalId ?? null,
      threadId: input.threadId ?? null,
      from: input.from,
      to: input.to,
      subject: input.subject ?? null,
      text: input.text ?? null,
      html: input.html ?? null,
      metadata: input.metadata ?? {},
    });

    if (input.dealId) {
      await admin.from('deal_intelligence_events').insert({
        tenant_id: input.tenantId,
        deal_id: input.dealId,
        event_type: input.eventType || `${input.source}.${input.channel}.${input.direction}`,
        payload: {
          message_id: captured.message?.id,
          from: input.from,
          to: input.to,
          subject: input.subject,
          thread_id: input.threadId,
          metadata: input.metadata || {},
        },
        source: input.source,
      });

      await quantumDealIntelligenceService.recomputeDeal(admin as any, input.tenantId, input.dealId);
    }

    return NextResponse.json({ success: true, messageId: captured.message?.id });
  } catch (error: any) {
    return routeErrorResponse(error, 'Failed to ingest signal');
  }
}
