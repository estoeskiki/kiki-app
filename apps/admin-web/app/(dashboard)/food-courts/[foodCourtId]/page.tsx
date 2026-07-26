import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardLabel, CardTitle } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { KpiCard } from '@/components/KpiCard';
import { BarList, type BarRow } from '@/components/charts/BarList';
import { ZonesCard } from '@/components/tenant/ZonesCard';
import { NumCell, TableWrap, TD, TH, TR } from '@/components/ui/Table';
import { canAdminister, requireViewer } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { getKpis, getScopeTree } from '@/lib/queries';
import { parseFilters } from '@/lib/filters';
import {
  addDays,
  changeRatio,
  formatMoney,
  formatNumber,
  formatPercent,
  startOfLocalDay,
} from '@/lib/format';
import { setRestaurantFoodCourt } from '../../restaurants/actions';

export const metadata = { title: 'Patio de Comida · Kiki' };

/**
 * Food-court detail: the stalls trading in it, how revenue splits between them,
 * and the zones (Sala VIP, Palcos) customers order from.
 */
export default async function FoodCourtDetailPage({
  params,
}: {
  params: Promise<{ foodCourtId: string }>;
}) {
  const viewer = await requireViewer();
  const { foodCourtId } = await params;

  const supabase = await createClient();

  const { data: foodCourt } = await supabase
    .from('food_courts')
    .select('id, name, slug, address')
    .eq('id', foodCourtId)
    .maybeSingle();

  if (!foodCourt) notFound();

  const from = addDays(startOfLocalDay(new Date()), -30);

  const [scope, { data: zones }, { data: factRows }, kpis] = await Promise.all([
    getScopeTree(),
    supabase
      .from('tables')
      .select('id, label, is_active, allows_manual_number, qr_token')
      .eq('food_court_id', foodCourt.id)
      .order('label'),
    supabase
      .from('dashboard_order_facts')
      .select('restaurant_id, restaurant_name, total, status')
      .eq('food_court_id', foodCourt.id)
      .gte('created_at', from.toISOString()),
    getKpis(parseFilters({ range: '30d', fc: foodCourt.id })),
  ]);

  const stalls = scope.restaurants.filter((r) => r.food_court_id === foodCourt.id);

  const perStall = new Map<string, { name: string; revenue: number; orders: number }>();
  for (const row of factRows ?? []) {
    if (row.status === 'cancelled' || !row.restaurant_id) continue;
    const entry =
      perStall.get(row.restaurant_id) ?? { name: row.restaurant_name ?? '—', revenue: 0, orders: 0 };
    entry.revenue += row.total ?? 0;
    entry.orders += 1;
    perStall.set(row.restaurant_id, entry);
  }

  const totalRevenue = [...perStall.values()].reduce((sum, s) => sum + s.revenue, 0);
  const splitRows: BarRow[] = [...perStall.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .map(([id, stall], index) => ({
      key: id,
      label: stall.name,
      value: formatPercent(totalRevenue ? stall.revenue / totalRevenue : 0, 0),
      ratio: totalRevenue ? stall.revenue / totalRevenue : 0,
      tone: index === 0 ? 'lime' : 'cyan',
      meta: `${formatMoney(stall.revenue)} · ${formatNumber(stall.orders)} pedidos`,
    }));

  const administers = canAdminister(viewer);
  const unlinked = scope.restaurants.filter((r) => !r.food_court_id);

  return (
    <div className="fade-in px-7 pb-12 pt-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/food-courts"
          className="flex items-center gap-1 text-[12px] text-muted hover:text-text-primary"
        >
          <Icon name="chevronLeft" size={13} />
          Patios de Comida
        </Link>
        <span className="text-line-strong" aria-hidden>
          |
        </span>
        <h1 className="font-heading text-[20px] font-bold tracking-[-0.04em] text-text-primary">
          {foodCourt.name}
        </h1>
        <Badge tone="neutral">/{foodCourt.slug}</Badge>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Ingresos (30 d)"
          value={formatMoney(kpis.current.revenue_cents)}
          change={changeRatio(kpis.current.revenue_cents, kpis.previous.revenue_cents)}
        />
        <KpiCard
          label="Pedidos (30 d)"
          value={formatNumber(kpis.current.orders)}
          change={changeRatio(kpis.current.orders, kpis.previous.orders)}
        />
        <KpiCard label="Puestos" value={formatNumber(stalls.length)} change={null} />
      </div>

      <div className="grid gap-3.5 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <CardTitle>Puestos</CardTitle>
            <span className="text-[11px] text-muted">últimos 30 días</span>
          </div>

          {stalls.length === 0 ? (
            <p className="p-6 text-center text-[12px] text-muted">
              Aún no hay restaurantes vinculados.
            </p>
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <TH>Restaurante</TH>
                  <TH>Estado</TH>
                  <TH align="right">Pedidos</TH>
                  <TH align="right">Ingresos</TH>
                  {viewer.is_platform_admin ? <TH /> : null}
                </tr>
              </thead>
              <tbody>
                {stalls.map((stall) => {
                  const stat = perStall.get(stall.id);
                  return (
                    <TR key={stall.id}>
                      <TD>
                        <Link
                          href={`/restaurants/${stall.id}`}
                          className="font-semibold text-text-primary hover:text-primary"
                        >
                          {stall.name}
                        </Link>
                      </TD>
                      <TD>
                        <Badge tone={stall.is_open ? 'lime' : 'neutral'}>
                          {stall.is_open ? 'Abierto' : 'Cerrado'}
                        </Badge>
                      </TD>
                      <TD align="right">
                        <NumCell className="text-text-primary">
                          {formatNumber(stat?.orders ?? 0)}
                        </NumCell>
                      </TD>
                      <TD align="right">
                        <NumCell className={stat?.revenue ? 'text-primary' : 'text-muted'}>
                          {formatMoney(stat?.revenue ?? 0, stall.currency)}
                        </NumCell>
                      </TD>
                      {viewer.is_platform_admin ? (
                        <TD>
                          <form action={setRestaurantFoodCourt}>
                            <input type="hidden" name="restaurant_id" value={stall.id} />
                            <input type="hidden" name="food_court_id" value="" />
                            <button
                              type="submit"
                              className="text-[10px] text-muted transition-colors hover:text-secondary"
                            >
                              Desvincular
                            </button>
                          </form>
                        </TD>
                      ) : null}
                    </TR>
                  );
                })}
              </tbody>
            </TableWrap>
          )}

          {viewer.is_platform_admin && unlinked.length > 0 ? (
            <form
              action={setRestaurantFoodCourt}
              className="flex flex-wrap items-end gap-2 border-t border-line p-4"
            >
              <input type="hidden" name="food_court_id" value={foodCourt.id} />
              <label className="block">
                <CardLabel className="mb-1.5">Vincular restaurante</CardLabel>
                <select
                  name="restaurant_id"
                  className="rounded-[8px] border border-line bg-surface-container px-3 py-2 text-[13px] text-text-primary outline-none focus:border-primary/40"
                >
                  {unlinked.map((restaurant) => (
                    <option key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" size="sm">
                <Icon name="plus" size={12} />
                Vincular
              </Button>
            </form>
          ) : null}
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card className="p-5">
            <CardTitle className="mb-1">Reparto de Ingresos</CardTitle>
            <CardLabel className="mb-4">Participación de cada puesto</CardLabel>
            <BarList rows={splitRows} emptyLabel="Sin ventas en los últimos 30 días" />
          </Card>

          <ZonesCard
            zones={zones ?? []}
            foodCourtId={foodCourt.id}
            canEdit={administers}
            title="Zonas del recinto"
            hint="Sala VIP, Palcos y mesas con QR compartido"
          />
        </div>
      </div>
    </div>
  );
}
