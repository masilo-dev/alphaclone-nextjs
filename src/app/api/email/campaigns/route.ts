import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { RouteAuthError, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { emailCampaignCreateSchema, emailCampaignDeleteSchema, emailCampaignUpdateSchema } from '@/schemas/validation';

function isMissingRelationOrCache(error: unknown, relation: string): boolean {
    if (!error || typeof error !== 'object') return false;
    const maybeError = error as { code?: string; message?: string };
    const message = String(maybeError.message || '').toLowerCase();
    const relationName = relation.toLowerCase();
    return (
        maybeError.code === '42P01' ||
        maybeError.code === 'PGRST205' ||
        (message.includes(relationName) && (message.includes('does not exist') || message.includes('schema cache')))
    );
}

function campaignsUnavailableResponse() {
    return NextResponse.json({
        success: true,
        campaigns: [],
        warning: 'Email workspace setup is still in progress.',
    });
}

function contactsUnavailableResponse() {
    return NextResponse.json({
        success: true,
        contacts: [],
        warning: 'Contacts are being prepared.',
    });
}

function isWorkspaceSetupError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const maybeError = error as { code?: string; message?: string };
    const message = String(maybeError.message || '').toLowerCase();
    return (
        maybeError.code === '42P01' ||
        maybeError.code === 'PGRST205' ||
        maybeError.code === '42501' ||
        message.includes('schema cache') ||
        message.includes('does not exist') ||
        message.includes('permission denied')
    );
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const tenantId = String(searchParams.get('tenantId') || '').trim();
        const mode = String(searchParams.get('mode') || 'campaigns').trim();
        if (!tenantId) {
            return NextResponse.json({ error: 'tenantId is required', code: 'VALIDATION_ERROR' }, { status: 400 });
        }

        await requireTenantAccess(tenantId);
        const admin = createSupabaseAdminClient();

        if (mode === 'contacts') {
            const { data, error } = await admin
                .from('business_clients')
                .select('id, name, email, website')
                .eq('tenant_id', tenantId)
                .not('email', 'is', null)
                .order('name', { ascending: true });
            if (isMissingRelationOrCache(error, 'business_clients') || isWorkspaceSetupError(error)) {
                return contactsUnavailableResponse();
            }
            if (error) return NextResponse.json({ error: error.message, code: 'CAMPAIGN_CONTACTS_FETCH_FAILED' }, { status: 500 });
            return NextResponse.json({ success: true, contacts: data || [] });
        }

        const { data, error } = await admin
            .from('email_campaigns')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false })
            .limit(100);
        if (isMissingRelationOrCache(error, 'email_campaigns') || isWorkspaceSetupError(error)) {
            return campaignsUnavailableResponse();
        }
        if (error) return NextResponse.json({ error: error.message, code: 'CAMPAIGNS_FETCH_FAILED' }, { status: 500 });
        return NextResponse.json({ success: true, campaigns: data || [] });
    } catch (error) {
        if (error instanceof RouteAuthError && (error.status === 500 || error.status === 403)) {
            return campaignsUnavailableResponse();
        }
        return routeErrorResponse(error, 'Failed to load campaigns', request);
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = emailCampaignCreateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
        }
        const tenantId = parsed.data.tenantId;
        const mode = String(parsed.data.mode || 'create').trim();

        const auth = await requireTenantAccess(tenantId);
        const admin = createSupabaseAdminClient();

        if (mode === 'add_recipients') {
            const campaignId = String(parsed.data.campaignId || '').trim();
            const contactIds = parsed.data.contactIds || [];
            const skipPreviouslyContacted = parsed.data.skipPreviouslyContacted !== false;
            if (!campaignId) {
                return NextResponse.json({ error: 'campaignId is required', code: 'VALIDATION_ERROR' }, { status: 400 });
            }

            const { data: contacts, error: contactsError } = await admin
                .from('business_clients')
                .select('id, email')
                .eq('tenant_id', tenantId)
                .in('id', contactIds);
            if (contactsError) return NextResponse.json({ error: contactsError.message, code: 'CONTACTS_FETCH_FAILED' }, { status: 500 });

            const validContacts = (contacts || []).filter((c: any) => c.email && String(c.email).trim().length > 0);
            const emails = validContacts.map((c: any) => String(c.email).trim().toLowerCase());

            const { data: existingCampaignRows, error: existingError } = await admin
                .from('campaign_recipients')
                .select('email')
                .eq('tenant_id', tenantId)
                .eq('campaign_id', campaignId);
            if (existingError) return NextResponse.json({ error: existingError.message, code: 'CAMPAIGN_RECIPIENTS_FETCH_FAILED' }, { status: 500 });
            const existingCampaignEmails = new Set((existingCampaignRows || []).map((r: any) => String(r.email).trim().toLowerCase()));

            let previouslyContactedEmails = new Set<string>();
            if (skipPreviouslyContacted && emails.length > 0) {
                const { data: previousRows, error: previousError } = await admin
                    .from('campaign_recipients')
                    .select('email')
                    .eq('tenant_id', tenantId)
                    .in('email', emails)
                    .in('status', ['sent', 'delivered', 'opened', 'clicked']);
                if (previousError) return NextResponse.json({ error: previousError.message, code: 'PREVIOUS_RECIPIENTS_FETCH_FAILED' }, { status: 500 });
                previouslyContactedEmails = new Set((previousRows || []).map((r: any) => String(r.email).trim().toLowerCase()));
            }

            const rowsToInsert = validContacts
                .filter((c: any) => {
                    const normalizedEmail = String(c.email).trim().toLowerCase();
                    return !existingCampaignEmails.has(normalizedEmail) && !previouslyContactedEmails.has(normalizedEmail);
                })
                .map((c: any) => ({
                    tenant_id: tenantId,
                    campaign_id: campaignId,
                    contact_id: c.id,
                    email: String(c.email).trim(),
                    status: 'pending',
                }));

            if (rowsToInsert.length > 0) {
                const { error: insertError } = await admin.from('campaign_recipients').insert(rowsToInsert);
                if (insertError) return NextResponse.json({ error: insertError.message, code: 'RECIPIENTS_INSERT_FAILED' }, { status: 500 });
            }

            const totalRecipients = (existingCampaignRows?.length || 0) + rowsToInsert.length;
            await admin
                .from('email_campaigns')
                .update({ total_recipients: totalRecipients })
                .eq('id', campaignId)
                .eq('tenant_id', tenantId);

            return NextResponse.json({
                success: true,
                added: rowsToInsert.length,
                skipped: validContacts.length - rowsToInsert.length,
            });
        }

        const payload = {
            tenant_id: tenantId,
            name: String(parsed.data.name || '').trim(),
            subject: String(parsed.data.subject || '').trim(),
            template_id: parsed.data.templateId || null,
            from_name: String(parsed.data.fromName || 'AlphaClone Systems').trim(),
            from_email: String(parsed.data.fromEmail || '').trim(),
            reply_to: parsed.data.replyTo || null,
            scheduled_at: parsed.data.scheduledAt || null,
            segment_filter: parsed.data.segmentFilter || {},
            metadata: parsed.data.metadata || {},
            created_by: auth.user.id,
        };

        if (!payload.name || !payload.subject || !payload.from_email) {
            return NextResponse.json({ error: 'name, subject and fromEmail are required', code: 'VALIDATION_ERROR' }, { status: 400 });
        }

        const { data, error } = await admin.from('email_campaigns').insert(payload).select('*').single();
        if (error) return NextResponse.json({ error: error.message, code: 'CAMPAIGN_CREATE_FAILED' }, { status: 500 });
        return NextResponse.json({ success: true, campaign: data });
    } catch (error) {
        return routeErrorResponse(error, 'Failed to create campaign', request);
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = emailCampaignUpdateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
        }
        const tenantId = parsed.data.tenantId;
        const campaignId = parsed.data.campaignId;
        await requireTenantAccess(tenantId);
        const admin = createSupabaseAdminClient();

        const updateData: Record<string, unknown> = {};
        if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
        if (parsed.data.subject !== undefined) updateData.subject = parsed.data.subject;
        if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
        if (parsed.data.scheduledAt !== undefined) updateData.scheduled_at = parsed.data.scheduledAt;
        if (parsed.data.metadata !== undefined) updateData.metadata = parsed.data.metadata;

        const { data, error } = await admin
            .from('email_campaigns')
            .update(updateData)
            .eq('id', campaignId)
            .eq('tenant_id', tenantId)
            .select('*')
            .single();
        if (error) return NextResponse.json({ error: error.message, code: 'CAMPAIGN_UPDATE_FAILED' }, { status: 500 });
        return NextResponse.json({ success: true, campaign: data });
    } catch (error) {
        return routeErrorResponse(error, 'Failed to update campaign', request);
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = emailCampaignDeleteSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
        }
        const tenantId = parsed.data.tenantId;
        const campaignId = parsed.data.campaignId;
        await requireTenantAccess(tenantId);
        const admin = createSupabaseAdminClient();

        const { error } = await admin
            .from('email_campaigns')
            .delete()
            .eq('id', campaignId)
            .eq('tenant_id', tenantId)
            .in('status', ['draft', 'cancelled']);
        if (error) return NextResponse.json({ error: error.message, code: 'CAMPAIGN_DELETE_FAILED' }, { status: 500 });
        return NextResponse.json({ success: true });
    } catch (error) {
        return routeErrorResponse(error, 'Failed to delete campaign', request);
    }
}
