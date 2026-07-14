'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/useCartStore';

interface HeaderProps {
  title: string;
  /** Navigate to a fixed path. Omit + set showBack to go back in history instead. */
  backHref?: string;
  showBack?: boolean;
  showCart?: boolean;
}

export function Header({ title, backHref, showBack, showCart = true }: HeaderProps) {
  const router = useRouter();
  const itemCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border-light bg-background/90 px-4 py-3 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        {(backHref || showBack) && (
          <button
            onClick={() => (backHref ? router.push(backHref) : router.back())}
            aria-label="Atrás"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-text-primary"
          >
            ←
          </button>
        )}
        <h1 className="truncate font-heading text-lg font-bold tracking-tight text-text-primary">{title}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {showCart && (
          <Link
            href="/checkout"
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-text-primary"
            aria-label="Carrito"
          >
            🛒
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-on-primary">
                {itemCount}
              </span>
            )}
          </Link>
        )}
      </div>
    </header>
  );
}
