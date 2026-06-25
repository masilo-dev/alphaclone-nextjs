import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { notifyTenantOwners } from '@/lib/notifyTenantOwners';
import { sendEmailServer } from '@/lib/email/sendEmailServer';

export const dynamic = 'force-dynamic';

const notifySchema = z.object({
  event: z.enum(['created', 'status_changed', 'comment']),
  tenantId: z.string().uuid(),
  ticketId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  customerEmail: z.string().email().optional().or(z.literal('')),
  commentPreview: z.string().optional(),
  isInternalComment: z.boolean().optional(),
});

function appBaseUrl(): string {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://www.alphaclonesystems.com';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = notifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const payload = parsed.data;
    await requireTenantAccess(payload.tenantId);

    const admin = createAdminSupabaseClientOrThrow();
    const ticketUrl = `${appBaseUrl()}/dashboard/business/tickets?ticket=${payload.ticketId}`;

    if (payload.event === 'created') {
      await notifyTenantOwners({
        tenantId: payload.tenantId,
        type: 'ticket_created',
        title: `New support ticket: ${payload.title}`,
        message: payload.description
          ? `${payload.title}\n\n${payload.description.slice(0, 500)}`
          : payload.title,
        link: ticketUrl,
      });

      const customerEmail = payload.customerEmail?.trim();
      if (customerEmail) {
        await sendEmailServer({
          tenantId: payload.tenantId,
          to: customerEmail,
          subject: `We received your request: ${payload.title}`,
          isPlatformNotification: true,
          html: `
            <div style="font-family:sans-serif;padding:24px;color:#333;max-width:560px;">
              <h2 style="color:#0d9488;margin:0 0 12px;">Request received</h2>
              <p>Thank you for contacting us. We have logged your support request and will respond soon.</p>
              <p><strong>${payload.title}</strong></p>
              ${payload.description ? `<p style="color:#555;">${payload.description.slice(0, 1000)}</p>` : ''}
              <p style="color:#888;font-size:13px;">Reference: ${payload.ticketId.slice(0, 8)}</p>
            </div>
          `,
          templateName: 'ticketConfirmation',
        }).catch((err) => console.error('[tickets/notify] customer email failed:', err));
      }
    }

    if (payload.event === 'status_changed') {
      await notifyTenantOwners({
        tenantId: payload.tenantId,
        type: 'ticket_updated',
        title: `Ticket updated: ${payload.title}`,
        message: `Status changed to ${payload.status || 'updated'}.`,
        link: ticketUrl,
      });

      const customerEmail = payload.customerEmail?.trim();
      if (customerEmail && payload.status) {
        await sendEmailServer({
          tenantId: payload.tenantId,
          to: customerEmail,
          subject: `Update on your request: ${payload.title}`,
          isPlatformNotification: true,
          html: `
            <div style="font-family:sans-serif;padding:24px;color:#333;max-width:560px;">
              <h2 style="color:#0d9488;margin:0 0 12px;">Ticket update</h2>
              <p>Your support request <strong>${payload.title}</strong> is now <strong>${payload.status.replace(/_/g, ' ')}</strong>.</p>
            </div>
          `,
          templateName: 'ticketStatusUpdate',
        }).catch((err) => console.error('[tickets/notify] status email failed:', err));
      }
    }

    if (payload.event === 'comment' && !payload.isInternalComment) {
      const customerEmail = payload.customerEmail?.trim();
      if (customerEmail && payload.commentPreview) {
        await sendEmailServer({
          tenantId: payload.tenantId,
          to: customerEmail,
          subject: `Reply to your request: ${payload.title}`,
          isPlatformNotification: true,
          html: `
            <div style="font-family:sans-serif;padding:24px;color:#333;max-width:560px;">
              <h2 style="color:#0d9488;margin:0 0 12px;">New reply</h2>
              <p>Our team replied to <strong>${payload.title}</strong>:</p>
              <blockquote style="border-left:3px solid #0d9488;padding-left:12px;color:#555;margin:16px 0;">
                ${payload.commentPreview.slice(0, 2000)}
              </blockquote>
            </div>
          `,
          templateName: 'ticketReply',
        }).catch((err) => console.error('[tickets/notify] reply email failed:', err));
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return routeErrorResponse(err);
  }
}
