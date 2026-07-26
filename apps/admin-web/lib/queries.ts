import 'server-only';

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { DashboardFilters } from '@/lib/filters';
import { toRpcArgs } from '@/lib/filters';
import type {
  ChannelSlice,
  HeatCell,
  Kpis,
  ScopeTree,
  StatusFunnel,
  TimeseriesPoint,
  TopItem,
  ZoneSlice,
} from '@/lib/types';

/**
 * Read layer for the dashboard.
 *
 * Every function here runs the caller's own session against a SECURITY INVOKER
 * RPC, so RLS decides the row set. There is no scope-checking code in this file
 * on purpose: filters narrow, they never widen, and a platform admin and a
 * single-restaurant manager execute the identical query text.
 *
 * The RPCs return jsonb, which Postgres cannot type for us. The single `as`
 * cast per function is where that untyped boundary is crossed; the shapes are
 * declared in lib/types.ts and produced by 034_dashboard_rpcs.sql.
 */

/** Everything the filter bar may offer. Cached per request — several components need it. */
export const getScopeTree = cache(async (): Promise<ScopeTree> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('dashboard_scope_tree');

  if (error) {
    console.error('[queries] dashboard_scope_tree failed:', error.message);
    return { organizations: [], food_courts: [], restaurants: [], zones: [] };
  }

  return data as unknown as ScopeTree;
});

const EMPTY_PERIOD = {
  revenue_cents: 0,
  orders: 0,
  avg_ticket_cents: 0,
  cancelled: 0,
  cancel_rate: 0,
};

export async function getKpis(filters: DashboardFilters): Promise<Kpis> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('dashboard_kpis', toRpcArgs(filters));

  if (error) {
    console.error('[queries] dashboard_kpis failed:', error.message);
    return { current: EMPTY_PERIOD, previous: EMPTY_PERIOD };
  }

  const kpis = (data ?? {}) as unknown as Partial<Kpis>;
  return {
    current: kpis.current ?? EMPTY_PERIOD,
    previous: kpis.previous ?? EMPTY_PERIOD,
  };
}

export async function getTimeseries(filters: DashboardFilters): Promise<TimeseriesPoint[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('dashboard_timeseries', toRpcArgs(filters));
  if (error) {
    console.error('[queries] dashboard_timeseries failed:', error.message);
    return [];
  }
  return (data ?? []) as unknown as TimeseriesPoint[];
}

/** Kiosk vs order-web. */
export async function getChannelBreakdown(filters: DashboardFilters): Promise<ChannelSlice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('dashboard_channel_breakdown', toRpcArgs(filters));
  if (error) {
    console.error('[queries] dashboard_channel_breakdown failed:', error.message);
    return [];
  }
  return (data ?? []) as unknown as ChannelSlice[];
}

/** Sala VIP / Palco / Mesa / Sin zona. */
export async function getZoneBreakdown(filters: DashboardFilters): Promise<ZoneSlice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('dashboard_zone_breakdown', toRpcArgs(filters));
  if (error) {
    console.error('[queries] dashboard_zone_breakdown failed:', error.message);
    return [];
  }
  return (data ?? []) as unknown as ZoneSlice[];
}

export async function getTopItems(filters: DashboardFilters, limit = 8): Promise<TopItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('dashboard_top_items', {
    ...toRpcArgs(filters),
    p_limit: limit,
  });
  if (error) {
    console.error('[queries] dashboard_top_items failed:', error.message);
    return [];
  }
  return (data ?? []) as unknown as TopItem[];
}

export async function getHeatmap(filters: DashboardFilters): Promise<HeatCell[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('dashboard_hour_dow_heatmap', toRpcArgs(filters));
  if (error) {
    console.error('[queries] dashboard_hour_dow_heatmap failed:', error.message);
    return [];
  }
  return (data ?? []) as unknown as HeatCell[];
}

export async function getStatusFunnel(filters: DashboardFilters): Promise<StatusFunnel> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('dashboard_status_funnel', toRpcArgs(filters));
  if (error) {
    console.error('[queries] dashboard_status_funnel failed:', error.message);
    return {};
  }
  return (data ?? {}) as unknown as StatusFunnel;
}

