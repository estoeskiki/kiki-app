import { Suspense } from 'react';
import Link from 'next/link';
import { FilterBar } from '@/components/filters/FilterBar';
import { KpiCard } from '@/components/KpiCard';
import { AreaChart } from '@/components/charts/AreaChart';
import { BarList, type BarRow } from '@/components/charts/BarList';
import { Heatmap } from '@/components/charts/Heatmap';
import { Card, CardLabel, CardTitle, PageHeading } from '@/components/ui/Card';
import { ChannelBadge, StatusBadge, ZoneBadge } from '@/components/ui/Badge';
import { requireViewer } from '@/lib/auth/dal';
import { parseFilters, type SearchParams } from '@/lib/filters';
import {
  getChannelBreakdown,
  getHeatmap,
  getKpis,
  getLiveOrders,
  getScopeTree,
  getStatusFunnel,
  getTimeseries,
  getTopItems,
  getZoneBreakdown,
} from '@/lib/queries';
import {
  changeRatio,
  formatAgo,
  formatDayLabel,
  formatMoney,
  formatMoneyCompact,
  formatNumber,
  formatPercent,
} from '@/lib/format';
import { displayItemName } from '@/lib/i18n';
import type { DashboardFilters } from '@/lib/filters';

export const metadata = { title: 'Resumen · Kiki' };

/**
 * Overview.
 *
 * Each card is its own Suspense boundary so the KPI row can paint as soon as
 * its single RPC returns, instead of every tile waiting on the slowest query on
 * the page. The RPCs are independent, so they run concurrently.
 */
export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requireViewer();
  const params = await searchParams;
  const filters = parseFilters(params);
  const scope = await getScopeTree();

  const scopeName = viewer.is_platform_admin
    ? 'Todas las Organizaciones'
    : scope.food_courts.length === 1 && !viewer.org_id
      ? scope.food_courts[0].name
      : scope.restaurants.length === 1
        ? scope.restaurants[0].name
        : (scope.organizations[0]?.name ?? 'Resumen');

  const subtitle = `${scope.restaurants.length} restaurante${
    scope.restaurants.length === 1 ? '' : 's'
  } · ${scope.zones.length} zona${scope.zones.length === 1 ? '' : 's'}`;

  return (
    <>
      <FilterBar scope={scope} />

      <div className="fade-in px-7 pb-12 pt-6">
        <PageHeading title={scopeName} subtitle={subtitle} />

        <Suspense fallback={<KpiSkeleton />}>
          <KpiRow filters={filters} />
        </Suspense>

        <div className="mt-4">
          <Suspense fallback={<CardSkeleton height={240} />}>
            <RevenueCard filters={filters} />
          </Suspense>
        </div>

        {/* The two cards the operator specifically asked for: where orders come
            from (kiosk vs order-web) and which zone they came from. */}
        <div className="mt-4 grid gap-3.5 lg:grid-cols-2">
          <Suspense fallback={<CardSkeleton height={200} />}>
            <ChannelCard filters={filters} />
          </Suspense>
          <Suspense fallback={<CardSkeleton height={200} />}>
            <ZoneCard filters={filters} />
          </Suspense>
        </div>

        <div className="mt-4 grid gap-3.5 xl:grid-cols-3">
          <Suspense fallback={<CardSkeleton height={280} />}>
            <HeatmapCard filters={filters} />
          </Suspense>
          <Suspense fallback={<CardSkeleton height={280} />}>
            <TopItemsCard filters={filters} />
          </Suspense>
          <Suspense fallback={<CardSkeleton height={280} />}>
            <FunnelAndLiveCard filters={filters} />
          </Suspense>
        </div>
      </div>
    </>
  );
}

