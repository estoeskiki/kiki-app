// Prices are stored in cents everywhere in KIKI (same as kiosk/admin).
export function formatCurrency(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('es-PA', { style: 'currency', currency }).format(cents / 100);
}

export function localize(value: { es: string; en: string } | string | null | undefined, locale: 'es' | 'en' = 'es'): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[locale] || value.es || value.en || '';
}
