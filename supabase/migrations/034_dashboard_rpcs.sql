-- ============================================================================
-- Migration: 034_dashboard_rpcs.sql
-- Description: The read model behind apps/admin-web. Aggregation runs in
-- Postgres and returns small JSON documents rather than shipping thousands of
-- order rows to the browser to be summed there.
--
-- Everything here is SECURITY INVOKER. That is the whole security design: RLS
-- still applies inside these functions, so a restaurant manager calling
-- dashboard_kpis() with no filters gets their own restaurant's numbers and a
-- platform admin calling the identical query gets the platform's. There is no
-- scope-guard code to audit, and no way to construct arguments that widen your
-- own visibility — the filter arguments can only ever narrow what RLS already
-- allows.
--
-- GRAIN: everything aggregates over sub_orders, not orders. A food-court order
-- is one `orders` row fanned out into one `sub_orders` row per participating
-- restaurant; summing orders.total would double-count a shared order against
-- every stall in the court. Order *counts* therefore use
-- COUNT(DISTINCT order_id) so a two-stall order counts once per scope.
-- ============================================================================

-- ─── Fact view ──────────────────────────────────────────────────────────────
-- security_invoker = true (PG15+, this cluster is 17.6) means the RLS of
-- sub_orders / orders / restaurants is evaluated as the CALLER, not as the view
-- owner. Without it a view owned by postgres would happily hand every tenant's
-- orders to anyone who could select from it.
--
-- table_label / table_number are read from the sub_order's own snapshot first,
-- falling back to the parent's. Zone identity is table_id; zone display is the
-- snapshot, so a renamed or deleted zone cannot rewrite history.

-- CREATE OR REPLACE rather than DROP + CREATE: the functions below declare
-- RETURNS SETOF this view, so a DROP would fail on re-run.
CREATE OR REPLACE VIEW public.dashboard_order_facts
WITH (security_invoker = true) AS
SELECT
  so.id                                      AS sub_order_id,
  so.order_id,
  o.order_number,
  so.restaurant_id,
  r.name                                     AS restaurant_name,
  r.org_id,
  r.currency,
  r.timezone,
  o.food_court_id,
  o.table_id,
  COALESCE(so.table_label,  o.table_label)   AS table_label,
  COALESCE(so.table_number, o.table_number)  AS table_number,
  so.status,
  so.channel,
  so.order_type,
  so.payment_method,
  so.payment_status,
  so.customer_name,
  so.customer_phone,
  so.notes,
  so.cancellation_reason,
  so.subtotal,
  so.tax,
  so.total,
  so.created_at,
  so.updated_at
FROM public.sub_orders so
JOIN public.orders      o ON o.id = so.order_id
JOIN public.restaurants r ON r.id = so.restaurant_id;

REVOKE ALL ON public.dashboard_order_facts FROM PUBLIC, anon;
GRANT SELECT ON public.dashboard_order_facts TO authenticated;

-- ─── Shared filter ──────────────────────────────────────────────────────────
-- One place defines what the dashboard filter bar means, so eight aggregates
-- cannot drift apart. A plain SQL SRF, so the planner inlines it into the
-- caller and the index predicates still push down.
--
-- Zone filtering has three states because "no zone" (a walk-up or slug-entry
-- order with table_id IS NULL) is a real bucket users want to isolate and
-- cannot be named in a uuid[]:
--   p_table_ids NULL, p_include_unzoned NULL  -> no zone filter
--   p_table_ids set                           -> those zones
--   p_include_unzoned true                    -> also (or only) unzoned rows

CREATE OR REPLACE FUNCTION public.dashboard_facts(
  p_from             timestamptz,
  p_to               timestamptz,
  p_restaurant_ids   uuid[]  DEFAULT NULL,
  p_food_court_ids   uuid[]  DEFAULT NULL,
  p_org_ids          uuid[]  DEFAULT NULL,
  p_channels         text[]  DEFAULT NULL,
  p_table_ids        uuid[]  DEFAULT NULL,
  p_statuses         text[]  DEFAULT NULL,
  p_include_unzoned  boolean DEFAULT NULL
)
 RETURNS SETOF public.dashboard_order_facts
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT f.* FROM public.dashboard_order_facts f
  WHERE f.created_at >= p_from
    AND f.created_at <  p_to
    AND (p_restaurant_ids IS NULL OR f.restaurant_id  = ANY (p_restaurant_ids))
    AND (p_food_court_ids IS NULL OR f.food_court_id  = ANY (p_food_court_ids))
    AND (p_org_ids        IS NULL OR f.org_id         = ANY (p_org_ids))
    AND (p_channels       IS NULL OR f.channel        = ANY (p_channels))
    AND (p_statuses       IS NULL OR f.status         = ANY (p_statuses))
    AND (
      (p_table_ids IS NULL AND p_include_unzoned IS NULL)
      OR (p_table_ids IS NOT NULL AND f.table_id = ANY (p_table_ids))
      OR (p_include_unzoned AND f.table_id IS NULL)
    );
