'use client';

import { StorefrontMenu } from './StorefrontMenu';
import { OrderingGate } from '@/components/welcome/OrderingGate';

interface RestaurantStorefrontViewProps {
  restaurant: {
    id: string;
    name: string;
    welcomeBgUrl?: string | null;
    slogan?: string | null;
    isOpen: boolean;
  };
}

// Shared by /t/[token] (the real QR entry point) and /r/[slug] (kept as a
// dev/test-only fallback — see that page for the production block).
export function RestaurantStorefrontView({ restaurant }: RestaurantStorefrontViewProps) {
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
