import type { MenuItem } from '@/lib/types';
import { MenuItemCard } from './MenuItemCard';

interface MenuGridProps {
  items: MenuItem[];
  onSelect: (item: MenuItem) => void;
  onAdd: (item: MenuItem) => void;
}

export function MenuGrid({ items, onSelect, onAdd }: MenuGridProps) {
  if (items.length === 0) {
    return <p className="px-4 py-10 text-center font-body text-text-muted">No hay artículos en esta categoría.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 px-4 pb-28 pt-1 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item, index) => (
        // Staggered fade-up on load, matching the kiosk's per-row entrance
        // animation — capped so a long menu doesn't leave the last cards
        // waiting a visibly long time to appear. h-full: this wrapper is now
        // the direct grid item, so it's what CSS Grid's default
        // align-items:stretch actually stretches to match the tallest card
        // in the row — without h-full here (and on MenuItemCard's own root)
        // that stretched height never reaches the visible bordered card, so
        // a longer description in one card left its neighbor visibly shorter.
        <div key={item.id} className="fade-up-item h-full" style={{ animationDelay: `${Math.min(index * 40, 360)}ms` }}>
          <MenuItemCard item={item} onSelect={() => onSelect(item)} onAdd={() => onAdd(item)} />
        </div>
      ))}
    </div>
  );
}
