'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { canAdminister, canWrite, requireViewer } from '@/lib/auth/dal';
import { assertRestaurantInScope } from '@/lib/auth/scope';
import { createClient } from '@/lib/supabase/server';

/**
 * Menu mutations.
 *
 * Every action re-derives the viewer from the DAL and re-checks the restaurant
 * is in scope. Server Actions are public HTTP endpoints — being reachable only
 * from a page the user could load is not an access control, so nothing here
 * trusts the form payload's restaurant_id. RLS is the backstop underneath.
 *
 * Prices are integer cents everywhere in the schema; the forms take decimal
 * currency and convert once, here.
 */

const uuid = z.string().uuid();

const translatable = z.object({
  es: z.string().trim().min(1, 'El nombre en español es obligatorio').max(120),
  en: z.string().trim().max(120).default(''),
});

/** "12,50" or "12.50" -> 1250. Rejects negatives and absurd values. */
const priceToCents = z
  .string()
  .trim()
  .transform((v) => Number(v.replace(',', '.')))
  .refine((n) => Number.isFinite(n) && n >= 0 && n <= 100_000, {
    message: 'Precio inválido',
  })
  .transform((n) => Math.round(n * 100));

function fail(message: string): never {
  throw new Error(message);
}

async function requireWriter() {
  const viewer = await requireViewer();
  if (!canWrite(viewer)) fail('No tienes permiso para editar el menú');
  return viewer;
}

// ─── Categories ─────────────────────────────────────────────────────────────

const categorySchema = z.object({
  restaurant_id: uuid,
  name_es: z.string(),
  name_en: z.string().optional(),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'El slug solo admite minúsculas, números y guiones'),
  icon: z.string().trim().max(8).optional(),
});

export async function createCategory(formData: FormData) {
  await requireWriter();

  const parsed = categorySchema.parse({
    restaurant_id: formData.get('restaurant_id'),
    name_es: formData.get('name_es'),
    name_en: formData.get('name_en') ?? '',
    slug: formData.get('slug'),
    icon: formData.get('icon') ?? '',
  });

  await assertRestaurantInScope(parsed.restaurant_id);
  const name = translatable.parse({ es: parsed.name_es, en: parsed.name_en ?? '' });

  const supabase = await createClient();
  const { error } = await supabase.from('categories').insert({
    restaurant_id: parsed.restaurant_id,
    name,
    slug: parsed.slug,
    icon: parsed.icon || '📦',
  });

  if (error) fail(error.message);
  revalidatePath('/menu');
}

export async function renameCategory(formData: FormData) {
  await requireWriter();

  const id = uuid.parse(formData.get('id'));
  const restaurantId = uuid.parse(formData.get('restaurant_id'));
  await assertRestaurantInScope(restaurantId);

  const name = translatable.parse({
    es: String(formData.get('name_es') ?? ''),
    en: String(formData.get('name_en') ?? ''),
  });

  const supabase = await createClient();
  const { error } = await supabase.from('categories').update({ name }).eq('id', id);
  if (error) fail(error.message);
  revalidatePath('/menu');
}

export async function deleteCategory(formData: FormData) {
  const viewer = await requireViewer();
  if (!canAdminister(viewer)) fail('Solo propietarios y gerentes pueden eliminar categorías');

  const id = uuid.parse(formData.get('id'));
  const restaurantId = uuid.parse(formData.get('restaurant_id'));
  await assertRestaurantInScope(restaurantId);

  const supabase = await createClient();

  // menu_items.category_id is NOT NULL with no ON DELETE behaviour, so a
  // category with items would fail on the FK with an opaque Postgres error.
  // Check first and say something useful instead.
  const { count } = await supabase
    .from('menu_items')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id);

  if (count && count > 0) {
    fail(`La categoría tiene ${count} artículo(s). Muévelos o elimínalos primero.`);
  }

  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) fail(error.message);
  revalidatePath('/menu');
}

// ─── Menu items ─────────────────────────────────────────────────────────────

const itemSchema = z.object({
  restaurant_id: uuid,
  category_id: uuid,
  name_es: z.string(),
  name_en: z.string().optional(),
  description_es: z.string().max(500).optional(),
  description_en: z.string().max(500).optional(),
  price: z.string(),
  image_url: z.string().trim().url().or(z.literal('')).optional(),
  available: z.coerce.boolean().optional(),
  popular: z.coerce.boolean().optional(),
  sort_order: z.coerce.number().int().min(0).max(9999).optional(),
});

function itemPayload(formData: FormData) {
  const parsed = itemSchema.parse({
    restaurant_id: formData.get('restaurant_id'),
    category_id: formData.get('category_id'),
    name_es: formData.get('name_es'),
    name_en: formData.get('name_en') ?? '',
    description_es: formData.get('description_es') ?? '',
    description_en: formData.get('description_en') ?? '',
    price: formData.get('price'),
    image_url: formData.get('image_url') ?? '',
    available: formData.get('available') === 'on',
    popular: formData.get('popular') === 'on',
    sort_order: formData.get('sort_order') || 0,
  });

  return {
    parsed,
    row: {
      restaurant_id: parsed.restaurant_id,
      category_id: parsed.category_id,
      name: translatable.parse({ es: parsed.name_es, en: parsed.name_en ?? '' }),
      description: { es: parsed.description_es ?? '', en: parsed.description_en ?? '' },
      price: priceToCents.parse(parsed.price),
      image_url: parsed.image_url || '',
      available: Boolean(parsed.available),
      popular: Boolean(parsed.popular),
      sort_order: parsed.sort_order ?? 0,
    },
  };
}

