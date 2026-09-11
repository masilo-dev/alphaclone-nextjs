export function addUtcDays(day: string, days: number): string {
  const d = new Date(`${day.slice(0, 10)}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Filter a date/timestamptz column for one calendar day.
 * `.eq('due_date', '2026-09-07')` misses `2026-09-07T14:00:00Z` rows.
 */
export function applyDueOnDay<T extends { gte: (column: string, value: string) => T; lt: (column: string, value: string) => T }>(
  query: T,
  column: string,
  day: string,
): T {
  return query.gte(column, day).lt(column, addUtcDays(day, 1));
}
