import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import {
  listMailboxes, createMailbox, updateMailbox,
  checkMailboxHealth, checkDomainHealth,
} from '@/lib/outbound/mailboxService';

const createSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  provider: z.enum(['microsoft', 'zoho', 'brevo', 'resend', 'sendgrid', 'smtp', 'other']),
  email_address: z.string().email().max(320),
  from_name: z.string().max(200).optional(),
  reply_to: z.string().email().optional(),
  is_primary_domain: z.boolean().default(false),
  daily_limit: z.number().int().min(1).max(10000).default(100),
  hourly_limit: z.number().int().min(1).optional(),
});

const updateSchema = z.object({
  tenantId: z.string().uuid(),
  mailboxId: z.string().uuid(),
  name: z.string().trim().min(1).max(200).optional(),
  from_name: z.string().max(200).optional(),
  reply_to: z.string().email().optional(),
  is_primary_domain: z.boolean().optional(),
  sending_enabled: z.boolean().optional(),
  daily_limit: z.number().int().min(1).max(10000).optional(),
  hourly_limit: z.number().int().min(1).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId') || '';
    const action = request.nextUrl.searchParams.get('action');
    const mailboxId = request.nextUrl.searchParams.get('mailboxId');

    if (!z.string().uuid().safeParse(tenantId).success) {
      return NextResponse.json({ error: 'Valid tenantId required' }, { status: 400 });
    }
    await requireTenantAccess(tenantId, request);

    if (action === 'health' && mailboxId) {
      const health = await checkMailboxHealth(tenantId, mailboxId);
      return NextResponse.json({ success: true, health });
    }

    if (action === 'dns' && mailboxId) {
      const mailboxes = await listMailboxes(tenantId);
      const mailbox = mailboxes.find((m) => m.id === mailboxId);
      if (!mailbox?.domain) {
        return NextResponse.json({ error: 'Mailbox not found or has no domain' }, { status: 404 });
      }
      const dns = await checkDomainHealth(tenantId, mailboxId, mailbox.domain);
      return NextResponse.json({ success: true, dns });
    }

    const mailboxes = await listMailboxes(tenantId);

    // Enrich with health for each
    const enriched = await Promise.allSettled(
      mailboxes.map((m) => checkMailboxHealth(tenantId, m.id))
    );
    const withHealth = mailboxes.map((m, i) => ({
      ...m,
      health: enriched[i].status === 'fulfilled' ? enriched[i].value : null,
    }));

    return NextResponse.json({ success: true, mailboxes: withHealth });
  } catch (error) {
    return routeErrorResponse(error, 'Mailboxes could not be loaded', request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid mailbox data', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { user } = await requireTenantAccess(parsed.data.tenantId, request);
    const mailbox = await createMailbox(parsed.data.tenantId, user.id, parsed.data);
    return NextResponse.json({ success: true, mailbox }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, 'Mailbox could not be created', request);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid mailbox update', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    await requireTenantAccess(parsed.data.tenantId, request);
    const { tenantId, mailboxId, ...updates } = parsed.data;
    const mailbox = await updateMailbox(tenantId, mailboxId, updates);
    return NextResponse.json({ success: true, mailbox });
  } catch (error) {
    return routeErrorResponse(error, 'Mailbox could not be updated', request);
  }
}
