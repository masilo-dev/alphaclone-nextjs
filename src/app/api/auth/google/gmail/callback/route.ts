import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com';
    const returnTo = '/dashboard/business/settings?tab=integrations';
    
    // Redirect with a message that OAuth is deprecated
    return NextResponse.redirect(`${appUrl}${returnTo}&gmail=deprecated&reason=oauth_removed`);
}

