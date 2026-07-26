import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ItemForm } from '@/components/menu/ItemForm';
import { Icon } from '@/components/ui/Icon';
import { canWrite, requireViewer } from '@/lib/auth/dal';
import { getScopeTree } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import type { SearchParams } from '@/lib/filters';
import { createMenuItem } from '../../actions';

export const metadata = { title: 'Nuevo artículo · Kiki' };

export default async function NewMenuItemPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requireViewer();
  if (!canWrite(viewer)) notFound();

  const params = await searchParams;
  const scope = await getScopeTree();

  const requested = typeof params.r === 'string' ? params.r : undefined;
  const restaurant = scope.restaurants.find((r) => r.id === requested) ?? scope.restaurants[0];
  if (!restaurant) notFound();

  const supabase = await createClient();
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('restaurant_id', restaurant.id)
    .order('sort_order');

  if (!categories || categories.length === 0) notFound();

  const requestedCat = typeof params.cat === 'string' ? params.cat : undefined;
  const categoryId = categories.find((c) => c.id === requestedCat)?.id ?? categories[0].id;

  return (
    <div className="fade-in px-7 pb-12 pt-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={`/menu?r=${restaurant.id}`}
          className="flex items-center gap-1 text-[12px] text-muted hover:text-text-primary"
        >
          <Icon name="chevronLeft" size={13} />
          Menú
        </Link>
        <span className="text-line-strong" aria-hidden>
          |
        </span>
        <h1 className="font-heading text-[20px] font-bold tracking-[-0.04em] text-text-primary">
          Nuevo artículo
        </h1>
      </div>

      <div className="max-w-[820px]">
        <ItemForm
          action={createMenuItem}
          restaurantId={restaurant.id}
          categories={categories}
          submitLabel="Crear artículo"
          values={{
            category_id: categoryId,
            name: { es: '', en: '' },
            description: { es: '', en: '' },
            price: 0,
            image_url: '',
            available: true,
            popular: false,
            sort_order: 0,
          }}
        />
      </div>
    </div>
  );
}
