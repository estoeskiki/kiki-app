# Kiki — Observability, Monitoring & Reliability Architecture

## Context

Kiki kiosks will operate at client restaurants as **mission-critical** equipment — if a kiosk goes down during lunch service, the client loses real money and trust in the product. Today the monorepo has **zero observability infrastructure**: no crash reporter, no error boundaries, no structured logs, no heartbeats, no uptime monitoring, no OTA updates, no remote command channel, no status page. Every `console.error` is lost the moment the kiosk reboots.

This plan designs a complete reliability stack: how you **detect** problems, **diagnose** them without touching the device, **notify** yourself fast, and **remediate** remotely (often without a truck roll). It is layered and incremental — you can ship Tier 1 in a week and ignore Tier 3 until you have 50+ kiosks.

**Goals**
- Know within < 60s if a kiosk stops functioning.
- Diagnose any crash or failed payment/print/order without SSH, logs-by-email, or phoning the client.
- Push JS fixes in < 15 min without Play Store review.
- Reboot/reset/reinstall kiosks remotely.
- Show clients a public status page to build trust during incidents.

---

## The decision (TL;DR)

If you read nothing else, build this:

- **Sentry** (Team) — crashes, replay, perf tracing. Covers native + JS.
- **PostHog** (free tier) — analytics, feature flags for canary rollouts, session replay as a secondary.
- **Local JSONL log files** on every kiosk (via `expo-file-system`) + `export_logs` remote command → uploads to Supabase Storage. 7-day on-device firehose, pulled on demand.
- **Supabase** (already in stack) — `kiosk_status`, `kiosk_heartbeats`, `kiosk_events`, `kiosk_commands`, `incidents`.
- **BetterStack** — HTTP uptime monitoring + public status page.
- **EAS Update** — OTA JS patches.
- **Twilio + Resend + Slack webhook** — alert transport.
- **Esper** (preferred over Hexnode if unsigned) — MDM for Android kiosks with programmatic API.

**Day-one total: ~$75/mo at 10 kiosks. ~$200/mo at 100 kiosks.**

**Defer until a real signal says otherwise:** Axiom, Sentry Logs add-on, PagerDuty, Grafana Cloud, Datadog, New Relic, Bugsnag, LaunchDarkly, Amplitude, Mixpanel. Each one either duplicates the above or is right for a 10× larger company.

### Non-negotiable architecture rules

1. **One choke point: `@kiki/logger`.** Nobody touches Sentry/PostHog SDKs directly. Rotating vendors later is a one-file change.
2. **Supabase = operational state; managed SaaS = diagnostic state.** Heartbeats/commands/events live in your DB. Crashes/replays live in Sentry. Clean line, don't mix.
3. **Local-first logs, cloud-pulled on demand.** No 24/7 log shipping. `export_logs(since=2h)` when needed.
4. **In-app remote commands over Supabase Realtime; OS-level actions via MDM.** Reload / clear cache / reprint / export logs → Realtime. Hard reboot / reinstall APK → Esper. Don't conflate.
5. **PostHog feature flags are the ONE canary mechanism.** Not ID-hashing, not env vars, not branches.
6. **Admin Fleet page is a product surface, not an internal tool.** You'll use it more than the kiosk app itself.
7. **SLO published day one:** 99.5% kiosk-hours during published service hours. Forces honesty.
8. **Runbooks written before the first P1, not after.**

The rest of this document is the reasoning and the rollout plan.

---

## The five pillars

```
┌────────────────────────────────────────────────────────────────┐
│ 1. INSTRUMENT   – what the kiosk reports (device-side SDK)     │
│ 2. INGEST       – where that data lives (managed + Supabase)   │
│ 3. VISUALIZE    – fleet dashboard + public status page         │
│ 4. ALERT        – who gets paged, when, how                    │
│ 5. REMEDIATE    – OTA + remote commands + MDM                  │
└────────────────────────────────────────────────────────────────┘
```

---

## Pillar 1 — Instrument (on-device)

All three React Native apps (kiosk, KDS, admin) plus Next.js admin-web get the same core SDKs, configured differently.

### 1a. Crash & performance + product analytics + feature flags

This is where vendor choice matters most. Two viable paths — pick one, then stop deliberating:

#### Option A (recommended for kiosks): **Sentry + PostHog**

Two SDKs, each doing what it's best at.

| Tool | Owns |
|---|---|
| **Sentry** | Native Android crashes (JVM + NDK), JS errors, perf tracing, release health |
| **PostHog** | Product analytics (funnels, drop-off), session replay, **feature flags** (canary rollouts), surveys, A/B tests |

