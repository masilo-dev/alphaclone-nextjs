import { NextRequest, NextResponse } from 'next/server';
import { unitsForTextGeneration } from '@/config/aiUsageQuotas';
import {
    isPlatformSuperAdmin,
    resolveTenantContextForUser,
    skipAiQuotaForAdminMode,
} from '@/lib/quotas/resolveTenantForAiRequest';
import { consumeAiUnitsOr429 } from '@/lib/quotas/tenantAiUnitsQuota';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase-server';
import { aiService } from '@/services/ai/aiService';

export const runtime = 'nodejs';

/**
 * AI Completion API Endpoint
 *
 * POST /api/ai/complete
 * Body: { prompt, systemPrompt?, maxTokens?, temperature?, provider?, model?, tenantId?, mode? }
 */

export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { prompt, systemPrompt, maxTokens, temperature, provider, model, tenantId: bodyTenantId, mode } = body;

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
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
            const units = unitsForTextGeneration(maxTokens);
            const blocked = await consumeAiUnitsOr429(admin, ctx.tenantId, ctx.plan, units);
            if (blocked) return blocked;
        }

        const response = await aiService.complete({
            prompt,
            systemPrompt,
            maxTokens,
            temperature,
            provider,
            model,
        });

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
