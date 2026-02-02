import { NextResponse } from 'next/server';
import { generateLeads } from '@/services/geminiService';


export const runtime = 'nodejs';

export async function POST(req: Request) {
    try {
        console.log("DEBUG: Checking Gemini API Key...");
        console.log("DEBUG: GEMINI_API_KEY present:", !!process.env.VITE_GEMINI_API_KEY || !!process.env.NEXT_PUBLIC_GEMINI_API_KEY);

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
