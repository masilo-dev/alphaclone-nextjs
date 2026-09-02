import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value));
}

/**
 * Resolve a non-null user_id for mcp_sessions inserts.
 * Production enforces NOT NULL on user_id — system/tool telemetry must use tenant owner
 * or MCP_SYSTEM_USER_ID rather than inserting NULL.
 */
export async function resolveMcpSessionUserId(params: {
  tenantId: string;
  userId?: string | null;
}): Promise<string | null> {
  if (isValidUuid(params.userId)) {
    return params.userId;
  }

  const envSystemUser = process.env.MCP_SYSTEM_USER_ID?.trim();
  if (isValidUuid(envSystemUser)) {
    return envSystemUser;
  }

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('tenant_users')
    .select('user_id, role')
    .eq('tenant_id', params.tenantId)
    .in('role', ['owner', 'admin'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (isValidUuid(data?.user_id)) {
    return data.user_id;
  }

  const { data: anyMember } = await admin
    .from('tenant_users')
    .select('user_id')
    .eq('tenant_id', params.tenantId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return isValidUuid(anyMember?.user_id) ? anyMember.user_id : null;
}
