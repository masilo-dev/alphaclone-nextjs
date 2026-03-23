import { NextRequest, NextResponse } from 'next/server';
import { ZohoCRMService } from '../../../../../services/zoho/ZohoCRMService';

export async function POST(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || req.headers.get('x-user-id'); 
    
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const zohoCRM = new ZohoCRMService(userId);

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
            message: `Successfully synced ${syncedCount} records from Zoho CRM`
        });
    } catch (err: any) {
        console.error('Zoho CRM Sync Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
