-- ============================================================================
-- Migration: 042_order_status_events.sql
-- Description: Records every sub_order status transition, so "how long was an
-- order in each state" can be answered precisely — something the schema could
-- not do before this. orders/sub_orders only ever carried a single `updated_at`,
-- overwritten by a generic BEFORE UPDATE trigger on every write (any write, not
-- just a status change), so the timestamp of a confirmed->preparing transition
-- was destroyed the moment the row moved to preparing->ready. There is no way
-- to recover that for orders that already transitioned before this migration —
-- this only starts logging going forward. dashboard_order_pipeline's
-- avg_fulfillment_seconds (041) remains the only fulfillment metric available
-- for historical orders.
--
-- Logged at sub_order grain, not the parent order: sub_order.status is the
-- actual source of truth (orders.status is *derived* from it by
-- sync_parent_order_status, see 001/033), and a food-court order's stalls
-- genuinely move through the pipeline independently of one another.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.order_status_events (
  id            uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  sub_order_id  uuid NOT NULL REFERENCES public.sub_orders(id) ON DELETE CASCADE,
  order_id      uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  -- Denormalized for RLS and for querying without a join back to sub_orders.
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  from_status   text NOT NULL,
  to_status     text NOT NULL,
  changed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_status_events_sub_order
  ON public.order_status_events (sub_order_id, changed_at);

CREATE INDEX IF NOT EXISTS idx_order_status_events_restaurant_date
  ON public.order_status_events (restaurant_id, changed_at DESC);

ALTER TABLE public.order_status_events ENABLE ROW LEVEL SECURITY;

-- Read-only for everyone except the trigger below. No INSERT/UPDATE/DELETE
-- policy is granted to authenticated at all — this table is a log, not
-- something staff edit, and the trigger function runs SECURITY DEFINER so it
-- does not need one.
DROP POLICY IF EXISTS order_status_events_select ON public.order_status_events;
CREATE POLICY order_status_events_select ON public.order_status_events
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR (restaurant_id = ANY (get_user_restaurant_ids())));

CREATE OR REPLACE FUNCTION public.log_sub_order_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO order_status_events (sub_order_id, order_id, restaurant_id, from_status, to_status)
    VALUES (NEW.id, NEW.order_id, NEW.restaurant_id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_log_sub_order_status_change ON public.sub_orders;
CREATE TRIGGER trg_log_sub_order_status_change
  AFTER UPDATE ON public.sub_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_sub_order_status_change();
