'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { getOrderStatus } from '@/lib/api';
import { formatCurrency } from '@/lib/currency';
import { useSessionStore } from '@/store/useSessionStore';
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

function stepIndex(status: string) {
  const i = STEPS.indexOf(status as (typeof STEPS)[number]);
  return i === -1 ? 0 : i;
}

// Whether the order overall is cancelled/done — computed from the
// sub_orders themselves, not the parent orders.status column. A DB trigger
// (sync_parent_order_status()) only ever advances that to
// 'preparing'/'ready' and never to 'completed', so relying on it would poll
// forever and never show the order as done. An order counts as cancelled
// only when every restaurant is; otherwise cancelled sub_orders are ignored
// when checking whether the rest have all completed.
function computeProgress(order: OrderStatusResult) {
  const activeSubOrders = order.sub_orders.filter((s) => s.status !== 'cancelled');
  const isCancelled = activeSubOrders.length === 0;
  const isTerminal = isCancelled || (activeSubOrders.length > 0 && activeSubOrders.every((s) => s.status === 'completed'));
  return { isCancelled, isTerminal };
}

export default function OrderTrackingPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderStatusResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // "Nueva orden" reopens the same storefront in a fresh tab — a new tab has
  // its own sessionStorage, so OrderingGate always starts at Welcome there
  // regardless of this tab's ordering state. Prefer /t/<token> (self-contained,
  // re-resolves the zone from scratch) since bare /mall or /r now requires a
  // token in production — a fresh tab never has one from sessionStorage alone.
  // Falls back to "/" (scan-the-QR copy) if no session data is available at
  // all, e.g. someone else opened this tracking link cold, on a different device.
  const mode = useSessionStore((s) => s.mode);
  const slug = useSessionStore((s) => s.slug);
  const tableToken = useSessionStore((s) => s.tableToken);
  const newOrderHref = tableToken
    ? `/t/${tableToken}`
    : slug
      ? (mode === 'food_court' ? `/mall/${slug}` : `/r/${slug}`)
      : '/';

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const result = await getOrderStatus(orderId);
        if (cancelled) return;
        if (!result) {
          setNotFound(true);
          return;
        }
        // A good result clears the not-found screen instead of leaving it
        // latched — otherwise one bad poll would strand the page until refresh.
        setNotFound(false);
        setOrder(result);
        if (computeProgress(result).isTerminal) {
          if (timer.current) clearInterval(timer.current);
        }
      } catch {
        // Transient network/transport failure — common when the tab resumes
        // after the phone wakes from lock and fires a queued poll before the
        // radio is back. Keep the last good state and let the interval retry.
      }
    }

    poll();
    timer.current = setInterval(poll, 5000);

    // Re-poll the instant the page becomes visible again so a returning user
    // sees fresh status right away rather than waiting up to 5s for the tick.
    const onVisible = () => {
      if (document.visibilityState === 'visible') poll();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
      document.removeEventListener('visibilitychange', onVisible);
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

  const { isCancelled, isTerminal } = computeProgress(order);

  const handleShare = async () => {
    const url = window.location.href;
    const shareData = { title: `Pedido #${order.order_number}`, text: 'Sigue mi pedido en kiki', url };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User closed the native share sheet without picking anything — not an error.
      }
      return;
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#060e1d]">
      <div className="absolute inset-x-0 top-0 h-1 bg-primary" />

      <div className="relative mx-auto flex max-w-lg flex-col gap-8 px-4 py-10">
        <div className="fade-up-item flex flex-col items-center gap-3 text-center" style={{ animationDelay: '20ms' }}>
          <div className="flex items-center gap-2">
            {!isTerminal && <span className="live-dot h-1.5 w-1.5 rounded-full bg-primary" />}
            <p className="font-body text-xs font-bold uppercase tracking-[0.2em] text-white/50">
              {isTerminal ? 'Pedido' : 'Live tracker'}
            </p>
          </div>
          <p className="font-body text-xs uppercase tracking-[0.2em] text-white/40">Orden</p>
          <p className="font-heading text-5xl font-black tracking-tight text-primary">#{order.order_number}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full border border-white/15 px-3 py-1 font-body text-xs font-semibold text-white/70">
              {ORDER_TYPE_LABELS[order.order_type] ?? order.order_type}
            </span>
            {order.table_label && (
              <span className="rounded-full border border-white/15 px-3 py-1 font-body text-xs font-semibold text-white/70">
                {order.table_label}
                {order.table_number ? ` · Mesa ${order.table_number}` : ''}
              </span>
            )}
          </div>
        </div>

        {isCancelled && (
          <div className="fade-up-item rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-center font-body text-sm font-semibold text-error" style={{ animationDelay: '160ms' }}>
            Este pedido fue cancelado.
          </div>
        )}

        <div className="fade-up-item flex flex-col gap-3" style={{ animationDelay: '260ms' }}>
          {order.sub_orders.map((sub, i) => {
            const subCancelled = sub.status === 'cancelled';
            const subTerminal = sub.status === 'completed' || subCancelled;
            const subCurrent = stepIndex(sub.status);
            const subProgressPct = (subCurrent / (STEPS.length - 1)) * 100;
            return (
              <div key={i} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
                <div className="flex flex-col gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center gap-2">
                    {!subTerminal && <span className="live-dot h-1.5 w-1.5 rounded-full bg-primary" />}
                    <p className="font-heading text-sm font-bold text-white">{sub.restaurant_name}</p>
                  </div>

                  {subCancelled ? (
                    <div className="flex flex-col items-start gap-1.5">
                      <span className="w-fit rounded-full bg-error/20 px-3 py-1 font-body text-xs font-bold text-error">Cancelado</span>
                      {sub.cancellation_reason && (
                        <p className="font-body text-xs text-white/50">{sub.cancellation_reason}</p>
                      )}
                    </div>
                  ) : (
                    <div className="relative pt-1">
                      <div className="absolute left-[10%] right-[10%] top-[15px] h-0.5 bg-white/10" />
                      <div
                        className="absolute left-[10%] top-[15px] h-0.5 bg-primary transition-all duration-700 ease-out"
                        style={{ width: `${subProgressPct * 0.8}%` }}
                      />
                      <div className="relative flex items-start justify-between">
                        {STEPS.map((step, j) => (
                          <div key={step} className="flex flex-1 flex-col items-center gap-1.5">
                            <div
                              className={`flex h-7 w-7 items-center justify-center rounded-full font-heading text-xs font-bold transition-colors duration-500 ${j < subCurrent
                                  ? 'bg-primary text-on-primary'
                                  : j === subCurrent
                                    ? 'step-active bg-primary text-on-primary'
                                    : 'bg-white/10 text-white/40'
                                }`}
                            >
                              {j + 1}
                            </div>
                            <span
                              className={`text-center font-body text-[10px] ${j <= subCurrent ? 'font-semibold text-white' : 'text-white/40'}`}
                            >
                              {STEP_LABELS[step]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <ul className="flex flex-col divide-y divide-white/10">
                  {sub.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-3 px-4 py-2.5 font-body text-sm text-white/70">
                      <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white/10 px-1.5 font-heading text-xs font-bold text-white">
                        {item.quantity}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p>{item.name}</p>
                        {item.customizations && item.customizations.length > 0 && (
                          <p className="mt-0.5 font-body text-xs text-white/40">{item.customizations.join(', ')}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-white/50">{formatCurrency(item.line_total)}</span>
                    </li>
                  ))}
                </ul>
                {order.sub_orders.length > 1 && (
                  <div className="flex items-center justify-between border-t border-white/10 bg-white/[0.03] px-4 py-2.5 font-body text-sm">
                    <span className="font-semibold text-white/70">Subtotal {sub.restaurant_name}</span>
                    <span className="font-bold text-primary">{formatCurrency(sub.total)}</span>
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex flex-col gap-2 rounded-xl bg-white/[0.04] px-4 py-3">
            <div className="flex items-center justify-between font-body text-sm">
              <span className="font-semibold text-white/70">Subtotal</span>
              <span className="font-bold text-primary">{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between font-body text-sm">
              <span className="font-semibold text-white/70">Impuesto</span>
              <span className="font-bold text-white">{formatCurrency(order.tax)}</span>
            </div>
            <div className="my-0.5 h-px bg-white/10" />
            <div className="flex items-center justify-between font-heading text-lg font-bold text-white">
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

        {isTerminal && !isCancelled && (
          <div className="fade-up-item rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-center font-body text-sm font-semibold text-success" style={{ animationDelay: '340ms' }}>
            ¡Disfruta tu pedido!
          </div>
        )}

        <div className="fade-up-item flex gap-2" style={{ animationDelay: '420ms' }}>
          <button
            onClick={handleShare}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 font-body text-sm font-semibold text-white/80 transition active:scale-[0.98]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="2" />
              <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
              <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="2" />
              <line x1="8.59" y1="10.51" x2="15.42" y2="6.51" stroke="currentColor" strokeWidth="2" />
              <line x1="8.59" y1="13.49" x2="15.42" y2="17.49" stroke="currentColor" strokeWidth="2" />
            </svg>
            {copied ? '¡Enlace copiado!' : 'Compartir'}
          </button>
          <a
            href={newOrderHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-body text-sm font-bold text-on-primary shadow-[0_4px_20px_-6px_rgba(204,255,0,0.5)] transition active:scale-[0.98]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Nueva orden
          </a>
        </div>

        <p className="fade-up-item text-center font-body font-bold text-xs tracking-[-0.02em] text-white/50" style={{ animationDelay: '480ms' }}>
          powered by <span className="font-heading font-bold tracking-[-0.036em] text-primary">kiki</span>
        </p>
      </div>
    </div>
  );
}