$function$;

-- ─── Viewer context ─────────────────────────────────────────────────────────
-- One round trip for everything the shell needs to render: identity, platform
-- flag, role, and the scopes this user may filter within. Replaces the RN app's
-- sequential org_members -> restaurants -> food_courts query chain
-- (apps/admin/src/store/useAuthStore.ts).

CREATE OR REPLACE FUNCTION public.get_viewer_context()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'user_id',           auth.uid(),
    'is_platform_admin', is_platform_admin(),
    'role',              get_user_role(),
    'org_id',            get_user_org_id(),
    'restaurant_ids',    to_jsonb(get_user_restaurant_ids()),
    'food_court_ids',    to_jsonb(get_user_food_court_ids()),
    'display_name', (
      SELECT m.display_name FROM (
        SELECT display_name, created_at FROM org_members        WHERE user_id = auth.uid()
        UNION ALL
        SELECT display_name, created_at FROM food_court_members WHERE user_id = auth.uid()
      ) m ORDER BY m.created_at LIMIT 1
    )
  );
$function$;

-- ─── Scope tree (drives the filter bar) ─────────────────────────────────────
-- Only returns scopes RLS already permits, so the filter UI cannot offer a
-- scope the viewer would be refused. Zones come from `tables`; they are the
-- same rows the storefront QR codes point at.

CREATE OR REPLACE FUNCTION public.dashboard_scope_tree()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'organizations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'slug', o.slug) ORDER BY o.name)
      FROM organizations o), '[]'::jsonb),
    'food_courts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', fc.id, 'name', fc.name, 'slug', fc.slug) ORDER BY fc.name)
      FROM food_courts fc), '[]'::jsonb),
    'restaurants', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'name', r.name, 'slug', r.slug,
        'org_id', r.org_id, 'food_court_id', r.food_court_id,
        'is_active', r.is_active, 'is_open', r.is_open,
        'currency', r.currency, 'timezone', r.timezone
      ) ORDER BY r.name)
      FROM restaurants r), '[]'::jsonb),
    'zones', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id, 'label', t.label,
        'restaurant_id', t.restaurant_id, 'food_court_id', t.food_court_id,
        'allows_manual_number', t.allows_manual_number
      ) ORDER BY t.label)
      FROM tables t WHERE t.is_active), '[]'::jsonb)
  );
$function$;

-- ─── KPIs ───────────────────────────────────────────────────────────────────
-- Also computes the immediately preceding window of equal length, which is what
-- the "vs período anterior" deltas on the KPI cards compare against.
-- Cancelled sub_orders are excluded from revenue and order counts but retained
-- for the cancellation rate.

