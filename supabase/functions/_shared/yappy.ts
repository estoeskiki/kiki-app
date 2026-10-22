// ============================================================================
// Yappy Botón de Pago — config, amount formatting, hash, HTTP.
//
// Shared by yappy-create and yappy-ipn. Deliberately free of Deno globals at
// module scope so `node --experimental-strip-types --test` can import it
// (see yappy.test.ts); env access happens only inside getYappyConfig.
// ============================================================================

export type YappyEnv = 'uat' | 'prod'

export interface YappyConfig {
  env: YappyEnv
  merchantId: string
  secret: string // base64 "CLAVE_SECRETA" as shown once in Yappy Comercial
  baseUrl: string // https://api-comecom-uat.yappycloud.com in UAT
  domain: string // exactly as registered in Yappy Comercial, e.g. https://order.estoeskiki.com
}

// Secrets per environment: YAPPY_UAT_MERCHANT_ID, YAPPY_UAT_SECRET,
// YAPPY_UAT_BASE_URL, YAPPY_UAT_DOMAIN (and the same with PROD_ later).
export function getYappyConfig(
  env: YappyEnv,
  getEnv: (key: string) => string | undefined = (key) => Deno.env.get(key),
): YappyConfig | null {
  const prefix = `YAPPY_${env.toUpperCase()}_`
  const merchantId = getEnv(prefix + 'MERCHANT_ID')
  const secret = getEnv(prefix + 'SECRET')
  const baseUrl = getEnv(prefix + 'BASE_URL')
  const domain = getEnv(prefix + 'DOMAIN')
  if (!merchantId || !secret || !baseUrl || !domain) return null
  return { env, merchantId, secret, baseUrl: baseUrl.replace(/\/+$/, ''), domain }
}

// ─── Amounts ────────────────────────────────────────────────────────────────
// Kiki stores cents as integers. Yappy wants strings with two decimals. Integer
// arithmetic only — (cents / 100).toFixed(2) is fine for these magnitudes but
// this makes it impossible to be wrong.
export const YAPPY_MAX_CENTS = 999_999 // $9,999.99 per transaction

export function centsToYappy(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0 || cents > YAPPY_MAX_CENTS) {
    throw new RangeError(`amount_out_of_range:${cents}`)
  }
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

export interface YappyAmounts {
  subtotal: string
  taxes: string
  shipping: string
  discount: string
  total: string
}

// E010 = "montos incorrectos": enforce the identity before Yappy sees it.
export function buildYappyAmounts(subtotalCents: number, taxCents: number): YappyAmounts {
  const shippingCents = 0
  const discountCents = 0
  const totalCents = subtotalCents + taxCents + shippingCents - discountCents
  if (subtotalCents < 1) throw new RangeError(`subtotal_out_of_range:${subtotalCents}`)
  if (totalCents < 1 || totalCents > YAPPY_MAX_CENTS) throw new RangeError(`total_out_of_range:${totalCents}`)
  return {
    subtotal: centsToYappy(subtotalCents),
    taxes: centsToYappy(taxCents),
    shipping: centsToYappy(shippingCents),
    discount: centsToYappy(discountCents),
    total: centsToYappy(totalCents),
  }
}

// ─── Hash ───────────────────────────────────────────────────────────────────
// Yappy signs the IPN as hex(HMAC-SHA256(orderId + status + domain)) keyed by
// the first '.'-separated segment of the base64-decoded secret.
function hmacKeyFromSecret(secretB64: string): string {
  const bytes = Uint8Array.from(atob(secretB64), (c) => c.charCodeAt(0))
  const decoded = new TextDecoder().decode(bytes)
  return decoded.split('.')[0]
}

export async function computeYappyHash(
  secretB64: string,
  orderId: string,
  status: string,
  domain: string,
): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(hmacKeyFromSecret(secretB64)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(orderId + status + domain)))
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function validateYappyHash(
  secretB64: string,
  orderId: string,
  status: string,
  domain: string,
  receivedHash: string | null | undefined,
): Promise<boolean> {
  let expected: string
  try {
    expected = await computeYappyHash(secretB64, orderId, status, domain)
  } catch {
    return false // malformed secret — never treat as valid
  }
  const received = (receivedHash ?? '').toLowerCase()
  if (received.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ received.charCodeAt(i)
  return diff === 0
}

// ─── HTTP ───────────────────────────────────────────────────────────────────
export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// payment-wc error codes → what the customer sees. Codes marked `ours` mean
// the request was malformed on our side; the customer gets a generic message.
export const YAPPY_ERROR_MESSAGES: Record<string, string> = {
  E002: 'Algo salió mal con Yappy. Intenta nuevamente.',
  E004: 'No pudimos iniciar el pago con Yappy. Intenta nuevamente o paga en entrega.',
  E005: 'Este número no tiene Yappy. Revisa el número o usa otro.',
  E006: 'Algo salió mal con Yappy. Intenta nuevamente.',
  E008: 'Algo salió mal con Yappy. Intenta nuevamente.',
  E010: 'No pudimos iniciar el pago con Yappy. Intenta nuevamente o paga en entrega.',
  E100: 'No pudimos iniciar el pago con Yappy. Intenta nuevamente o paga en entrega.',
}

export function yappyErrorMessage(code: string | null | undefined): string {
  return (code && YAPPY_ERROR_MESSAGES[code]) || 'No pudimos iniciar el pago con Yappy. Intenta nuevamente.'
}
