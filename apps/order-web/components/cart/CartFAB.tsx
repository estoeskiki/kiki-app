'use client';

import Link from 'next/link';
import { useCartStore } from '@/store/useCartStore';
import { formatCurrency } from '@/lib/currency';

export function CartFAB() {
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.getSubtotal());
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  if (count === 0) return null;

  return (
    <Link
      href="/checkout"
      className="fixed bottom-4 left-1/2 z-20 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center justify-between rounded-xl bg-primary px-5 py-4 text-on-primary shadow-[0_8px_30px_-6px_rgba(204,255,0,0.6)] transition active:scale-[0.98]"
    >
      <span className="font-heading text-sm font-bold">
        {count} artículo{count > 1 ? 's' : ''} · Ver carrito
      </span>
      <span className="font-heading text-base font-bold">{formatCurrency(subtotal)}</span>
    </Link>
  );
}
