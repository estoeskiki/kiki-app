import Image from 'next/image';
import type { MenuItem } from '@/lib/types';
import { formatCurrency, localize } from '@/lib/currency';
import { getPlateColor } from '@/lib/plateColor';

interface MenuItemCardProps {
  item: MenuItem;
  onSelect: () => void;
  onAdd: () => void;
}

export function MenuItemCard({ item, onSelect, onAdd }: MenuItemCardProps) {
  const initial = localize(item.name).trim().charAt(0).toUpperCase();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className="flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border-light bg-surface text-left transition active:scale-[0.98]"
    >
      <div
        className="relative flex h-28 items-center justify-center sm:h-36"
        style={{ backgroundColor: getPlateColor(item.id) }}
      >
        {item.image ? (
          <Image
            src={item.image}
            alt=""
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover"
          />
        ) : (
          <span className="font-heading text-6xl font-black text-text-secondary/20">{initial}</span>
        )}
        {item.popular && (
          <span className="absolute bottom-2 left-2 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-on-primary">
            ★ Popular
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <span className="font-heading text-sm font-bold leading-tight text-text-primary">{localize(item.name)}</span>
        <span className="line-clamp-2 font-body text-xs text-text-muted">{localize(item.description)}</span>
        <div className="mt-auto flex flex-col gap-2 pt-2">
          <span className="font-heading text-base font-bold text-text-primary">{formatCurrency(item.price)}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            aria-label={`Agregar ${localize(item.name)} al carrito`}
            className="flex w-full items-center justify-center gap-1 rounded-full bg-primary px-2.5 py-1.5 font-body text-xs font-bold text-on-primary transition active:scale-95"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}
