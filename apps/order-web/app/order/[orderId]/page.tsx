'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { getOrderStatus } from '@/lib/api';
import { formatCurrency } from '@/lib/currency';
import type { OrderStatusResult } from '@/lib/types';

const STEPS = ['confirmed', 'preparing', 'ready', 'completed'] as const;
const STEP_LABELS: Record<(typeof STEPS)[number], string> = {
  confirmed: 'Recibido',
  preparing: 'Preparando',
  ready: 'Listo',
  completed: 'Entregado',
};
const ORDER_TYPE_LABELS: Record<string, string> = {
  'dine-in': 'Comer aquí',
  takeaway: 'Para llevar',
};

const STATUS_CHIP: Record<string, string> = {
  confirmed: 'bg-white/10 text-white/70',
  preparing: 'bg-warning/20 text-warning',
  ready: 'bg-primary text-on-primary',
  completed: 'bg-success/20 text-success',
  cancelled: 'bg-error/20 text-error',
};

function stepIndex(status: string) {
  const i = STEPS.indexOf(status as (typeof STEPS)[number]);
  return i === -1 ? 0 : i;
}

export default function OrderTrackingPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderStatusResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const result = await getOrderStatus(orderId);
      if (cancelled) return;
      if (!result) {
        setNotFound(true);
        return;
      }
      setOrder(result);
      if (result.status === 'completed' || result.status === 'cancelled') {
        if (timer.current) clearInterval(timer.current);
      }
    }

    poll();
    timer.current = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
    };
  }, [orderId]);

  if (notFound) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#060e1d] p-10">
        <p className="text-center font-body text-white/60">No pudimos encontrar ese pedido.</p>
      </div>
    );
  }
  if (!order) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#060e1d] p-10">
        <p className="text-center font-body text-white/60">Cargando tu pedido…</p>
      </div>
    );
  }

  const current = stepIndex(order.status);
  const isCancelled = order.status === 'cancelled';
  const isTerminal = order.status === 'completed' || isCancelled;
  const progressPct = (current / (STEPS.length - 1)) * 100;

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#060e1d]">
      <div className="absolute inset-x-0 top-0 h-1 bg-primary" />

      <div className="relative mx-auto flex max-w-lg flex-col gap-8 px-4 py-10">
        <div className="fade-up-item flex flex-col items-center gap-3 text-center" style={{ animationDelay: '60ms' }}>
          <div className="flex items-center gap-2">
            {!isTerminal && <span className="live-dot h-1.5 w-1.5 rounded-full bg-primary" />}
            <p className="font-body text-xs font-bold uppercase tracking-[0.2em] text-white/50">
              {isTerminal ? 'Pedido' : 'Seguimiento en vivo'}
            </p>
          </div>
          <p className="font-heading text-5xl font-black tracking-tight text-primary">#{order.order_number}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full border border-white/15 px-3 py-1 font-body text-xs font-semibold text-white/70">
              {ORDER_TYPE_LABELS[order.order_type] ?? order.order_type}
            </span>
            {order.table_label && (
              <span className="rounded-full border border-white/15 px-3 py-1 font-body text-xs font-semibold text-white/70">
                {order.table_label}
              </span>
            )}
          </div>
        </div>

        {isCancelled ? (
          <div className="fade-up-item rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-center font-body text-sm font-semibold text-error" style={{ animationDelay: '160ms' }}>
            Este pedido fue cancelado.
          </div>
        ) : (
          <div className="fade-up-item flex flex-col gap-4" style={{ animationDelay: '160ms' }}>
            <div className="relative pt-1">
              <div className="absolute left-[10%] right-[10%] top-[19px] h-0.5 bg-white/10" />
              <div
                className="absolute left-[10%] top-[19px] h-0.5 bg-primary transition-all duration-700 ease-out"
                style={{ width: `${progressPct * 0.8}%` }}
              />
              <div className="relative flex items-start justify-between">
                {STEPS.map((step, i) => (
                  <div key={step} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full font-heading text-sm font-bold transition-colors duration-500 ${
                        i < current
                          ? 'bg-primary text-on-primary'
                          : i === current
                            ? 'step-active bg-primary text-on-primary'
                            : 'bg-white/10 text-white/40'
                      }`}
                    >
                      {i + 1}
                    </div>
                    <span
                      className={`text-center font-body text-xs ${i <= current ? 'font-semibold text-white' : 'text-white/40'}`}
                    >
                      {STEP_LABELS[step]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {!isTerminal && <p className="text-center font-body text-xs text-white/50">Tiempo estimado: 15–25 minutos</p>}
          </div>
        )}

        <div className="fade-up-item flex flex-col gap-3" style={{ animationDelay: '260ms' }}>
          {order.sub_orders.map((sub, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
              <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="font-heading text-sm font-bold text-white">{sub.restaurant_name}</p>
                <span className={`rounded-full px-3 py-1 font-body text-xs font-bold ${STATUS_CHIP[sub.status] ?? STATUS_CHIP.confirmed}`}>
                  {STEP_LABELS[sub.status as keyof typeof STEP_LABELS] ?? sub.status}
                </span>
              </div>
              <ul className="flex flex-col divide-y divide-white/10">
                {sub.items.map((item, j) => (
                  <li key={j} className="flex items-center gap-3 px-4 py-2.5 font-body text-sm text-white/70">
                    <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white/10 px-1.5 font-heading text-xs font-bold text-white">
                      {item.quantity}
                    </span>
                    <span className="flex-1">{item.name}</span>
                    <span className="text-white/50">{formatCurrency(item.line_total)}</span>
                  </li>
                ))}
              </ul>
              {order.sub_orders.length > 1 && (
                <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 font-body text-xs text-white/50">
                  <span>Subtotal {sub.restaurant_name}</span>
                  <span>{formatCurrency(sub.total)}</span>
                </div>
              )}
            </div>
          ))}

          <div className="flex flex-col gap-1 rounded-xl bg-white/[0.04] px-4 py-3">
            <div className="flex items-center justify-between font-body text-xs text-white/50">
              <span>Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between font-body text-xs text-white/50">
              <span>Impuesto</span>
              <span>{formatCurrency(order.tax)}</span>
            </div>
            <div className="flex items-center justify-between font-heading text-base font-bold text-white">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(order.total)}</span>
            </div>
          </div>
        </div>

        {!isTerminal && (order.payment_method === 'yappy' || order.payment_method === 'card_on_delivery') && (
          <div className="fade-up-item rounded-xl bg-white/[0.04] px-4 py-3 text-center font-body text-xs text-white/60" style={{ animationDelay: '340ms' }}>
            {order.payment_method === 'yappy' ? 'Ten tu Yappy listo para cuando recojas tu pedido.' : 'Ten tu tarjeta lista para cuando recojas tu pedido.'}
          </div>
        )}

        {order.status === 'completed' && (
          <div className="fade-up-item rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-center font-body text-sm font-semibold text-success" style={{ animationDelay: '340ms' }}>
            ¡Disfruta tu pedido!
          </div>
        )}
      </div>
    </div>
  );
}
