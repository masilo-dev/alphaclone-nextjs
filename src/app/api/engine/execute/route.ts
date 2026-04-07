import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { runWorkflow, WorkflowDefinition, ExecutionContext, TriggerType } from '@/services/engine/WorkflowExecutor';

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
        const body = await req.json();
        const { trigger_type, tenant_id, data } = body as {
            trigger_type: TriggerType;
            tenant_id: string;
            data: Record<string, unknown>;
        };

        if (!trigger_type || !tenant_id) {
            return NextResponse.json({ error: 'trigger_type and tenant_id required' }, { status: 400 });
        }

        // Fetch all active workflows for this tenant + trigger
        const { data: workflows, error } = await supabase
            .from('workflow_definitions')
            .select('*')
            .eq('tenant_id', tenant_id)
            .eq('trigger_type', trigger_type)
            .eq('is_active', true);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        if (!workflows || workflows.length === 0) {
            return NextResponse.json({ executed: 0, results: [] });
        }

        const context: ExecutionContext = { triggerType: trigger_type, data, tenantId: tenant_id };
        const results = [];

        for (const wf of workflows as WorkflowDefinition[]) {
            const result = await runWorkflow(wf, context);
            results.push(result);

            // Log execution to DB
            await supabase.from('workflow_executions').insert({
                workflow_id: wf.id,
                tenant_id,
                trigger_data: data,
                conditions_met: result.conditionsMet,
                actions_taken: result.actionsTaken,
                status: result.status,
                duration_ms: result.durationMs,
                error_message: result.actionsTaken.find(a => a.status === 'failed')?.error || null,
            });

            // Update workflow run count
            if (result.conditionsMet) {
                await supabase
                    .from('workflow_definitions')
                    .update({ run_count: (wf.run_count || 0) + 1, last_run_at: new Date().toISOString() })
                    .eq('id', wf.id);
            }
        }

        const executed = results.filter(r => r.conditionsMet).length;
        return NextResponse.json({ executed, total: workflows.length, results });

    } catch (err) {
        console.error('Workflow execution error:', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
