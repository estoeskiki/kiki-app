import Link from 'next/link';
import { FilterBar } from '@/components/filters/FilterBar';
import { OrdersRealtime } from '@/components/orders/OrdersRealtime';
import { SearchBox } from '@/components/orders/SearchBox';
import { Card, EmptyState, PageHeading } from '@/components/ui/Card';
import { ChannelBadge, StatusBadge, ZoneBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { NumCell, TableWrap, TD, TH, TR } from '@/components/ui/Table';
import { requireViewer } from '@/lib/auth/dal';
import { buildQuery, parseFilters, type SearchParams } from '@/lib/filters';
import { getOrders, getScopeTree, ORDERS_PAGE_SIZE } from '@/lib/queries';
import { formatAgo, formatDateTime, formatMoney } from '@/lib/format';

export const metadata = { title: 'Pedidos · Kiki' };

const PAYMENT_LABEL: Record<string, string> = {
  paid: 'Pagado',
  pending: 'Pendiente',
  failed: 'Fallido',
};

/**
 * Order monitoring.
 *
 * One row per (order, restaurant) — a food-court order that touched two stalls
 * appears once for each, which is what each tenant needs to see and what makes
 * the per-restaurant totals add up.
 */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireViewer();

  const params = await searchParams;
  const filters = parseFilters(params);

  const [scope, { rows, nextCursor }] = await Promise.all([getScopeTree(), getOrders(filters)]);

  const query = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) =>
      typeof v === 'string' ? [[k, v] as [string, string]] : []
    )
  );

  return (
    <>
      <FilterBar scope={scope} />

      <div className="fade-in px-7 pb-12 pt-6">
        <PageHeading
          title="Pedidos"
          subtitle={
            rows.length === 0
              ? 'Sin resultados para estos filtros'
              : `Mostrando ${rows.length}${nextCursor ? '+' : ''} pedido${rows.length === 1 ? '' : 's'}`
          }
          actions={<OrdersRealtime />}
        />

        <div className="mb-4">
          <SearchBox />
        </div>

        <Card>
          {rows.length === 0 ? (
            <EmptyState>
              No hay pedidos que coincidan. Prueba a ampliar el rango de fechas o limpiar los
              filtros.
            </EmptyState>
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <TH>#</TH>
                  <TH>Restaurante</TH>
                  <TH>Origen</TH>
                  <TH>Zona</TH>
                  <TH>Estado</TH>
                  <TH>Pago</TH>
                  <TH>Cliente</TH>
                  <TH align="right">Total</TH>
                  <TH align="right">Hora</TH>
                  <TH />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <TR key={row.sub_order_id}>
                    <TD>
                      <Link
                        href={`/orders/${row.order_id}`}
                        className="font-heading font-bold tabular-nums text-primary"
                      >
                        #{row.order_number}
                      </Link>
                    </TD>
                    <TD>
                      <span className="font-semibold text-text-primary">{row.restaurant_name}</span>
                    </TD>
                    <TD>
                      <ChannelBadge channel={row.channel} />
                    </TD>
                    <TD>
                      <ZoneBadge
                        tableId={row.table_id}
                        label={row.table_label}
                        tableNumber={row.table_number}
                      />
                    </TD>
                    <TD>
                      <StatusBadge status={row.status} />
                    </TD>
                    <TD>
                      <span
                        className={`text-[11px] ${
                          row.payment_status === 'paid'
                            ? 'text-primary'
                            : row.payment_status === 'failed'
                              ? 'text-secondary'
                              : 'text-muted'
                        }`}
                      >
                        {PAYMENT_LABEL[row.payment_status] ?? row.payment_status}
                      </span>
                    </TD>
                    <TD>
                      <span className="text-muted">{row.customer_name ?? '—'}</span>
                    </TD>
                    <TD align="right">
                      <NumCell className="text-text-primary">
                        {formatMoney(row.total, row.currency)}
                      </NumCell>
                    </TD>
                    <TD align="right">
                      <span className="text-muted" title={formatDateTime(row.created_at)}>
                        {formatAgo(row.created_at)}
                      </span>
                    </TD>
                    <TD>
                      <Link href={`/orders/${row.order_id}`} className="text-muted hover:text-primary">
                        <Icon name="chevronRight" size={14} />
                      </Link>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>

        {/* Keyset pagination: "next" carries an opaque cursor rather than an
            offset, so live inserts can't make a page skip or repeat rows. */}
        {nextCursor ? (
          <div className="mt-4 flex items-center justify-between">
            <span className="text-[11px] text-muted">
              Página de {ORDERS_PAGE_SIZE}
            </span>
            <Link
              href={`/orders${buildQuery(query, { cursor: nextCursor })}`}
              className="flex items-center gap-1.5 rounded-[8px] border border-line-strong px-3.5 py-2 text-[12px] font-bold uppercase tracking-[0.06em] text-text-primary transition-colors hover:bg-surface-highlight"
            >
              Siguientes
              <Icon name="chevronRight" size={13} />
            </Link>
          </div>
        ) : null}

        {filters.cursor ? (
          <div className="mt-3">
            <Link
              href={`/orders${buildQuery(query, { cursor: null })}`}
              className="text-[11px] text-muted hover:text-text-primary"
            >
              ← Volver al inicio
            </Link>
          </div>
        ) : null}
      </div>
    </>
  );
}
