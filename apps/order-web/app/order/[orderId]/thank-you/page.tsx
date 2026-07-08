'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCartStore } from '@/store/useCartStore';
import { useLastOrderStore } from '@/store/useLastOrderStore';
import { getOrderStatus } from '@/lib/api';

export default function ThankYouPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const clearCart = useCartStore((s) => s.clearCart);
  const lastOrder = useLastOrderStore();

  const [orderNumber, setOrderNumber] = useState<number | null>(
    lastOrder.orderId === orderId ? lastOrder.orderNumber : null,
  );
  const customerName = lastOrder.orderId === orderId ? lastOrder.customerName : null;

  useEffect(() => {
    // Safe to clear unconditionally: we only ever land here right after a
    // successful createWebOrder, or on a stale refresh where the cart is
    // irrelevant to this order anyway.
    clearCart();
  }, [clearCart]);

  useEffect(() => {
    if (orderNumber !== null) return;
    // Cold visit (refresh, or the link was opened fresh) — no in-memory
    // order data, so fetch just enough to show the number.
    getOrderStatus(orderId).then((result) => {
      if (result) setOrderNumber(result.order_number);
    });
  }, [orderId, orderNumber]);

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center gap-10 overflow-hidden bg-[#060e1d] px-8 text-center">
      <div className="absolute inset-x-0 top-0 h-1 bg-primary" />

      <div className="fade-up-item flex flex-col items-center gap-6" style={{ animationDelay: '80ms' }}>
        <svg width="88" height="88" viewBox="0 0 88 88" fill="none" className="check-circle">
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

      <div
        className="fade-up-item flex flex-col items-center gap-1"
        style={{ animationDelay: '220ms' }}
      >
        <p className="font-body text-xs uppercase tracking-[0.25em] text-white/50">Número de orden</p>
        <p className="font-heading text-6xl font-black tracking-tight text-primary">
          {orderNumber !== null ? `#${orderNumber}` : '···'}
        </p>
      </div>

      <div className="fade-up-item flex w-full max-w-xs flex-col items-center gap-3" style={{ animationDelay: '360ms' }}>
        <button
          onClick={() => router.push(`/order/${orderId}`)}
          className="h-16 w-full rounded-xl bg-primary font-heading text-base font-bold text-on-primary shadow-[0_8px_30px_-6px_rgba(204,255,0,0.6)] transition active:scale-[0.98]"
        >
          Ver seguimiento de mi pedido
        </button>
        <p className="font-body text-xs text-white/50">Te avisaremos cuando esté listo.</p>
      </div>
    </div>
  );
}
