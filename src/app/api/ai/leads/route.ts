import { NextResponse } from 'next/server';
import { generateLeads } from '@/services/geminiService';

export async function POST(req: Request) {
    try {
        const { industry, location } = await req.json();

        if (!industry || !location) {
            return NextResponse.json({ error: 'Industry and location are required' }, { status: 400 });
        }

        const leads = await generateLeads(industry, location);

        return NextResponse.json({ leads });
    } catch (error: any) {
        console.error('Lead Generation API Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to generate leads'
        }, { status: 500 });
    }
}
