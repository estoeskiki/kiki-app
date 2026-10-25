// ============================================================================
// Edge Function: yappy-create
//
// Starts a Yappy Botón de Pago charge for a web cart (pay first, order later).
// The Kiki order is NOT created here — yappy-ipn creates it from the frozen
// snapshot once Yappy confirms the payment with status 'E'.
//
//   1. Price the cart server-side (_shared/pricing.ts), never trust amounts.
//   2. yappy_begin_payment: rate limits, one live attempt per phone/cart, and
//      the same cart asking again gets the same transaction back.
//   3. validate/merchant (fresh single-use token every attempt) → payment-wc.
//   4. Record the outcome: created / failed (Yappy said no, nothing charged)
//      / unknown (timeout or garbage from payment-wc — it may have charged,
//      so no automatic retry; yappy_attention surfaces it).
//
// Kept separate from yappy-ipn so a bad deploy here can never break the IPN.
// ============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2'
import { priceCart, type PriceCartBody } from '../_shared/pricing.ts'
import {
  buildYappyAmounts,
  fetchWithTimeout,
  getYappyConfig,
  yappyErrorMessage,
  type YappyEnv,
} from '../_shared/yappy.ts'

// Only the registered storefront domain (and local dev on any port) may call
// this. Defense in depth only — the table token + rate limits are the real
// gate; CORS doesn't stop a non-browser client.
const allowedOrigins = new Set(
  [Deno.env.get('YAPPY_UAT_DOMAIN'), Deno.env.get('YAPPY_PROD_DOMAIN')]
    .filter((o): o is string => !!o)
    .map((o) => o.trim().replace(/\/+$/, ''))
    // The storefront is also reachable as www.<domain>; Yappy itself only
    // ever sees the registered domain (it's sent server-side), so accepting
    // the www origin here is safe.
    .flatMap((o) => [o, o.replace(/^https:\/\/(?!www\.)/, 'https://www.')]),
)
const LOCAL_DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  const allowed = allowedOrigins.has(origin) || LOCAL_DEV_ORIGIN.test(origin)
  if (origin && !allowed) console.warn(`yappy-create: CORS origin not allowed: ${origin}`)
  return {
    ...(allowed ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Yappy wants the bare 8-digit Panamanian mobile, no +507, no dashes.
function normalizeAlias(raw: unknown): string | null {
  let digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('507')) digits = digits.slice(3)
  return /^\d{8}$/.test(digits) ? digits : null
}

interface CreateBody extends PriceCartBody {
  action?: 'create' | 'client_success'
  paymentId?: string
  checkoutKey: string
  aliasYappy: string
}

const BEGIN_ERRORS: Record<string, string> = {
  alias_busy: 'Ya hay un pago Yappy pendiente con este número. Confírmalo en tu app o espera unos minutos.',
  rate_limited: 'Demasiados intentos de pago. Espera unos minutos e intenta de nuevo.',
  yappy_unavailable: 'Yappy no está disponible en este momento. Puedes pagar en entrega.',
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  try {
    const body: CreateBody = await req.json()

    // The button's own success event — a hint for yappy_attention only.
    // It NEVER creates or confirms an order; only a hash-valid IPN does.
    if (body.action === 'client_success') {
      if (!body.paymentId || !UUID_RE.test(body.paymentId)) return json({ error: 'invalid_payment_id' }, 400)
      await supabaseAdmin
        .from('yappy_payments')
        .update({ client_reported_success_at: new Date().toISOString() })
        .eq('id', body.paymentId)
        .is('client_reported_success_at', null)
      return json({ ok: true })
    }

    const alias = normalizeAlias(body.aliasYappy)
    if (!alias) {
      return json({ error: 'invalid_alias', message: 'Ingresa tu número Yappy de 8 dígitos.' })
    }
    if (!body.checkoutKey || !UUID_RE.test(body.checkoutKey)) return json({ error: 'invalid_checkout_key' }, 400)
    if (!body.tableToken) return json({ error: 'invalid_table_token' }, 400)

    const { data: options } = await supabaseAdmin.rpc('get_payment_options', { p_table_token: body.tableToken })
    if (!options?.yappy) {
      return json({ error: 'yappy_unavailable', reason: options?.reason ?? null, message: BEGIN_ERRORS.yappy_unavailable })
    }

    const priced = await priceCart(supabaseAdmin, body)
    if (!priced.ok) return json(priced.body, priced.status)

    let amounts
    try {
      amounts = buildYappyAmounts(priced.subtotal, priced.tax)
    } catch (err) {
      return json({
        error: 'amount_out_of_range',
        message: 'El total debe estar entre $0.01 y $9,999.99 para pagar con Yappy.',
        detail: (err as Error).message,
      })
    }

    const forwardedFor = req.headers.get('x-forwarded-for')
    const clientIp = forwardedFor?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || null

    const { data: begin, error: beginError } = await supabaseAdmin.rpc('yappy_begin_payment', {
      p_food_court_id: priced.foodCourtId,
      p_table_id: priced.tableId,
      p_checkout_key: body.checkoutKey,
      p_alias: alias,
      p_client_ip: clientIp,
      p_subtotal_cents: priced.subtotal,
      p_tax_cents: priced.tax,
      p_total_cents: priced.total,
      p_snapshot: priced.snapshot,
    })
    if (beginError || !begin) {
      console.error('yappy_begin_payment failed', beginError)
      return json({ error: 'begin_failed' }, 500)
    }
    if (begin.error) {
      return json({ error: begin.error, message: BEGIN_ERRORS[begin.error] ?? BEGIN_ERRORS.yappy_unavailable })
    }

    // Same cart asked again (double tap, reload): same transaction, no new charge.
    if (begin.existing) {
      if (begin.status === 'created' && begin.transaction_id && begin.token && begin.document_name) {
        return json({
          paymentId: begin.payment_id,
          transactionId: begin.transaction_id,
          token: begin.token,
          documentName: begin.document_name,
          expiresAt: begin.expires_at,
          existing: true,
        })
      }
      return json({
        error: 'payment_in_progress',
        paymentId: begin.payment_id,
        message: 'Ya estamos procesando un pago para este pedido. Revisa tu app Yappy antes de intentar de nuevo.',
      })
    }

    const paymentId: string = begin.payment_id
    const markFailed = (code: string) => supabaseAdmin.rpc('yappy_mark_failed', { p_payment_id: paymentId, p_error_code: code })
    const markUnknown = (code: string) => supabaseAdmin.rpc('yappy_mark_unknown', { p_payment_id: paymentId, p_error_code: code })

    const config = getYappyConfig(begin.env as YappyEnv)
    if (!config) {
      console.error(`yappy config missing for env=${begin.env}`)
      await markFailed('CONFIG')
      return json({ error: 'yappy_unavailable', message: BEGIN_ERRORS.yappy_unavailable })
    }
    if (config.domain !== begin.domain) {
      console.error(`yappy domain mismatch: secret=${config.domain} merchant_row=${begin.domain}`)
      await markFailed('DOMAIN_MISMATCH')
      return json({ error: 'yappy_unavailable', message: BEGIN_ERRORS.yappy_unavailable })
    }

    // ── validate/merchant. Nothing is charged at this step, so any failure
    // (timeout included) is a clean 'failed'.
    let token: string
    let epochTime: number
    try {
      const res = await fetchWithTimeout(`${config.baseUrl}/payments/validate/merchant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId: config.merchantId, urlDomain: config.domain }),
      })
      const data = await res.json().catch(() => null)
      if (!data?.body?.token) {
        const code = data?.status?.code ?? `HTTP_${res.status}`
        console.error('yappy validate/merchant rejected', res.status, data?.status)
        await markFailed(`VALIDATE_${code}`)
        return json({ error: 'yappy_error', code, message: yappyErrorMessage(null) })
      }
      token = data.body.token
      epochTime = Number(data.body.epochTime)
    } catch (err) {
      console.error('yappy validate/merchant failed', err)
      await markFailed('VALIDATE_TIMEOUT')
      return json({ error: 'yappy_error', code: 'VALIDATE_TIMEOUT', message: yappyErrorMessage(null) })
    }

    // ── payment-wc. From here on a timeout is ambiguous: Yappy may have
    // created the charge. Record 'unknown' and do not retry automatically.
    const ipnUrl = Deno.env.get('YAPPY_IPN_URL') || `${Deno.env.get('SUPABASE_URL')}/functions/v1/yappy-ipn`
    const payload = {
      merchantId: config.merchantId,
      orderId: begin.yappy_order_id,
      domain: config.domain,
      paymentDate: epochTime,
      aliasYappy: alias,
      ipnUrl,
      ...amounts,
    }
    console.log('yappy payment-wc request', JSON.stringify({ orderId: payload.orderId, ...amounts, ipnUrl }))

    let res: Response
    try {
      res = await fetchWithTimeout(`${config.baseUrl}/payments/payment-wc`, {
        method: 'POST',
        // Raw token — Yappy rejects "Bearer <token>".
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify(payload),
        // Longer than validate's 8 s: UAT payment-wc was seen taking >8 s, and
        // every timeout here is an ambiguous 'unknown' a human must reconcile.
      }, 20000)
    } catch (err) {
      console.error('yappy payment-wc failed (unknown outcome)', err)
      await markUnknown('WC_TIMEOUT')
      return json({ error: 'payment_unknown', paymentId, message: 'No pudimos iniciar el pago. Revisa tu app Yappy antes de intentar de nuevo.' })
    }

    const text = await res.text()
    let data: any = null
    try {
      data = JSON.parse(text)
    } catch {
      // handled below
    }
    console.log('yappy payment-wc response', res.status, JSON.stringify(data?.status ?? text.slice(0, 200)))

    const tx = data?.body
    if (tx?.transactionId && tx?.token && tx?.documentName) {
      await supabaseAdmin.rpc('yappy_mark_created', {
        p_payment_id: paymentId,
        p_transaction_id: tx.transactionId,
        p_token: tx.token,
        p_document_name: tx.documentName,
      })
      return json({
        paymentId,
        transactionId: tx.transactionId,
        token: tx.token,
        documentName: tx.documentName,
        expiresAt: begin.expires_at,
      })
    }

    const code: string | undefined = data?.status?.code
    // A defined Yappy error code, or a 4xx with a readable body, is a clear
    // rejection: nothing was charged.
    if ((code && /^E\d{3}$/.test(code)) || (data && res.status >= 400 && res.status < 500)) {
      const errorCode = code ?? `HTTP_${res.status}`
      await markFailed(errorCode)
      return json({ error: 'yappy_error', code: errorCode, message: yappyErrorMessage(code) })
    }

    await markUnknown(code ?? `HTTP_${res.status}`)
    return json({ error: 'payment_unknown', paymentId, message: 'No pudimos iniciar el pago. Revisa tu app Yappy antes de intentar de nuevo.' })
  } catch (error: any) {
    console.error('yappy-create error:', error)
    return json({ error: error.message ?? 'unknown_error' }, 500)
  }
})
