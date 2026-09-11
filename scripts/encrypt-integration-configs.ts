#!/usr/bin/env tsx

import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';
import {
  encryptIntegrationConfig,
  isEncryptedToken,
  requireIntegrationEncryptionSecret,
} from '../src/lib/integration/integrationTokenCrypto';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), false, console);

const SECRET_KEYS = new Set([
  'accessToken',
  'refreshToken',
  'access_token',
  'refresh_token',
  'apiKey',
  'api_key',
  'secret_key',
  'secretKey',
  'smtpPass',
  'imapPass',
  'appPassword',
  'webhookToken',
  'password',
  'botAccessToken',
  'pageAccessToken',
  'token',
  'clientSecret',
]);

const dryRun = process.argv.includes('--dry-run');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

requireIntegrationEncryptionSecret();

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function plaintextSecretKeys(config: Record<string, unknown>): string[] {
  return Object.entries(config)
    .filter(([key, value]) => {
      return (
        SECRET_KEYS.has(key) &&
        typeof value === 'string' &&
        value.length > 0 &&
        !isEncryptedToken(value)
      );
    })
    .map(([key]) => key);
}

async function main() {
  const { data, error } = await supabase
    .from('integrations')
    .select('id, tenant_id, type, config')
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);

  let scanned = 0;
  let updated = 0;
  const candidates: Array<{ id: string; type: string; keys: string[] }> = [];

  for (const row of data || []) {
    scanned += 1;
    const config = (row.config || {}) as Record<string, unknown>;
    const keys = plaintextSecretKeys(config);
    if (keys.length === 0) continue;

    candidates.push({ id: row.id, type: row.type, keys });
    if (dryRun) continue;

    const encryptedConfig = await encryptIntegrationConfig(config);
    const { error: updateError } = await supabase
      .from('integrations')
      .update({ config: encryptedConfig, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (updateError) throw new Error(`Failed to update integration ${row.id}: ${updateError.message}`);
    updated += 1;
  }

  console.log(
    JSON.stringify(
      {
        dry_run: dryRun,
        scanned,
        plaintext_rows_found: candidates.length,
        updated,
        candidates,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
