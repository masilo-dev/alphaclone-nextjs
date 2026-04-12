import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { alphaAgent } from '@/services/alpha/alphaAgent';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
    try {
        const { message } = await req.json();
        
        // 1. Get Auth Context
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.VITE_SUPABASE_URL!,
            process.env.VITE_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return cookieStore.getAll() },
                    setAll() {}
                },
            }
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // 2. Start specialized "Support Mission"
        const result = await alphaAgent.startMission(
            `You are Bonnie, the Alpha Support Agent. Answer the user: ${message}`,
            {
                id: user.id,
                name: user.user_metadata?.name || 'User',
                role: 'user',
                tenantId: '' 
            }
        );


        // For Support Agent, we return the immediate reasoning/result
        return NextResponse.json({
            success: true,
            reply: result || "I'm looking into that for you. Use the AI Studio for more complex tasks!"
        });


    } catch (error: any) {
        console.error('Support API Error:', error);
        return clientErrorResponse(error, { request: req, scope: 'alpha/support' });
    }
}
