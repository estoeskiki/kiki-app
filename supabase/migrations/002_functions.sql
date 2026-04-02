-- ============================================================================
-- Kiki Platform — Helper Functions
-- ============================================================================

-- ============================================================================
-- get_next_order_number()
-- Returns the next daily order number for a given restaurant.
-- Resets each day at midnight (in the restaurant's timezone).
-- ============================================================================
CREATE OR REPLACE FUNCTION get_next_order_number(p_restaurant_id uuid)
RETURNS integer AS $$
DECLARE
  v_timezone text;
  v_today date;
  v_next integer;
BEGIN
  -- Get the restaurant's timezone
  SELECT timezone INTO v_timezone
  FROM restaurants WHERE id = p_restaurant_id;

  -- Today in the restaurant's local time
  v_today := (now() AT TIME ZONE COALESCE(v_timezone, 'UTC'))::date;

  -- Get the max order number for today, default to 0
  SELECT COALESCE(MAX(order_number), 0) + 1 INTO v_next
  FROM orders
  WHERE restaurant_id = p_restaurant_id
    AND (created_at AT TIME ZONE COALESCE(v_timezone, 'UTC'))::date = v_today;

  RETURN v_next;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- authenticate_device(token)
-- Called by an Edge Function. Validates a device token and returns
-- the restaurant_id + org_id if valid.
-- ============================================================================
CREATE OR REPLACE FUNCTION authenticate_device(p_token_hash text)
RETURNS TABLE(
  device_id uuid,
  org_id uuid,
  restaurant_id uuid,
  device_name text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dt.id,
    dt.org_id,
    dt.restaurant_id,
    dt.device_name
  FROM device_tokens dt
  WHERE dt.token_hash = p_token_hash
    AND dt.is_active = true;

  -- Update last_seen
  UPDATE device_tokens
  SET last_seen_at = now()
  WHERE token_hash = p_token_hash AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- handle_new_user()
-- Trigger function: when a new auth.users row is created, check if
-- there's metadata to auto-create an org_members entry.
-- This is used during the signup flow.
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id uuid;
  v_restaurant_id uuid;
  v_role text;
  v_display_name text;
BEGIN
  -- Read from user metadata (set during signUp)
  v_org_id := (NEW.raw_user_meta_data ->> 'org_id')::uuid;
  v_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'staff');
  v_display_name := COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email);
  v_restaurant_id := (NEW.raw_user_meta_data ->> 'restaurant_id')::uuid;

  -- Only create membership if org_id is provided
  IF v_org_id IS NOT NULL THEN
    INSERT INTO public.org_members (user_id, org_id, restaurant_id, role, display_name)
    VALUES (NEW.id, v_org_id, v_restaurant_id, v_role, v_display_name);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
