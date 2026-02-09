import { NextRequest } from 'next/server';
import { aiService } from '@/services/ai/aiService';

/**
 * AI Streaming Completion API Endpoint
 *
 * POST /api/ai/stream
 * Body: { prompt, systemPrompt?, maxTokens?, temperature?, provider?, model? }
 * Returns: Server-Sent Events (SSE) stream
 */

export async function POST(req: NextRequest) {
    try {
        // Get user from session
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            return new Response('Unauthorized', { status: 401 });
        }

        // Parse request
        const body = await req.json();
        const { prompt, systemPrompt, maxTokens, temperature, provider, model } = body;

        if (!prompt) {
            return new Response('Prompt is required', { status: 400 });
        }

        // Create SSE stream
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of aiService.stream({
                        prompt,
                        systemPrompt,
                        maxTokens,
                        temperature,
                        provider,
                        model,
                    })) {
                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`)
                        );
                    }

                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    controller.close();
                } catch (error) {
                    console.error('Streaming error:', error);
                    controller.error(error);
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (error) {
        console.error('AI streaming error:', error);
        return new Response('Failed to generate completion', { status: 500 });
    }
}
