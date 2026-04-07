import { NextResponse } from 'next/server';
import { routeAIChat } from '@/services/aiRouter';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const maxDuration = 60; // Maximize serverless timeout for heavy LLM operations

/**
 * AI Chat API Route
 * Now uses smart routing: Anthropic (Claude) → OpenAI (GPT-4) → Gemini
 * Automatically falls back if primary provider fails
 */
export async function POST(req: Request) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { history, message, systemPrompt, image, model } = await req.json();

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        // Use smart router with fallback chain
        const response = await routeAIChat(history || [], message, systemPrompt, image, model);

        return NextResponse.json({
            text: response.content,
            model: response.model,
            provider: response.provider,
            success: response.success,
        });
    } catch (error: any) {
        console.error('AI Chat API Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to process AI chat request'
        }, { status: 500 });
    }
}
