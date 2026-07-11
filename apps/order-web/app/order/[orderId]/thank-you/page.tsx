'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCartStore } from '@/store/useCartStore';
import { useLastOrderStore } from '@/store/useLastOrderStore';

// Bridge screen between checkout and the tracker — shows the checkmark
// animation + order number for a beat, then auto-advances. Only ever meant
// to be seen right after checkout: a cold visit (refresh, shared link,
// someone else opening it) has no matching lastOrder snapshot, so it skips
// straight to the tracker with no animation, no flash.
export default function ThankYouPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const clearCart = useCartStore((s) => s.clearCart);
  const lastOrder = useLastOrderStore();
  const isFreshOrder = lastOrder.orderId === orderId;

  useEffect(() => {
    if (!isFreshOrder) {
      router.replace(`/order/${orderId}`);
      return;
    }
    clearCart();
    const timer = setTimeout(() => router.replace(`/order/${orderId}`), 4000);
    return () => clearTimeout(timer);
  }, [isFreshOrder, orderId, router, clearCart]);

  if (!isFreshOrder) return null;

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center gap-8 overflow-hidden bg-[#060e1d] px-6 text-center">
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
            {lastOrder.customerName ? `¡Gracias, ${lastOrder.customerName}!` : '¡Pedido confirmado!'}
          </p>
          <p className="font-body text-sm text-white/60">Ya recibimos tu pedido.</p>
        </div>
      </div>

      <div className="fade-up-item flex flex-col items-center gap-1" style={{ animationDelay: '220ms' }}>
        <p className="font-body text-xs uppercase tracking-[0.25em] text-white/50">Orden</p>
        <p className="font-heading text-6xl font-black tracking-tight text-primary">#{lastOrder.orderNumber}</p>
      </div>
    </div>
  );
}
