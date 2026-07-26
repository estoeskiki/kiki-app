'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { canAdminister, requirePlatformAdmin, requireViewer } from '@/lib/auth/dal';
import { assertFoodCourtInScope, assertRestaurantInScope } from '@/lib/auth/scope';
import { createClient } from '@/lib/supabase/server';

/**
 * Tenant lifecycle: organizations, restaurants, food courts and zones.
 *
 * Creating an organization or a food court is platform-operator work — a food
 * court hosts restaurants from several organizations, so no single tenant owns
 * it. RLS enforces exactly that (031_platform_admins.sql); the
 * requirePlatformAdmin() calls here just fail early and legibly.
 */

const uuid = z.string().uuid();

const slug = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9-]+$/, 'El slug solo admite minúsculas, números y guiones');

function fail(message: string): never {
  throw new Error(message);
}

// ─── Organizations ──────────────────────────────────────────────────────────

export async function createOrganization(formData: FormData) {
  await requirePlatformAdmin();

  const name = z.string().trim().min(2).max(120).parse(formData.get('name'));
  const orgSlug = slug.parse(formData.get('slug'));

  const supabase = await createClient();
  const { error } = await supabase.from('organizations').insert({ name, slug: orgSlug });
  if (error) fail(error.message);

  revalidatePath('/organizations');
}

// ─── Restaurants ────────────────────────────────────────────────────────────

const restaurantSchema = z.object({
  org_id: uuid,
  name: z.string().trim().min(2).max(120),
  slug,
  address: z.string().trim().max(200).optional(),
  food_court_id: uuid.or(z.literal('')).optional(),
  timezone: z.string().trim().max(64).default('America/Panama'),
  currency: z.string().trim().length(3).default('USD'),
  tax_rate: z.coerce.number().min(0).max(1).default(0),
});

export async function createRestaurant(formData: FormData) {
  const viewer = await requireViewer();
  if (!viewer.is_platform_admin && viewer.role !== 'owner') {
    fail('Solo el operador de la plataforma o el propietario pueden crear restaurantes');
  }

  const parsed = restaurantSchema.parse({
    org_id: formData.get('org_id'),
    name: formData.get('name'),
    slug: formData.get('slug'),
    address: formData.get('address') ?? '',
    food_court_id: formData.get('food_court_id') ?? '',
    timezone: formData.get('timezone') || 'America/Panama',
    currency: (formData.get('currency') as string) || 'USD',
    tax_rate: formData.get('tax_rate') || 0,
  });

  if (parsed.food_court_id) await assertFoodCourtInScope(parsed.food_court_id);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('restaurants')
    .insert({
      org_id: parsed.org_id,
      name: parsed.name,
      slug: parsed.slug,
      address: parsed.address || null,
      food_court_id: parsed.food_court_id || null,
      timezone: parsed.timezone,
      currency: parsed.currency.toUpperCase(),
      tax_rate: parsed.tax_rate,
    })
    .select('id')
    .single();

  if (error) fail(error.message);

  revalidatePath('/restaurants');
  redirect(`/restaurants/${data!.id}`);
}

export async function updateRestaurant(formData: FormData) {
  const viewer = await requireViewer();
  if (!canAdminister(viewer)) fail('No tienes permiso para editar este restaurante');

  const id = uuid.parse(formData.get('id'));
  await assertRestaurantInScope(id);

  const patch = z
    .object({
      name: z.string().trim().min(2).max(120),
      address: z.string().trim().max(200).optional(),
      slogan: z.string().trim().max(200).optional(),
      timezone: z.string().trim().max(64),
      currency: z.string().trim().length(3),
      tax_rate: z.coerce.number().min(0).max(1),
      logo_url: z.string().trim().url().or(z.literal('')).optional(),
      welcome_bg_url: z.string().trim().url().or(z.literal('')).optional(),
    })
    .parse({
      name: formData.get('name'),
      address: formData.get('address') ?? '',
      slogan: formData.get('slogan') ?? '',
      timezone: formData.get('timezone'),
      currency: formData.get('currency'),
      tax_rate: formData.get('tax_rate') || 0,
      logo_url: formData.get('logo_url') ?? '',
      welcome_bg_url: formData.get('welcome_bg_url') ?? '',
    });

  const supabase = await createClient();
  const { error } = await supabase
    .from('restaurants')
    .update({
      name: patch.name,
      address: patch.address || null,
      slogan: patch.slogan || null,
      timezone: patch.timezone,
      currency: patch.currency.toUpperCase(),
      tax_rate: patch.tax_rate,
      logo_url: patch.logo_url || null,
      welcome_bg_url: patch.welcome_bg_url || null,
    })
    .eq('id', id);

  if (error) fail(error.message);

  revalidatePath('/restaurants');
  revalidatePath(`/restaurants/${id}`);
  revalidatePath('/settings');
}

