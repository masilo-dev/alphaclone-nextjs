import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';

async function requireUser(tenantId: string) {
  await requireTenantAccess(tenantId);
  const supabase = await createSupabaseServerClient();
  const { data: authUser } = await supabase.auth.getUser();
  const userId = authUser.user?.id;
  if (!userId) {
    throw Object.assign(new Error('Unauthenticated'), { status: 401 });
  }
  return { userId, admin: createSupabaseAdminClient() };
}

/**
 * GET /api/bonnie/conversations?tenantId=
 *   list=1           → conversation list (sidebar)
 *   conversationId=  → messages for a specific conversation
 *   (default)        → latest conversation messages (legacy hydrate)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = String(searchParams.get('tenantId') || '').trim();
    const list = ['1', 'true', 'yes'].includes(
      String(searchParams.get('list') || '').toLowerCase()
    );
    const conversationId = String(searchParams.get('conversationId') || '').trim();
    const includeArchived = ['1', 'true', 'yes'].includes(
      String(searchParams.get('includeArchived') || '').toLowerCase()
    );
    const q = String(searchParams.get('q') || '').trim().toLowerCase();

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const { userId, admin } = await requireUser(tenantId);

    if (list) {
      let query = admin
        .from('bonnie_conversations')
        .select('id, title, module, pinned, archived_at, metadata, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .order('pinned', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(100);

      if (!includeArchived) {
        query = query.is('archived_at', null);
      }

      const { data, error } = await query;
      if (error) throw error;

      const conversations = (data || [])
        .filter((row) => (q ? String(row.title || '').toLowerCase().includes(q) : true))
        .map((row) => ({
          id: row.id,
          title: row.title || 'New conversation',
          module: row.module,
          pinned: Boolean(row.pinned),
          archived: Boolean(row.archived_at),
          archivedAt: row.archived_at,
          metadata: row.metadata || {},
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));

      return NextResponse.json({ success: true, conversations });
    }

    let conversation: { id: string; title?: string; module?: string | null } | null = null;

    if (conversationId) {
      const { data } = await admin
        .from('bonnie_conversations')
        .select('id, title, module, updated_at')
        .eq('id', conversationId)
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .maybeSingle();
      conversation = data;
    } else {
      const { data } = await admin
        .from('bonnie_conversations')
        .select('id, title, module, updated_at')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .is('archived_at', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      conversation = data;
    }

    if (!conversation?.id) {
      return NextResponse.json({
        success: true,
        messages: [],
        conversationId: null,
        conversation: null,
      });
    }

    const { data: messages, error } = await admin
      .from('bonnie_messages')
      .select('id, role, content, tools, approval_id, execution_status, error, created_at')
      .eq('conversation_id', conversation.id)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true })
      .limit(80);

    if (error) throw error;

    const mapped = (messages || []).map((m: Record<string, unknown>) => ({
      id: m.id as string,
      role: m.role as 'user' | 'assistant',
      text: m.content as string,
      error: Boolean(m.error),
      executionStatus: m.execution_status ?? undefined,
      tools: m.tools ?? undefined,
      approval: undefined,
      createdAt: m.created_at,
    }));

    return NextResponse.json({
      success: true,
      messages: mapped,
      conversationId: conversation.id,
      conversation: {
        id: conversation.id,
        title: conversation.title || 'New conversation',
        module: conversation.module,
      },
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load conversations');
  }
}

/**
 * POST /api/bonnie/conversations
 * - action=create → new conversation
 * - default → legacy message batch save (optionally for conversationId)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = String(body.tenantId || '').trim();
    const action = String(body.action || '').trim();

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const { userId, admin } = await requireUser(tenantId);

    if (action === 'create') {
      const title = String(body.title || 'New conversation').trim().slice(0, 120);
      const conversationModule = body.module ? String(body.module).slice(0, 64) : null;
      const { data: created, error } = await admin
        .from('bonnie_conversations')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          title: title || 'New conversation',
          module: conversationModule,
        })
        .select('id, title, module, pinned, archived_at, metadata, created_at, updated_at')
        .single();
      if (error) throw error;
      return NextResponse.json({
        success: true,
        conversation: {
          id: created.id,
          title: created.title,
          module: created.module,
          pinned: Boolean(created.pinned),
          archived: Boolean(created.archived_at),
          metadata: created.metadata || {},
          createdAt: created.created_at,
          updatedAt: created.updated_at,
        },
      });
    }

    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) {
      return NextResponse.json({ error: 'tenantId and messages are required' }, { status: 400 });
    }

    let conversationId: string | undefined = body.conversationId
      ? String(body.conversationId)
      : undefined;

    if (conversationId) {
      const { data: owned } = await admin
        .from('bonnie_conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .maybeSingle();
      if (!owned?.id) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
    } else {
      const { data: existing } = await admin
        .from('bonnie_conversations')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .is('archived_at', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      conversationId = existing?.id ? String(existing.id) : undefined;

      if (!conversationId) {
        const { data: created } = await admin
          .from('bonnie_conversations')
          .insert({ tenant_id: tenantId, user_id: userId })
          .select('id')
          .single();
        conversationId = created?.id ? String(created.id) : undefined;
      }
    }

    if (!conversationId) {
      return NextResponse.json({ error: 'Could not create conversation' }, { status: 500 });
    }

    const relevantMessages = messages
      .filter((m: any) => m.id !== 'intro' && m.role && m.text)
      .slice(-30);

    if (relevantMessages.length > 0) {
      await admin.from('bonnie_messages').upsert(
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

      const firstUser = relevantMessages.find((m: any) => m.role === 'user');
      if (firstUser?.text) {
        await admin
          .from('bonnie_conversations')
          .update({
            updated_at: new Date().toISOString(),
            title: String(firstUser.text).replace(/\s+/g, ' ').trim().slice(0, 80) || 'New conversation',
          })
          .eq('id', conversationId)
          .eq('title', 'New conversation');
      } else {
        await admin
          .from('bonnie_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId);
      }
    }

    return NextResponse.json({ success: true, conversationId });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to save conversation');
  }
}
