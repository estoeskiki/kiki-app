/**
 * Formatting and timezone helpers.
 *
 * Everything uses the platform Intl APIs — no date or i18n library ships to the
 * browser. Money is stored as integer cents throughout the schema and is only
 * ever divided at the point of display.
 */

export const DEFAULT_TIMEZONE = 'America/Panama';
export const DEFAULT_CURRENCY = 'USD';
export const LOCALE = 'es-PA';

const currencyFormatters = new Map<string, Intl.NumberFormat>();

/** Integer cents -> "$12.43". Never do this arithmetic anywhere else. */
export function formatMoney(cents: number | null | undefined, currency = DEFAULT_CURRENCY): string {
  const value = (cents ?? 0) / 100;
  let fmt = currencyFormatters.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    });
    currencyFormatters.set(currency, fmt);
  }
  return fmt.format(value);
}

/** Compact money for dense KPI tiles: "$12.4k". */
export function formatMoneyCompact(cents: number | null | undefined, currency = DEFAULT_CURRENCY): string {
  const value = (cents ?? 0) / 100;
  if (Math.abs(value) < 10_000) return formatMoney(cents, currency);
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

const numberFormatter = new Intl.NumberFormat(LOCALE);
export function formatNumber(n: number | null | undefined): string {
  return numberFormatter.format(n ?? 0);
}

/** Takes a 0–1 ratio, not a percentage. */
export function formatPercent(ratio: number | null | undefined, digits = 1): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(ratio ?? 0);
}

/**
 * Period-over-period change as a ratio. Returns null when the previous period
 * was zero — "up 100%" from nothing is noise, and the UI shows a dash instead.
 */
export function changeRatio(current: number, previous: number): number | null {
  if (!previous) return null;
  return (current - previous) / previous;
}

export function formatDateTime(iso: string, timeZone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatTime(iso: string, timeZone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** "YYYY-MM-DD" (already a local service day) -> "12 mar". */
export function formatDayLabel(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: 'short' }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
}

/** Compact elapsed time for live feeds: "ahora", "4m", "2h", "3d". */
export function formatAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (seconds < 10) return 'ahora';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/**
 * Milliseconds to add to a UTC instant to get wall-clock time in `timeZone`.
 * Derived through Intl rather than hard-coded, so this keeps working if a
 * restaurant is ever onboarded outside Panama (which, unlike Panama, may
 * observe DST).
 */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');

  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second')
  );

  return asUtc - date.getTime();
}

/** The UTC instant of local midnight on the day `date` falls in. */
export function startOfLocalDay(date: Date, timeZone = DEFAULT_TIMEZONE): Date {
  const offset = timeZoneOffsetMs(date, timeZone);
  const local = new Date(date.getTime() + offset);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - offset);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}
