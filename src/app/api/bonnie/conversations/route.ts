import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * GET /api/bonnie/conversations
 * Returns the last 50 messages for the active conversation (tenant + user scoped).
 * Used by useBonniePersistence to hydrate chat history from the database.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = String(searchParams.get('tenantId') || '').trim();

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);

    const supabase = await createSupabaseServerClient();
    const { data: authUser } = await supabase.auth.getUser();
    const userId = authUser.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();

    // Find the most recent conversation for this user in this tenant
    const { data: conversation } = await admin
      .from('bonnie_conversations')
      .select('id, updated_at, module')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!conversation?.id) {
      return NextResponse.json({ success: true, messages: [], conversationId: null });
    }

    // Fetch the last 50 messages from this conversation
    const { data: messages, error } = await admin
      .from('bonnie_messages')
      .select('id, role, content, tools, approval_id, execution_status, error, created_at')
      .eq('conversation_id', conversation.id)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw error;

    // Map to the shape expected by BonnieChatPanel (PersistedMessage)
    const mapped = (messages || []).map((m: Record<string, unknown>) => ({
      id: m.id as string,
      role: m.role as 'user' | 'assistant',
      text: m.content as string,
      error: Boolean(m.error),
      executionStatus: m.execution_status ?? undefined,
      tools: m.tools ?? undefined,
      // approval cards are transient — don't re-render them from history
      approval: undefined,
    }));

    return NextResponse.json({
      success: true,
      messages: mapped,
      conversationId: conversation.id,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load conversation history');
  }
}

/**
 * POST /api/bonnie/conversations
 * Batch-saves messages to the database.
 * Used by useBonniePersistence as a fire-and-forget write-back.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = String(body.tenantId || '').trim();
    const messages = Array.isArray(body.messages) ? body.messages : [];

    if (!tenantId || !messages.length) {
      return NextResponse.json({ error: 'tenantId and messages are required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);

    const supabase = await createSupabaseServerClient();
    const { data: authUser } = await supabase.auth.getUser();
    const userId = authUser.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();

    // Upsert conversation
    const { data: existing } = await admin
      .from('bonnie_conversations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let conversationId = existing?.id as string | undefined;

    if (!conversationId) {
      const { data: created } = await admin
        .from('bonnie_conversations')
        .insert({ tenant_id: tenantId, user_id: userId })
        .select('id')
        .single();
      conversationId = created?.id as string | undefined;
    }

    if (!conversationId) {
      return NextResponse.json({ error: 'Could not create conversation' }, { status: 500 });
    }

    // Only write the intro message and the last 30 messages to avoid duplicates
    const relevantMessages = messages
      .filter((m: any) => m.id !== 'intro' && m.role && m.text)
      .slice(-30);

    if (relevantMessages.length > 0) {
      // Use upsert with the message's client-side `id` as the PK so we never duplicate
      await admin
        .from('bonnie_messages')
        .upsert(
          relevantMessages.map((m: any) => ({
            id: m.id,
            conversation_id: conversationId,
            tenant_id: tenantId,
            user_id: userId,
            role: m.role,
            content: m.text || '',
            tools: m.tools ?? null,
            execution_status: m.executionStatus ?? null,
            error: Boolean(m.error),
          })),
          { onConflict: 'id', ignoreDuplicates: true }
        );
    }

    return NextResponse.json({ success: true, conversationId });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to save messages');
  }
}
