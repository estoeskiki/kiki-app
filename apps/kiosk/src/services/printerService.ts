import { Alert, Platform } from 'react-native';
import type { Order } from '@/data/types';
import { config } from '@/constants/config';
import { formatCurrency } from '@/utils/formatCurrency';
import { getLocalizedText } from '@/i18n/useTranslation';
import { useLocaleStore } from '@/store/useLocaleStore';
import { useAuthStore } from '@/store/useAuthStore';

import { translations } from '@/i18n/translations';

// Try to load the native module, gracefully fallback to null if it fails (e.g. on iOS/Web or without dev client)
let IcodPrinter: any = null;
let icodLoadError: string | null = null;
try {
  if (Platform.OS === 'android') {
    IcodPrinter = require('../../modules/icod-printer');
  }
} catch (e: any) {
  icodLoadError = e?.message ?? String(e);
  console.log('[PRINTER] IcodPrinter Native Module not available. Using simulated console output.');
}

/**
 * Resolve a translatable text field to a plain string for printing.
 * Prints in the language selected by the user.
 */
function text(value: any): string {
  const lang = useLocaleStore.getState().language;
  return getLocalizedText(value, lang);
}

/**
 * Print the receipt using the physical ICOD printer, or fallback to console simulation.
 */
export async function printReceipt(order: Order): Promise<void> {
  const mode = useAuthStore.getState().mode;
  const lang = useLocaleStore.getState().language;
  const t = translations[lang];

  const divider = '─'.repeat(32);
  const doubleDivider = '═'.repeat(32);
  const lines: string[] = [];

  // If using physical printer, try to initialize it
  let useHardware = false;
  if (IcodPrinter) {
    try {
      const initialized = await IcodPrinter.initPrinter();
      if (initialized) {
        useHardware = true;
      } else {
        Alert.alert('Printer', 'initPrinter() returned false — printer did not connect (check USB/power).');
      }
    } catch (e: any) {
      console.warn('Failed to initialize physical printer', e);
      Alert.alert('Printer error', String(e?.message ?? e));
    }
  } else if (icodLoadError) {
    Alert.alert('Printer module not loaded', icodLoadError);
  }

  // Helper to print a line to hardware or save to array for simulation
  const printLine = async (line: string) => {
    if (useHardware) {
      await IcodPrinter.printString(line + '\n');
    } else {
      lines.push(line);
    }
  };

  await printLine('');
  await printLine(doubleDivider);
  await printLine(`  ${config.restaurantName}`);
  await printLine(`  ${config.tagline}`);
  await printLine(doubleDivider);
  await printLine(`  Order #${String(order.orderNumber).padStart(3, '0')}`);
  await printLine(`  ${lang === 'es' ? 'Tipo' : 'Type'}: ${order.orderType === 'dine-in' ? t.dineIn : t.takeaway}`);
  await printLine(`  Date: ${new Date(order.createdAt).toLocaleString()}`);
  await printLine(divider);

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
      await printLine(`  ┌ ${group.name.toUpperCase()}`);
      await printLine(`  │`);

      for (const item of group.items) {
        await printLine(`  │ ${item.quantity}x ${text(item.menuItem.name)}`);

        for (const cg of item.menuItem.customizations) {
          const selectedIds = item.selectedCustomizations[cg.id] ?? [];
          for (const option of cg.options) {
            if (selectedIds.includes(option.id)) {
              const mod = option.priceModifier !== 0
                ? ` (${option.priceModifier > 0 ? '+' : ''}${formatCurrency(option.priceModifier)})`
                : '';
              await printLine(`  │    └ ${text(option.name)}${mod}`);
            }
          }
        }
        await printLine(`  │${formatCurrency(item.lineTotal).padStart(30)}`);
      }
      await printLine(`  └${'─'.repeat(30)}`);
    }
  } else {
    // Standalone: flat list
    for (const item of order.items) {
      await printLine(`  ${item.quantity}x ${text(item.menuItem.name)}`);

      for (const group of item.menuItem.customizations) {
        const selectedIds = item.selectedCustomizations[group.id] ?? [];
        for (const option of group.options) {
          if (selectedIds.includes(option.id)) {
            const mod = option.priceModifier !== 0
              ? ` (${option.priceModifier > 0 ? '+' : ''}${formatCurrency(option.priceModifier)})`
              : '';
            await printLine(`     └ ${text(option.name)}${mod}`);
          }
        }
      }
      await printLine(`${' '.repeat(22)}${formatCurrency(item.lineTotal).padStart(10)}`);
    }
  }

  await printLine(divider);
  await printLine(`  ${t.subtotal}${formatCurrency(order.subtotal).padStart(32 - t.subtotal.length)}`);
  await printLine(`  ${t.tax} (${(config.taxRate * 100).toFixed(0)}%)${formatCurrency(order.tax).padStart(28 - t.tax.length)}`);
  await printLine(divider);
  await printLine(`  ${t.total}${formatCurrency(order.total).padStart(32 - t.total.length)}`);
  await printLine(doubleDivider);

  if (order.transactionId) {
    await printLine(`  Transaction: ${order.transactionId}`);
  }

  await printLine('');

  // If no fiscal data, print a generic thank you
  await printLine(`  ${t.thankYou} ${config.restaurantName}!`);

  await printLine('');
  await printLine(`       Powered by kiki`);

  await printLine('');
  await printLine(doubleDivider);
  await printLine('');

  if (useHardware) {
    await IcodPrinter.cutPaper();
    try { await IcodPrinter.disconnect(); } catch (e) {}
  } else {
    // Simulate delay
    await new Promise((resolve) => setTimeout(resolve, config.printDelay));
    console.log('\n[SIMULATED KIOSK RECEIPT]\n' + lines.join('\n'));
  }
}
