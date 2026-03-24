import { config } from '@/constants/config';

export interface PaymentRequest {
  amount: number;
  currency: string;
  reference: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId: string | null;
  authorizationCode: string | null;
  error?: string;
  timestamp: string;
}

/**
 * Generate a random hex string of the given length.
 */
function randomHex(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 16).toString(16);
  }
  return result.toUpperCase();
}

/**
 * Simulate a POS terminal payment.
 * Resolves after a random delay with either a success or failure result
 * based on `config.paymentSuccessRate`.
 */
export async function processPayment(request: PaymentRequest): Promise<PaymentResult> {
  const delay =
    config.paymentDelay.min +
    Math.random() * (config.paymentDelay.max - config.paymentDelay.min);

  await new Promise((resolve) => setTimeout(resolve, delay));

  const success = Math.random() < config.paymentSuccessRate;
  const timestamp = new Date().toISOString();

  if (success) {
    return {
      success: true,
      transactionId: `TXN-${randomHex(8)}-${randomHex(4)}`,
      authorizationCode: `AUTH-${randomHex(6)}`,
      timestamp,
    };
  }

  return {
    success: false,
    transactionId: null,
    authorizationCode: null,
    error: 'Payment declined. Please try again or use a different payment method.',
    timestamp,
  };
}
