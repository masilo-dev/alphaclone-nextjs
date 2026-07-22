import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';

type Context = { params: Promise<{ tenantId: string }> };
const adminRoles = ['owner', 'admin', 'tenant_admin', 'super_admin'];
const integrationIdSchema = z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/);

export async function GET(req: NextRequest, context: Context) {
  try {
    const { tenantId } = await context.params;
    const { user, admin } = await requireTenantAccess(tenantId, req);
    const [{ data: rows, error }, mcpKeys, chatgptTokens, slack] = await Promise.all([
      admin
        .from('tenant_integrations')
        .select('integration_id, status, connected_at, configured_by, metadata')
        .eq('tenant_id', tenantId),
      admin
        .from('mcp_api_keys')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('is_active', true),
      admin
        .from('mcp_oauth_tokens')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('client_id', 'chatgpt-connector'),
      admin
        .from('slack_integrations')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .maybeSingle(),
    ]);
    if (error) throw error;
    if (mcpKeys.error) throw mcpKeys.error;
    if (chatgptTokens.error) throw chatgptTokens.error;
    if (slack.error) throw slack.error;

    const safeRows = (rows || []).map((row: any) => ({
      integrationId: String(row.integration_id),
      status: row.status === 'connected' ? 'connected' : 'available',
      connectedAt: row.connected_at,
      configuredBy: row.configured_by,
      metadata: {},
    }));

    return NextResponse.json({
      integrations: safeRows,
      personalConnections: {
        mcpApiKey: (mcpKeys.count || 0) > 0,
        chatgpt: (chatgptTokens.count || 0) > 0,
      },
      providerConnections: { slack: Boolean(slack.data?.id) },
    });
  } catch (error) {
    return routeErrorResponse(error, 'Integrations could not be loaded', req);
  }
}

export async function DELETE(req: NextRequest, context: Context) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantRole(tenantId, adminRoles, req);
    const { integrationId } = z.object({ integrationId: integrationIdSchema }).parse(await req.json());
    const admin = createSupabaseAdminClient();

    const { data: connection, error: connectionError } = await admin
      .from('tenant_integrations')
      .select('configured_by')
      .eq('tenant_id', tenantId)
      .eq('integration_id', integrationId)
      .maybeSingle();
    if (connectionError) throw connectionError;

    const configuredBy = connection?.configured_by ? String(connection.configured_by) : null;
    if (integrationId === 'claude-mcp' || integrationId === 'manus-mcp') {
      await admin.from('mcp_api_keys').delete().eq('tenant_id', tenantId).eq('user_id', user.id);
    } else if (integrationId === 'chatgpt-mcp') {
      await admin.from('mcp_oauth_tokens').delete().eq('tenant_id', tenantId).eq('user_id', user.id).eq('client_id', 'chatgpt-connector');
    } else if (integrationId === 'slack') {
      await admin.from('slack_integrations').update({ is_active: false, updated_at: new Date().toISOString() }).eq('tenant_id', tenantId);
    } else if (integrationId === 'facebook-leads') {
      await admin.from('facebook_integrations').update({ is_active: false }).eq('tenant_id', tenantId);
    } else if (integrationId === 'hubspot' && configuredBy) {
      await admin.from('integrations').update({ enabled: false }).eq('tenant_id', tenantId).eq('user_id', configuredBy).eq('type', 'hubspot');
      await admin.from('hubspot_integration_secrets').delete().eq('tenant_id', tenantId).eq('user_id', configuredBy);
    } else if (integrationId === 'google-calendar' && configuredBy) {
      await admin.from('google_calendar_tokens').delete().eq('user_id', configuredBy).eq('tenant_id', tenantId);
      await admin.from('google_calendar_secrets').delete().eq('user_id', configuredBy).eq('tenant_id', tenantId);
    }

    const { error } = await admin.from('tenant_integrations').upsert({
      tenant_id: tenantId,
      integration_id: integrationId,
      status: 'available',
      connected_at: null,
      configured_by: null,
      metadata: {},
    }, { onConflict: 'tenant_id,integration_id' });
    if (error) throw error;

    await admin.from('business_automation_events').insert({
      tenant_id: tenantId,
      event_type: 'integration_disconnected',
      payload: { integrationId, actorUserId: user.id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, 'Integration could not be disconnected', req);
  }
}
