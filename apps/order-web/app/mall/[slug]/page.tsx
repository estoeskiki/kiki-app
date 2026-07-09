'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getPublicStorefront } from '@/lib/api';
import { useSessionStore } from '@/store/useSessionStore';
import { Header } from '@/components/layout/Header';
import { RestaurantGrid } from '@/components/directory/RestaurantGrid';
import { CartFAB } from '@/components/cart/CartFAB';
import { OrderingGate } from '@/components/welcome/OrderingGate';
import type { FoodCourtSummary, RestaurantSummary } from '@/lib/types';

export default function FoodCourtDirectoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const setFromStorefront = useSessionStore((s) => s.setFromStorefront);
  const [state, setState] = useState<'loading' | 'ready' | 'not_found'>('loading');
  const [foodCourt, setFoodCourt] = useState<FoodCourtSummary | null>(null);
  const [restaurants, setRestaurants] = useState<RestaurantSummary[]>([]);

  useEffect(() => {
    getPublicStorefront({ slug }).then((data) => {
      if (data.type === 'food_court') {
        setFromStorefront(slug, null, data);
        setFoodCourt(data.foodCourt);
        setRestaurants(data.restaurants);
        setState('ready');
      } else {
        setState('not_found');
      }
    });
  }, [slug, setFromStorefront]);

  if (state === 'loading') return <p className="p-10 text-center font-body text-text-muted">Cargando…</p>;
  if (state === 'not_found' || !foodCourt) return <p className="p-10 text-center font-body text-text-muted">No encontrado.</p>;

  return (
    <OrderingGate name={foodCourt.name} bgUrl={foodCourt.welcomeBgUrl} slogan={foodCourt.slogan}>
      <div className="min-h-dvh pb-24">
        <Header title={foodCourt.name} showCart />

        <div className="fade-up-item mx-4 mt-3 flex flex-col gap-1 rounded-xl border-l-4 border-primary bg-primary/10 px-4 py-3">
          <p className="font-body text-sm font-semibold text-text-primary">
            Escoge los platos que más te gusten de los diferentes restaurantes y haz un solo pedido.
          </p>
          <p className="font-body text-xs text-text-secondary">Pagas tu pedido en la entrega.</p>
        </div>

        <div className="fade-up-item mt-6 flex items-baseline justify-between px-4" style={{ animationDelay: '40ms' }}>
          <h2 className="font-heading text-lg font-bold tracking-tight text-text-primary">Restaurantes</h2>
          <span className="font-body text-xs font-semibold text-text-muted">{restaurants.length} disponibles</span>
        </div>

        <RestaurantGrid slug={slug} restaurants={restaurants} />
        <CartFAB />
      </div>
    </OrderingGate>
  );
}
