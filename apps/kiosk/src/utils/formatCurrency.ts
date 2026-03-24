/**
 * Format a price in cents to a dollar string (e.g. 1099 -> "$10.99").
 * Handles negative values (e.g. -200 -> "-$2.00").
 */
export function formatCurrency(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absCents = Math.abs(cents);
  const dollars = Math.floor(absCents / 100);
  const remainder = absCents % 100;
  return `${sign}$${dollars}.${String(remainder).padStart(2, '0')}`;
}
