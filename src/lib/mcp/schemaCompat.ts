/** Postgres / PostgREST missing-column compatibility helpers. */

export function isMissingColumnError(
  error: { code?: string; message?: string } | null | undefined
): boolean {
  if (!error) return false;
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    /column.*does not exist/i.test(error.message || '') ||
    /could not find the .* column/i.test(error.message || '')
  );
}

type SupabaseUpdateClient = {
  from: (table: string) => {
    update: (payload: Record<string, unknown>) => {
      eq: (col: string, val: string) => {
        eq: (col2: string, val2: string) => {
          select: (cols: string) => {
            single: () => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
          };
        };
      };
    };
  };
};

/**
 * Update a row, retrying without `updated_at` when the column is absent in schema cache.
 */
export async function updateWithOptionalTimestamp<T = unknown>(params: {
  supabase: unknown;
  table: string;
  tenantId: string;
  entityId: string;
  payload: Record<string, unknown>;
  select?: string;
}): Promise<{ data: T | null; error: { code?: string; message?: string } | null }> {
  const client = params.supabase as SupabaseUpdateClient;
  const select = params.select || 'id';
  const stamp = new Date().toISOString();
  let { data, error } = await client
    .from(params.table)
    .update({ ...params.payload, updated_at: stamp })
    .eq('tenant_id', params.tenantId)
    .eq('id', params.entityId)
    .select(select)
    .single();

  if (error && isMissingColumnError(error)) {
    ({ data, error } = await client
      .from(params.table)
      .update(params.payload)
      .eq('tenant_id', params.tenantId)
      .eq('id', params.entityId)
      .select(select)
      .single());
  }

  return { data: data as T | null, error };
}
