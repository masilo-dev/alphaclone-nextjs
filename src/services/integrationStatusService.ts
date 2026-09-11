import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  CORE_INTEGRATIONS_FOR_HEALTH,
  hasBookingIntegration,
  normalizeIntegrationType,
  OPTIONAL_INTEGRATIONS_FOR_HEALTH,
} from '@/lib/mcp/integrationHealthPolicy';

export type IntegrationConnectionStatus = 'connected' | 'configured' | 'missing' | 'error';

export type IntegrationStatusRow = {
  key: string;
  tier: 'core' | 'optional';
  status: IntegrationConnectionStatus;
  connected: boolean;
  details?: Record<string, unknown>;
};

export type TenantIntegrationSnapshot = {
  overall: {
    status: 'ready' | 'degraded' | 'needs_setup';
    core_connected: number;
    core_total: number;
    core_percentage: number;
    optional_connected: number;
    optional_total: number;
    booking_ready: boolean;
    note: string;
  };
  core_integrations: IntegrationStatusRow[];
  optional_integrations: IntegrationStatusRow[];
  connected_types: string[];
  tenant_integration_rows: Array<Record<string, unknown>>;
  generated_at: string;
};

function envPresent(...keys: string[]): boolean {
  return keys.some((k) => Boolean(process.env[k] && String(process.env[k]).trim()));
}

/**
 * Authoritative integration status for MCP tools, platform status, and dashboard checks.
 */
export async function getTenantIntegrationSnapshot(
  tenantId: string
): Promise<TenantIntegrationSnapshot> {
  const supabase = createSupabaseAdminClient();
  const { data: rows } = await supabase
    .from('integrations')
    .select('type, enabled, updated_at, metadata')
    .eq('tenant_id', tenantId)
    .limit(200);

  const connectedTypes = new Set(
    (rows || [])
      .filter((r: { enabled?: boolean | null }) => r.enabled !== false)
      .map((r: { type?: string | null }) => normalizeIntegrationType(String(r.type || '')))
  );

  const [{ data: gmailRows }, { data: calendlyRows }] = await Promise.all([
    supabase
      .from('gmail_integrations')
      .select('id, email, is_active')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .limit(5),
    (async () => {
      try {
        return await supabase
          .from('calendly_integrations')
          .select('id, is_active')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .limit(5);
      } catch {
        return { data: null };
      }
    })(),
  ]);

  if ((gmailRows || []).length > 0) {
    connectedTypes.add('gmail');
    connectedTypes.add('google_gmail');
  }
  if ((calendlyRows || []).length > 0) {
    connectedTypes.add('calendly');
  }

  const coreChecks: IntegrationStatusRow[] = CORE_INTEGRATIONS_FOR_HEALTH.map((key) => {
    let connected = connectedTypes.has(key);
    if (key === 'stripe') connected = connected || envPresent('STRIPE_SECRET_KEY');
    if (key === 'railway') {
      connected =
        connected ||
        Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
    }
    if (key === 'supabase') connected = connected || envPresent('SUPABASE_SERVICE_ROLE_KEY');
    if (key === 'openai') connected = connected || envPresent('OPENAI_API_KEY');
    if (key === 'deepseek') {
      connected = connected || envPresent('DEEPSEEK_API_KEY', 'OPENROUTER_API_KEY');
    }
    return {
      key,
      tier: 'core',
      status: connected ? 'connected' : 'missing',
      connected,
    };
  });

  const optionalChecks: IntegrationStatusRow[] = OPTIONAL_INTEGRATIONS_FOR_HEALTH.map((key) => {
    let connected = connectedTypes.has(key);
    if (key === 'github') connected = connected || envPresent('GITHUB_TOKEN', 'GITHUB_APP_ID');
    if (key === 'gmail') {
      connected =
        connected ||
        connectedTypes.has('google_gmail') ||
        (gmailRows || []).length > 0;
    }
    if (key === 'calcom') {
      connected =
        connected ||
        connectedTypes.has('cal_com') ||
        envPresent('CAL_OAUTH_CLIENT_ID');
    }
    if (key === 'calendly') {
      connected = connected || (calendlyRows || []).length > 0;
    }
    return {
      key,
      tier: 'optional',
      status: connected ? 'connected' : 'missing',
      connected,
    };
  });

  const coreConnected = coreChecks.filter((c) => c.connected).length;
  const optionalConnected = optionalChecks.filter((c) => c.connected).length;

  return {
    overall: {
      status:
        coreConnected === coreChecks.length
          ? 'ready'
          : coreConnected >= Math.ceil(coreChecks.length * 0.7)
            ? 'degraded'
            : 'needs_setup',
      core_connected: coreConnected,
      core_total: coreChecks.length,
      core_percentage: Math.round((coreConnected / coreChecks.length) * 100),
      optional_connected: optionalConnected,
      optional_total: optionalChecks.length,
      booking_ready: hasBookingIntegration(connectedTypes),
      note: 'Gmail, GitHub, Cal.com, and Calendly are optional and do not reduce core readiness.',
    },
    core_integrations: coreChecks,
    optional_integrations: optionalChecks,
    connected_types: Array.from(connectedTypes).sort(),
    tenant_integration_rows: (rows || []) as Array<Record<string, unknown>>,
    generated_at: new Date().toISOString(),
  };
}