Why two: kiosks will crash inside the **Senraise printer SDK** and the future **ECR payment SDK** — both native code. Sentry's RN SDK captures NDK/JVM crashes with symbolication and unifies them with the JS stack trace. PostHog's error tracking (added in 2024) is improving but is primarily JS-side; a crash in a native printer call is likely to appear as an opaque "app died" rather than a diagnosable stack. For a mission-critical kiosk, that gap is hard to accept.

Why PostHog is still mandatory in this option: my original plan had a gap — **product analytics** and **feature flags**. You'll want to answer questions like "what % of customers abandon at the payment screen?" and "roll out the new upsell UI to 10% of kiosks and compare order value" — those are PostHog's home turf, not Sentry's.

**Cost**: Sentry Team ~$26/mo + PostHog free tier (1M events, 5K replays / month) → $26/mo until PostHog volume exceeds free tier.

#### Option B (consolidated): **PostHog only**

One SDK, one dashboard, one bill. Covers: errors, session replay, analytics, feature flags, surveys. Generous free tier; self-hostable.

Accept these tradeoffs:
- Weaker native Android crash reporting — verify with a deliberate native crash before committing.
- Performance tracing / slow-query spans less mature than Sentry.
- Release-health dashboards (crash-free session % per app version) less polished.

If your kiosk stack stabilizes and native crashes become rare, Option B saves a vendor and reduces SDK overhead. If you're still integrating the ECR SDK or adjusting native printer code, Option A pays for itself the first time Sentry shows you an NDK stack trace.

**Decision posture**: start with Option A through Phase 1–4; re-evaluate after 3 months of prod data. Migrating *away* from Sentry later is cheap (you keep PostHog either way). Migrating *to* Sentry later is expensive (adding a second SDK, re-tagging events).

**What to instrument (either option):**
- Global `ErrorBoundary` at the root of each RN app (currently none exist).
- `Sentry.init` (if Option A) with `tracesSampleRate: 0.1` in prod, `1.0` in dev.
- `posthog.init` with session replay `sample_rate: 0.1`, `on_error: 1.0`.
- Tag every event with `kiosk_id`, `restaurant_id`, `app_version`, `location`. PostHog: `posthog.identify(kiosk_id, { ...props })` + `posthog.group('restaurant', restaurant_id)`.
- Breadcrumbs on: navigation changes, payment state transitions, printer calls, Supabase RPC calls.
- Capture PostHog events for every meaningful user action (`menu_viewed`, `item_added`, `checkout_started`, `payment_succeeded`, `order_completed`, `session_abandoned`) → funnel analysis comes free.

### 1b. Structured logging: a thin `@kiki/logger` package

Wrap everything. Replace every `console.log/error` with:

```ts
logger.info('order.submit.start', { orderId, items: items.length });
logger.error('payment.failed', { reason, terminalCode }, error);
```

The logger:
1. Echoes to `console` in dev.
2. Pushes breadcrumbs to Sentry (automatic context for any error).
3. For `error`/`fatal` level, emits a `Sentry.captureMessage` or `captureException`.
4. Batches `info`/`warn` into a ring buffer, flushes every 30s to **Axiom** (see Pillar 2) via a single HTTP POST — cheap, async, survives offline (retries from AsyncStorage).

This is ~150 LOC, lives at `packages/logger/`, shared across all apps. Keeps discipline: one event-naming convention (`domain.action.outcome`), one shape (`{ event, context, error? }`).

### 1c. Hardware & environment probes

Kiosks have physical dependencies that crash software "silently." Instrument each:

| Probe | What | How |
|---|---|---|
| **Network** | online? wifi vs ethernet vs cellular, RTT to Supabase | `@react-native-community/netinfo` + periodic ping |
| **Printer** | reachable? out of paper? | Call Senraise `getStatus()` every 60s + before each print |
| **POS terminal (ECR)** | socket open? last heartbeat from terminal? | TCP keepalive probe in native module |
| **Battery/UPS** | AC power present? battery pct? | Android `BatteryManager` — essential since kiosks plug into UPS |
| **Storage/memory** | free bytes, db size | `expo-file-system` + Supabase query |
| **KDS reachable** | can we see our pair? | Supabase query for the restaurant's KDS last_seen |
| **App uptime / crash loop** | seconds since app start | Boot hook; alert if < 60s and repeated |

### 1d. Heartbeat service

Every kiosk runs a `HeartbeatService` that every **30 seconds**:
1. Collects all probe readings + app version + OS version.
2. Calls Supabase RPC `kiosk_heartbeat(payload jsonb)`.
3. RPC appends to `kiosk_heartbeats` (time-series, 7-day TTL via pg_cron) AND upserts `kiosk_status` (current snapshot).

If the POST fails, queue locally and retry — a 3-minute wifi blip should not look like a down kiosk, but a 5-minute blip should.

### 1e. Global error boundary + crash persistence

