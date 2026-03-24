export const config = {
  restaurantName: 'KIKI BURGER',
  tagline: 'Smashed to Perfection',
  taxRate: 0.07, // 7%
  currency: 'USD',
  autoResetTimeout: 15000, // 15 seconds on ThankYou
  idleTimeout: 60000, // 60 seconds
  paymentSuccessRate: 0.9, // 90% mock success
  paymentDelay: { min: 2000, max: 3000 },
  orderDelay: 500,
  printDelay: 1500,
} as const;
