-- Conditional max_selections: let one customization group's allowed selection
-- count depend on which option is chosen in another ("driver") group.
--
-- Example (El Invernadero "Chicken Tenders"): the "Salsa" group normally allows
-- up to 2 sauces, but only 1 when "Tamaño" = 5 piezas. The rule lives on the
-- dependent group and references the driver group + a per-driver-option max.
--
-- Shape:
--   {
--     "driver_group_id": "<uuid of the driver group>",
--     "by_option": { "<driver option uuid>": <max int>, ... },
--     "default": <max int used when no driver option matches>
--   }
--
-- NULL (the default) means the group's static max_selections is used, so every
-- existing group is unaffected. max_selections stays the absolute ceiling.

alter table customization_groups
  add column if not exists selection_rule jsonb;

-- Seed the El Invernadero "Chicken Tenders" rule:
--   Tamaño group  e2010000-…0001  (driver)
--     5 piezas  f2010000-…0001 -> 1 sauce
--     8 piezas  f2010000-…0002 -> 2 sauces
--     12 piezas f2010000-…0003 -> 2 sauces
--   Salsa group   e2010000-…0002  (dependent)
update customization_groups
set selection_rule = jsonb_build_object(
  'driver_group_id', 'e2010000-0000-0000-0000-000000000001',
  'by_option', jsonb_build_object(
    'f2010000-0000-0000-0000-000000000001', 1,
    'f2010000-0000-0000-0000-000000000002', 2,
    'f2010000-0000-0000-0000-000000000003', 2
  ),
  'default', 1
)
where id = 'e2010000-0000-0000-0000-000000000002';
