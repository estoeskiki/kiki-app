import { Platform } from 'react-native';
import { Order } from '../data/types';
import { formatCurrency } from '../utils/formatCurrency';

// We declare the library dynamically so it doesn't crash Expo Go
let SenraisePrinter: any = null;

try {
  // Using 'require' instead of 'import' prevents Metro from complaining if the native bridging fails
  // when running on your Mac emulator!
  SenraisePrinter = require('react-native-senraise-printer').default;
} catch (e) {
  console.log('[PRINTER] Native hardware module not found. Falling back to Mock.');
}

/**
 * intelligently routes the print job to either the physical Senraise thermal 
 * printer, or the terminal console if we are developing locally.
 */
export const printTicket = async (order: Order): Promise<boolean> => {
  return new Promise(async (resolve) => {
    
    // 1. GRACEFUL FALLBACK (Emulator/Mac Development)
    if (Platform.OS !== 'android' || !SenraisePrinter) {
      console.log(`\n========================================`);
      console.log(`🖨️  [SIMULATED TICKET] Order #${order.orderNumber}`);
      console.log(`Type: ${order.orderType.toUpperCase()}`);
      console.log(`----------------------------------------`);
      order.items.forEach(item => {
        console.log(`${item.quantity}x ${item.menuItem.name}   ${formatCurrency(item.lineTotal)}`);
      });
      console.log(`----------------------------------------`);
      console.log(`Total: ${formatCurrency(order.total)}`);
      console.log(`========================================\n`);
      
      setTimeout(() => resolve(true), 1000);
      return;
    }

    // 2. REAL PHYSICAL HARDWARE (Senraise POS Android Device)
    try {
      // NOTE: Method names vary per SDK version. Adjust these exact calls
      // based on the react-native-senraise-printer documentation.
      
      // await SenraisePrinter.setAlignment(1); // 1 = Center
      await SenraisePrinter.printText("KIKI BURGERS\n");
      
      // await SenraisePrinter.setAlignment(0); // 0 = Left
      await SenraisePrinter.printText(`Order: #${order.orderNumber}\n`);
      await SenraisePrinter.printText(`Type: ${order.orderType}\n`);
      await SenraisePrinter.printText("--------------------------------\n");
      
      for (const item of order.items) {
        await SenraisePrinter.printText(`${item.quantity}x ${item.menuItem.name}   ${formatCurrency(item.lineTotal)}\n`);
      }
      
      await SenraisePrinter.printText("--------------------------------\n");
      await SenraisePrinter.printText(`TOTAL: ${formatCurrency(order.total)}\n`);
      await SenraisePrinter.printText("\n\n\n"); // Spool paper out to tear off
      
      resolve(true);
    } catch (err: any) {
      console.error('[PRINTER ERROR] Hardware failed:', err.message);
      // We resolve(true) anyway in this prototype so the app doesn't freeze the kitchen if paper runs out
      resolve(true); 
    }
  });
};
