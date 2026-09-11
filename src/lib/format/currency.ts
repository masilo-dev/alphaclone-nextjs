/**
 * Platform-wide currency formatting. Use this everywhere money is displayed
 * (P&L, revenue summary, pipeline value, invoice totals) so formatting never drifts.
 */
export function formatCurrency(
  value: number | null | undefined,
  currency = 'USD',
  options?: { compact?: boolean }
): string {
  const amount = Number(value) || 0;
  if (options?.compact && Math.abs(amount) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}
