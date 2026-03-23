import { NextRequest, NextResponse } from 'next/server';
import { ZohoService } from '../../../../../services/zoho/ZohoService';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    try {
        const zohoService = new ZohoService(userId);
        const isConnected = await zohoService.checkIntegration();
        
        return NextResponse.json({ isConnected });
    } catch (err: any) {
        console.error('Zoho Status Check Error:', err);
        return NextResponse.json({ isConnected: false, error: err.message }, { status: 500 });
    }
}
