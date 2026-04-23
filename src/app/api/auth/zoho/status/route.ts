import { NextRequest, NextResponse } from 'next/server';
import { ZohoService } from '../../../../../services/zoho/ZohoService';
import { ZohoMailService } from '../../../../../services/zoho/ZohoMailService';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
    const authClient = await createSupabaseServerClient();
    const {
        data: { user },
    } = await authClient.auth.getUser();
    const userId = user?.id || null;
    if (!userId) {
        return NextResponse.json({ isConnected: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const zohoService = new ZohoService(userId);
        const baseConnected = await zohoService.checkIntegration();
        if (!baseConnected) {
            return NextResponse.json({ isConnected: false, mailReady: false });
        }

        let mailReady = false;
        try {
            const zohoMailService = new ZohoMailService(userId);
            const senderAddresses = await zohoMailService.getSenderAddresses();
            mailReady = senderAddresses.length > 0;
        } catch {
            mailReady = false;
        }

        return NextResponse.json({
            isConnected: mailReady,
            mailReady,
            baseConnected,
        });
    } catch (err: unknown) {
        console.error('Zoho Status Check Error:', err);
        return NextResponse.json(
            { isConnected: false, error: 'Status check failed', code: 'ZOHO_STATUS_ERROR' },
            { status: 500 }
        );
    }
}
