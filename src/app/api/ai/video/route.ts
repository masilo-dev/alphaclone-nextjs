import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase-server';
import { xaiVideoGenerationService } from '@/services/ai/xaiVideoGenerationService';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { UNITS_PER_VIDEO } from '@/config/aiUsageQuotas';
import {
    isPlatformSuperAdmin,
    resolveTenantContextForUser,
    skipAiQuotaForAdminMode,
} from '@/lib/quotas/resolveTenantForAiRequest';
import { consumeAiUnitsOr429 } from '@/lib/quotas/tenantAiUnitsQuota';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const prompt = String(body.prompt || '').trim();
        if (!prompt) {
            return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
        }

        // Enforce tenant AI-unit quota — video is the most expensive operation, so it must
        // not be callable without consuming the workspace's daily allowance.
        const skipQuota = skipAiQuotaForAdminMode(body.mode, await isPlatformSuperAdmin(supabase, user.id));
        if (!skipQuota) {
            const ctx = await resolveTenantContextForUser(supabase, user.id, body.tenantId ?? null);
            if (!ctx) {
                return NextResponse.json(
                    { error: 'A workspace is required. Select your organization or pass tenantId.', code: 'TENANT_REQUIRED' },
                    { status: 400 }
                );
            }
            const blocked = await consumeAiUnitsOr429(createSupabaseAdminClient(), ctx.tenantId, ctx.plan, UNITS_PER_VIDEO);
            if (blocked) return blocked;
        }

        const result = await xaiVideoGenerationService.generateVideo({
            prompt,
            imageUrl: body.imageUrl || body.image_url,
            duration: body.duration,
            poll: body.poll !== false,
        });

        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        return clientErrorResponse(error, { request: req, scope: 'ai/video.POST' });
    }
}
