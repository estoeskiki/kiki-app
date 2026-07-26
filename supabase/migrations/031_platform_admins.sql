-- ============================================================================
-- Migration: 031_platform_admins.sql
-- Description: Introduces the platform (SaaS operator) role that apps/admin-web
-- needs in order to monitor and manage every tenant. Until now the only scopes
-- were org_members and food_court_members, so there was no identity that could
-- legitimately see across organizations, food courts and standalone
-- restaurants.
--
-- The role is enforced in RLS, not in application code. Every existing policy
-- becomes `is_platform_admin() OR (<original qual>)`, so the same query text
-- serves a platform admin (all rows) and a restaurant manager (their rows) with
-- no branching in the client. Consequence: apps/admin-web never needs the
-- service_role key — it runs entirely on the signed-in user's JWT and Postgres
-- decides what they may see.
--
-- is_platform_admin() is placed FIRST in every OR so it short-circuits before
-- get_user_restaurant_ids() has to materialise an array of every restaurant in
-- the platform.
--
-- This migration also finishes the job started in 024: staff policies still
-- declared `TO public` (which includes anon) are narrowed to `TO authenticated`.
-- Access is unchanged — those quals already evaluated to false for anon,
-- because get_user_restaurant_ids() returns an empty array without a JWT — but
-- the intent becomes explicit and the anon role stops paying to evaluate them.
-- The separate *_select_public policies that genuinely serve the storefront are
-- left alone (they are tightened in 034).
-- ============================================================================

-- ─── Platform admin registry ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER so the function's own read of platform_admins is not itself
-- subject to the policies below (same recursion-avoidance pattern as
-- is_food_court_owner in 017). Owner is postgres, which bypasses RLS.
CREATE OR REPLACE FUNCTION public.is_platform_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM platform_admins WHERE user_id = auth.uid()
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- A user may see their own row (so the dashboard can render "you are a platform
-- admin" without a privileged read); only platform admins see or change the
-- rest. There is deliberately no self-insert path.
DROP POLICY IF EXISTS platform_admins_select ON public.platform_admins;
CREATE POLICY platform_admins_select ON public.platform_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_platform_admin());

DROP POLICY IF EXISTS platform_admins_insert ON public.platform_admins;
CREATE POLICY platform_admins_insert ON public.platform_admins
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS platform_admins_update ON public.platform_admins;
CREATE POLICY platform_admins_update ON public.platform_admins
  FOR UPDATE TO authenticated
  USING (is_platform_admin());

DROP POLICY IF EXISTS platform_admins_delete ON public.platform_admins;
CREATE POLICY platform_admins_delete ON public.platform_admins
  FOR DELETE TO authenticated
  USING (is_platform_admin());

-- ─── organizations ──────────────────────────────────────────────────────────

ALTER POLICY org_select ON public.organizations
  TO authenticated
  USING (is_platform_admin() OR (id = get_user_org_id()));

ALTER POLICY org_update ON public.organizations
  TO authenticated
  USING (is_platform_admin() OR ((id = get_user_org_id()) AND (get_user_role() = 'owner')));

-- New: only the platform operator registers or removes tenants.
DROP POLICY IF EXISTS org_insert ON public.organizations;
CREATE POLICY org_insert ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS org_delete ON public.organizations;
CREATE POLICY org_delete ON public.organizations
  FOR DELETE TO authenticated
  USING (is_platform_admin());

-- ─── restaurants ────────────────────────────────────────────────────────────

ALTER POLICY restaurant_select ON public.restaurants
  TO authenticated
  USING (is_platform_admin() OR (id = ANY (get_user_restaurant_ids())));

ALTER POLICY restaurant_insert ON public.restaurants
  TO authenticated
  WITH CHECK (is_platform_admin() OR ((org_id = get_user_org_id()) AND (get_user_role() = 'owner')));

ALTER POLICY restaurant_update ON public.restaurants
  TO authenticated
  USING (is_platform_admin() OR ((id = ANY (get_user_restaurant_ids())) AND (get_user_role() = ANY (ARRAY['owner'::text, 'manager'::text]))));

ALTER POLICY restaurant_delete ON public.restaurants
  TO authenticated
  USING (is_platform_admin() OR ((org_id = get_user_org_id()) AND (get_user_role() = 'owner')));

-- ─── org_members ────────────────────────────────────────────────────────────

ALTER POLICY members_select ON public.org_members
  TO authenticated
  USING (is_platform_admin() OR (org_id = get_user_org_id()));

ALTER POLICY members_insert ON public.org_members
  TO authenticated
  WITH CHECK (is_platform_admin() OR ((org_id = get_user_org_id()) AND (get_user_role() = 'owner')));

ALTER POLICY members_update ON public.org_members
  TO authenticated
  USING (is_platform_admin() OR ((org_id = get_user_org_id()) AND (get_user_role() = 'owner')));

