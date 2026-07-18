-- 024_narrow_staff_select_policies.sql
-- Perf (pre-launch): the staff SELECT policies used role `public`, which
-- includes `anon`, so every anonymous menu read also evaluated
-- get_user_restaurant_ids() per row (always empty for anon) on top of the real
-- *_select_public policy. Narrow them to `authenticated` so anon matches only
-- the single public policy.
--
-- Access is unchanged:
--   * anon result was already just the *_select_public policy (the staff policy
--     OR'd in `false` for anon), and availability filtering on menu_items is
--     still enforced by menu_items_select_public (available = true).
--   * staff/kiosk are authenticated, so they keep their scoped *_select policy.
ALTER POLICY categories_select ON public.categories TO authenticated;
ALTER POLICY cg_select ON public.customization_groups TO authenticated;
ALTER POLICY co_select ON public.customization_options TO authenticated;
ALTER POLICY menu_select_kiosk ON public.menu_items TO authenticated;
