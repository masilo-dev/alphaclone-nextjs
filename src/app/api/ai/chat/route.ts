import { NextResponse } from 'next/server';
import { chatWithGemini } from '@/services/geminiService';

export async function POST(req: Request) {
    try {
        const { history, message, image } = await req.json();

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        const response = await chatWithGemini(history || [], message, image);

        return NextResponse.json(response);
    } catch (error: any) {
        console.error('AI Chat API Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to process AI chat request'
        }, { status: 500 });
    }
}
