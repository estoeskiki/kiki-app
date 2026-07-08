// Base URL of apps/order-web once deployed. Update this once the web
// ordering channel has a real domain — used to build the QR code printed
// on each table (https://<domain>/t/<qr_token>).
export const ORDER_WEB_BASE_URL = process.env.EXPO_PUBLIC_ORDER_WEB_URL || 'https://order.kiki.app';
