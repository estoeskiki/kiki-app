-- ============================================================================
-- Migration: 035_security_hardening.sql
-- Description: Clears the pre-existing findings from `supabase advisors`
-- (security) that the admin dashboard would otherwise be built on top of. None
-- of these were introduced by the dashboard work; all of them weaken the RLS
-- model it depends on.
--
-- Deliberately NOT revoked here:
--   * get_user_role / get_user_org_id / get_user_restaurant_ids /
--     get_user_food_court_ids / is_food_court_owner keep EXECUTE for
--     `authenticated`. RLS policy expressions are evaluated with the querying
--     role's privileges, so revoking these from authenticated would break every
--     policy in the schema. They are revoked from anon/PUBLIC only, which is
--     what the advisor is actually complaining about.
--   * authenticate_device keeps EXECUTE for anon. A kiosk pairs itself before
--     it has any session (apps/kiosk/src/store/useAuthStore.ts:61), so anon
--     access is the whole point of that function.
-- ============================================================================

-- ─── 1. Pin search_path on SECURITY DEFINER functions ───────────────────────
-- A SECURITY DEFINER function without a fixed search_path runs attacker-
-- influenced name resolution with the definer's privileges: create a table or
-- operator earlier in the caller's search_path and you can hijack what the
-- function body actually executes. ALTER FUNCTION ... SET search_path leaves
-- each body untouched.
-- (sync_parent_order_status was already fixed in 033_order_visibility.sql.)

ALTER FUNCTION public.get_user_restaurant_ids()          SET search_path TO 'public';
ALTER FUNCTION public.get_user_role()                    SET search_path TO 'public';
ALTER FUNCTION public.get_user_org_id()                  SET search_path TO 'public';
ALTER FUNCTION public.authenticate_device(text)          SET search_path TO 'public';
ALTER FUNCTION public.get_next_order_number(uuid)        SET search_path TO 'public';
ALTER FUNCTION public.update_updated_at()                SET search_path TO 'public';
ALTER FUNCTION public.handle_new_user()                  SET search_path TO 'public';

-- ─── 2. Stop exposing internals as REST endpoints ───────────────────────────
-- Everything in `public` is published by PostgREST at /rest/v1/rpc/<name>.
-- These are trigger bodies and RLS internals; none of them is an API.
--
-- handle_new_user and rls_auto_enable return trigger/event_trigger, so a direct
-- call would error rather than leak — but EXECUTE on a trigger function is
-- checked at CREATE TRIGGER time by the trigger's creator, not per fire, so
-- revoking it from callers does not affect the triggers themselves.

REVOKE ALL ON FUNCTION public.handle_new_user()  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable()  FROM PUBLIC, anon, authenticated;

-- Still required by RLS policies for signed-in users; never needed by anon.
REVOKE ALL ON FUNCTION public.get_user_role()               FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_org_id()             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_restaurant_ids()     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_food_court_ids()     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_food_court_owner(uuid)     FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_org_id()          TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_restaurant_ids()  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_food_court_ids()  TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_food_court_owner(uuid)  TO authenticated;

-- 031 removed the only policy that referenced this (the food_court_members
-- bootstrap hole), so it is now dead code with no caller.
REVOKE ALL ON FUNCTION public.food_court_has_no_members(uuid) FROM PUBLIC, anon, authenticated;

-- ─── 3. Scope the anonymous menu read ───────────────────────────────────────
-- categories/customization_groups/customization_options each had a
-- `USING (true)` policy for anon, so the entire menu structure of every tenant
-- on the platform — including restaurants deliberately hidden with
-- is_active = false — was readable with nothing but the publishable anon key.
--
-- is_active is the existing public-visibility flag (023_restaurant_visibility):
-- get_public_storefront already refuses to resolve an inactive restaurant, so
-- gating on it changes nothing a real storefront can reach. menu_items is
-- already narrowed by `available = true` and gains the same restaurant gate.
--
-- The helper is SECURITY DEFINER because anon has no SELECT policy on
-- `restaurants`; an inline EXISTS would evaluate as the caller and return false
-- for everyone, blocking the storefront entirely.

CREATE OR REPLACE FUNCTION public.is_restaurant_public(p_restaurant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM restaurants WHERE id = p_restaurant_id AND is_active
  );
$function$;

REVOKE ALL ON FUNCTION public.is_restaurant_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_restaurant_public(uuid) TO anon, authenticated;

ALTER POLICY categories_select_public ON public.categories
  TO anon USING (is_restaurant_public(restaurant_id));

ALTER POLICY cg_select_public ON public.customization_groups
  TO anon USING (is_restaurant_public(restaurant_id));

ALTER POLICY co_select_public ON public.customization_options
  TO anon USING (is_restaurant_public(restaurant_id));

ALTER POLICY menu_items_select_public ON public.menu_items
  TO anon USING (available = true AND is_restaurant_public(restaurant_id));

-- ─── 4. Make the deny on counter tables explicit ────────────────────────────
-- Both tables have RLS enabled with no policies, which already denies everyone
-- except the owner. Stating it as a policy documents that this is intentional
-- (they are written only by SECURITY DEFINER order-numbering functions) and
-- clears the rls_enabled_no_policy advisory.

DROP POLICY IF EXISTS daily_sequences_no_access ON public.daily_sequences;
CREATE POLICY daily_sequences_no_access ON public.daily_sequences
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS order_number_counters_no_access ON public.order_number_counters;
CREATE POLICY order_number_counters_no_access ON public.order_number_counters
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- ─── 5. Normalise currency ──────────────────────────────────────────────────
-- Three restaurants still carried the original EUR / Europe/Madrid seed values
-- while the five real ones are USD / America/Panama. Cross-scope revenue totals
-- are only meaningful in one currency, and Panama is the market.

UPDATE public.restaurants
SET currency = 'USD',
    timezone = 'America/Panama'
WHERE currency = 'EUR' OR timezone = 'Europe/Madrid';

-- ─── 6. Manual follow-up (not expressible in SQL) ───────────────────────────
-- Enable leaked-password protection (Supabase Auth checks candidate passwords
-- against HaveIBeenPwned):
--   Dashboard -> Authentication -> Policies -> "Prevent use of leaked passwords"
-- Advisor: auth_leaked_password_protection.
