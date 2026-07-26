-- ============================================================================
-- Migration: 036_rls_performance.sql
-- Description: Two performance corrections surfaced by `supabase advisors`
-- after the dashboard work landed.
--
-- 1. auth_rls_initplan — a bare auth.uid() inside a policy is VOLATILE from the
--    planner's point of view, so it is re-evaluated once per candidate row.
--    Wrapping it as (SELECT auth.uid()) turns it into an InitPlan that runs
--    once per query. Same semantics, one evaluation instead of N.
--
-- 2. Covering indexes for the columns RLS itself filters on. Every read of
--    order_items and order_item_customizations evaluates
--    `restaurant_id = ANY(get_user_restaurant_ids())`; without an index that is
--    a sequential scan on every order-detail page load. These are the FK
--    columns the linter flagged, but the reason to add them is the policy, not
--    the constraint.
-- ============================================================================

-- Introduced in 031. is_platform_admin() is STABLE and already evaluated once;
-- the bare auth.uid() beside it was not.
ALTER POLICY platform_admins_select ON public.platform_admins
  TO authenticated
  USING (user_id = (SELECT auth.uid()) OR is_platform_admin());

-- Pre-existing shape, carried through 031. The auth.uid() lives inside a
-- correlated subquery, so it was being re-run per food_courts row.
ALTER POLICY food_court_select ON public.food_courts
  TO authenticated
  USING (
    is_platform_admin()
    OR (id IN (
      SELECT r.food_court_id FROM restaurants r
      WHERE (r.id = ANY (get_user_restaurant_ids())) AND (r.food_court_id IS NOT NULL)
    ))
    OR (id IN (
      SELECT fcm.food_court_id FROM food_court_members fcm
      WHERE fcm.user_id = (SELECT auth.uid())
    ))
  );

-- Indexes serving RLS predicates on the dashboard's hot read paths.
CREATE INDEX IF NOT EXISTS idx_order_items_restaurant
  ON public.order_items (restaurant_id);

CREATE INDEX IF NOT EXISTS idx_oic_restaurant
  ON public.order_item_customizations (restaurant_id);

CREATE INDEX IF NOT EXISTS idx_customization_groups_restaurant
  ON public.customization_groups (restaurant_id);

CREATE INDEX IF NOT EXISTS idx_customization_options_restaurant
  ON public.customization_options (restaurant_id);

-- 031 gave device_tokens policies a food-court branch; this covers it.
CREATE INDEX IF NOT EXISTS idx_device_tokens_food_court
  ON public.device_tokens (food_court_id)
  WHERE food_court_id IS NOT NULL;
