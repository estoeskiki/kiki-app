-- 026_order_numbers_share_food_court_sequence.sql
-- Found in load-test round 2: direct-restaurant orders (restaurant QR/slug,
-- food_court_id NULL) and food-court cart orders drew from independent
-- counters ('r:<id>' vs 'fc:<id>'), so staff saw two interleaved sequences
-- with duplicate numbers on the same board.
--
-- Fix: next_order_number() resolves the restaurant's food court — a restaurant
-- inside a food court shares the food court's daily sequence. Standalone
-- restaurants keep their own.
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
  v_scope text;
  v_num   integer;
BEGIN
  -- Resolve the restaurant's food court so both entry paths share one sequence.
  IF v_fc IS NULL AND p_restaurant_id IS NOT NULL THEN
    SELECT food_court_id INTO v_fc FROM restaurants WHERE id = p_restaurant_id;
  END IF;

  v_scope := CASE
    WHEN v_fc IS NOT NULL THEN 'fc:' || v_fc::text
    ELSE 'r:' || p_restaurant_id::text
  END;

  INSERT INTO order_number_counters (scope_key, day, last_number)
  VALUES (v_scope, CURRENT_DATE, 101)
  ON CONFLICT (scope_key, day)
  DO UPDATE SET last_number = order_number_counters.last_number + 1
  RETURNING last_number INTO v_num;

  RETURN v_num;
END;
$function$;
