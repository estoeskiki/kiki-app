'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getPublicStorefront } from '@/lib/api';
import { useSessionStore } from '@/store/useSessionStore';
import { RestaurantStorefrontView } from '@/components/menu/RestaurantStorefrontView';
import { ScanQrBlocked } from '@/components/ui/ScanQrBlocked';

// Dev/test-only fallback — production ordering always goes through /t/[token]
// (the real QR entry point), which renders this same view without ever
// exposing this bare, guessable slug URL. See ScanQrBlocked.
export default function RestaurantStorefrontPage() {
  const { slug } = useParams<{ slug: string }>();
  const setFromStorefront = useSessionStore((s) => s.setFromStorefront);
  // Already-resolved token from earlier in this session — preserved, not required.
  const tableToken = useSessionStore((s) => s.tableToken);
  const [state, setState] = useState<'loading' | 'ready' | 'not_found'>('loading');
  const [restaurant, setRestaurant] = useState<{
    id: string;
    name: string;
    welcomeBgUrl?: string | null;
    slogan?: string | null;
    isOpen: boolean;
  } | null>(null);

  const blocked = process.env.NODE_ENV !== 'development' && !tableToken;

  useEffect(() => {
    if (blocked) return;
    getPublicStorefront({ slug, tableToken: tableToken ?? undefined }).then((data) => {
      if (data.type === 'restaurant') {
        setFromStorefront(slug, tableToken, data);
        setRestaurant({
          id: data.restaurant.id,
          name: data.restaurant.name,
          welcomeBgUrl: data.restaurant.welcomeBgUrl,
          slogan: data.restaurant.slogan,
          isOpen: data.restaurant.isOpen,
        });
        setState('ready');
      } else {
        setState('not_found');
      }
    });
  }, [slug, tableToken, blocked, setFromStorefront]);

  if (blocked) return <ScanQrBlocked />;
  if (state === 'loading') {
    return <p className="p-10 text-center font-body text-text-muted">Cargando…</p>;
  }
  if (state === 'not_found' || !restaurant) {
    return <p className="p-10 text-center font-body text-text-muted">Restaurante no encontrado.</p>;
  }

  return <RestaurantStorefrontView restaurant={restaurant} />;
}
