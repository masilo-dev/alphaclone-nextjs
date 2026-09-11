import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { hasCountryCode, normalizePhoneForStorage } from '@/lib/phone/leadPhone';

export type FetchLeadsParams = {
  tenantId: string;
  status?: string;
  stage?: string;
  source?: string;
  assignedTo?: string;
  limit?: number;
  offset?: number;
  cursor?: string;
  sortBy?: string;
  sortOrder?: string;
  fields?: string;
  excludeConverted?: boolean;
};

export type FetchLeadsResult = {
  items: Array<Record<string, unknown>>;
  pagination: {
    limit: number;
    offset: number;
    cursor: string;
    returned: number;
    total_count: number | null;
    has_more: boolean;
    next_offset: number | null;
    next_cursor: string | null;
    truncation_warning?: string;
  };
  contacts_missing_country_code_count: number;
};

const DEFAULT_SELECT =
  'id, business_name, email, phone, industry, location, status, stage, source, owner_id, notes, created_at, updated_at, value';

const SORTABLE = new Set(['created_at', 'status', 'stage', 'business_name', 'updated_at']);

function decodeCursor(cursor?: string): number {
  if (!cursor?.trim()) return 0;
  const decoded = Number(Buffer.from(cursor, 'base64').toString('utf8'));
  return Number.isFinite(decoded) && decoded >= 0 ? decoded : 0;
}

function encodeCursor(offset: number): string {
  return Buffer.from(String(offset)).toString('base64');
}

function isSchemaOrRelationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string };
  return (
    e.code === '42703' ||
    e.code === '42P01' ||
    Boolean(e.message?.includes('does not exist')) ||
    Boolean(e.message?.includes('schema cache'))
  );
}

export async function fetchLeadsPaginated(
  params: FetchLeadsParams,
  client?: SupabaseClient
): Promise<FetchLeadsResult> {
  const supabase = client || createSupabaseAdminClient();
  const pageSize = Math.min(Math.max(Number(params.limit) || 20, 1), 100);
  const pageOffset = Math.max(Number(params.offset) || decodeCursor(params.cursor) || 0, 0);
  const orderBy = SORTABLE.has(String(params.sortBy || '')) ? String(params.sortBy) : 'created_at';
  const asc = String(params.sortOrder || 'desc').toLowerCase() === 'asc';
  const selectable =
    typeof params.fields === 'string' && params.fields.trim()
      ? params.fields.split(',').map((f) => f.trim()).filter(Boolean).join(', ')
      : DEFAULT_SELECT;

  const applyFilters = (baseQuery: ReturnType<typeof supabase.from>) => {
    let q = baseQuery.eq('tenant_id', params.tenantId);
    if (params.status) q = q.eq('status', params.status);
    if (params.stage) q = q.eq('stage', params.stage);
    if (params.source) q = q.ilike('source', `%${String(params.source).trim()}%`);
    if (params.assignedTo) q = q.eq('owner_id', String(params.assignedTo).trim());
    if (params.excludeConverted !== false) {
      q = q.not('stage', 'in', '("converted","closed_lost")');
    }
    return q;
  };

  const countQuery = applyFilters(
    supabase.from('leads').select('id', { count: 'exact', head: true })
  );
  const { count: totalCount, error: countError } = await countQuery;

  let dataQuery = applyFilters(supabase.from('leads').select(selectable))
    .order(orderBy, { ascending: asc })
    .range(pageOffset, pageOffset + pageSize - 1);

  let { data, error } = await dataQuery;

  if (error && isSchemaOrRelationError(error)) {
    let legacy = supabase
      .from('leads')
      .select('id, business_name, email, phone, stage, notes, created_at')
      .eq('tenant_id', params.tenantId)
      .order('created_at', { ascending: false })
      .range(pageOffset, pageOffset + pageSize - 1);
    if (params.stage) legacy = legacy.eq('stage', params.stage);
    ({ data, error } = await legacy);
  }

  if (error) {
    throw new Error(error.message || 'Failed to fetch leads');
  }

  const rows = (Array.isArray(data) ? data : []).map((row: Record<string, unknown>) => {
    const phone = row.phone;
    const normalizedPhone = normalizePhoneForStorage(phone);
    return {
      ...row,
      phone: normalizedPhone || phone || null,
      phone_has_country_code: hasCountryCode(normalizedPhone || phone),
    };
  });

  const missingCountryCode = rows.filter((row) => !row.phone_has_country_code && row.phone).length;
  const total = typeof totalCount === 'number' ? totalCount : null;
  const hasMore =
    total !== null ? pageOffset + rows.length < total : rows.length === pageSize;

  let truncationWarning: string | undefined;
  if (
    rows.length === 8 &&
    hasMore &&
    pageSize > 8 &&
    (total === null || total > 8)
  ) {
    truncationWarning =
      'Suspicious 8-record cap detected — use next_cursor to paginate or report if total_count does not match expectations.';
  }

  return {
    items: rows,
    pagination: {
      limit: pageSize,
      offset: pageOffset,
      cursor: encodeCursor(pageOffset),
      returned: rows.length,
      total_count: total,
      has_more: hasMore,
      next_offset: hasMore ? pageOffset + pageSize : null,
      next_cursor: hasMore ? encodeCursor(pageOffset + pageSize) : null,
      ...(truncationWarning ? { truncation_warning: truncationWarning } : {}),
      ...(countError ? { count_error: countError.message } : {}),
    },
    contacts_missing_country_code_count: missingCountryCode,
  };
}
