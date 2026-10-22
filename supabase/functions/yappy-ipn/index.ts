// ============================================================================
// Edge Function: yappy-ipn   (deploy with verify_jwt = false)
//
// Yappy's GET callback: ?orderId&hash&status&domain&confirmationNumber.
// Authentication is the HMAC hash, not a JWT. Must answer within 5 s.
//
//   1. Log the raw query, then store it in yappy_ipn_events. If that insert
//      fails the DB is down: answer 5xx so Yappy retries, and the console.log
//      line keeps the query recoverable from the function logs.
//   2. Unknown orderId, wrong domain or bad hash → 200 {success:false}, no
//      state change (event stays recorded with hash_valid = false).
//   3. Valid → yappy_apply_ipn() in one round trip: records the money and, on
//      'E', creates the Kiki order from the snapshot in the same transaction.
//
// Intentionally minimal: no pricing, no Yappy API calls, fast cold start.
// ============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2'
import { getYappyConfig, validateYappyHash, type YappyEnv } from '../_shared/yappy.ts'

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  const url = new URL(req.url)
  console.log(JSON.stringify({ yappy_ipn: url.search, method: req.method }))

  const p = url.searchParams
  const orderId = p.get('orderId') ?? p.get('orderid') ?? ''
  const status = p.get('status') ?? ''
  const hash = p.get('hash') ?? p.get('Hash') ?? ''
  const domain = p.get('domain') ?? ''
  const confirmationNumber = p.get('confirmationNumber') ?? null

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  try {
    const { data: event, error: eventError } = await supabaseAdmin
      .from('yappy_ipn_events')
      .insert({ raw_query: url.search || '(empty)', yappy_order_id: orderId || null, status: status || null })
      .select('id')
      .single()
    if (eventError || !event) {
      console.error('yappy-ipn: could not store event', eventError)
      return reply({ success: false }, 503)
    }
    const markEvent = (fields: Record<string, unknown>) =>
      supabaseAdmin.from('yappy_ipn_events').update(fields).eq('id', event.id)

    if (!orderId) {
      await markEvent({ outcome: 'missing_order_id' })
      return reply({ success: false })
    }

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('yappy_payments')
      .select('env')
      .eq('yappy_order_id', orderId)
      .maybeSingle()
    if (paymentError) {
      console.error('yappy-ipn: payment lookup failed', paymentError)
      return reply({ success: false }, 503)
    }
    if (!payment) {
      await markEvent({ outcome: 'unknown_order' })
      return reply({ success: false })
    }

    const config = getYappyConfig(payment.env as YappyEnv)
    if (!config) {
      console.error(`yappy-ipn: config missing for env=${payment.env}`)
      await markEvent({ outcome: 'config_missing' })
      return reply({ success: false }, 500)
    }

    if (domain !== config.domain) {
      await markEvent({ hash_valid: false, outcome: 'domain_mismatch' })
      return reply({ success: false })
    }
    if (!(await validateYappyHash(config.secret, orderId, status, domain, hash))) {
      await markEvent({ hash_valid: false, outcome: 'invalid_hash' })
      return reply({ success: false })
    }

    await markEvent({ hash_valid: true })
    const { data: applied, error: applyError } = await supabaseAdmin.rpc('yappy_apply_ipn', {
      p_yappy_order_id: orderId,
      p_status: status,
      p_confirmation: confirmationNumber,
      p_event_id: event.id,
    })
    if (applyError) {
      // Event is stored with hash_valid = true and no outcome → shows up in
      // yappy_attention as ipn_not_applied. 5xx lets Yappy retry meanwhile.
      console.error('yappy-ipn: apply failed', applyError)
      return reply({ success: false }, 500)
    }
    console.log('yappy-ipn applied', JSON.stringify({ orderId, status, outcome: applied?.outcome }))
    return reply({ success: true })
  } catch (error) {
    console.error('yappy-ipn error:', error)
    return reply({ success: false }, 500)
  }
})
