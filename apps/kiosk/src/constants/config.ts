export const config = {
  restaurantName: 'KIKI BURGER',
  tagline: 'Smashed to Perfection',
  // No tax charged — mirrors restaurants.tax_rate = 0 in the DB (migration
  // 013_zero_tax_default.sql), which is what create-web-order actually
  // reprices with server-side. Keeping this non-zero here would show the
  // customer a total the server never charges.
  taxRate: 0,
  currency: 'USD',
  // Base URL of the deployed order-web app. The ThankYou screen renders a QR
  // encoding `${orderWebUrl}/order/${orderId}` so the customer can follow the
  // live tracker on their own phone. Set EXPO_PUBLIC_ORDER_WEB_URL in env.
  orderWebUrl: (process.env.EXPO_PUBLIC_ORDER_WEB_URL as string | undefined)?.replace(/\/$/, '') ?? '',
  autoResetTimeout: 45000, // 45 seconds on ThankYou — gives time to scan the tracker QR
  idleTimeout: 60000, // 60 seconds
  paymentSuccessRate: 0.9, // 90% mock success
  paymentDelay: { min: 2000, max: 3000 },
  orderDelay: 500,
  printDelay: 1500,
  features: {
    askCustomerName: false,
  },
} as const;
