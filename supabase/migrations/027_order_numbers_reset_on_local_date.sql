-- 027_order_numbers_reset_on_local_date.sql
-- The daily order-number counter keyed on CURRENT_DATE, which is UTC on this
-- instance. For a Panama (UTC-5) venue that means the sequence resets at 19:00
-- local — in the middle of dinner service, with staff seeing numbers restart
-- and collide with earlier orders from the same evening.
--
-- Key the counter on the venue's LOCAL date instead, resolved from
-- restaurants.timezone (all restaurants in a food court share a location).
CREATE OR REPLACE FUNCTION public.next_order_number(
  p_restaurant_id uuid DEFAULT NULL,
  p_food_court_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_fc    uuid := p_food_court_id;
  v_r_fc  uuid;
  v_tz    text;
  v_day   date;
  v_scope text;
  v_num   integer;
BEGIN
  -- Resolve the restaurant's food court (so both entry paths share one
  -- sequence) and its timezone in a single lookup.
  IF p_restaurant_id IS NOT NULL THEN
    SELECT food_court_id, timezone INTO v_r_fc, v_tz
    FROM restaurants WHERE id = p_restaurant_id;
    IF v_fc IS NULL THEN v_fc := v_r_fc; END IF;
  END IF;

  -- Food-court entry path: take the timezone from the food court's venues.
  IF v_tz IS NULL AND v_fc IS NOT NULL THEN
    SELECT timezone INTO v_tz
    FROM restaurants WHERE food_court_id = v_fc AND timezone IS NOT NULL LIMIT 1;
  END IF;

  v_tz  := COALESCE(v_tz, 'UTC');
  v_day := (now() AT TIME ZONE v_tz)::date;

  v_scope := CASE
    WHEN v_fc IS NOT NULL THEN 'fc:' || v_fc::text
    ELSE 'r:' || p_restaurant_id::text
  END;

  INSERT INTO order_number_counters (scope_key, day, last_number)
  VALUES (v_scope, v_day, 101)
  ON CONFLICT (scope_key, day)
  DO UPDATE SET last_number = order_number_counters.last_number + 1
  RETURNING last_number INTO v_num;

  RETURN v_num;
END;
$function$;
