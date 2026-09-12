import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const CANONICAL_MEDIA_ASSET_COLUMNS = [
  'id', 'tenant_id', 'user_id', 'file_name', 'file_type', 'asset_type',
  'storage_provider', 'storage_path', 'public_url', 'thumbnail_url',
  'file_size_bytes', 'checksum_sha256', 'width', 'height', 'status',
  'failure_code', 'failure_message', 'metadata', 'created_at', 'updated_at',
] as const;

/**
 * Turns a partial migration into a clear, actionable error instead of allowing
 * a PostgREST "column does not exist" error to leak from a media workflow.
 */
export async function assertCanonicalMediaAssetsSchema(): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('assert_media_assets_schema');
  if (error) {
    throw new Error(`MEDIA_SCHEMA_MISMATCH: media_assets schema validation failed (${error.message})`);
  }
  const missing = (data || [])
    .map((row: { missing_column?: string }) => row.missing_column)
    .filter((column: string | undefined): column is string => Boolean(column));
  if (missing.length) {
    throw new Error(`MEDIA_SCHEMA_MISMATCH: missing media_assets columns: ${missing.join(', ')}`);
  }
}
