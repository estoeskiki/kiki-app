'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getPublicStorefront } from '@/lib/api';
import { useSessionStore } from '@/store/useSessionStore';
import { FoodCourtDirectoryView } from '@/components/directory/FoodCourtDirectoryView';
import { ScanQrBlocked } from '@/components/ui/ScanQrBlocked';
import type { FoodCourtSummary, RestaurantSummary } from '@/lib/types';

// Dev/test-only fallback — production ordering always goes through /t/[token]
// (the real QR entry point), which renders this same view without ever
// exposing this bare, guessable slug URL. See ScanQrBlocked.
export default function FoodCourtDirectoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const setFromStorefront = useSessionStore((s) => s.setFromStorefront);
  // Already-resolved token from earlier in this session (e.g. navigating
  // back here after drilling into a restaurant) — preserved, not required.
  const tableToken = useSessionStore((s) => s.tableToken);
  const [state, setState] = useState<'loading' | 'ready' | 'not_found'>('loading');
  const [foodCourt, setFoodCourt] = useState<FoodCourtSummary | null>(null);
  const [restaurants, setRestaurants] = useState<RestaurantSummary[]>([]);

  const blocked = process.env.NODE_ENV !== 'development' && !tableToken;

  useEffect(() => {
    if (blocked) return;
    getPublicStorefront({ slug, tableToken: tableToken ?? undefined }).then((data) => {
      if (data.type === 'food_court') {
        setFromStorefront(slug, tableToken, data);
        setFoodCourt(data.foodCourt);
        setRestaurants(data.restaurants);
        setState('ready');
      } else {
        setState('not_found');
      }
    });
  }, [slug, tableToken, blocked, setFromStorefront]);

  if (blocked) return <ScanQrBlocked />;
  if (state === 'loading') return <p className="p-10 text-center font-body text-text-muted">Cargando…</p>;
  if (state === 'not_found' || !foodCourt) return <p className="p-10 text-center font-body text-text-muted">No encontrado.</p>;

  return <FoodCourtDirectoryView slug={slug} foodCourt={foodCourt} restaurants={restaurants} />;
}