Wrap root component with an `ErrorBoundary` that:
- Reports to Sentry.
- Shows a neutral "We'll be right back — order at the counter" screen (not a blank white).
- Auto-reloads the JS bundle after 30s (via `Updates.reloadAsync()`).
- Logs crash to local AsyncStorage so the *next* successful heartbeat reports "I crashed at X for reason Y."

---

## Pillar 2 — Ingest (backend)

Four destinations, each chosen for what it does best:

### 2a. Sentry (managed) — crashes, traces, replays

Managed SaaS. Team plan ~$26/mo covers reasonable kiosk volume; self-hostable if data residency matters for Panama. Retains 30–90 days depending on plan.

### 2b. Supabase — fleet state + events + command bus

This is the *operational* data layer, distinct from the *diagnostic* data layer (Sentry/Axiom). New tables:

```sql
-- hot current state (one row per kiosk, upserted)
kiosk_status (
  kiosk_id pk,
  last_seen_at,
  app_version, os_version,
  network_type, network_rtt_ms,
  battery_pct, on_ac_power,
  storage_free_bytes, memory_free_bytes,
  printer_status,        -- 'ok'|'disconnected'|'out_of_paper'|'error'
  pos_terminal_status,
  kds_reachable,
  uptime_seconds,
  derived_status         -- 'online'|'degraded'|'offline' (view)
)

-- time-series history (pg_cron deletes > 7d)
kiosk_heartbeats (bigserial, kiosk_id, recorded_at, payload jsonb)

-- important business events (30-90d retention)
kiosk_events (
  id, kiosk_id, restaurant_id,
  event_type,            -- 'payment.failed'|'print.failed'|'order.abandoned'|'auth.failed'|'crash'
  severity,              -- 'info'|'warn'|'error'|'critical'
  message, context jsonb,
  recorded_at
)

-- one row per unresolved problem (de-duped)
incidents (
  id, kiosk_id, kind, severity,
  opened_at, resolved_at,
  notified_at, notified_channels text[]
)

-- remote command channel (Realtime-driven)
kiosk_commands (
  id, kiosk_id,
  command,               -- 'reboot'|'clear_cache'|'reprint_last_receipt'|'force_sync'|'kill_session'
  args jsonb,
  status,                -- 'pending'|'acked'|'done'|'failed'|'expired'
  issued_by, issued_at, acked_at, completed_at
)
```

RLS on all tables: kiosks can only read/write their own rows; admin users scoped to their restaurant(s); SaaS operator (you) sees everything.

A Supabase Edge Function `detect-incidents` runs every 60s via pg_cron:
- If `kiosk_status.last_seen_at < now() - interval '2 min'` AND kiosk is "in service hours" → open an `incidents` row (kind=`kiosk_offline`) if none open.
- Same pattern for `printer_status='out_of_paper'`, repeated `payment.failed` events, etc.
- Newly opened incidents trigger Pillar 4 notifications.

### 2c. Axiom — high-volume structured logs

500 GB/month free tier, built for event streams. Receives the batched info/warn logs from `@kiki/logger`. This is where you grep "show me every `order.submit.failed` in the last 24h across all kiosks" — something Sentry is the wrong tool for. Alternatives: BetterStack Logs, Grafana Loki.

### 2d. BetterStack (Better Uptime + Logs + Status Page)

- External HTTP checks every 60s against: Supabase REST URL, Next.js admin-web `/api/health`, each edge function's health route.
- Maintains the **public status page** (kikipos.com/status or subdomain) — the thing you link clients to when they ask "is it you or us?"
- Schedules maintenance windows (hidden from SLO math).
- Free tier covers early stages; pro ~$29/mo.

### 2e. Built-in Supabase observability

Already free: Supabase dashboard → **Logs Explorer** (API, Postgres, Realtime, Auth, Edge Functions) via Logflare. Good enough for DB-side diagnosis without adding tools. Also enable **pg_stat_statements** for slow query finding.

### 2f. Log pipeline — what goes where

Three distinct log classes, each routed to the tool that makes it cheap and searchable. The `@kiki/logger` wrapper decides based on severity + event shape; callers don't think about it.

| Log class | Example | Destination | Retention | Why there |
|---|---|---|---|---|
| **Errors & crashes** | unhandled exception, `logger.error(...)`, native NDK crash | **Sentry** (auto) + `kiosk_events` row (severity=error) | Sentry 30–90d; events 90d | Stack traces + breadcrumbs + replay live with the error — one click to diagnose |
| **Business events** (audit + alerting) | `payment.failed`, `order.submitted`, `printer.out_of_paper`, `auth.device_bound` | **Supabase `kiosk_events`** table (primary) + mirrored to **PostHog** for funnels | events 90d; PostHog per plan | Drives Fleet-page timeline, incident detection, SLO math; must be queryable by kiosk/restaurant |
| **Diagnostic firehose** (info/debug) | RPC latency, probe readings, navigation trails | **Local JSONL files on-device** (primary, 7d) + pulled to Supabase Storage on demand via `export_logs` command | local 7d; uploaded zips 30d | Free, offline-resilient, queryable when you actually need it — no 24/7 shipping cost |
| **Server-side logs** (admin-web, edge functions) | Next.js stdout, edge function console | **Vercel/EAS Hosting logs** + forwarded to Axiom; edge functions → Supabase Logflare (free) | platform default | No extra pipeline needed for server; forward to Axiom only if you want unified search |

