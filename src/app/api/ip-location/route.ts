import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const response = await fetch('https://ipapi.co/json/', {
            // Set a brief cache to prevent excessive API calls
            next: { revalidate: 3600 }
        });

        if (!response.ok) {
            // Fallback to ipify if ipapi.co fails
            const ipifyResponse = await fetch('https://api.ipify.org?format=json');
            if (ipifyResponse.ok) {
                const data = await ipifyResponse.json();
                return NextResponse.json({
                    ip: data.ip,
                    city: 'Unknown',
                    region: 'Unknown',
                    country: 'Unknown',
                    country_name: 'Unknown',
                    org: 'Unknown'
                });
            }
            return NextResponse.json({ error: 'Failed to fetch IP location' }, { status: 500 });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('IP Location Fetch Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
