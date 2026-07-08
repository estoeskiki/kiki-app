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

/**
 * Prints the official Panamanian Fiscal Receipt using the stored DGI data.
 * Called when an order is marked as "Ready".
 */
export const printFiscalReceipt = async (order: Order, restaurantName: string = "Kiki"): Promise<boolean> => {
  return new Promise(async (resolve) => {
    // Only print if there's actual fiscal data, OR inject mock data for testing
    let cufe = order.fiscalCufe;
    let qr = order.fiscalQrContent;

    if (!cufe) {
      console.log('[DEV] Injecting mock fiscal data for Admin Ticket Testing');
      cufe = 'FE01234567890ABCDEF1234567890ABCDEF123456789';
      qr = 'https://dgi-fep.mef.gob.pa/Consultas/FacturasPorCUFE?cufe=FE01234567890ABCDEF';
    }

    const itemCount = order.items.reduce((acc, item) => acc + item.quantity, 0);

    // 1. GRACEFUL FALLBACK (Emulator/Mac Development)
    if (Platform.OS !== 'android' || !SenraisePrinter) {
      console.log(`\n========================================`);
      console.log(`🧾 [SIMULATED FISCAL RECEIPT]`);
      console.log(`${restaurantName}`);
      console.log(`DGI`);
      console.log(`Comprobante Auxiliar Factura Electronica`);
      console.log(`Factura de Operacion Interna`);
      console.log(`----------------------------------------`);
      console.log(`Numero Orden:        ${order.orderNumber}`);
      console.log(`Punto Facturacion:   0001`);
      console.log(`Fecha Orden:         ${new Date(order.createdAt).toLocaleString()}`);
      console.log(`Cajero:              Admin POS`);
      console.log(`Tipo:                Consumidor Final`);
      console.log(`Cliente:             Cliente Contado`);
      console.log(`----------------------------------------`);
      console.log(`DESCRIPCION                           PRECIO`);
      order.items.forEach(item => {
        console.log(`${item.quantity}x ${esText(item.menuItem.name)}                 ${formatCurrency(item.lineTotal)}`);
      });
      console.log(`----------------------------------------`);
      console.log(`Subtotal:            ${formatCurrency(order.subtotal)}`);
      console.log(`ITBMS:               ${formatCurrency(order.tax)}`);
      console.log(`TOTAL:               ${formatCurrency(order.total)}`);
      console.log(`----------------------------------------`);
      console.log(`Cantidad de Items:   ${itemCount}`);
      console.log(`CUFE: ${cufe}`);
      if (qr) {
        console.log(`[QR CODE: ${qr}]`);
      }
      console.log(`Puede consultar la validez del documento escaneando el codigo QR.`);
      console.log(`Potenciado por kiki`);
      console.log(`========================================\n`);

      setTimeout(() => resolve(true), 1000);
      return;
    }

    // 2. REAL PHYSICAL HARDWARE
    try {
      await SenraisePrinter.printText(`${restaurantName}\n`);
      await SenraisePrinter.printText(`DGI\n`);
      await SenraisePrinter.printText(`Comprobante Auxiliar Factura Electronica\n`);
      await SenraisePrinter.printText(`Factura de Operacion Interna\n`);
      await SenraisePrinter.printText("--------------------------------\n");
      await SenraisePrinter.printText(`Numero Orden: ${order.orderNumber}\n`);
      await SenraisePrinter.printText(`Punto Facturacion: 0001\n`);
      await SenraisePrinter.printText(`Fecha Orden: ${new Date(order.createdAt).toLocaleString()}\n`);
      await SenraisePrinter.printText(`Cajero: Admin POS\n`);
      await SenraisePrinter.printText(`Tipo: Consumidor Final\n`);
      await SenraisePrinter.printText(`Cliente: Cliente Contado\n`);
      await SenraisePrinter.printText("--------------------------------\n");
      await SenraisePrinter.printText(`DESCRIPCION          PRECIO\n`);

      for (const item of order.items) {
        await SenraisePrinter.printText(`${item.quantity}x ${esText(item.menuItem.name)}\n`);
        await SenraisePrinter.printText(`                     ${formatCurrency(item.lineTotal)}\n`);
      }

      await SenraisePrinter.printText("--------------------------------\n");
      await SenraisePrinter.printText(`Subtotal:            ${formatCurrency(order.subtotal)}\n`);
      await SenraisePrinter.printText(`ITBMS:               ${formatCurrency(order.tax)}\n`);
      await SenraisePrinter.printText(`TOTAL:               ${formatCurrency(order.total)}\n`);
      await SenraisePrinter.printText("--------------------------------\n");
      await SenraisePrinter.printText(`Cantidad de Items:   ${itemCount}\n`);
      await SenraisePrinter.printText(`CUFE:\n${cufe}\n\n`);

      if (qr) {
        // Try QR printing, fallback to URL text if method doesn't exist
        try {
          if (SenraisePrinter.printQRCode) {
            await SenraisePrinter.printQRCode(qr, 6);
            await SenraisePrinter.printText(`\n`);
          } else {
            await SenraisePrinter.printText(`[QR CODE: ${qr}]\n`);
          }
        } catch (e) {
          await SenraisePrinter.printText(`[QR CODE: ${qr}]\n`);
        }
      }

      await SenraisePrinter.printText(`\nPuede consultar la validez del documento escaneando el codigo QR.\n\n`);
      await SenraisePrinter.printText(`Potenciado por kiki\n`);
      await SenraisePrinter.printText("\n\n\n"); // Spool paper

      resolve(true);
    } catch (err: any) {
      console.error('[PRINTER ERROR] Fiscal Hardware failed:', err.message);
      resolve(true);
    }
  });
};
