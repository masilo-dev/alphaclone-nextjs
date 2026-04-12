import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { contractServerService } from '@/services/server/contractServerService';

export async function POST(req: NextRequest) {
    try {
        const supabase = await createSupabaseServerClient();
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
        return clientErrorResponse(error, { request: req, scope: 'contracts/sign' });
    }
}
