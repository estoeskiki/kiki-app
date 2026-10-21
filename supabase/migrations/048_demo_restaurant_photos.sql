-- ============================================================================
-- Migration: 048_demo_restaurant_photos.sql
-- Description: Directory photos for the four demo restaurants (migration 047),
-- so the food-court grid shows a dish instead of the name's initial.
-- ============================================================================

UPDATE public.restaurants AS r
SET logo_url = v.logo_url
FROM (VALUES
  ('bd000000-0000-0000-0000-000000000001'::uuid, 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=600&h=600&q=75&auto=format&fit=crop'),
  ('bd000000-0000-0000-0000-000000000002'::uuid, 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&h=600&q=75&auto=format&fit=crop'),
  ('bd000000-0000-0000-0000-000000000003'::uuid, 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&h=600&q=75&auto=format&fit=crop'),
  ('bd000000-0000-0000-0000-000000000004'::uuid, 'https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=600&h=600&q=75&auto=format&fit=crop')
) AS v(id, logo_url)
WHERE r.id = v.id;
