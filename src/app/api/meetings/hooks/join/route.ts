import { NextResponse } from 'next/server';

const corsHeaders = (origin: string | null) => ({
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
});

export async function OPTIONS(req: Request) {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders(req.headers.get('origin')),
    });
}

export async function POST(req: Request) {
    try {
        await req.json().catch(() => ({}));
        return new NextResponse(null, {
            status: 204,
            headers: corsHeaders(req.headers.get('origin')),
        });
    } catch {
        return NextResponse.json(
            { error: 'Invalid meeting join hook payload' },
            {
                status: 400,
                headers: corsHeaders(req.headers.get('origin')),
            }
        );
    }
}
