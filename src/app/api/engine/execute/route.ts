import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { runWorkflow, WorkflowDefinition, ExecutionContext } from '@/services/engine/WorkflowExecutor';
import { z } from 'zod';

const bodySchema = z.object({ trigger_type: z.enum(['lead_created', 'facebook_lead_received', 'ingestion_event', 'sms_received', 'form_submitted', 'manual']), tenant_id: z.string().uuid(), data: z.record(z.string(), z.unknown()).default({}) });

/**
 * WORKFLOW EXECUTION ENGINE
 * POST /api/engine/execute
 * Fetches all active workflows for a trigger type, evaluates conditions, runs actions
 */
export async function POST(req: NextRequest) {
    const internalKey = req.headers.get('x-internal-api-key');
    if (!internalKey || internalKey !== process.env.INTERNAL_API_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();

    try {
        const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
        if (!parsed.success) return NextResponse.json({ error: 'Valid trigger_type, tenant_id, and data are required' }, { status: 400 });
        const { trigger_type, tenant_id, data } = parsed.data;

        // Fetch all active workflows for this tenant + trigger
        const { data: workflows, error } = await supabase
            .from('workflow_definitions')
            .select('*')
            .eq('tenant_id', tenant_id)
            .eq('trigger_type', trigger_type)
            .eq('is_active', true);

        if (error) return clientErrorResponse(error, { request: req, scope: 'engine/execute' });
        if (!workflows || workflows.length === 0) {
            return NextResponse.json({ executed: 0, results: [] });
        }

        const context: ExecutionContext = { triggerType: trigger_type, data, tenantId: tenant_id };
        const results = [];

        for (const wf of workflows as WorkflowDefinition[]) {
            const result = await runWorkflow(wf, context);
            results.push(result);

            // Log execution to DB
            const { error: executionError } = await supabase.from('workflow_executions').insert({
                workflow_id: wf.id,
                tenant_id,
                trigger_data: data,
                conditions_met: result.conditionsMet,
                actions_taken: result.actionsTaken,
                status: result.status,
                duration_ms: result.durationMs,
                error_message: result.actionsTaken.find(a => a.status === 'failed')?.error || null,
            });
            if (executionError) throw executionError;

            // Update workflow run count
            if (result.conditionsMet) {
                const { error: countError } = await supabase.rpc('increment_workflow_definition_run', { p_tenant_id: tenant_id, p_workflow_id: wf.id });
                if (countError) throw countError;
            }
        }

        const executed = results.filter(r => r.conditionsMet).length;
        return NextResponse.json({ executed, total: workflows.length, results });

    } catch (err) {
        console.error('Workflow execution error:', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
