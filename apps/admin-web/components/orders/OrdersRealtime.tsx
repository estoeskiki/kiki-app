'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase/client';

/**
 * Keeps the order list fresh without turning it into a polling loop.
 *
 * Realtime delivers change *notifications*; the refetch is a normal server
 * re-render, so RLS re-filters the rows and the client never receives a payload
 * it was not entitled to. Postgres change events are subject to the same RLS as
 * a query, but relying on the re-render means we never have to merge an event
 * payload into local state and risk it diverging from the filters in the URL.
 *
 * Bursts are coalesced: a 12-item food-court order fires several events in a
 * few milliseconds, and that should cost one refresh, not twelve. There is also
 * a floor between refreshes so a busy dinner service cannot spin the server.
 *
 * Commit 0c7a21e removed always-on realtime from the menu for exactly this
 * reason — subscribe only where liveness is the point, which here it is.
 */
const COALESCE_MS = 400;
const MIN_INTERVAL_MS = 2000;

export function OrdersRealtime({ enabled = true }: { enabled?: boolean }) {
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefresh = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const supabase = getBrowserClient();

    const scheduleRefresh = () => {
      setPendingCount((n) => n + 1);
      if (timer.current) clearTimeout(timer.current);

      const sinceLast = Date.now() - lastRefresh.current;
      const delay = Math.max(COALESCE_MS, MIN_INTERVAL_MS - sinceLast);

      timer.current = setTimeout(() => {
        lastRefresh.current = Date.now();
        setPendingCount(0);
        router.refresh();
      }, delay);
    };

    const channel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sub_orders' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, scheduleRefresh)
      .subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [enabled, router]);

  return (
    <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-muted">
      <span className="pulse-dot size-[6px] rounded-full bg-primary shadow-[0_0_6px_var(--color-primary)]" />
      {pendingCount > 0 ? `${pendingCount} cambio${pendingCount === 1 ? '' : 's'}…` : 'En vivo'}
    </span>
  );
}
