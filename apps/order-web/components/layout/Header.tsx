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
      <div className="flex min-w-0 items-center gap-2">
        {(backHref || showBack) && (
          <button
            onClick={() => (backHref ? router.push(backHref) : router.back())}
            aria-label="Atrás"
            className="-ml-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-primary transition-colors hover:bg-surface-container active:scale-95"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h1 className="truncate font-heading text-lg font-bold tracking-tight text-text-primary">{title}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {showCart && (
          <Link
            href="/checkout"
            className="relative -mr-1.5 flex h-9 w-9 items-center justify-center rounded-full text-text-primary transition-colors hover:bg-surface-container active:scale-95"
            aria-label="Carrito"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="9" cy="20" r="1.25" />
              <circle cx="18" cy="20" r="1.25" />
              <path d="M2.5 4h2l2.2 11.1a1.5 1.5 0 0 0 1.5 1.2h8.9a1.5 1.5 0 0 0 1.5-1.2L20.5 7H6" />
            </svg>
            {itemCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-on-primary">
                {itemCount}
              </span>
            )}
          </Link>
        )}
      </div>
    </header>
  );
}
