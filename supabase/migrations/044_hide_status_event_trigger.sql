-- ============================================================================
-- Migration: 044_hide_status_event_trigger.sql
-- Description: log_sub_order_status_change() (042) is a trigger body, not an
-- API — but every function in `public` is published by PostgREST at
-- /rest/v1/rpc/<name> unless EXECUTE is explicitly revoked, and functions grant
-- EXECUTE to PUBLIC by default. Same class of finding 035 already fixed for
-- handle_new_user() and rls_auto_enable(): revoking EXECUTE from callers does
-- not affect the trigger itself (that's checked at CREATE TRIGGER time by the
-- trigger's creator, not per fire), so this is a pure hardening, no behavior
-- change.
-- ============================================================================

REVOKE ALL ON FUNCTION public.log_sub_order_status_change() FROM PUBLIC, anon, authenticated;
