-- ============================================================================
-- 008: FOOD COURT MEMBERS & CROSS-TENANT ACCESS
-- 
-- Key insight: A food court kiosk does NOT belong to any organization.
-- Restaurants belong to orgs, but a food court houses restaurants from
-- MULTIPLE different orgs. The kiosk belongs to the food court itself.
--
-- This migration introduces:
--   1. food_court_members — users/kiosks linked to a food court
--   2. device_tokens.org_id dropped (org is derived from restaurant)
--   3. get_user_restaurant_ids() checks BOTH membership tables
--   4. authenticate_device() routes to the correct membership table
-- ============================================================================

-- ============================================================================
-- 1. FOOD_COURT_MEMBERS (links users to food courts with roles)
-- ============================================================================
CREATE TABLE food_court_members (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_court_id   uuid NOT NULL REFERENCES food_courts(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('owner', 'manager', 'staff', 'kiosk_device')),
  display_name    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, food_court_id)
);

CREATE INDEX idx_fc_members_user ON food_court_members(user_id);
CREATE INDEX idx_fc_members_fc ON food_court_members(food_court_id);

ALTER TABLE food_court_members ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. DEVICE_TOKENS: drop org_id entirely.
--    Standalone kiosks derive org from their restaurant.
--    Food court kiosks have no org.
-- ============================================================================
ALTER TABLE device_tokens DROP COLUMN IF EXISTS org_id;

-- ============================================================================
-- 3. REWRITE get_user_restaurant_ids()
--    Now checks BOTH org_members AND food_court_members.
--    A food court member can see ALL restaurants in their food court,
--    regardless of which organization owns those restaurants.
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_restaurant_ids()
RETURNS uuid[] AS $$
DECLARE
  v_ids uuid[];
BEGIN
  -- Check org_members first (restaurant staff, org owners, standalone kiosks)
  SELECT CASE
    WHEN m.restaurant_id IS NULL THEN
      ARRAY(SELECT r.id FROM restaurants r WHERE r.org_id = m.org_id)
    ELSE
      ARRAY[m.restaurant_id]
  END INTO v_ids
  FROM org_members m
  WHERE m.user_id = auth.uid();

  -- If found via org_members, return immediately
  IF v_ids IS NOT NULL AND array_length(v_ids, 1) > 0 THEN
    RETURN v_ids;
  END IF;

  -- Check food_court_members (food court staff, food court kiosks)
  SELECT ARRAY(
    SELECT r.id FROM restaurants r
    WHERE r.food_court_id = fcm.food_court_id
  ) INTO v_ids
  FROM food_court_members fcm
  WHERE fcm.user_id = auth.uid()
  LIMIT 1;

  RETURN COALESCE(v_ids, ARRAY[]::uuid[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- 4. REWRITE get_user_org_id()
--    Food court members don't have an org_id — return NULL for them.
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS uuid AS $$
  SELECT org_id FROM org_members WHERE user_id = auth.uid() LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- 5. REWRITE get_user_role()
--    Check both membership tables.
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text AS $$
  SELECT role FROM (
    SELECT role FROM org_members WHERE user_id = auth.uid()
    UNION ALL
    SELECT role FROM food_court_members WHERE user_id = auth.uid()
  ) combined
  LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- 6. REWRITE authenticate_device()
--    Standalone kiosk → org_members
--    Food court kiosk → food_court_members
-- ============================================================================
DROP FUNCTION IF EXISTS authenticate_device(text);

CREATE OR REPLACE FUNCTION authenticate_device(p_token_hash text)
RETURNS TABLE(
  device_id uuid,
  ret_org_id uuid,
  ret_restaurant_id uuid,
  ret_food_court_id uuid,
  ret_device_name text
) AS $$
DECLARE
  v_token RECORD;
  v_org uuid;
BEGIN
  -- 1. Find the token
  SELECT dt.id, dt.restaurant_id, dt.food_court_id, dt.device_name
  INTO v_token
  FROM device_tokens dt
  WHERE dt.token_hash = p_token_hash
    AND dt.is_active = true;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- 2. Derive org_id from restaurant (NULL for food court kiosks)
  IF v_token.restaurant_id IS NOT NULL THEN
    SELECT r.org_id INTO v_org FROM restaurants r WHERE r.id = v_token.restaurant_id;
  END IF;

  -- 3. Create the correct membership for this anonymous kiosk user
  IF auth.uid() IS NOT NULL THEN
    IF v_token.food_court_id IS NOT NULL THEN
      -- FOOD COURT KIOSK → insert into food_court_members
      INSERT INTO food_court_members (user_id, food_court_id, role, display_name)
      VALUES (auth.uid(), v_token.food_court_id, 'kiosk_device', v_token.device_name)
      ON CONFLICT (user_id, food_court_id) DO UPDATE 
      SET role = EXCLUDED.role,
          display_name = EXCLUDED.display_name;
    ELSE
      -- STANDALONE KIOSK → insert into org_members (org derived from restaurant)
      INSERT INTO org_members (user_id, org_id, restaurant_id, role, display_name)
      VALUES (auth.uid(), v_org, v_token.restaurant_id, 'kiosk_device', v_token.device_name)
      ON CONFLICT (user_id, org_id) DO UPDATE 
      SET restaurant_id = EXCLUDED.restaurant_id,
          role = EXCLUDED.role;
    END IF;
  END IF;

  -- 4. Update last_seen
  UPDATE device_tokens
  SET last_seen_at = now()
  WHERE token_hash = p_token_hash AND is_active = true;

  -- 5. Return data (org derived, not stored on token)
  RETURN QUERY SELECT v_token.id, v_org, v_token.restaurant_id, v_token.food_court_id, v_token.device_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. RLS POLICIES for food_court_members
-- ============================================================================

-- Food court owners/managers can see their members
CREATE POLICY "fc_members_select" ON food_court_members
  FOR SELECT USING (
    food_court_id IN (
      SELECT fcm.food_court_id FROM food_court_members fcm 
      WHERE fcm.user_id = auth.uid()
    )
  );

-- Food court owners can manage members
CREATE POLICY "fc_members_insert" ON food_court_members
  FOR INSERT WITH CHECK (
    food_court_id IN (
      SELECT fcm.food_court_id FROM food_court_members fcm 
      WHERE fcm.user_id = auth.uid() AND fcm.role = 'owner'
    )
    OR NOT EXISTS (SELECT 1 FROM food_court_members fcm WHERE fcm.food_court_id = food_court_members.food_court_id)
  );

-- ============================================================================
-- 8. UPDATE food_courts RLS policy to include food_court_members
-- ============================================================================
DROP POLICY IF EXISTS "food_court_select" ON food_courts;

CREATE POLICY "food_court_select" ON food_courts
  FOR SELECT USING (
    -- Restaurant staff whose restaurant is in this food court
    id IN (
      SELECT r.food_court_id FROM restaurants r
      WHERE r.id = ANY(get_user_restaurant_ids())
      AND r.food_court_id IS NOT NULL
    )
    OR
    -- Direct food court members (venue staff, kiosks)
    id IN (
      SELECT fcm.food_court_id FROM food_court_members fcm
      WHERE fcm.user_id = auth.uid()
    )
  );
