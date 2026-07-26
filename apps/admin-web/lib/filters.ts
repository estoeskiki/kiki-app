import { z } from 'zod';
import type { DashboardFilterArgs, OrderChannel, OrderStatus } from '@/lib/types';
import { DEFAULT_TIMEZONE, addDays, startOfLocalDay } from '@/lib/format';

/**
 * The dashboard's filter state lives entirely in the URL.
 *
 * That is deliberate: every view is then shareable, bookmarkable and
 * server-renderable, back/forward work for free, and there is no client store
 * to fall out of sync with what was actually queried.
 *
 * These values are untrusted user input. They are parsed and clamped here, but
 * that is for correctness, not security — RLS is what stops a user naming a
 * scope they cannot see, and dashboard_scope_tree() only ever offers scopes
 * they can.
 */

export const RANGE_PRESETS = ['hoy', '7d', '30d', '90d'] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const ORDER_STATUSES: OrderStatus[] = [
  'confirmed',
  'preparing',
  'ready',
  'completed',
  'cancelled',
];

export const ORDER_CHANNELS: OrderChannel[] = ['kiosk', 'web'];

/** Sentinel for the "Sin zona" bucket — orders with table_id IS NULL. */
export const UNZONED = 'sin-zona';

const uuid = z.string().uuid();

/** Comma-separated UUID list, silently dropping anything malformed. */
const uuidList = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => uuid.safeParse(s).success)
  );

const filterSchema = z.object({
  range: z.enum(RANGE_PRESETS).catch('7d'),
  from: z.string().optional(),
  to: z.string().optional(),
  org: uuidList,
  fc: uuidList,
  r: uuidList,
  zone: z.string().optional(),
  channel: z.string().optional(),
  status: z.string().optional(),
  q: z.string().max(120).optional(),
  cursor: z.string().optional(),
});

export type DashboardFilters = {
  range: RangePreset;
  from: Date;
  to: Date;
  /** True when from/to came from explicit URL dates rather than a preset. */
  custom: boolean;
  orgIds: string[];
  foodCourtIds: string[];
  restaurantIds: string[];
  zoneIds: string[];
  includeUnzoned: boolean;
  channels: OrderChannel[];
  statuses: OrderStatus[];
  q: string | null;
  cursor: string | null;
};

export type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Preset -> [from, to). `to` is exclusive and always local-midnight aligned. */
function resolvePreset(preset: RangePreset, timeZone: string): { from: Date; to: Date } {
  const today = startOfLocalDay(new Date(), timeZone);
  const to = addDays(today, 1);
  const days = preset === 'hoy' ? 1 : preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  return { from: addDays(to, -days), to };
}

export function parseFilters(
  searchParams: SearchParams,
  timeZone: string = DEFAULT_TIMEZONE
): DashboardFilters {
  const raw = filterSchema.parse({
    range: first(searchParams.range),
    from: first(searchParams.from),
    to: first(searchParams.to),
    org: first(searchParams.org),
    fc: first(searchParams.fc),
    r: first(searchParams.r),
    zone: first(searchParams.zone),
    channel: first(searchParams.channel),
    status: first(searchParams.status),
    q: first(searchParams.q),
    cursor: first(searchParams.cursor),
  });

  // An explicit from/to pair wins over the preset. A single bound, or an
  // inverted range, falls back to the preset rather than returning nothing.
  const explicitFrom = raw.from ? startOfLocalDay(new Date(raw.from), timeZone) : null;
  const explicitTo = raw.to ? addDays(startOfLocalDay(new Date(raw.to), timeZone), 1) : null;

  const usable =
    explicitFrom &&
    explicitTo &&
    !Number.isNaN(explicitFrom.getTime()) &&
    !Number.isNaN(explicitTo.getTime()) &&
    explicitFrom < explicitTo;

  const { from, to } = usable
    ? { from: explicitFrom!, to: explicitTo! }
    : resolvePreset(raw.range, timeZone);

  const zoneTokens = (raw.zone ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    range: raw.range,
    from,
    to,
    custom: Boolean(usable),
    orgIds: raw.org,
    foodCourtIds: raw.fc,
    restaurantIds: raw.r,
    zoneIds: zoneTokens.filter((z) => uuid.safeParse(z).success),
    includeUnzoned: zoneTokens.includes(UNZONED),
    channels: (raw.channel ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is OrderChannel => (ORDER_CHANNELS as string[]).includes(s)),
    statuses: (raw.status ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is OrderStatus => (ORDER_STATUSES as string[]).includes(s)),
    q: raw.q?.trim() || null,
    cursor: raw.cursor ?? null,
  };
}

/**
 * Filters -> RPC arguments. Empty selections become null ("no constraint")
 * rather than an empty array, which Postgres would read as "match nothing".
 */
export function toRpcArgs(f: DashboardFilters): DashboardFilterArgs {
  return {
    p_from: f.from.toISOString(),
    p_to: f.to.toISOString(),
    p_org_ids: f.orgIds.length ? f.orgIds : null,
    p_food_court_ids: f.foodCourtIds.length ? f.foodCourtIds : null,
    p_restaurant_ids: f.restaurantIds.length ? f.restaurantIds : null,
    p_table_ids: f.zoneIds.length ? f.zoneIds : null,
    p_include_unzoned: f.includeUnzoned ? true : null,
    p_channels: f.channels.length ? f.channels : null,
    p_statuses: f.statuses.length ? f.statuses : null,
  };
}

/** Merge changes into an existing query string, dropping empties and the cursor. */
export function buildQuery(
  current: URLSearchParams | Readonly<URLSearchParams>,
  patch: Record<string, string | string[] | null>
): string {
  const next = new URLSearchParams(current.toString());

  for (const [key, value] of Object.entries(patch)) {
    const serialized = Array.isArray(value) ? value.join(',') : value;
    if (!serialized) next.delete(key);
    else next.set(key, serialized);
  }

  // Any filter change invalidates the keyset cursor — keeping it would page
  // into a result set that no longer exists.
  if (!('cursor' in patch)) next.delete('cursor');

  const qs = next.toString();
  return qs ? `?${qs}` : '';
}

/** Toggle one token inside a comma-separated multi-select param. */
export function toggleToken(currentValue: string | null, token: string): string | null {
  const tokens = (currentValue ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const next = tokens.includes(token)
    ? tokens.filter((t) => t !== token)
    : [...tokens, token];
  return next.length ? next.join(',') : null;
}
