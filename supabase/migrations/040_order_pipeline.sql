-- ============================================================================
-- Migration: 040_order_pipeline.sql
-- Description: A truthful order pipeline, replacing dashboard_status_funnel as
-- the Overview's lifecycle view.
--
-- WHY THE OLD ONE COULDN'T BE A FUNNEL
-- dashboard_status_funnel (034) counted distinct orders per sub_order status. A
-- food-court order whose two stalls are in different states was therefore
-- counted in both, so the numbers summed to 83 across 57 orders. Percentages
-- computed from that are meaningless, and "funnel" implied a conversion
-- sequence that the data never expressed — status is current state, not an
-- accumulating stage.
--
-- WHAT THIS DOES INSTEAD
-- Assigns each order exactly ONE stage, so counts sum to the order total and
-- shares are real percentages.
--
-- An order's stage is its *bottleneck* — the least advanced stall still working
-- on it. That matches how the business actually reads an order: a two-stall
-- order is not "ready" for the customer until both stalls are ready. Cancelled
-- sub_orders are ignored while any sibling is live (a partial cancellation does
-- not stop the order); an order counts as cancelled only when every stall is.
--
-- Also returns revenue per stage, plus completion and cancellation rates, so the
-- card can lead with the two numbers an operator acts on.
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
      bool_or(f.status = 'ready')                               AS any_ready,
      COALESCE(SUM(f.total) FILTER (WHERE f.status <> 'cancelled'), 0) AS revenue_cents,
      MIN(f.created_at)                                         AS created_at
    FROM dashboard_facts(p_from, p_to,
      p_restaurant_ids, p_food_court_ids, p_org_ids, p_channels, p_table_ids, p_statuses, p_include_unzoned) f
    GROUP BY f.order_id
  ), staged AS (
    SELECT
      order_id,
      revenue_cents,
      -- Bottleneck stage: the least advanced live stall decides.
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
      COUNT(*) FILTER (WHERE stage IN ('confirmed','preparing','ready'))::bigint AS in_progress
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
    -- Emitted in lifecycle order, with zero-filled stages so the pipeline keeps
    -- a stable shape instead of collapsing when a stage happens to be empty.
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
