import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardLabel, EmptyState, PageHeading } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { requireViewer } from '@/lib/auth/dal';
import { getScopeTree } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import { addDays, formatMoney, formatNumber, startOfLocalDay } from '@/lib/format';
import { createFoodCourt } from '../restaurants/actions';

export const metadata = { title: 'Patios de Comida · Kiki' };

const INPUT =
  'w-full rounded-[8px] border border-line bg-surface-container px-3 py-2 text-[13px] text-text-primary outline-none focus:border-primary/40';

export default async function FoodCourtsPage() {
  const viewer = await requireViewer();
  const scope = await getScopeTree();

  const from = addDays(startOfLocalDay(new Date()), -30);
  const supabase = await createClient();

  const { data: factRows } = await supabase
    .from('dashboard_order_facts')
    .select('food_court_id, order_id, total, status')
    .gte('created_at', from.toISOString())
    .not('food_court_id', 'is', null);

  // Revenue sums every stall's sub_order; order counts are distinct parents, so
  // one customer buying from two stalls counts as one order for the court.
  const stats = new Map<string, { revenue: number; orderIds: Set<string> }>();
  for (const row of factRows ?? []) {
    if (row.status === 'cancelled' || !row.food_court_id) continue;
    const entry = stats.get(row.food_court_id) ?? { revenue: 0, orderIds: new Set<string>() };
    entry.revenue += row.total ?? 0;
    if (row.order_id) entry.orderIds.add(row.order_id);
    stats.set(row.food_court_id, entry);
  }

  return (
    <div className="fade-in px-7 pb-12 pt-6">
      <PageHeading
        title="Patios de Comida"
        subtitle={`${scope.food_courts.length} recinto${scope.food_courts.length === 1 ? '' : 's'} · últimos 30 días`}
      />

      {scope.food_courts.length === 0 ? (
        <Card>
          <EmptyState>No hay patios de comida en tu alcance.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-3.5 lg:grid-cols-2">
          {scope.food_courts.map((foodCourt) => {
            const stalls = scope.restaurants.filter((r) => r.food_court_id === foodCourt.id);
            const zones = scope.zones.filter((z) => z.food_court_id === foodCourt.id);
            const stat = stats.get(foodCourt.id) ?? { revenue: 0, orderIds: new Set<string>() };

            return (
              <Card key={foodCourt.id} className="p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/food-courts/${foodCourt.id}`}
                      className="font-heading text-[15px] font-bold tracking-[-0.03em] text-text-primary hover:text-primary"
                    >
                      {foodCourt.name}
                    </Link>
                    <div className="mt-1 text-[11px] text-muted">
                      {stalls.length} puesto{stalls.length === 1 ? '' : 's'} · {zones.length} zona
                      {zones.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <Link
                    href={`/food-courts/${foodCourt.id}`}
                    className="text-muted hover:text-primary"
                    aria-label={`Abrir ${foodCourt.name}`}
                  >
                    <Icon name="chevronRight" size={15} />
                  </Link>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-2.5">
                  <Stat label="Ingresos (30 d)" value={formatMoney(stat.revenue)} accent />
                  <Stat label="Pedidos (30 d)" value={formatNumber(stat.orderIds.size)} />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {stalls.map((stall, index) => (
                    <span
                      key={stall.id}
                      className={`rounded-[5px] px-2 py-[3px] text-[10px] font-semibold ${
                        index % 2 === 0 ? 'bg-primary/[0.08] text-primary' : 'bg-tertiary/[0.08] text-tertiary'
                      }`}
                    >
                      {stall.name}
                    </span>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {viewer.is_platform_admin ? (
        <Card className="mt-4 max-w-[560px] p-5">
          <CardLabel className="mb-1">Nuevo recinto</CardLabel>
          <p className="mb-3 text-[11px] text-muted">
            Un patio de comida aloja restaurantes de varias organizaciones, por eso solo lo crea el
            operador de la plataforma.
          </p>
          <form action={createFoodCourt} className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <CardLabel className="mb-1.5">Nombre *</CardLabel>
              <input name="name" required className={INPUT} />
            </label>
            <label className="block">
              <CardLabel className="mb-1.5">Slug *</CardLabel>
              <input name="slug" required pattern="[a-z0-9-]+" className={INPUT} />
            </label>
            <label className="block sm:col-span-2">
              <CardLabel className="mb-1.5">Dirección</CardLabel>
              <input name="address" className={INPUT} />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit">
                <Icon name="plus" size={13} />
                Crear patio de comida
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-[8px] bg-surface-container px-3 py-2.5">
      <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.08em] text-muted">{label}</div>
      <div
        className={`font-heading text-[16px] font-bold tracking-[-0.03em] tabular-nums ${
          accent ? 'text-primary' : 'text-text-primary'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