CREATE OR REPLACE FUNCTION public.dashboard_kpis(
  p_from             timestamptz,
  p_to               timestamptz,
  p_restaurant_ids   uuid[]  DEFAULT NULL,
  p_food_court_ids   uuid[]  DEFAULT NULL,
  p_org_ids          uuid[]  DEFAULT NULL,
  p_channels         text[]  DEFAULT NULL,
  p_table_ids        uuid[]  DEFAULT NULL,
  p_statuses         text[]  DEFAULT NULL,
  p_include_unzoned  boolean DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  WITH cur AS (
    SELECT * FROM dashboard_facts(p_from, p_to,
      p_restaurant_ids, p_food_court_ids, p_org_ids, p_channels, p_table_ids, p_statuses, p_include_unzoned)
  ), prev AS (
    SELECT * FROM dashboard_facts(p_from - (p_to - p_from), p_from,
      p_restaurant_ids, p_food_court_ids, p_org_ids, p_channels, p_table_ids, p_statuses, p_include_unzoned)
  ), agg AS (
    SELECT
      'current' AS period,
      COALESCE(SUM(total) FILTER (WHERE status <> 'cancelled'), 0)::bigint AS revenue_cents,
      COUNT(DISTINCT order_id) FILTER (WHERE status <> 'cancelled')        AS orders,
      COUNT(DISTINCT order_id)                                            AS orders_all,
      COUNT(DISTINCT order_id) FILTER (WHERE status = 'cancelled')        AS orders_cancelled
    FROM cur
    UNION ALL
    SELECT
      'previous',
      COALESCE(SUM(total) FILTER (WHERE status <> 'cancelled'), 0)::bigint,
      COUNT(DISTINCT order_id) FILTER (WHERE status <> 'cancelled'),
      COUNT(DISTINCT order_id),
      COUNT(DISTINCT order_id) FILTER (WHERE status = 'cancelled')
    FROM prev
  )
  SELECT jsonb_object_agg(period, jsonb_build_object(
    'revenue_cents',    revenue_cents,
    'orders',           orders,
    'avg_ticket_cents', COALESCE(ROUND(revenue_cents::numeric / NULLIF(orders, 0)), 0)::bigint,
    'cancelled',        orders_cancelled,
    'cancel_rate',      COALESCE(ROUND(orders_cancelled::numeric / NULLIF(orders_all, 0), 4), 0)
  ))
  FROM agg;
$function$;

-- ─── Revenue / orders over time ─────────────────────────────────────────────
-- Bucketed by SERVICE day, not calendar day: the day boundary is 04:00 in the
-- restaurant's own timezone, matching the order-numbering convention
-- established in 028_order_numbers_service_day_4am.sql. A stadium order placed
-- at 01:30 belongs to the night that produced it.

CREATE OR REPLACE FUNCTION public.dashboard_timeseries(
  p_from             timestamptz,
  p_to               timestamptz,
  p_restaurant_ids   uuid[]  DEFAULT NULL,
  p_food_court_ids   uuid[]  DEFAULT NULL,
  p_org_ids          uuid[]  DEFAULT NULL,
  p_channels         text[]  DEFAULT NULL,
  p_table_ids        uuid[]  DEFAULT NULL,
  p_statuses         text[]  DEFAULT NULL,
  p_include_unzoned  boolean DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'day',           day,
    'revenue_cents', revenue_cents,
    'orders',        orders
  ) ORDER BY day), '[]'::jsonb)
  FROM (
    SELECT
      (((f.created_at AT TIME ZONE f.timezone) - interval '4 hours')::date) AS day,
      COALESCE(SUM(f.total) FILTER (WHERE f.status <> 'cancelled'), 0)::bigint AS revenue_cents,
      COUNT(DISTINCT f.order_id) FILTER (WHERE f.status <> 'cancelled')        AS orders
    FROM dashboard_facts(p_from, p_to,
      p_restaurant_ids, p_food_court_ids, p_org_ids, p_channels, p_table_ids, p_statuses, p_include_unzoned) f
    GROUP BY 1
  ) t;
$function$;

-- ─── Channel breakdown (kiosk vs order-web) ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.dashboard_channel_breakdown(
  p_from             timestamptz,
  p_to               timestamptz,
  p_restaurant_ids   uuid[]  DEFAULT NULL,
  p_food_court_ids   uuid[]  DEFAULT NULL,
  p_org_ids          uuid[]  DEFAULT NULL,
  p_channels         text[]  DEFAULT NULL,
  p_table_ids        uuid[]  DEFAULT NULL,
  p_statuses         text[]  DEFAULT NULL,
  p_include_unzoned  boolean DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  WITH b AS (
    SELECT
      f.channel,
      COALESCE(SUM(f.total) FILTER (WHERE f.status <> 'cancelled'), 0)::bigint AS revenue_cents,
      COUNT(DISTINCT f.order_id) FILTER (WHERE f.status <> 'cancelled')        AS orders
    FROM dashboard_facts(p_from, p_to,
      p_restaurant_ids, p_food_court_ids, p_org_ids, p_channels, p_table_ids, p_statuses, p_include_unzoned) f
    GROUP BY f.channel
  ), tot AS (
    SELECT SUM(orders) AS all_orders, SUM(revenue_cents) AS all_revenue FROM b
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'channel',        b.channel,
    'orders',         b.orders,
    'revenue_cents',  b.revenue_cents,
    'order_share',    COALESCE(ROUND(b.orders::numeric        / NULLIF(tot.all_orders, 0),  4), 0),
    'revenue_share',  COALESCE(ROUND(b.revenue_cents::numeric / NULLIF(tot.all_revenue, 0), 4), 0)
  ) ORDER BY b.revenue_cents DESC), '[]'::jsonb)
  FROM b CROSS JOIN tot;
