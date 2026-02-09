import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/services/ai/aiService';
import { createClient } from '@supabase/supabase-js';

/**
 * AI Completion API Endpoint
 *
 * POST /api/ai/complete
 * Body: { prompt, systemPrompt?, maxTokens?, temperature?, provider?, model? }
 */

export async function POST(req: NextRequest) {
    try {
        // Get user from session
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parse request
        const body = await req.json();
        const { prompt, systemPrompt, maxTokens, temperature, provider, model } = body;

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        // Rate limiting check (basic)
        // In production, use Redis-based rate limiting per user

        // Make AI request
        const response = await aiService.complete({
            prompt,
            systemPrompt,
            maxTokens,
            temperature,
            provider,
            model,
        });

        // Log AI usage for billing
        // await logAIUsage(userId, tenantId, response);

        return NextResponse.json({
            content: response.content,
            provider: response.provider,
            model: response.model,
            tokens: response.tokens,
            cost: response.cost,
        });
    } catch (error) {
        console.error('AI completion error:', error);
        return NextResponse.json(
            { error: 'Failed to generate completion' },
            { status: 500 }
        );
    }
}
