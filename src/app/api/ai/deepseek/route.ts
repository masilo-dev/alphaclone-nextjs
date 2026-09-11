import { NextRequest, NextResponse } from 'next/server';
import { callDeepSeek } from '@/lib/ai/deepseek';
import { requireAuthenticatedUser, routeErrorResponse } from '@/lib/apiAuth';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await requireAuthenticatedUser(req);
    const body = z.object({
      prompt: z.string().trim().min(1).max(20_000),
      options: z.object({
        model: z.enum(['deepseek-chat', 'deepseek-reasoner']).optional(),
        maxTokens: z.number().int().min(1).max(8_000).optional(),
        temperature: z.number().min(0).max(2).optional(),
        systemPrompt: z.string().max(20_000).optional(),
      }).optional(),
    }).parse(await req.json().catch(() => ({})));
    const { prompt, options = {} } = body;
    const content = await callDeepSeek(prompt, options);

    return NextResponse.json({ content });
  } catch (error) {
    return routeErrorResponse(error, 'DeepSeek request failed', req);
  }
}
