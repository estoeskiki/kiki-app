'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchMenu } from '@/lib/api';
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
  backLabel?: string;
}

export function StorefrontMenu({ restaurantId, restaurantName, backHref, backLabel }: StorefrontMenuProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // The menu is a snapshot, refreshed on load and whenever the customer
  // returns to the tab. It deliberately does NOT hold a realtime subscription:
  // availability/closure is authoritatively re-checked at the cart (checkout
  // mounts and runs get_cart_validity) and again at submit inside
  // create-web-order, so a stale menu can never produce a bad order — it can
  // only show an item that gets flagged a moment later. Not worth a persistent
  // websocket per viewer.
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const load = (initial: boolean) =>
      fetchMenu(restaurantId).then(({ categories, items }) => {
        if (cancelled) return;
        setCategories(categories);
        setItems(items);
        setActiveCategoryId((current) => current ?? categories[0]?.id ?? null);
        if (initial) setIsLoading(false);
      });

    load(true);

    // A phone that sat in a pocket mid-browse is the realistic staleness case;
    // refresh when the tab comes back rather than polling in the background.
    const onVisible = () => {
      if (document.visibilityState === 'visible') load(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [restaurantId]);

  const visibleItems = useMemo(
    () => items.filter((item) => !activeCategoryId || item.categoryId === activeCategoryId),
    [items, activeCategoryId],
  );

  return (
    <div className="min-h-dvh pb-4">
      {/* Wrapper is what actually sticks — Header already has its own
          "sticky top-0", but nesting it alone would let the banner above it
          scroll away on its own, leaving Header pinned without it. Grouping
          both under one sticky top-0 keeps them pinned together as a unit;
          Header's own sticky class becomes a no-op here since its container
          (this wrapper) never moves once stuck. */}
      <div className="sticky top-0 z-30">
        {/* Very thin strip — a reminder that stays visible through the whole
            shopping session (not just the directory banner shown once, up
            front), that items from other restaurants can join this same order.
            backHref is only ever set for a food-court restaurant (see the
            /mall/[slug]/[restaurantId] call site), so its presence doubles as
            the "there are other restaurants to combine with" signal. */}
        {backHref && (
          // Solid bg-primary (opaque, not /10 or /40) — it's sticky, so a
          // translucent fill let scrolled content show through it. Solid lime
          // + dark on-primary text keeps both the contrast and the opacity fix.
          <div className="bg-primary py-1 text-center">
            <p className="font-body text-xs font-bold text-on-primary">Múltiples restaurantes, un solo pedido</p>
          </div>
        )}
        <Header title={restaurantName} backHref={backHref} backLabel={backLabel} />
      </div>
      <CategoryTabs categories={categories} activeId={activeCategoryId} onSelect={setActiveCategoryId} />
      {isLoading ? (
        <p className="px-4 py-10 text-center font-body text-text-muted">Cargando menú…</p>
      ) : (
        <MenuGrid items={visibleItems} onSelect={setSelectedItem} onAdd={setSelectedItem} />
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
