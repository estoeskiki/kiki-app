'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getPublicStorefront } from '@/lib/api';
import { useSessionStore } from '@/store/useSessionStore';
import { StorefrontMenu } from '@/components/menu/StorefrontMenu';

export default function MallRestaurantPage() {
  const { slug, restaurantId } = useParams<{ slug: string; restaurantId: string }>();
  const setFromStorefront = useSessionStore((s) => s.setFromStorefront);
  const restaurants = useSessionStore((s) => s.restaurants);
  const [name, setName] = useState<string | null>(() => restaurants.find((r) => r.id === restaurantId)?.name ?? null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (name) return;
    // Direct link / refresh without visiting the directory first — re-resolve.
    getPublicStorefront({ slug }).then((data) => {
      if (data.type !== 'food_court') return setNotFound(true);
      setFromStorefront(slug, null, data);
      const match = data.restaurants.find((r) => r.id === restaurantId);
      if (!match) return setNotFound(true);
      setName(match.name);
    });
  }, [slug, restaurantId, name, setFromStorefront]);

  if (notFound) return <p className="p-10 text-center font-body text-text-muted">Restaurante no encontrado.</p>;
  if (!name) return <p className="p-10 text-center font-body text-text-muted">Cargando…</p>;

  return <StorefrontMenu restaurantId={restaurantId} restaurantName={name} backHref={`/mall/${slug}`} />;
}
