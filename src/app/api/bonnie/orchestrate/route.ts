import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, task, subagents = [] } = body;

    if (!tenant_id || !task) {
      return new Response(
        JSON.stringify({ error: 'tenant_id and task are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Set up SSE response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          send({ type: 'orchestration_start', task, total_subagents: subagents.length });

          const results: any[] = [];

          for (const subagent of subagents) {
            send({ type: 'subagent_start', name: subagent.name, role: subagent.role });

            let result = '';
            let success = false;

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
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
