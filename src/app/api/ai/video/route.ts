import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { xaiVideoGenerationService } from '@/services/ai/xaiVideoGenerationService';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const prompt = String(body.prompt || '').trim();
        if (!prompt) {
            return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
        }

        const result = await xaiVideoGenerationService.generateVideo({
            prompt,
            imageUrl: body.imageUrl || body.image_url,
            duration: body.duration,
            poll: body.poll !== false,
        });

        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        return clientErrorResponse(error, { request: req, scope: 'ai/video.POST' });
    }
}
