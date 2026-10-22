import { supabase } from './supabase';
import { CartInvalidError, type CreateWebOrderPayload } from './api';

// Yappy Botón de Pago (pay-first). The browser never sees Yappy credentials:
// yappy-create talks to Yappy, yappy-ipn creates the order once Yappy confirms.
// This file is the client side of that — options, create, status polling and
// the pending attempt we keep in localStorage so a closed tab can resume.

export interface PaymentOptions {
  yappy: boolean;
  reason: string | null;
}

// Best-effort: any failure means "no Yappy", and checkout stays exactly as
// it is today (pay on delivery).
export async function getPaymentOptions(tableToken: string | null): Promise<PaymentOptions> {
  if (!tableToken) return { yappy: false, reason: 'no_table' };
  const { data, error } = await (supabase.rpc as any)('get_payment_options', { p_table_token: tableToken });
  if (error || !data) return { yappy: false, reason: 'error' };
  return { yappy: data.yappy === true, reason: data.reason ?? null };
}

export interface YappyTransaction {
  paymentId: string;
  transactionId: string;
  token: string;
  documentName: string;
  expiresAt: string;
}

// A refusal we can explain to the customer. `paymentId` is set when an
// attempt exists server-side whose outcome is unknown — the UI must then wait
// on it instead of letting the customer pay again.
export class YappyCreateError extends Error {
  code: string;
  paymentId: string | null;
  constructor(code: string, message: string, paymentId: string | null = null) {
    super(message);
    this.name = 'YappyCreateError';
    this.code = code;
    this.paymentId = paymentId;
  }
}

export type CreateYappyPaymentPayload = Omit<CreateWebOrderPayload, 'paymentMethod' | 'restaurantId' | 'foodCourtId'> & {
  tableToken: string;
  checkoutKey: string;
  aliasYappy: string;
};

export async function createYappyPayment(payload: CreateYappyPaymentPayload): Promise<YappyTransaction> {
  const { data, error } = await supabase.functions.invoke('yappy-create', { body: payload });
  if (error) throw new YappyCreateError('network', 'No pudimos conectar con Yappy. Intenta de nuevo.');
  if (data?.error === 'cart_invalid') {
    throw new CartInvalidError(data.closedRestaurantIds ?? [], data.unavailableItemIds ?? []);
  }
  if (data?.error) {
    throw new YappyCreateError(
      data.error,
      data.message ?? 'No pudimos iniciar el pago con Yappy. Intenta de nuevo.',
      data.paymentId ?? null,
    );
  }
  return {
    paymentId: data.paymentId,
    transactionId: data.transactionId,
    token: data.token,
    documentName: data.documentName,
    expiresAt: data.expiresAt,
  };
}

export type YappyPaymentStatus = 'creating' | 'created' | 'unknown' | 'failed' | 'cancelled' | 'expired' | 'executed';

export interface YappyStatusResult {
  status: YappyPaymentStatus;
  ipnReceived: boolean;
  orderId: string | null;
  orderNumber: number | null;
  confirmationNumber: string | null;
  errorCode: string | null;
  totalCents: number;
  expiresAt: string;
}

// Throws on transport errors (caller keeps polling); null = unknown/expired id.
export async function getYappyPaymentStatus(paymentId: string): Promise<YappyStatusResult | null> {
  const { data, error } = await (supabase.rpc as any)('get_yappy_payment_status', { p_payment_id: paymentId });
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    status: data.status,
    ipnReceived: data.ipn_received === true,
    orderId: data.order_id ?? null,
    orderNumber: data.order_number ?? null,
    confirmationNumber: data.confirmation_number ?? null,
    errorCode: data.error_code ?? null,
    totalCents: data.total_cents,
    expiresAt: data.expires_at,
  };
}

// The button's own success event — only a hint for staff reconciliation.
// The order is created exclusively by the IPN.
export async function reportClientSuccess(paymentId: string): Promise<void> {
  try {
    await supabase.functions.invoke('yappy-create', { body: { action: 'client_success', paymentId } });
  } catch {
    // hint only
  }
}

// ─── Pending attempt (survives a closed tab) ────────────────────────────────
const PENDING_KEY = 'kiki-yappy-pending';
// Yappy's 5 min window + the 10 min "don't pay again" grace in the overlay.
export const PENDING_TTL_MS = 15 * 60 * 1000;

export interface YappyPending {
  paymentId: string;
  checkoutKey: string;
  createdAt: number;
  customerName: string;
}

export function readPending(): YappyPending | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as YappyPending;
    if (!p?.paymentId || Date.now() - p.createdAt > PENDING_TTL_MS) {
      localStorage.removeItem(PENDING_KEY);
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export function writePending(p: YappyPending): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(p));
  } catch {
    // private mode: resume just won't work
  }
}

export function clearPending(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}
