import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { notifyTenantOwners } from '@/lib/notifyTenantOwners';
import { convertQuoteToInvoice } from '@/lib/quotes/convertQuoteToInvoice';

async function findQuoteByToken(admin: ReturnType<typeof createSupabaseAdminClient>, token: string) {
    const { data: quote, error } = await admin
        .from('quotes')
        .select('*, tenant:tenants(name, settings, logo_url)')
        .eq('metadata->>public_token', token)
        .maybeSingle();

    if (error) throw error;
    return quote;
}

export async function GET(req: NextRequest) {
    try {
        const token = req.nextUrl.searchParams.get('token');
        if (!token) {
            return NextResponse.json({ error: 'Token is required' }, { status: 400 });
        }

        const admin = createSupabaseAdminClient();
        const quote = await findQuoteByToken(admin, token);
        if (!quote) {
            return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
        }

        const { data: items } = await admin
            .from('quote_items')
            .select('*')
            .eq('quote_id', quote.id)
            .order('item_order', { ascending: true });

        if (quote.status === 'sent' && !quote.viewed_at) {
            await admin
                .from('quotes')
                .update({ status: 'viewed', viewed_at: new Date().toISOString(), view_count: (quote.view_count || 0) + 1 })
                .eq('id', quote.id);
        }

        return NextResponse.json({
            success: true,
            quote: {
                id: quote.id,
                quoteNumber: quote.quote_number,
                name: quote.name,
                status: quote.status,
                subtotal: quote.subtotal,
                taxAmount: quote.tax_amount,
                totalAmount: quote.total_amount,
                currency: quote.currency,
                validUntil: quote.valid_until,
                termsAndConditions: quote.terms_and_conditions,
                notes: quote.notes,
                metadata: quote.metadata,
                tenantName: quote.tenant?.name,
                tenantSettings: (quote.tenant as any)?.settings || null,
                tenantLogoUrl: (quote.tenant as any)?.logo_url || null,
                tenantBrandColor:
                  ((quote.tenant as any)?.settings?.branding?.primaryColor as string | undefined) ||
                  ((quote.tenant as any)?.settings?.primaryColor as string | undefined) ||
                  null,
            },
            items: (items || []).map((item: Record<string, unknown>) => ({
                productName: item.product_name,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unit_price,
                lineTotal: item.line_total,
            })),
        });
    } catch (error: any) {
        console.error('Quote fetch error:', error);
        return clientErrorResponse(error, { request: req, scope: 'quotes/respond.GET' });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const token = String(body.token || '').trim();
        const action = String(body.action || '').trim();
        const note = String(body.note || '').trim();
        const acceptedBy = String(body.acceptedBy || '').trim();
        const signatureUrl = String(body.signatureUrl || '').trim() || null;

        if (!token) {
            return NextResponse.json({ error: 'Token is required' }, { status: 400 });
        }
        if (!['accept', 'reject'].includes(action)) {
            return NextResponse.json({ error: 'action must be accept or reject' }, { status: 400 });
        }

        const admin = createSupabaseAdminClient();
        const quote = await findQuoteByToken(admin, token);
        if (!quote) {
            return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
        }
        if (['accepted', 'rejected', 'converted', 'expired'].includes(quote.status)) {
            return NextResponse.json({ error: `Quote already ${quote.status}` }, { status: 409 });
        }
        if (quote.valid_until && new Date(quote.valid_until) < new Date()) {
            await admin.from('quotes').update({ status: 'expired' }).eq('id', quote.id);
            return NextResponse.json({ error: 'Quote has expired' }, { status: 410 });
        }

        const now = new Date().toISOString();
        const updatePayload =
            action === 'accept'
                ? {
                      status: 'accepted',
                      accepted_at: now,
                      accepted_by: acceptedBy || 'Client',
                      notes: note || quote.notes,
                      signature_url: signatureUrl,
                  }
                : {
                      status: 'rejected',
                      rejected_at: now,
                      rejection_reason: note || 'Declined by client',
                  };

        const { error: updateError } = await admin.from('quotes').update(updatePayload).eq('id', quote.id);
        if (updateError) throw updateError;

        const origin = req.nextUrl.origin;
        const title =
            action === 'accept'
                ? `Quote accepted: ${quote.quote_number}`
                : `Quote declined: ${quote.quote_number}`;
        const message =
            action === 'accept'
                ? `${acceptedBy || 'Client'} accepted quote ${quote.quote_number}${note ? ` — Note: ${note}` : ''}.`
                : `Quote ${quote.quote_number} was declined${note ? `: "${note}"` : '.'}`;

        let invoiceId: string | null = null;
        let publicToken: string | null = null;
        if (action === 'accept') {
            const converted = await convertQuoteToInvoice(quote.id, quote.tenant_id, {
                autoSend: true,
                origin: req.nextUrl.origin,
            });
            invoiceId = converted.invoiceId;
            publicToken = converted.publicToken;
            if (converted.error) {
                console.error('[quotes/respond] auto-invoice failed:', converted.error);
            }
        }

        const notifyMessage =
            action === 'accept' && invoiceId
                ? `${message} Invoice ${invoiceId.slice(0, 8)}… was created automatically.`
                : message;

        await notifyTenantOwners({
            tenantId: quote.tenant_id,
            type: 'quote',
            title,
            message: notifyMessage,
            link: invoiceId ? `${origin}/dashboard/accounting` : `${origin}/dashboard/quotes`,
            fallbackUserId: quote.created_by || undefined,
        });

        return NextResponse.json({
            success: true,
            status: action === 'accept' && invoiceId ? 'converted' : updatePayload.status,
            invoiceId,
            publicToken,
        });
    } catch (error: any) {
        console.error('Quote respond error:', error);
        return clientErrorResponse(error, { request: req, scope: 'quotes/respond.POST' });
    }
}