async function KpiRow({ filters }: { filters: DashboardFilters }) {
  const [kpis, series] = await Promise.all([getKpis(filters), getTimeseries(filters)]);
  const { current, previous } = kpis;

  const revenueSpark = series.map((p) => p.revenue_cents);
  const ordersSpark = series.map((p) => p.orders);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Ingresos"
        value={formatMoneyCompact(current.revenue_cents)}
        change={changeRatio(current.revenue_cents, previous.revenue_cents)}
        spark={revenueSpark}
      />
      <KpiCard
        label="Pedidos"
        value={formatNumber(current.orders)}
        change={changeRatio(current.orders, previous.orders)}
        spark={ordersSpark}
      />
      <KpiCard
        label="Ticket Medio"
        value={formatMoney(current.avg_ticket_cents)}
        change={changeRatio(current.avg_ticket_cents, previous.avg_ticket_cents)}
      />
      <KpiCard
        label="Cancelaciones"
        value={formatPercent(current.cancel_rate)}
        change={changeRatio(current.cancel_rate, previous.cancel_rate)}
        goodWhenUp={false}
      />
    </div>
  );
}

async function RevenueCard({ filters }: { filters: DashboardFilters }) {
  const series = await getTimeseries(filters);

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <CardTitle className="text-[14px]">Ingresos en el Tiempo</CardTitle>
        <span className="text-[10px] uppercase tracking-[0.08em] text-muted">
          día de servicio · corte 04:00
        </span>
      </div>
      <AreaChart
        data={series.map((point) => ({
          label: formatDayLabel(point.day),
          value: point.revenue_cents,
          formatted: `${formatMoney(point.revenue_cents)} · ${formatNumber(point.orders)} pedidos`,
        }))}
      />
    </Card>
  );
}

/** Origen del pedido — the kiosk vs order-web split. */
async function ChannelCard({ filters }: { filters: DashboardFilters }) {
  const slices = await getChannelBreakdown(filters);
  const totalOrders = slices.reduce((sum, s) => sum + s.orders, 0);
  const peak = Math.max(1, ...slices.map((s) => s.orders));

  const rows: BarRow[] = slices.map((slice) => ({
    key: slice.channel,
    label: (
      <span className="inline-flex items-center gap-2">
        <ChannelBadge channel={slice.channel} />
      </span>
    ),
    value: `${formatNumber(slice.orders)} · ${formatMoney(slice.revenue_cents)}`,
    ratio: slice.orders / peak,
    tone: slice.channel === 'kiosk' ? 'lime' : 'cyan',
    meta: `${formatPercent(slice.order_share)} de los pedidos · ${formatPercent(
      slice.revenue_share
    )} de los ingresos`,
  }));

  return (
    <Card className="p-5">
      <div className="mb-1 flex items-baseline justify-between">
        <CardTitle>Origen del Pedido</CardTitle>
        <span className="font-heading text-[13px] font-bold tabular-nums text-text-primary">
          {formatNumber(totalOrders)}
        </span>
      </div>
      <CardLabel className="mb-4">Kiosko vs Web</CardLabel>
      <BarList rows={rows} emptyLabel="Sin pedidos en este período" />
    </Card>
  );
}

/** Zonas — Sala VIP, Palcos, mesas, y los pedidos sin zona. */
async function ZoneCard({ filters }: { filters: DashboardFilters }) {
  const slices = await getZoneBreakdown(filters);
  const peak = Math.max(1, ...slices.map((s) => s.orders));

  const rows: BarRow[] = slices.map((slice) => {
    const normalized = slice.label.toLowerCase();
    return {
      key: slice.table_id ?? 'unzoned',
      label: (
        <ZoneBadge tableId={slice.table_id} label={slice.table_id ? slice.label : null} />
      ),
      value: `${formatNumber(slice.orders)} · ${formatMoney(slice.revenue_cents)}`,
      ratio: slice.orders / peak,
      tone: !slice.table_id
        ? 'fade'
        : normalized.includes('vip')
          ? 'pink'
          : normalized.includes('palco')
            ? 'cyan'
            : 'lime',
      meta: `${formatPercent(slice.order_share)} de los pedidos`,
    };
  });

  return (
    <Card className="p-5">
      <div className="mb-1 flex items-baseline justify-between">
        <CardTitle>Zonas</CardTitle>
        <span className="text-[10px] text-muted">{slices.length} activas</span>
      </div>
      <CardLabel className="mb-4">Sala VIP · Palcos · Mesas</CardLabel>
      <BarList rows={rows} emptyLabel="Sin pedidos en este período" />
    </Card>
  );
}

