import { NextRequest, NextResponse } from 'next/server';
import { ZohoCRMService } from '../../../../../services/zoho/ZohoCRMService';
import { ZohoAuthExpiredError } from '../../../../../services/zoho/ZohoService';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const zohoCRM = new ZohoCRMService(user.id);

    try {
        const { module } = await req.json();

        let syncedCount = 0;
        if (module === 'Contacts' || !module) {
            syncedCount += await zohoCRM.syncContacts();
        }
        if (module === 'Deals' || !module) {
            syncedCount += await zohoCRM.syncDeals();
        }

        return NextResponse.json({
            success: true,
            syncedCount,
            message: `Successfully synced ${syncedCount} records from Zoho CRM`,
        });
    } catch (err: any) {
        if (err instanceof ZohoAuthExpiredError) {
            return NextResponse.json(
                { error: err.message, reconnect: true },
                { status: 401 }
            );
        }
        console.error('[Zoho CRM Sync]', err?.message ?? err);
        return NextResponse.json({ error: err?.message ?? 'Sync failed' }, { status: 500 });
    }
}
