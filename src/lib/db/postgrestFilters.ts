/**
 * Safe PostgREST filter builders for ilike/or queries.
 * Unquoted values break when search text contains commas, quotes, or parentheses.
 */

/** Escape PostgreSQL ILIKE wildcards in user-provided search text. */
export function escapeIlikePattern(raw: string): string {
  return String(raw || '')
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/** Quote a PostgREST filter value (required when value contains commas). */
export function quotePostgrestFilterValue(value: string): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

/** Build `col.ilike."%term%",other.ilike."%term%"` for `.or()`. */
export function buildIlikeOrFilter(columns: string[], search: string): string {
  const trimmed = String(search || '').trim();
  if (!trimmed || !columns.length) return '';
  const pattern = `%${escapeIlikePattern(trimmed)}%`;
  const quoted = quotePostgrestFilterValue(pattern);
  return columns.map((col) => `${col}.ilike.${quoted}`).join(',');
}