$function$;

-- ─── Zone breakdown (Sala VIP / Palco / Mesa / sin zona) ────────────────────
-- Grouped on table_id (zone identity) and displayed via the order's own
-- table_label snapshot, so this needs no join to `tables` and therefore does
-- not depend on the caller being able to read the zone row. table_id IS NULL
-- is a real bucket: walk-up and slug-entry orders that never scanned a QR.

CREATE OR REPLACE FUNCTION public.dashboard_zone_breakdown(
  p_from             timestamptz,
  p_to               timestamptz,
  p_restaurant_ids   uuid[]  DEFAULT NULL,
  p_food_court_ids   uuid[]  DEFAULT NULL,
  p_org_ids          uuid[]  DEFAULT NULL,
  p_channels         text[]  DEFAULT NULL,
  p_table_ids        uuid[]  DEFAULT NULL,
  p_statuses         text[]  DEFAULT NULL,
  p_include_unzoned  boolean DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  WITH b AS (
    SELECT
      f.table_id,
      MAX(f.table_label) AS table_label,
      COALESCE(SUM(f.total) FILTER (WHERE f.status <> 'cancelled'), 0)::bigint AS revenue_cents,
      COUNT(DISTINCT f.order_id) FILTER (WHERE f.status <> 'cancelled')        AS orders
    FROM dashboard_facts(p_from, p_to,
      p_restaurant_ids, p_food_court_ids, p_org_ids, p_channels, p_table_ids, p_statuses, p_include_unzoned) f
    GROUP BY f.table_id
  ), tot AS (
    SELECT SUM(orders) AS all_orders, SUM(revenue_cents) AS all_revenue FROM b
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'table_id',       b.table_id,
    'label',          COALESCE(b.table_label, 'Sin zona'),
    'orders',         b.orders,
    'revenue_cents',  b.revenue_cents,
    'order_share',    COALESCE(ROUND(b.orders::numeric        / NULLIF(tot.all_orders, 0),  4), 0),
    'revenue_share',  COALESCE(ROUND(b.revenue_cents::numeric / NULLIF(tot.all_revenue, 0), 4), 0)
  ) ORDER BY b.revenue_cents DESC), '[]'::jsonb)
  FROM b CROSS JOIN tot;
$function$;

-- ─── Top selling items ──────────────────────────────────────────────────────
-- Keyed on menu_item_id where present but labelled from the order_items
-- snapshot, so a deleted or renamed menu item still reports under the name it
-- was actually sold as.

CREATE OR REPLACE FUNCTION public.dashboard_top_items(
  p_from             timestamptz,
  p_to               timestamptz,
  p_restaurant_ids   uuid[]  DEFAULT NULL,
  p_food_court_ids   uuid[]  DEFAULT NULL,
  p_org_ids          uuid[]  DEFAULT NULL,
  p_channels         text[]  DEFAULT NULL,
  p_table_ids        uuid[]  DEFAULT NULL,
  p_statuses         text[]  DEFAULT NULL,
  p_include_unzoned  boolean DEFAULT NULL,
  p_limit            integer DEFAULT 8
)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'menu_item_id',  menu_item_id,
    'name',          name,
    'quantity',      quantity,
    'revenue_cents', revenue_cents
  ) ORDER BY quantity DESC), '[]'::jsonb)
  FROM (
    SELECT
      oi.menu_item_id,
      oi.item_name               AS name,
      SUM(oi.quantity)::bigint   AS quantity,
      SUM(oi.line_total)::bigint AS revenue_cents
    FROM dashboard_facts(p_from, p_to,
      p_restaurant_ids, p_food_court_ids, p_org_ids, p_channels, p_table_ids, p_statuses, p_include_unzoned) f
    JOIN order_items oi ON oi.sub_order_id = f.sub_order_id
    WHERE f.status <> 'cancelled'
    GROUP BY oi.menu_item_id, oi.item_name
    ORDER BY quantity DESC
    LIMIT GREATEST(COALESCE(p_limit, 8), 1)
  ) t;
