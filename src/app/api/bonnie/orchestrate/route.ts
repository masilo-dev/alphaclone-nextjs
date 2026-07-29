import { NextRequest } from 'next/server';
<<<<<<< HEAD
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
=======
>>>>>>> origin/main

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

<<<<<<< HEAD
    type SubagentResult = {
  name: string;
  role: string;
  result: string;
  success: boolean;
  execution_mode: 'live' | 'unavailable';
};
=======
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
>>>>>>> origin/main

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
<<<<<<< HEAD
    const tenantId = body.tenant_id || body.tenantId;
    const { task, subagents = [] } = body;

    if (!tenantId || !task) {
      return new Response(JSON.stringify({ error: 'tenant_id and task are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await requireTenantAccess(tenantId);

=======
    const { tenant_id, task, subagents = [] } = body;

    if (!tenant_id || !task) {
      return new Response(
        JSON.stringify({ error: 'tenant_id and task are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Set up SSE response
>>>>>>> origin/main
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          send({ type: 'orchestration_start', task, total_subagents: subagents.length });

<<<<<<< HEAD
          const results: SubagentResult[] = [];
=======
          const results: any[] = [];
>>>>>>> origin/main

          for (const subagent of subagents) {
            send({ type: 'subagent_start', name: subagent.name, role: subagent.role });

            let result = '';
            let success = false;
<<<<<<< HEAD
            let executionMode: SubagentResult['execution_mode'] = 'unavailable';

            try {
              const { routeAIRequest } = await import('@/services/aiRouter');
              const aiResponse = await routeAIRequest({
                prompt: `Main task: ${task}\n\nYour instructions: ${subagent.instructions}`,
                systemPrompt: `You are ${subagent.name}, role: ${subagent.role}. Return results as JSON with keys: outcome, details, next_steps.`,
                model: 'deepseek-chat',
                maxTokens: 512,
              });
              result = aiResponse.content || '';
              success = true;
              executionMode = 'live';
            } catch (e: unknown) {
              result = `Subagent error: ${e instanceof Error ? e.message : String(e)}`;
            }
            if (!success) {
              result = JSON.stringify({
                outcome: 'not_run',
                details: `${subagent.name} could not execute with the configured AI router.`,
                next_steps: ['Check DeepSeek, OpenRouter, or other AI provider availability.'],
              });
              success = false;
            }

            results.push({
              name: subagent.name,
              role: subagent.role,
              result,
              success,
              execution_mode: executionMode,
            });
            send({
              type: 'subagent_complete',
              name: subagent.name,
              success,
              result,
              execution_mode: executionMode,
            });
          }

          const successful = results.filter((r) => r.success).length;
          const status =
            results.length === 0
              ? 'no_subagents'
              : successful === results.length
                ? 'complete'
                : successful === 0
                  ? 'failed'
                  : 'partial';

          send({
            type: 'orchestration_complete',
            task,
            status,
            actual_execution: status === 'complete' || status === 'partial',
            results,
            total: subagents.length,
            successful,
            failed: results.length - successful,
          });
        } catch (err: unknown) {
          send({
            type: 'error',
            message: err instanceof Error ? err.message : 'Orchestration failed',
          });
=======

            if (ANTHROPIC_API_KEY) {
              try {
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
                    max_tokens: 512,
                    system: `You are ${subagent.name}, role: ${subagent.role}. Return results as JSON with keys: outcome, details, next_steps.`,
                    messages: [{ role: 'user', content: `Main task: ${task}\n\nYour instructions: ${subagent.instructions}` }],
                    metadata: { session_type: 'multiagent' },
                  }),
                });
                if (res.ok) {
                  const data = await res.json();
                  result = data.content?.[0]?.text || '';
                  success = true;
                } else {
                  result = `API error: ${res.status}`;
                }
              } catch (e: any) {
                result = `Subagent error: ${e.message}`;
              }
            } else {
              result = JSON.stringify({ outcome: 'simulated', details: `${subagent.name} processed task`, next_steps: [] });
              success = true;
            }

            results.push({ name: subagent.name, role: subagent.role, result, success });
            send({ type: 'subagent_complete', name: subagent.name, success, result });
          }

          send({ type: 'orchestration_complete', task, results, total: subagents.length });
        } catch (err: any) {
          send({ type: 'error', message: err.message });
>>>>>>> origin/main
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
<<<<<<< HEAD
  } catch (err: unknown) {
    const response = routeErrorResponse(err, 'Orchestration failed', req);
    return new Response(await response.text(), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
=======
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
>>>>>>> origin/main
  }
}
