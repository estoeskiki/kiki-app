'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { buildQuery } from '@/lib/filters';
import type { ScopeRestaurant } from '@/lib/types';

/**
 * Picks which restaurant a scoped page (menu, settings, kiosks) is editing.
 *
 * Separate from the analytics FilterBar on purpose: those filters are
 * multi-select and additive, while these pages act on exactly one restaurant at
 * a time. Selection lives in `?r=` either way, so the two stay compatible.
 */
export function RestaurantPicker({
  restaurants,
  value,
  extraResetKeys = [],
}: {
  restaurants: ScopeRestaurant[];
  value: string;
  /** Params that stop making sense when the restaurant changes (e.g. `cat`). */
  extraResetKeys?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  if (restaurants.length <= 1) return null;

  return (
    <label className="flex items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
        Restaurante
      </span>
      <select
        value={value}
        disabled={pending}
        onChange={(e) => {
          const patch: Record<string, string | null> = { r: e.target.value };
          for (const key of extraResetKeys) patch[key] = null;
          startTransition(() => {
            router.replace(`${pathname}${buildQuery(params, patch)}`, { scroll: false });
          });
        }}
        className="rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-[12px] text-text-primary outline-none focus:border-primary/40"
      >
        {restaurants.map((restaurant) => (
          <option key={restaurant.id} value={restaurant.id}>
            {restaurant.name}
            {restaurant.is_active ? '' : ' (oculto)'}
          </option>
        ))}
      </select>
    </label>
  );
}
