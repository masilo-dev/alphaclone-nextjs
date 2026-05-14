import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { RouteAuthError, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { AlphaNexus } from '@/lib/social/alphaNexus';
import { runNexusIntelligenceSession } from '@/lib/automation/nexusIntelligenceTask';

function isMissingRelationOrCache(error: unknown, relation: string): boolean {
    if (!error || typeof error !== 'object') return false;
    const maybeError = error as { code?: string; message?: string };
    const message = String(maybeError.message || '').toLowerCase();
    const relationName = relation.toLowerCase();
    return (
        (maybeError.code === '42P01' && message.includes(relationName)) ||
        (maybeError.code === 'PGRST205' && message.includes(relationName)) ||
        (message.includes(relationName) && (message.includes('does not exist') || message.includes('schema cache')))
    );
}

function socialWorkspaceUnavailableResponse() {
    return NextResponse.json({
        success: true,
        bookmarks: [],
        watchlist: [],
        warning: 'Social workspace setup is still in progress.',
    });
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const tenantId = String(searchParams.get('tenantId') || '').trim();
        if (!tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });

        await requireTenantAccess(tenantId);
        const admin = createSupabaseAdminClient();

        const [bmRes, wlRes, xRes, siRes] = await Promise.all([
            admin.from('social_bookmarks').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
            admin.from('social_watchlist').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
            admin.from('x_integrations').select('id, x_username, x_user_id, created_at').eq('tenant_id', tenantId).single(),
            admin.from('social_interactions').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(5),
        ]);

        if (bmRes.error || wlRes.error) {
            const bookmarksMissing = isMissingRelationOrCache(bmRes.error, 'social_bookmarks');
            const watchlistMissing = isMissingRelationOrCache(wlRes.error, 'social_watchlist');
            if (bookmarksMissing || watchlistMissing) {
                return socialWorkspaceUnavailableResponse();
            }
        }

        if (bmRes.error) return NextResponse.json({ error: bmRes.error.message }, { status: 500 });
        if (wlRes.error) return NextResponse.json({ error: wlRes.error.message }, { status: 500 });
        
        return NextResponse.json({ 
            success: true, 
            bookmarks: bmRes.data || [], 
            watchlist: wlRes.data || [],
            xIntegration: xRes.data || null,
            recentInteractions: siRes.data || []
        });
    } catch (error) {
        if (error instanceof RouteAuthError && (error.status === 500 || error.status === 403)) {
            return socialWorkspaceUnavailableResponse();
        }
        return routeErrorResponse(error, 'Failed to load social workspace');
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const tenantId = String(body.tenantId || '').trim();
        const mode = String(body.mode || '').trim();
        if (!tenantId || !mode) return NextResponse.json({ error: 'tenantId and mode are required' }, { status: 400 });

        await requireTenantAccess(tenantId);
        const admin = createSupabaseAdminClient();

        if (mode === 'add_bookmark') {
            const payload = {
                tenant_id: tenantId,
                title: String(body.title || '').trim(),
                url: String(body.url || '').trim(),
                platform: String(body.platform || 'facebook').trim(),
                category: String(body.category || 'group').trim(),
                notes: String(body.notes || '').trim(),
            };
            const { data, error } = await admin.from('social_bookmarks').insert(payload).select('*').single();
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true, bookmark: data });
        }

        if (mode === 'add_watchlist') {
            const payload = {
                tenant_id: tenantId,
                name: String(body.name || '').trim(),
                url: String(body.url || '').trim(),
                platform: String(body.platform || 'linkedin').trim(),
            };
            const { data, error } = await admin.from('social_watchlist').insert(payload).select('*').single();
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true, watchlistItem: data });
        }

        if (mode === 'start_lead_hunt') {
            const nexus = new AlphaNexus(tenantId);
            const result = await nexus.huntLeads();
            return NextResponse.json({ success: true, ...result });
        }

        if (mode === 'evaluate_outcome') {
            const nexus = new AlphaNexus(tenantId);
            const { content, platform } = body;
            const result = await nexus.evaluateInteraction(content, platform);
            return NextResponse.json({ success: true, evaluation: result });
        }

        if (mode === 'trigger_nexus_intelligence') {
            const result = await runNexusIntelligenceSession(tenantId);
            return NextResponse.json({ success: true, nexusLog: result });
        }

        if (mode === 'nexus_system_action') {
            const nexus = new AlphaNexus(tenantId);
            const { systemKey, params } = body;
            const result = await nexus.executeSystemAction(systemKey, params);
            return NextResponse.json({ success: true, result });
        }

        return NextResponse.json({ error: 'Unsupported mode' }, { status: 400 });
    } catch (error) {
        if (error instanceof RouteAuthError && (error.status === 500 || error.status === 403)) {
            return NextResponse.json(
                {
                    success: false,
                    warning: 'Social workspace setup is still in progress.',
                    error: 'Social workspace is temporarily unavailable.',
                },
                { status: 503 }
            );
        }
        return routeErrorResponse(error, 'Failed to update social workspace');
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();
        const tenantId = String(body.tenantId || '').trim();
        const mode = String(body.mode || '').trim();
        const id = String(body.id || '').trim();
        if (!tenantId || !mode || !id) return NextResponse.json({ error: 'tenantId, mode and id are required' }, { status: 400 });

        await requireTenantAccess(tenantId);
        const admin = createSupabaseAdminClient();

        if (mode === 'delete_bookmark') {
            const { error } = await admin.from('social_bookmarks').delete().eq('id', id).eq('tenant_id', tenantId);
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true });
        }

        if (mode === 'delete_watchlist') {
            const { error } = await admin.from('social_watchlist').delete().eq('id', id).eq('tenant_id', tenantId);
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Unsupported mode' }, { status: 400 });
    } catch (error) {
        if (error instanceof RouteAuthError && (error.status === 500 || error.status === 403)) {
            return NextResponse.json(
                {
                    success: false,
                    warning: 'Social workspace setup is still in progress.',
                    error: 'Social workspace is temporarily unavailable.',
                },
                { status: 503 }
            );
        }
        return routeErrorResponse(error, 'Failed to remove item');
    }
}
