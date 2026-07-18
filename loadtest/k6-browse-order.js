// ============================================================================
// k6 load test — kiki order-web critical path against the COS Sports Plaza
// food court (El Invernadero + Stadium Eats).
//
// Simulates the real customer journey:
//   browse scenario  -> get_public_storefront RPC + fetchMenu (categories +
//                       nested menu_items) with think time
//   orders scenario  -> create-web-order edge function, then poll
//                       get_order_status_public a few times (order tracking)
//
// All synthetic orders are named "LOADTEST-..." so cleanup.sql can delete them.
//
// Run:  see loadtest/README.md  (needs BASE_URL + SUPABASE_ANON_KEY env vars)
// ============================================================================
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE = __ENV.BASE_URL || 'https://shmmbnvdtmqxmrlzpluh.supabase.co';
const ANON = __ENV.SUPABASE_ANON_KEY;
if (!ANON) throw new Error('Set SUPABASE_ANON_KEY env var');

// Knobs (override via env). Defaults target the ~300–500 concurrent launch peak.
const PEAK_VUS = parseInt(__ENV.PEAK_VUS || '500', 10);
const ORDER_RATE = parseFloat(__ENV.ORDER_RATE || '1'); // orders/sec (1 = 60/min)
const FOOD_COURT_SLUG = __ENV.FC_SLUG || 'cos-sports-plaza';

// Real, available, no-required-customization item ids per restaurant (queried
// from the DB — keeps create-web-order payloads valid with empty selections).
const RESTAURANTS = {
  'b2000000-0000-0000-0000-000000000001': [ // El Invernadero
    '1858315c-ef88-4aca-b5ec-14bdf1360e7f',
    'd2010000-0000-0000-0000-000000000102',
    'c59b5d6f-1bc1-46a0-b92f-fe1a373f77be',
    'd2010000-0000-0000-0000-000000000201',
    '7857cebd-5a97-426a-b3c4-836f41ef4f67',
    'df2e6115-1d28-4e65-ad0b-e84a91b463a2',
    'e029deb1-6f9f-4c46-9682-6d30303fb066',
    'bb09199a-49ee-4bcf-8d3d-ee5fdf22466d',
  ],
  'b2000000-0000-0000-0000-000000000002': [ // Stadium Eats
    'd2020000-0000-0000-0000-000000000408',
    'd2020000-0000-0000-0000-000000000407',
    'd2020000-0000-0000-0000-000000000104',
    'd2020000-0000-0000-0000-000000000304',
    'd2020000-0000-0000-0000-000000000101',
    'd2020000-0000-0000-0000-000000000401',
    'd2020000-0000-0000-0000-000000000402',
    'd2020000-0000-0000-0000-000000000405',
  ],
};
const RESTAURANT_IDS = Object.keys(RESTAURANTS);
const FOOD_COURT_ID = 'fc200000-0000-0000-0000-000000000001'; // COS Sports Plaza
// Fraction of orders that are food-court carts spanning BOTH restaurants
// (exercise the split-order path: one order -> N sub_orders).
const FC_ORDER_RATIO = parseFloat(__ENV.FC_ORDER_RATIO || '0.4');

const H = {
  headers: {
    apikey: ANON,
    Authorization: `Bearer ${ANON}`,
    'Content-Type': 'application/json',
  },
};

// Per-step latency so a slow menu read doesn't hide behind a fast RPC.
const storefrontT = new Trend('t_storefront', true);
const menuT = new Trend('t_menu', true);
const createOrderT = new Trend('t_create_order', true);        // single-restaurant
const createOrderFcT = new Trend('t_create_order_fc', true);   // food-court (split)
const statusT = new Trend('t_status', true);
const orderErrors = new Rate('order_errors');

const SMOKE = !!__ENV.SMOKE;

// SMOKE = fast sanity run (~90s): a few VUs + a couple of orders, so you can
// confirm the endpoints/payloads work and a LOADTEST order lands before
// committing to the full ~28m run.
const browseStages = SMOKE
  ? [
      { duration: '20s', target: 5 },
      { duration: '40s', target: 5 },
      { duration: '10s', target: 0 },
    ]
  : [
      { duration: '1m', target: 20 },
      { duration: '3m', target: Math.round(PEAK_VUS * 0.4) },
      { duration: '5m', target: Math.round(PEAK_VUS * 0.4) },
      { duration: '3m', target: PEAK_VUS },        // launch peak
      { duration: '10m', target: PEAK_VUS },
      { duration: '2m', target: Math.round(PEAK_VUS * 1.6) }, // spike / headroom
      { duration: '2m', target: PEAK_VUS },
      { duration: '2m', target: 0 },
    ];

