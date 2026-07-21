import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { processContent } from '@/services/engine/ProcessingEngine';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { runInBackground } from '@/lib/server/backgroundTask';
import { getPublicAppUrl } from '@/lib/server/appUrl';
import { z } from 'zod';
import { consumeDailyResourceQuota, releaseDailyResourceQuota } from '@/lib/server/dailyResourceQuota';

const schema = z.object({ source: z.string().trim().min(1).max(100), raw_content: z.string().max(500_000).default(''), author_name: z.string().max(300).nullable().optional(), author_contact: z.string().max(500).nullable().optional(), url: z.string().url().max(5000).nullable().optional(), tenant_id: z.string().uuid(), metadata: z.record(z.string(), z.unknown()).default({}) });

/**
 * INGESTION ENGINE endpoint
 * POST /api/engine/ingest
 * Accepts raw content, runs processing, stores event, triggers workflows
 */
export async function POST(req: NextRequest) {
    const supabase = createSupabaseAdminClient();

    try {
        const parsed = schema.safeParse(await req.json().catch(() => ({})));
        if (!parsed.success) return NextResponse.json({ error: 'Invalid ingestion payload', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
        const { source, raw_content, author_name, author_contact, url, tenant_id, metadata } = parsed.data;

        const internalKey = req.headers.get('x-internal-api-key');
        const hasInternalKey =
            Boolean(internalKey) &&
            Boolean(process.env.INTERNAL_API_KEY) &&
            internalKey === process.env.INTERNAL_API_KEY;

        let actorUserId: string | null = null;
        if (!hasInternalKey) actorUserId = (await requireTenantAccess(tenant_id, req)).user.id;
        else {
            const { data: member, error: memberError } = await supabase.from('tenant_users').select('user_id').eq('tenant_id', tenant_id).limit(1).maybeSingle();
            if (memberError) throw memberError;
            actorUserId = member?.user_id || null;
        }

        // Run processing engine
        const processed = processContent(raw_content || '');

        // Merge extracted structured data with incoming metadata
        const structured_data = { ...(metadata || {}), ...processed.structured_data };

        // Store ingestion event
        const { data: event, error } = await supabase
            .from('ingestion_events')
            .insert({
                tenant_id,
                source,
                raw_content,
                structured_data,
                author_name,
                author_contact: author_contact || structured_data.phone || structured_data.email,
                url,
                intent_score: processed.intent_score,
                intent_label: processed.intent_label,
                keywords_found: processed.keywords_found,
                processed: true,
            })
            .select()
            .single();

        if (error) return clientErrorResponse(error, { request: req, scope: 'engine/ingest' });

        // Auto-create a lead if intent is high/urgent
        let lead_id: string | null = null;
        if (['high', 'urgent'].includes(processed.intent_label)) {
            if (!actorUserId) throw new Error('Workspace has no member available for automated lead ownership');
            await consumeDailyResourceQuota(tenant_id, actorUserId, 'leads');
            const { data: lead, error: leadError } = await supabase
                .from('leads')
                .insert({
                    tenant_id,
                    business_name: author_name || 'Unknown',
                    contact_name: author_name || '',
                    email: String(structured_data.email || ''),
                    phone: String(structured_data.phone || ''),
                    source: `${source} (auto-ingested)`,
                    source_details: raw_content?.slice(0, 300),
                    status: 'new',
                    stage: 'lead',
                    notes: `Intent: ${processed.intent_label} (${processed.intent_score}/100)\nKeywords: ${processed.keywords_found.join(', ')}`,
                    metadata: { ingestion_event_id: event?.id, intent_score: processed.intent_score },
                })
                .select('id')
                .single();

            if (leadError) {
                await releaseDailyResourceQuota(tenant_id, actorUserId, 'leads');
                throw leadError;
            }

            if (lead) {
                lead_id = lead.id;
                await supabase
                    .from('ingestion_events')
                    .update({ lead_id, workflow_triggered: false })
                    .eq('id', event.id);
            }
        }

        // Trigger active workflows for this event
        const { data: workflows } = await supabase
            .from('workflow_definitions')
            .select('*')
            .eq('tenant_id', tenant_id)
            .eq('is_active', true)
            .in('trigger_type', ['ingestion_event', 'lead_created']);

        let workflowsTriggered = 0;
        if (workflows && workflows.length > 0) {
            const contextData = {
                ...event,
                ...structured_data,
                intent_score: processed.intent_score,
                intent_label: processed.intent_label,
                lead_id,
                source,
                author_name,
            };

            // Fire workflow execution in background after response
            runInBackground(
                fetch(`${getPublicAppUrl()}/api/engine/execute`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-internal-api-key': process.env.INTERNAL_API_KEY || '' },
                    body: JSON.stringify({
                        trigger_type: lead_id ? 'lead_created' : 'ingestion_event',
                        tenant_id,
                        data: contextData,
                    }),
                }).catch(console.error)
            );

            workflowsTriggered = workflows.length;
        }

        return NextResponse.json({
            success: true,
            event_id: event?.id,
            lead_id,
            intent: { score: processed.intent_score, label: processed.intent_label },
            keywords: processed.keywords_found,
            workflows_triggered: workflowsTriggered,
        });

    } catch (err) {
        console.error('Ingestion error:', err);
        return routeErrorResponse(err, 'Ingestion failed');
    }
}
