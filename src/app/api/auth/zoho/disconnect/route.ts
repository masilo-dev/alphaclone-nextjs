import { NextRequest, NextResponse } from 'next/server';
import { ZohoService } from '../../../../../services/zoho/ZohoService';

export async function POST(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    try {
        const zohoService = new ZohoService(userId);
        await zohoService.disconnect();
        
        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('Zoho Disconnect Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
