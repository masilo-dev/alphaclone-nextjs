import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';

type RouteContext = { params: Promise<{ id: string }> };

async function requireOwnedConversation(tenantId: string, conversationId: string) {
  await requireTenantAccess(tenantId);
  const supabase = await createSupabaseServerClient();
  const { data: authUser } = await supabase.auth.getUser();
  const userId = authUser.user?.id;
  if (!userId) {
    return { error: NextResponse.json({ error: 'Unauthenticated' }, { status: 401 }) };
  }
  const admin = createSupabaseAdminClient();
  const { data: conversation } = await admin
    .from('bonnie_conversations')
    .select('id, title, module, pinned, archived_at, metadata, created_at, updated_at')
    .eq('id', conversationId)
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!conversation) {
    return { error: NextResponse.json({ error: 'Conversation not found' }, { status: 404 }) };
  }
  return { userId, admin, conversation };
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const tenantId = String(new URL(request.url).searchParams.get('tenantId') || '').trim();
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }
    const owned = await requireOwnedConversation(tenantId, id);
    if ('error' in owned && owned.error) return owned.error;

    return NextResponse.json({
      success: true,
      conversation: {
        id: owned.conversation!.id,
        title: owned.conversation!.title,
        module: owned.conversation!.module,
        pinned: Boolean(owned.conversation!.pinned),
        archived: Boolean(owned.conversation!.archived_at),
        archivedAt: owned.conversation!.archived_at,
        metadata: owned.conversation!.metadata || {},
        createdAt: owned.conversation!.created_at,
        updatedAt: owned.conversation!.updated_at,
      },
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load conversation');
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const tenantId = String(body.tenantId || '').trim();
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const owned = await requireOwnedConversation(tenantId, id);
    if ('error' in owned && owned.error) return owned.error;

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof body.title === 'string') {
      patch.title = body.title.trim().slice(0, 120) || 'New conversation';
    }
    if (typeof body.pinned === 'boolean') {
      patch.pinned = body.pinned;
    }
    if (body.archive === true) {
      patch.archived_at = new Date().toISOString();
    }
    if (body.archive === false) {
      patch.archived_at = null;
    }
    if (body.metadata && typeof body.metadata === 'object') {
      patch.metadata = { ...(owned.conversation!.metadata || {}), ...body.metadata };
    }
    if (typeof body.module === 'string' || body.module === null) {
      patch.module = body.module;
    }

    const { data, error } = await owned.admin!
      .from('bonnie_conversations')
      .update(patch)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('user_id', owned.userId!)
      .select('id, title, module, pinned, archived_at, metadata, created_at, updated_at')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      conversation: {
        id: data.id,
        title: data.title,
        module: data.module,
        pinned: Boolean(data.pinned),
        archived: Boolean(data.archived_at),
        archivedAt: data.archived_at,
        metadata: data.metadata || {},
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to update conversation');
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    let tenantId = String(new URL(request.url).searchParams.get('tenantId') || '').trim();
    if (!tenantId) {
      try {
        const body = await request.json();
        tenantId = String(body?.tenantId || '').trim();
      } catch {
        tenantId = '';
      }
    }
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const owned = await requireOwnedConversation(tenantId, id);
    if ('error' in owned && owned.error) return owned.error;

    const { error } = await owned.admin!
      .from('bonnie_conversations')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('user_id', owned.userId!);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to delete conversation');
  }
}
