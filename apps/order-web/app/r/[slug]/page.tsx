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
    isOpen: boolean;
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
          isOpen: data.restaurant.isOpen,
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

  if (!restaurant.isOpen) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="text-5xl">🏪</span>
        <p className="font-heading text-2xl font-bold text-text-primary">Cerrados al momento</p>
        <p className="max-w-xs font-body text-sm text-text-secondary">
          {restaurant.name} no está aceptando pedidos ahora mismo. Vuelve más tarde.
        </p>
      </div>
    );
  }

  return (
    <OrderingGate name={restaurant.name} bgUrl={restaurant.welcomeBgUrl} slogan={restaurant.slogan}>
      <StorefrontMenu restaurantId={restaurant.id} restaurantName={restaurant.name} />
    </OrderingGate>
  );
}
