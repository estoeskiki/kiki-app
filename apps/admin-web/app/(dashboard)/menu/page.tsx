import Link from 'next/link';
import { Card, CardLabel, EmptyState, PageHeading } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { NumCell, TableWrap, TD, TH, TR } from '@/components/ui/Table';
import { RestaurantPicker } from '@/components/RestaurantPicker';
import { canAdminister, canWrite, requireViewer } from '@/lib/auth/dal';
import { getScopeTree } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import { formatMoney } from '@/lib/format';
import { tr } from '@/lib/i18n';
import type { SearchParams } from '@/lib/filters';
import { createCategory, deleteCategory, setMenuItemFlag } from './actions';

export const metadata = { title: 'Menú · Kiki' };

/**
 * Menu management for one restaurant at a time.
 *
 * Categories and items are separate tables scoped by restaurant_id, and RLS
 * only returns the ones this viewer may touch — so an empty list here means
 * "nothing in scope", never "query failed silently".
 */
export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requireViewer();
  const params = await searchParams;
  const scope = await getScopeTree();

  const requested = typeof params.r === 'string' ? params.r : undefined;
  const restaurant =
    scope.restaurants.find((r) => r.id === requested) ?? scope.restaurants[0] ?? null;

  if (!restaurant) {
    return (
      <div className="px-7 pt-6">
        <PageHeading title="Menú" />
        <Card>
          <EmptyState>No tienes restaurantes asignados.</EmptyState>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();

  const [{ data: categoryRows }, { data: itemRows }] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, slug, icon, sort_order')
      .eq('restaurant_id', restaurant.id)
      .order('sort_order'),
    supabase
      .from('menu_items')
      .select('id, category_id, name, price, available, popular, sort_order')
      .eq('restaurant_id', restaurant.id)
      .order('sort_order'),
  ]);

  const categories = categoryRows ?? [];
  const items = itemRows ?? [];

  const requestedCat = typeof params.cat === 'string' ? params.cat : undefined;
  const activeCategory =
    categories.find((c) => c.id === requestedCat) ?? categories[0] ?? null;

  const visibleItems = activeCategory
    ? items.filter((i) => i.category_id === activeCategory.id)
    : [];

  const writable = canWrite(viewer);
  const administers = canAdminister(viewer);

  const query = (patch: Record<string, string>) => {
    const next = new URLSearchParams({ r: restaurant.id, ...patch });
    return `?${next.toString()}`;
  };

  return (
    <div className="fade-in px-7 pb-12 pt-6">
      <PageHeading
        title="Menú"
        subtitle={`${restaurant.name} · ${items.length} artículo${items.length === 1 ? '' : 's'} en ${categories.length} categoría${categories.length === 1 ? '' : 's'}`}
        actions={
          <>
            <RestaurantPicker
              restaurants={scope.restaurants}
              value={restaurant.id}
              extraResetKeys={['cat']}
            />
            {writable && activeCategory ? (
              <ButtonLink
                href={`/menu/items/new?r=${restaurant.id}&cat=${activeCategory.id}`}
                size="md"
              >
                <Icon name="plus" size={13} />
                Añadir artículo
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <div className="grid gap-3.5 lg:grid-cols-[220px_1fr]">
        <div className="flex flex-col gap-3.5">
          <Card className="p-2">
            <CardLabel className="px-2 pb-2 pt-1.5">Categorías</CardLabel>

            {categories.length === 0 ? (
              <p className="px-2 pb-2 text-[12px] text-muted">Aún no hay categorías.</p>
            ) : (
              categories.map((category) => {
                const active = category.id === activeCategory?.id;
                const count = items.filter((i) => i.category_id === category.id).length;
                return (
                  <Link
                    key={category.id}
                    href={query({ cat: category.id })}
                    className={`mb-0.5 flex items-center justify-between gap-2 rounded-[7px] border px-2.5 py-2 text-[13px] transition-colors ${
                      active
                        ? 'border-primary/20 bg-primary/[0.07] font-semibold text-primary'
                        : 'border-transparent text-muted hover:text-text-primary'
                    }`}
                  >
                    <span className="min-w-0 truncate">
                      <span className="mr-1.5">{category.icon}</span>
                      {tr(category.name)}
                    </span>
                    <span className="shrink-0 rounded-[4px] bg-line px-1.5 py-0.5 text-[10px] text-muted">
                      {count}
                    </span>
                  </Link>
                );
              })
            )}
          </Card>

          {writable ? (
            <Card className="p-3">
              <CardLabel className="mb-2.5">Nueva categoría</CardLabel>
              <form action={createCategory} className="flex flex-col gap-2">
                <input type="hidden" name="restaurant_id" value={restaurant.id} />
                <input
                  name="name_es"
                  required
                  placeholder="Nombre (ES)"
                  className="rounded-[7px] border border-line bg-surface-container px-2.5 py-1.5 text-[12px] text-text-primary outline-none focus:border-primary/40"
                />
                <input
                  name="name_en"
                  placeholder="Name (EN)"
                  className="rounded-[7px] border border-line bg-surface-container px-2.5 py-1.5 text-[12px] text-text-primary outline-none focus:border-primary/40"
                />
                <div className="flex gap-2">
                  <input
                    name="slug"
                    required
                    pattern="[a-z0-9-]+"
                    placeholder="slug"
                    className="min-w-0 flex-1 rounded-[7px] border border-line bg-surface-container px-2.5 py-1.5 text-[12px] text-text-primary outline-none focus:border-primary/40"
                  />
                  <input
                    name="icon"
                    maxLength={4}
                    placeholder="📦"
                    className="w-12 rounded-[7px] border border-line bg-surface-container px-2 py-1.5 text-center text-[12px] outline-none focus:border-primary/40"
                  />
                </div>
                <Button type="submit" size="sm">
                  <Icon name="plus" size={12} />
                  Crear
                </Button>
              </form>
            </Card>
          ) : null}
        </div>

        <Card>
          {!activeCategory ? (
            <EmptyState>Crea una categoría para empezar a cargar el menú.</EmptyState>
          ) : visibleItems.length === 0 ? (
            <EmptyState>Sin artículos en esta categoría.</EmptyState>
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <TH>Artículo</TH>
                  <TH align="right">Precio</TH>
                  <TH>Disponible</TH>
                  <TH>Popular</TH>
                  <TH />
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <TR key={item.id}>
                    <TD>
                      <Link
                        href={`/menu/items/${item.id}`}
                        className="font-semibold text-text-primary hover:text-primary"
                      >
                        {tr(item.name)}
                      </Link>
                    </TD>
                    <TD align="right">
                      <NumCell className="text-primary">
                        {formatMoney(item.price, restaurant.currency)}
                      </NumCell>
                    </TD>
                    <TD>
                      <FlagToggle
                        itemId={item.id}
                        restaurantId={restaurant.id}
                        field="available"
                        value={item.available}
                        onLabel="Activo"
                        offLabel="Inactivo"
                        disabled={!writable}
                      />
                    </TD>
                    <TD>
                      <FlagToggle
                        itemId={item.id}
                        restaurantId={restaurant.id}
                        field="popular"
                        value={item.popular}
                        onLabel="★ Popular"
                        offLabel="—"
                        disabled={!writable}
                        tone="pink"
                      />
                    </TD>
                    <TD>
                      <Link
                        href={`/menu/items/${item.id}`}
                        className="text-muted hover:text-primary"
                        aria-label={`Editar ${tr(item.name)}`}
                      >
                        <Icon name="chevronRight" size={14} />
                      </Link>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
      </div>

      {administers && activeCategory ? (
        <form action={deleteCategory} className="mt-4">
          <input type="hidden" name="id" value={activeCategory.id} />
          <input type="hidden" name="restaurant_id" value={restaurant.id} />
          <Button type="submit" variant="danger" size="sm">
            Eliminar «{tr(activeCategory.name)}»
          </Button>
        </form>
      ) : null}
    </div>
  );
}

/**
 * Availability and popularity flip through a Server Action rather than a
 * client-side optimistic toggle — one round trip, no state to reconcile, and it
 * still works with JavaScript disabled.
 */
function FlagToggle({
  itemId,
  restaurantId,
  field,
  value,
  onLabel,
  offLabel,
  disabled,
  tone = 'lime',
}: {
  itemId: string;
  restaurantId: string;
  field: 'available' | 'popular';
  value: boolean;
  onLabel: string;
  offLabel: string;
  disabled: boolean;
  tone?: 'lime' | 'pink';
}) {
  if (disabled) {
    return <Badge tone={value ? tone : 'neutral'}>{value ? onLabel : offLabel}</Badge>;
  }

  return (
    <form action={setMenuItemFlag}>
      <input type="hidden" name="id" value={itemId} />
      <input type="hidden" name="restaurant_id" value={restaurantId} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="value" value={String(!value)} />
      <button type="submit" className="cursor-pointer" aria-pressed={value}>
        <Badge tone={value ? tone : 'neutral'}>{value ? onLabel : offLabel}</Badge>
      </button>
    </form>
  );
}
