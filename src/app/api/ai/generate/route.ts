import { NextResponse } from 'next/server';
import { routeAIRequest, streamAIRequest } from '@/services/aiRouter';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const maxDuration = 60; // Maximize serverless timeout for heavy LLM operations

/**
 * AI Content Generation API Route
 * Now supports both JSON and Streaming responses
 */
export async function POST(req: Request) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const { prompt, maxTokens, systemPrompt, temperature, model, stream } = body;

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        // Handle Streaming Request
        if (stream) {
            const streamResponse = await streamAIRequest({
                prompt,
                maxTokens,
                systemPrompt,
                temperature,
                model,
            });

            return new Response(streamResponse.stream, {
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'X-Provider': streamResponse.provider,
                    'X-Model': streamResponse.model,
                },
            });
        }

        // Standard JSON Request
        const response = await routeAIRequest({
            prompt,
            maxTokens,
            systemPrompt,
            temperature,
            model,
        });

        return NextResponse.json({
            text: response.content,
            model: response.model,
            provider: response.provider,
            success: response.success,
        });
    } catch (error: any) {
        console.error('AI Generate API Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to process AI generation request'
        }, { status: 500 });
    }
}
