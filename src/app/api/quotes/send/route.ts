import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import {
  buildQuoteDocumentInput,
} from '@/lib/documents/documentBuilders';
import { htmlToPdfBuffer } from '@/lib/documents/htmlToPdfBuffer';
import { renderDocumentHtml } from '@/lib/documents/renderDocument';

async function renderQuotePdfBuffer(quote: any, items: any[], tenant: any): Promise<Buffer> {
  const html = renderDocumentHtml(buildQuoteDocumentInput(quote, items, tenant));
  return htmlToPdfBuffer(html);
}

export async function POST(req: NextRequest) {
  try {
    const { tenantId, quoteId, recipients, subject, message } = await req.json();
    if (!tenantId || !quoteId || !recipients) {
      return NextResponse.json({ error: 'tenantId, quoteId, and recipients are required' }, { status: 400 });
    }
    const { user, admin: supabase } = await requireTenantAccess(tenantId);
    const { data: quote, error } = await supabase
      .from('quotes')
      .select('*, tenant:tenants(*)')
      .eq('id', quoteId)
      .eq('tenant_id', tenantId)
      .single();
    if (error || !quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });

    const { data: items } = await supabase
      .from('quote_items')
      .select('*')
      .eq('quote_id', quoteId)
      .order('item_order', { ascending: true });

    const publicToken =
        (quote.metadata as Record<string, string> | null)?.public_token || crypto.randomUUID();
    const responseLink = `${req.nextUrl.origin}/quote/${publicToken}`;

    // Resolve tenant sender so quotes go out from the business email, not platform default.
    const { data: integrationRows } = await supabase
        .from('integrations')
        .select('type, config')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('enabled', true);
    let fromName = String(user.user_metadata?.full_name || user.email?.split('@')[0] || '').trim();
    let fromEmail = String(user.email || '').trim();
    for (const row of integrationRows || []) {
        const cfg = (row.config || {}) as Record<string, unknown>;
        if (cfg.fromName || cfg.from_name) fromName = String(cfg.fromName || cfg.from_name).trim();
        if (cfg.fromEmail || cfg.from_email) fromEmail = String(cfg.fromEmail || cfg.from_email).trim();
    }

    const quoteMeta = (quote.metadata || {}) as Record<string, unknown>;
    const clientEmail =
        (quote as { client_email?: string }).client_email ||
        (quoteMeta.client_email as string | undefined);

    const pdfBuffer = await renderQuotePdfBuffer(quote, items || [], quote.tenant);
    const emailBody = [
      message || `Please find attached quote ${quote.quote_number}.`,
      '',
      `Review and respond online: ${responseLink}`,
    ].join('\n');

    const emailResponse = await fetch(`${req.nextUrl.origin}/api/email/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': process.env.INTERNAL_API_KEY || '',
      },
      body: JSON.stringify({
        tenantId,
        userId: user.id,
        fromName: fromName || undefined,
        fromEmail: fromEmail || undefined,
        to: recipients,
        subject: subject || `Quote ${quote.quote_number}`,
        text: emailBody,
        html: `
          <p>${message || `Please find attached quote ${quote.quote_number}.`}</p>
          <p><a href="${responseLink}" style="display:inline-block;padding:12px 24px;background:#0d9488;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Review &amp; Respond</a></p>
          <p style="color:#64748b;font-size:12px;">Or copy this link: ${responseLink}</p>
        `,
        attachments: [{
          filename: `Quote_${quote.quote_number}.pdf`,
          content: pdfBuffer.toString('base64'),
          contentType: 'application/pdf',
        }],
      }),
    });

    if (!emailResponse.ok) {
      const payload = await emailResponse.json().catch(() => ({}));
      return NextResponse.json({ error: payload?.error || 'Failed to send quote email' }, { status: 502 });
    }

    await supabase
      .from('quotes')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        metadata: {
          ...(quote.metadata || {}),
          public_token: publicToken,
          ...(clientEmail ? { client_email: clientEmail } : {}),
        },
      })
      .eq('id', quoteId)
      .eq('tenant_id', tenantId);

    return NextResponse.json({ success: true, message: 'Quote sent successfully', responseLink });
  } catch (error) {
    console.error('[quotes/send] error:', error);
    return routeErrorResponse(error, 'Failed to send quote', req);
  }
}