ALTER POLICY members_delete ON public.org_members
  TO authenticated
  USING (is_platform_admin() OR ((org_id = get_user_org_id()) AND (get_user_role() = 'owner')));

-- ─── food_courts ────────────────────────────────────────────────────────────

ALTER POLICY food_court_select ON public.food_courts
  TO authenticated
  USING (
    is_platform_admin()
    OR (id IN (
      SELECT r.food_court_id FROM restaurants r
      WHERE (r.id = ANY (get_user_restaurant_ids())) AND (r.food_court_id IS NOT NULL)
    ))
    OR (id IN (
      SELECT fcm.food_court_id FROM food_court_members fcm WHERE fcm.user_id = auth.uid()
    ))
  );

-- New: food courts are a platform-level construct — a single venue hosts
-- restaurants from multiple organizations, so no tenant owns its lifecycle.
DROP POLICY IF EXISTS food_court_insert ON public.food_courts;
CREATE POLICY food_court_insert ON public.food_courts
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS food_court_update ON public.food_courts;
CREATE POLICY food_court_update ON public.food_courts
  FOR UPDATE TO authenticated
  USING (is_platform_admin() OR is_food_court_owner(id));

DROP POLICY IF EXISTS food_court_delete ON public.food_courts;
CREATE POLICY food_court_delete ON public.food_courts
  FOR DELETE TO authenticated
  USING (is_platform_admin());

-- ─── food_court_members ─────────────────────────────────────────────────────

ALTER POLICY fc_members_select ON public.food_court_members
  TO authenticated
  USING (is_platform_admin() OR (food_court_id = ANY (get_user_food_court_ids())));

-- SECURITY FIX: the original qual was
--   is_food_court_owner(food_court_id) OR food_court_has_no_members(food_court_id)
-- The second branch is a bootstrap hole — ANY authenticated user could make
-- themselves owner of any food court that happened to have no members yet.
-- Bootstrapping is now the platform operator's job.
ALTER POLICY fc_members_insert ON public.food_court_members
  TO authenticated
  WITH CHECK (is_platform_admin() OR is_food_court_owner(food_court_id));

DROP POLICY IF EXISTS fc_members_update ON public.food_court_members;
CREATE POLICY fc_members_update ON public.food_court_members
  FOR UPDATE TO authenticated
  USING (is_platform_admin() OR is_food_court_owner(food_court_id));

DROP POLICY IF EXISTS fc_members_delete ON public.food_court_members;
CREATE POLICY fc_members_delete ON public.food_court_members
  FOR DELETE TO authenticated
  USING (is_platform_admin() OR is_food_court_owner(food_court_id));

-- ─── categories ─────────────────────────────────────────────────────────────

ALTER POLICY categories_select ON public.categories
  TO authenticated
  USING (is_platform_admin() OR (restaurant_id = ANY (get_user_restaurant_ids())));

ALTER POLICY categories_insert ON public.categories
  TO authenticated
  WITH CHECK (is_platform_admin() OR ((restaurant_id = ANY (get_user_restaurant_ids())) AND (get_user_role() = ANY (ARRAY['owner'::text, 'manager'::text, 'staff'::text]))));

ALTER POLICY categories_update ON public.categories
  TO authenticated
  USING (is_platform_admin() OR ((restaurant_id = ANY (get_user_restaurant_ids())) AND (get_user_role() = ANY (ARRAY['owner'::text, 'manager'::text, 'staff'::text]))));

ALTER POLICY categories_delete ON public.categories
  TO authenticated
  USING (is_platform_admin() OR ((restaurant_id = ANY (get_user_restaurant_ids())) AND (get_user_role() = ANY (ARRAY['owner'::text, 'manager'::text]))));

-- ─── menu_items ─────────────────────────────────────────────────────────────

-- Keeps the kiosk_device carve-out: a paired kiosk may only read available items.
ALTER POLICY menu_select_kiosk ON public.menu_items
  TO authenticated
  USING (is_platform_admin() OR ((restaurant_id = ANY (get_user_restaurant_ids())) AND ((get_user_role() <> 'kiosk_device') OR (available = true))));

ALTER POLICY menu_insert ON public.menu_items
  TO authenticated
  WITH CHECK (is_platform_admin() OR ((restaurant_id = ANY (get_user_restaurant_ids())) AND (get_user_role() = ANY (ARRAY['owner'::text, 'manager'::text, 'staff'::text]))));

ALTER POLICY menu_update ON public.menu_items
  TO authenticated
  USING (is_platform_admin() OR ((restaurant_id = ANY (get_user_restaurant_ids())) AND (get_user_role() = ANY (ARRAY['owner'::text, 'manager'::text, 'staff'::text]))));

