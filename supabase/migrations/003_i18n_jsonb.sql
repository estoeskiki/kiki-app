-- Migration to support multi-language (i18n) directly in the database
-- The admin will input Spanish, and we translate to English.
-- For now, we populate 'es' with existing data and 'en' as empty string (to be populated by Edge Function or Admin).

-- 1. Modify Categories
ALTER TABLE categories ALTER COLUMN name DROP DEFAULT;
ALTER TABLE categories 
  ALTER COLUMN name TYPE jsonb USING jsonb_build_object('es', name, 'en', '');
ALTER TABLE categories ALTER COLUMN name SET DEFAULT '{"es": "", "en": ""}'::jsonb;

-- 2. Modify Menu Items
ALTER TABLE menu_items ALTER COLUMN name DROP DEFAULT;
ALTER TABLE menu_items ALTER COLUMN description DROP DEFAULT;
ALTER TABLE menu_items 
  ALTER COLUMN name TYPE jsonb USING jsonb_build_object('es', name, 'en', ''),
  ALTER COLUMN description TYPE jsonb USING jsonb_build_object('es', COALESCE(description, ''), 'en', '');
ALTER TABLE menu_items ALTER COLUMN name SET DEFAULT '{"es": "", "en": ""}'::jsonb;
ALTER TABLE menu_items ALTER COLUMN description SET DEFAULT '{"es": "", "en": ""}'::jsonb;

-- 3. Modify Customization Groups
ALTER TABLE customization_groups ALTER COLUMN name DROP DEFAULT;
ALTER TABLE customization_groups 
  ALTER COLUMN name TYPE jsonb USING jsonb_build_object('es', name, 'en', '');
ALTER TABLE customization_groups ALTER COLUMN name SET DEFAULT '{"es": "", "en": ""}'::jsonb;

-- 4. Modify Customization Options
ALTER TABLE customization_options ALTER COLUMN name DROP DEFAULT;
ALTER TABLE customization_options 
  ALTER COLUMN name TYPE jsonb USING jsonb_build_object('es', name, 'en', '');
ALTER TABLE customization_options ALTER COLUMN name SET DEFAULT '{"es": "", "en": ""}'::jsonb;
