import { NextResponse } from 'next/server';
import { geminiService } from '@/services/geminiService';

export async function POST(req: Request) {
    try {
        const { prompt, maxTokens } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const response = await geminiService.generateContent(prompt);

        return NextResponse.json(response);
    } catch (error: any) {
        console.error('AI Generate API Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to process AI generation request'
        }, { status: 500 });
    }
}
