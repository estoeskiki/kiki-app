import type { Order } from '@/data/types';
import { config } from '@/constants/config';
import { formatCurrency } from '@/utils/formatCurrency';

/**
 * Simulate printing a receipt for the given order.
 * Resolves after `config.printDelay` ms and always succeeds.
 */
export async function printReceipt(order: Order): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, config.printDelay));

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

  for (const item of order.items) {
    lines.push(`  ${item.quantity}x ${item.menuItem.name}`);

    // List selected customizations
    for (const group of item.menuItem.customizations) {
      const selectedIds = item.selectedCustomizations[group.id] ?? [];
      for (const option of group.options) {
        if (selectedIds.includes(option.id)) {
          const mod = option.priceModifier !== 0
            ? ` (${option.priceModifier > 0 ? '+' : ''}${formatCurrency(option.priceModifier)})`
            : '';
          lines.push(`     └ ${option.name}${mod}`);
        }
      }
    }

    lines.push(`${' '.repeat(30)}${formatCurrency(item.lineTotal).padStart(10)}`);
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
  lines.push('  Thank you for choosing Kiki Burger!');
  lines.push('');
  lines.push(doubleDivider);
  lines.push('');

  console.log(lines.join('\n'));
}
