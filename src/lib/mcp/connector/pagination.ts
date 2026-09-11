import type { PaginationInput, PaginationMeta } from './types';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export function normalizePagination(input: PaginationInput = {}): {
  limit: number;
  offset: number;
  cursor: string | null;
} {
  const limit = Math.min(
    Math.max(Number.isFinite(input.limit as number) ? Number(input.limit) : DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );
  const offset = Math.max(
    Number.isFinite(input.offset as number) ? Number(input.offset) : 0,
    0
  );
  const cursor =
    typeof input.cursor === 'string' && input.cursor.trim() ? input.cursor.trim() : null;
  return { limit, offset, cursor };
}

export function buildPaginationMeta(params: {
  limit: number;
  offset: number;
  returned: number;
  total?: number | null;
  nextCursor?: string | null;
}): PaginationMeta {
  const total = params.total ?? null;
  const hasMore =
    params.nextCursor != null
      ? true
      : total != null
        ? params.offset + params.returned < total
        : params.returned >= params.limit;

  return {
    limit: params.limit,
    offset: params.offset,
    total,
    has_more: hasMore,
    next_offset: hasMore ? params.offset + params.returned : null,
    next_cursor: params.nextCursor ?? null,
  };
}
