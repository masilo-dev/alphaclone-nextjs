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
const FREE_IMAGES_PER_DAY = 3;

type ImageProvider = 'xai' | 'openai';

function getTodayUtcDate(): string {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

async function generateWithProvider(params: {
    provider: ImageProvider;
    prompt: string;
    size: string;
    openaiApiKey?: string;
    xaiApiKey?: string;
}) {
    const { provider, prompt, size, openaiApiKey, xaiApiKey } = params;
    const endpoint = provider === 'xai'
        ? 'https://api.x.ai/v1/images/generations'
        : 'https://api.openai.com/v1/images/generations';
    const apiKey = provider === 'xai' ? xaiApiKey : openaiApiKey;
    const model = provider === 'xai'
        ? (process.env.XAI_IMAGE_MODEL || process.env.GROK_IMAGE_MODEL || 'grok-2-image')
        : 'dall-e-3';

    if (!apiKey) {
        return { ok: false as const, status: 500, error: 'Provider API key missing', provider };
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            prompt: prompt.trim(),
            n: 1,
            size,
            ...(provider === 'openai' ? { quality: 'hd', style: 'vivid' } : {}),
        }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
        return {
            ok: false as const,
            status: response.status,
            error: data,
            provider,
        };
    }

    const imageUrl = data?.data?.[0]?.url as string | undefined;
    const revisedPrompt = data?.data?.[0]?.revised_prompt as string | undefined;
    if (!imageUrl) {
        return { ok: false as const, status: 500, error: { error: 'No image returned' }, provider };
    }

    return {
        ok: true as const,
        url: imageUrl,
        revisedPrompt,
        provider,
    };
}

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

    const { prompt, size = '1024x1024', tenantId: bodyTenantId, mode, provider } = await req.json();
    if (!prompt?.trim()) {
        return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const validSizes = ['1024x1024', '1792x1024', '1024x1792'];
    if (!validSizes.includes(size)) {
        return NextResponse.json({ error: 'Invalid size. Use 1024x1024, 1792x1024, or 1024x1792' }, { status: 400 });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    const xaiApiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
    if (!openaiApiKey && !xaiApiKey) {
        return NextResponse.json({ error: 'No image provider API key configured on server' }, { status: 500 });
    }

    const admin = createSupabaseAdminClient();
    const superAdmin = await isPlatformSuperAdmin(supabase, user.id);
    const skipQuota = skipAiQuotaForAdminMode(mode, superAdmin);

    // Hard free allowance for everyone: 3 images per UTC day per user.
    // This is independent from tenant AI unit quotas.
    const usageDate = getTodayUtcDate();
    const { data: dailyUsage, error: usageReadError } = await admin
        .from('daily_image_generation_usage')
        .select('id,generated_count')
        .eq('user_id', user.id)
        .eq('usage_date', usageDate)
        .maybeSingle();
    if (usageReadError) {
        return NextResponse.json({ error: usageReadError.message }, { status: 500 });
    }
    const generatedToday = Number(dailyUsage?.generated_count ?? 0);
    if (generatedToday >= FREE_IMAGES_PER_DAY) {
        return NextResponse.json(
            {
                error: `Daily free image limit reached (${FREE_IMAGES_PER_DAY}/day).`,
                code: 'FREE_IMAGE_DAILY_LIMIT_REACHED',
                limit: FREE_IMAGES_PER_DAY,
                used: generatedToday,
                remaining: 0,
                resetsAt: `${usageDate}T23:59:59.999Z`,
            },
            { status: 429 }
        );
    }

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
        const preferredProvider = typeof provider === 'string' ? provider.toLowerCase() : 'auto';
        const preferredIsXai = preferredProvider === 'grok' || preferredProvider === 'xai';
        const providerOrder: ImageProvider[] = preferredIsXai ? ['xai', 'openai'] : ['openai', 'xai'];
        const availableProviders = providerOrder.filter((p) =>
            p === 'xai' ? !!xaiApiKey : !!openaiApiKey
        );
        if (availableProviders.length === 0) {
            return NextResponse.json({ error: 'No image provider API key configured on server' }, { status: 500 });
        }

        let result: Awaited<ReturnType<typeof generateWithProvider>> | null = null;
        let lastErrorStatus = 502;
        let lastErrorPayload: unknown = null;

        for (const p of availableProviders) {
            result = await generateWithProvider({
                provider: p,
                prompt,
                size,
                openaiApiKey: openaiApiKey || undefined,
                xaiApiKey: xaiApiKey || undefined,
            });
            if (result.ok) {
                break;
            }
            lastErrorStatus = result.status >= 400 && result.status < 600 ? result.status : 502;
            lastErrorPayload = result.error;
            console.error('AI image provider error:', { provider: p, error: result.error });
        }

        if (!result || !result.ok) {
            return NextResponse.json(
                { error: 'Image generation failed', code: 'IMAGE_PROVIDER_ERROR', details: lastErrorPayload },
                { status: lastErrorStatus }
            );
        }

        const imageUrl = result.url;
        const revisedPrompt = result.revisedPrompt;
        const imageProvider = result.provider;

        // Increment free daily usage counter only after successful generation.
        if (!dailyUsage) {
            const { error: usageInsertError } = await admin
                .from('daily_image_generation_usage')
                .insert({
                    user_id: user.id,
                    usage_date: usageDate,
                    generated_count: 1,
                });
            if (usageInsertError) {
                return NextResponse.json({ error: usageInsertError.message }, { status: 500 });
            }
        } else {
            const { error: usageUpdateError } = await admin
                .from('daily_image_generation_usage')
                .update({
                    generated_count: generatedToday + 1,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', dailyUsage.id);
            if (usageUpdateError) {
                return NextResponse.json({ error: usageUpdateError.message }, { status: 500 });
            }
        }

        return NextResponse.json({
            success: true,
            url: imageUrl,
            revised_prompt: revisedPrompt,
            provider: imageProvider,
            freeUsage: {
                limit: FREE_IMAGES_PER_DAY,
                used: generatedToday + 1,
                remaining: Math.max(0, FREE_IMAGES_PER_DAY - (generatedToday + 1)),
            },
        });
    } catch (error: any) {
        console.error('AI Image Generation Error:', error);
        return clientErrorResponse(error, { request: req, scope: 'ai/image' });
    }
}
