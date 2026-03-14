import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { hubspotService } from '@/services/hubspotService';

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        const contactId = searchParams.get('contactId');

        if (!userId || !contactId) {
            return NextResponse.json({ error: 'User ID and Contact ID are required' }, { status: 400 });
        }

        const result = await hubspotService.deleteContact(userId, contactId);
        return NextResponse.json(result);
    } catch (err: any) {
        console.error('HubSpot Delete API Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
