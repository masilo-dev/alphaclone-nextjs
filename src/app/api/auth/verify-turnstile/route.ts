import { NextRequest, NextResponse } from 'next/server';
import { verifyTurnstileToken, isTurnstileEnforced } from '@/lib/verifyTurnstile';

export async function POST(request: NextRequest) {
    try {
        const { token } = await request.json();

        if (!token) {
            return NextResponse.json({ success: false, error: 'Token is required' });
        }

        if (!isTurnstileEnforced()) {
            return NextResponse.json({ success: true, bypassed: true });
        }

        const verified = await verifyTurnstileToken(token);
        if (verified) {
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({
            success: false,
            error: 'Verification failed',
        });
    } catch (error) {
        console.error('Turnstile verification error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
