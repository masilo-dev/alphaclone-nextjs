import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

type SenderProfile = {
    fromName: string;
    fromEmail: string;
    signature: string;
};

const EMAIL_PROVIDER_TYPES = ['brevo', 'resend', 'sendgrid', 'zoho', 'gmail'] as const;

function normalizeProfile(input: Partial<SenderProfile>): SenderProfile {
    return {
        fromName: String(input.fromName || '').trim(),
        fromEmail: String(input.fromEmail || '').trim(),
        signature: String(input.signature || '').trim(),
    };
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const tenantId = String(searchParams.get('tenantId') || '').trim();
        if (!tenantId) {
            return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
        }

        const tenantCtx = await requireTenantAccess(tenantId);
        const admin = createSupabaseAdminClient();

        const { data, error } = await admin
            .from('integrations')
            .select('type, config')
            .eq('tenant_id', tenantId)
            .eq('user_id', tenantCtx.user.id)
            .eq('enabled', true)
            .in('type', [...EMAIL_PROVIDER_TYPES, 'email_profile']);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        let profile: SenderProfile = {
            fromName: String(tenantCtx.user.user_metadata?.full_name || tenantCtx.user.email?.split('@')[0] || 'Team').trim(),
            fromEmail: String(tenantCtx.user.email || '').trim(),
            signature: '',
        };

        const rows = Array.isArray(data) ? data : [];
        for (const row of rows) {
            const cfg = (row?.config || {}) as Record<string, unknown>;
            const candidate = normalizeProfile({
                fromName: String(cfg.fromName || cfg.from_name || ''),
                fromEmail: String(cfg.fromEmail || cfg.from_email || ''),
                signature: String(cfg.signature || ''),
            });
            if (!profile.fromName && candidate.fromName) profile.fromName = candidate.fromName;
            if (!profile.fromEmail && candidate.fromEmail) profile.fromEmail = candidate.fromEmail;
            if (!profile.signature && candidate.signature) profile.signature = candidate.signature;
            if (row?.type === 'email_profile') {
                if (candidate.fromName) profile.fromName = candidate.fromName;
                if (candidate.fromEmail) profile.fromEmail = candidate.fromEmail;
                if (candidate.signature) profile.signature = candidate.signature;
            }
        }

        return NextResponse.json({ success: true, profile });
    } catch (error) {
        return routeErrorResponse(error, 'Failed to load sender profile', request);
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const tenantId = String(body.tenantId || '').trim();
        const profile = normalizeProfile({
            fromName: body.fromName,
            fromEmail: body.fromEmail,
            signature: body.signature,
        });
        if (!tenantId) {
            return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
        }
        if (!profile.fromName || !profile.fromEmail) {
            return NextResponse.json({ error: 'fromName and fromEmail are required' }, { status: 400 });
        }

        const tenantCtx = await requireTenantAccess(tenantId);
        const admin = createSupabaseAdminClient();

        const { data: existingIntegrations, error: listError } = await admin
            .from('integrations')
            .select('id, type, config')
            .eq('tenant_id', tenantId)
            .eq('user_id', tenantCtx.user.id)
            .eq('enabled', true)
            .in('type', EMAIL_PROVIDER_TYPES as unknown as string[]);
        if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });

        for (const integration of existingIntegrations || []) {
            const currentConfig = (integration.config || {}) as Record<string, unknown>;
            const updatedConfig = {
                ...currentConfig,
                fromName: profile.fromName,
                fromEmail: profile.fromEmail,
                signature: profile.signature,
            };
            await admin.from('integrations').update({ config: updatedConfig }).eq('id', integration.id);
        }

        const profilePayload = {
            tenant_id: tenantId,
            user_id: tenantCtx.user.id,
            type: 'email_profile',
            name: 'Email Sender Profile',
            enabled: true,
            config: profile,
        };

        const firstTry = await admin
            .from('integrations')
            .upsert(profilePayload, { onConflict: 'user_id,type' })
            .select('id')
            .single();
        if (firstTry.error) {
            const secondTry = await admin
                .from('integrations')
                .upsert(profilePayload, { onConflict: 'tenant_id,user_id,type' })
                .select('id')
                .single();
            if (secondTry.error) {
                return NextResponse.json({ error: secondTry.error.message }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true, profile });
    } catch (error) {
        return routeErrorResponse(error, 'Failed to save sender profile', request);
    }
}
