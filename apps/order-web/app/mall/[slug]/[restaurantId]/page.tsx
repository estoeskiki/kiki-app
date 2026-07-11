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
  const cached = restaurants.find((r) => r.id === restaurantId);
  const [name, setName] = useState<string | null>(cached?.name ?? null);
  const [isOpen, setIsOpen] = useState<boolean>(cached?.isOpen ?? true);
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
      setIsOpen(match.isOpen);
    });
  }, [slug, restaurantId, name, setFromStorefront]);

  if (notFound) return <p className="p-10 text-center font-body text-text-muted">Restaurante no encontrado.</p>;
  if (!name) return <p className="p-10 text-center font-body text-text-muted">Cargando…</p>;

  if (!isOpen) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="text-5xl">🏪</span>
        <p className="font-heading text-2xl font-bold text-text-primary">Cerrados al momento</p>
        <p className="max-w-xs font-body text-sm text-text-secondary">{name} no está aceptando pedidos ahora mismo. Vuelve más tarde.</p>
      </div>
    );
  }

  return <StorefrontMenu restaurantId={restaurantId} restaurantName={name} backHref={`/mall/${slug}`} />;
}
