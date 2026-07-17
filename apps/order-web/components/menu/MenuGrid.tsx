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
    <div
      className="overflow-y-auto"
      style={{
        maxHeight: 'calc(100dvh - 60px - 56px - 80px)',
      }}
    >
      <div className="grid grid-cols-2 gap-3 px-4 pb-6 pt-1 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <MenuItemCard key={item.id} item={item} onSelect={() => onSelect(item)} onAdd={() => onAdd(item)} />
        ))}
      </div>
    </div>
  );
}
