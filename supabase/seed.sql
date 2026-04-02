-- ============================================================================
-- Kiki Platform — Seed Data (Development Only)
-- Creates: 1 organization, 2 branches, menu items, categories, customizations
-- ============================================================================

-- ─── Organization ───────────────────────────────────────────────────────────
INSERT INTO organizations (id, name, slug, logo_url) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Kiki Burgers', 'kiki-burgers', '');

-- ─── Restaurant Branches ────────────────────────────────────────────────────
INSERT INTO restaurants (id, org_id, name, slug, address, is_open, timezone, currency, tax_rate) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'Kiki Centro', 'kiki-centro', 'Calle Gran Vía 42, Madrid', true, 'Europe/Madrid', 'EUR', 0.1000),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'Kiki Malasaña', 'kiki-malasana', 'Calle Fuencarral 15, Madrid', false, 'Europe/Madrid', 'EUR', 0.1000);

-- ─── Categories (Branch 1: Kiki Centro) ─────────────────────────────────────
INSERT INTO categories (id, restaurant_id, name, slug, icon, sort_order) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Burgers', 'burgers', '🍔', 1),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Sides', 'sides', '🍟', 2),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Drinks', 'drinks', '🥤', 3),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'Desserts', 'desserts', '🍰', 4),
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'Combos', 'combos', '⭐', 5);

-- ─── Menu Items (Branch 1) ──────────────────────────────────────────────────

-- Burgers
INSERT INTO menu_items (id, restaurant_id, category_id, name, description, price, available, popular, sort_order) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'Classic Smash', 'Our signature smashed patty with American cheese, pickles, onions, and Kiki sauce on a toasted brioche bun.', 1099, true, true, 1),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'BBQ Bacon', 'Smoky BBQ sauce, crispy bacon, cheddar cheese, and caramelized onions on a toasted brioche bun.', 1299, true, true, 2),
  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'Mushroom Swiss', 'Sautéed wild mushrooms, melted Swiss cheese, and garlic aioli on a toasted brioche bun.', 1249, true, false, 3),
  ('d0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'Veggie Burger', 'House-made black bean patty with roasted red pepper, avocado, sprouts, and herb mayo.', 1149, true, false, 4),
  ('d0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'The Big Kiki', 'Two smashed patties, double cheese, shredded lettuce, Kiki sauce, pickles on a triple-deck sesame bun.', 1699, true, true, 5);

-- Sides
INSERT INTO menu_items (id, restaurant_id, category_id, name, description, price, available, popular, sort_order) VALUES
  ('d0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002',
   'Classic Fries', 'Golden, crispy, and seasoned with our secret salt blend.', 449, true, true, 1),
  ('d0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002',
   'Sweet Potato Fries', 'Hand-cut sweet potatoes fried to a crisp and dusted with cinnamon sugar.', 549, true, false, 2),
  ('d0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002',
   'Onion Rings', 'Thick-cut onion rings in a crunchy beer batter with smoky ranch.', 549, true, false, 3);

-- Drinks
INSERT INTO menu_items (id, restaurant_id, category_id, name, description, price, available, popular, sort_order) VALUES
  ('d0000000-0000-0000-0000-000000000020', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003',
   'Coca-Cola', 'Ice-cold Coca-Cola Classic.', 299, true, true, 1),
  ('d0000000-0000-0000-0000-000000000021', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003',
   'Lemonade', 'Freshly squeezed lemonade made in-house daily.', 349, true, false, 2),
  ('d0000000-0000-0000-0000-000000000022', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003',
   'Milkshake', 'Thick and creamy hand-spun milkshake. Choose your flavor.', 599, true, true, 3);

-- ─── Customization Groups (for Classic Smash) ──────────────────────────────
INSERT INTO customization_groups (id, menu_item_id, restaurant_id, name, required, max_selections, sort_order) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   'Patty Size', true, 1, 1),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   'Extras', false, 4, 2);

-- Patty Size options
INSERT INTO customization_options (id, group_id, restaurant_id, name, price_modifier, sort_order) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   'Single', -200, 1),
  ('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   'Double', 0, 2),
  ('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   'Triple', 300, 3);

-- Extras options
INSERT INTO customization_options (id, group_id, restaurant_id, name, price_modifier, sort_order) VALUES
  ('f0000000-0000-0000-0000-000000000010', 'e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
   'Bacon', 199, 1),
  ('f0000000-0000-0000-0000-000000000011', 'e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
   'Extra Cheese', 99, 2),
  ('f0000000-0000-0000-0000-000000000012', 'e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
   'Jalapeños', 79, 3),
  ('f0000000-0000-0000-0000-000000000013', 'e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
   'Avocado', 149, 4);

-- ─── Milkshake flavors ──────────────────────────────────────────────────────
INSERT INTO customization_groups (id, menu_item_id, restaurant_id, name, required, max_selections, sort_order) VALUES
  ('e0000000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000022', 'b0000000-0000-0000-0000-000000000001',
   'Flavor', true, 1, 1);

INSERT INTO customization_options (id, group_id, restaurant_id, name, price_modifier, sort_order) VALUES
  ('f0000000-0000-0000-0000-000000000020', 'e0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000001',
   'Chocolate', 0, 1),
  ('f0000000-0000-0000-0000-000000000021', 'e0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000001',
   'Vanilla', 0, 2),
  ('f0000000-0000-0000-0000-000000000022', 'e0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000001',
   'Strawberry', 0, 3),
  ('f0000000-0000-0000-0000-000000000023', 'e0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000001',
   'Cookies & Cream', 0, 4);

-- ============================================================================
-- NOTE: To create the test admin user, run this AFTER seed via Supabase Auth:
--
--   1. Sign up a user with email: admin@kikiburgers.com / password: testpass123
--   2. Include user metadata: { org_id: 'a0000000-...001', role: 'owner' }
--   3. The handle_new_user() trigger will auto-create the org_members row
--
-- Or use the Supabase Dashboard → Authentication → Add User
-- ============================================================================
