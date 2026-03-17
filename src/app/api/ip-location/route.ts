import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        message: 'IP location tracking is disabled for privacy',
        ip: '0.0.0.0',
        city: 'Private',
        region: 'Private',
        country: 'XX',
        country_name: 'Private',
        org: 'Private'
    });
}
