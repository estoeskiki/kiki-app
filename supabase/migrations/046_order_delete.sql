-- ============================================================================
-- Migration: 046_order_delete.sql
-- Description: Permanent deletion of an order, for test/junk rows that should
-- never have existed. Until now no DELETE policy existed on any order table,
-- so RLS denied deletion outright — this opens it, narrowly.
--
-- The guards live in the policy, not only in the Server Action, because RLS is
-- the actual boundary: a bug or a future caller that forgets to check must
-- still be unable to destroy a real sale. Three conditions, all in USING:
--
--   1. Platform admin only. Deleting revenue history is not tenant-level work.
--   2. No fiscal invoice on any stall. Panama's DGI holds a document tied to
--      that order; deleting our side leaves a record we can no longer explain.
--   3. Nothing paid. Money changed hands = it is not a test order, whatever
--      the caller believes.
--
-- Deletion cascades to sub_orders, order_items and order_status_events (their
-- FKs are ON DELETE CASCADE). Referential actions run as the system, not the
-- invoking role, so those children need no policy of their own — and equally,
-- the parent policy is the ONLY thing standing between a caller and all of it.
--
-- No soft-delete fallback here by design: an order that fails these checks is
-- meant to be cancelled, not hidden.
-- ============================================================================

-- Fiscal state and payment live on BOTH grains and must both be checked: the
-- parent carries fiscal_invoice_ids (uuid[]) / payment_status for the order as
-- a whole, each sub_order carries its own for that stall. Checking only the
-- children would let an order invoiced at the parent level be destroyed.
CREATE POLICY orders_delete ON public.orders
  FOR DELETE TO authenticated
  USING (
    is_platform_admin()
    AND coalesce(array_length(orders.fiscal_invoice_ids, 1), 0) = 0
    AND orders.payment_status <> 'paid'
    AND NOT EXISTS (
      SELECT 1
      FROM public.sub_orders so
      WHERE so.order_id = orders.id
        AND (so.fiscal_invoice_id IS NOT NULL OR so.payment_status = 'paid')
    )
  );

-- Verified by RLS impersonation in a rolled-back transaction:
--   non-admin + clean order      -> 0 rows
--   admin + parent payment=paid  -> 0 rows
--   admin + one stall paid       -> 0 rows
--   admin + clean order          -> 1 row, children cascaded to 0
