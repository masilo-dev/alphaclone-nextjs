import { NextRequest, NextResponse } from 'next/server';
import { ZohoService } from '../../../../../services/zoho/ZohoService';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
    const authClient = await createSupabaseServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const zohoService = new ZohoService(user.id);
        await zohoService.disconnect();
        
        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('Zoho Disconnect Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
