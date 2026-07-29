import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
<<<<<<< HEAD
import { synthesizeBonnieDreamFromSessions } from '@/lib/bonnie/bonnieDreamSynthesis';
=======
>>>>>>> origin/main

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const denied = denyIfCronUnauthorized(req);
    if (denied) return denied;

    const supabase = createSupabaseAdminClient();
    const ranAt = new Date().toISOString();

    try {
        // Fetch all active tenants
        const { data: tenants, error: tenantError } = await supabase
            .from('tenants')
            .select('id')
            .limit(1000);

        if (tenantError) throw tenantError;

        if (!tenants || tenants.length === 0) {
            return NextResponse.json({ success: true, message: 'No tenants found' });
        }

        const results = [];
<<<<<<< HEAD
=======
        const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
>>>>>>> origin/main

        for (const tenant of tenants) {
            const tenantId = tenant.id;

            // 1. Fetch last 50 mcp_sessions for the tenant
            const { data: sessions, error: sessErr } = await supabase
                .from('mcp_sessions')
                .select('id, tool_name, success, error_message, duration_ms, created_at')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (sessErr) {
                results.push({ tenantId, success: false, error: `Failed to fetch sessions: ${sessErr.message}` });
                continue;
            }

<<<<<<< HEAD
            let patternsExtracted: any[] = [];
            let memoryUpdates: any[] = [];

            const synthesis = await synthesizeBonnieDreamFromSessions(sessions || []);
            patternsExtracted = synthesis.patterns_extracted;
            memoryUpdates = synthesis.memory_updates;
=======
            // 2. Call Claude Managed Agents dreaming endpoint or use fallback
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
                    } else {
                        throw new Error(`Anthropic API returned status ${res.status}`);
                    }
                } catch (e) {
                    console.warn(`[bonnie-dream-cron] Dreaming API call failed for tenant ${tenantId}, using fallback:`, e);
                    runFallback();
                }
            } else {
                runFallback();
            }

            function runFallback() {
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
>>>>>>> origin/main

            // 3. Store dream session
            const { data: dreamSession, error: insertErr } = await supabase
                .from('bonnie_dream_sessions')
                .insert({
                    tenant_id: tenantId,
                    reviewed_sessions: sessions || [],
                    patterns_extracted: patternsExtracted,
                    memory_updates: memoryUpdates,
                    status: 'pending',
                    applied_at: null,
                })
                .select('id')
                .single();

            if (insertErr) {
                results.push({ tenantId, success: false, error: `Failed to save dream session: ${insertErr.message}` });
                continue;
            }

<<<<<<< HEAD
            // Auto-approve low-risk reliability insights so dream → memory loop closes nightly
            const lowRiskReliability =
              (memoryUpdates.length === 0 || memoryUpdates.every((u: any) => u?.category === 'reliability')) &&
              (patternsExtracted.length === 0 ||
                patternsExtracted.every((p: any) => String(p?.severity || 'medium') !== 'high'));

            if (lowRiskReliability && dreamSession?.id) {
                try {
                    const { data: owner } = await supabase
                        .from('tenant_users')
                        .select('user_id')
                        .eq('tenant_id', tenantId)
                        .in('role', ['owner', 'admin'])
                        .order('created_at', { ascending: true })
                        .limit(1)
                        .maybeSingle();

                    const { mergeDreamSession } = await import('@/services/nexusMemoryService');
                    await mergeDreamSession(tenantId, dreamSession.id, owner?.user_id || null);
                    await supabase
                        .from('bonnie_dream_sessions')
                        .update({ status: 'applied', applied_at: new Date().toISOString() })
                        .eq('id', dreamSession.id);
                } catch (autoApplyErr) {
                    console.warn(`[bonnie-dream-cron] auto-apply failed for tenant ${tenantId}:`, autoApplyErr);
                }
            }

            if (!lowRiskReliability && patternsExtracted.some((p: any) => String(p?.severity || '') === 'high')) {
                try {
                    const { notifyTenantOwner } = await import('@/lib/automation/platformHardening');
                    await notifyTenantOwner(tenantId, {
                        title: 'Dream session: high-severity pattern detected',
                        message: `Bonnie dream found high-severity patterns requiring review. Session: ${dreamSession?.id}`,
                        link: '/dashboard/settings/automation',
                        sendEmail: true,
                    });
                } catch (alertErr) {
                    console.warn(`[bonnie-dream-cron] high-severity alert failed for ${tenantId}:`, alertErr);
                }
            }

            // 4. Create tasks (with deduplication)
            if (memoryUpdates && memoryUpdates.length > 0) {
                try {
                    for (const update of memoryUpdates) {
                        const title = `[AI Self-Evolution] ${update.category || 'Optimization'}: ${update.insight}`;
                        
                        // Check for existing similar task
                        const { data: existingTask } = await supabase
                            .from('tasks')
                            .select('id, description')
                            .eq('tenant_id', tenantId)
                            .ilike('title', '%' + (update.insight?.substring(0, 50) || '') + '%')
                            .eq('status', 'todo')
                            .maybeSingle();

                        if (existingTask) {
                            // Update existing task with new note instead of creating duplicate
                            await supabase
                                .from('tasks')
                                .update({
                                    description: existingTask.description + '\n[Re-flagged: ' + new Date().toISOString() + ']',
                                    updated_at: new Date().toISOString(),
                                })
                                .eq('id', existingTask.id);
                        } else {
                            // Create new task
                            await supabase
                                .from('tasks')
                                .insert({
                                    tenant_id: tenantId,
                                    title,
                                    description: `Recommendation: ${update.action_recommendation || 'Review tool and workflow patterns.'}\n\nGenerated automatically by Bonnie's Dream Loop analysis during idle hours.`,
                                    priority: 'medium',
                                    status: 'todo',
                                    created_at: new Date().toISOString(),
                                    updated_at: new Date().toISOString(),
                                    metadata: { source: 'bonnie_dream', update_category: update.category }
                                });
                        }
=======
            // 4. Create tasks
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
>>>>>>> origin/main
                    }
                } catch (taskErr) {
                    console.warn(`[bonnie-dream-cron] Failed to create tasks for tenant ${tenantId}:`, taskErr);
                }
            }

            results.push({ tenantId, success: true, dreamSessionId: dreamSession.id });
        }

        return NextResponse.json({ success: true, processed_count: tenants.length, results });
    } catch (error: any) {
        console.error('[bonnie-dream-cron] Failed:', error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
