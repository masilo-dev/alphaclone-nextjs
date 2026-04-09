import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { hubspotService } from '@/services/hubspotService';

export async function DELETE(req: NextRequest) {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const contactId = searchParams.get('contactId');

        if (!contactId) {
            return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 });
        }

        const result = await hubspotService.deleteContact(user.id, contactId);
        return NextResponse.json(result);
    } catch (err: any) {
        console.error('HubSpot Delete API Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
