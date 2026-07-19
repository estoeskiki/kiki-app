-- 028_order_numbers_service_day_4am.sql
-- Reset the daily order-number sequence at 04:00 local ("service day") rather
-- than midnight, so a venue running past midnight keeps one continuous
-- sequence for the whole night instead of flipping mid-service.
-- Orders placed 00:00–03:59 local belong to the previous calendar day.
--
--   18:00 Jul 19 -> service day 2026-07-19
--   23:59 Jul 19 -> service day 2026-07-19
--   00:30 Jul 20 -> service day 2026-07-19   (same night, sequence continues)
--   03:59 Jul 20 -> service day 2026-07-19
--   04:00 Jul 20 -> service day 2026-07-20   (resets to 101)
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
  -- Service day: shift back 4h so the boundary lands at 04:00 local.
  v_day := ((now() AT TIME ZONE v_tz) - interval '4 hours')::date;

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
