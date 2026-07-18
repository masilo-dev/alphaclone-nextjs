import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { UNITS_PER_IMAGE, planIncludesImageGeneration, isImageGenerationPromoActive } from '@/config/aiUsageQuotas';
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
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';

type ImageProvider = 'xai' | 'openai';

function isMissingDailyUsageTableError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const maybeError = error as { code?: string; message?: string };
    const message = String(maybeError.message || '').toLowerCase();
    return (
        maybeError.code === '42P01' ||
        maybeError.code === 'PGRST205' ||
        (message.includes('daily_image_generation_usage') && message.includes('schema cache')) ||
        (message.includes('daily_image_generation_usage') && message.includes('could not find the table')) ||
        (message.includes('relation') && message.includes('daily_image_generation_usage') && message.includes('does not exist'))
    );
}

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
        : OPENAI_IMAGE_MODEL;

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
 * Generate an image through the configured provider and persist it to tenant-owned storage.
 */
export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { prompt, size = '1024x1024', tenantId: bodyTenantId, mode, provider, assetType = 'image', metadata = {} } = await req.json();
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
    if (!['image', 'logo'].includes(assetType)) return NextResponse.json({ error: 'Invalid asset type' }, { status: 400 });

    // Hard free allowance for everyone: 3 images per UTC day per user.
    // This is independent from tenant AI unit quotas.
    const usageDate = getTodayUtcDate();
    let usageTrackingEnabled = true;
    let dailyUsage: { id: string; generated_count: number } | null = null;
    const { data: usageData, error: usageReadError } = await admin
        .from('daily_image_generation_usage')
        .select('id,generated_count')
        .eq('user_id', user.id)
        .eq('usage_date', usageDate)
        .maybeSingle();
    if (usageReadError && isMissingDailyUsageTableError(usageReadError)) {
        usageTrackingEnabled = false;
    } else if (usageReadError) {
        return NextResponse.json({ error: usageReadError.message }, { status: 500 });
    }
    dailyUsage = usageData;
    const generatedToday = Number(dailyUsage?.generated_count ?? 0);
    const promoActive = isImageGenerationPromoActive();
    if (usageTrackingEnabled && !promoActive && generatedToday >= FREE_IMAGES_PER_DAY) {
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

    let tenantId: string | null = null;
    const ctx = await resolveTenantContextForUser(supabase, user.id, bodyTenantId ?? null);
    if (!skipQuota) {
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
        if (!planIncludesImageGeneration(ctx.plan)) {
            return NextResponse.json(
                {
                    error: 'AI image generation requires a Pro plan or higher.',
                    code: 'PLAN_UPGRADE_REQUIRED',
                    plan: ctx.plan,
                },
                { status: 403 }
            );
        }
        if (!isImageGenerationPromoActive()) {
            const blocked = await consumeAiUnitsOr429(admin, ctx.tenantId, ctx.plan, UNITS_PER_IMAGE);
            if (blocked) return blocked;
        }
    }
    if (skipQuota) tenantId = ctx?.tenantId || null;
    if (!tenantId) return NextResponse.json({ error: 'A workspace is required to store generated images.', code: 'TENANT_REQUIRED' }, { status: 400 });

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
        let lastErrorStatus = 500;
        let lastErrorPayload: any = null;

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

            // Map upstream status to a more appropriate local status
            if (result.status === 429) {
                lastErrorStatus = 429;
            } else if (result.status === 400) {
                lastErrorStatus = 400;
            } else if (result.status === 401 || result.status === 403) {
                lastErrorStatus = 500; // API key/permission issue is a server-side failure for the user
            } else if (result.status >= 500) {
                lastErrorStatus = 502;
            } else {
                lastErrorStatus = 503;
            }

            lastErrorPayload = result.error;
            console.error(`AI image provider error [${p}]:`, { status: result.status, error: result.error });
        }

        if (!result || !result.ok) {
            const errorMessage = lastErrorStatus === 429 
                ? 'Image generation service is currently overloaded. Please try again in a few minutes.'
                : 'Image generation failed';
            
            return NextResponse.json(
                { 
                    error: errorMessage, 
                    code: lastErrorStatus === 429 ? 'RATE_LIMIT_EXCEEDED' : 'IMAGE_PROVIDER_ERROR',
                    details: lastErrorPayload,
                    status: lastErrorStatus
                },
                { status: lastErrorStatus }
            );
        }


        const imageUrl = result.url;
        const revisedPrompt = result.revisedPrompt;
        const imageProvider = result.provider;

        const imageResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) });
        if (!imageResponse.ok) return NextResponse.json({ error: 'Generated image could not be downloaded for permanent storage' }, { status: 502 });
        const contentType = String(imageResponse.headers.get('content-type') || 'image/png').split(';')[0];
        if (!contentType.startsWith('image/')) return NextResponse.json({ error: 'Image provider returned an invalid file type' }, { status: 502 });
        const bytes = new Uint8Array(await imageResponse.arrayBuffer());
        if (bytes.byteLength > 25 * 1024 * 1024) return NextResponse.json({ error: 'Generated image exceeds the 25 MB storage limit' }, { status: 413 });
        const extension = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/webp' ? 'webp' : 'png';
        const storagePath = `generated/${tenantId}/${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: storageError } = await admin.storage.from('social-assets').upload(storagePath, bytes, { contentType, cacheControl: '31536000', upsert: false });
        if (storageError) return NextResponse.json({ error: 'Generated image could not be stored permanently', details: storageError.message }, { status: 502 });
        const { data: publicData } = admin.storage.from('social-assets').getPublicUrl(storagePath);
        const permanentUrl = publicData.publicUrl;
        const { data: asset, error: assetError } = await admin.from('generated_assets').insert({
            tenant_id: tenantId,
            user_id: user.id,
            asset_type: assetType,
            prompt: prompt.trim(),
            url: permanentUrl,
            storage_path: storagePath,
            bucket_id: 'social-assets',
            metadata: { ...metadata, size, provider: imageProvider, model: imageProvider === 'openai' ? OPENAI_IMAGE_MODEL : process.env.XAI_IMAGE_MODEL || process.env.GROK_IMAGE_MODEL || 'grok-2-image', revisedPrompt: revisedPrompt || null },
        }).select('*').single();
        if (assetError) {
            await admin.storage.from('social-assets').remove([storagePath]);
            return NextResponse.json({ error: 'Generated image metadata could not be saved' }, { status: 500 });
        }

        // Increment free daily usage only after the permanent asset exists.
        if (usageTrackingEnabled && !dailyUsage) {
            const { error: usageInsertError } = await admin.from('daily_image_generation_usage').insert({ user_id: user.id, usage_date: usageDate, generated_count: 1 });
            if (usageInsertError && isMissingDailyUsageTableError(usageInsertError)) usageTrackingEnabled = false;
            else if (usageInsertError) console.error('[ai/image] daily usage could not be recorded', usageInsertError);
        } else if (usageTrackingEnabled && dailyUsage) {
            const { error: usageUpdateError } = await admin.from('daily_image_generation_usage').update({ generated_count: generatedToday + 1, updated_at: new Date().toISOString() }).eq('id', dailyUsage.id);
            if (usageUpdateError && isMissingDailyUsageTableError(usageUpdateError)) usageTrackingEnabled = false;
            else if (usageUpdateError) console.error('[ai/image] daily usage could not be recorded', usageUpdateError);
        }

        return NextResponse.json({
            success: true,
            url: permanentUrl,
            asset,
            revised_prompt: revisedPrompt,
            provider: imageProvider,
            freeUsage: {
                limit: FREE_IMAGES_PER_DAY,
                used: usageTrackingEnabled ? generatedToday + 1 : null,
                remaining: usageTrackingEnabled ? Math.max(0, FREE_IMAGES_PER_DAY - (generatedToday + 1)) : null,
                trackingEnabled: usageTrackingEnabled,
            },
        });
    } catch (error: any) {
        console.error('AI Image Generation Error:', error);
        return clientErrorResponse(error, { request: req, scope: 'ai/image' });
    }
}
