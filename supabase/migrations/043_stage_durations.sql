-- ============================================================================
-- Migration: 043_stage_durations.sql
-- Description: Average time spent in each status (confirmed, preparing,
-- ready), built from order_status_events (042).
--
-- Every sub_order starts life as 'confirmed' with no event row for that
-- (creation isn't a transition), so the timeline is synthesized: a virtual
-- first entry at sub_orders.created_at, unioned with the real logged
-- transitions. LEAD() over that per-sub_order timeline gives the duration of
-- each segment; only CLOSED segments (where a next entry exists) are averaged
-- — a sub_order currently sitting in "preparing" right now has an unknown
-- future duration and would bias the average downward if counted at an
-- arbitrary "now" cutoff, so it's excluded until it actually transitions.
--
-- This means results are empty or thin at first — the table only has data from
-- the moment 042 was applied forward — and will fill in as real transitions
-- happen. There is no way to back-fill genuine per-stage timing for orders that
-- already moved through the pipeline before that migration.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.dashboard_stage_durations(
  p_from timestamptz, p_to timestamptz,
  p_restaurant_ids uuid[] DEFAULT NULL, p_food_court_ids uuid[] DEFAULT NULL,
  p_org_ids uuid[] DEFAULT NULL, p_channels text[] DEFAULT NULL,
  p_table_ids uuid[] DEFAULT NULL, p_statuses text[] DEFAULT NULL,
  p_include_unzoned boolean DEFAULT NULL
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $function$
  WITH scoped AS (
    SELECT f.sub_order_id, f.created_at
    FROM dashboard_facts(p_from, p_to,
      p_restaurant_ids, p_food_court_ids, p_org_ids, p_channels, p_table_ids, p_statuses, p_include_unzoned) f
  ), timeline AS (
    -- Virtual creation entry: RLS on order_status_events applies to the second
    -- branch (it is a real table read); this branch reads only dashboard_facts,
    -- which is already scoped, so no policy is bypassed by synthesizing it.
    SELECT s.sub_order_id, 'confirmed'::text AS status, s.created_at AS entered_at
    FROM scoped s
    UNION ALL
    SELECT e.sub_order_id, e.to_status, e.changed_at
    FROM order_status_events e
    JOIN scoped s ON s.sub_order_id = e.sub_order_id
  ), segments AS (
    SELECT
      status,
      LEAD(entered_at) OVER (PARTITION BY sub_order_id ORDER BY entered_at) - entered_at AS duration
    FROM timeline
  )
  SELECT COALESCE(jsonb_object_agg(status, jsonb_build_object(
    'avg_seconds',  avg_seconds,
    'sample_size',  n
  )), '{}'::jsonb)
  FROM (
    SELECT
      status,
      ROUND(AVG(EXTRACT(epoch FROM duration)))::bigint AS avg_seconds,
      COUNT(*)::bigint                                  AS n
    FROM segments
    WHERE duration IS NOT NULL
    GROUP BY status
  ) t;
$function$;

REVOKE ALL ON FUNCTION public.dashboard_stage_durations(timestamptz,timestamptz,uuid[],uuid[],uuid[],text[],uuid[],text[],boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_stage_durations(timestamptz,timestamptz,uuid[],uuid[],uuid[],text[],uuid[],text[],boolean) TO authenticated;