**Client-side routing** (what `@kiki/logger` does):

```
every call               →  appended to today's local JSONL file (always)
logger.fatal/error       →  Sentry.captureException  +  kiosk_events insert
logger.warn              →  Sentry breadcrumb         +  kiosk_events insert (if business-meaningful)
logger.event(name)       →  kiosk_events insert       +  PostHog.capture
logger.info / debug      →  local file only (+ Sentry breadcrumb ring, attached to next error)
```

**Heartbeat vs event separation:** heartbeats (every 30s, always-on, telemetry) go to `kiosk_heartbeats` and never to PostHog/Sentry — they'd drown the signal. Heartbeats are for the Fleet page and offline detection only.

### 2g. Local log storage — flat JSONL files

Every kiosk keeps its own 7-day log archive on-disk. This is the firehose; cloud destinations get only errors + business events.

**Format**: one JSON object per line, one file per calendar day, in the app's document directory:

```
documents/logs/
  logs-2026-04-12.jsonl   ← deleted when > 7 days old
  logs-2026-04-13.jsonl
  ...
  logs-2026-04-18.jsonl   ← today
```

Each line:

```json
{"ts":1713456789123,"level":"info","event":"order.submit.start","ctx":{"orderId":"..."}}
```

- **Rotation**: startup job deletes files > 7 days old. Size capped at ~50 MB total; oldest file dropped first if exceeded.
- **Crash safety**: worst case a partial last line; reader skips unparseable lines.
- **Retrieval**: `export_logs(since='2h')` remote command → kiosk zips matching files → uploads to Supabase Storage bucket `kiosk-logs/` → signed URL back to admin UI.

**Why flat files and not SQLite:** zero new dependencies (`expo-file-system` ships with Expo), ~100 LOC to implement, human-readable, JSONL is the format every ingestion tool already consumes. SQLite buys indexed on-device search — worth it only when you build an in-app log viewer with filters. Defer until then.

**Why not cloud blob storage as primary:** blob storage (Supabase Storage, S3) is a *destination*, not a local store. Offline = no writes = lost logs. And one HTTP call per log line is wasteful. Blob storage does have a role here — it's where `export_logs` uploads the zip when you actually want to read them.

**Offline resilience:** all four pipes handle offline independently:
- Sentry SDK — own native offline queue.
- PostHog SDK — own offline queue.
- `kiosk_events` inserts — in-memory ring buffer (500 rows), flush on reconnect, FIFO drop.
- Local log files — always work, zero network dependency.

**Privacy:** strip PII at the logger layer before it leaves the device — order totals fine, customer names/card data never. PostHog replay configured with `maskAllInputs: true` on any screen that touches payment. Local files stay on-device, so PII rules there are looser (they only leave via explicit `export_logs`).

**"Do I need cloud log storage (Axiom / Sentry Logs) at all?"** Honest answer: **no, not day one.** Local JSONL + on-demand pull covers 95% of debugging needs. Sentry breadcrumbs + Session Replay cover the "what happened just before this crash" need. Add Axiom/Sentry Logs only if you find yourself repeatedly wanting *live tail* — not just *historical pull* — across the whole fleet. That need rarely materializes for a kiosk fleet.

---

## Pillar 3 — Visualize

### 3a. Admin "Fleet" page (Next.js admin-web)

One page, realtime, owns your mornings:

```
┌────────────────────────────────────────────────────────┐
│  FLEET   ▲ 42 online    ● 2 degraded    ✕ 1 offline    │
├────────────────────────────────────────────────────────┤
│  [Sushi Ito – Costa del Este – K1]   ● online   5s ago │
│  ├─ printer OK   terminal OK   net WiFi -54dBm         │
│  └─ 3 orders in last hour                              │
│                                                        │
│  [Café Unido – Obarrio – K2]         ● degraded        │
│  ├─ printer OUT OF PAPER (since 14:22)                 │
│  └─ [Acknowledge] [Dispatch tech] [Silence 1h]         │
│                                                        │
│  [Pizza Artesa – Multiplaza – K3]    ✕ offline  8m ago │
│  ├─ last event: crash in PaymentScreen at 14:51        │
│  └─ [View Sentry] [Reboot] [Replay session]            │
└────────────────────────────────────────────────────────┘
```

