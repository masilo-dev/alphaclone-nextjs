import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, auto_apply = false } = body;

    if (!tenant_id) {
      return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // 1. Fetch last 50 mcp_sessions for the tenant
    const { data: sessions, error: sessErr } = await supabase
      .from('mcp_sessions')
      .select('id, tool_name, success, error_message, duration_ms, created_at')
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (sessErr) {
      return NextResponse.json({ error: `Failed to fetch sessions: ${sessErr.message}` }, { status: 500 });
    }

    // 2. Call Claude Managed Agents dreaming endpoint
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    let patternsExtracted: any[] = [];
    let memoryUpdates: any[] = [];

    if (ANTHROPIC_API_KEY) {
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

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'managed-agents-2026-04-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2048,
            messages: [{ role: 'user', content: dreamPrompt }],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const rawText = data.content?.[0]?.text || '{}';
          const cleanText = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
          const parsed = JSON.parse(cleanText);
          patternsExtracted = parsed.patterns_extracted || [];
          memoryUpdates = parsed.memory_updates || [];
        }
      } catch (e) {
        console.warn('[bonnie/dream] Dreaming endpoint failed, synthesizing from data:', e);
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
    }

    // 3. Store dream session
    const status = auto_apply ? 'applied' : 'pending';
    const { data: dreamSession, error: insertErr } = await supabase
      .from('bonnie_dream_sessions')
      .insert({
        tenant_id,
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

    return NextResponse.json({
      success: true,
      session_id: dreamSession.id,
      status: dreamSession.status,
      reviewed_sessions_count: (sessions || []).length,
      patterns_extracted_count: patternsExtracted.length,
      memory_updates_count: memoryUpdates.length,
      auto_applied: auto_apply,
    });
  } catch (err: any) {
    console.error('[bonnie/dream] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
