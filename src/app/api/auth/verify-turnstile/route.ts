import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { token } = await request.json();

        if (!token) {
            return NextResponse.json({ success: false, error: 'Token is required' }, { status: 400 });
        }

        const secretKey = process.env.TURNSTILE_SECRET_KEY;

        if (!secretKey || secretKey === 'your_secret_key_here') {
            console.error('Cloudflare Turnstile secret key is not configured');
            // During development/transition, we might want to allow this or fail gracefully
            // For now, let's assume it's required.
            return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 });
        }

        // Verify the token with Cloudflare
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        const data = await response.json();

        if (data.success) {
            return NextResponse.json({ success: true });
        } else {
            console.warn('Turnstile verification failed:', data['error-codes']);
            return NextResponse.json({
                success: false,
                error: 'Verification failed',
                codes: data['error-codes']
            }, { status: 400 });
        }
    } catch (error) {
        console.error('Turnstile verification error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
