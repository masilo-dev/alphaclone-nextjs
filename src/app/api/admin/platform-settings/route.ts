import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requirePlatformSuperAdmin, routeErrorResponse } from '@/lib/apiAuth';
import type { PlatformEnvStatus, PlatformGlobalSettings } from '@/types/platformSettings';

const SINGLETON = 'default';

function buildEnvStatus(): PlatformEnvStatus {
  return {
    supabase: !!(ENV.VITE_SUPABASE_URL && ENV.SUPABASE_SERVICE_ROLE_KEY),
    supabaseAuth: !!ENV.VITE_SUPABASE_ANON_KEY,
    stripe: !!ENV.STRIPE_SECRET_KEY,
    daily: !!ENV.DAILY_API_KEY,
    resend: !!ENV.RESEND_API_KEY,
    facebook: !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET),
    zoom: !!(ENV.ZOOM_CLIENT_ID && ENV.ZOOM_CLIENT_SECRET),
    googleOAuth: !!(ENV.GOOGLE_CLIENT_ID && ENV.GOOGLE_CLIENT_SECRET),
    anthropic: !!ENV.ANTHROPIC_API_KEY,
    openai: !!ENV.OPENAI_API_KEY,
    gemini: !!ENV.VITE_GEMINI_API_KEY,
    whatsapp: !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    linkedin: !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET),
    instagram: !!(process.env.INSTAGRAM_ACCESS_TOKEN),
    twitter: !!(process.env.TWITTER_API_KEY && process.env.TWITTER_API_SECRET),
    zoho: !!(process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET),
    outlook: !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
    gmail: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    deepseek: !!process.env.DEEPSEEK_API_KEY,
  };
}

function mergeSettings(raw: unknown): PlatformGlobalSettings {
  if (!raw || typeof raw !== 'object') return {};
  return raw as PlatformGlobalSettings;
}

export async function GET() {
  try {
    await requirePlatformSuperAdmin();
    const admin = createSupabaseAdminClient();

    const { data, error } = await admin
      .from('platform_global_settings')
      .select('settings, updated_at, updated_by')
      .eq('singleton_key', SINGLETON)
      .maybeSingle();

    if (error) {
      console.error('[platform-settings] GET:', error);
      return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
    }

    return NextResponse.json({
      settings: mergeSettings(data?.settings),
      updatedAt: data?.updated_at ?? null,
      updatedBy: data?.updated_by ?? null,
      envStatus: buildEnvStatus(),
    });
  } catch (e) {
    return routeErrorResponse(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { user } = await requirePlatformSuperAdmin();
    const body = (await req.json()) as { settings?: PlatformGlobalSettings };
    if (!body.settings || typeof body.settings !== 'object') {
      return NextResponse.json({ error: 'settings object required' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: existing } = await admin
      .from('platform_global_settings')
      .select('settings')
      .eq('singleton_key', SINGLETON)
      .maybeSingle();

    const prev = mergeSettings(existing?.settings);
    const next: PlatformGlobalSettings = {
      ...prev,
      ...body.settings,
      branding: { ...prev.branding, ...body.settings.branding },
      security: { ...prev.security, ...body.settings.security },
      support: { ...prev.support, ...body.settings.support },
    };

    const { error } = await admin.from('platform_global_settings').upsert(
      {
        singleton_key: SINGLETON,
        settings: next,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'singleton_key' }
    );

    if (error) {
      console.error('[platform-settings] PUT:', error);
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, settings: next, envStatus: buildEnvStatus() });
  } catch (e) {
    return routeErrorResponse(e);
  }
}
