// ============================================================================
// Realtime concurrency test — opens N concurrent Supabase Realtime connections,
// each subscribing to a restaurant's `menu-<restaurantId>` channel exactly like
// a customer with the menu open (StorefrontMenu.tsx). This is the load the
// per-viewer menu subscription puts on Realtime — the #1 scaling risk at
// 300–500 concurrent on Pro default compute (realtime connection cap).
//
// It measures: how many connections actually reach SUBSCRIBED, how long that
// takes, and how many error/time out. If subscribes start failing well below
// your target, that's the ceiling to fix (raise the quota, or drop/share the
// per-viewer channel).
//
// Run from a context that has @supabase/supabase-js installed, e.g.:
//   cd apps/order-web && \
//   BASE_URL=... SUPABASE_ANON_KEY=... CONNECTIONS=500 HOLD_SECONDS=120 \
//   node ../../loadtest/realtime.mjs
// ============================================================================
import { createClient } from '@supabase/supabase-js';

const BASE = process.env.BASE_URL || 'https://shmmbnvdtmqxmrlzpluh.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY;
if (!ANON) throw new Error('Set SUPABASE_ANON_KEY');

const CONNECTIONS = parseInt(process.env.CONNECTIONS || '500', 10);
const HOLD_SECONDS = parseInt(process.env.HOLD_SECONDS || '120', 10);
const RAMP_MS = parseInt(process.env.RAMP_MS || '20', 10); // delay between opens
const SUBSCRIBE_TIMEOUT_MS = parseInt(process.env.SUBSCRIBE_TIMEOUT_MS || '15000', 10);

const RESTAURANT_IDS = [
  'b2000000-0000-0000-0000-000000000001', // El Invernadero
  'b2000000-0000-0000-0000-000000000002', // Stadium Eats
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let subscribed = 0;
let failed = 0;
let timedOut = 0;
const subscribeTimes = [];
const clients = [];

function openOne(i) {
  const rid = RESTAURANT_IDS[i % RESTAURANT_IDS.length];
  const client = createClient(BASE, ANON, {
    realtime: { params: { eventsPerSecond: 1 } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  clients.push(client);

  const started = Date.now();
  return new Promise((resolve) => {
    let settled = false;
    const done = (outcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };

    const channel = client
      .channel(`menu-${rid}-vu${i}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items', filter: `restaurant_id=eq.${rid}` }, () => {})
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          subscribed++;
          subscribeTimes.push(Date.now() - started);
          done('subscribed');
        } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          failed++;
          done('failed');
        }
      });

    setTimeout(() => {
      if (!settled) {
        timedOut++;
        done('timeout');
      }
    }, SUBSCRIBE_TIMEOUT_MS);
  });
}

function pct(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

(async () => {
  console.log(`Opening ${CONNECTIONS} realtime connections (ramp ${RAMP_MS}ms) to ${BASE} ...`);
  const opens = [];
  for (let i = 0; i < CONNECTIONS; i++) {
    opens.push(openOne(i));
    await sleep(RAMP_MS);
    if ((i + 1) % 50 === 0) {
      console.log(`  opened ${i + 1}/${CONNECTIONS} | subscribed=${subscribed} failed=${failed} timeout=${timedOut}`);
    }
  }
  await Promise.all(opens);

  console.log('\n─── subscribe phase complete ───');
  console.log(`subscribed : ${subscribed}/${CONNECTIONS}`);
  console.log(`failed     : ${failed}`);
  console.log(`timed out  : ${timedOut}`);
  console.log(`subscribe ms  p50=${pct(subscribeTimes, 50)}  p95=${pct(subscribeTimes, 95)}  max=${pct(subscribeTimes, 100)}`);

  console.log(`\nHolding ${subscribed} connections for ${HOLD_SECONDS}s (watch Realtime metrics in the Supabase dashboard)...`);
  await sleep(HOLD_SECONDS * 1000);

  console.log('Tearing down...');
  for (const c of clients) {
    try { await c.removeAllChannels(); } catch { /* ignore */ }
  }
  console.log('Done.');
  process.exit(0);
})();
