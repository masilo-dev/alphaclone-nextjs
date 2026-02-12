import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { contractServerService } from '@/services/server/contractServerService';

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { contractId, role, signatureDataUrl, signerName, signerEmail } = body;

        if (!contractId || !role || !signatureDataUrl) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
        const userAgent = req.headers.get('user-agent') || 'unknown';

        const updatedContract = await contractServerService.signContract({
            contractId,
            userId: user.id,
            role,
            signatureDataUrl,
            signerName,
            signerEmail,
            ipAddress,
            userAgent
        });

        return NextResponse.json({ success: true, contract: updatedContract });

    } catch (error: any) {
        console.error('Contract Sign Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
