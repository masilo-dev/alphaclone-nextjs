import 'server-only';

import {
    resolveBusinessClientIdForParty,
    resolvePartyEmail,
} from '@/lib/contracts/contractCoherenceServer';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import crypto from 'crypto';

const CONVERTIBLE_STATUSES = new Set(['accepted', 'sent', 'viewed', 'draft']);

function toDateOnly(value: string | null | undefined, fallbackDays = 30): string {
    if (value) {
        const slice = value.slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(slice)) return slice;
    }
    return new Date(Date.now() + fallbackDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function normalizeCurrencyCode(value: string | null | undefined): string {
    const code = String(value || 'USD')
        .trim()
        .toUpperCase()
        .slice(0, 3);
    return code.length === 3 ? code : 'USD';
}

function mapQuoteItemToInvoiceLine(
    item: Record<string, unknown>,
    invoiceId: string,
    tenantId: string,
    index: number,
) {
    const quantity = Number(item.quantity || 1) || 1;
    const unitPrice = Number(item.unit_price || 0) || 0;
    const lineTotal = Number(item.line_total || quantity * unitPrice) || quantity * unitPrice;
    return {
        invoice_id: invoiceId,
        tenant_id: tenantId,
        description: String(item.product_name || item.description || 'Item'),
        quantity,
        unit_price: unitPrice,
        amount: lineTotal,
        position: index + 1,
    };
}

export async function convertQuoteToInvoice(
    quoteId: string,
    tenantId: string,
    options?: { autoSend?: boolean; origin?: string },
): Promise<{ invoiceId: string | null; publicToken: string | null; error: string | null }> {
    const admin = createSupabaseAdminClient();

    const { data: quote, error: quoteError } = await admin
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .eq('tenant_id', tenantId)
        .single();

    if (quoteError || !quote) {
        return { invoiceId: null, publicToken: null, error: 'Quote not found' };
    }
    if (quote.status === 'converted') {
        const meta = quote.metadata as Record<string, string> | null;
        return {
            invoiceId: meta?.converted_invoice_id || null,
            publicToken: meta?.invoice_public_token || null,
            error: null,
        };
    }
    if (!CONVERTIBLE_STATUSES.has(String(quote.status))) {
        return {
            invoiceId: null,
            publicToken: null,
            error: `Quote status "${quote.status}" cannot be converted to an invoice`,
        };
    }

    const { data: items } = await admin
        .from('quote_items')
        .select('*')
        .eq('quote_id', quoteId)
        .order('item_order', { ascending: true });

    const metadata = (quote.metadata || {}) as Record<string, unknown>;
    const partyId = quote.client_id || quote.contact_id || null;
    const clientId = await resolveBusinessClientIdForParty(admin, tenantId, partyId);
    const clientEmail =
        (quote as { client_email?: string }).client_email ||
        (metadata.client_email as string | undefined) ||
        (await resolvePartyEmail(admin, tenantId, partyId));

    const publicToken = crypto.randomUUID();
    const invoiceNum = `INV-${Date.now().toString(36).toUpperCase()}`;
    const total = Number(quote.total_amount || 0);
    const subtotal = Number(quote.subtotal || total);
    const autoSend = options?.autoSend === true;
    const invoiceStatus = autoSend ? 'sent' : 'draft';
    const origin = options?.origin || process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com';
    const issueDate = toDateOnly(new Date().toISOString().slice(0, 10));
    const dueDate = toDateOnly(quote.valid_until);

    const { data: inv, error: invError } = await admin
        .from('business_invoices')
        .insert({
            tenant_id: tenantId,
            client_id: clientId,
            quote_id: quoteId,
            invoice_number: invoiceNum,
            client_name: quote.name,
            client_email: clientEmail || null,
            issue_date: issueDate,
            due_date: dueDate,
            status: invoiceStatus,
            subtotal,
            tax_rate: Number(quote.tax_percent || 0),
            tax: Number(quote.tax_amount || 0),
            discount_amount: Number(quote.discount_amount || 0),
            total,
            currency: quote.currency || 'USD',
            currency_code: normalizeCurrencyCode(quote.currency),
            notes: `Generated from quote ${quote.quote_number}`,
            is_public: true,
            ...(autoSend ? { sent_at: new Date().toISOString() } : {}),
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
        const { error: lineError } = await admin.from('invoice_line_items').insert(
            items.map((item: Record<string, unknown>, idx: number) =>
                mapQuoteItemToInvoiceLine(item, inv.id, tenantId, idx),
            ),
        );
        if (lineError) {
            await admin.from('business_invoices').delete().eq('id', inv.id).eq('tenant_id', tenantId);
            return { invoiceId: null, publicToken: null, error: lineError.message || 'Failed to create invoice line items' };
        }
    } else if (total > 0) {
        const { error: lineError } = await admin.from('invoice_line_items').insert(
            mapQuoteItemToInvoiceLine(
                {
                    product_name: quote.name || 'Quote total',
                    quantity: 1,
                    unit_price: total,
                    line_total: total,
                },
                inv.id,
                tenantId,
                0,
            ),
        );
        if (lineError) {
            await admin.from('business_invoices').delete().eq('id', inv.id).eq('tenant_id', tenantId);
            return { invoiceId: null, publicToken: null, error: lineError.message || 'Failed to create invoice line items' };
        }
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

    if (autoSend && clientEmail) {
        const { data: tenant } = await admin
            .from('tenants')
            .select('name')
            .eq('id', tenantId)
            .maybeSingle();
        const tenantName = tenant?.name || 'Your provider';
        await sendEmailServer({
            tenantId,
            to: clientEmail,
            subject: `Invoice ${invoiceNum} from ${tenantName}`,
            html: `
              <p>Hi ${quote.name || 'there'},</p>
              <p>Thank you for accepting quote <strong>${quote.quote_number}</strong>. Your invoice is ready.</p>
              <p><a href="${payUrl}">View & Pay Invoice</a></p>
              <p>Or copy this link: ${payUrl}</p>
            `,
            templateName: 'quote_accepted_invoice',
        }).catch((err) => console.error('[convertQuoteToInvoice] email failed:', err));
    }

    return { invoiceId: inv.id, publicToken, error: null };
}
