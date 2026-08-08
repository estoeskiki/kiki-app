-- ============================================================================
-- Migration: 041_fulfillment_duration.sql
-- Description: Adds average fulfillment time to dashboard_order_pipeline —
-- "how long from getting an order to completing it."
--
-- DEFINITION AND ITS CAVEAT
-- There is no status-history table in this schema — orders/sub_orders each
-- carry a single `updated_at`, bumped by a generic BEFORE UPDATE trigger
-- (trg_orders_updated_at / trg_sub_orders_updated_at -> update_updated_at())
-- on every write, not specifically on status transitions. So "time reached
-- completed" is approximated as "last time this row was touched, given it is
-- now in a terminal state" — sound as long as nothing legitimately edits a
-- sub_order after it's completed. Checked against live data: 0 rows where
-- updated_at < created_at, and observed durations are all plausible small
-- values, so the approximation holds today. It would silently go wrong only if
-- something started editing completed orders after the fact (e.g. a refund
-- flow bumping updated_at) — worth remembering if a real status-history table
-- is ever added, at which point this should switch to reading that instead.
--
-- An order's fulfillment time is MAX(sub_order.updated_at) - MIN(sub_order.created_at)
-- across its stalls, computed only when every stall individually reached
-- 'completed' (the existing `stage = 'completed'` bottleneck from 040) — for a
-- multi-stall order, the last stall to finish is definitionally when the whole
-- order was done for the customer, which is the correct end-of-clock, not an
-- approximation.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.dashboard_order_pipeline(
  p_from timestamptz, p_to timestamptz,
  p_restaurant_ids uuid[] DEFAULT NULL, p_food_court_ids uuid[] DEFAULT NULL,
  p_org_ids uuid[] DEFAULT NULL, p_channels text[] DEFAULT NULL,
  p_table_ids uuid[] DEFAULT NULL, p_statuses text[] DEFAULT NULL,
  p_include_unzoned boolean DEFAULT NULL
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $function$
  WITH per_order AS (
    SELECT
      f.order_id,
      bool_and(f.status = 'cancelled')                          AS all_cancelled,
      bool_or(f.status = 'confirmed')                           AS any_confirmed,
      bool_or(f.status = 'preparing')                           AS any_preparing,
      bool_or(f.status = 'ready')                                AS any_ready,
      COALESCE(SUM(f.total) FILTER (WHERE f.status <> 'cancelled'), 0) AS revenue_cents,
      MIN(f.created_at)                                         AS created_at,
      MAX(f.updated_at)                                         AS last_updated_at
    FROM dashboard_facts(p_from, p_to,
      p_restaurant_ids, p_food_court_ids, p_org_ids, p_channels, p_table_ids, p_statuses, p_include_unzoned) f
    GROUP BY f.order_id
  ), staged AS (
    SELECT
      order_id,
      revenue_cents,
      created_at,
      last_updated_at,
      CASE
        WHEN all_cancelled THEN 'cancelled'
        WHEN any_confirmed THEN 'confirmed'
        WHEN any_preparing THEN 'preparing'
        WHEN any_ready     THEN 'ready'
        ELSE 'completed'
      END AS stage
    FROM per_order
  ), totals AS (
    SELECT
      COUNT(*)::bigint                                                   AS total_orders,
      COALESCE(SUM(revenue_cents), 0)::bigint                            AS total_revenue,
      COUNT(*) FILTER (WHERE stage = 'completed')::bigint                AS completed,
      COUNT(*) FILTER (WHERE stage = 'cancelled')::bigint                AS cancelled,
      COUNT(*) FILTER (WHERE stage IN ('confirmed','preparing','ready'))::bigint AS in_progress,
      AVG(EXTRACT(epoch FROM (last_updated_at - created_at)))
        FILTER (WHERE stage = 'completed')                               AS avg_fulfillment_seconds
    FROM staged
  ), by_stage AS (
    SELECT
      s.stage,
      COUNT(*)::bigint                        AS orders,
      COALESCE(SUM(s.revenue_cents), 0)::bigint AS revenue_cents
    FROM staged s
    GROUP BY s.stage
  )
  SELECT jsonb_build_object(
    'total_orders',      t.total_orders,
    'total_revenue_cents', t.total_revenue,
    'completed',         t.completed,
    'cancelled',         t.cancelled,
    'in_progress',       t.in_progress,
    'completion_rate',   COALESCE(ROUND(t.completed::numeric / NULLIF(t.total_orders, 0), 4), 0),
    'cancellation_rate', COALESCE(ROUND(t.cancelled::numeric / NULLIF(t.total_orders, 0), 4), 0),
    -- Null (not 0) when nothing completed in the window — "no data yet" is a
    -- different fact from "instant fulfillment", and the UI renders them
    -- differently.
    'avg_fulfillment_seconds', CASE WHEN t.completed > 0 THEN ROUND(t.avg_fulfillment_seconds) ELSE NULL END,
    'stages', (
      SELECT jsonb_agg(jsonb_build_object(
        'stage',         st.stage,
        'orders',        COALESCE(b.orders, 0),
        'revenue_cents', COALESCE(b.revenue_cents, 0),
        'share',         COALESCE(ROUND(COALESCE(b.orders, 0)::numeric / NULLIF(t.total_orders, 0), 4), 0)
      ) ORDER BY st.ord)
      FROM (VALUES ('confirmed',1), ('preparing',2), ('ready',3), ('completed',4), ('cancelled',5))
             AS st(stage, ord)
      LEFT JOIN by_stage b ON b.stage = st.stage
    )
  )
  FROM totals t;
$function$;

REVOKE ALL ON FUNCTION public.dashboard_order_pipeline(timestamptz,timestamptz,uuid[],uuid[],uuid[],text[],uuid[],text[],boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_order_pipeline(timestamptz,timestamptz,uuid[],uuid[],uuid[],text[],uuid[],text[],boolean) TO authenticated;
