import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ItemForm } from '@/components/menu/ItemForm';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardLabel, CardTitle } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { canAdminister, canWrite, requireViewer } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { formatMoney } from '@/lib/format';
import { tr } from '@/lib/i18n';
import {
  createCustomizationGroup,
  createCustomizationOption,
  deleteCustomizationGroup,
  deleteCustomizationOption,
  deleteMenuItem,
  updateMenuItem,
} from '../../actions';

export const metadata = { title: 'Artículo · Kiki' };

const SMALL_INPUT =
  'rounded-[7px] border border-line bg-surface-container px-2.5 py-1.5 text-[12px] text-text-primary outline-none focus:border-primary/40';

/**
 * Item editor, including its customization groups and options.
 *
 * The item is fetched by id with no restaurant filter: RLS already restricts
 * menu_items to the caller's restaurants, so an id outside their scope simply
 * returns nothing and 404s. Adding a redundant `.eq('restaurant_id', …)` here
 * would only invite the mistake of trusting a client-supplied one.
 */
export default async function MenuItemPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const viewer = await requireViewer();
  const { itemId } = await params;

  const supabase = await createClient();

  const { data: item } = await supabase
    .from('menu_items')
    .select(
      'id, restaurant_id, category_id, name, description, price, image_url, available, popular, sort_order'
    )
    .eq('id', itemId)
    .maybeSingle();

  if (!item) notFound();

  const [{ data: restaurant }, { data: categories }, { data: groups }] = await Promise.all([
    supabase.from('restaurants').select('id, name, currency').eq('id', item.restaurant_id).single(),
    supabase.from('categories').select('id, name').eq('restaurant_id', item.restaurant_id).order('sort_order'),
    supabase
      .from('customization_groups')
      .select('id, name, required, max_selections, sort_order')
      .eq('menu_item_id', item.id)
      .order('sort_order'),
  ]);

  const groupIds = (groups ?? []).map((g) => g.id);
  const { data: options } = await supabase
    .from('customization_options')
    .select('id, group_id, name, price_modifier, sort_order')
    .in('group_id', groupIds.length ? groupIds : ['00000000-0000-0000-0000-000000000000'])
    .order('sort_order');

  const currency = restaurant?.currency ?? 'USD';
  const writable = canWrite(viewer);
  const administers = canAdminister(viewer);

  return (
    <div className="fade-in px-7 pb-12 pt-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href={`/menu?r=${item.restaurant_id}&cat=${item.category_id}`}
          className="flex items-center gap-1 text-[12px] text-muted hover:text-text-primary"
        >
          <Icon name="chevronLeft" size={13} />
          Menú
        </Link>
        <span className="text-line-strong" aria-hidden>
          |
        </span>
        <h1 className="font-heading text-[20px] font-bold tracking-[-0.04em] text-text-primary">
          {tr(item.name)}
        </h1>
        <Badge tone={item.available ? 'lime' : 'neutral'}>
          {item.available ? 'Disponible' : 'No disponible'}
        </Badge>
        {item.popular ? <Badge tone="pink">★ Popular</Badge> : null}
        <span className="text-[12px] text-muted">{restaurant?.name}</span>
      </div>

      <div className="grid max-w-[1100px] gap-3.5 xl:grid-cols-[1.4fr_1fr]">
        {writable ? (
          <ItemForm
            action={updateMenuItem}
            restaurantId={item.restaurant_id}
            categories={categories ?? []}
            submitLabel="Guardar cambios"
            values={item}
          />
        ) : (
          <Card className="p-5">
            <CardTitle className="mb-3">Detalles</CardTitle>
            <p className="text-[13px] text-text-primary">{tr(item.description)}</p>
            <p className="mt-3 font-heading text-[18px] font-bold text-primary">
              {formatMoney(item.price, currency)}
            </p>
            <p className="mt-3 text-[11px] text-muted">
              Tu rol no permite editar el menú.
            </p>
          </Card>
        )}

        <div className="flex flex-col gap-3.5">
          <Card className="p-5">
            <CardTitle className="mb-1">Personalizaciones</CardTitle>
            <CardLabel className="mb-4">Grupos de opciones para este artículo</CardLabel>

            {(groups ?? []).length === 0 ? (
              <p className="text-[12px] text-muted">Sin grupos de personalización.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {(groups ?? []).map((group) => (
                  <li key={group.id} className="rounded-[10px] border border-line p-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[13px] font-semibold text-text-primary">
                          {tr(group.name)}
                        </div>
                        <div className="mt-0.5 flex gap-1.5">
                          <Badge tone={group.required ? 'pink' : 'neutral'}>
                            {group.required ? 'Obligatorio' : 'Opcional'}
                          </Badge>
                          <Badge tone="neutral">máx {group.max_selections}</Badge>
                        </div>
                      </div>

                      {writable ? (
                        <form action={deleteCustomizationGroup}>
                          <input type="hidden" name="id" value={group.id} />
                          <input type="hidden" name="menu_item_id" value={item.id} />
                          <input type="hidden" name="restaurant_id" value={item.restaurant_id} />
                          <button
                            type="submit"
                            aria-label={`Eliminar grupo ${tr(group.name)}`}
                            className="text-muted transition-colors hover:text-secondary"
                          >
                            <Icon name="x" size={13} />
                          </button>
                        </form>
                      ) : null}
                    </div>

                    <ul className="flex flex-col gap-1">
                      {(options ?? [])
                        .filter((option) => option.group_id === group.id)
                        .map((option) => (
                          <li
                            key={option.id}
                            className="flex items-center justify-between gap-2 border-b border-line py-1 last:border-b-0"
                          >
                            <span className="min-w-0 truncate text-[12px] text-text-primary">
                              {tr(option.name)}
                            </span>
                            <span className="flex items-center gap-2">
                              <span className="font-heading text-[11px] tabular-nums text-muted">
                                {option.price_modifier === 0
                                  ? '—'
                                  : `${option.price_modifier > 0 ? '+' : '−'}${formatMoney(
                                      Math.abs(option.price_modifier),
                                      currency
                                    )}`}
                              </span>
                              {writable ? (
                                <form action={deleteCustomizationOption}>
                                  <input type="hidden" name="id" value={option.id} />
                                  <input type="hidden" name="menu_item_id" value={item.id} />
                                  <input
                                    type="hidden"
                                    name="restaurant_id"
                                    value={item.restaurant_id}
                                  />
                                  <button
                                    type="submit"
                                    aria-label={`Eliminar opción ${tr(option.name)}`}
                                    className="text-muted transition-colors hover:text-secondary"
                                  >
                                    <Icon name="x" size={11} />
                                  </button>
                                </form>
                              ) : null}
                            </span>
                          </li>
                        ))}
                    </ul>

                    {writable ? (
                      <form action={createCustomizationOption} className="mt-2 flex flex-wrap gap-1.5">
                        <input type="hidden" name="group_id" value={group.id} />
                        <input type="hidden" name="menu_item_id" value={item.id} />
                        <input type="hidden" name="restaurant_id" value={item.restaurant_id} />
                        <input
                          name="name_es"
                          required
                          placeholder="Opción (ES)"
                          className={`min-w-0 flex-1 ${SMALL_INPUT}`}
                        />
                        <input
                          name="price_modifier"
                          inputMode="decimal"
                          placeholder="0.00"
                          title="Puede ser negativo, p. ej. -0.50"
                          className={`w-20 ${SMALL_INPUT}`}
                        />
                        <Button type="submit" size="sm" variant="outline">
                          <Icon name="plus" size={11} />
                        </Button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {writable ? (
              <form action={createCustomizationGroup} className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
                <CardLabel>Nuevo grupo</CardLabel>
                <input type="hidden" name="menu_item_id" value={item.id} />
                <input type="hidden" name="restaurant_id" value={item.restaurant_id} />
                <input name="name_es" required placeholder="Nombre (ES)" className={SMALL_INPUT} />
                <input name="name_en" placeholder="Name (EN)" className={SMALL_INPUT} />
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-[12px] text-text-primary">
                    <input
                      type="checkbox"
                      name="required"
                      className="size-[14px] accent-[var(--color-primary)]"
                    />
                    Obligatorio
                  </label>
                  <label className="flex items-center gap-1.5 text-[12px] text-muted">
                    Máx
                    <input
                      name="max_selections"
                      type="number"
                      min={1}
                      max={50}
                      defaultValue={1}
                      className={`w-16 ${SMALL_INPUT}`}
                    />
                  </label>
                </div>
                <Button type="submit" size="sm">
                  <Icon name="plus" size={12} />
                  Crear grupo
                </Button>
              </form>
            ) : null}
          </Card>

          {administers ? (
            <Card className="border-secondary/25 p-4">
              <CardLabel className="mb-1.5">Zona de peligro</CardLabel>
              <p className="mb-3 text-[11px] text-muted">
                Los pedidos anteriores conservan el nombre y el precio con los que se vendieron.
              </p>
              <form action={deleteMenuItem}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="restaurant_id" value={item.restaurant_id} />
                <Button type="submit" variant="danger" size="sm">
                  Eliminar artículo
                </Button>
              </form>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
