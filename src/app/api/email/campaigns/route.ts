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

type CampaignContactRow = {
    id: string;
    email: string | null;
    full_name: string | null;
    company: {
        name?: string | null;
        website?: string | null;
    } | null;
};

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
                .from('contacts')
                .select('id, full_name, email, company:companies(name, website)')
                .eq('tenant_id', tenantId)
                .not('email', 'is', null)
                .order('full_name', { ascending: true });
            if (isMissingRelationOrCache(error, 'contacts') || isWorkspaceSetupError(error)) {
                return contactsUnavailableResponse();
            }
            if (error) return NextResponse.json({ error: error.message, code: 'CAMPAIGN_CONTACTS_FETCH_FAILED' }, { status: 500 });
            const contacts = ((data || []) as CampaignContactRow[]).map((row) => ({
                id: row.id,
                name: String(row.full_name || row.email || '').trim(),
                email: String(row.email || '').trim(),
                website: row.company?.website || row.company?.name || null,
                industry: null as string | null,
            }));

            const { data: leads } = await admin
                .from('leads')
                .select('id, business_name, email, industry, website')
                .eq('tenant_id', tenantId)
                .not('email', 'is', null)
                .limit(500);

            const { data: bizClients } = await admin
                .from('business_clients')
                .select('id, name, email, industry, website')
                .eq('tenant_id', tenantId)
                .not('email', 'is', null)
                .limit(500);

            const seen = new Set(contacts.map((c) => c.email.toLowerCase()));
            for (const lead of leads || []) {
                const email = String(lead.email || '').trim();
                if (!email || seen.has(email.toLowerCase())) continue;
                seen.add(email.toLowerCase());
                contacts.push({
                    id: `lead:${lead.id}`,
                    name: String(lead.business_name || email),
                    email,
                    website: lead.website || null,
                    industry: lead.industry || null,
                });
            }
            for (const client of bizClients || []) {
                const email = String(client.email || '').trim();
                if (!email || seen.has(email.toLowerCase())) continue;
                seen.add(email.toLowerCase());
                contacts.push({
                    id: `client:${client.id}`,
                    name: String(client.name || email),
                    email,
                    website: client.website || null,
                    industry: client.industry || null,
                });
            }

            return NextResponse.json({ success: true, contacts });
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

            const contactUuids: string[] = [];
            const leadUuids: string[] = [];
            const clientUuids: string[] = [];
            for (const raw of contactIds) {
                const id = String(raw || '').trim();
                if (!id) continue;
                if (id.startsWith('lead:')) leadUuids.push(id.slice(5));
                else if (id.startsWith('client:')) clientUuids.push(id.slice(7));
                else contactUuids.push(id);
            }

            type ResolvedRecipient = { contactId: string | null; email: string; metadata?: Record<string, unknown> };
            const byEmail = new Map<string, ResolvedRecipient>();
            const foundContactIds = new Set<string>();

            if (contactUuids.length > 0) {
                const { data: contacts, error: contactsError } = await admin
                    .from('contacts')
                    .select('id, email')
                    .eq('tenant_id', tenantId)
                    .in('id', contactUuids);
                if (contactsError) return NextResponse.json({ error: contactsError.message, code: 'CONTACTS_FETCH_FAILED' }, { status: 500 });
                for (const c of contacts || []) {
                    const email = String(c.email || '').trim();
                    if (!email) continue;
                    foundContactIds.add(String(c.id));
                    byEmail.set(email.toLowerCase(), { contactId: String(c.id), email });
                }
            }

            const allClientIds = [...new Set([
                ...clientUuids,
                ...contactUuids.filter((id) => !foundContactIds.has(id)),
            ])];
            if (allClientIds.length > 0) {
                const { data: legacyClients, error: legacyError } = await admin
                    .from('business_clients')
                    .select('id, email')
                    .eq('tenant_id', tenantId)
                    .in('id', allClientIds);
                if (legacyError) return NextResponse.json({ error: legacyError.message, code: 'CONTACTS_FETCH_FAILED' }, { status: 500 });

                const legacyEmails = (legacyClients || [])
                    .map((client: { email?: string | null }) => String(client.email || '').trim().toLowerCase())
                    .filter(Boolean);
                const emailToContactId = new Map<string, string>();
                if (legacyEmails.length > 0) {
                    const { data: mappedContacts, error: mappedError } = await admin
                        .from('contacts')
                        .select('id, email')
                        .eq('tenant_id', tenantId)
                        .in('email', legacyEmails);
                    if (mappedError) return NextResponse.json({ error: mappedError.message, code: 'CONTACTS_FETCH_FAILED' }, { status: 500 });
                    for (const row of mappedContacts || []) {
                        const email = String(row.email || '').trim().toLowerCase();
                        if (email) emailToContactId.set(email, String(row.id));
                    }
                }
                for (const client of legacyClients || []) {
                    const email = String(client.email || '').trim();
                    if (!email || byEmail.has(email.toLowerCase())) continue;
                    byEmail.set(email.toLowerCase(), {
                        contactId: emailToContactId.get(email.toLowerCase()) || null,
                        email,
                        metadata: { source: 'business_client', client_id: client.id },
                    });
                }
            }

            if (leadUuids.length > 0) {
                const { data: leads, error: leadsError } = await admin
                    .from('leads')
                    .select('id, email')
                    .eq('tenant_id', tenantId)
                    .in('id', leadUuids);
                if (leadsError) return NextResponse.json({ error: leadsError.message, code: 'LEADS_FETCH_FAILED' }, { status: 500 });
                for (const lead of leads || []) {
                    const email = String(lead.email || '').trim();
                    if (!email || byEmail.has(email.toLowerCase())) continue;
                    byEmail.set(email.toLowerCase(), {
                        contactId: null,
                        email,
                        metadata: { source: 'lead', lead_id: lead.id },
                    });
                }
            }

            const normalizedContacts = Array.from(byEmail.values());
            const emails = normalizedContacts.map((c) => c.email.toLowerCase());

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

            const rowsToInsert = normalizedContacts
                .filter((c: any) => {
                    const normalizedEmail = String(c.email).trim().toLowerCase();
                    return !existingCampaignEmails.has(normalizedEmail) && !previouslyContactedEmails.has(normalizedEmail);
                })
                .map((c) => ({
                    tenant_id: tenantId,
                    campaign_id: campaignId,
                    contact_id: c.contactId,
                    email: String(c.email).trim(),
                    status: 'pending',
                    metadata: c.metadata || {},
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
                skipped: normalizedContacts.length - rowsToInsert.length,
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

        const { data: campaign, error: fetchError } = await admin
            .from('email_campaigns')
            .select('id, status')
            .eq('id', campaignId)
            .eq('tenant_id', tenantId)
            .maybeSingle();
        if (fetchError) {
            return NextResponse.json({ error: fetchError.message, code: 'CAMPAIGN_FETCH_FAILED' }, { status: 500 });
        }
        if (!campaign) {
            return NextResponse.json({ error: 'Campaign not found', code: 'NOT_FOUND' }, { status: 404 });
        }

        const deletableStatuses = ['draft', 'cancelled', 'queued', 'failed', 'scheduled', 'paused'];
        if (!deletableStatuses.includes(String(campaign.status || ''))) {
            return NextResponse.json(
                {
                    error: `Cannot delete a campaign with status "${campaign.status}". Pause or cancel it first.`,
                    code: 'CAMPAIGN_NOT_DELETABLE',
                },
                { status: 409 }
            );
        }

        await admin
            .from('campaign_recipients')
            .delete()
            .eq('campaign_id', campaignId)
            .eq('tenant_id', tenantId);

        const { error, count } = await admin
            .from('email_campaigns')
            .delete({ count: 'exact' })
            .eq('id', campaignId)
            .eq('tenant_id', tenantId);
        if (error) return NextResponse.json({ error: error.message, code: 'CAMPAIGN_DELETE_FAILED' }, { status: 500 });
        if (!count) {
            return NextResponse.json({ error: 'Campaign could not be deleted', code: 'CAMPAIGN_DELETE_FAILED' }, { status: 500 });
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        return routeErrorResponse(error, 'Failed to delete campaign', request);
    }
}
