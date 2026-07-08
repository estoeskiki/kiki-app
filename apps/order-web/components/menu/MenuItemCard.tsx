import type { MenuItem } from '@/lib/types';
import { formatCurrency, localize } from '@/lib/currency';
import { getPlateColor } from '@/lib/plateColor';

interface MenuItemCardProps {
  item: MenuItem;
  onSelect: () => void;
}

export function MenuItemCard({ item, onSelect }: MenuItemCardProps) {
  const initial = localize(item.name).trim().charAt(0).toUpperCase();

  return (
    <button
      onClick={onSelect}
      className="flex flex-col overflow-hidden rounded-xl border border-border-light bg-surface text-left transition active:scale-[0.98]"
    >
      <div
        className="relative flex h-28 items-center justify-center sm:h-36"
        style={{ backgroundColor: getPlateColor(item.id) }}
      >
        <span className="font-heading text-6xl font-black text-text-secondary/20">{initial}</span>
        {item.popular && (
          <span className="absolute bottom-2 left-2 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-on-primary">
            ★ Popular
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <span className="font-heading text-sm font-bold leading-tight text-text-primary">{localize(item.name)}</span>
        <span className="line-clamp-2 font-body text-xs text-text-muted">{localize(item.description)}</span>
        <span className="mt-auto pt-1 font-heading text-base font-bold text-text-primary">{formatCurrency(item.price)}</span>
      </div>
    </button>
  );
}