ALTER POLICY menu_delete ON public.menu_items
  TO authenticated
  USING (is_platform_admin() OR ((restaurant_id = ANY (get_user_restaurant_ids())) AND (get_user_role() = ANY (ARRAY['owner'::text, 'manager'::text]))));

-- ─── customization_groups ───────────────────────────────────────────────────

ALTER POLICY cg_select ON public.customization_groups
  TO authenticated
  USING (is_platform_admin() OR (restaurant_id = ANY (get_user_restaurant_ids())));

ALTER POLICY cg_insert ON public.customization_groups
  TO authenticated
  WITH CHECK (is_platform_admin() OR ((restaurant_id = ANY (get_user_restaurant_ids())) AND (get_user_role() = ANY (ARRAY['owner'::text, 'manager'::text, 'staff'::text]))));

ALTER POLICY cg_update ON public.customization_groups
  TO authenticated
  USING (is_platform_admin() OR ((restaurant_id = ANY (get_user_restaurant_ids())) AND (get_user_role() = ANY (ARRAY['owner'::text, 'manager'::text, 'staff'::text]))));

ALTER POLICY cg_delete ON public.customization_groups
  TO authenticated
  USING (is_platform_admin() OR ((restaurant_id = ANY (get_user_restaurant_ids())) AND (get_user_role() = ANY (ARRAY['owner'::text, 'manager'::text]))));

-- ─── customization_options ──────────────────────────────────────────────────

ALTER POLICY co_select ON public.customization_options
  TO authenticated
  USING (is_platform_admin() OR (restaurant_id = ANY (get_user_restaurant_ids())));

ALTER POLICY co_insert ON public.customization_options
  TO authenticated
  WITH CHECK (is_platform_admin() OR ((restaurant_id = ANY (get_user_restaurant_ids())) AND (get_user_role() = ANY (ARRAY['owner'::text, 'manager'::text, 'staff'::text]))));

ALTER POLICY co_update ON public.customization_options
  TO authenticated
  USING (is_platform_admin() OR ((restaurant_id = ANY (get_user_restaurant_ids())) AND (get_user_role() = ANY (ARRAY['owner'::text, 'manager'::text, 'staff'::text]))));

ALTER POLICY co_delete ON public.customization_options
  TO authenticated
  USING (is_platform_admin() OR ((restaurant_id = ANY (get_user_restaurant_ids())) AND (get_user_role() = ANY (ARRAY['owner'::text, 'manager'::text]))));

-- ─── orders / sub_orders / order_items / order_item_customizations ──────────

ALTER POLICY orders_select ON public.orders
  TO authenticated
  USING (is_platform_admin() OR (restaurant_id = ANY (get_user_restaurant_ids())));

ALTER POLICY orders_insert ON public.orders
  TO authenticated
  WITH CHECK (is_platform_admin() OR (restaurant_id = ANY (get_user_restaurant_ids())));

ALTER POLICY orders_update ON public.orders
  TO authenticated
  USING (is_platform_admin() OR ((restaurant_id = ANY (get_user_restaurant_ids())) AND (get_user_role() = ANY (ARRAY['owner'::text, 'manager'::text, 'staff'::text]))));

ALTER POLICY sub_orders_select ON public.sub_orders
  TO authenticated
  USING (is_platform_admin() OR (restaurant_id = ANY (get_user_restaurant_ids())));

ALTER POLICY sub_orders_insert ON public.sub_orders
  TO authenticated
  WITH CHECK (is_platform_admin() OR (restaurant_id = ANY (get_user_restaurant_ids())));

ALTER POLICY sub_orders_update ON public.sub_orders
  TO authenticated
  USING (is_platform_admin() OR ((restaurant_id = ANY (get_user_restaurant_ids())) AND (get_user_role() = ANY (ARRAY['owner'::text, 'manager'::text, 'staff'::text]))));

ALTER POLICY order_items_select ON public.order_items
  TO authenticated
  USING (is_platform_admin() OR (restaurant_id = ANY (get_user_restaurant_ids())));

ALTER POLICY order_items_insert ON public.order_items
  TO authenticated
  WITH CHECK (is_platform_admin() OR (restaurant_id = ANY (get_user_restaurant_ids())));

ALTER POLICY oic_select ON public.order_item_customizations
  TO authenticated
  USING (is_platform_admin() OR (restaurant_id = ANY (get_user_restaurant_ids())));

ALTER POLICY oic_insert ON public.order_item_customizations
  TO authenticated
  WITH CHECK (is_platform_admin() OR (restaurant_id = ANY (get_user_restaurant_ids())));

-- ─── tables (physical tables + food-court zones) ────────────────────────────