Wired via Supabase Realtime subscription on `kiosk_status` — updates instantly. Each row links out to:
- Sentry (filtered by `kiosk_id` tag → crashes + session replay).
- Axiom (filtered by `kiosk_id` → raw logs).
- A timeline view of recent `kiosk_events`.
- Remote command buttons (Pillar 5).

### 3b. Public status page (BetterStack)

Customer-facing: "Kiki Kiosks — all systems operational." Incident history, scheduled maintenance. Auto-updates from BetterStack monitors. Link from every admin dashboard email footer and from the kiosk's own "we'll be right back" screen.

### 3c. Business-metric dashboard (later)

Grafana Cloud free tier, querying Supabase via a read-only role. Panels: orders/min per restaurant, payment success rate, avg print latency, % sessions crash-free. Skip until you have signal worth watching.

---

## Pillar 4 — Alert

Noisy alerts become background noise within a week. Three severity bands, three channels:

| Severity | Example | Channel | SLA |
|---|---|---|---|
| **P1** critical | Kiosk offline during published service hours; crash loop (> 3 crashes/5 min); payment terminal unreachable | **SMS + phone call** (Twilio) + Slack `#kiki-p1` + email | Ack < 5 min |
| **P2** degraded | Printer out of paper; elevated payment failure rate (> 10% over 10 min); slow Supabase latency (> 2s p95) | Slack `#kiki-p2` + email | Ack < 30 min during hours |
| **P3** info | New error type seen in Sentry; kiosk on cellular fallback; storage < 20% | Slack `#kiki-p3` (no page) | Best effort |

**Routing:**
- Sentry alerts by rule (issue frequency thresholds, new issue types, regression).
- `incidents` table → Edge Function `notify-incident` → routes by severity (Twilio / Resend / Slack webhook).
- BetterStack handles HTTP-check-based pages directly.

**Anti-noise rules:**
- Deduplicate: open one incident per `(kiosk_id, kind)`; further events annotate, don't re-page.
- Respect restaurant hours (no P2 pages at 3 AM for a lunch-only spot).
- Maintenance windows suppress all but P1.
- Flapping detection: require state to hold 2 min before opening/closing.

On-call: start with just you (edgaromarcaceres@gmail.com) + one escalation contact. PagerDuty/Opsgenie becomes worth it around 10+ kiosks; before that, Twilio SMS is enough.

---

## Pillar 5 — Remediate

Monitoring without remediation is anxiety-as-a-service. Three mechanisms, ordered from gentle to nuclear:

### 5a. EAS Update (OTA JS patches)

**Most important tool in the stack.** Fix a React bug, push, every kiosk pulls on next app launch (or hot-reloads if configured). No Play Store review, no truck rolls. Free with Expo.

- Two channels: `production` and `staging`.
- Canary a new release to 10% of kiosks using a **PostHog feature flag** (`ota.next_bundle_channel` gated by kiosk_id), watch crash-free rate for 24h, flip the flag to 100%. Much better than the ID-hash trick — you can target by restaurant, by region, or kill instantly without a republish.
- Keep the "rollback to previous bundle" action one click away in the admin UI.
- **Never OTA a native-code change** — those still need an EAS Build + Hexnode redeploy.

### 5b. Remote command channel (Supabase Realtime)

The `kiosk_commands` table from Pillar 2b, consumed by a service on each kiosk:
- `reboot` → schedules device restart via Android intent.
- `reload_app` → `Updates.reloadAsync()`.
- `clear_cache` → wipes local AsyncStorage queue (recovery from corrupt state).
- `reprint_last_receipt` → useful when the paper jammed mid-print.
- `force_sync` → re-pull menu from Supabase.
- `kill_session` → log out current customer/order (stuck screen).
- `enter_maintenance_mode` → show closed screen (so the restaurant can clean/update without you there).

All commands RLS-gated; all logged to `kiosk_events`; all have a 5-min `expires_at` so a disconnected kiosk doesn't execute a stale reboot when it reconnects.

### 5c. Hexnode MDM

