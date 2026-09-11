import { NextRequest, NextResponse } from 'next/server';
import { callDeepSeek } from '@/lib/ai/deepseek';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const prompt = typeof body?.prompt === 'string' ? body.prompt : '';
    if (!prompt.trim()) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const options = typeof body?.options === 'object' && body.options ? body.options : {};
    const content = await callDeepSeek(prompt, options);

    return NextResponse.json({ content });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DeepSeek request failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