export async function createMenuItem(formData: FormData) {
  await requireWriter();
  const { parsed, row } = itemPayload(formData);
  await assertRestaurantInScope(parsed.restaurant_id);

  const supabase = await createClient();
  const { data, error } = await supabase.from('menu_items').insert(row).select('id').single();
  if (error) fail(error.message);

  revalidatePath('/menu');
  redirect(`/menu/items/${data!.id}`);
}

export async function updateMenuItem(formData: FormData) {
  await requireWriter();
  const id = uuid.parse(formData.get('id'));
  const { parsed, row } = itemPayload(formData);
  await assertRestaurantInScope(parsed.restaurant_id);

  const supabase = await createClient();
  const { error } = await supabase.from('menu_items').update(row).eq('id', id);
  if (error) fail(error.message);

  revalidatePath('/menu');
  revalidatePath(`/menu/items/${id}`);
}

/** Inline availability toggle straight from the items table. */
export async function setMenuItemFlag(formData: FormData) {
  await requireWriter();

  const id = uuid.parse(formData.get('id'));
  const field = z.enum(['available', 'popular']).parse(formData.get('field'));
  const value = formData.get('value') === 'true';
  const restaurantId = uuid.parse(formData.get('restaurant_id'));
  await assertRestaurantInScope(restaurantId);

  // Written out per field rather than a computed key so the column name stays
  // type-checked against the schema.
  const patch = field === 'available' ? { available: value } : { popular: value };

  const supabase = await createClient();
  const { error } = await supabase.from('menu_items').update(patch).eq('id', id);

  if (error) fail(error.message);
  revalidatePath('/menu');
}

export async function deleteMenuItem(formData: FormData) {
  const viewer = await requireViewer();
  if (!canAdminister(viewer)) fail('Solo propietarios y gerentes pueden eliminar artículos');

  const id = uuid.parse(formData.get('id'));
  const restaurantId = uuid.parse(formData.get('restaurant_id'));
  await assertRestaurantInScope(restaurantId);

  const supabase = await createClient();

  // order_items.menu_item_id is nullable with no cascade, so historical orders
  // keep their item_name snapshot and simply lose the link. Nothing to clean up.
  const { error } = await supabase.from('menu_items').delete().eq('id', id);
  if (error) fail(error.message);

  revalidatePath('/menu');
  redirect(`/menu?r=${restaurantId}`);
}

// ─── Customization groups and options ───────────────────────────────────────

export async function createCustomizationGroup(formData: FormData) {
  await requireWriter();

  const restaurantId = uuid.parse(formData.get('restaurant_id'));
  const menuItemId = uuid.parse(formData.get('menu_item_id'));
  await assertRestaurantInScope(restaurantId);

  const name = translatable.parse({
    es: String(formData.get('name_es') ?? ''),
    en: String(formData.get('name_en') ?? ''),
  });

  const supabase = await createClient();
  const { error } = await supabase.from('customization_groups').insert({
    restaurant_id: restaurantId,
    menu_item_id: menuItemId,
    name,
    required: formData.get('required') === 'on',
    max_selections: z.coerce.number().int().min(1).max(50).parse(formData.get('max_selections') || 1),
  });

  if (error) fail(error.message);
  revalidatePath(`/menu/items/${menuItemId}`);
}

export async function deleteCustomizationGroup(formData: FormData) {
  await requireWriter();

  const id = uuid.parse(formData.get('id'));
  const menuItemId = uuid.parse(formData.get('menu_item_id'));
  const restaurantId = uuid.parse(formData.get('restaurant_id'));
  await assertRestaurantInScope(restaurantId);

  const supabase = await createClient();
  // Options reference the group without a cascade, so remove them first.
  await supabase.from('customization_options').delete().eq('group_id', id);
  const { error } = await supabase.from('customization_groups').delete().eq('id', id);
  if (error) fail(error.message);

  revalidatePath(`/menu/items/${menuItemId}`);
}

export async function createCustomizationOption(formData: FormData) {
  await requireWriter();

  const restaurantId = uuid.parse(formData.get('restaurant_id'));
  const groupId = uuid.parse(formData.get('group_id'));
  const menuItemId = uuid.parse(formData.get('menu_item_id'));
  await assertRestaurantInScope(restaurantId);

  const name = translatable.parse({
    es: String(formData.get('name_es') ?? ''),
    en: String(formData.get('name_en') ?? ''),
  });

  // Modifiers may be negative (a discount for removing an ingredient), so this
  // deliberately does not reuse the nonnegative priceToCents.
  const raw = String(formData.get('price_modifier') ?? '0').replace(',', '.');
  const priceModifier = Math.round(z.coerce.number().min(-10_000).max(10_000).parse(raw) * 100);

  const supabase = await createClient();
  const { error } = await supabase.from('customization_options').insert({
    restaurant_id: restaurantId,
    group_id: groupId,
    name,
    price_modifier: priceModifier,
  });

  if (error) fail(error.message);
  revalidatePath(`/menu/items/${menuItemId}`);
}

export async function deleteCustomizationOption(formData: FormData) {
  await requireWriter();

  const id = uuid.parse(formData.get('id'));
  const menuItemId = uuid.parse(formData.get('menu_item_id'));
  const restaurantId = uuid.parse(formData.get('restaurant_id'));
  await assertRestaurantInScope(restaurantId);

  const supabase = await createClient();
  const { error } = await supabase.from('customization_options').delete().eq('id', id);
  if (error) fail(error.message);

  revalidatePath(`/menu/items/${menuItemId}`);
}
