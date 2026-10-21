-- ============================================================================
-- Migration: 047_demo_food_courts.sql
-- Description: Two demo food courts for sales demos, isolated from every real
-- venue in their own organization.
--
--   demo-1  "Plaza Demo"      — behaves like a real venue. Orders go through
--           create-web-order, land in the admin POS and are advanced by staff.
--           Only the payment is simulated: is_demo makes create-web-order
--           record the order as already paid.
--   demo-2  "Food Hall Demo"  — fully simulated in the browser (apps/order-web
--           lib/demo.ts). No order is ever written; the tracker advances on
--           its own. The rows here only serve the storefront and menu.
--
-- Each food court has one zone whose qr_token is literally its demo slug, so
-- order.estoeskiki.com/demo-1 can reuse the normal /t/[token] flow. Those
-- tokens are public on purpose — never give a real zone a guessable token.
--
-- Fixed UUIDs + ON CONFLICT DO NOTHING keep this re-runnable.
-- ============================================================================

ALTER TABLE public.food_courts
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

INSERT INTO public.organizations (id, name, slug) VALUES
  ('ad000000-0000-0000-0000-000000000001', 'Kiki Demo', 'kiki-demo')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.food_courts (id, name, slug, address, slogan, welcome_bg_url, is_demo) VALUES
  ('fd000000-0000-0000-0000-000000000001', 'Plaza Demo', 'demo-plaza', 'Ciudad de Panamá',
   'Pide desde tu mesa, sin filas',
   'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1600&q=75&auto=format&fit=crop', true),
  ('fd000000-0000-0000-0000-000000000002', 'Food Hall Demo', 'demo-food-hall', 'Ciudad de Panamá',
   'Todo el patio de comidas en tu celular',
   'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1600&q=75&auto=format&fit=crop', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.restaurants (id, org_id, food_court_id, name, slug, address, slogan, is_open, is_active, timezone, currency, tax_rate) VALUES
  ('bd000000-0000-0000-0000-000000000001', 'ad000000-0000-0000-0000-000000000001', 'fd000000-0000-0000-0000-000000000001',
   'Burger Lab', 'demo-burger-lab', 'Plaza Demo, Local 1', 'Hamburguesas a la parrilla', true, true, 'America/Panama', 'USD', 0),
  ('bd000000-0000-0000-0000-000000000002', 'ad000000-0000-0000-0000-000000000001', 'fd000000-0000-0000-0000-000000000001',
   'Taco Loco', 'demo-taco-loco', 'Plaza Demo, Local 2', 'Tacos con sabor a México', true, true, 'America/Panama', 'USD', 0),
  ('bd000000-0000-0000-0000-000000000003', 'ad000000-0000-0000-0000-000000000001', 'fd000000-0000-0000-0000-000000000002',
   'Pizza Nonna', 'demo-pizza-nonna', 'Food Hall Demo, Local 1', 'Pizza al horno de leña', true, true, 'America/Panama', 'USD', 0),
  ('bd000000-0000-0000-0000-000000000004', 'ad000000-0000-0000-0000-000000000001', 'fd000000-0000-0000-0000-000000000002',
   'Sakura Sushi', 'demo-sakura-sushi', 'Food Hall Demo, Local 2', 'Sushi fresco todos los días', true, true, 'America/Panama', 'USD', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tables (id, food_court_id, label, qr_token) VALUES
  ('dd000000-0000-0000-0000-000000000001', 'fd000000-0000-0000-0000-000000000001', 'Mesa Demo', 'demo-1'),
  ('dd000000-0000-0000-0000-000000000002', 'fd000000-0000-0000-0000-000000000002', 'Mesa Demo', 'demo-2')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.categories (id, restaurant_id, name, slug, icon, sort_order) VALUES
  ('cd000000-0000-0000-0000-000000000101', 'bd000000-0000-0000-0000-000000000001', '{"es":"Hamburguesas","en":"Burgers"}', 'hamburguesas', '🍔', 0),
  ('cd000000-0000-0000-0000-000000000102', 'bd000000-0000-0000-0000-000000000001', '{"es":"Acompañantes","en":"Sides"}', 'acompanantes', '🍟', 1),
  ('cd000000-0000-0000-0000-000000000103', 'bd000000-0000-0000-0000-000000000001', '{"es":"Bebidas","en":"Drinks"}', 'bebidas', '🥤', 2),
  ('cd000000-0000-0000-0000-000000000201', 'bd000000-0000-0000-0000-000000000002', '{"es":"Tacos","en":"Tacos"}', 'tacos', '🌮', 0),
  ('cd000000-0000-0000-0000-000000000202', 'bd000000-0000-0000-0000-000000000002', '{"es":"Para compartir","en":"To share"}', 'para-compartir', '🧀', 1),
  ('cd000000-0000-0000-0000-000000000203', 'bd000000-0000-0000-0000-000000000002', '{"es":"Bebidas","en":"Drinks"}', 'bebidas', '🥤', 2),
  ('cd000000-0000-0000-0000-000000000301', 'bd000000-0000-0000-0000-000000000003', '{"es":"Pizzas","en":"Pizzas"}', 'pizzas', '🍕', 0),
  ('cd000000-0000-0000-0000-000000000302', 'bd000000-0000-0000-0000-000000000003', '{"es":"Pastas","en":"Pasta"}', 'pastas', '🍝', 1),
  ('cd000000-0000-0000-0000-000000000303', 'bd000000-0000-0000-0000-000000000003', '{"es":"Postres","en":"Desserts"}', 'postres', '🍰', 2),
  ('cd000000-0000-0000-0000-000000000401', 'bd000000-0000-0000-0000-000000000004', '{"es":"Rolls","en":"Rolls"}', 'rolls', '🍣', 0),
  ('cd000000-0000-0000-0000-000000000402', 'bd000000-0000-0000-0000-000000000004', '{"es":"Entradas","en":"Starters"}', 'entradas', '🥟', 1),
  ('cd000000-0000-0000-0000-000000000403', 'bd000000-0000-0000-0000-000000000004', '{"es":"Bebidas","en":"Drinks"}', 'bebidas', '🍵', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.menu_items (id, restaurant_id, category_id, name, description, price, image_url, popular, sort_order) VALUES
  -- Burger Lab
  ('ed000000-0000-0000-0000-000000000101', 'bd000000-0000-0000-0000-000000000001', 'cd000000-0000-0000-0000-000000000101',
   '{"es":"Clásica","en":"Classic"}', '{"es":"Doble carne, queso cheddar, lechuga, tomate y salsa de la casa","en":"Double patty, cheddar, lettuce, tomato and house sauce"}',
   750, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=75&auto=format&fit=crop', true, 0),
  ('ed000000-0000-0000-0000-000000000102', 'bd000000-0000-0000-0000-000000000001', 'cd000000-0000-0000-0000-000000000101',
   '{"es":"Doble Queso","en":"Double Cheese"}', '{"es":"Dos carnes, doble cheddar, pastrami y jalapeños","en":"Two patties, double cheddar, pastrami and jalapeños"}',
   995, 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=800&q=75&auto=format&fit=crop', false, 1),
  ('ed000000-0000-0000-0000-000000000103', 'bd000000-0000-0000-0000-000000000001', 'cd000000-0000-0000-0000-000000000102',
   '{"es":"Papas con parmesano","en":"Parmesan fries"}', '{"es":"Papas crujientes con parmesano y perejil","en":"Crispy fries with parmesan and parsley"}',
   350, 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800&q=75&auto=format&fit=crop', false, 0),
  ('ed000000-0000-0000-0000-000000000104', 'bd000000-0000-0000-0000-000000000001', 'cd000000-0000-0000-0000-000000000103',
   '{"es":"Limonada de menta","en":"Mint lemonade"}', '{"es":"Limonada natural con hierbabuena","en":"Fresh lemonade with mint"}',
   275, 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=800&q=75&auto=format&fit=crop', false, 0),
  -- Taco Loco
  ('ed000000-0000-0000-0000-000000000201', 'bd000000-0000-0000-0000-000000000002', 'cd000000-0000-0000-0000-000000000201',
   '{"es":"Tacos al pastor","en":"Al pastor tacos"}', '{"es":"Tres tacos de cerdo al pastor con piña, cebolla y cilantro","en":"Three al pastor pork tacos with pineapple, onion and cilantro"}',
   650, 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800&q=75&auto=format&fit=crop', true, 0),
  ('ed000000-0000-0000-0000-000000000202', 'bd000000-0000-0000-0000-000000000002', 'cd000000-0000-0000-0000-000000000202',
   '{"es":"Nachos supremos","en":"Supreme nachos"}', '{"es":"Totopos con queso, carne, frijoles, pico de gallo y crema","en":"Tortilla chips with cheese, beef, beans, pico de gallo and cream"}',
   725, 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=800&q=75&auto=format&fit=crop', false, 0),
  ('ed000000-0000-0000-0000-000000000203', 'bd000000-0000-0000-0000-000000000002', 'cd000000-0000-0000-0000-000000000202',
   '{"es":"Quesadilla","en":"Quesadilla"}', '{"es":"Tortilla de harina con queso, pollo y vegetales","en":"Flour tortilla with cheese, chicken and vegetables"}',
   550, 'https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=800&q=75&auto=format&fit=crop', false, 1),
  ('ed000000-0000-0000-0000-000000000204', 'bd000000-0000-0000-0000-000000000002', 'cd000000-0000-0000-0000-000000000203',
   '{"es":"Agua de maracuyá","en":"Passion fruit drink"}', '{"es":"Refresco natural de maracuyá","en":"Fresh passion fruit drink"}',
   250, 'https://images.unsplash.com/photo-1523371054106-bbf80586c38c?w=800&q=75&auto=format&fit=crop', false, 0),
  -- Pizza Nonna
  ('ed000000-0000-0000-0000-000000000301', 'bd000000-0000-0000-0000-000000000003', 'cd000000-0000-0000-0000-000000000301',
   '{"es":"Margarita","en":"Margherita"}', '{"es":"Salsa de tomate, mozzarella y albahaca fresca","en":"Tomato sauce, mozzarella and fresh basil"}',
   1000, 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&q=75&auto=format&fit=crop', true, 0),
  ('ed000000-0000-0000-0000-000000000302', 'bd000000-0000-0000-0000-000000000003', 'cd000000-0000-0000-0000-000000000301',
   '{"es":"Pepperoni","en":"Pepperoni"}', '{"es":"Mozzarella y pepperoni en abundancia","en":"Mozzarella and plenty of pepperoni"}',
   1150, 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=800&q=75&auto=format&fit=crop', false, 1),
  ('ed000000-0000-0000-0000-000000000303', 'bd000000-0000-0000-0000-000000000003', 'cd000000-0000-0000-0000-000000000302',
   '{"es":"Lasaña de la nonna","en":"Nonna''s lasagna"}', '{"es":"Lasaña de carne gratinada con salsa pomodoro","en":"Baked beef lasagna with pomodoro sauce"}',
   950, 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800&q=75&auto=format&fit=crop', false, 0),
  ('ed000000-0000-0000-0000-000000000304', 'bd000000-0000-0000-0000-000000000003', 'cd000000-0000-0000-0000-000000000303',
   '{"es":"Tiramisú","en":"Tiramisu"}', '{"es":"Clásico italiano con café y cacao","en":"Italian classic with coffee and cocoa"}',
   450, 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800&q=75&auto=format&fit=crop', false, 0),
  -- Sakura Sushi
  ('ed000000-0000-0000-0000-000000000401', 'bd000000-0000-0000-0000-000000000004', 'cd000000-0000-0000-0000-000000000401',
   '{"es":"Roll Sakura","en":"Sakura roll"}', '{"es":"Salmón, queso crema y aguacate, cubierto de salmón flameado","en":"Salmon, cream cheese and avocado, topped with seared salmon"}',
   900, 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&q=75&auto=format&fit=crop', true, 0),
  ('ed000000-0000-0000-0000-000000000402', 'bd000000-0000-0000-0000-000000000004', 'cd000000-0000-0000-0000-000000000401',
   '{"es":"Barco 24 piezas","en":"24-piece boat"}', '{"es":"Selección de rolls y nigiris para compartir","en":"Assorted rolls and nigiri to share"}',
   1800, 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=800&q=75&auto=format&fit=crop', false, 1),
  ('ed000000-0000-0000-0000-000000000403', 'bd000000-0000-0000-0000-000000000004', 'cd000000-0000-0000-0000-000000000402',
   '{"es":"Gyozas (5)","en":"Gyoza (5)"}', '{"es":"Empanaditas japonesas de cerdo al vapor","en":"Steamed Japanese pork dumplings"}',
   550, 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800&q=75&auto=format&fit=crop', false, 0),
  ('ed000000-0000-0000-0000-000000000404', 'bd000000-0000-0000-0000-000000000004', 'cd000000-0000-0000-0000-000000000403',
   '{"es":"Matcha latte","en":"Matcha latte"}', '{"es":"Té verde matcha con leche","en":"Matcha green tea with milk"}',
   375, 'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=800&q=75&auto=format&fit=crop', false, 0)
ON CONFLICT (id) DO NOTHING;
