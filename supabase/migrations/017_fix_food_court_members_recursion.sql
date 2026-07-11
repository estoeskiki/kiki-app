-- ============================================================================
-- Migration: 017_fix_food_court_members_recursion.sql
-- Description: Fixes "infinite recursion detected in policy for relation
-- food_court_members" — its SELECT/INSERT policies queried
-- food_court_members from within their own USING/WITH CHECK clause, which
-- re-triggers the same RLS policy on the same table forever. The existing
-- get_user_restaurant_ids() (001/002 migrations) already established the
-- correct pattern for this: wrap the membership lookup in a SECURITY
-- DEFINER function, whose internal query runs as the function owner and so
-- bypasses RLS instead of re-evaluating it.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_food_court_ids()
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(food_court_id), ARRAY[]::uuid[])
  FROM food_court_members
  WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_food_court_owner(p_food_court_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM food_court_members
    WHERE food_court_id = p_food_court_id AND user_id = auth.uid() AND role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION food_court_has_no_members(p_food_court_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM food_court_members WHERE food_court_id = p_food_court_id);
$$;

DROP POLICY IF EXISTS "fc_members_select" ON food_court_members;
CREATE POLICY "fc_members_select" ON food_court_members
  FOR SELECT USING (food_court_id = ANY (get_user_food_court_ids()));

DROP POLICY IF EXISTS "fc_members_insert" ON food_court_members;
CREATE POLICY "fc_members_insert" ON food_court_members
  FOR INSERT WITH CHECK (
    is_food_court_owner(food_court_id) OR food_court_has_no_members(food_court_id)
  );
