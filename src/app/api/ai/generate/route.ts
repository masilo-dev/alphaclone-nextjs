import { NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { unitsForTextGeneration } from '@/config/aiUsageQuotas';
import { consumeAiUnitsOr429 } from '@/lib/quotas/tenantAiUnitsQuota';
import {
    isPlatformSuperAdmin,
    resolveTenantContextForUser,
    skipAiQuotaForAdminMode,
} from '@/lib/quotas/resolveTenantForAiRequest';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase-server';
import { routeAIRequest, streamAIRequest } from '@/services/aiRouter';

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
        const { prompt, maxTokens, systemPrompt, temperature, model, stream, tenantId: bodyTenantId, mode } = body;

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const admin = createSupabaseAdminClient();
        const superAdmin = await isPlatformSuperAdmin(supabase, user.id);
        const skipQuota = skipAiQuotaForAdminMode(mode, superAdmin);

        let tenantId: string | null = null;
        let plan = 'free';

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
            tenantId = ctx.tenantId;
            plan = ctx.plan;

            const units = unitsForTextGeneration(maxTokens);
            const blocked = await consumeAiUnitsOr429(admin, tenantId, plan, units);
            if (blocked) return blocked;
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
        return clientErrorResponse(error, { request: req, scope: 'ai/generate' });
    }
}
