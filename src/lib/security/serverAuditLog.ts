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
  'page_access_token',
  'user_access_token',
  'authorization',
  'cookie',
  'ssn',
  'bodyhtml',
  'bodytext',
  'rawpayload',
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
  /** When true and AUDIT_REQUIRED=true, failures throw instead of soft-failing. */
  critical?: boolean;
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
 * Insert an audit row with service role.
 * Soft-fails by default (must not break successful requests).
 * When AUDIT_REQUIRED=true and event.critical, failures throw.
 */
export async function writeServerAuditLog(event: ServerAuditEvent): Promise<{ ok: boolean }> {
  const requireAudit =
    event.critical === true &&
    (process.env.AUDIT_REQUIRED === 'true' || process.env.AUDIT_REQUIRED === '1');

  try {
    const admin = getServiceClient();
    if (!admin) {
      console.error('[audit] SERVICE_ROLE unavailable — cannot write audit log', {
        action: event.action,
        request_id: event.requestId,
      });
      if (requireAudit) throw new Error('Audit logging unavailable');
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
      if (requireAudit) throw new Error(`Audit log insert failed: ${error.message}`);
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.error('[audit] unexpected failure', {
      action: event.action,
      request_id: event.requestId,
      error: err instanceof Error ? err.message : 'unknown',
    });
    if (requireAudit) throw err;
    return { ok: false };
  }
}
