-- Cleanup synthetic load-test orders. Run AFTER each test run.
-- Every k6-created order is named "LOADTEST-...". FKs cascade:
--   orders -> sub_orders -> order_items -> order_item_customizations
-- so deleting the parent orders removes all children.

-- 1. Preview what will be deleted (run this first).
SELECT count(*) AS loadtest_orders,
       min(created_at) AS first,
       max(created_at) AS last
FROM orders
WHERE customer_name LIKE 'LOADTEST%';

-- 2. Delete (uncomment to run).
-- DELETE FROM orders WHERE customer_name LIKE 'LOADTEST%';

-- 3. Verify zero remain.
-- SELECT count(*) AS remaining FROM orders WHERE customer_name LIKE 'LOADTEST%';

-- Note: the per-restaurant daily order_number counter is NOT reset by this —
-- it just advances past the test numbers, which is harmless. If you need clean
-- launch-day numbers, reset that counter separately before go-live.