export const ORDERS_PAGE_SIZE = 50;

export type OrderRow = {
  sub_order_id: string;
  order_id: string;
  order_number: number;
  restaurant_id: string;
  restaurant_name: string;
  food_court_id: string | null;
  table_id: string | null;
  table_label: string | null;
  table_number: string | null;
  status: string;
  channel: string;
  order_type: string;
  payment_status: string;
  payment_method: string | null;
  customer_name: string | null;
  currency: string;
  total: number;
  created_at: string;
};

/**
 * Paginated order list, straight off the dashboard_order_facts view.
 *
 * Keyset pagination on (created_at, sub_order_id) rather than range/offset:
 * offset degrades linearly as the table grows and, on a feed with live inserts,
 * silently skips or repeats rows between pages. The cursor is opaque
 * "<iso>|<uuid>" and only ever moves forward.
 *
 * No count is requested at all — an exact count would scan the whole filtered
 * set on every page load to render a number nobody acts on.
 */
export async function getOrders(
  filters: DashboardFilters
): Promise<{ rows: OrderRow[]; nextCursor: string | null }> {
  const supabase = await createClient();

  let query = supabase
    .from('dashboard_order_facts')
    .select(
      'sub_order_id, order_id, order_number, restaurant_id, restaurant_name, food_court_id, ' +
        'table_id, table_label, table_number, status, channel, order_type, payment_status, ' +
        'payment_method, customer_name, currency, total, created_at'
    )
    .gte('created_at', filters.from.toISOString())
    .lt('created_at', filters.to.toISOString())
    .order('created_at', { ascending: false })
    .order('sub_order_id', { ascending: false })
    .limit(ORDERS_PAGE_SIZE + 1);

  if (filters.orgIds.length) query = query.in('org_id', filters.orgIds);
  if (filters.foodCourtIds.length) query = query.in('food_court_id', filters.foodCourtIds);
  if (filters.restaurantIds.length) query = query.in('restaurant_id', filters.restaurantIds);
  if (filters.channels.length) query = query.in('channel', filters.channels);
  if (filters.statuses.length) query = query.in('status', filters.statuses);

  // Zones: ids, the null bucket, or both.
  if (filters.zoneIds.length && filters.includeUnzoned) {
    query = query.or(`table_id.in.(${filters.zoneIds.join(',')}),table_id.is.null`);
  } else if (filters.zoneIds.length) {
    query = query.in('table_id', filters.zoneIds);
  } else if (filters.includeUnzoned) {
    query = query.is('table_id', null);
  }

  if (filters.q) {
    const term = filters.q.replace(/[%,()]/g, '');
    const asNumber = Number(term);
    query = Number.isInteger(asNumber)
      ? query.eq('order_number', asNumber)
      : query.ilike('customer_name', `%${term}%`);
  }

  if (filters.cursor) {
    const [ts, id] = filters.cursor.split('|');
    if (ts && id) {
      // Strictly "older than the last row we showed", with sub_order_id as the
      // tiebreak for orders sharing a timestamp.
      query = query.or(`created_at.lt.${ts},and(created_at.eq.${ts},sub_order_id.lt.${id})`);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error('[queries] getOrders failed:', error.message);
    return { rows: [], nextCursor: null };
  }

  const rows = (data ?? []) as unknown as OrderRow[];
  const hasMore = rows.length > ORDERS_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, ORDERS_PAGE_SIZE) : rows;
  const last = page.at(-1);

  return {
    rows: page,
    nextCursor: hasMore && last ? `${last.created_at}|${last.sub_order_id}` : null,
  };
}

/** Most recent orders in scope, for the Overview live feed. */
export async function getLiveOrders(limit = 6): Promise<OrderRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('dashboard_order_facts')
    .select(
      'sub_order_id, order_id, order_number, restaurant_id, restaurant_name, food_court_id, ' +
        'table_id, table_label, table_number, status, channel, order_type, payment_status, ' +
        'payment_method, customer_name, currency, total, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[queries] getLiveOrders failed:', error.message);
    return [];
  }
  return (data ?? []) as unknown as OrderRow[];
}
