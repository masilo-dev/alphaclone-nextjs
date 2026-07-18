import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { routeAIRequest } from '@/services/aiRouter';
import { buildBusinessReplyPrompt } from '@/lib/ai/businessContext';
import { requireAuthenticatedUser, routeErrorResponse } from '@/lib/apiAuth';
import { z } from 'zod';

export async function POST(req: NextRequest) {
  try {
    await requireAuthenticatedUser(req);
    const body = z.object({
      messageId: z.string().uuid().optional(),
      text: z.string().max(20_000).optional(),
      fromName: z.string().max(200).optional(),
      subject: z.string().max(500).optional(),
      context: z.string().max(5_000).optional(),
      replyTo: z.string().max(200).optional(),
    }).parse(await req.json());
    const { messageId, text, fromName, context } = body;

    let messageBody = text || '';
    let senderName = fromName || 'Client';
    let subjectLine = typeof body?.subject === 'string' ? body.subject : '';

    if (messageId) {
      const supabase = await createSupabaseServerClient();
      const { data: msg, error } = await supabase
        .from('unified_messages')
        .select('*')
        .eq('id', messageId)
        .single();

      if (error || !msg) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }

      messageBody = msg.body || msg.html_body || '';
      senderName = msg.from_name || msg.from_address || 'Client';
      subjectLine = msg.subject || subjectLine;
    }

    if (!messageBody) {
      return NextResponse.json({ error: 'Message body or text is required' }, { status: 400 });
    }

    const draftPrompt = buildBusinessReplyPrompt({
      sender: { name: senderName },
      recipient: { name: 'AlphaClone team' },
      subject: subjectLine,
      message: messageBody,
      replyTo: body?.replyTo ? { name: String(body.replyTo) } : undefined,
      channel: 'email',
      context: context ? `Additional context: ${context}` : undefined,
    });

    const response = await routeAIRequest({
      prompt: draftPrompt,
      systemPrompt: 'You are an advanced business communication expert assisting a solopreneur.',
      temperature: 0.45,
      maxTokens: 500,
    });

    return NextResponse.json({ success: true, draft: response.content });
  } catch (err: unknown) {
    console.error('[DraftReplyAPI] Error:', err);
    return routeErrorResponse(err, 'Draft generation failed', req);
  }
}
