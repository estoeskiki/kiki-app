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
    <OrderingGate name={foodCourt.name} bgUrl={foodCourt.welcomeBgUrl}>
      <div className="min-h-dvh pb-24">
        <Header title={foodCourt.name} showCart />
        <p className="px-4 pb-2 font-body text-sm text-text-muted">Elige un restaurante para comenzar tu pedido. Puedes pedir de más de uno.</p>
        <RestaurantGrid slug={slug} restaurants={restaurants} />
        <CartFAB />
      </div>
    </OrderingGate>
  );
}
