/**
 * Domain types for the admin dashboard.
 *
 * The table/view/function signatures live in @kiki/supabase (shared with the
 * kiosk, KDS and order-web). What lives here are the shapes of the JSON
 * documents the dashboard_* RPCs return — Postgres types those as `jsonb`, so
 * no generator can infer them; they are defined once here and asserted at the
 * single call site in lib/queries.ts.
 */
export type {
  Database,
  Json,
  Translatable,
  OrderType,
  OrderStatus,
  OrderChannel,
  PaymentMethod,
  PaymentStatus,
  MemberRole,
  DashboardFilterArgs,
} from '@kiki/supabase';

import type { MemberRole, OrderChannel, OrderStatus } from '@kiki/supabase';

/** get_viewer_context() — identity plus the scopes this user may filter within. */
export type ViewerContext = {
  user_id: string | null;
  is_platform_admin: boolean;
  role: MemberRole | null;
  org_id: string | null;
  restaurant_ids: string[];
  food_court_ids: string[];
  display_name: string | null;
};

/** The signed-in user as the UI knows them. `email` comes from the JWT, not the DB. */
export type Viewer = ViewerContext & { email: string };

export type ScopeOrganization = { id: string; name: string; slug: string };
export type ScopeFoodCourt = { id: string; name: string; slug: string };

export type ScopeRestaurant = {
  id: string;
  name: string;
  slug: string;
  org_id: string;
  food_court_id: string | null;
  is_active: boolean;
  is_open: boolean;
  currency: string;
  timezone: string;
};

/**
 * A "zone" is a row in `tables`: Sala VIP, Palco #1, Mesa 5. Food-court zones
 * carry food_court_id; per-restaurant tables carry restaurant_id.
 */
export type ScopeZone = {
  id: string;
  label: string;
  restaurant_id: string | null;
  food_court_id: string | null;
  allows_manual_number: boolean;
};

/** dashboard_scope_tree() — everything the filter bar is allowed to offer. */
export type ScopeTree = {
  organizations: ScopeOrganization[];
  food_courts: ScopeFoodCourt[];
  restaurants: ScopeRestaurant[];
  zones: ScopeZone[];
};

export type KpiPeriod = {
  revenue_cents: number;
  orders: number;
  avg_ticket_cents: number;
  cancelled: number;
  /** 0–1, not a percentage. */
  cancel_rate: number;
};

/** dashboard_kpis() returns the window plus the preceding equal-length window. */
export type Kpis = { current: KpiPeriod; previous: KpiPeriod };

export type TimeseriesPoint = {
  /** Service day (04:00 local boundary), as YYYY-MM-DD. */
  day: string;
  revenue_cents: number;
  orders: number;
};

export type ChannelSlice = {
  channel: OrderChannel;
  orders: number;
  revenue_cents: number;
  order_share: number;
  revenue_share: number;
};

export type ZoneSlice = {
  /** null is the "Sin zona" bucket: no QR was scanned. */
  table_id: string | null;
  label: string;
  orders: number;
  revenue_cents: number;
  order_share: number;
  revenue_share: number;
};

export type TopItem = {
  menu_item_id: string | null;
  name: string;
  /** Which location sold it — used to disambiguate identically-named items. */
  restaurant_id: string | null;
  restaurant_name: string | null;
  quantity: number;
  revenue_cents: number;
};

export type HeatCell = {
  /** 0 = Monday, to match the weekday labels in the UI. */
  dow: number;
  hour: number;
  orders: number;
  revenue_cents: number;
};

/** dashboard_status_funnel() — status -> distinct order count. */
export type StatusFunnel = Partial<Record<OrderStatus, number>>;
