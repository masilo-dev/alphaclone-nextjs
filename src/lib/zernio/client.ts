import Zernio from '@zernio/node';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

let zernioClient: Zernio | null = null;

export function getZernioClient() {
  if (zernioClient) return zernioClient;
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) {
    throw new Error('ZERNIO_API_KEY is not defined in environment variables');
  }
  zernioClient = new Zernio({ apiKey });
  return zernioClient;
}

export interface TenantZernioSettings {
  instagramAccountId?: string;
  linkedinOrgAccountId?: string;
  whatsappAccountId?: string;
  accountId?: string; // fallback
}

export async function getTenantZernioSettings(tenantId: string): Promise<TenantZernioSettings | null> {
  const supabase = createSupabaseAdminClient();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .maybeSingle();

  if (!tenant || !tenant.settings) return null;
  return (tenant.settings as any).zernio || null;
}

export class ZernioApiError extends Error {
  constructor(message: string, public statusCode?: number, public code?: string) {
    super(message);
    this.name = 'ZernioApiError';
  }
}

export class RateLimitError extends ZernioApiError {
  constructor(message: string) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

export class ValidationError extends ZernioApiError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export function handleZernioError(error: any): never {
  console.error('[Zernio Error]', error);
  const status = error?.status || error?.statusCode;
  const message = error?.message || 'Unknown Zernio API error';
  const code = error?.code;

  if (status === 429) {
    throw new RateLimitError(message);
  }
  if (status === 400) {
    throw new ValidationError(message);
  }
  throw new ZernioApiError(message, status, code);
}