/** Map tool names to required integration keys for availability metadata (tools stay visible). */
export function integrationDependencyForTool(toolName: string): string | null {
  const name = toolName.toLowerCase();
  if (/gmail|google_mail/.test(name)) return 'gmail';
  if (/google_calendar|calendar/.test(name)) return 'google_calendar';
  if (/linkedin/.test(name)) return 'linkedin';
  if (/facebook/.test(name)) return 'facebook';
  if (/instagram/.test(name)) return 'instagram';
  if (/\bx_|twitter/.test(name)) return 'x';
  if (/stripe|payment/.test(name)) return 'stripe';
  if (/zoho/.test(name)) return 'zoho';
  if (/calendly|calcom|booking|appointment/.test(name)) return 'booking';
  if (/send_email|reply_to_email|email/.test(name)) return 'email_provider';
  if (/publish_social|social_post|schedule_post/.test(name)) return 'social';
  return null;
}

export function integrationAvailable(
  snapshot: TenantIntegrationSnapshot,
  dependency: string | null
): { available: boolean; reason: string | null } {
  if (!dependency) return { available: true, reason: null };
  if (dependency === 'booking') {
    return {
      available: snapshot.overall.booking_ready,
      reason: snapshot.overall.booking_ready
        ? null
        : 'Connect Cal.com or Calendly to use booking tools.',
    };
  }
  if (dependency === 'email_provider') {
    const emailReady =
      snapshot.connected_types.some((t) =>
        ['gmail', 'google_gmail', 'zoho', 'brevo', 'sendgrid', 'resend', 'smtp'].includes(t)
      ) || envPresent('SMTP_HOST', 'BREVO_API_KEY', 'SENDGRID_API_KEY', 'RESEND_API_KEY');
    return {
      available: emailReady,
      reason: emailReady ? null : 'Connect an email provider (Gmail, Zoho, Brevo, etc.).',
    };
  }
  if (dependency === 'social') {
    const socialReady = snapshot.connected_types.some((t) =>
      ['facebook', 'linkedin', 'instagram', 'x', 'twitter'].includes(t)
    );
    return {
      available: socialReady,
      reason: socialReady ? null : 'Connect a social account (Facebook, LinkedIn, Instagram, or X).',
    };
  }
  const connected =
    snapshot.connected_types.includes(dependency) ||
    snapshot.core_integrations.some((i) => i.key === dependency && i.connected) ||
    snapshot.optional_integrations.some((i) => i.key === dependency && i.connected);
  return {
    available: connected,
    reason: connected ? null : `Integration "${dependency}" is not connected for this workspace.`,
  };
}
