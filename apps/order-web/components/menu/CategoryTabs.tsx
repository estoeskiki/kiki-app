import type { Category } from '@/lib/types';
import { localize } from '@/lib/currency';

interface CategoryTabsProps {
  categories: Category[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function CategoryTabs({ categories, activeId, onSelect }: CategoryTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {categories.map((cat) => {
        const active = cat.id === activeId;
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={`shrink-0 rounded-full border px-4 py-2 font-body text-sm font-semibold transition ${
              active
                ? 'border-primary bg-primary text-on-primary'
                : 'border-border-light bg-surface text-text-secondary'
            }`}
          >
            {cat.icon} {localize(cat.name)}
          </button>
        );
      })}
    </div>
  );
}
