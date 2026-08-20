import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://alphaclonesystems.com',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function isServiceRoleRequest(request: Request) {
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return Boolean(serviceRole) && request.headers.get('Authorization') === `Bearer ${serviceRole}`;
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!isServiceRoleRequest(request)) return json({ error: 'Unauthorized' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  try {
    const payload = await request.json().catch(() => ({}));
    const requestedId = typeof payload?.queueItemId === 'string' ? payload.queueItemId : null;
    let query = supabase
      .from('workflow_processing_queue')
      .select('id, tenant_id, workflow_id, event_id, status, attempts')
      .eq('status', 'pending')
      .lte('next_run_at', new Date().toISOString())
      .order('next_run_at', { ascending: true })
      .limit(requestedId ? 1 : 10);
    if (requestedId) query = query.eq('id', requestedId);

    const { data: pending, error: fetchError } = await query;
    if (fetchError) throw fetchError;
    if (!pending?.length) return json({ success: true, results: [] });

    const results: Array<Record<string, unknown>> = [];
    for (const candidate of pending) {
      const { data: claimed, error: claimError } = await supabase
        .from('workflow_processing_queue')
        .update({ status: 'processing', attempts: Number(candidate.attempts || 0) + 1, locked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', candidate.id)
        .eq('tenant_id', candidate.tenant_id)
        .eq('status', 'pending')
        .select('id, tenant_id, workflow_id, event_id')
        .maybeSingle();
      if (claimError) throw claimError;
      if (!claimed) continue;

      try {
        const [{ data: workflow, error: workflowError }, { data: event, error: eventError }] = await Promise.all([
          supabase.from('workflows').select('id, tenant_id, is_active').eq('id', claimed.workflow_id).eq('tenant_id', claimed.tenant_id).single(),
          supabase.from('events').select('id, tenant_id').eq('id', claimed.event_id).eq('tenant_id', claimed.tenant_id).single(),
        ]);
        if (workflowError || !workflow?.is_active) throw new Error('Active workflow not found');
        if (eventError || !event) throw new Error('Workflow event not found');

        const { data: actions, error: actionsError } = await supabase
          .from('workflow_actions')
          .select('action_type, action_order')
          .eq('workflow_id', workflow.id)
          .eq('tenant_id', claimed.tenant_id)
          .eq('is_active', true)
          .order('action_order', { ascending: true });
        if (actionsError) throw actionsError;
        if (actions?.length) throw new Error(`Unsupported workflow actions: ${actions.map((action) => action.action_type).join(', ')}`);

        await supabase.from('workflow_processing_queue')
          .update({ status: 'completed', locked_at: null, updated_at: new Date().toISOString() })
          .eq('id', claimed.id).eq('tenant_id', claimed.tenant_id);
        results.push({ id: claimed.id, status: 'completed' });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Workflow processing failed';
        await supabase.from('workflow_processing_queue')
          .update({ status: 'failed', last_error: message, locked_at: null, updated_at: new Date().toISOString() })
          .eq('id', claimed.id).eq('tenant_id', claimed.tenant_id);
        results.push({ id: claimed.id, status: 'failed', error: message });
      }
    }

    return json({ success: true, results });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Workflow sweep failed' }, 500);
  }
});
