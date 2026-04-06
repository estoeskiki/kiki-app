-- ============================================================================
-- Kiki Platform — Bilingual Seed Update
-- 1. Alters your tables to support JSONB language fields
-- 2. Deletes only the existing menu items/categories (keeps restaurants/auth intact)
-- 3. Inserts the brand new fully translated English/Spanish menu!
-- ============================================================================

-- STEP 1: Enable JSONB fields for i18n by gracefully handling DEFAULT conversions
ALTER TABLE categories ALTER COLUMN name DROP DEFAULT;
ALTER TABLE categories 
  ALTER COLUMN name TYPE jsonb USING jsonb_build_object('es', name, 'en', '');
ALTER TABLE categories ALTER COLUMN name SET DEFAULT '{"es": "", "en": ""}'::jsonb;

ALTER TABLE menu_items ALTER COLUMN name DROP DEFAULT;
ALTER TABLE menu_items ALTER COLUMN description DROP DEFAULT;
ALTER TABLE menu_items 
  ALTER COLUMN name TYPE jsonb USING jsonb_build_object('es', name, 'en', ''),
  ALTER COLUMN description TYPE jsonb USING jsonb_build_object('es', COALESCE(description, ''), 'en', '');
ALTER TABLE menu_items ALTER COLUMN name SET DEFAULT '{"es": "", "en": ""}'::jsonb;
ALTER TABLE menu_items ALTER COLUMN description SET DEFAULT '{"es": "", "en": ""}'::jsonb;

ALTER TABLE customization_groups ALTER COLUMN name DROP DEFAULT;
ALTER TABLE customization_groups 
  ALTER COLUMN name TYPE jsonb USING jsonb_build_object('es', name, 'en', '');
ALTER TABLE customization_groups ALTER COLUMN name SET DEFAULT '{"es": "", "en": ""}'::jsonb;

ALTER TABLE customization_options ALTER COLUMN name DROP DEFAULT;
ALTER TABLE customization_options 
  ALTER COLUMN name TYPE jsonb USING jsonb_build_object('es', name, 'en', '');
ALTER TABLE customization_options ALTER COLUMN name SET DEFAULT '{"es": "", "en": ""}'::jsonb;

-- STEP 2: Wipe the existing menu catalog (Leaves organizations, users, and branches alone)
TRUNCATE TABLE categories CASCADE;
-- (Cascade automatically wipes menu_items, customization_groups, customization_options, and orders)

-- STEP 3: Insert the bilingual catalog for Kiki Centro
INSERT INTO categories (id, restaurant_id, name, slug, icon, sort_order) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '{"es": "Hamburguesas", "en": "Burgers"}'::jsonb, 'burgers', '🍔', 1),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', '{"es": "Acompañantes", "en": "Sides"}'::jsonb, 'sides', '🍟', 2),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '{"es": "Bebidas", "en": "Drinks"}'::jsonb, 'drinks', '🥤', 3),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', '{"es": "Postres", "en": "Desserts"}'::jsonb, 'desserts', '🍰', 4),
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', '{"es": "Combos", "en": "Combos"}'::jsonb, 'combos', '⭐', 5);

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

INSERT INTO menu_items (id, restaurant_id, category_id, name, description, price, available, popular, sort_order) VALUES
  ('d0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002',
   '{"es": "Patatas Clásicas", "en": "Classic Fries"}'::jsonb, '{"es": "Doradas, crujientes y sazonadas con nuestra mezcla de sal secreta.", "en": "Golden, crispy, and seasoned with our secret salt blend."}'::jsonb, 449, true, true, 1),
  ('d0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002',
   '{"es": "Patatas Dulces (Boniato)", "en": "Sweet Potato Fries"}'::jsonb, '{"es": "Boniato cortado a mano, frito hasta quedar crujiente y espolvoreado con azúcar y canela.", "en": "Hand-cut sweet potatoes fried to a crisp and dusted with cinnamon sugar."}'::jsonb, 549, true, false, 2),
  ('d0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002',
   '{"es": "Aros de Cebolla", "en": "Onion Rings"}'::jsonb, '{"es": "Gruesos aros de cebolla con crujiente rebozado de cerveza y ranch ahumado.", "en": "Thick-cut onion rings in a crunchy beer batter with smoky ranch."}'::jsonb, 549, true, false, 3);

INSERT INTO menu_items (id, restaurant_id, category_id, name, description, price, available, popular, sort_order) VALUES
  ('d0000000-0000-0000-0000-000000000020', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003',
   '{"es": "Coca-Cola", "en": "Coca-Cola"}'::jsonb, '{"es": "Coca-Cola Clásica helada.", "en": "Ice-cold Coca-Cola Classic."}'::jsonb, 299, true, true, 1),
  ('d0000000-0000-0000-0000-000000000021', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003',
   '{"es": "Limonada", "en": "Lemonade"}'::jsonb, '{"es": "Limonada recién exprimida hecha en casa a diario.", "en": "Freshly squeezed lemonade made in-house daily."}'::jsonb, 349, true, false, 2),
  ('d0000000-0000-0000-0000-000000000022', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003',
   '{"es": "Batido", "en": "Milkshake"}'::jsonb, '{"es": "Batido espeso y cremoso elaborado a mano. Elige tu sabor.", "en": "Thick and creamy hand-spun milkshake. Choose your flavor."}'::jsonb, 599, true, true, 3);

INSERT INTO customization_groups (id, menu_item_id, restaurant_id, name, required, max_selections, sort_order) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   '{"es": "Tamaño de la Carne", "en": "Patty Size"}'::jsonb, true, 1, 1),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   '{"es": "Extras", "en": "Extras"}'::jsonb, false, 4, 2);

INSERT INTO customization_options (id, group_id, restaurant_id, name, price_modifier, sort_order) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   '{"es": "Simple", "en": "Single"}'::jsonb, -200, 1),
  ('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   '{"es": "Doble", "en": "Double"}'::jsonb, 0, 2),
  ('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   '{"es": "Triple", "en": "Triple"}'::jsonb, 300, 3);

INSERT INTO customization_options (id, group_id, restaurant_id, name, price_modifier, sort_order) VALUES
  ('f0000000-0000-0000-0000-000000000010', 'e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
   '{"es": "Tocino", "en": "Bacon"}'::jsonb, 199, 1),
  ('f0000000-0000-0000-0000-000000000011', 'e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
   '{"es": "Extra Queso", "en": "Extra Cheese"}'::jsonb, 99, 2),
  ('f0000000-0000-0000-0000-000000000012', 'e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
   '{"es": "Jalapeños", "en": "Jalapeños"}'::jsonb, 79, 3),
  ('f0000000-0000-0000-0000-000000000013', 'e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
   '{"es": "Aguacate", "en": "Avocado"}'::jsonb, 149, 4);

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
