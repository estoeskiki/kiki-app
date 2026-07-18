-- 025_atomic_order_numbers.sql
-- Bug (found under concurrent load): next_order_number() did
--   SELECT MAX(order_number)+1
-- and returned it without inserting anything, in a transaction separate from
-- the order insert. Under concurrency, N callers read the same MAX -> duplicate
-- order numbers, and the number was handed out before the row existed -> insert
-- order != number order (backward "jumps", e.g. 142 -> 138 -> 143).
--
-- Replace with an atomic per-(scope, day) counter.

CREATE TABLE IF NOT EXISTS public.order_number_counters (
  scope_key   text    NOT NULL,   -- 'fc:<food_court_id>' or 'r:<restaurant_id>'
  day         date    NOT NULL,
  last_number integer NOT NULL,
  PRIMARY KEY (scope_key, day)
);

-- Only the SECURITY DEFINER function (running as owner) touches this table.
ALTER TABLE public.order_number_counters ENABLE ROW LEVEL SECURITY;

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
  v_scope text;
  v_num   integer;
BEGIN
  v_scope := CASE
    WHEN p_food_court_id IS NOT NULL THEN 'fc:' || p_food_court_id::text
    ELSE 'r:' || p_restaurant_id::text
  END;

  -- Atomic: the ON CONFLICT DO UPDATE takes a row lock on (scope_key, day), so
  -- concurrent callers serialize on that row and each gets a distinct,
  -- monotonically increasing number. Committed per RPC call, independent of the
  -- later order insert (a failed insert just leaves a harmless gap).
  INSERT INTO order_number_counters (scope_key, day, last_number)
  VALUES (v_scope, CURRENT_DATE, 101)
  ON CONFLICT (scope_key, day)
  DO UPDATE SET last_number = order_number_counters.last_number + 1
  RETURNING last_number INTO v_num;

  RETURN v_num;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.next_order_number(uuid, uuid) TO authenticated, service_role;