async function HeatmapCard({ filters }: { filters: DashboardFilters }) {
  const cells = await getHeatmap(filters);
  return (
    <Card className="p-5">
      <CardTitle className="mb-4">Mapa de Calor Hora × Día</CardTitle>
      <Heatmap cells={cells} />
    </Card>
  );
}

async function TopItemsCard({ filters }: { filters: DashboardFilters }) {
  const items = await getTopItems(filters, 8);
  const peak = Math.max(1, ...items.map((i) => i.quantity));

  // Two locations can legitimately sell an item of the same name (live data has
  // "Aros de Cebolla" at two restaurants, as distinct menu items). Show the
  // location only when the current result actually spans more than one — on a
  // single-restaurant view the suffix would be noise on every row.
  const spansRestaurants = new Set(items.map((i) => i.restaurant_id)).size > 1;

  return (
    <Card className="p-5">
      <CardTitle className="mb-4">Artículos más Vendidos</CardTitle>
      <BarList
        rows={items.map((item, index) => {
          const name = displayItemName(item.name);
          return {
            // dashboard_top_items returns one row per menu item, so menu_item_id
            // is unique here; the name distinguishes orphaned rows whose menu
            // item was deleted. The index is a last resort so a regression in
            // the RPC degrades into a harmless duplicate label rather than React
            // silently dropping or merging rows.
            key: `${item.menu_item_id ?? 'orphan'}:${name}:${index}`,
            label:
              spansRestaurants && item.restaurant_name ? (
                <>
                  {name}
                  <span className="opacity-60"> · {item.restaurant_name}</span>
                </>
              ) : (
                name
              ),
            value: formatNumber(item.quantity),
            ratio: item.quantity / peak,
            tone: 'lime' as const,
          };
        })}
        emptyLabel="Sin ventas en este período"
      />
    </Card>
  );
}

async function FunnelAndLiveCard({ filters }: { filters: DashboardFilters }) {
  const [funnel, live] = await Promise.all([getStatusFunnel(filters), getLiveOrders(5)]);

  const order = ['confirmed', 'preparing', 'ready', 'completed', 'cancelled'] as const;
  const peak = Math.max(1, ...order.map((status) => funnel[status] ?? 0));

  const rows: BarRow[] = order.map((status) => ({
    key: status,
    label: <StatusBadge status={status} />,
    value: formatNumber(funnel[status] ?? 0),
    ratio: (funnel[status] ?? 0) / peak,
    tone: status === 'cancelled' ? 'pink' : status === 'ready' ? 'lime' : 'cyan',
  }));

  return (
    <Card className="p-5">
      <CardTitle className="mb-1">Embudo de Pedidos</CardTitle>
      <CardLabel className="mb-4">Un pedido puede contar en varios estados</CardLabel>
      <BarList rows={rows} />

      <div className="mt-5 border-t border-line pt-4">
        <CardLabel className="mb-2.5">En Vivo</CardLabel>
        {live.length === 0 ? (
          <p className="text-[12px] text-muted">Sin pedidos recientes</p>
        ) : (
          <ul className="flex flex-col">
            {live.map((row) => (
              <li key={row.sub_order_id}>
                <Link
                  href={`/orders/${row.order_id}`}
                  className="flex items-center gap-2 border-b border-line py-1.5 last:border-b-0 hover:bg-surface-container"
                >
                  <span className="min-w-[38px] font-heading text-[11px] font-bold tabular-nums text-primary">
                    #{row.order_number}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-text-primary">
                    {row.restaurant_name}
                  </span>
                  <ChannelBadge channel={row.channel} />
                  <span className="w-[26px] shrink-0 text-right text-[10px] text-muted">
                    {formatAgo(row.created_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function KpiSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="h-[142px] animate-pulse rounded-[12px] border border-line bg-surface" />
      ))}
    </div>
  );
}

function CardSkeleton({ height }: { height: number }) {
  return (
    <div
      className="animate-pulse rounded-[12px] border border-line bg-surface"
      style={{ height }}
    />
  );
}
