import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

type CheckStatus = 'healthy' | 'degraded' | 'unhealthy' | 'skipped';

type WorkspaceCheck = {
  status: CheckStatus;
  message?: string;
  details?: Record<string, unknown>;
};

const REQUIRED_TABLES = [
  'tenants',
  'tenant_users',
  'profiles',
  'leads',
  'lead_activities',
  'lead_candidates',
  'lead_search_jobs',
  'business_clients',
  'contacts',
  'companies',
  'deals',
  'business_invoices',
  'invoice_line_items',
  'invoice_views',
  'invoice_audit_log',
  'invoice_delivery_log',
  'invoice_reminders',
  'business_receipts',
  'journal_entries',
  'journal_entry_lines',
  'tasks',
  'projects',
  'project_comments',
  'documents',
  'doc_os_documents',
  'doc_os_versions',
  'doc_os_events',
  'document_requirements',
  'document_data_rooms',
  'messages',
  'unified_messages',
  'email_provider_accounts',
  'email_sender_identities',
  'email_campaigns',
  'campaign_recipients',
  'email_webhook_events',
  'notifications',
  'whatsapp_messages',
  'social_posts',
  'social_identities',
  'linkedin_integrations',
  'facebook_integrations',
  'webhook_events',
  'webhook_deliveries',
  'automation_tasks',
  'automation_runs',
  'automation_cron_logs',
  'business_automation_events',
  'mcp_event_queue',
  'user_presence',
] as const;

const STORAGE_BUCKETS = ['media', 'documents', 'receipts'] as const;

function configured(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function envStatus(required: string[], optional: string[] = []): WorkspaceCheck {
  const missingRequired = required.filter((key) => !configured(process.env[key]));
  const missingOptional = optional.filter((key) => !configured(process.env[key]));
  return {
    status: missingRequired.length ? 'unhealthy' : missingOptional.length ? 'degraded' : 'healthy',
    details: {
      configured: missingRequired.length === 0,
      optionalConfigured: missingOptional.length === 0,
    },
  };
}

async function checkTable(table: string): Promise<WorkspaceCheck> {
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from(table).select('*', { head: true, count: 'exact' }).limit(1);
    if (error) {
      return {
        status: 'unhealthy',
        message: 'Table is unavailable or blocked',
        details: { code: error.code, table },
      };
    }
    return { status: 'healthy', details: { table } };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Table check failed',
      details: { table },
    };
  }
}

async function checkStorageBuckets(): Promise<WorkspaceCheck> {
  if (!configured(ENV.VITE_SUPABASE_URL) || !configured(ENV.SUPABASE_SERVICE_ROLE_KEY)) {
    return { status: 'skipped', message: 'Supabase service role is not configured' };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.storage.listBuckets();
    if (error) {
      return { status: 'degraded', message: 'Could not list storage buckets', details: { code: error.message } };
    }
    const names = new Set((data || []).map((bucket) => bucket.name));
    const missing = STORAGE_BUCKETS.filter((bucket) => !names.has(bucket));
    return {
      status: missing.length ? 'degraded' : 'healthy',
      details: { expected: STORAGE_BUCKETS, missing },
    };
  } catch (error) {
    return {
      status: 'degraded',
      message: error instanceof Error ? error.message : 'Storage check failed',
    };
  }
}

function aggregateStatus(checks: Record<string, WorkspaceCheck>): CheckStatus {
  const statuses = Object.values(checks).map((check) => check.status);
  if (statuses.includes('unhealthy')) return 'unhealthy';
  if (statuses.includes('degraded')) return 'degraded';
  return 'healthy';
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const includeTables = req.nextUrl.searchParams.get('tables') !== '0';
  const checks: Record<string, WorkspaceCheck> = {
    supabase: envStatus(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'], ['NEXT_PUBLIC_SUPABASE_ANON_KEY']),
    cron: envStatus([], ['CRON_SECRET', 'INTERNAL_API_KEY']),
    linkedin: envStatus(['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'], ['LINKEDIN_REDIRECT_URI']),
    email: envStatus([], ['RESEND_API_KEY', 'SENDGRID_API_KEY', 'ZOHO_CLIENT_ID', 'AZURE_CLIENT_ID']),
    webhooks: envStatus([], ['LEAD_WEBHOOK_SECRET', 'FACEBOOK_APP_SECRET', 'STRIPE_WEBHOOK_SECRET']),
  };

  if (includeTables) {
    const tableEntries = await Promise.all(REQUIRED_TABLES.map(async (table) => [table, await checkTable(table)] as const));
    const missingTables = tableEntries
      .filter(([, check]) => check.status === 'unhealthy')
      .map(([table]) => table);
    checks.database = {
      status: missingTables.length ? 'unhealthy' : 'healthy',
      details: {
        checked: REQUIRED_TABLES,
        missingOrUnavailable: missingTables,
      },
    };
  }

  checks.storage = await checkStorageBuckets();

  const status = aggregateStatus(checks);
  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      responseTimeMs: Date.now() - startedAt,
      checks,
    },
    { status: status === 'unhealthy' ? 503 : 200 }
  );
}
