-- ============================================================================
-- Kiki Platform — Seed Data (Development Only)
-- Creates: 1 organization, 2 branches, menu items, categories, customizations
-- Fully bilingual JSONB fields (es / en)
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
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '{"es": "Hamburguesas", "en": "Burgers"}'::jsonb, 'burgers', '🍔', 1),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', '{"es": "Acompañantes", "en": "Sides"}'::jsonb, 'sides', '🍟', 2),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '{"es": "Bebidas", "en": "Drinks"}'::jsonb, 'drinks', '🥤', 3),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', '{"es": "Postres", "en": "Desserts"}'::jsonb, 'desserts', '🍰', 4),
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', '{"es": "Combos", "en": "Combos"}'::jsonb, 'combos', '⭐', 5);

-- ─── Menu Items (Branch 1) ──────────────────────────────────────────────────

-- Burgers
INSERT INTO menu_items (id, restaurant_id, category_id, name, description, price, available, popular, sort_order) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   '{"es": "Smash Clásica", "en": "Classic Smash"}'::jsonb, '{"es": "Nuestra hamburguesa signature de carne prensada con queso americano, pepinillos, cebolla y salsa Kiki en pan brioche tostado.", "en": "Our signature smashed patty with American cheese, pickles, onions, and Kiki sauce on a toasted brioche bun."}'::jsonb, 1099, true, true, 1),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   '{"es": "Bacon Barbacoa", "en": "BBQ Bacon"}'::jsonb, '{"es": "Salsa BBQ ahumada, tocino crujiente, queso cheddar y cebolla caramelizada en pan brioche tostado.", "en": "Smoky BBQ sauce, crispy bacon, cheddar cheese, and caramelized onions on a toasted brioche bun."}'::jsonb, 1299, true, true, 2),
  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   '{"es": "Mushroom Swiss", "en": "Mushroom Swiss"}'::jsonb, '{"es": "Champiñones silvestres salteados, queso suizo derretido y alioli de ajo en pan brioche tostado.", "en": "Sautéed wild mushrooms, melted Swiss cheese, and garlic aioli on a toasted brioche bun."}'::jsonb, 1249, true, false, 3),
  ('d0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   '{"es": "Hamburguesa Vegana", "en": "Veggie Burger"}'::jsonb, '{"es": "Hamburguesa casera de frijoles negros con pimiento rojo asado, aguacate, brotes y mayonesa de hierbas.", "en": "House-made black bean patty with roasted red pepper, avocado, sprouts, and herb mayo."}'::jsonb, 1149, true, false, 4),
  ('d0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   '{"es": "La Gran Kiki", "en": "The Big Kiki"}'::jsonb, '{"es": "Doble carne smash, doble queso, lechuga picada, salsa Kiki, pepinillos en un pan de sésamo triple.", "en": "Two smashed patties, double cheese, shredded lettuce, Kiki sauce, pickles on a triple-deck sesame bun."}'::jsonb, 1699, true, true, 5);

-- Sides
INSERT INTO menu_items (id, restaurant_id, category_id, name, description, price, available, popular, sort_order) VALUES
  ('d0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002',
   '{"es": "Patatas Clásicas", "en": "Classic Fries"}'::jsonb, '{"es": "Doradas, crujientes y sazonadas con nuestra mezcla de sal secreta.", "en": "Golden, crispy, and seasoned with our secret salt blend."}'::jsonb, 449, true, true, 1),
  ('d0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002',
   '{"es": "Patatas Dulces (Boniato)", "en": "Sweet Potato Fries"}'::jsonb, '{"es": "Boniato cortado a mano, frito hasta quedar crujiente y espolvoreado con azúcar y canela.", "en": "Hand-cut sweet potatoes fried to a crisp and dusted with cinnamon sugar."}'::jsonb, 549, true, false, 2),
  ('d0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002',
   '{"es": "Aros de Cebolla", "en": "Onion Rings"}'::jsonb, '{"es": "Gruesos aros de cebolla con crujiente rebozado de cerveza y ranch ahumado.", "en": "Thick-cut onion rings in a crunchy beer batter with smoky ranch."}'::jsonb, 549, true, false, 3);

-- Drinks
INSERT INTO menu_items (id, restaurant_id, category_id, name, description, price, available, popular, sort_order) VALUES
  ('d0000000-0000-0000-0000-000000000020', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003',
   '{"es": "Coca-Cola", "en": "Coca-Cola"}'::jsonb, '{"es": "Coca-Cola Clásica helada.", "en": "Ice-cold Coca-Cola Classic."}'::jsonb, 299, true, true, 1),
  ('d0000000-0000-0000-0000-000000000021', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003',
   '{"es": "Limonada", "en": "Lemonade"}'::jsonb, '{"es": "Limonada recién exprimida hecha en casa a diario.", "en": "Freshly squeezed lemonade made in-house daily."}'::jsonb, 349, true, false, 2),
  ('d0000000-0000-0000-0000-000000000022', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003',
   '{"es": "Batido", "en": "Milkshake"}'::jsonb, '{"es": "Batido espeso y cremoso elaborado a mano. Elige tu sabor.", "en": "Thick and creamy hand-spun milkshake. Choose your flavor."}'::jsonb, 599, true, true, 3);

-- ─── Customization Groups (for Classic Smash) ──────────────────────────────
INSERT INTO customization_groups (id, menu_item_id, restaurant_id, name, required, max_selections, sort_order) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   '{"es": "Tamaño de la Carne", "en": "Patty Size"}'::jsonb, true, 1, 1),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   '{"es": "Extras", "en": "Extras"}'::jsonb, false, 4, 2);

