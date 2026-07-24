import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';
import { PUBLIC_APP_ORIGIN, PUBLIC_MCP_RESOURCE, validatePublicOriginConfig } from '@/lib/config/public-origin';
import { isRedisConfigured } from '@/lib/redis';
import { denyUnlessInternalApiKey } from '@/lib/security/productionGuard';
import { createProtectedResourceResponse, createAuthorizationServerResponse } from '@/lib/mcpWellKnown';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Protected authentication health / diagnostics endpoint.
 * Returns only safe boolean configuration signals — never secrets or IDs.
 *
 * Auth: Bearer CRON_SECRET or INTERNAL_API_KEY
 */
export async function GET(req: NextRequest) {
  const denied = denyUnlessInternalApiKey(req);
  if (denied) return denied;

  const originCheck = validatePublicOriginConfig();

  let oauthClientRegistered = false;
  let databaseSchemaValid = false;
  let auditLoggingOperational = false;

  try {
    if (ENV.VITE_SUPABASE_URL && ENV.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, {
        global: { headers: { 'X-Client-Info': 'auth-health-check' } },
      });

      const { count } = await admin
        .from('mcp_oauth_clients')
        .select('client_id', { count: 'exact', head: true })
        .eq('is_active', true)
        .limit(1);
      oauthClientRegistered = (count || 0) > 0;

      const probe = await admin
        .from('mcp_oauth_tokens')
        .select('id, revoked, revoked_at, resource, expires_at, user_id, tenant_id, scopes')
        .limit(1);

      if (probe.error?.code === '42703' || probe.error?.message?.toLowerCase().includes('column')) {
        databaseSchemaValid = false;
      } else if (!probe.error || probe.error.code === 'PGRST116') {
        databaseSchemaValid = true;
      } else if (probe.error?.code === 'PGRST204') {
        databaseSchemaValid = false;
      } else {
        // Other errors (network) — treat schema as unknown/false for safety
        databaseSchemaValid = false;
      }

      const auditProbe = await admin.from('audit_logs').select('id').limit(1);
      auditLoggingOperational =
        !auditProbe.error ||
        auditProbe.error.code === 'PGRST116' ||
        Boolean(auditProbe.error.message?.includes('0 rows'));
    }
  } catch {
    databaseSchemaValid = false;
  }

  let mcpMetadataValid = false;
  try {
    const resourceBody = await createProtectedResourceResponse(req).json();
    const asBody = await createAuthorizationServerResponse(req).json();
    mcpMetadataValid =
      resourceBody?.resource === PUBLIC_MCP_RESOURCE &&
      asBody?.issuer === PUBLIC_APP_ORIGIN &&
      !String(resourceBody?.resource || '').includes('0.0.0.0') &&
      !String(asBody?.issuer || '').includes('localhost');
  } catch {
    mcpMetadataValid = false;
  }

  const body = {
    publicOriginConfigured: originCheck.ok && PUBLIC_APP_ORIGIN.startsWith('https://'),
    publicOriginIsApex: !PUBLIC_APP_ORIGIN.includes('://www.'),
    mcpResourceConfigured:
      originCheck.ok &&
      PUBLIC_MCP_RESOURCE.startsWith('https://') &&
      !PUBLIC_MCP_RESOURCE.includes('0.0.0.0'),
    oauthClientRegistered,
    databaseSchemaValid,
    redisConfigured: isRedisConfigured(),
    auditLoggingOperational,
    mcpMetadataValid,
  };

  const allOk = Object.values(body).every(Boolean);

  return NextResponse.json(body, {
    status: allOk ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
