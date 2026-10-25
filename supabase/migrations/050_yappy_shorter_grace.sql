-- Shorten the "don't pay again" wait after Yappy's 5 min window from 10 min to
-- 1 min (order-web PENDING_TTL_MS = 6 min). Stale active rows are now freed at
-- 5:30, 30 s before the client offers a retry, so a phone/server clock skew
-- doesn't turn that retry into alias_busy. A late IPN on an expired row is
-- still accepted by yappy_apply_ipn. Only step 1 changes; the rest is 049.

CREATE OR REPLACE FUNCTION public.yappy_begin_payment(
  p_food_court_id uuid,
  p_table_id uuid,
  p_checkout_key uuid,
  p_alias text,
  p_client_ip text,
  p_subtotal_cents integer,
  p_tax_cents integer,
  p_total_cents integer,
  p_snapshot jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_merchant yappy_merchants;
  v_existing yappy_payments;
  v_new      yappy_payments;
  v_count    integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('yappy:' || p_food_court_id::text));
  SELECT * INTO v_merchant FROM yappy_merchants WHERE food_court_id = p_food_court_id;
  IF NOT FOUND OR NOT v_merchant.enabled THEN
    RETURN jsonb_build_object('error', 'yappy_unavailable');
  END IF;

  -- 1. Free stale active rows (frees the alias/cart indexes). Yappy's window
  -- is 5 min; a late IPN is still accepted after this.
  UPDATE yappy_payments
     SET status = 'expired'
   WHERE food_court_id = p_food_court_id
     AND status IN ('creating', 'created', 'unknown')
     AND created_at < now() - interval '5 minutes 30 seconds';

  -- 2. Same cart already has a live attempt: hand it back, never re-charge.
  SELECT * INTO v_existing
    FROM yappy_payments
   WHERE checkout_key = p_checkout_key
     AND status IN ('creating', 'created', 'unknown');
  IF FOUND THEN
    RETURN jsonb_build_object(
      'existing',       true,
      'payment_id',     v_existing.id,
      'status',         v_existing.status,
      'yappy_order_id', v_existing.yappy_order_id,
      'transaction_id', v_existing.transaction_id,
      'token',          v_existing.yappy_token,
      'document_name',  v_existing.document_name,
      'expires_at',     v_existing.expires_at
    );
  END IF;

  -- 3. Rate limits over the last 10 minutes.
  SELECT count(*) INTO v_count FROM yappy_payments
   WHERE food_court_id = p_food_court_id AND created_at > now() - interval '10 minutes';
  IF v_count >= 40 THEN
    UPDATE yappy_merchants
       SET enabled = false,
           disabled_reason = 'circuit_breaker: >40 creates in 10 min',
           disabled_at = now()
     WHERE food_court_id = p_food_court_id;
    RETURN jsonb_build_object('error', 'yappy_unavailable');
  END IF;
  SELECT count(*) INTO v_count FROM yappy_payments
   WHERE alias_yappy = p_alias AND created_at > now() - interval '10 minutes';
  IF v_count >= 3 THEN
    RETURN jsonb_build_object('error', 'rate_limited');
  END IF;
  IF p_table_id IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM yappy_payments
     WHERE table_id = p_table_id AND created_at > now() - interval '10 minutes';
    IF v_count >= 10 THEN
      RETURN jsonb_build_object('error', 'rate_limited');
    END IF;
  END IF;
  IF p_client_ip IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM yappy_payments
     WHERE client_ip = p_client_ip AND created_at > now() - interval '10 minutes';
    IF v_count >= 10 THEN
      RETURN jsonb_build_object('error', 'rate_limited');
    END IF;
  END IF;

  -- 4. Insert; the partial unique indexes settle any race.
  BEGIN
    INSERT INTO yappy_payments (
      env, food_court_id, table_id, checkout_key, alias_yappy, client_ip,
      subtotal_cents, tax_cents, total_cents, snapshot
    ) VALUES (
      v_merchant.env, p_food_court_id, p_table_id, p_checkout_key, p_alias, p_client_ip,
      p_subtotal_cents, p_tax_cents, p_total_cents, p_snapshot
    )
    RETURNING * INTO v_new;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('error', 'alias_busy');
  END;

  RETURN jsonb_build_object(
    'existing',       false,
    'payment_id',     v_new.id,
    'status',         v_new.status,
    'yappy_order_id', v_new.yappy_order_id,
    'env',            v_new.env,
    'domain',         v_merchant.domain,
    'expires_at',     v_new.expires_at
  );
END;
$function$;
