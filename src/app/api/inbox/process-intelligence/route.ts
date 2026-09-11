import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { aiService } from '@/services/ai/aiService';
import { cleanAIJSONResponse } from '@/lib/utils';
import { requireAuthenticatedUser, routeErrorResponse } from '@/lib/apiAuth';
import { z } from 'zod';

export async function POST(req: NextRequest) {
  try {
    await requireAuthenticatedUser(req);
    const { messageId } = z.object({ messageId: z.string().uuid() }).parse(await req.json());

    const supabase = await createSupabaseServerClient();
    const { data: msg, error } = await supabase
      .from('unified_messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (error || !msg) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const textContent = msg.body || msg.html_body || '';
    if (!textContent) {
      return NextResponse.json({ error: 'Message has no body content to analyze' }, { status: 400 });
    }

    const prompt = `
      Analyze the following customer message and classify it for a solopreneur dashboard:
      
      Sender: ${msg.from_name || msg.from_address || 'Unknown'}
      Subject: ${msg.subject || 'No Subject'}
      Body:
      ${textContent}
      
      Return ONLY a raw JSON object with these keys:
      {
        "sentiment": "positive" | "neutral" | "negative",
        "category": "lead" | "support" | "billing" | "partnership" | "spam",
        "intent": "A short summary of what the sender wants",
        "priority": "low" | "normal" | "high" | "urgent",
        "summary": "A 1-sentence executive summary of the message",
        "suggested_action": "Recommended next action for the solopreneur"
      }
    `;

    const aiResponse = await aiService.complete({
      prompt,
      systemPrompt: 'You are a message intelligence analyzer. Return only pure JSON.',
      temperature: 0.1,
    });

    const cleaned = cleanAIJSONResponse(aiResponse.content);
    const result = JSON.parse(cleaned);

    // Update the message in the database with the intelligence fields
    const updatedMetadata = {
      ...(msg.metadata || {}),
      summary: result.summary,
      suggested_action: result.suggested_action,
    };

    const { data: updatedMsg, error: updateError } = await supabase
      .from('unified_messages')
      .update({
        sentiment: result.sentiment,
        category: result.category,
        intent: result.intent,
        priority: result.priority,
        metadata: updatedMetadata,
      })
      .eq('id', messageId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ success: true, intelligence: result, message: updatedMsg });
  } catch (err: unknown) {
    console.error('[ProcessIntelligenceAPI] Error:', err);
    return routeErrorResponse(err, 'Message analysis failed', req);
  }
}
