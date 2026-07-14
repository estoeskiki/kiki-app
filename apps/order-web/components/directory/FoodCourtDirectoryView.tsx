'use client';

import { Header } from '@/components/layout/Header';
import { RestaurantGrid } from './RestaurantGrid';
import { CartFAB } from '@/components/cart/CartFAB';
import { OrderingGate } from '@/components/welcome/OrderingGate';
import type { FoodCourtSummary, RestaurantSummary } from '@/lib/types';

interface FoodCourtDirectoryViewProps {
  slug: string;
  foodCourt: FoodCourtSummary;
  restaurants: RestaurantSummary[];
}

// Shared by /t/[token] (the real QR entry point) and /mall/[slug] (kept as a
// dev/test-only fallback — see that page for the production block).
export function FoodCourtDirectoryView({ slug, foodCourt, restaurants }: FoodCourtDirectoryViewProps) {
  return (
    <OrderingGate name={foodCourt.name} bgUrl={foodCourt.welcomeBgUrl} slogan={foodCourt.slogan}>
      <div className="min-h-dvh pb-24">
        <Header title={foodCourt.name} showCart />

        <div className="fade-up-item mx-4 mt-3 flex flex-col gap-1 rounded-xl border-l-4 border-primary bg-primary/10 px-4 py-3">
          <p className="font-body text-sm font-semibold text-text-primary">
            Combina tus platos favoritos de diferentes restaurantes en un solo pedido.
          </p>
          <p className="font-body text-xs text-text-secondary">Pagas tu pedido en la entrega.</p>
        </div>

        <div className="fade-up-item mt-6 flex items-baseline justify-between px-4" style={{ animationDelay: '40ms' }}>
          <h2 className="font-heading text-lg font-bold tracking-tight text-text-primary">Restaurantes</h2>
          <span className="font-body text-xs font-semibold text-text-muted">{restaurants.length} disponibles</span>
        </div>

        <RestaurantGrid slug={slug} restaurants={restaurants} />

        <p className="mt-6 text-center font-body font-bold text-xs tracking-[-0.02em] text-text-muted">
          powered by <span className="font-heading font-bold tracking-[-0.036em] text-primary">kiki</span>
        </p>

        <CartFAB />
      </div>
    </OrderingGate>
  );
}
