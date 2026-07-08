import type { CartItem } from '@/lib/types';
import { formatCurrency, localize } from '@/lib/currency';
import { useCartStore } from '@/store/useCartStore';

function customizationSummary(item: CartItem): string {
  const parts: string[] = [];
  for (const group of item.menuItem.customizations) {
    const ids = item.selectedCustomizations[group.id] ?? [];
    for (const opt of group.options) if (ids.includes(opt.id)) parts.push(localize(opt.name));
  }
  return parts.join(', ');
}

export function CartItemRow({ item }: { item: CartItem }) {
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const summary = customizationSummary(item);

  return (
    <div className="flex items-start gap-3 border-b border-border-light py-3 last:border-0">
      <div className="flex-1">
        <p className="font-heading text-sm font-bold text-text-primary">{localize(item.menuItem.name)}</p>
        {summary && <p className="font-body text-xs text-text-muted">{summary}</p>}
        <button onClick={() => removeItem(item.id)} className="mt-1 font-body text-xs text-error">
          Quitar
        </button>
      </div>
      <div className="flex items-center gap-2 rounded-full bg-surface-container px-1">
        <button
          onClick={() => updateQuantity(item.id, item.quantity - 1)}
          className="flex h-8 w-8 items-center justify-center text-text-primary"
        >
          −
        </button>
        <span className="min-w-4 text-center font-heading text-sm font-bold text-text-primary">{item.quantity}</span>
        <button
          onClick={() => updateQuantity(item.id, item.quantity + 1)}
          className="flex h-8 w-8 items-center justify-center text-text-primary"
        >
          +
        </button>
      </div>
      <span className="w-16 shrink-0 text-right font-heading text-sm font-bold text-text-primary">
        {formatCurrency(item.lineTotal)}
      </span>
    </div>
  );
}