/**
 * `is_open` is the day-to-day "accepting orders" switch; `is_active` is the
 * structural "this storefront exists publicly" flag (023_restaurant_visibility).
 * They are deliberately separate — closing for the night must not unpublish a
 * restaurant.
 */
export async function setRestaurantFlag(formData: FormData) {
  const viewer = await requireViewer();
  if (!canAdminister(viewer)) fail('No tienes permiso para cambiar el estado');

  const id = uuid.parse(formData.get('id'));
  const field = z.enum(['is_open', 'is_active']).parse(formData.get('field'));
  const value = formData.get('value') === 'true';

  await assertRestaurantInScope(id);

  if (field === 'is_active' && !viewer.is_platform_admin && viewer.role !== 'owner') {
    fail('Solo el propietario puede ocultar o publicar un restaurante');
  }

  const patch = field === 'is_open' ? { is_open: value } : { is_active: value };

  const supabase = await createClient();
  const { error } = await supabase.from('restaurants').update(patch).eq('id', id);
  if (error) fail(error.message);

  revalidatePath('/restaurants');
  revalidatePath(`/restaurants/${id}`);
}

// ─── Food courts ────────────────────────────────────────────────────────────

export async function createFoodCourt(formData: FormData) {
  await requirePlatformAdmin();

  const parsed = z
    .object({
      name: z.string().trim().min(2).max(120),
      slug,
      address: z.string().trim().max(200).optional(),
    })
    .parse({
      name: formData.get('name'),
      slug: formData.get('slug'),
      address: formData.get('address') ?? '',
    });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('food_courts')
    .insert({ name: parsed.name, slug: parsed.slug, address: parsed.address || null })
    .select('id')
    .single();

  if (error) fail(error.message);

  revalidatePath('/food-courts');
  redirect(`/food-courts/${data!.id}`);
}

/** Link or unlink a restaurant as a stall in a food court. */
export async function setRestaurantFoodCourt(formData: FormData) {
  await requirePlatformAdmin();

  const restaurantId = uuid.parse(formData.get('restaurant_id'));
  const raw = formData.get('food_court_id');
  const foodCourtId = raw ? uuid.parse(raw) : null;

  if (foodCourtId) await assertFoodCourtInScope(foodCourtId);

  const supabase = await createClient();
  const { error } = await supabase
    .from('restaurants')
    .update({ food_court_id: foodCourtId })
    .eq('id', restaurantId);

  if (error) fail(error.message);

  revalidatePath('/food-courts');
  revalidatePath('/restaurants');
}

// ─── Zones (rows in `tables`) ───────────────────────────────────────────────

/**
 * A zone is a QR-addressable place an order can come from: Sala VIP, Palco #1,
 * Mesa 5. `allows_manual_number` marks the Sala VIP pattern, where one QR card
 * covers many physical tables and the customer types their own table number
 * (018_food_court_zones.sql).
 *
 * qr_token defaults to random bytes in the schema and is never accepted from
 * the client — it is the bearer credential that identifies the zone.
 */
export async function createZone(formData: FormData) {
  const viewer = await requireViewer();
  if (!canAdminister(viewer)) fail('No tienes permiso para crear zonas');

  const label = z.string().trim().min(1).max(60).parse(formData.get('label'));
  const allowsManualNumber = formData.get('allows_manual_number') === 'on';

  const rawFoodCourt = formData.get('food_court_id');
  const rawRestaurant = formData.get('restaurant_id');

  const foodCourtId = rawFoodCourt ? uuid.parse(rawFoodCourt) : null;
  const restaurantId = rawRestaurant ? uuid.parse(rawRestaurant) : null;

  if (!foodCourtId && !restaurantId) fail('Indica un restaurante o un patio de comida');
  if (foodCourtId) await assertFoodCourtInScope(foodCourtId);
  if (restaurantId) await assertRestaurantInScope(restaurantId);

  const supabase = await createClient();
  const { error } = await supabase.from('tables').insert({
    label,
    allows_manual_number: allowsManualNumber,
    food_court_id: foodCourtId,
    restaurant_id: restaurantId,
  });

  if (error) fail(error.message);

  revalidatePath('/food-courts');
  revalidatePath('/restaurants');
}

/**
 * Deactivates rather than deletes by default: the zone id is referenced by
 * every past order, and its label is what the reporting groups on.
 */
export async function setZoneActive(formData: FormData) {
  const viewer = await requireViewer();
  if (!canAdminister(viewer)) fail('No tienes permiso para cambiar zonas');

  const id = uuid.parse(formData.get('id'));
  const value = formData.get('value') === 'true';

  const supabase = await createClient();
  const { error } = await supabase.from('tables').update({ is_active: value }).eq('id', id);
  if (error) fail(error.message);

  revalidatePath('/food-courts');
  revalidatePath('/restaurants');
}
