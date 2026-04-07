import { NextResponse } from 'next/server';
import { routeAIRequest } from '@/services/aiRouter';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const maxDuration = 60; // Maximize serverless timeout for heavy LLM operations

/**
 * AI Content Generation API Route
 * Now uses smart routing: Anthropic (Claude) → OpenAI (GPT-4) → Gemini
 * Automatically falls back if primary provider fails
 */
export async function POST(req: Request) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { prompt, maxTokens, systemPrompt, temperature, model } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        // Use smart router with fallback chain
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
