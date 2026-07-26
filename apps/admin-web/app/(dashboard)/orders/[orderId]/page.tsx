import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardLabel, CardTitle } from '@/components/ui/Card';
import { ChannelBadge, StatusBadge, ZoneBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { requireViewer } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { formatDateTime, formatMoney } from '@/lib/format';
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
  await requireViewer();
  const { orderId } = await params;

  const supabase = await createClient();

  const { data: facts } = await supabase
    .from('dashboard_order_facts')
    .select('*')
    .eq('order_id', orderId)
    .order('restaurant_name');

  const subOrders = facts ?? [];
  if (subOrders.length === 0) notFound();

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

  return (
    <div className="fade-in px-7 pb-12 pt-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/orders"
          className="flex items-center gap-1 text-[12px] text-muted hover:text-text-primary"
        >
          <Icon name="chevronLeft" size={13} />
          Pedidos
        </Link>
        <span className="text-line-strong" aria-hidden>
          |
        </span>
        <h1 className="font-heading text-[20px] font-bold tracking-[-0.04em] text-text-primary">
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
                  <span className="font-heading text-[13px] font-bold tabular-nums text-primary">
                    {formatMoney(subOrder.total, subOrder.currency ?? undefined)}
                  </span>
                </div>

                <ul className="divide-y divide-[var(--color-border-light)]">
                  {subItems.length === 0 ? (
                    <li className="px-4 py-3 text-[12px] text-muted">Sin artículos visibles</li>
                  ) : (
                    subItems.map((item) => (
                      <li key={item.id} className="px-4 py-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-[13px] text-text-primary">
                            <span className="mr-1.5 font-heading font-bold tabular-nums text-muted">
                              {item.quantity}×
                            </span>
                            {displayItemName(item.item_name)}
                          </span>
                          <span className="shrink-0 font-heading text-[12px] font-semibold tabular-nums text-text-primary">
                            {formatMoney(item.line_total, subOrder.currency ?? undefined)}
                          </span>
                        </div>

                        {(customizationsByItem.get(item.id) ?? []).length > 0 ? (
                          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                            {(customizationsByItem.get(item.id) ?? []).map((c) => (
                              <li key={c.id} className="text-[11px] text-muted">
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
                      <p className="text-[12px] text-muted">
                        <span className="font-semibold text-text-primary">Nota:</span>{' '}
                        {subOrder.notes}
                      </p>
                    ) : null}
                    {subOrder.cancellation_reason ? (
                      <p className="mt-1 text-[12px] text-secondary">
                        <span className="font-semibold">Cancelado:</span>{' '}
                        {subOrder.cancellation_reason}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>

        <div className="flex flex-col gap-3.5">
          <Card className="p-4">
            <CardLabel className="mb-3">Detalles</CardLabel>
            <Detail label="Creado" value={formatDateTime(head.created_at!, head.timezone ?? undefined)} />
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
              <span className="text-[12px] font-semibold text-text-primary">Total</span>
              <span className="font-heading text-[16px] font-bold tabular-nums text-primary">
                {formatMoney(visibleTotal, head.currency ?? undefined)}
              </span>
            </div>
            {subOrders.length > 1 ? (
              <p className="mt-2 text-[10px] text-muted">
                Suma de {subOrders.length} locales de este pedido.
              </p>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-b-0">
      <span className="shrink-0 text-[12px] text-muted">{label}</span>
      <span className="truncate text-right text-[12px] font-semibold text-text-primary">{value}</span>
    </div>
  );
}
