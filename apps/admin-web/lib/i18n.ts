import type { Json } from '@/lib/types';

/**
 * Menu content is stored as bilingual JSONB ({ es, en }) since
 * 003_i18n_jsonb.sql. The console is Spanish, so `es` wins and `en` is the
 * fallback — but rows predating that migration, or written by an older client,
 * can still be a bare string, so handle both shapes.
 */
export function tr(value: Json | null | undefined, locale: 'es' | 'en' = 'es'): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;

  if (typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, Json | undefined>;
    const primary = record[locale];
    if (typeof primary === 'string' && primary.trim()) return primary;

    const fallback = record[locale === 'es' ? 'en' : 'es'];
    if (typeof fallback === 'string') return fallback;
  }

  return '';
}

/**
 * Renders an order line's `item_name`.
 *
 * item_name is a plain-text display snapshot taken when the line was sold, so
 * normally this is a passthrough. But the legacy kiosk insert path used to write
 * the raw bilingual object into it, producing values like
 * `{"en":"BBQ Bacon","es":"Bacon Barbacoa"}`. Migration 038 repaired the rows
 * that existed and the writer is gone (create-web-order localises first), so
 * this is belt-and-braces: if such a value ever appears again it degrades to a
 * readable name instead of showing JSON to an operator or a customer.
 */
export function displayItemName(raw: string | null | undefined): string {
  const value = (raw ?? '').trim();
  if (!value.startsWith('{')) return value;

  try {
    return tr(JSON.parse(value)) || value;
  } catch {
    return value;
  }
}
