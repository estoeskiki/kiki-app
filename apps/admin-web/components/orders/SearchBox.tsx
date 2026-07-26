'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { buildQuery } from '@/lib/filters';

/**
 * Order search. Accepts an order number or part of a customer name — the server
 * decides which by checking whether the term parses as an integer.
 *
 * Debounced so typing does not fire a query per keystroke, and it writes to the
 * URL like every other filter so a search result stays shareable.
 */
export function SearchBox({ placeholder = 'Buscar # o cliente…' }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const urlValue = params.get('q') ?? '';
  const [value, setValue] = useState(urlValue);

  // Keep in step when the query changes from elsewhere (Limpiar, the back
  // button). Adjusting during render rather than in an effect: React re-runs
  // this component immediately without committing the intermediate state, so
  // there is no flash of the stale value and no cascading render.
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [syncedValue, setSyncedValue] = useState(urlValue);
  if (urlValue !== syncedValue) {
    setSyncedValue(urlValue);
    setValue(urlValue);
  }

  useEffect(() => {
    if (value === urlValue) return;

    const id = setTimeout(() => {
      startTransition(() => {
        router.replace(`${pathname}${buildQuery(params, { q: value || null })}`, { scroll: false });
      });
    }, 300);

    return () => clearTimeout(id);
  }, [value, urlValue, params, pathname, router]);

  return (
    <div className="relative w-full max-w-[280px]">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">
        <Icon name="search" size={13} />
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label="Buscar pedidos"
        className="w-full rounded-[8px] border border-line bg-surface py-2 pl-8 pr-3 text-[13px] text-text-primary outline-none focus:border-primary/40"
      />
    </div>
  );
}
