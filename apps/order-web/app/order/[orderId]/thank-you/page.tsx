'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCartStore } from '@/store/useCartStore';
import { useLastOrderStore } from '@/store/useLastOrderStore';
import { getOrderStatus } from '@/lib/api';
import { formatCurrency } from '@/lib/currency';
import type { OrderStatusResult } from '@/lib/types';

const ORDER_TYPE_LABEL: Record<string, string> = {
  'dine-in': 'Comer aquí',
  takeaway: 'Para llevar',
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  yappy: 'Yappy (en entrega)',
  card_on_delivery: 'Tarjeta (en entrega)',
  cash_on_delivery: 'Efectivo (en entrega)',
};

export default function ThankYouPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const clearCart = useCartStore((s) => s.clearCart);
  const lastOrder = useLastOrderStore();
  const hasFullSnapshot = lastOrder.orderId === orderId;

  const [orderNumber, setOrderNumber] = useState<number | null>(hasFullSnapshot ? lastOrder.orderNumber : null);
  const [fallback, setFallback] = useState<OrderStatusResult | null>(null);
  const customerName = hasFullSnapshot ? lastOrder.customerName : null;

  useEffect(() => {
    // Safe to clear unconditionally: we only ever land here right after a
    // successful createWebOrder, or on a stale refresh where the cart is
    // irrelevant to this order anyway.
    clearCart();
  }, [clearCart]);

  useEffect(() => {
    if (hasFullSnapshot) return;
    // Cold visit (refresh, or the link was opened fresh) — no in-memory
    // order data, so fetch the summary (including prices) from the RPC instead.
    getOrderStatus(orderId).then((result) => {
      if (result) {
        setOrderNumber(result.order_number);
        setFallback(result);
      }
    });
  }, [orderId, hasFullSnapshot]);

  const orderTypeLabel = hasFullSnapshot
    ? ORDER_TYPE_LABEL[lastOrder.orderType ?? ''] ?? lastOrder.orderType
    : fallback && (ORDER_TYPE_LABEL[fallback.order_type] ?? fallback.order_type);
  const tableLabel = hasFullSnapshot ? lastOrder.tableLabel : fallback?.table_label;
  const paymentLabel = hasFullSnapshot
    ? PAYMENT_METHOD_LABEL[lastOrder.paymentMethod ?? ''] ?? lastOrder.paymentMethod
    : fallback?.payment_method && (PAYMENT_METHOD_LABEL[fallback.payment_method] ?? fallback.payment_method);

  return (
    <div className="relative flex min-h-dvh flex-col items-center gap-8 overflow-hidden bg-[#060e1d] px-6 py-10 text-center">
      <div className="absolute inset-x-0 top-0 h-1 bg-primary" />

      <div className="fade-up-item flex flex-col items-center gap-6" style={{ animationDelay: '80ms' }}>
        <svg width="80" height="80" viewBox="0 0 88 88" fill="none" className="check-circle">
          <circle cx="44" cy="44" r="42" fill="#ccff00" fillOpacity="0.12" stroke="#ccff00" strokeWidth="2" />
          <path
            d="M28 45L39 56L60 33"
            stroke="#ccff00"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="check-path"
          />
        </svg>

        <div className="flex flex-col items-center gap-1">
          <p className="font-heading text-lg font-bold text-white">
            {customerName ? `¡Gracias, ${customerName}!` : '¡Pedido confirmado!'}
          </p>
          <p className="font-body text-sm text-white/60">Ya recibimos tu pedido.</p>
        </div>
      </div>

      <div className="fade-up-item flex flex-col items-center gap-1" style={{ animationDelay: '180ms' }}>
        <p className="font-body text-xs uppercase tracking-[0.25em] text-white/50">Número de orden</p>
        <p className="font-heading text-6xl font-black tracking-tight text-primary">
          {orderNumber !== null ? `#${orderNumber}` : '···'}
        </p>
      </div>

      {(orderTypeLabel || (hasFullSnapshot ? lastOrder.groups.length > 0 : !!fallback)) && (
        <div
          className="fade-up-item w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] text-left"
          style={{ animationDelay: '260ms' }}
        >
          {(orderTypeLabel || paymentLabel) && (
            <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3">
              {orderTypeLabel && (
                <span className="rounded-full border border-white/15 px-3 py-1 font-body text-xs font-semibold text-white/70">
                  {orderTypeLabel}
                  {tableLabel ? ` — ${tableLabel}` : ''}
                </span>
              )}
              {paymentLabel && (
                <span className="rounded-full border border-white/15 px-3 py-1 font-body text-xs font-semibold text-white/70">
                  {paymentLabel}
                </span>
              )}
            </div>
          )}

          {hasFullSnapshot ? (
            <div className="flex flex-col gap-3 px-4 py-3">
              {lastOrder.groups.map((group, i) => (
                <div key={i} className="flex flex-col gap-2">
                  {lastOrder.groups.length > 1 && (
                    <p className="font-heading text-xs font-bold uppercase tracking-wide text-primary">{group.restaurantName}</p>
                  )}
                  {group.items.map((item, j) => (
                    <div key={j} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-body text-sm text-white">
                          <span className="text-white/50">{item.quantity}×</span> {item.name}
                        </p>
                        {item.customizationSummary && (
                          <p className="truncate font-body text-xs text-white/40">{item.customizationSummary}</p>
                        )}
                      </div>
                      <p className="shrink-0 font-body text-sm text-white/70">{formatCurrency(item.lineTotal)}</p>
                    </div>
                  ))}
                </div>
              ))}

              <div className="mt-1 flex flex-col gap-1 border-t border-white/10 pt-3">
                <div className="flex items-center justify-between font-body text-xs text-white/50">
                  <span>Subtotal</span>
                  <span>{formatCurrency(lastOrder.subtotal ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between font-body text-xs text-white/50">
                  <span>Impuesto</span>
                  <span>{formatCurrency(lastOrder.tax ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between font-heading text-base font-bold text-white">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(lastOrder.total ?? 0)}</span>
                </div>
              </div>
            </div>
          ) : (
            fallback && (
              <div className="flex flex-col gap-3 px-4 py-3">
                {fallback.sub_orders.map((sub, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    {fallback.sub_orders.length > 1 && (
                      <p className="font-heading text-xs font-bold uppercase tracking-wide text-primary">{sub.restaurant_name}</p>
                    )}
                    {sub.items.map((item, j) => (
                      <div key={j} className="flex items-start justify-between gap-3">
                        <p className="font-body text-sm text-white">
                          <span className="text-white/50">{item.quantity}×</span> {item.name}
                        </p>
                        <p className="shrink-0 font-body text-sm text-white/70">{formatCurrency(item.line_total)}</p>
                      </div>
                    ))}
                  </div>
                ))}

                <div className="mt-1 flex flex-col gap-1 border-t border-white/10 pt-3">
                  <div className="flex items-center justify-between font-body text-xs text-white/50">
                    <span>Subtotal</span>
                    <span>{formatCurrency(fallback.subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between font-body text-xs text-white/50">
                    <span>Impuesto</span>
                    <span>{formatCurrency(fallback.tax)}</span>
                  </div>
                  <div className="flex items-center justify-between font-heading text-base font-bold text-white">
                    <span>Total</span>
                    <span className="text-primary">{formatCurrency(fallback.total)}</span>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}

      <div className="fade-up-item flex w-full max-w-xs flex-col items-center gap-3 pt-2" style={{ animationDelay: '380ms' }}>
        <button
          onClick={() => router.push(`/order/${orderId}`)}
          className="cta-pulse group relative flex h-16 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-primary font-heading text-base font-bold text-on-primary transition active:scale-[0.98]"
        >
          <span className="cta-sheen absolute inset-0" />
          <span className="relative">Ver seguimiento de mi pedido</span>
          <span className="arrow-nudge relative">→</span>
        </button>
        <p className="font-body text-xs text-white/50">Te avisaremos cuando esté listo.</p>
      </div>
    </div>
  );
}
