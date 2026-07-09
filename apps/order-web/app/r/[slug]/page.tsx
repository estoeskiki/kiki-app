'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getPublicStorefront } from '@/lib/api';
import { useSessionStore } from '@/store/useSessionStore';
import { StorefrontMenu } from '@/components/menu/StorefrontMenu';
import { OrderingGate } from '@/components/welcome/OrderingGate';

export default function RestaurantStorefrontPage() {
  const { slug } = useParams<{ slug: string }>();
  const setFromStorefront = useSessionStore((s) => s.setFromStorefront);
  const [state, setState] = useState<'loading' | 'ready' | 'not_found'>('loading');
  const [restaurant, setRestaurant] = useState<{
    id: string;
    name: string;
    welcomeBgUrl?: string | null;
    slogan?: string | null;
  } | null>(null);

  useEffect(() => {
    getPublicStorefront({ slug }).then((data) => {
      if (data.type === 'restaurant') {
        setFromStorefront(slug, null, data);
        setRestaurant({
          id: data.restaurant.id,
          name: data.restaurant.name,
          welcomeBgUrl: data.restaurant.welcomeBgUrl,
          slogan: data.restaurant.slogan,
        });
        setState('ready');
      } else {
        setState('not_found');
      }
    });
  }, [slug, setFromStorefront]);

  if (state === 'loading') {
    return <p className="p-10 text-center font-body text-text-muted">Cargando…</p>;
  }
  if (state === 'not_found' || !restaurant) {
    return <p className="p-10 text-center font-body text-text-muted">Restaurante no encontrado.</p>;
  }

  return (
    <OrderingGate name={restaurant.name} bgUrl={restaurant.welcomeBgUrl} slogan={restaurant.slogan}>
      <StorefrontMenu restaurantId={restaurant.id} restaurantName={restaurant.name} />
    </OrderingGate>
  );
}