ALTER POLICY tables_select_staff ON public.tables
  TO authenticated
  USING (
    is_platform_admin()
    OR ((restaurant_id IS NOT NULL) AND (restaurant_id = ANY (get_user_restaurant_ids())))
    OR ((food_court_id IS NOT NULL) AND (food_court_id IN (
      SELECT r.food_court_id FROM restaurants r
      WHERE (r.id = ANY (get_user_restaurant_ids())) AND (r.food_court_id IS NOT NULL)
    )))
    OR ((food_court_id IS NOT NULL) AND (food_court_id = ANY (get_user_food_court_ids())))
  );

ALTER POLICY tables_insert_staff ON public.tables
  TO authenticated
  WITH CHECK (
    is_platform_admin()
    OR ((get_user_role() = ANY (ARRAY['owner'::text, 'manager'::text])) AND (
      ((restaurant_id IS NOT NULL) AND (restaurant_id = ANY (get_user_restaurant_ids())))
      OR ((food_court_id IS NOT NULL) AND (food_court_id IN (
        SELECT r.food_court_id FROM restaurants r
        WHERE (r.id = ANY (get_user_restaurant_ids())) AND (r.food_court_id IS NOT NULL)
      )))
    ))
  );

ALTER POLICY tables_update_staff ON public.tables
  TO authenticated
  USING (
    is_platform_admin()
    OR ((get_user_role() = ANY (ARRAY['owner'::text, 'manager'::text])) AND (
      ((restaurant_id IS NOT NULL) AND (restaurant_id = ANY (get_user_restaurant_ids())))
      OR ((food_court_id IS NOT NULL) AND (food_court_id IN (
        SELECT r.food_court_id FROM restaurants r
        WHERE (r.id = ANY (get_user_restaurant_ids())) AND (r.food_court_id IS NOT NULL)
      )))
    ))
  );

-- New: zones/tables had no DELETE policy, so a mis-created QR zone could only
-- be deactivated, never removed.
DROP POLICY IF EXISTS tables_delete_staff ON public.tables;
CREATE POLICY tables_delete_staff ON public.tables
  FOR DELETE TO authenticated
  USING (
    is_platform_admin()
    OR ((get_user_role() = 'owner') AND (restaurant_id IS NOT NULL) AND (restaurant_id = ANY (get_user_restaurant_ids())))
  );

-- ─── device_tokens (kiosk fleet) ────────────────────────────────────────────
-- device_tokens.food_court_id has existed since 007 but every policy only ever
-- matched on restaurant_id, so food-court-paired kiosks were invisible to the
-- staff that operate them. Adds the food-court branch alongside.

ALTER POLICY devices_select ON public.device_tokens
  TO authenticated
  USING (
    is_platform_admin()
    OR ((restaurant_id = ANY (get_user_restaurant_ids())) AND (get_user_role() = ANY (ARRAY['owner'::text, 'manager'::text])))
    OR ((food_court_id IS NOT NULL) AND (food_court_id = ANY (get_user_food_court_ids())))
    OR ((food_court_id IS NOT NULL) AND (get_user_role() = ANY (ARRAY['owner'::text, 'manager'::text])) AND (food_court_id IN (
      SELECT r.food_court_id FROM restaurants r
      WHERE (r.id = ANY (get_user_restaurant_ids())) AND (r.food_court_id IS NOT NULL)
    )))
  );

ALTER POLICY devices_insert ON public.device_tokens
  TO authenticated
  WITH CHECK (
    is_platform_admin()
    OR ((restaurant_id = ANY (get_user_restaurant_ids())) AND (get_user_role() = ANY (ARRAY['owner'::text, 'manager'::text])))
  );

ALTER POLICY devices_update ON public.device_tokens
  TO authenticated
  USING (
    is_platform_admin()
    OR ((restaurant_id = ANY (get_user_restaurant_ids())) AND (get_user_role() = ANY (ARRAY['owner'::text, 'manager'::text])))
    OR ((food_court_id IS NOT NULL) AND (get_user_role() = ANY (ARRAY['owner'::text, 'manager'::text])) AND (food_court_id IN (
      SELECT r.food_court_id FROM restaurants r
      WHERE (r.id = ANY (get_user_restaurant_ids())) AND (r.food_court_id IS NOT NULL)
    )))
  );

ALTER POLICY devices_delete ON public.device_tokens
  TO authenticated
  USING (
    is_platform_admin()
    OR ((restaurant_id = ANY (get_user_restaurant_ids())) AND (get_user_role() = 'owner'))
  );

-- ─── Seed the first platform admin ──────────────────────────────────────────
-- Runs as the migration role (table owner), which bypasses RLS, so this is the
-- only way a first platform admin can come into existence.

INSERT INTO public.platform_admins (user_id, note)
SELECT id, 'seeded by 031_platform_admins.sql'
FROM auth.users
WHERE email = 'edgaromarcaceres@gmail.com'
ON CONFLICT (user_id) DO NOTHING;
