import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = body.tenant_id || body.tenantId;
    const auto_apply = body.auto_apply ?? false;

    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const supabase = createSupabaseAdminClient();

    // 1. Fetch last 50 mcp_sessions for the tenant
    const { data: sessions, error: sessErr } = await supabase
      .from('mcp_sessions')
      .select('id, tool_name, success, error_message, duration_ms, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (sessErr) {
      return NextResponse.json({ error: `Failed to fetch sessions: ${sessErr.message}` }, { status: 500 });
    }

    let patternsExtracted: any[] = [];
    let memoryUpdates: any[] = [];

    try {
      const dreamPrompt = `You are reviewing past AI agent session logs for a SaaS business platform.
Analyze the following session data and extract:
1. Common failure patterns (tools that often fail, error themes)
2. Performance insights (slow tools, high success rate tools)
3. Behavioral patterns (most used tools, usage trends)
4. Memory improvements (what the agent should do better next time)

Session data (last ${sessions?.length || 0} sessions):
${JSON.stringify(sessions || [], null, 2)}

Return ONLY valid JSON with:
- "patterns_extracted": array of { type, description, frequency, severity }
- "memory_updates": array of { category, insight, action_recommendation }
- "summary": one-sentence summary`;

      const { routeAIRequest } = await import('@/services/aiRouter');
      const aiResponse = await routeAIRequest({
        prompt: dreamPrompt,
        model: 'deepseek-reasoner',
        maxTokens: 2048,
      });
      const rawText = aiResponse.content || '{}';
      const cleanText = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(cleanText);
      patternsExtracted = parsed.patterns_extracted || [];
      memoryUpdates = parsed.memory_updates || [];
    } catch (e) {
      console.warn('[bonnie/dream] Dreaming endpoint failed, synthesizing from data:', e);
      runFallbackSynthesis();
    }

    function runFallbackSynthesis() {
      const failedTools: string[] = (sessions || []).filter((s: any) => !s.success).map((s: any) => s.tool_name as string);
      const uniqueFailed: string[] = Array.from(new Set(failedTools));
      patternsExtracted = uniqueFailed.map((tool: string) => ({
        type: 'failure_pattern',
        description: `Tool "${tool}" has recurring failures`,
        frequency: failedTools.filter((t: string) => t === tool).length,
        severity: 'medium',
      }));
      memoryUpdates = [{ category: 'reliability', insight: 'Some tools have recurring failures', action_recommendation: 'Review tool implementations' }];
    }

    // 3. Store dream session
    const status = auto_apply ? 'applied' : 'pending';
    const { data: dreamSession, error: insertErr } = await supabase
      .from('bonnie_dream_sessions')
      .insert({
        tenant_id: tenantId,
        reviewed_sessions: sessions || [],
        patterns_extracted: patternsExtracted,
        memory_updates: memoryUpdates,
        status,
        applied_at: auto_apply ? new Date().toISOString() : null,
      })
      .select('id, status, created_at')
      .single();

    if (insertErr) {
      return NextResponse.json({ error: `Failed to save dream session: ${insertErr.message}` }, { status: 500 });
    }

    // 4. Self-Evolutionary Playbooks: Create task cards in the database for each memory/optimization insight
    if (memoryUpdates && memoryUpdates.length > 0) {
      try {
        for (const update of memoryUpdates) {
          await supabase
            .from('tasks')
            .insert({
              tenant_id: tenantId,
              title: `[AI Self-Evolution] ${update.category || 'Optimization'}: ${update.insight}`,
              description: `Recommendation: ${update.action_recommendation || 'Review tool and workflow patterns.'}\n\nGenerated automatically by Bonnie's Dream Loop simulation during idle hours.`,
              priority: 'medium',
              status: 'todo',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              metadata: { source: 'bonnie_dream', update_category: update.category }
            });
        }
      } catch (taskErr) {
        console.warn('[bonnie/dream] Failed to create self-evolutionary task cards:', taskErr);
      }
    }

    return NextResponse.json({
      success: true,
      session_id: dreamSession.id,
      status: dreamSession.status,
      reviewed_sessions_count: (sessions || []).length,
      patterns_extracted_count: patternsExtracted.length,
      memory_updates_count: memoryUpdates.length,
      auto_applied: auto_apply,
    });
  } catch (err: unknown) {
    return routeErrorResponse(err, 'Bonnie dream failed', req);
  }
}
