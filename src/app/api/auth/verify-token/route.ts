import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { accessLinkService } from '@/services/accessLinkService';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const token = searchParams.get('token');

        if (!token) {
            return NextResponse.json({ error: 'Security token is required' }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();
        const { userId, error } = await accessLinkService.verifyToken(supabase, token);

        if (error || !userId) {
            return NextResponse.json({ error: error || 'Verification failed' }, { status: 401 });
        }

        // Token is valid and has been marked as used.
        // In a real scenario, you might want to also create a session here if the user isn't logged in.
        // For now, we just confirm validity.
        
        return NextResponse.json({ 
            success: true, 
            userId,
            message: 'Access verified successfully'
        });
    } catch (err) {
        console.error('[api/auth/verify-token] Critical error:', err);
        return NextResponse.json({ error: 'Internal security error' }, { status: 500 });
    }
}
