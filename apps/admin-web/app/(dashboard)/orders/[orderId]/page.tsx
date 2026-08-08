import { CONTENT_WIDTH } from '@/components/ui/Container';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardLabel, CardTitle } from '@/components/ui/Card';
import { ChannelBadge, StatusBadge, statusLabel, ZoneBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { DeleteOrder } from '@/components/orders/DeleteOrder';
import { OrderActions } from '@/components/orders/OrderActions';
import { canAdminister, canWrite, requireViewer } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { formatDateTime, formatDuration, formatMoney, formatTime } from '@/lib/format';
import { displayItemName } from '@/lib/i18n';

export const metadata = { title: 'Pedido · Kiki' };

const ORDER_TYPE_LABEL: Record<string, string> = {
  'dine-in': 'En mesa',
  takeaway: 'Para llevar',
  delivery: 'Domicilio',
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  yappy: 'Yappy',
  cash_on_delivery: 'Efectivo',
  card_on_delivery: 'Tarjeta',
};

/**
 * Full order detail.
 *
 * A food-court order fans out across restaurants, so the page is organised as
 * one section per sub_order. RLS decides which of those sections the viewer can
 * see: a single-restaurant manager gets only their own, a platform admin gets
 * all of them. That filtering happens in the database, not here — if the query
 * returns nothing at all, the order either doesn't exist or isn't theirs, and
 * both cases render as 404 so this page can't be used to probe for order ids.
 */
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const viewer = await requireViewer();
  const { orderId } = await params;

  const supabase = await createClient();

  const { data: facts } = await supabase
    .from('dashboard_order_facts')
    .select('*')
    .eq('order_id', orderId)
    .order('restaurant_name');

  const subOrders = facts ?? [];
  if (subOrders.length === 0) notFound();

  // dashboard_order_facts doesn't carry fiscal_invoice_id (it's a display view,
  // not meant to expose fiscal internals), so the "can this status still be
  // changed" check pulls it separately, scoped by the same RLS.
  const { data: fiscalRows } = await supabase
    .from('sub_orders')
    .select('id, fiscal_invoice_id, payment_status')
    .eq('order_id', orderId);
  const fiscalInvoiceBySubOrder = new Map((fiscalRows ?? []).map((r) => [r.id, r.fiscal_invoice_id]));

  const writable = canWrite(viewer);
  const administers = canAdminister(viewer);

  // Mirrors the orders_delete policy (046) so the control can say why it is
  // unavailable. The policy is what actually enforces this.
  const { data: parentOrder } = await supabase
    .from('orders')
    .select('order_number, payment_status, fiscal_invoice_ids')
    .eq('id', orderId)
    .maybeSingle();

  const deleteBlockedReason: string | null =
    (parentOrder?.fiscal_invoice_ids ?? []).length > 0 ||
    (fiscalRows ?? []).some((r) => r.fiscal_invoice_id)
      ? 'Este pedido tiene factura fiscal, así que no puede eliminarse.'
      : parentOrder?.payment_status === 'paid' ||
          (fiscalRows ?? []).some((r) => r.payment_status === 'paid')
        ? 'Este pedido está pagado, así que no puede eliminarse. Cancélalo en su lugar.'
        : null;

  const head = subOrders[0];

  const { data: itemRows } = await supabase
    .from('order_items')
    .select('id, sub_order_id, item_name, item_price, quantity, line_total')
    .eq('order_id', orderId);

  const items = itemRows ?? [];

  const { data: customizationRows } = await supabase
    .from('order_item_customizations')
    .select('id, order_item_id, group_name, option_name, price_modifier')
    .in('order_item_id', items.length ? items.map((i) => i.id) : ['00000000-0000-0000-0000-000000000000']);

  const customizationsByItem = new Map<string, typeof customizationRows>();
  for (const row of customizationRows ?? []) {
    const list = customizationsByItem.get(row.order_item_id) ?? [];
    list.push(row);
    customizationsByItem.set(row.order_item_id, list);
  }

  const visibleTotal = subOrders.reduce((sum, so) => sum + (so.total ?? 0), 0);

  // Real transition history, if any exists — order_status_events (042) only
  // logs going forward, so an order that moved through its lifecycle before
  // that migration landed will have none, and the fallback below (a single
  // computed duration, not a timeline) is what covers it.
  const { data: eventRows } = await supabase
    .from('order_status_events')
    .select('id, sub_order_id, from_status, to_status, changed_at')
    .eq('order_id', orderId)
    .order('changed_at');

  const events = eventRows ?? [];
  const restaurantBySubOrder = new Map(subOrders.map((so) => [so.sub_order_id, so.restaurant_name]));

  // Whole-order duration, not just head's own stall: the same bottleneck
  // definition dashboard_order_pipeline uses — "completed" only once every
  // stall individually is, using the earliest creation and the latest update
  // across all of them, so a multi-stall order is timed end-to-end rather than
  // by whichever restaurant happens to be first in the list.
  const allCompleted = subOrders.every((so) => so.status === 'completed');
  const allCancelled = subOrders.every((so) => so.status === 'cancelled');
  const orderCreatedAt = subOrders.reduce<string | null>(
    (min, so) => (so.created_at && (!min || so.created_at < min) ? so.created_at : min),
    null
  );
  const orderLastUpdatedAt = subOrders.reduce<string | null>(
    (max, so) => (so.updated_at && (!max || so.updated_at > max) ? so.updated_at : max),
    null
  );
  // Server Component rendering per request — see the same note in
  // orders/page.tsx for why Date.now() here isn't the purity issue this rule
  // targets on the client.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const durationSeconds = orderCreatedAt
    ? (((allCompleted || allCancelled) && orderLastUpdatedAt
        ? new Date(orderLastUpdatedAt).getTime()
        : now) -
        new Date(orderCreatedAt).getTime()) /
      1000
    : null;
  const durationIsFinal = allCompleted || allCancelled;

  return (
    <div className={`fade-in ${CONTENT_WIDTH} pb-12 pt-6`}>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/orders"
          className="flex items-center gap-1 text-xs text-muted hover:text-text-primary"
        >
          <Icon name="chevronLeft" size={13} />
          Pedidos
        </Link>
        <span className="text-line-strong" aria-hidden>
          |
        </span>
        <h1 className="font-heading text-xl font-bold tracking-[-0.04em] text-text-primary">
          #{head.order_number}
        </h1>
        <StatusBadge status={head.status ?? 'confirmed'} />
        <ChannelBadge channel={head.channel ?? 'web'} />
        <ZoneBadge
          tableId={head.table_id}
          label={head.table_label}
          tableNumber={head.table_number}
        />
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-3.5">
          {subOrders.map((subOrder) => {
            const subItems = items.filter((i) => i.sub_order_id === subOrder.sub_order_id);
            return (
              <Card key={subOrder.sub_order_id} className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <CardTitle>{subOrder.restaurant_name}</CardTitle>
                    <StatusBadge status={subOrder.status ?? 'confirmed'} />
                  </div>
                  <span className="font-heading text-sm font-bold tabular-nums text-primary">
                    {formatMoney(subOrder.total, subOrder.currency ?? undefined)}
                  </span>
                </div>

                <ul className="divide-y divide-[var(--color-border-light)]">
                  {subItems.length === 0 ? (
                    <li className="px-4 py-3 text-xs text-muted">Sin artículos visibles</li>
                  ) : (
                    subItems.map((item) => (
                      <li key={item.id} className="px-4 py-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm text-text-primary">
                            <span className="mr-1.5 font-heading font-bold tabular-nums text-muted">
                              {item.quantity}×
                            </span>
                            {displayItemName(item.item_name)}
                          </span>
                          <span className="shrink-0 font-heading text-xs font-semibold tabular-nums text-text-primary">
                            {formatMoney(item.line_total, subOrder.currency ?? undefined)}
                          </span>
                        </div>

                        {(customizationsByItem.get(item.id) ?? []).length > 0 ? (
                          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                            {(customizationsByItem.get(item.id) ?? []).map((c) => (
                              <li key={c.id} className="text-2xs text-muted">
                                {c.group_name}: {c.option_name}
                                {c.price_modifier
                                  ? ` (+${formatMoney(c.price_modifier, subOrder.currency ?? undefined)})`
                                  : ''}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))
                  )}
                </ul>

                {subOrder.notes || subOrder.cancellation_reason ? (
                  <div className="border-t border-line px-4 py-3">
                    {subOrder.notes ? (
                      <p className="text-xs text-muted">
                        <span className="font-semibold text-text-primary">Nota:</span>{' '}
                        {subOrder.notes}
                      </p>
                    ) : null}
                    {subOrder.cancellation_reason ? (
                      <p className="mt-1 text-xs text-secondary">
                        <span className="font-semibold">Cancelado:</span>{' '}
                        {subOrder.cancellation_reason}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {writable || administers ? (
                  <OrderActions
                    subOrderId={subOrder.sub_order_id}
                    orderId={orderId}
                    status={subOrder.status ?? 'confirmed'}
                    paymentStatus={subOrder.payment_status ?? 'pending'}
                    customerName={subOrder.customer_name}
                    customerPhone={subOrder.customer_phone}
                    tableNumber={subOrder.table_number}
                    notes={subOrder.notes}
                    writable={writable}
                    administers={administers}
                    fiscallyLocked={Boolean(fiscalInvoiceBySubOrder.get(subOrder.sub_order_id))}
                  />
                ) : null}
              </Card>
            );
          })}
        </div>

        <div className="flex flex-col gap-3.5">
          <Card className="p-4">
            <CardLabel className="mb-3">Detalles</CardLabel>
            <Detail label="Creado" value={formatDateTime(head.created_at!, head.timezone ?? undefined)} />
            {durationSeconds !== null ? (
              <Detail
                label={durationIsFinal ? 'Duración' : 'En curso desde hace'}
                value={formatDuration(durationSeconds)}
              />
            ) : null}
            <Detail label="Origen" value={head.channel === 'kiosk' ? 'Kiosko' : 'Web'} />
            <Detail
              label="Tipo"
              value={ORDER_TYPE_LABEL[head.order_type ?? ''] ?? head.order_type ?? '—'}
            />
            <Detail label="Zona" value={head.table_id ? (head.table_label ?? '—') : 'Sin zona'} />
            {head.table_number ? <Detail label="Mesa indicada" value={head.table_number} /> : null}
            <Detail label="Cliente" value={head.customer_name ?? '—'} />
            <Detail label="Teléfono" value={head.customer_phone ?? '—'} />
            <Detail
              label="Pago"
              value={`${PAYMENT_METHOD_LABEL[head.payment_method ?? ''] ?? '—'} · ${
                head.payment_status === 'paid' ? 'Pagado' : head.payment_status === 'failed' ? 'Fallido' : 'Pendiente'
              }`}
            />
          </Card>

          {/* Only renders once real transitions exist for this order — see the
              comment above the query. An order that finished before 042
              existed has a duration (above) but no step-by-step timeline;
              nothing to show honestly beyond "it happened, we don't know when
              each step did". */}
          {events.length > 0 ? (
            <Card className="p-4">
              <CardLabel className="mb-3">Cronología</CardLabel>
              <ol className="flex flex-col gap-3">
                {events.map((event, index) => {
                  const previousAt = index === 0 ? orderCreatedAt : events[index - 1].changed_at;
                  const stepSeconds = previousAt
                    ? (new Date(event.changed_at).getTime() - new Date(previousAt).getTime()) / 1000
                    : null;
                  const restaurantName = restaurantBySubOrder.get(event.sub_order_id);

                  return (
                    <li key={event.id} className="flex items-start gap-2.5">
                      <span
                        aria-hidden
                        className="mt-1 size-1.5 shrink-0 rounded-full bg-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                          <span className="text-xs text-text-primary">
                            <span className="text-muted">{statusLabel(event.from_status)} → </span>
                            <span className="font-semibold">{statusLabel(event.to_status)}</span>
                          </span>
                          <span className="text-2xs tabular-nums text-muted">
                            {formatTime(event.changed_at, head.timezone ?? undefined)}
                          </span>
                        </div>
                        <div className="mt-0.5 text-2xs text-muted">
                          {subOrders.length > 1 && restaurantName ? `${restaurantName} · ` : ''}
                          {stepSeconds !== null ? `${formatDuration(stepSeconds)} en la etapa anterior` : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>
          ) : null}

          <Card className="p-4">
            <CardLabel className="mb-3">Totales</CardLabel>
            <Detail
              label="Subtotal"
              value={formatMoney(
                subOrders.reduce((s, so) => s + (so.subtotal ?? 0), 0),
                head.currency ?? undefined
              )}
            />
            <Detail
              label="Impuestos"
              value={formatMoney(
                subOrders.reduce((s, so) => s + (so.tax ?? 0), 0),
                head.currency ?? undefined
              )}
            />
            <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
              <span className="text-xs font-semibold text-text-primary">Total</span>
              <span className="font-heading text-base font-bold tabular-nums text-primary">
                {formatMoney(visibleTotal, head.currency ?? undefined)}
              </span>
            </div>
            {subOrders.length > 1 ? (
              <p className="mt-2 text-2xs text-muted">
                Suma de {subOrders.length} locales de este pedido.
              </p>
            ) : null}
          </Card>

          {/* Platform operator only, and last on the page on purpose — it is
              irreversible and shouldn't sit next to routine controls. */}
          {viewer.is_platform_admin && parentOrder ? (
            <Card className="border-secondary/20 p-4">
              <CardLabel className="mb-3">Zona de peligro</CardLabel>
              <DeleteOrder
                orderId={orderId}
                orderNumber={parentOrder.order_number}
                blockedReason={deleteBlockedReason}
              />
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-b-0">
      <span className="shrink-0 text-xs text-muted">{label}</span>
      <span className="truncate text-right text-xs font-semibold text-text-primary">{value}</span>
    </div>
  );
}
