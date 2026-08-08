'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';

/**
 * Manual refresh for the current page.
 *
 * Every route is server-rendered on demand, but Next's client Router Cache can
 * still serve a stale copy on a soft (Link) navigation back to a page you were
 * just on. `router.refresh()` re-runs the Server Components for the current
 * route in place — no full page reload, filters and scroll position survive —
 * which is the same mechanism OrdersRealtime already uses to pull in live
 * order changes.
 */
export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      aria-label="Actualizar"
      title="Actualizar"
      className="flex cursor-pointer items-center justify-center rounded-full p-2 text-muted transition-colors duration-200 hover:bg-surface-container hover:text-text-primary disabled:cursor-wait disabled:opacity-60"
    >
      <Icon name="refresh" size={15} className={pending ? 'animate-spin' : ''} />
    </button>
  );
}
