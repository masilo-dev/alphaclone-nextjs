import { NextResponse } from 'next/server';

export async function POST() {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ status: 'ok' });
}
