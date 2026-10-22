-- ============================================================================
-- Migration: 049_yappy_payments.sql
-- Description: Yappy Botón de Pago (pay-first) for web orders, UAT only, and
-- only at Plaza Mayor Food Hall. Purely additive: create-web-order,
-- get_public_storefront, the kiosk and the KDS are untouched.
--
-- Flow:
--   yappy-create  prices the cart, freezes it as `snapshot`, calls Yappy.
--   yappy-ipn     receives Yappy's GET callback and calls yappy_apply_ipn().
--   status 'E'    -> the Kiki order is created HERE, in one transaction, from
--                    the snapshot — never from amounts in the IPN.
--
-- Invariants this schema enforces:
--   * The money record survives. 'executed' commits even when creating the
--     order fails; the failure lands in fulfillment_error and in
--     yappy_attention instead of rolling the payment back.
--   * 'executed' is terminal, and 'E' is accepted from every other state: a
--     payment-wc call that timed out may still have charged the customer.
--   * One active attempt per phone and per cart (partial unique indexes).
--   * Two sibling attempts of the same cart that both execute produce one
--     order; the second is flagged refund_required.
--
-- Secrets (merchant id, secret key) live in Edge Function secrets, never here.
-- ============================================================================

-- ─── 1. Venues with Yappy enabled ──────────────────────────────────────────
CREATE TABLE public.yappy_merchants (
  food_court_id   uuid PRIMARY KEY REFERENCES public.food_courts(id) ON DELETE CASCADE,
  env             text NOT NULL CHECK (env IN ('uat', 'prod')),
  enabled         boolean NOT NULL DEFAULT false,
  -- Exactly as registered in Yappy Comercial; must match urlDomain/domain.
  domain          text NOT NULL,
  -- Set by the circuit breaker in yappy_begin_payment.
  disabled_reason text,
  disabled_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_yappy_merchants_updated_at
  BEFORE UPDATE ON public.yappy_merchants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO public.yappy_merchants (food_court_id, env, enabled, domain) VALUES
  ('fc000000-0000-0000-0000-000000000001', 'uat', true, 'https://order.estoeskiki.com')
ON CONFLICT (food_court_id) DO NOTHING;

-- ─── 2. Payment attempts ───────────────────────────────────────────────────
CREATE TABLE public.yappy_payments (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- orderId sent to Yappy: alphanumeric, 1–32 chars, unique per attempt.
  yappy_order_id              text NOT NULL UNIQUE
                              DEFAULT replace(gen_random_uuid()::text, '-', '')
                              CHECK (yappy_order_id ~ '^[A-Za-z0-9]{1,32}$'),
  env                         text NOT NULL CHECK (env IN ('uat', 'prod')),
  food_court_id               uuid NOT NULL REFERENCES public.food_courts(id),
  table_id                    uuid REFERENCES public.tables(id) ON DELETE SET NULL,
  -- One per cart on the client; a retry after a terminal state gets a new one.
  checkout_key                uuid NOT NULL,
  alias_yappy                 text NOT NULL CHECK (alias_yappy ~ '^[0-9]{8}$'),
  client_ip                   text,

  -- Cents, like every other amount in Kiki. Converted to "5.35" only at the
  -- Yappy boundary. Yappy's per-transaction range is $0.01–$9,999.99.
  subtotal_cents              integer NOT NULL CHECK (subtotal_cents >= 1),
  tax_cents                   integer NOT NULL CHECK (tax_cents >= 0),
  total_cents                 integer NOT NULL
                              CHECK (total_cents BETWEEN 1 AND 999999
                                     AND total_cents = subtotal_cents + tax_cents),
  -- Insert-ready rows for orders/sub_orders/order_items/customizations,
  -- frozen at the moment of charging. See yappy_apply_ipn for the shape.
  snapshot                    jsonb NOT NULL,

  -- From payment-wc. Kept so a repeated create for the same cart can hand the
  -- client the same transaction instead of charging twice.
  transaction_id              text,
  yappy_token                 text,
  document_name               text,

  status                      text NOT NULL DEFAULT 'creating'
                              CHECK (status IN ('creating', 'created', 'unknown', 'failed',
                                                'cancelled', 'expired', 'executed')),
  -- Last status letter received from a hash-valid IPN; NULL = Yappy never
  -- told us anything (an 'expired' row with NULL here timed out locally).
  ipn_status                  text,
  confirmation_number         text,
  error_code                  text,

  fulfillment_error           text,
  fulfillment_warning         text,
  duplicate_of                uuid REFERENCES public.yappy_payments(id),
  refund_required             boolean NOT NULL DEFAULT false,
  client_reported_success_at  timestamptz,
  order_id                    uuid UNIQUE REFERENCES public.orders(id) ON DELETE SET NULL,

  -- Runbook bookkeeping: an attention row stays listed until resolved.
  resolved_at                 timestamptz,
  resolution_note             text,

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  -- Yappy gives the customer 5 minutes to confirm in the app.
  expires_at                  timestamptz NOT NULL DEFAULT now() + interval '5 minutes'
);

CREATE TRIGGER trg_yappy_payments_updated_at
  BEFORE UPDATE ON public.yappy_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- One active attempt per phone and per cart, guaranteed by the database
-- rather than by whichever request wins a race.
CREATE UNIQUE INDEX yappy_payments_active_alias
  ON public.yappy_payments (alias_yappy)
  WHERE status IN ('creating', 'created', 'unknown');
CREATE UNIQUE INDEX yappy_payments_active_checkout
  ON public.yappy_payments (checkout_key)
  WHERE status IN ('creating', 'created', 'unknown');

CREATE INDEX yappy_payments_checkout_key ON public.yappy_payments (checkout_key);
CREATE INDEX yappy_payments_venue_created ON public.yappy_payments (food_court_id, created_at DESC);
CREATE INDEX yappy_payments_alias_created ON public.yappy_payments (alias_yappy, created_at DESC);

-- ─── 3. Raw IPN log (append-only) ──────────────────────────────────────────
CREATE TABLE public.yappy_ipn_events (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  raw_query       text NOT NULL,
  yappy_order_id  text,
  status          text,
  -- NULL until checked; stays NULL when the orderId matched no payment.
  hash_valid      boolean,
  outcome         text,
  received_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX yappy_ipn_events_order ON public.yappy_ipn_events (yappy_order_id);

-- ─── 4. Lock everything down (035 convention) ──────────────────────────────
-- Customers are anonymous; they reach their own payment only through
-- get_yappy_payment_status below. Every write goes through service_role.
ALTER TABLE public.yappy_merchants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yappy_payments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yappy_ipn_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY yappy_merchants_no_access ON public.yappy_merchants
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY yappy_payments_no_access ON public.yappy_payments
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY yappy_ipn_events_no_access ON public.yappy_ipn_events
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

REVOKE ALL ON public.yappy_merchants  FROM anon, authenticated;
REVOKE ALL ON public.yappy_payments   FROM anon, authenticated;
REVOKE ALL ON public.yappy_ipn_events FROM anon, authenticated;

-- ─── 5. Begin an attempt ───────────────────────────────────────────────────
-- Returns jsonb rather than raising: the circuit breaker's UPDATE must commit
-- even when this call refuses the attempt.
CREATE OR REPLACE FUNCTION public.yappy_begin_payment(
  p_food_court_id  uuid,
  p_table_id       uuid,
  p_checkout_key   uuid,
  p_alias          text,
  p_client_ip      text,
  p_subtotal_cents integer,
  p_tax_cents      integer,
  p_total_cents    integer,
  p_snapshot       jsonb
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
  -- Serialize attempts per venue so the rate limits and the breaker count
  -- what they think they count.
  PERFORM pg_advisory_xact_lock(hashtext('yappy:' || p_food_court_id::text));

  SELECT * INTO v_merchant FROM yappy_merchants WHERE food_court_id = p_food_court_id;
  IF NOT FOUND OR NOT v_merchant.enabled THEN
    RETURN jsonb_build_object('error', 'yappy_unavailable');
  END IF;

  -- 1. Free stale active rows (frees the alias/cart indexes). Yappy's window
  -- is 5 min; 10 min leaves slack for a late IPN, which is still accepted.
  UPDATE yappy_payments
     SET status = 'expired'
   WHERE food_court_id = p_food_court_id
     AND status IN ('creating', 'created', 'unknown')
     AND created_at < now() - interval '10 minutes';

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

  -- 4. Insert. The alias index rejects a second live attempt from another
  -- tab/cart with the same phone.
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

-- ─── 6. Record what payment-wc said ────────────────────────────────────────
-- Conditional on 'creating' so a late IPN that already moved the row is
-- never overwritten. transaction_id is still recorded when missing.
CREATE OR REPLACE FUNCTION public.yappy_mark_created(
  p_payment_id uuid, p_transaction_id text, p_token text, p_document_name text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH u AS (
    UPDATE yappy_payments
       SET status         = CASE WHEN status = 'creating' THEN 'created' ELSE status END,
           transaction_id = coalesce(transaction_id, p_transaction_id),
           yappy_token    = coalesce(yappy_token, p_token),
           document_name  = coalesce(document_name, p_document_name)
     WHERE id = p_payment_id
    RETURNING status
  )
  SELECT coalesce((SELECT status = 'created' FROM u), false);
$function$;

CREATE OR REPLACE FUNCTION public.yappy_mark_failed(p_payment_id uuid, p_error_code text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH u AS (
    UPDATE yappy_payments SET status = 'failed', error_code = p_error_code
     WHERE id = p_payment_id AND status = 'creating'
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM u);
$function$;

CREATE OR REPLACE FUNCTION public.yappy_mark_unknown(p_payment_id uuid, p_error_code text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH u AS (
    UPDATE yappy_payments SET status = 'unknown', error_code = p_error_code
     WHERE id = p_payment_id AND status = 'creating'
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM u);
$function$;

-- ─── 7. Apply a hash-valid IPN ─────────────────────────────────────────────
-- Snapshot shape (built by supabase/functions/_shared/pricing.ts):
--   { "order": { restaurant_id, order_type, subtotal, tax, total,
--                customer_name, customer_phone, table_id, table_label,
--                table_number, delivery_address },
--     "sub_orders": [ { restaurant_id, subtotal, tax, total, notes,
--                       "items": [ { menu_item_id, item_name, item_price,
--                                    quantity, line_total,
--                                    "customizations": [ { group_name,
--                                      option_name, price_modifier } ] } ] } ] }
CREATE OR REPLACE FUNCTION public.yappy_apply_ipn(
  p_yappy_order_id text,
  p_status         text,
  p_confirmation   text,
  p_event_id       bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pay       yappy_payments;
  v_sibling   uuid;
  v_outcome   text;
  v_snap      jsonb;
  v_o         jsonb;
  v_so        jsonb;
  v_it        jsonb;
  v_cu        jsonb;
  v_order_id  uuid;
  v_sub_id    uuid;
  v_item_id   uuid;
  v_number    integer;
  v_warnings  text[] := '{}';
  v_sum_sub   integer;
  v_sum_tax   integer;
  v_sum_lines integer;
BEGIN
  SELECT * INTO v_pay FROM yappy_payments WHERE yappy_order_id = p_yappy_order_id FOR UPDATE;
  IF NOT FOUND THEN
    v_outcome := 'unknown_order';
  ELSIF v_pay.status = 'executed' THEN
    v_outcome := 'already_executed';
  ELSIF p_status IN ('C', 'X') THEN
    UPDATE yappy_payments
       SET status = CASE p_status WHEN 'C' THEN 'cancelled' ELSE 'expired' END,
           ipn_status = p_status
     WHERE id = v_pay.id;
    v_outcome := CASE p_status WHEN 'C' THEN 'cancelled' ELSE 'expired' END;
  ELSIF p_status IS DISTINCT FROM 'E' THEN
    UPDATE yappy_payments SET ipn_status = p_status WHERE id = v_pay.id;
    v_outcome := 'ignored_status';
  END IF;

  IF v_outcome IS NOT NULL THEN
    IF p_event_id IS NOT NULL THEN
      UPDATE yappy_ipn_events SET outcome = v_outcome WHERE id = p_event_id;
    END IF;
    RETURN jsonb_build_object('outcome', v_outcome, 'order_id', v_pay.order_id);
  END IF;

  -- ── 'E': record the money first. This commits whatever happens below.
  UPDATE yappy_payments
     SET status = 'executed', ipn_status = 'E', confirmation_number = p_confirmation
   WHERE id = v_pay.id;

  -- Serialize siblings of the same cart; the second executed one never
  -- creates a second order.
  PERFORM pg_advisory_xact_lock(hashtext('yappy-ck:' || v_pay.checkout_key::text));
  SELECT id INTO v_sibling
    FROM yappy_payments
   WHERE checkout_key = v_pay.checkout_key AND id <> v_pay.id AND order_id IS NOT NULL
   LIMIT 1;
  IF v_sibling IS NOT NULL THEN
    UPDATE yappy_payments SET duplicate_of = v_sibling, refund_required = true WHERE id = v_pay.id;
    v_outcome := 'duplicate_refund_required';
  ELSE
    v_snap := v_pay.snapshot;
    v_o := v_snap->'order';

    -- Savepoint: a broken snapshot rolls back only the order rows, never the
    -- 'executed' record above.
    BEGIN
      -- Integrity of what we charged. Mismatch is a warning, not a stop:
      -- the customer has already paid.
      v_sum_sub := 0; v_sum_tax := 0;
      FOR v_so IN SELECT * FROM jsonb_array_elements(v_snap->'sub_orders') LOOP
        v_sum_lines := 0;
        FOR v_it IN SELECT * FROM jsonb_array_elements(v_so->'items') LOOP
          IF (v_it->>'item_price')::int * (v_it->>'quantity')::int <> (v_it->>'line_total')::int THEN
            v_warnings := v_warnings || ('line_total_mismatch:' || (v_it->>'menu_item_id'));
          END IF;
          v_sum_lines := v_sum_lines + (v_it->>'line_total')::int;
        END LOOP;
        IF v_sum_lines <> (v_so->>'subtotal')::int
           OR (v_so->>'subtotal')::int + (v_so->>'tax')::int <> (v_so->>'total')::int THEN
          v_warnings := v_warnings || ('sub_order_totals_mismatch:' || (v_so->>'restaurant_id'));
        END IF;
        v_sum_sub := v_sum_sub + (v_so->>'subtotal')::int;
        v_sum_tax := v_sum_tax + (v_so->>'tax')::int;
      END LOOP;
      IF v_sum_sub <> (v_o->>'subtotal')::int OR v_sum_tax <> (v_o->>'tax')::int
         OR (v_o->>'total')::int <> v_pay.total_cents
         OR (v_o->>'subtotal')::int <> v_pay.subtotal_cents THEN
        v_warnings := v_warnings || 'order_totals_mismatch'::text;
      END IF;

      -- Things that changed while the customer was paying.
      v_warnings := v_warnings || ARRAY(
        SELECT 'restaurant_closed:' || r.id
          FROM jsonb_array_elements(v_snap->'sub_orders') so
          JOIN restaurants r ON r.id = (so->>'restaurant_id')::uuid
         WHERE r.is_open = false
      );
      v_warnings := v_warnings || ARRAY(
        SELECT 'item_unavailable:' || m.id
          FROM jsonb_array_elements(v_snap->'sub_orders') so,
               jsonb_array_elements(so->'items') it
          JOIN menu_items m ON m.id = (it->>'menu_item_id')::uuid
         WHERE m.available = false
      );

      -- Same counter create-web-order uses (scope fc:<id>); COS has its own.
      v_number := next_order_number(NULL, v_pay.food_court_id);

      INSERT INTO orders (
        restaurant_id, food_court_id, order_number, order_type, status,
        subtotal, tax, total, customer_name, customer_phone, channel,
        payment_method, payment_status, table_id, table_label, table_number,
        delivery_address, notes
      ) VALUES (
        (v_o->>'restaurant_id')::uuid, v_pay.food_court_id, v_number, v_o->>'order_type', 'confirmed',
        (v_o->>'subtotal')::int, (v_o->>'tax')::int, (v_o->>'total')::int,
        v_o->>'customer_name', v_o->>'customer_phone', 'web',
        'yappy', 'paid', (v_o->>'table_id')::uuid, v_o->>'table_label', v_o->>'table_number',
        CASE WHEN jsonb_typeof(v_o->'delivery_address') = 'object' THEN v_o->'delivery_address' END,
        NULL
      )
      RETURNING id INTO v_order_id;

      FOR v_so IN SELECT * FROM jsonb_array_elements(v_snap->'sub_orders') LOOP
        INSERT INTO sub_orders (
          order_id, restaurant_id, order_number, customer_name, customer_phone,
          order_type, status, subtotal, tax, total, channel, payment_method,
          payment_status, table_label, table_number, delivery_address, notes
        ) VALUES (
          v_order_id, (v_so->>'restaurant_id')::uuid, v_number,
          v_o->>'customer_name', v_o->>'customer_phone',
          v_o->>'order_type', 'confirmed',
          (v_so->>'subtotal')::int, (v_so->>'tax')::int, (v_so->>'total')::int,
          'web', 'yappy', 'paid', v_o->>'table_label', v_o->>'table_number',
          CASE WHEN jsonb_typeof(v_o->'delivery_address') = 'object' THEN v_o->'delivery_address' END,
          nullif(v_so->>'notes', '')
        )
        RETURNING id INTO v_sub_id;

        FOR v_it IN SELECT * FROM jsonb_array_elements(v_so->'items') LOOP
          INSERT INTO order_items (
            order_id, sub_order_id, restaurant_id, menu_item_id,
            item_name, item_price, quantity, line_total
          ) VALUES (
            v_order_id, v_sub_id, (v_so->>'restaurant_id')::uuid, (v_it->>'menu_item_id')::uuid,
            v_it->>'item_name', (v_it->>'item_price')::int, (v_it->>'quantity')::int,
            (v_it->>'line_total')::int
          )
          RETURNING id INTO v_item_id;

          FOR v_cu IN SELECT * FROM jsonb_array_elements(coalesce(v_it->'customizations', '[]'::jsonb)) LOOP
            INSERT INTO order_item_customizations (
              order_item_id, restaurant_id, group_name, option_name, price_modifier
            ) VALUES (
              v_item_id, (v_so->>'restaurant_id')::uuid, v_cu->>'group_name',
              v_cu->>'option_name', (v_cu->>'price_modifier')::int
            );
          END LOOP;
        END LOOP;
      END LOOP;

      UPDATE yappy_payments
         SET order_id = v_order_id,
             fulfillment_warning = nullif(array_to_string(v_warnings, '; '), '')
       WHERE id = v_pay.id;
      v_outcome := 'executed_order_created';
    EXCEPTION WHEN OTHERS THEN
      UPDATE yappy_payments
         SET fulfillment_error = SQLSTATE || ': ' || SQLERRM
       WHERE id = v_pay.id;
      v_order_id := NULL;
      v_outcome := 'executed_fulfillment_error';
    END;
  END IF;

  IF p_event_id IS NOT NULL THEN
    UPDATE yappy_ipn_events SET outcome = v_outcome WHERE id = p_event_id;
  END IF;
  RETURN jsonb_build_object('outcome', v_outcome, 'order_id', v_order_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.yappy_begin_payment(uuid, uuid, uuid, text, text, integer, integer, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.yappy_mark_created(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.yappy_mark_failed(uuid, text)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.yappy_mark_unknown(uuid, text)             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.yappy_apply_ipn(text, text, text, bigint)  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.yappy_begin_payment(uuid, uuid, uuid, text, text, integer, integer, integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.yappy_mark_created(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.yappy_mark_failed(uuid, text)              TO service_role;
GRANT EXECUTE ON FUNCTION public.yappy_mark_unknown(uuid, text)             TO service_role;
GRANT EXECUTE ON FUNCTION public.yappy_apply_ipn(text, text, text, bigint)  TO service_role;

-- ─── 8. Anonymous RPCs for order-web ───────────────────────────────────────
-- Whether this table's venue can pay with Yappy right now. UAT only answers
-- Mon–Fri 07:00–18:30 Panama time; outside it the option is hidden.
CREATE OR REPLACE FUNCTION public.get_payment_options(p_table_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fc      uuid;
  v_m       yappy_merchants;
  v_local   timestamp := now() AT TIME ZONE 'America/Panama';
BEGIN
  SELECT food_court_id INTO v_fc FROM tables WHERE qr_token = p_table_token AND is_active;
  IF v_fc IS NULL THEN
    RETURN jsonb_build_object('yappy', false, 'reason', 'no_venue');
  END IF;
  SELECT * INTO v_m FROM yappy_merchants WHERE food_court_id = v_fc;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('yappy', false, 'reason', 'not_enabled');
  END IF;
  IF NOT v_m.enabled THEN
    RETURN jsonb_build_object('yappy', false, 'reason', 'disabled');
  END IF;
  IF v_m.env = 'uat' AND NOT (
       extract(isodow FROM v_local) BETWEEN 1 AND 5
       AND v_local::time BETWEEN time '07:00' AND time '18:30'
     ) THEN
    RETURN jsonb_build_object('yappy', false, 'reason', 'outside_uat_hours');
  END IF;
  RETURN jsonb_build_object('yappy', true, 'reason', null);
END;
$function$;

-- The payment UUID is a bearer link held only by the client that created it.
-- Never exposes phone, snapshot or Yappy credentials. 24h window like the
-- order tracker (030).
CREATE OR REPLACE FUNCTION public.get_yappy_payment_status(p_payment_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'status',              p.status,
    'ipn_received',        p.ipn_status IS NOT NULL,
    'order_id',            CASE WHEN p.status = 'executed' THEN p.order_id END,
    'order_number',        CASE WHEN p.status = 'executed' THEN o.order_number END,
    'confirmation_number', CASE WHEN p.status = 'executed' THEN p.confirmation_number END,
    'error_code',          p.error_code,
    'total_cents',         p.total_cents,
    'expires_at',          p.expires_at
  )
  FROM yappy_payments p
  LEFT JOIN orders o ON o.id = p.order_id
  WHERE p.id = p_payment_id
    AND p.created_at > now() - interval '24 hours';
$function$;

REVOKE ALL ON FUNCTION public.get_payment_options(text)      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_yappy_payment_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_payment_options(text)      TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_yappy_payment_status(uuid) TO anon, authenticated, service_role;

-- ─── 9. What needs a human ─────────────────────────────────────────────────
-- security_invoker so the view never bypasses RLS on its own; service_role
-- reads it directly, platform admins through get_yappy_attention().
CREATE VIEW public.yappy_attention WITH (security_invoker = true) AS
  SELECT 'stale_pending'::text AS kind, p.id AS payment_id, p.food_court_id, p.yappy_order_id,
         p.status, p.total_cents AS amount_cents,
         'Sin respuesta de Yappy tras 10 min; revisar en Yappy Comercial' AS detail, p.created_at
    FROM yappy_payments p
   WHERE p.status IN ('creating', 'created', 'unknown')
     AND p.created_at < now() - interval '10 minutes' AND p.resolved_at IS NULL
  UNION ALL
  SELECT 'expired_without_ipn', p.id, p.food_court_id, p.yappy_order_id, p.status, p.total_cents,
         'Expirado localmente, Yappy nunca envió IPN' || coalesce(' (' || p.error_code || ')', ''),
         p.created_at
    FROM yappy_payments p
   WHERE p.status = 'expired' AND p.ipn_status IS NULL AND p.resolved_at IS NULL
  UNION ALL
  SELECT 'paid_without_order', p.id, p.food_court_id, p.yappy_order_id, p.status, p.total_cents,
         coalesce(p.fulfillment_error, 'Pagado sin orden'), p.created_at
    FROM yappy_payments p
   WHERE p.status = 'executed' AND p.order_id IS NULL AND p.duplicate_of IS NULL AND p.resolved_at IS NULL
  UNION ALL
  SELECT 'fulfillment_warning', p.id, p.food_court_id, p.yappy_order_id, p.status, p.total_cents,
         p.fulfillment_warning, p.created_at
    FROM yappy_payments p
   WHERE p.fulfillment_warning IS NOT NULL AND p.resolved_at IS NULL
  UNION ALL
  SELECT 'refund_required', p.id, p.food_court_id, p.yappy_order_id, p.status, p.total_cents,
         'Cobro duplicado del mismo carrito; devolver desde Yappy Comercial', p.created_at
    FROM yappy_payments p
   WHERE p.refund_required AND p.resolved_at IS NULL
  UNION ALL
  SELECT 'client_success_without_ipn', p.id, p.food_court_id, p.yappy_order_id, p.status, p.total_cents,
         'El botón reportó éxito pero no llegó IPN', p.created_at
    FROM yappy_payments p
   WHERE p.client_reported_success_at IS NOT NULL AND p.ipn_status IS NULL
     AND p.client_reported_success_at < now() - interval '2 minutes' AND p.resolved_at IS NULL
  UNION ALL
  SELECT 'sub_order_cancelled', p.id, p.food_court_id, p.yappy_order_id, p.status, so.total,
         'Local canceló una parte pagada: ' || r.name, p.created_at
    FROM yappy_payments p
    JOIN sub_orders so ON so.order_id = p.order_id AND so.status = 'cancelled'
    JOIN restaurants r ON r.id = so.restaurant_id
   WHERE p.status = 'executed' AND p.resolved_at IS NULL
  UNION ALL
  SELECT 'ipn_not_applied', NULL, NULL, e.yappy_order_id, e.status, NULL,
         'IPN con hash válido sin aplicar (evento ' || e.id || ')', e.received_at
    FROM yappy_ipn_events e
   WHERE e.hash_valid AND e.outcome IS NULL AND e.received_at < now() - interval '1 minute'
  UNION ALL
  SELECT 'invalid_hash_ipn', NULL, NULL, e.yappy_order_id, e.status, NULL,
         'IPN con hash inválido (evento ' || e.id || ')', e.received_at
    FROM yappy_ipn_events e
   WHERE e.hash_valid = false AND e.received_at > now() - interval '24 hours'
  UNION ALL
  SELECT 'merchant_disabled', NULL, m.food_court_id, NULL, NULL, NULL,
         m.disabled_reason, m.disabled_at
    FROM yappy_merchants m
   WHERE NOT m.enabled AND m.disabled_reason IS NOT NULL;

REVOKE ALL ON public.yappy_attention FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.yappy_attention TO service_role;

CREATE OR REPLACE FUNCTION public.get_yappy_attention()
RETURNS SETOF public.yappy_attention
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM yappy_attention ORDER BY created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_yappy_attention() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_yappy_attention() TO authenticated, service_role;
