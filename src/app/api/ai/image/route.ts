import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/ai/image
 * Generate an image via DALL-E 3.
 * Returns a *temporary* OpenAI URL (expires ~1 hour).
 * Images are NOT saved to Supabase — caller must explicitly upload if needed.
 */
export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { prompt, size = '1024x1024' } = await req.json();
    if (!prompt?.trim()) {
        return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const validSizes = ['1024x1024', '1792x1024', '1024x1792'];
    if (!validSizes.includes(size)) {
        return NextResponse.json({ error: 'Invalid size. Use 1024x1024, 1792x1024, or 1024x1792' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'OpenAI API key not configured on server' }, { status: 500 });
    }

    try {
        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'dall-e-3',
                prompt: prompt.trim(),
                n: 1,
                size,
                quality: 'hd',
                style: 'vivid',
            }),
        });

        if (!response.ok) {
            const err = await response.json();
            const msg = err.error?.message || 'Image generation failed';
            console.error('DALL-E 3 error:', msg);
            return NextResponse.json({ error: msg }, { status: response.status });
        }

        const data = await response.json();
        const imageUrl = data.data?.[0]?.url;
        const revisedPrompt = data.data?.[0]?.revised_prompt;

        if (!imageUrl) {
            return NextResponse.json({ error: 'No image returned from DALL-E 3' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            url: imageUrl,
            revised_prompt: revisedPrompt,
        });
    } catch (error: any) {
        console.error('AI Image Generation Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to generate image' },
            { status: 500 }
        );
    }
}
