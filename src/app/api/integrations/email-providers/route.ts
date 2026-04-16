import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

type ProviderType = 'resend' | 'brevo';

function getProviderName(provider: ProviderType) {
  return provider === 'resend' ? 'Resend' : 'Brevo';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || '';
    const provider = (searchParams.get('provider') || '') as ProviderType;

    if (!tenantId || (provider !== 'resend' && provider !== 'brevo')) {
      return NextResponse.json({ error: 'tenantId and valid provider are required' }, { status: 400 });
    }

    const tenantCtx = await requireTenantAccess(tenantId);
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('integrations')
      .select('id, enabled, config')
      .eq('tenant_id', tenantId)
      .eq('user_id', tenantCtx.user.id)
      .eq('type', provider)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      connected: !!data?.enabled,
      config: data?.config || null,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load provider integration');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = String(body.tenantId || '').trim();
    const provider = String(body.provider || '').trim() as ProviderType;
    const apiKey = String(body.apiKey || '').trim();
    const fromEmail = String(body.fromEmail || '').trim();

    if (!tenantId || (provider !== 'resend' && provider !== 'brevo') || !apiKey || !fromEmail) {
      return NextResponse.json({ error: 'tenantId, provider, apiKey and fromEmail are required' }, { status: 400 });
    }

    const tenantCtx = await requireTenantAccess(tenantId);
    const supabase = createSupabaseAdminClient();

    const payload = {
      tenant_id: tenantId,
      user_id: tenantCtx.user.id,
      type: provider,
      name: getProviderName(provider),
      enabled: true,
      config: {
        apiKey,
        fromEmail,
      },
    };

    const firstTry = await supabase
      .from('integrations')
      .upsert(payload, { onConflict: 'user_id,type' })
      .select('id')
      .single();

    if (firstTry.error) {
      const secondTry = await supabase
        .from('integrations')
        .upsert(payload, { onConflict: 'tenant_id,user_id,type' })
        .select('id')
        .single();
      if (secondTry.error) {
        return NextResponse.json({ error: secondTry.error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to save provider integration');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = String(body.tenantId || '').trim();
    const provider = String(body.provider || '').trim() as ProviderType;

    if (!tenantId || (provider !== 'resend' && provider !== 'brevo')) {
      return NextResponse.json({ error: 'tenantId and valid provider are required' }, { status: 400 });
    }

    const tenantCtx = await requireTenantAccess(tenantId);
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('integrations')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('user_id', tenantCtx.user.id)
      .eq('type', provider);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to disconnect provider integration');
  }
}