export const options = {
  discardResponseBodies: false,
  scenarios: {
    // Reads: ramp up to the launch peak, hold, spike for headroom, recover.
    browse: {
      executor: 'ramping-vus',
      exec: 'browse',
      startVUs: 0,
      stages: browseStages,
      gracefulRampDown: '30s',
    },
    // Writes: steady arrival rate independent of browse VUs.
    orders: {
      executor: 'constant-arrival-rate',
      exec: 'placeOrder',
      rate: Math.max(1, Math.round(ORDER_RATE * 10)),
      timeUnit: '10s',
      duration: SMOKE ? '50s' : '28m',
      preAllocatedVUs: SMOKE ? 5 : 50,
      maxVUs: SMOKE ? 10 : 200,
      startTime: SMOKE ? '15s' : '4m', // let reads ramp first
    },
  },
  thresholds: {
    'http_req_failed': ['rate<0.01'],
    't_storefront': ['p(95)<400', 'p(99)<800'],
    't_menu': ['p(95)<500', 'p(99)<1000'],
    't_create_order': ['p(95)<1500', 'p(99)<3000'],
    't_create_order_fc': ['p(95)<2000', 'p(99)<3500'], // split-order does more work
    't_status': ['p(95)<300'],
    'order_errors': ['rate<0.01'],
  },
};

function pickRestaurant() {
  return RESTAURANT_IDS[randomIntBetween(0, RESTAURANT_IDS.length - 1)];
}

// ─── browse: storefront + menu ──────────────────────────────────────────────
export function browse() {
  group('storefront', () => {
    const res = http.post(
      `${BASE}/rest/v1/rpc/get_public_storefront`,
      JSON.stringify({ p_slug: FOOD_COURT_SLUG, p_table_token: null }),
      { ...H, tags: { step: 'storefront' } },
    );
    storefrontT.add(res.timings.duration);
    check(res, { 'storefront 200': (r) => r.status === 200 });
  });

  const rid = pickRestaurant();
  group('menu', () => {
    const cats = http.get(
      `${BASE}/rest/v1/categories?select=*&restaurant_id=eq.${rid}&order=sort_order`,
      { ...H, tags: { step: 'categories' } },
    );
    const items = http.get(
      `${BASE}/rest/v1/menu_items?select=*,customization_groups(*,customization_options(*))&restaurant_id=eq.${rid}&available=eq.true&order=sort_order`,
      { ...H, tags: { step: 'menu_items' } },
    );
    menuT.add(cats.timings.duration + items.timings.duration);
    check(cats, { 'categories 200': (r) => r.status === 200 });
    check(items, { 'menu_items 200': (r) => r.status === 200 && (r.json() || []).length > 0 });
  });

  sleep(randomIntBetween(3, 8)); // browsing the menu
}

// ─── placeOrder: create + track ─────────────────────────────────────────────
// A fraction (FC_ORDER_RATIO) are food-court carts spanning BOTH restaurants —
// these send foodCourtId + per-item restaurantId and create N sub_orders,
// exercising the split-order path. The rest are single-restaurant orders.
export function placeOrder() {
  const isFoodCourt = Math.random() < FC_ORDER_RATIO;
  let body;

  if (isFoodCourt) {
    const items = [];
    for (const rid of RESTAURANT_IDS) {
      const pool = RESTAURANTS[rid];
      const n = randomIntBetween(1, 2);
      for (let i = 0; i < n; i++) {
        items.push({
          menuItemId: pool[randomIntBetween(0, pool.length - 1)],
          restaurantId: rid, // required per item in food-court mode
          quantity: randomIntBetween(1, 2),
          selectedOptionIds: [],
        });
      }
    }
    body = {
      foodCourtId: FOOD_COURT_ID,
      orderType: 'takeaway',
      paymentMethod: 'card_on_delivery',
      customerName: `LOADTEST-FC-${__VU}-${__ITER}`,
      items,
    };
  } else {
    const rid = pickRestaurant();
    const pool = RESTAURANTS[rid];
    const n = randomIntBetween(1, 3);
    const items = [];
    for (let i = 0; i < n; i++) {
      items.push({
        menuItemId: pool[randomIntBetween(0, pool.length - 1)],
        quantity: randomIntBetween(1, 2),
        selectedOptionIds: [],
      });
    }
    body = {
      restaurantId: rid,
      orderType: 'takeaway',
      paymentMethod: 'card_on_delivery', // pay-at-counter: web only creates the order
      customerName: `LOADTEST-${__VU}-${__ITER}`,
      items,
    };
  }

  const res = http.post(`${BASE}/functions/v1/create-web-order`, JSON.stringify(body), {
    ...H,
    tags: { step: 'create_order', kind: isFoodCourt ? 'foodcourt' : 'single' },
  });
  (isFoodCourt ? createOrderFcT : createOrderT).add(res.timings.duration);
  const ok = check(res, {
    'create_order 200': (r) => r.status === 200,
    'create_order has id': (r) => !!(r.json() && r.json('orderId')),
  });
  orderErrors.add(!ok);
  if (!ok) return;

  const orderId = res.json('orderId');
  // Order tracking page polls every 5s — simulate a few polls.
  for (let p = 0; p < 3; p++) {
    sleep(5);
    const st = http.post(
      `${BASE}/rest/v1/rpc/get_order_status_public`,
      JSON.stringify({ p_order_id: orderId }),
      { ...H, tags: { step: 'status' } },
    );
    statusT.add(st.timings.duration);
    check(st, { 'status 200': (r) => r.status === 200 });
  }
}
