/**
 * Server-only audit logging via service-role client.
 * Preserves RLS for browser clients; trusted server paths use this helper.
 * Never logs tokens, secrets, or full credential-bearing bodies.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';

const SENSITIVE_KEYS = new Set([
  'access_token',
  'refresh_token',
  'authorization_code',
  'code',
  'code_verifier',
  'client_secret',
  'password',
  'api_key',
  'token',
  'secret',
]);

export type ServerAuditEvent = {
  tenantId?: string | null;
  actorUserId?: string | null;
  actorType?: 'user' | 'system' | 'mcp' | 'cron' | 'oauth';
  action: string;
  resourceType?: string;
  resourceId?: string;
  requestId?: string;
  success?: boolean;
  errorCode?: string;
  metadata?: Record<string, unknown>;
  ipHash?: string;
  userAgent?: string;
};

function getServiceClient(): SupabaseClient | null {
  if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { 'X-Client-Info': 'server-audit-logger' } },
  });
}

function redactMetadata(meta: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!meta) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase()) || /token|secret|password|verifier/i.test(key)) {
      out[key] = '[redacted]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = redactMetadata(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Insert an audit row with service role. Failures are logged as operational alerts
 * and do not throw (must not break successful requests).
 */
export async function writeServerAuditLog(event: ServerAuditEvent): Promise<{ ok: boolean }> {
  try {
    const admin = getServiceClient();
    if (!admin) {
      console.error('[audit] SERVICE_ROLE unavailable — cannot write audit log', {
        action: event.action,
        request_id: event.requestId,
      });
      return { ok: false };
    }

    const row = {
      tenant_id: event.tenantId || null,
      user_id: event.actorUserId || null,
      actor_type: event.actorType || 'system',
      action: event.action,
      resource_type: event.resourceType || null,
      resource_id: event.resourceId || null,
      request_id: event.requestId || null,
      success: event.success ?? true,
      error_code: event.errorCode || null,
      metadata: redactMetadata(event.metadata),
      ip_hash: event.ipHash || null,
      user_agent: event.userAgent || null,
      created_at: new Date().toISOString(),
    };

    const { error } = await admin.from('audit_logs').insert(row);
    if (error) {
      console.error('[audit] insert failed (RLS or schema) — operational alert', {
        action: event.action,
        request_id: event.requestId,
        code: error.code,
        message: error.message,
      });
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.error('[audit] unexpected failure', {
      action: event.action,
      request_id: event.requestId,
      error: err instanceof Error ? err.message : 'unknown',
    });
    return { ok: false };
  }
}
