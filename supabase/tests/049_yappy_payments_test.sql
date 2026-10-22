-- ============================================================================
-- Test matrix for 049_yappy_payments.sql.
--
-- Run AFTER the migration body inside one transaction that never commits:
--   BEGIN; <049 body>; <this file>
-- The final RAISE EXCEPTION carries the results and aborts the transaction,
-- so nothing (orders, order-number counters, payments) survives — pass or
-- fail. Same idea as the rolled-back verification in 046.
-- ============================================================================
DO $test$
DECLARE
  c_fc     constant uuid := 'fc000000-0000-0000-0000-000000000001';
  v_snap   jsonb;
  v_bad    jsonb;
  v_r      jsonb;
  v_p1     yappy_payments;
  v_p      yappy_payments;
  v_a      uuid;
  v_b      uuid;
  v_n      integer;
  v_log    text[] := '{}';
  v_ck     uuid;
  v_keys   text[];
BEGIN
  v_snap := jsonb_build_object(
    'order', jsonb_build_object(
      'restaurant_id', 'b0000000-0000-0000-0000-000000000001', 'order_type', 'dine-in',
      'subtotal', 797, 'tax', 0, 'total', 797,
      'customer_name', 'Test Yappy', 'customer_phone', '60000000',
      'table_id', NULL, 'table_label', 'Mesa 5', 'table_number', NULL, 'delivery_address', NULL),
    'sub_orders', jsonb_build_array(
      jsonb_build_object('restaurant_id', 'b0000000-0000-0000-0000-000000000001',
        'subtotal', 598, 'tax', 0, 'total', 598, 'notes', 'sin cebolla',
        'items', jsonb_build_array(jsonb_build_object(
          'menu_item_id', 'd0000000-0000-0000-0000-000000000020', 'item_name', 'Test A',
          'item_price', 299, 'quantity', 2, 'line_total', 598,
          'customizations', jsonb_build_array(jsonb_build_object(
            'group_name', 'Salsa', 'option_name', 'BBQ', 'price_modifier', 0))))),
      jsonb_build_object('restaurant_id', 'b0000000-0000-0000-0000-000000000003',
        'subtotal', 199, 'tax', 0, 'total', 199, 'notes', NULL,
        'items', jsonb_build_array(jsonb_build_object(
          'menu_item_id', 'd1000000-0000-0000-0000-000000000022', 'item_name', 'Test B',
          'item_price', 199, 'quantity', 1, 'line_total', 199, 'customizations', '[]'::jsonb)))));

  -- T1. begin → new; same checkout_key → same attempt back.
  v_ck := gen_random_uuid();
  v_r := yappy_begin_payment(c_fc, NULL, v_ck, '61000001', NULL, 797, 0, 797, v_snap);
  ASSERT v_r->>'existing' = 'false', 'T1 begin: ' || v_r::text;
  v_a := (v_r->>'payment_id')::uuid;
  ASSERT yappy_mark_created(v_a, 'TX-1', 'tok', 'transactions'), 'T1 mark_created';
  v_r := yappy_begin_payment(c_fc, NULL, v_ck, '61000001', NULL, 797, 0, 797, v_snap);
  ASSERT v_r->>'existing' = 'true' AND v_r->>'transaction_id' = 'TX-1', 'T1 reuse: ' || v_r::text;
  v_log := v_log || 'T1 begin+reuse ok'::text;

  -- T2. E creates the order, paid, with a number, 2 sub_orders, items, customization.
  SELECT * INTO v_p1 FROM yappy_payments WHERE id = v_a;
  v_r := yappy_apply_ipn(v_p1.yappy_order_id, 'E', 'CONF-1');
  ASSERT v_r->>'outcome' = 'executed_order_created', 'T2 outcome: ' || v_r::text;
  SELECT * INTO v_p FROM yappy_payments WHERE id = v_a;
  ASSERT v_p.status = 'executed' AND v_p.order_id IS NOT NULL AND v_p.confirmation_number = 'CONF-1', 'T2 row';
  ASSERT v_p.fulfillment_warning IS NULL, 'T2 warning: ' || v_p.fulfillment_warning;
  SELECT count(*) INTO v_n FROM orders
   WHERE id = v_p.order_id AND payment_status = 'paid' AND payment_method = 'yappy'
     AND total = 797 AND order_number >= 101 AND food_court_id = c_fc;
  ASSERT v_n = 1, 'T2 order';
  SELECT count(*) INTO v_n FROM sub_orders WHERE order_id = v_p.order_id AND payment_status = 'paid';
  ASSERT v_n = 2, 'T2 sub_orders';
  SELECT count(*) INTO v_n FROM order_items WHERE order_id = v_p.order_id;
  ASSERT v_n = 2, 'T2 items';
  SELECT count(*) INTO v_n FROM order_item_customizations c JOIN order_items i ON i.id = c.order_item_id
   WHERE i.order_id = v_p.order_id;
  ASSERT v_n = 1, 'T2 customizations';
  v_log := v_log || 'T2 E creates order ok'::text;

  -- T3. Repeated E is a no-op.
  v_r := yappy_apply_ipn(v_p1.yappy_order_id, 'E', 'CONF-1');
  ASSERT v_r->>'outcome' = 'already_executed', 'T3: ' || v_r::text;
  SELECT count(*) INTO v_n FROM orders o JOIN yappy_payments p ON p.order_id = o.id WHERE p.checkout_key = v_ck;
  ASSERT v_n = 1, 'T3 single order';
  v_log := v_log || 'T3 E repeated no-op ok'::text;

  -- T4. E then C: C ignored.
  v_r := yappy_apply_ipn(v_p1.yappy_order_id, 'C', NULL);
  ASSERT v_r->>'outcome' = 'already_executed', 'T4: ' || v_r::text;
  SELECT * INTO v_p FROM yappy_payments WHERE id = v_a;
  ASSERT v_p.status = 'executed', 'T4 status';
  v_log := v_log || 'T4 E then C ignored ok'::text;

  -- T5. C then E: ends executed with an order.
  v_r := yappy_begin_payment(c_fc, NULL, gen_random_uuid(), '61000002', NULL, 797, 0, 797, v_snap);
  v_b := (v_r->>'payment_id')::uuid;
  SELECT * INTO v_p FROM yappy_payments WHERE id = v_b;
  ASSERT (yappy_apply_ipn(v_p.yappy_order_id, 'C', NULL))->>'outcome' = 'cancelled', 'T5 C';
  v_r := yappy_apply_ipn(v_p.yappy_order_id, 'E', 'CONF-5');
  ASSERT v_r->>'outcome' = 'executed_order_created', 'T5 E: ' || v_r::text;
  v_log := v_log || 'T5 C then E executed ok'::text;

  -- T6. Two attempts of the same cart, both E → one order + refund_required.
  v_ck := gen_random_uuid();
  v_a := ((yappy_begin_payment(c_fc, NULL, v_ck, '61000003', NULL, 797, 0, 797, v_snap))->>'payment_id')::uuid;
  SELECT * INTO v_p1 FROM yappy_payments WHERE id = v_a;
  PERFORM yappy_apply_ipn(v_p1.yappy_order_id, 'X', NULL);     -- first attempt "expired"
  v_b := ((yappy_begin_payment(c_fc, NULL, v_ck, '61000003', NULL, 797, 0, 797, v_snap))->>'payment_id')::uuid;
  ASSERT v_b IS NOT NULL AND v_b <> v_a, 'T6 second attempt';
  SELECT * INTO v_p FROM yappy_payments WHERE id = v_b;
  ASSERT (yappy_apply_ipn(v_p.yappy_order_id, 'E', 'CONF-6b'))->>'outcome' = 'executed_order_created', 'T6 E b';
  v_r := yappy_apply_ipn(v_p1.yappy_order_id, 'E', 'CONF-6a');  -- late E on the "expired" one
  ASSERT v_r->>'outcome' = 'duplicate_refund_required', 'T6 E a: ' || v_r::text;
  SELECT * INTO v_p FROM yappy_payments WHERE id = v_a;
  ASSERT v_p.status = 'executed' AND v_p.refund_required AND v_p.duplicate_of = v_b AND v_p.order_id IS NULL, 'T6 row a';
  SELECT count(*) INTO v_n FROM yappy_payments WHERE checkout_key = v_ck AND order_id IS NOT NULL;
  ASSERT v_n = 1, 'T6 one order';
  SELECT count(*) INTO v_n FROM yappy_attention WHERE payment_id = v_a AND kind = 'refund_required';
  ASSERT v_n = 1, 'T6 attention';
  v_log := v_log || 'T6 sibling double E → 1 order + refund ok'::text;

  -- T7. Broken snapshot (FK) → executed, fulfillment_error, no order.
  v_bad := jsonb_set(v_snap, '{sub_orders,0,items,0,menu_item_id}', to_jsonb(gen_random_uuid()::text));
  v_a := ((yappy_begin_payment(c_fc, NULL, gen_random_uuid(), '61000004', NULL, 797, 0, 797, v_bad))->>'payment_id')::uuid;
  SELECT * INTO v_p FROM yappy_payments WHERE id = v_a;
  v_r := yappy_apply_ipn(v_p.yappy_order_id, 'E', 'CONF-7');
  ASSERT v_r->>'outcome' = 'executed_fulfillment_error', 'T7: ' || v_r::text;
  SELECT * INTO v_p FROM yappy_payments WHERE id = v_a;
  ASSERT v_p.status = 'executed' AND v_p.order_id IS NULL AND v_p.fulfillment_error LIKE '23503%', 'T7 row: ' || coalesce(v_p.fulfillment_error, 'null');
  SELECT count(*) INTO v_n FROM yappy_attention WHERE payment_id = v_a AND kind = 'paid_without_order';
  ASSERT v_n = 1, 'T7 attention';
  v_log := v_log || 'T7 broken snapshot → executed + error ok'::text;

  -- T8. Totals mismatch → warning, order still created.
  v_bad := jsonb_set(v_snap, '{sub_orders,1,subtotal}', '150');
  v_a := ((yappy_begin_payment(c_fc, NULL, gen_random_uuid(), '61000005', NULL, 797, 0, 797, v_bad))->>'payment_id')::uuid;
  SELECT * INTO v_p FROM yappy_payments WHERE id = v_a;
  ASSERT (yappy_apply_ipn(v_p.yappy_order_id, 'E', 'CONF-8'))->>'outcome' = 'executed_order_created', 'T8 E';
  SELECT * INTO v_p FROM yappy_payments WHERE id = v_a;
  ASSERT v_p.order_id IS NOT NULL AND v_p.fulfillment_warning LIKE '%mismatch%', 'T8 warning';
  v_log := v_log || 'T8 mismatch → warning + order ok'::text;

  -- T9. Unknown letter only recorded; unknown order id.
  v_a := ((yappy_begin_payment(c_fc, NULL, gen_random_uuid(), '61000006', NULL, 797, 0, 797, v_snap))->>'payment_id')::uuid;
  SELECT * INTO v_p FROM yappy_payments WHERE id = v_a;
  ASSERT (yappy_apply_ipn(v_p.yappy_order_id, 'Z', NULL))->>'outcome' = 'ignored_status', 'T9 Z';
  ASSERT (SELECT status FROM yappy_payments WHERE id = v_a) = 'creating', 'T9 status kept';
  ASSERT (yappy_apply_ipn('doesnotexist', 'E', NULL))->>'outcome' = 'unknown_order', 'T9 unknown';
  v_log := v_log || 'T9 unknown letter/order ok'::text;

  -- T10. Same phone, other cart, while one is live → alias_busy.
  v_r := yappy_begin_payment(c_fc, NULL, gen_random_uuid(), '61000006', NULL, 797, 0, 797, v_snap);
  ASSERT v_r->>'error' = 'alias_busy', 'T10: ' || v_r::text;
  v_log := v_log || 'T10 alias_busy ok'::text;

  -- T11. Alias rate limit: 3 per 10 min.
  FOR i IN 1..3 LOOP
    v_a := ((yappy_begin_payment(c_fc, NULL, gen_random_uuid(), '61000007', NULL, 797, 0, 797, v_snap))->>'payment_id')::uuid;
    ASSERT v_a IS NOT NULL, 'T11 attempt ' || i;
    PERFORM yappy_mark_failed(v_a, 'E005');
  END LOOP;
  v_r := yappy_begin_payment(c_fc, NULL, gen_random_uuid(), '61000007', NULL, 797, 0, 797, v_snap);
  ASSERT v_r->>'error' = 'rate_limited', 'T11: ' || v_r::text;
  v_log := v_log || 'T11 alias rate limit ok'::text;

  -- T12. mark_* only move 'creating'.
  ASSERT NOT yappy_mark_failed(v_a, 'E002'), 'T12 failed twice';
  v_log := v_log || 'T12 conditional marks ok'::text;

  -- T13. Anon surface: status RPC exposes only safe keys; no table/IPN access.
  SELECT array_agg(k ORDER BY k) INTO v_keys
    FROM jsonb_object_keys(get_yappy_payment_status(v_b)) k;
  ASSERT v_keys = ARRAY['confirmation_number','error_code','expires_at','ipn_received','order_id','order_number','status','total_cents'], 'T13 keys: ' || v_keys::text;
  ASSERT get_yappy_payment_status(v_b)->>'order_id' IS NOT NULL, 'T13 order id when executed';
  ASSERT NOT has_function_privilege('anon', 'public.yappy_apply_ipn(text,text,text,bigint)', 'EXECUTE'), 'T13 anon apply';
  ASSERT NOT has_function_privilege('authenticated', 'public.yappy_begin_payment(uuid,uuid,uuid,text,text,integer,integer,integer,jsonb)', 'EXECUTE'), 'T13 auth begin';
  ASSERT NOT has_table_privilege('anon', 'public.yappy_payments', 'SELECT'), 'T13 anon table';
  ASSERT NOT has_table_privilege('anon', 'public.yappy_attention', 'SELECT'), 'T13 anon view';
  ASSERT has_function_privilege('anon', 'public.get_yappy_payment_status(uuid)', 'EXECUTE'), 'T13 anon status';
  v_log := v_log || 'T13 anon surface ok'::text;

  -- T14. Payment options: Plaza Mayor table vs a table with no merchant.
  v_r := get_payment_options('13ce08bf3c526920f71a7540');
  ASSERT v_r->>'yappy' = 'true' OR v_r->>'reason' = 'outside_uat_hours', 'T14 plaza: ' || v_r::text;
  v_log := v_log || ('T14 plaza options ' || v_r::text);
  ASSERT (get_payment_options('demo-1'))->>'reason' = 'not_enabled', 'T14 demo-1';
  ASSERT (get_payment_options('nope'))->>'reason' = 'no_venue', 'T14 none';
  v_log := v_log || 'T14 options ok'::text;

  -- T15. Circuit breaker: >=40 creates in 10 min turns the venue off.
  INSERT INTO yappy_payments (env, food_court_id, checkout_key, alias_yappy, subtotal_cents, tax_cents, total_cents, snapshot, status)
  SELECT 'uat', c_fc, gen_random_uuid(), lpad((62000000 + g)::text, 8, '0'), 100, 0, 100, '{}'::jsonb, 'failed'
    FROM generate_series(1, 40) g;
  v_r := yappy_begin_payment(c_fc, NULL, gen_random_uuid(), '61000099', NULL, 797, 0, 797, v_snap);
  ASSERT v_r->>'error' = 'yappy_unavailable', 'T15: ' || v_r::text;
  ASSERT NOT (SELECT enabled FROM yappy_merchants WHERE food_court_id = c_fc), 'T15 disabled';
  ASSERT (get_payment_options('13ce08bf3c526920f71a7540'))->>'reason' = 'disabled', 'T15 options';
  SELECT count(*) INTO v_n FROM yappy_attention WHERE kind = 'merchant_disabled';
  ASSERT v_n = 1, 'T15 attention';
  v_log := v_log || 'T15 circuit breaker ok'::text;

  RAISE EXCEPTION 'YAPPY_TESTS_PASSED (rolled back): %', array_to_string(v_log, ' | ');
END
$test$;