Last line of defense for things only the OS can do:
- Full device reboot if the app itself is unresponsive (app can't reboot itself if frozen).
- Reinstall the APK from a known-good build.
- Lock device into kiosk mode (prevents staff from exiting to home screen).
- Remote view / remote control for live diagnosis.
- Wipe device.
- Push system updates.

Already in the project plan — this architecture slots around it.

---

## Supporting practices (non-technical)

Observability is a process, not just a stack.

- **SLO**: publish one — e.g. "99.5% of kiosk-hours during published service hours." Measure against it monthly. It forces honesty about whether your stack is actually working.
- **Runbooks**: one markdown file per alert kind — "Kiosk offline" → 5 concrete steps. Keep in `docs/runbooks/`.
- **Post-mortems**: every P1, a short blameless write-up (5 bullets: what happened, impact, root cause, fix, prevention). Store alongside runbooks.
- **Release checklist**: "before EAS Update push → crash-free rate > 99.5%, no P1 open, canary 24h done."
- **Client onboarding**: every new restaurant gets the status page URL and a single support contact. Keeps you from becoming a 24/7 hotline.

---

## Recommended third-party stack (final)

### Option A — Sentry + PostHog (recommended)

| Purpose | Tool | Plan | Monthly cost |
|---|---|---|---|
| Native + JS crashes, perf tracing | **Sentry** | Team | ~$26 |
| Product analytics, session replay, feature flags, surveys | **PostHog** | Free tier (1M events, 5K replays) | $0 |
| Uptime checks + public status page | **BetterStack** | Freelancer | ~$29 |
| Structured log search (optional) | **Axiom** | Free tier (500 GB) | $0 |
| OTA JS updates | **EAS Update** | Included with Expo | $0 |
| Alerting transport | **Twilio** (SMS) + **Resend** (email) | pay-per-use | ~$5–15 |
| Device management | **Hexnode** | per-device | already planned |
| Supabase-native logs | Supabase + Logflare | included | $0 |
| On-call rotation (later) | **PagerDuty** / Opsgenie | free tier OK | $0 |
| DB deep-dive (later) | **pganalyze** | optional | $0–149 |

**Essential monthly cost: ~$60/mo** until ~50 kiosks. Everything has a free tier — upgrade lazily.

### Option B — PostHog-only (consolidated)

Drop Sentry + Axiom. Use PostHog for errors, replay, analytics, flags, logs. Essential monthly cost falls to **~$35/mo**. Accept weaker native crash reporting as the tradeoff.

---

## Landscape — alternatives considered and why I didn't pick them

Most of these are great tools in the right context. Wrong context = wasted money or wasted integration time. Grouped by what slot they'd fill.

### All-in-one observability platforms

| Tool | Verdict for Kiki | Why |
|---|---|---|
| **Datadog** | Wrong stage | Best-in-class for enterprise (APM, logs, RUM, synthetics, SLOs, incident mgmt all unified). But pricing ramps brutally — easily **$500–5000/mo** for a kiosk fleet with logs ingested. React Native SDK exists but you pay per host, per GB, per user. Revisit at 200+ kiosks if you've outgrown the point-tool stack. |
| **New Relic** | Close runner-up | Generous free tier (100 GB/mo ingest, 1 user). Broader than Sentry, cheaper than Datadog. Weakest piece is mobile SDK quality. Viable alternative to the Sentry+PostHog split if you prefer one vendor over best-of-breed. |
| **Grafana Cloud** | DIY path | OSS stack: Loki (logs), Tempo (traces), Prometheus (metrics), Faro (RUM), OnCall. Good free tier. Powerful if you like assembling your own stack, and cheap at scale. Faro's RN support is newer than Sentry's. Pick this if you have an SRE mindset and want open-source lock-in escape hatch. |
| **Honeycomb** | Wrong shape | Optimized for high-cardinality backend debugging (BubbleUp, tracing). Overkill for a mostly-mobile stack. |
| **Dynatrace / AppDynamics / Splunk** | Enterprise only | Six-figure ACVs, heavy agents, sales-led. Not applicable. |

### Crash reporting (Sentry alternatives)

| Tool | Verdict | Why |
|---|---|---|
| **Firebase Crashlytics** | Cheap floor, low ceiling | Free, easy. But RN JS stacks are often poorly symbolicated, no session replay, no perf tracing of Supabase RPCs, no Next.js unification. Good as a fallback; not a primary. |
| **Bugsnag** (SmartBear) | Similar to Sentry | Solid RN support, similar pricing. Fewer adjacent features (no replay, no RUM, smaller ecosystem). Pick if you dislike Sentry's UX. |
| **Embrace** | Mobile-only | Session-based observability — records whole sessions as timelines. Excellent if you're mobile-first and have budget. Sales-led pricing, overkill for early stage. |
| **Instabug** | Too expensive | $249/mo start, bundles user feedback which kiosks don't need. |

### Product analytics / replay (PostHog alternatives)

| Tool | Verdict | Why |
|---|---|---|
| **Amplitude** | Great, but gaps | Best-in-class analytics. No session replay (partnership only), no feature flags — you'd need 2–3 tools where PostHog is 1. Free tier tightens fast. |
| **Mixpanel** | Same as Amplitude | 20M free events/mo. Same gap: no replay, no flags. |
| **Heap** | Web-first | Autocapture is magic on web, thin on RN. Skip for kiosks. |
| **LogRocket** | Replay-centric | Strong web replay + errors; RN support newer. Narrower than PostHog. |
| **Smartlook** | Replay-only | Strong RN SDK for replay specifically. Useful as a replay-only sidecar if you dislike PostHog's replay fidelity. |
| **LaunchDarkly** | Overkill for flags | Gold-standard feature flags. $$$. PostHog flags are more than enough at your scale. |
| **Unleash** / **Statsig** | Open source / indie flags | Viable if you want flags only. But then you're adding a tool PostHog already covers. |

### Uptime + status pages (BetterStack alternatives)

| Tool | Verdict | Why |
|---|---|---|
| **UptimeRobot** | Cheap | Basic, works. No integrated status page at the free tier. Fine if budget is zero. |
| **Checkly** | Code-as-monitor | Playwright scripts as uptime checks — excellent for admin-web + API synthetic flows. Pair with BetterStack for status page, or use their `$` tier. |
| **Healthchecks.io** | **Actually a good fit for heartbeats** | Purpose-built for "this thing should have pinged me by now" alerting. Free for 20 checks, open source. Strong alternative to running your own `detect-incidents` edge function for the offline-kiosk case. Worth considering as a second line of defense even if you keep BetterStack. |
| **StatusPage.io** (Atlassian) | Status page only | Premium, $29/mo. Good if you want that brand but not cheaper than BetterStack's bundle. |
| **Instatus** | Cheaper status page | Solid. But doesn't include uptime monitoring. |
| **Pingdom** | Legacy | Still fine. Nothing special. |

### Log management (Axiom alternatives)

| Tool | Verdict | Why |
|---|---|---|
| **BetterStack Logs** (Logtail) | Consolidation play | Same vendor as uptime — one invoice, one dashboard. Lower free tier than Axiom but simpler. |
| **Grafana Loki** | OSS path | Self-host or Grafana Cloud. Cheap at volume. Pair with Grafana dashboards. |
| **Datadog Logs** | Only if on DD | Expensive standalone. |
| **Elastic Cloud / Logz.io** | Heavy | Overkill for RN log volumes. |
| **Papertrail** | Legacy | Simple, works, dated UI. |

### On-call / alerting (my plan does manual Twilio+Slack)

| Tool | Verdict | Why |
|---|---|---|
| **PagerDuty** | Eventually yes | Industry standard. Escalations, on-call rotations, ack'ing from SMS. Free tier = 5 users. Revisit when you have a team. |
| **Opsgenie** (Atlassian) | Same as PD | If you're already in Atlassian, pick this. |
| **Grafana OnCall** | Free alternative | Bundled with Grafana Cloud free tier. Good if you're on Grafana already. |
| **incident.io** / **Rootly** / **FireHydrant** | Incident management | Runbook + timeline + post-mortem tooling. Worth it at 10+ incidents/month, not before. |

### MDM (Hexnode alternatives)

Worth a fresh look before locking in — some are purpose-built for **Android kiosks**, which Hexnode handles but doesn't specialize in.

| Tool | Verdict | Why |
|---|---|---|
| **Esper** | **Seriously consider over Hexnode** | Purpose-built for single-purpose Android devices (kiosks, POS, ruggedized). Remote control, scripted remediation, device APIs, fleet-wide scripting. Has a cloud SDK that lets your admin app programmatically reboot devices — cleaner than Hexnode's admin console. Pricing: $2–3/device/month. |
| **Scalefusion** | Solid alternative | Strong Android kiosk feature set. India-based, competitive pricing. |
| **SOTI MobiControl** | Enterprise | Deep, expensive, sales-led. |
| **Android Management API** | DIY | Google's free MDM API. You build the admin UI yourself. Viable if you want zero vendor fees and have the eng bandwidth — probably not now. |
| **Jamf / Kandji** | Wrong OS | Apple only. |

### What I'd actually re-evaluate

1. **Esper vs Hexnode** — if you haven't signed a Hexnode contract yet, do a side-by-side POC. Esper's programmatic API fits this architecture better (remote commands + scripted remediation from the admin app).
2. **Healthchecks.io** — add it as a second line of defense for the heartbeat→alert path, cheap insurance even with the Supabase-based detector.
3. **BetterStack Logs vs Axiom** — if you want fewer vendors, BetterStack Logs consolidates with your uptime/status page vendor. Marginal tradeoff.
4. **Grafana Cloud all-in-one** — only if you specifically want OSS and are comfortable piecing together Loki + Tempo + Faro. More ops overhead, more flexibility.

### When to revisit this decision

- **At ~50 kiosks**: re-evaluate if Sentry + PostHog + BetterStack is still cheaper than a consolidated platform. Probably still yes.
- **At ~200 kiosks or first enterprise client**: re-evaluate Datadog or New Relic if a single client requires SOC 2 / unified vendor for procurement.
- **If you raise a Series A and hire SREs**: Grafana Cloud OSS stack becomes attractive because engineers can extend it.

## Rollout roadmap

Incremental — each phase is shippable on its own and leaves you better off than before.

### Phase 1 — See crashes + analytics baseline (1 week)
1. Install Sentry (Option A) and/or PostHog in kiosk, KDS, admin, admin-web.
2. Add a root `ErrorBoundary` with auto-reload fallback.
3. Create `packages/logger/` and replace every `console.error` in critical paths (payment, order, printer, auth).
4. Tag all events with `kiosk_id`, `restaurant_id`, `app_version`; set PostHog group on `restaurant_id`.
5. Capture baseline PostHog funnel events (`menu_viewed` → `item_added` → `checkout_started` → `payment_succeeded` → `order_completed`).

**Outcome:** You stop finding out about crashes from angry WhatsApp messages.

### Phase 2 — Know kiosks exist (1 week)
1. Create `kiosk_status`, `kiosk_heartbeats`, `kiosk_events` tables + RLS.
2. Build `HeartbeatService` on-device (30s cadence, all probes).
3. Build Fleet page in admin-web wired to Supabase Realtime.
4. Set up BetterStack monitors on Supabase + admin-web + edge functions.
5. Publish a BetterStack status page.

**Outcome:** You (and your clients) can answer "is it working?" without calling anyone.

### Phase 3 — Respond fast (3–5 days)
1. `incidents` table + `detect-incidents` edge function (pg_cron, 60s).
2. `notify-incident` edge function → Twilio (P1) + Resend (P2/P3) + Slack.
3. Severity rules, dedup, flapping, maintenance windows.
4. Runbook for each alert kind.

**Outcome:** Problems page you within 2 minutes, not discovered next morning.

### Phase 4 — Fix fast (3–5 days)
1. Configure EAS Update with `staging`/`production` channels + canary flow.
2. `kiosk_commands` table + Realtime consumer + admin UI buttons.
3. Basic commands: `reload_app`, `reboot`, `clear_cache`, `reprint_last_receipt`.

**Outcome:** Most incidents resolved from your laptop.

### Phase 5 — Polish (ongoing)
- Axiom log pipeline.
- Session Replay on critical screens.
- Business-metric Grafana dashboards.
- SLO measurement + monthly review.
- pganalyze for DB performance.

---

## Critical files that will be touched / created

- `packages/logger/` — new shared logger package.
- `packages/observability/` — shared Sentry init + probes.
- [apps/kiosk/App.tsx](apps/kiosk/App.tsx) — wrap in ErrorBoundary + Sentry init + HeartbeatService.
- [apps/kiosk/src/services/posService.ts](apps/kiosk/src/services/posService.ts), [printerService.ts](apps/kiosk/src/services/printerService.ts), [orderService.ts](apps/kiosk/src/services/orderService.ts) — replace console.error with `logger.error` + emit `kiosk_events`.
- [apps/kiosk/src/lib/supabase.ts](apps/kiosk/src/lib/supabase.ts) — wrap with retry + event emission on failure.
- `apps/kiosk/src/services/heartbeatService.ts` — new.
- `apps/kiosk/src/services/probes/` — new (network, printer, pos, battery, storage).
- `apps/kiosk/src/services/commandConsumer.ts` — new (Realtime subscription).
- `apps/admin-web/app/fleet/page.tsx` — new Fleet dashboard.
- `apps/admin-web/app/api/health/route.ts` — new health endpoint for BetterStack.
- `supabase/migrations/NNN_observability.sql` — new tables, RLS, pg_cron jobs.
- `supabase/functions/detect-incidents/` — new.
- `supabase/functions/notify-incident/` — new.
- `eas.json` — add `update` channels.
- `docs/runbooks/*.md` — new, one per incident kind.

---

## Verification (how you know it works)

End-to-end smoke tests, done on a real device before calling Phase 1–4 done:

1. **Phase 1**: Force-throw in a component → confirm Sentry receives it with `kiosk_id` tag and a session replay.
2. **Phase 2**: Unplug the kiosk's WiFi → within 90s the Fleet page shows it offline; plug back → within 90s shows online.
3. **Phase 3**: Unplug a printer → receive SMS within 2 min labeled P2, Slack message arrives, `incidents` row opened. Plug in → incident auto-resolves.
4. **Phase 4**: From admin UI, click "Reload app" on a kiosk → app reloads within 5s, `kiosk_commands` row transitions pending → acked → done. Push a tagged EAS Update to `staging` behind a PostHog feature flag at 10% → verify only flagged kiosks pick it up; flip to 100%; flip off → rollback works.
5. **Status page**: Trigger BetterStack incident (pause a monitor) → public page flips red within 60s, subscribers get email.
6. **SLO sanity**: Query `kiosk_heartbeats` for the last 7 days per kiosk; confirm coverage > 99% for a kiosk that's been on.
