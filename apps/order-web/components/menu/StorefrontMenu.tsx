'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchMenu } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { Category, MenuItem } from '@/lib/types';
import { Header } from '@/components/layout/Header';
import { CategoryTabs } from './CategoryTabs';
import { MenuGrid } from './MenuGrid';
import { ItemDetailModal } from './ItemDetailModal';
import { CartFAB } from '@/components/cart/CartFAB';

interface StorefrontMenuProps {
  restaurantId: string;
  restaurantName: string;
  backHref?: string;
}

export function StorefrontMenu({ restaurantId, restaurantName, backHref }: StorefrontMenuProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    fetchMenu(restaurantId).then(({ categories, items }) => {
      if (cancelled) return;
      setCategories(categories);
      setItems(items);
      setActiveCategoryId((current) => current ?? categories[0]?.id ?? null);
      setIsLoading(false);
    });

    // Live menu updates (price/availability changes) — same pattern as
    // apps/kiosk's useMenuStore.subscribeToMenu(), works because
    // migration 010 opens menu_items/categories to anon read.
    const channel = supabase
      .channel(`menu-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        fetchMenu(restaurantId).then(({ categories, items }) => {
          setCategories(categories);
          setItems(items);
        });
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  const visibleItems = useMemo(
    () => items.filter((item) => !activeCategoryId || item.categoryId === activeCategoryId),
    [items, activeCategoryId],
  );

  return (
    <div className="min-h-dvh pb-24">
      <Header title={restaurantName} backHref={backHref} />
      <CategoryTabs categories={categories} activeId={activeCategoryId} onSelect={setActiveCategoryId} />
      {isLoading ? (
        <p className="px-4 py-10 text-center font-body text-text-muted">Cargando menú…</p>
      ) : (
        <MenuGrid items={visibleItems} onSelect={setSelectedItem} />
      )}
      <CartFAB />
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
