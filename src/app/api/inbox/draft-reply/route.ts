import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { aiService } from '@/services/ai/aiService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messageId, text, fromName, context } = body;

    let messageBody = text || '';
    let senderName = fromName || 'Client';

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
    }

    if (!messageBody) {
      return NextResponse.json({ error: 'Message body or text is required' }, { status: 400 });
    }

    const draftPrompt = `
      You are an AI business assistant for a solopreneur. Draft a polite, professional, and helpful response to the message below.
      
      From: ${senderName}
      Message:
      ${messageBody}
      
      ${context ? `Additional Context/Instructions: ${context}` : ''}
      
      Return only the response content. Do not include subject lines or greetings like "Dear X" unless necessary. Maintain a friendly and concise tone.
    `;

    const response = await aiService.complete({
      prompt: draftPrompt,
      systemPrompt: 'You are an advanced business communication expert assisting a solopreneur.',
      temperature: 0.7,
      maxTokens: 500,
    });

    return NextResponse.json({ success: true, draft: response.content });
  } catch (err: any) {
    console.error('[DraftReplyAPI] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
