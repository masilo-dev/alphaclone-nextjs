import { NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { alphaAgent } from '@/services/alpha/alphaAgent';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Helper to get authenticated user in the API
 */
async function getAuthUser() {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.VITE_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Fetch Tenant ID
    const { data: tenantUser } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

    return {
        id: user.id,
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
        role: user.user_metadata?.role || 'operator',
        tenantId: tenantUser?.tenant_id
    };
}

export async function POST(req: Request) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { description } = await req.json();
        if (!description) {
            return NextResponse.json({ error: 'Mission description is required' }, { status: 400 });
        }

        const missionId = await alphaAgent.startMission(description, user);
        return NextResponse.json({ missionId, status: 'started' });
    } catch (error: any) {
        console.error('[Alpha API] Error starting mission:', error);
        return clientErrorResponse(error, { request: req, scope: 'alpha' });
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (id) {
            const status = alphaAgent.getMissionStatus(id, user.id);
            if (!status) {
                return NextResponse.json({ error: 'Mission not found or unauthorized' }, { status: 404 });
            }
            return NextResponse.json(status);
        }

        const missions = alphaAgent.getAllMissions(user.id);
        return NextResponse.json(missions);
    } catch (error: any) {
        console.error('[Alpha API] Error fetching mission status:', error);
        return clientErrorResponse(error, { request: req, scope: 'alpha' });
    }
}
