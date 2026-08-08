-- ============================================================================
-- Migration: 045_status_event_actor.sql
-- Description: Records who made each status transition, ahead of admin-web
-- gaining a manual status-override tool for emergencies. Without this, a
-- manual admin intervention is indistinguishable in the log from a normal
-- kiosk/KDS-driven transition — the one thing you actually want to audit for
-- an override tool is "did a human do this, and who."
--
-- Nullable on purpose: auth.uid() is only set for an authenticated request, and
-- while every legitimate caller of sub_orders UPDATE is authenticated staff
-- (RLS requires it), this stays permissive rather than making the column
-- NOT NULL and risking a future service-role write breaking silently.
-- ============================================================================

ALTER TABLE public.order_status_events
  ADD COLUMN IF NOT EXISTS actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.log_sub_order_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO order_status_events (sub_order_id, order_id, restaurant_id, from_status, to_status, actor_user_id)
    VALUES (NEW.id, NEW.order_id, NEW.restaurant_id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$function$;
