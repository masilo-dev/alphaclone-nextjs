import { NextRequest, NextResponse } from 'next/server';
import unifiedAIService from '@/services/unifiedAIService';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { rateLimitConfigs, rateLimitMiddleware } from '@/lib/rateLimit';
import { requireAuthenticatedUser, routeErrorResponse } from '@/lib/apiAuth';
import { isPlatformAdminRole } from '@/lib/platformAdmin';

function getRequestIp(req: NextRequest): string {
    const forwarded = req.headers.get('x-forwarded-for');
    const firstForwarded = forwarded?.split(',')[0]?.trim();
    return firstForwarded || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

export async function GET(req: NextRequest) {
    try {
        const limited = await rateLimitMiddleware(
            req,
            rateLimitConfigs.api.heavy,
            `${getRequestIp(req)}:debug-ai`
        );
        if (limited) return limited;
        const { user, supabase } = await requireAuthenticatedUser(req);
        if (process.env.NODE_ENV === 'production') {
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .maybeSingle();
            if (!isPlatformAdminRole(profile?.role)) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 });
            }
        }

        const status = {
            config: {
                providers: process.env.NODE_ENV === 'production' ? null : unifiedAIService.getAvailableProviders()
            },
            tests: {
                unifiedService: null as any
            },
        };

        try {
            const start = Date.now();
            const res = await unifiedAIService.generateText("Say 'AlphaClone AI OK'", 10);
            status.tests.unifiedService = {
                success: !res.error && (res.text?.toLowerCase().includes('ok') || res.text?.toLowerCase().includes('alphaclone')),
                result: process.env.NODE_ENV === 'production' ? null : res.text,
                error: res.error,
                latency: Date.now() - start
            };
        } catch (e: unknown) {
            console.error('[debug-ai] unifiedService:', e);
            status.tests.unifiedService = { success: false, error: 'Test failed' };
        }

        return NextResponse.json(status);
    } catch (err) {
        return routeErrorResponse(err, 'Failed to run AI diagnostics', req);
    }
}