-- Patty Size options
INSERT INTO customization_options (id, group_id, restaurant_id, name, price_modifier, sort_order) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   '{"es": "Simple", "en": "Single"}'::jsonb, -200, 1),
  ('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   '{"es": "Doble", "en": "Double"}'::jsonb, 0, 2),
  ('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   '{"es": "Triple", "en": "Triple"}'::jsonb, 300, 3);

-- Extras options
INSERT INTO customization_options (id, group_id, restaurant_id, name, price_modifier, sort_order) VALUES
  ('f0000000-0000-0000-0000-000000000010', 'e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
   '{"es": "Tocino", "en": "Bacon"}'::jsonb, 199, 1),
  ('f0000000-0000-0000-0000-000000000011', 'e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
   '{"es": "Extra Queso", "en": "Extra Cheese"}'::jsonb, 99, 2),
  ('f0000000-0000-0000-0000-000000000012', 'e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
   '{"es": "Jalapeños", "en": "Jalapeños"}'::jsonb, 79, 3),
  ('f0000000-0000-0000-0000-000000000013', 'e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
   '{"es": "Aguacate", "en": "Avocado"}'::jsonb, 149, 4);

-- ─── Milkshake flavors ──────────────────────────────────────────────────────
INSERT INTO customization_groups (id, menu_item_id, restaurant_id, name, required, max_selections, sort_order) VALUES
  ('e0000000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000022', 'b0000000-0000-0000-0000-000000000001',
   '{"es": "Sabor", "en": "Flavor"}'::jsonb, true, 1, 1);

INSERT INTO customization_options (id, group_id, restaurant_id, name, price_modifier, sort_order) VALUES
  ('f0000000-0000-0000-0000-000000000020', 'e0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000001',
   '{"es": "Chocolate", "en": "Chocolate"}'::jsonb, 0, 1),
  ('f0000000-0000-0000-0000-000000000021', 'e0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000001',
   '{"es": "Vainilla", "en": "Vanilla"}'::jsonb, 0, 2),
  ('f0000000-0000-0000-0000-000000000022', 'e0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000001',
   '{"es": "Fresa", "en": "Strawberry"}'::jsonb, 0, 3),
  ('f0000000-0000-0000-0000-000000000023', 'e0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000001',
   '{"es": "Cookies & Cream", "en": "Cookies & Cream"}'::jsonb, 0, 4);

-- ============================================================================
-- FOOD COURTS (Migration Seed Data)
-- ============================================================================

-- Create the food court
INSERT INTO food_courts (id, name, slug, address) VALUES
  ('fc000000-0000-0000-0000-000000000001', 'Plaza Mayor Food Hall', 'plaza-mayor-hall', 'Plaza Mayor 1, Madrid');

-- Create a 3rd restaurant stall inside the food court
INSERT INTO restaurants (id, org_id, name, slug, address, food_court_id, is_open, timezone, currency, tax_rate) VALUES
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'Kiki Sushi', 'kiki-sushi', 'Plaza Mayor 1, Madrid', 'fc000000-0000-0000-0000-000000000001', true, 'Europe/Madrid', 'EUR', 0.1000);

-- Link only Kiki Centro into the food court
UPDATE restaurants 
SET food_court_id = 'fc000000-0000-0000-0000-000000000001'
WHERE id = 'b0000000-0000-0000-0000-000000000001';

-- Create a centralized food-court-scoped device token for testing the Kiosk App
INSERT INTO device_tokens (id, org_id, food_court_id, device_name, token_hash, is_active) VALUES
  ('fc000000-0000-0000-0000-100000000001', 'a0000000-0000-0000-0000-000000000001', 'fc000000-0000-0000-0000-000000000001', 'Main Hall Kiosk 1', 'test_plain_token_hash_value', true);


-- ============================================================================
-- NOTE: To create the test admin user, run this AFTER seed via Supabase Auth:
--
--   1. Sign up a user with email: admin@kikiburgers.com / password: testpass123
--   2. Include user metadata: { org_id: 'a0000000-...001', role: 'owner' }
--   3. The handle_new_user() trigger will auto-create the org_members row
--
-- Or use the Supabase Dashboard → Authentication → Add User
-- ============================================================================
