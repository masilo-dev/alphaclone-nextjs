import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { UNITS_PER_IMAGE } from '@/config/aiUsageQuotas';
import {
    isPlatformSuperAdmin,
    resolveTenantContextForUser,
    skipAiQuotaForAdminMode,
} from '@/lib/quotas/resolveTenantForAiRequest';
import { consumeAiUnitsOr429 } from '@/lib/quotas/tenantAiUnitsQuota';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/ai/image
 * Generate an image via DALL-E 3.
 * Returns a *temporary* OpenAI URL (expires ~1 hour).
 * Images are NOT saved to Supabase — caller must explicitly upload if needed.
 */
export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { prompt, size = '1024x1024', tenantId: bodyTenantId, mode } = await req.json();
    if (!prompt?.trim()) {
        return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const validSizes = ['1024x1024', '1792x1024', '1024x1792'];
    if (!validSizes.includes(size)) {
        return NextResponse.json({ error: 'Invalid size. Use 1024x1024, 1792x1024, or 1024x1792' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'OpenAI API key not configured on server' }, { status: 500 });
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
        const blocked = await consumeAiUnitsOr429(admin, ctx.tenantId, ctx.plan, UNITS_PER_IMAGE);
        if (blocked) return blocked;
    }

    try {
        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'dall-e-3',
                prompt: prompt.trim(),
                n: 1,
                size,
                quality: 'hd',
                style: 'vivid',
            }),
        });

        if (!response.ok) {
            const err = await response.json();
            console.error('DALL-E 3 error:', err);
            return NextResponse.json(
                { error: 'Image generation failed', code: 'DALLE_ERROR' },
                { status: response.status >= 400 && response.status < 600 ? response.status : 502 }
            );
        }

        const data = await response.json();
        const imageUrl = data.data?.[0]?.url;
        const revisedPrompt = data.data?.[0]?.revised_prompt;

        if (!imageUrl) {
            return NextResponse.json({ error: 'No image returned from DALL-E 3' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            url: imageUrl,
            revised_prompt: revisedPrompt,
        });
    } catch (error: any) {
        console.error('AI Image Generation Error:', error);
        return clientErrorResponse(error, { request: req, scope: 'ai/image' });
    }
}
