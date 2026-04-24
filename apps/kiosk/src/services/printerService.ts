import type { Order } from '@/data/types';
import { config } from '@/constants/config';
import { formatCurrency } from '@/utils/formatCurrency';
import { getLocalizedText } from '@/i18n/useTranslation';
import { useLocaleStore } from '@/store/useLocaleStore';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Resolve a translatable text field to a plain string for printing.
 */
function text(value: any): string {
  const lang = useLocaleStore.getState().language;
  return getLocalizedText(value, lang);
}

/**
 * Simulate printing a receipt for the given order.
 * Food court mode: groups items by restaurant with section headers.
 * Standalone mode: flat list (same as before).
 */
export async function printReceipt(order: Order): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, config.printDelay));

  const mode = useAuthStore.getState().mode;
  const divider = '─'.repeat(40);
  const doubleDivider = '═'.repeat(40);

  const lines: string[] = [
    '',
    doubleDivider,
    `  ${config.restaurantName}`,
    `  ${config.tagline}`,
    doubleDivider,
    `  Order #${String(order.orderNumber).padStart(3, '0')}`,
    `  Type: ${order.orderType === 'dine-in' ? 'Dine In' : 'Takeaway'}`,
    `  Date: ${new Date(order.createdAt).toLocaleString()}`,
    divider,
  ];

  if (mode === 'food_court') {
    // Group items by restaurant
    const grouped = new Map<string, { name: string; items: typeof order.items }>();
    for (const item of order.items) {
      const rId = item.restaurantId || 'unknown';
      const rName = item.restaurantName || 'Restaurant';
      if (!grouped.has(rId)) grouped.set(rId, { name: rName, items: [] });
      grouped.get(rId)!.items.push(item);
    }

    for (const [, group] of grouped) {
      lines.push(`  ┌ ${group.name.toUpperCase()}`);
      lines.push(`  │`);

      for (const item of group.items) {
        lines.push(`  │ ${item.quantity}x ${text(item.menuItem.name)}`);

        for (const cg of item.menuItem.customizations) {
          const selectedIds = item.selectedCustomizations[cg.id] ?? [];
          for (const option of cg.options) {
            if (selectedIds.includes(option.id)) {
              const mod = option.priceModifier !== 0
                ? ` (${option.priceModifier > 0 ? '+' : ''}${formatCurrency(option.priceModifier)})`
                : '';
              lines.push(`  │    └ ${text(option.name)}${mod}`);
            }
          }
        }

        lines.push(`  │${formatCurrency(item.lineTotal).padStart(38)}`);
      }

      lines.push(`  └${'─'.repeat(38)}`);
    }
  } else {
    // Standalone: flat list
    for (const item of order.items) {
      lines.push(`  ${item.quantity}x ${text(item.menuItem.name)}`);

      for (const group of item.menuItem.customizations) {
        const selectedIds = item.selectedCustomizations[group.id] ?? [];
        for (const option of group.options) {
          if (selectedIds.includes(option.id)) {
            const mod = option.priceModifier !== 0
              ? ` (${option.priceModifier > 0 ? '+' : ''}${formatCurrency(option.priceModifier)})`
              : '';
            lines.push(`     └ ${text(option.name)}${mod}`);
          }
        }
      }

      lines.push(`${' '.repeat(30)}${formatCurrency(item.lineTotal).padStart(10)}`);
    }
  }

  lines.push(divider);
  lines.push(`  Subtotal${formatCurrency(order.subtotal).padStart(30)}`);
  lines.push(`  Tax (${(config.taxRate * 100).toFixed(0)}%)${formatCurrency(order.tax).padStart(28)}`);
  lines.push(divider);
  lines.push(`  TOTAL${formatCurrency(order.total).padStart(33)}`);
  lines.push(doubleDivider);

  if (order.transactionId) {
    lines.push(`  Transaction: ${order.transactionId}`);
  }

  lines.push('');
  lines.push(`  Thank you for choosing ${config.restaurantName}!`);
  lines.push('');
  lines.push(doubleDivider);
  lines.push('');

  console.log(lines.join('\n'));
}
