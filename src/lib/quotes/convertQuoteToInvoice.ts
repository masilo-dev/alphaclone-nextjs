import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import crypto from 'crypto';

export async function convertQuoteToInvoice(
    quoteId: string,
    tenantId: string,
    options?: { autoSend?: boolean; origin?: string }
): Promise<{ invoiceId: string | null; publicToken: string | null; error: string | null }> {
    const admin = createSupabaseAdminClient();

    const { data: quote, error: quoteError } = await admin
        .from('quotes')
        .select('*, tenant:tenants(name, settings)')
        .eq('id', quoteId)
        .eq('tenant_id', tenantId)
        .single();

    if (quoteError || !quote) {
        return { invoiceId: null, publicToken: null, error: 'Quote not found' };
    }
    if (quote.status === 'converted') {
        const existingId = (quote.metadata as Record<string, string> | null)?.converted_invoice_id;
        const existingToken = (quote.metadata as Record<string, string> | null)?.invoice_public_token;
        return { invoiceId: existingId || null, publicToken: existingToken || null, error: null };
    }

    const { data: items } = await admin
        .from('quote_items')
        .select('*')
        .eq('quote_id', quoteId)
        .order('item_order', { ascending: true });

    const metadata = (quote.metadata || {}) as Record<string, unknown>;
    const clientEmail =
        (quote as { client_email?: string }).client_email ||
        (metadata.client_email as string | undefined) ||
        undefined;

    const publicToken = crypto.randomUUID();
    const invoiceNum = `INV-${Date.now().toString(36).toUpperCase()}`;
    const total = Number(quote.total_amount || 0);
    const subtotal = Number(quote.subtotal || total);
    const origin = options?.origin || process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com';

    const { data: inv, error: invError } = await admin
        .from('business_invoices')
        .insert({
            tenant_id: tenantId,
            invoice_number: invoiceNum,
            client_name: quote.name,
            client_email: clientEmail || null,
            issue_date: new Date().toISOString(),
            due_date: quote.valid_until || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'sent',
            subtotal,
            tax_rate: Number(quote.tax_percent || 0),
            tax: Number(quote.tax_amount || 0),
            discount_amount: Number(quote.discount_amount || 0),
            total,
            notes: `Generated from accepted quote ${quote.quote_number}`,
            is_public: true,
            metadata: {
                converted_from_quote_id: quoteId,
                public_token: publicToken,
            },
        })
        .select('id')
        .single();

    if (invError || !inv) {
        return { invoiceId: null, publicToken: null, error: invError?.message || 'Failed to create invoice' };
    }

    if (items && items.length > 0) {
        await admin.from('invoice_line_items').insert(
            items.map((item: Record<string, unknown>, idx: number) => ({
                invoice_id: inv.id,
                description: item.product_name || item.description || 'Item',
                quantity: Number(item.quantity || 1),
                unit_price: Number(item.unit_price || 0),
                line_total: Number(item.line_total || 0),
                sort_order: idx,
            }))
        );
    } else if (total > 0) {
        await admin.from('invoice_line_items').insert({
            invoice_id: inv.id,
            description: quote.name || 'Quote total',
            quantity: 1,
            unit_price: total,
            line_total: total,
            sort_order: 0,
        });
    }

    await admin
        .from('quotes')
        .update({
            status: 'converted',
            metadata: {
                ...metadata,
                converted_invoice_id: inv.id,
                invoice_public_token: publicToken,
                converted_at: new Date().toISOString(),
            },
        })
        .eq('id', quoteId);

    const payUrl = `${origin.replace(/\/$/, '')}/invoice/${inv.id}?token=${publicToken}`;

    if (options?.autoSend !== false && clientEmail) {
        const tenantName = (quote.tenant as { name?: string } | null)?.name || 'Your provider';
        await sendEmailServer({
            tenantId,
            to: clientEmail,
            subject: `Invoice ${invoiceNum} from ${tenantName}`,
            html: `
              <p>Hi ${quote.name || 'there'},</p>
              <p>Thank you for accepting quote <strong>${quote.quote_number}</strong>. Your invoice is ready.</p>
              <p><a href="${payUrl}" style="display:inline-block;padding:12px 24px;background:#14b8a6;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">View & Pay Invoice</a></p>
              <p>Or copy this link: ${payUrl}</p>
            `,
            templateName: 'quote_accepted_invoice',
        }).catch((err) => console.error('[convertQuoteToInvoice] email failed:', err));
    }

    return { invoiceId: inv.id, publicToken, error: null };
}
