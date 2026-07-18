# kiki load test — launch readiness

Stress-tests the order-web critical path + Realtime against the **COS Sports
Plaza** food court (El Invernadero + Stadium Eats) on the live Supabase project.
Target: **300–500 concurrent, 20–60 orders/min**, Pro default compute.

> ⚠️ This runs against the **live launch project**. Run **off-hours**, and run
> `cleanup.sql` afterwards — every synthetic order is named `LOADTEST-...`.

## Prereqs

```bash
brew install k6                 # HTTP load
# realtime.mjs uses @supabase/supabase-js — run it from apps/order-web (already has it)
```

Env (the anon key is the **public** client key — same one shipped in the web app):

```bash
export BASE_URL="https://shmmbnvdtmqxmrlzpluh.supabase.co"
export SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobW1ibnZkdG1xeG1ybHpwbHVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDExMTcsImV4cCI6MjA5MDQ3NzExN30.TwmfK-tlvt_8JlTRHHnHLNXZ78_d3vENTG5Xs6kZvFY"
```

## 1. Smoke first (always)

```bash
PEAK_VUS=20 ORDER_RATE=0.2 k6 run loadtest/k6-browse-order.js
```

Confirm checks pass and a `LOADTEST-...` order appears in the admin app. Then scale up.

## 2. Full HTTP run (reads + writes, ~28 min)

```bash
PEAK_VUS=500 ORDER_RATE=1 k6 run loadtest/k6-browse-order.js
```

- `browse` scenario ramps 0 → 500 VUs (storefront RPC + fetchMenu), spikes to 800 for headroom.
- `orders` scenario holds ~1 order/sec (60/min) — create-web-order + status polling.
- Knobs: `PEAK_VUS`, `ORDER_RATE` (orders/sec), `FC_SLUG`.

**Pass thresholds (k6 exits non-zero if breached):**

| metric | target |
|---|---|
| storefront RPC p95 / p99 | < 400 / 800 ms |
| menu (categories+items) p95 / p99 | < 500 / 1000 ms |
| create-order p95 / p99 | < 1500 / 3000 ms |
| status poll p95 | < 300 ms |
| http_req_failed / order_errors | < 1% |

## 3. Realtime concurrency (the #1 risk)

Separate test — the per-viewer `menu-<restaurantId>` channel:

```bash
cd apps/order-web
CONNECTIONS=500 HOLD_SECONDS=120 node ../../loadtest/realtime.mjs
```

Watch how many reach `SUBSCRIBED`. If subscribes fail/timeout well under 500,
that's the Realtime connection ceiling on your plan — the fix is to raise the
quota **or** drop/share the per-viewer menu channel (menus rarely change
mid-service, so this is cheap to remove).

## 4. Soak (optional, catches leaks)

```bash
PEAK_VUS=100 ORDER_RATE=0.5 k6 run --duration 30m loadtest/k6-browse-order.js
```

## What to watch live (Supabase dashboard, during the run)

- **Database**: CPU %, memory, **active connections vs limit**, Supavisor pool saturation
- **Realtime**: concurrent connections + channels + messages/sec
- **Edge Functions** (`create-web-order`): invocations, errors, **boot time**, 540/546 (resource) counts
- Re-run **Advisors** (performance) mid/post

Terminals subscribe to orders/order_items realtime too — keep the admin app open
on a device during the run to confirm orders still stream in live under load.

## 5. Cleanup (required)

```bash
# preview + delete — see loadtest/cleanup.sql
psql "$DATABASE_URL" -f loadtest/cleanup.sql        # or run in the SQL editor
```

## Sizing method

1. Run at **current** Pro compute → find where p95/error thresholds break.
2. If it breaks below target, bump **compute add-on** (→ Medium) and re-run.
3. Pick the smallest tier that holds 500 concurrent + spike with margin.

## Known write-path serialization

`create-web-order` calls `next_order_number` (per-restaurant sequential
counter). Fine at 60/min, but it's the one lock on the write path — if
create-order p95 climbs with order rate (not VU count), that's the suspect.
