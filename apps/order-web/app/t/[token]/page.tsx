'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getPublicStorefront } from '@/lib/api';
import { useSessionStore } from '@/store/useSessionStore';
import { FoodCourtDirectoryView } from '@/components/directory/FoodCourtDirectoryView';
import { RestaurantStorefrontView } from '@/components/menu/RestaurantStorefrontView';
import type { StorefrontData } from '@/lib/types';

// This is the real, only production entry point for ordering — every table
// QR points here. It resolves the token and renders the storefront directly,
// staying at /t/[token] the whole time (no redirect to /mall or /r), so the
// URL itself always reflects "this order came from a scanned location" and
// can't be silently dropped by a bare /mall/<slug> or /r/<slug> visit.
export default function TableQrLandingPage() {
  const { token } = useParams<{ token: string }>();
  const setFromStorefront = useSessionStore((s) => s.setFromStorefront);
  const [data, setData] = useState<StorefrontData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPublicStorefront({ tableToken: token })
      .then((result) => {
        if (result.type === 'restaurant') {
          setFromStorefront(result.restaurant.slug, token, result);
        } else if (result.type === 'food_court') {
          setFromStorefront(result.foodCourt.slug, token, result);
        } else {
          setError('Este código QR ya no es válido. Por favor pide ayuda al personal.');
          return;
        }
        setData(result);
      })
      .catch((err) => {
        console.error('getPublicStorefront failed', err);
        setError('No se pudo conectar. Por favor revisa tu conexión e intenta de nuevo.');
      });
  }, [token, setFromStorefront]);

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-8">
        <p className="text-center font-body text-text-muted">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-8">
        <p className="text-center font-body text-text-muted">Buscando tu mesa…</p>
      </div>
    );
  }

  if (data.type === 'restaurant') {
    return <RestaurantStorefrontView restaurant={data.restaurant} />;
  }

  if (data.type === 'food_court') {
    return <FoodCourtDirectoryView slug={data.foodCourt.slug} foodCourt={data.foodCourt} restaurants={data.restaurants} />;
  }

  return null; // unreachable — the 'error' variant is never stored in `data`, see the effect above
}
