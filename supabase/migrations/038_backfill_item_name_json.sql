-- ============================================================================
-- Migration: 038_backfill_item_name_json.sql
-- Description: Repairs order_items.item_name rows that hold serialised
-- bilingual JSON instead of a display string.
--
-- ORIGIN
-- The legacy kiosk insert path wrote the raw JSONB name straight through
-- (apps/kiosk/src/services/orderService.ts:227 — `item_name: item.menuItem.name`),
-- so the snapshot came out as {"en":"BBQ Bacon","es":"Bacon Barbacoa"} rather
-- than "Bacon Barbacoa". That path is now dead code; the kiosk goes through
-- create-web-order, which localises first (index.ts:286 —
-- `itemName: localize(menuItem.name)`). So this is a fixed-size historical
-- problem: 9 of 129 lines, all channel 'kiosk', none newer than 2026-07-08.
--
-- WHY IT MATTERS
-- item_name is the display snapshot. It is what the admin console's top-items
-- chart and order detail render, and what a customer sees on the public order
-- tracker via get_order_status_public. Those rows currently show raw JSON.
--
-- APPROACH
-- Prefer the Spanish label (the console and storefront are Spanish), fall back
-- to English, and leave the row untouched if neither is usable. Wrapped in a
-- per-row exception handler so a value that is not valid JSON is skipped rather
-- than aborting the whole migration — a plain WHERE guard would not be safe
-- here, since Postgres does not guarantee that a `~` test short-circuits before
-- a ::jsonb cast in the same predicate.
--
-- This only corrects a serialisation mistake; it does not rewrite what was sold.
-- ============================================================================

DO $$
DECLARE
  row_rec  record;
  parsed   jsonb;
  fixed    text;
  n_fixed  integer := 0;
  n_skipped integer := 0;
BEGIN
  FOR row_rec IN
    SELECT id, item_name FROM order_items WHERE item_name LIKE '{%'
  LOOP
    BEGIN
      parsed := row_rec.item_name::jsonb;

      fixed := COALESCE(
        NULLIF(btrim(parsed ->> 'es'), ''),
        NULLIF(btrim(parsed ->> 'en'), '')
      );

      IF fixed IS NULL THEN
        n_skipped := n_skipped + 1;
        CONTINUE;
      END IF;

      UPDATE order_items SET item_name = fixed WHERE id = row_rec.id;
      n_fixed := n_fixed + 1;

    EXCEPTION WHEN others THEN
      -- Not valid JSON, or not the shape we expect. Leave it alone; the UI has
      -- a defensive fallback for these (see displayItemName in lib/i18n.ts).
      n_skipped := n_skipped + 1;
    END;
  END LOOP;

  RAISE NOTICE '038: repaired % item_name rows, skipped %', n_fixed, n_skipped;
END $$;