$function$;

-- ─── Hour × weekday heatmap ─────────────────────────────────────────────────
-- Literal local clock time (no 04:00 shift here — the point is when people
-- actually order). dow is 0 = Monday to match the DAYS array in the UI.

CREATE OR REPLACE FUNCTION public.dashboard_hour_dow_heatmap(
  p_from             timestamptz,
  p_to               timestamptz,
  p_restaurant_ids   uuid[]  DEFAULT NULL,
  p_food_court_ids   uuid[]  DEFAULT NULL,
  p_org_ids          uuid[]  DEFAULT NULL,
  p_channels         text[]  DEFAULT NULL,
  p_table_ids        uuid[]  DEFAULT NULL,
  p_statuses         text[]  DEFAULT NULL,
  p_include_unzoned  boolean DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'dow',           dow,
    'hour',          hour,
    'orders',        orders,
    'revenue_cents', revenue_cents
  ) ORDER BY dow, hour), '[]'::jsonb)
  FROM (
    SELECT
      (EXTRACT(isodow FROM (f.created_at AT TIME ZONE f.timezone))::int - 1) AS dow,
      EXTRACT(hour FROM (f.created_at AT TIME ZONE f.timezone))::int         AS hour,
      COUNT(DISTINCT f.order_id)                                             AS orders,
      COALESCE(SUM(f.total), 0)::bigint                                      AS revenue_cents
    FROM dashboard_facts(p_from, p_to,
      p_restaurant_ids, p_food_court_ids, p_org_ids, p_channels, p_table_ids, p_statuses, p_include_unzoned) f
    WHERE f.status <> 'cancelled'
    GROUP BY 1, 2
  ) t;
$function$;

-- ─── Status funnel ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.dashboard_status_funnel(
  p_from             timestamptz,
  p_to               timestamptz,
  p_restaurant_ids   uuid[]  DEFAULT NULL,
  p_food_court_ids   uuid[]  DEFAULT NULL,
  p_org_ids          uuid[]  DEFAULT NULL,
  p_channels         text[]  DEFAULT NULL,
  p_table_ids        uuid[]  DEFAULT NULL,
  p_statuses         text[]  DEFAULT NULL,
  p_include_unzoned  boolean DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_object_agg(status, n), '{}'::jsonb)
  FROM (
    SELECT f.status, COUNT(DISTINCT f.order_id) AS n
    FROM dashboard_facts(p_from, p_to,
      p_restaurant_ids, p_food_court_ids, p_org_ids, p_channels, p_table_ids, p_statuses, p_include_unzoned) f
    GROUP BY f.status
  ) t;
$function$;

-- ─── Grants ─────────────────────────────────────────────────────────────────
-- Signed-in users only. RLS decides what each of them actually sees; the anon
-- role has no business calling any of this.

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'dashboard_facts(timestamptz,timestamptz,uuid[],uuid[],uuid[],text[],uuid[],text[],boolean)',
    'get_viewer_context()',
    'dashboard_scope_tree()',
    'dashboard_kpis(timestamptz,timestamptz,uuid[],uuid[],uuid[],text[],uuid[],text[],boolean)',
    'dashboard_timeseries(timestamptz,timestamptz,uuid[],uuid[],uuid[],text[],uuid[],text[],boolean)',
    'dashboard_channel_breakdown(timestamptz,timestamptz,uuid[],uuid[],uuid[],text[],uuid[],text[],boolean)',
    'dashboard_zone_breakdown(timestamptz,timestamptz,uuid[],uuid[],uuid[],text[],uuid[],text[],boolean)',
    'dashboard_top_items(timestamptz,timestamptz,uuid[],uuid[],uuid[],text[],uuid[],text[],boolean,integer)',
    'dashboard_hour_dow_heatmap(timestamptz,timestamptz,uuid[],uuid[],uuid[],text[],uuid[],text[],boolean)',
    'dashboard_status_funnel(timestamptz,timestamptz,uuid[],uuid[],uuid[],text[],uuid[],text[],boolean)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
  END LOOP;
END $$;
