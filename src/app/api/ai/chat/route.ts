import { NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { UNITS_PER_CHAT_TURN } from '@/config/aiUsageQuotas';
import {
    isPlatformSuperAdmin,
    resolveTenantContextForUser,
    skipAiQuotaForAdminMode,
} from '@/lib/quotas/resolveTenantForAiRequest';
import { consumeAiUnitsOr429 } from '@/lib/quotas/tenantAiUnitsQuota';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase-server';
import { isAIProviderUnavailableError } from '@/lib/ai/providerHealth';
import { routeAIChat } from '@/services/aiRouter';
import { rateLimitMiddleware, rateLimitConfigs } from '@/lib/rateLimit';

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
        const { history, message, systemPrompt, image, model, tenantId: bodyTenantId, mode } = await req.json();

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        const admin = createSupabaseAdminClient();
        const superAdmin = await isPlatformSuperAdmin(supabase, user.id);
        const skipQuota = skipAiQuotaForAdminMode(mode, superAdmin);

        if (!skipQuota) {
            const ctx = await resolveTenantContextForUser(supabase, user.id, bodyTenantId ?? null);
            if (!ctx) {
                return NextResponse.json(
                    {
                        error: 'A workspace is required. Select your organization or pass tenantId.',
                        code: 'TENANT_REQUIRED',
                    },
                    { status: 400 }
                );
            }
            const limited = await rateLimitMiddleware(req as any, rateLimitConfigs.api.heavy, `ai-chat:${ctx.tenantId}:${user.id}`);
            if (limited) return limited;
            const blocked = await consumeAiUnitsOr429(admin, ctx.tenantId, ctx.plan, UNITS_PER_CHAT_TURN);
            if (blocked) return blocked;
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
        if (isAIProviderUnavailableError(error)) {
            return NextResponse.json(
                {
                    error: 'AI is temporarily unavailable. OpenRouter free models may be rate-limited — wait a minute and retry, or verify OPENROUTER_API_KEY is set in production.',
                    code: 'AI_PROVIDER_UNAVAILABLE',
                    retryAfter: error.retryAfterSeconds,
                },
                {
                    status: 503,
                    headers: {
                        'Retry-After': String(error.retryAfterSeconds || 300),
                    },
                }
            );
        }
        return clientErrorResponse(error, { request: req, scope: 'ai/chat' });
    }
}
