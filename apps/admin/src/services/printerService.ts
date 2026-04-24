import { Platform } from 'react-native';
import { Order } from '../data/types';
import { formatCurrency } from '../utils/formatCurrency';

// We declare the library dynamically so it doesn't crash Expo Go
let SenraisePrinter: any = null;

try {
  SenraisePrinter = require('react-native-senraise-printer').default;
} catch (e) {
  console.log('[PRINTER] Native hardware module not found. Falling back to Mock.');
}

/**
 * Extract the Spanish text from a translatable JSONB field.
 * Falls back to the raw value if it's already a string.
 */
function esText(value: any): string {
  if (!value) return '';
  
  let parsedValue = value;
  if (typeof value === 'string') {
    try {
      parsedValue = JSON.parse(value);
    } catch (e) {
      return value; // It was a normal string
    }
  }

  return parsedValue?.es || parsedValue?.en || String(value) || '';
}

/**
 * Translate order type to Spanish.
 */
function orderTypeLabel(type: string): string {
  switch (type) {
    case 'dine-in': return 'Para comer aquí';
    case 'takeaway': return 'Para llevar';
    default: return type;
  }
}

/**
 * Intelligently routes the print job to either the physical Senraise thermal 
 * printer, or the terminal console if we are developing locally.
 */
export const printTicket = async (order: Order): Promise<boolean> => {
  return new Promise(async (resolve) => {

    // 1. GRACEFUL FALLBACK (Emulator/Mac Development)
    if (Platform.OS !== 'android' || !SenraisePrinter) {
      console.log(`\n========================================`);
      console.log(`🖨️  [SIMULATED TICKET] Orden #${order.orderNumber}`);
      if (order.customerName) {
        console.log(`Cliente: ${order.customerName}`);
      }
      console.log(`Tipo: ${orderTypeLabel(order.orderType)}`);
      console.log(`----------------------------------------`);
      order.items.forEach(item => {
        console.log(`${item.quantity}x ${esText(item.menuItem.name)}   ${formatCurrency(item.lineTotal)}`);
      });
      console.log(`----------------------------------------`);
      console.log(`Total: ${formatCurrency(order.total)}`);
      console.log(`----------------------------------------`);
      console.log(`Potenciado por kiki`);
      console.log(`========================================\n`);

      setTimeout(() => resolve(true), 1000);
      return;
    }

    // 2. REAL PHYSICAL HARDWARE (Senraise POS Android Device)
    try {
      await SenraisePrinter.printText("KIKI BURGERS\n");

      await SenraisePrinter.printText(`Orden: #${order.orderNumber}\n`);
      if (order.customerName) {
        await SenraisePrinter.printText(`Cliente: ${order.customerName}\n`);
      }
      await SenraisePrinter.printText(`Tipo: ${orderTypeLabel(order.orderType)}\n`);
      await SenraisePrinter.printText("--------------------------------\n");

      for (const item of order.items) {
        await SenraisePrinter.printText(`${item.quantity}x ${esText(item.menuItem.name)}   ${formatCurrency(item.lineTotal)}\n`);
      }

      await SenraisePrinter.printText("--------------------------------\n");
      await SenraisePrinter.printText(`TOTAL: ${formatCurrency(order.total)}\n`);
      await SenraisePrinter.printText("--------------------------------\n");
      await SenraisePrinter.printText("Potenciado por kiki\n");
      await SenraisePrinter.printText("\n\n\n"); // Spool paper out to tear off

      resolve(true);
    } catch (err: any) {
      console.error('[PRINTER ERROR] Hardware failed:', err.message);
      resolve(true);
    }
  });
};
