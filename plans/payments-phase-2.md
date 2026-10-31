# Plan: Payments phase 2 — implementation handover

Status: **ready for implementation** · Written 2026-10-30 · Owner: Edgar
Design (the "what"): `plans/payments-architecture.md` (rev 4+). Tests (the "proof"): `plans/payments-test-matrix.md`.
Previous phase evidence: `plans/yappy-test-plan.md` §8 (Yappy UAT on the old code, all passed).

This document is the "how": an ordered list of steps an engineer/agent can execute one by one. Each step has its
goal, the files to touch, the exact contract, the checks that prove it is done, and how to roll it back.

---

## 0. Read this first (rules for whoever implements this)

### 0.1 Read before writing code
1. `plans/payments-architecture.md` — sections 1–7 and the decisions log (section 10). Everything here follows it;
   if something here contradicts it, stop and ask Edgar.
2. `plans/payments-test-matrix.md` — the fixture world and cell IDs. Phase 2 must make the L1 layers pass.
3. The current code this replaces (all of it is read in step S0):
   `supabase/migrations/049_yappy_payments.sql`, `050_yappy_shorter_grace.sql`,
   `supabase/functions/yappy-create/index.ts`, `yappy-ipn/index.ts`, `_shared/yappy.ts`, `_shared/pricing.ts`,
   `_shared/yappy.test.ts`, `supabase/functions/create-web-order/index.ts`,
   `apps/order-web/app/checkout/page.tsx`, `apps/order-web/lib/yappy.ts`,
   `apps/order-web/components/checkout/{YappyButton,YappyWaitingOverlay}.tsx`,
   `apps/kiosk/src/services/orderApi.ts`, `apps/kiosk/src/screens/CheckoutScreen.tsx`,
   `apps/kiosk/src/store/useAuthStore.ts`.
4. `apps/order-web/AGENTS.md` and `apps/admin-web/AGENTS.md`: **"This is NOT the Next.js you know"** — read the
   relevant guide in `node_modules/next/dist/docs/` before writing any Next.js code.

### 0.2 Environment
| thing | value |
|---|---|
| Supabase project | ref `shmmbnvdtmqxmrlzpluh` (eu-central-1). There is **one** project: it is production. |
| Migrations | files in `supabase/migrations/NNN_name.sql`, applied with the Supabase MCP `apply_migration` (name = file name without `.sql`). Next free number: **051**. |
| Edge Functions | deployed with the Supabase MCP `deploy_edge_function`. Webhooks deploy with `verify_jwt: false`; everything else `verify_jwt: true`. Before redeploying an existing function, save its live source with `get_edge_function` (rollback copy). |
| Edge secrets | set **by Edgar** in the Supabase dashboard (Project Settings → Edge Functions → Secrets). Never ask for a secret value in chat, never write one in git, never use `create_edge_function_secret` with a real value. |
| order-web / admin-web | Next.js on Vercel. Production (order.estoeskiki.com) deploys from `main`; branches get preview URLs. |
| admin (POS) / kiosk | Expo apps with EAS Update. OTA: `cd apps/<app> && eas update --branch preview --message "…"` (runtime `1.0.0`, policy `appVersion`). JS-only changes only; any native dependency change needs a new build — stop and ask. |
| Live payment venue | Plaza Mayor Food Hall `fc000000-0000-0000-0000-000000000001`, Yappy **UAT** merchant, test URL https://order.estoeskiki.com/t/13ce08bf3c526920f71a7540 |
| Yappy UAT hours | Mon–Fri 07:00–18:30 America/Panama. Outside them Yappy is hidden (by design). |
| Other live venue | **COS Sports Plaza** uses kiosk + web with pay-later. Its order path (`create-web-order`) must keep working at every step. |

### 0.3 Conventions (match the existing code)
- Amounts are integer **cents** everywhere; convert to Yappy's `"5.35"` only at the adapter boundary.
- SQL functions: `SECURITY DEFINER`, `SET search_path TO 'public'`, `REVOKE ALL … FROM PUBLIC, anon, authenticated`,
  then `GRANT EXECUTE` only to who needs it (usually `service_role`). Tables: RLS on + `…_no_access` policy for
  `anon, authenticated` + `REVOKE ALL` (the "035 convention", see 049 §4).
- Return `jsonb` with `{"error": "<code>"}` instead of raising when a refusal must still commit side effects (049 does
  this for the circuit breaker).
- Comment style: a header block per migration/function explaining *why*, like 049 and `yappy-create`.
- Customer-facing strings are Spanish (Panama). Error codes are English snake_case.
- Edge Functions use `npm:@supabase/supabase-js@2` and `Deno.serve`. Shared modules avoid Deno globals at module
  scope so `node --experimental-strip-types --test` can import them (see `_shared/yappy.ts` header).
- Commits: Conventional Commits, one step per commit where possible. Work on branch `feat/payments-phase-2`
  (from `main`), merged by PR.

### 0.4 Safety rules
- **Additive first.** No step drops or renames `yappy_*` objects until step S16. Old and new paths run side by side.
- **No real money.** Phase 2 uses only the Yappy UAT merchant. Production credentials are phase 2b.
- **COS smoke test** after every deploy that touches `create-web-order`, the kiosk app or order-web checkout:
  one kiosk order and one web order at COS (or ask Edgar to do it), then confirm they appear in the POS.
- **Stop and ask Edgar** when: a step needs a secret; a migration would touch existing order rows outside S14; a
  native app build is needed; a test in the matrix can't pass as specified; anything contradicts the architecture
  plan; you'd need to deploy outside the order in section 3.

### 0.5 Definition of done (phase 2)
1. All steps S0–S15 done and merged; S16 scheduled.
2. `supabase/tests/payments_matrix_test.sql` passes every L1 cell listed in section 4.
3. Node tests pass: `node --experimental-strip-types --test supabase/functions/_shared/payments/*.test.ts`.
4. Yappy UAT T1 (E), T2 (C), T3 (X), T4 (bad hash), T5 (replayed IPN) pass again **through `payment-create` /
   `payment-webhook`**, results recorded in section 6 of this file.
5. COS kiosk + web orders work; POS shows correct labels and PAGADO / POR COBRAR chips.
6. `YAPPY_UAT_SECRET` no longer read by any deployed function (the encrypted DB copy is used).

---

## 1. Scope

### In phase 2
- Schema: `food_courts.payment_mode`, `payment_methods`, `payment_providers`, `payment_accounts`,
  `payment_account_secrets`, `payment_method_settings`, `payment_config_audit`, `payments`, `payment_events`,
  `payment_attention` (view), `payment_terminals` (table only, unused until phase 4).
- DB constraints and triggers from architecture §4.3 (redirection-proof).
- Owner / method resolution in SQL, **fully generic** (venue, per_restaurant, standalone, restaurant kiosks,
  fallback) — it is pure data logic and is tested at L1 for every context in the matrix.
- Envelope encryption of merchant secrets (`_shared/payments/crypto.ts`), KEK in Edge secrets.
- Provider adapter interface + **Yappy adapter** (moved from `_shared/yappy.ts`).
- Edge Functions: `payment-create`, `payment-webhook` (provider in the path), `payment-admin` (**platform admins
  only** in phase 2; restaurant / food court roles arrive with the admin UI in phase 3).
- `create-web-order`: method must be enabled for the owner + channel; legacy method codes mapped; **kiosk identity
  taken from the JWT, not from the request body**; per_restaurant cart rule enforced server-side.
- order-web checkout and kiosk checkout render exactly the methods `resolve_payment_options` returns.
- New `payment_method` codes on orders (`yappy_on_delivery`, `cash_counter`, …) + labels in POS, printer,
  admin-web; backfill of existing order rows.
- The UAT follow-ups:
  1. Yappy alias must match `^6\d{7}$` (client + server) and `YAPPY-004` gets a clear message.
  2. Per-alias rate limit counts only attempts that did **not** end `executed`.
  3. Waiting overlay ends immediately when the Yappy button reports `DENIED` / `CANCELLED`, plus a "Cancelar"
     link; server records a client-reported cancel and frees the alias.
- Data move: Plaza Mayor's Yappy UAT merchant → a Kiki-owned `payment_accounts` row; history of `yappy_*` rows
  copied into `payments` / `payment_events`.

### Not in phase 2 (later phases — do not build)
- Admin UI for merchants / method settings (phase 3, spec: `plans/payments-onboarding.md`; its backend pieces —
  adapter `fields` / `testCredentials`, `onboard_account`, `describe_*`, `last_test_*` — **are** in phase 2). In phase 2 configuration is done by migration seeds and
  `payment-admin` calls from a platform admin.
- per_restaurant cart enforcement **in the UI** (phase 3). Server-side enforcement *is* in phase 2.
- Restaurant-owned merchants in use, Yappy on kiosk, `card_present` terminals, card gateway / wallet adapters.
  (Schema and resolution support them; nothing is configured to use them.)
- Refund APIs, payout reports, notifications/alerts beyond the attention view.
- Production Yappy credentials (phase 2b).

---

## 2. Current state (verified 2026-10-30)

| area | today |
|---|---|
| Yappy pay-first | `yappy_merchants` (one row: Plaza Mayor, `uat`, domain `https://order.estoeskiki.com`), `yappy_payments`, `yappy_ipn_events`, view `yappy_attention`, functions `yappy_begin_payment` (050 version: stale expiry at 5:30), `yappy_mark_created/failed/unknown`, `yappy_apply_ipn`, `get_payment_options(p_table_token)`, `get_yappy_payment_status`, `get_yappy_attention`. 13 test payment rows, 15 IPN events, all `resolved_at` set. |
| Yappy credentials | Edge secrets `YAPPY_UAT_MERCHANT_ID`, `YAPPY_UAT_SECRET`, `YAPPY_UAT_BASE_URL`, `YAPPY_UAT_DOMAIN`; optional `YAPPY_IPN_URL`. |
| Order method codes | `orders/sub_orders.payment_method` CHECK `IN ('yappy','cash_on_delivery','card_on_delivery')`; `payment_status IN ('pending','paid','failed')`. `'yappy'` is ambiguous: unpaid = Yappy en entrega (create-web-order), paid = pay-first (049). |
| Web checkout | `apps/order-web/app/checkout/page.tsx`: hard-coded list `['yappy','card_on_delivery']`; Yappy becomes "pagas ahora" when `get_payment_options` says `yappy: true`. |
| Kiosk checkout | `apps/kiosk/src/screens/CheckoutScreen.tsx`: hard-coded `['yappy','card_on_delivery']`, submits through `create-web-order` with `channel:'kiosk'` and `restaurantId`/`foodCourtId` **taken from the device store and trusted by the server**. |
| Kiosk identity | `authenticate_device(token)` signs the kiosk in anonymously and inserts a membership: `food_court_members(role='kiosk_device')` for food court kiosks, `org_members(role='kiosk_device', restaurant_id)` for restaurant kiosks. The membership does **not** record which `device_tokens` row. `device_tokens` has either `restaurant_id` or `food_court_id`. |
| Restaurants | `restaurants.food_court_id` null = standalone (today only "Kiki Malasaña"). |
| Tables | `tables` has `restaurant_id` **or** `food_court_id`, `qr_token`. `_shared/pricing.ts` `priceCart` only accepts food-court tables (Yappy-only today). |
| POS labels | `apps/admin/src/utils/orderLabels.ts`, `apps/admin/src/services/printerService.ts`, `apps/admin/src/data/types.ts`; admin-web `app/(dashboard)/orders/[orderId]/page.tsx` (`PAYMENT_METHOD_LABEL`). KDS does not use payment fields. |
| Tests | `supabase/tests/049_yappy_payments_test.sql` (rolled-back DO block pattern), `supabase/functions/_shared/yappy.test.ts` (node test runner). |

---

## 3. Steps

Order matters: each step leaves production working. The deploy order is summarised in section 5.

### S0 — Branch, baseline, rollback copies
1. `git checkout main && git pull && git checkout -b feat/payments-phase-2`.
2. Run the existing tests and note the results:
   - `node --experimental-strip-types --test supabase/functions/_shared/yappy.test.ts`
   - (optional) `supabase/tests/049_yappy_payments_test.sql` — note its header: it expects to run right after the
     049 body; skip it if it no longer applies cleanly.
3. Save live sources (MCP `get_edge_function`) of `create-web-order`, `yappy-create`, `yappy-ipn` into
   `/tmp`-style scratch (not git) so each can be redeployed as-is.
4. Record current row counts: `select count(*) from orders/sub_orders group by payment_method, payment_status`.

Done when: branch exists, baseline results written in section 6.

---

### S1 — Migration `051_payment_config.sql` (reference data + configuration, additive)

Creates the configuration side. No existing object changes except one new column on `food_courts`.

```sql
-- food court mode (architecture §2)
ALTER TABLE public.food_courts
  ADD COLUMN payment_mode text NOT NULL DEFAULT 'venue'
  CHECK (payment_mode IN ('venue', 'per_restaurant'));

-- catalog of methods (architecture §3.1) — seeded here, changed only by migrations
CREATE TABLE public.payment_methods (
  code              text PRIMARY KEY,
  label_es          text NOT NULL,
  kind              text NOT NULL CHECK (kind IN ('pay_first', 'pay_later')),
  allowed_channels  text[] NOT NULL CHECK (allowed_channels <@ ARRAY['web','kiosk']::text[]),
  needs_account     boolean NOT NULL,
  sort_order        int NOT NULL
);
INSERT INTO public.payment_methods VALUES
  ('card_online',       'Tarjeta',                'pay_first', '{web}',       true,  10),
  ('wallet',            'Apple Pay / Google Pay', 'pay_first', '{web}',       true,  20),
  ('yappy',             'Yappy',                  'pay_first', '{web,kiosk}', true,  30),
  ('card_present',      'Tarjeta (datáfono)',     'pay_first', '{kiosk}',     true,  40),
  ('cash_counter',      'Efectivo en caja',       'pay_later', '{web,kiosk}', false, 50),
  ('yappy_on_delivery', 'Yappy en entrega',       'pay_later', '{web,kiosk}', false, 60),
  ('card_on_delivery',  'Tarjeta en entrega',     'pay_later', '{web,kiosk}', false, 70);

-- providers (mirrors the adapter registry; a node test asserts they agree)
CREATE TABLE public.payment_providers (
  code     text PRIMARY KEY,
  methods  text[] NOT NULL
);
INSERT INTO public.payment_providers VALUES
  ('yappy',        '{yappy}'),
  ('bg_ecr',       '{card_present}'),
  ('banistmo_ecr', '{card_present}');
-- the card gateway row is added in phase 5 when the gateway is chosen

-- merchants (architecture §5 payment_accounts)
CREATE TABLE public.payment_accounts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider         text NOT NULL REFERENCES public.payment_providers(code),
  env              text NOT NULL CHECK (env IN ('uat', 'prod')),
  display_name     text NOT NULL,
  restaurant_id    uuid REFERENCES public.restaurants(id) ON DELETE RESTRICT,
  food_court_id    uuid REFERENCES public.food_courts(id) ON DELETE RESTRICT,
  config           jsonb NOT NULL DEFAULT '{}'::jsonb,   -- non-secret, validated by the adapter
  enabled          boolean NOT NULL DEFAULT true,
  last_test_at       timestamptz,   -- credential test (payment-admin test_account), plans/payments-onboarding.md 5.3
  last_test_ok       boolean,
  last_test_error    text,          -- readable message only, never raw provider bodies
  last_test_version  int,           -- secret version tested; stale when < active version
  disabled_reason  text,
  disabled_at      timestamptz,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(restaurant_id, food_court_id) <= 1)   -- neither = Kiki-owned
);

-- envelope-encrypted secrets (architecture §4.4)
CREATE TABLE public.payment_account_secrets (
  account_id   uuid NOT NULL REFERENCES public.payment_accounts(id) ON DELETE CASCADE,
  version      int  NOT NULL CHECK (version >= 1),
  ciphertext   text NOT NULL,          -- base64 AES-256-GCM output (includes the tag)
  nonce        text NOT NULL,          -- base64 12-byte IV
  kek_version  int  NOT NULL,
  state        text NOT NULL CHECK (state IN ('active', 'retired', 'revoked')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  retired_at   timestamptz,
  PRIMARY KEY (account_id, version)
);
CREATE UNIQUE INDEX payment_account_secrets_one_active
  ON public.payment_account_secrets (account_id) WHERE state = 'active';

-- who offers what, where, collected by whom (architecture §3.2)
CREATE TABLE public.payment_method_settings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  food_court_id  uuid REFERENCES public.food_courts(id) ON DELETE CASCADE,
  restaurant_id  uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  method         text NOT NULL REFERENCES public.payment_methods(code),
  channels       text[] NOT NULL CHECK (cardinality(channels) >= 1),
  account_id     uuid REFERENCES public.payment_accounts(id) ON DELETE RESTRICT,
  sort_order     int,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(food_court_id, restaurant_id) = 1)
);
CREATE UNIQUE INDEX payment_method_settings_fc  ON public.payment_method_settings (food_court_id, method) WHERE food_court_id IS NOT NULL;
CREATE UNIQUE INDEX payment_method_settings_rst ON public.payment_method_settings (restaurant_id, method) WHERE restaurant_id IS NOT NULL;

-- terminals: schema only, used in phase 4
CREATE TABLE public.payment_terminals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid NOT NULL REFERENCES public.payment_accounts(id) ON DELETE RESTRICT,
  device_id      uuid NOT NULL UNIQUE REFERENCES public.device_tokens(id) ON DELETE CASCADE,
  terminal_ref   text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- audit (architecture §5 payment_config_audit)
CREATE TABLE public.payment_config_audit (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name  text NOT NULL,
  row_pk      text NOT NULL,
  action      text NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  actor       uuid,                -- auth.uid() or the id payment-admin passes via set_config
  before      jsonb,
  after       jsonb,
  at          timestamptz NOT NULL DEFAULT now()
);
```

**Triggers (same migration):**
1. `update_updated_at()` on `payment_accounts`, `payment_method_settings` (existing helper).
2. `payment_settings_guard()` — `BEFORE INSERT OR UPDATE ON payment_method_settings`, raises
   `check_violation` with a specific message for each rule (these are tests H-1…H-9 and A-FB-4/5):
   - load the method row; `channels <@ method.allowed_channels` else `channel_not_allowed`.
   - `pay_later` ⇒ `account_id IS NULL` else `pay_later_has_account`.
   - restaurant-owned row:
     - restaurant standalone (`food_court_id IS NULL`) or its food court is `per_restaurant` ⇒ any channels;
     - its food court is `venue` ⇒ `channels = '{kiosk}'` else `venue_restaurant_web_setting`;
     - `account_id` not null ⇒ account's `restaurant_id` = this restaurant else `account_not_owned`;
     - `account_id` null and method is `pay_first` ⇒ allowed **only** if restaurant is in a `venue` food court and
       method ≠ `card_present` (the fallback, architecture §2.1) else `pay_first_needs_account`.
   - food-court-owned row:
     - food court must be `venue` else `food_court_setting_not_venue`;
     - `pay_first` ⇒ `account_id` not null else `pay_first_needs_account`;
     - account must be Kiki-owned (both owner columns null) or owned by **this** food court else `account_not_owned`.
   - account (when set): `enabled` irrelevant here, but `method = ANY (provider.methods)` else
     `provider_method_mismatch`.
   - account `env = 'prod'` and the setting is enabled (non-empty `channels`) ⇒ `last_test_ok` and
     `last_test_version` = the active secret version, else `account_untested` (H-21, H-22; onboarding plan 4.4).
3. `payment_accounts_guard()` — `BEFORE UPDATE`: forbid changing `provider`, `restaurant_id`, `food_court_id`
   after creation (`account_owner_immutable`). Ownership changes = new account.
4. `payment_mode_guard()` — `BEFORE UPDATE OF payment_mode ON food_courts`: block the change if it would leave
   invalid settings (tests I-1, I-4):
   - to `per_restaurant`: any food-court-owned settings exist ⇒ `remove_food_court_settings_first`;
   - to `venue`: any restaurant-owned setting of its restaurants whose `channels` contains `web` ⇒
     `narrow_restaurant_settings_first` (kiosk-only restaurant settings are allowed in venue mode).
5. `payment_config_audit_trg()` — `AFTER INSERT OR UPDATE OR DELETE` on `payment_accounts`,
   `payment_method_settings`, `payment_account_secrets` (**never copy `ciphertext`/`nonce`** into before/after —
   strip them), and `AFTER UPDATE OF payment_mode` on `food_courts`. `actor = coalesce(nullif(current_setting('payments.actor', true), '')::uuid, auth.uid())`.
6. `payment_terminals_guard()` — device must be a restaurant kiosk (`device_tokens.restaurant_id` not null) and
   account owned by that restaurant (H-10; H-11 is the unique index).

**Lockdown (035 convention):** RLS on all new tables, `…_no_access` policy for `anon, authenticated`,
`REVOKE ALL … FROM anon, authenticated`. `payment_methods` gets an extra `SELECT` policy `USING (true)` for
`anon, authenticated` (public catalog).

Checks:
- `select * from payment_methods` returns 7 rows; anon can select it, cannot select any other new table.
- Manual negative inserts for each guard message (they become L1 tests in S13).

Rollback: `DROP TABLE … CASCADE` of the new tables and `ALTER TABLE food_courts DROP COLUMN payment_mode`
(nothing depends on them yet).

Commit: `feat(payments): config schema — methods, providers, accounts, settings, audit (051)`

---

### S2 — Migration `052_payments_ledger.sql` (payments, events, attention, resolution functions)

#### Tables
```sql
CREATE TABLE public.payments (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method                      text NOT NULL REFERENCES public.payment_methods(code),
  channel                     text NOT NULL CHECK (channel IN ('web', 'kiosk')),
  provider                    text NOT NULL REFERENCES public.payment_providers(code),
  account_id                  uuid NOT NULL REFERENCES public.payment_accounts(id),
  env                         text NOT NULL CHECK (env IN ('uat', 'prod')),
  -- owner at begin (architecture §2): exactly one
  owner_food_court_id         uuid REFERENCES public.food_courts(id),
  owner_restaurant_id         uuid REFERENCES public.restaurants(id),
  food_court_id               uuid REFERENCES public.food_courts(id),   -- venue of the order (null for standalone)
  device_id                   uuid REFERENCES public.device_tokens(id) ON DELETE SET NULL,  -- phase 4; null now
  table_id                    uuid REFERENCES public.tables(id) ON DELETE SET NULL,
  checkout_key                uuid NOT NULL,
  provider_ref                text NOT NULL                     -- Yappy orderId
                              DEFAULT replace(gen_random_uuid()::text, '-', ''),
  provider_txn_id             text,                             -- Yappy transactionId
  payer_ref                   text,                             -- Yappy alias
  client_ip                   text,
  subtotal_cents              integer NOT NULL CHECK (subtotal_cents >= 1),
  tax_cents                   integer NOT NULL CHECK (tax_cents >= 0),
  total_cents                 integer NOT NULL CHECK (total_cents = subtotal_cents + tax_cents),
  snapshot                    jsonb NOT NULL,                   -- same shape as 049 (pricing.ts Snapshot)
  provider_data               jsonb NOT NULL DEFAULT '{}'::jsonb, -- Yappy: token, documentName
  status                      text NOT NULL DEFAULT 'creating'
                              CHECK (status IN ('creating','created','unknown','failed','cancelled','expired','executed')),
  provider_status             text,           -- last status letter from a signature-valid callback
  confirmation_number         text,
  error_code                  text,
  client_cancelled_at         timestamptz,    -- UAT follow-up 3
  client_reported_success_at  timestamptz,
  fulfillment_error           text,
  fulfillment_warning         text,
  duplicate_of                uuid REFERENCES public.payments(id),
  refund_required             boolean NOT NULL DEFAULT false,
  order_id                    uuid UNIQUE REFERENCES public.orders(id) ON DELETE SET NULL,
  legacy_yappy_payment_id     uuid UNIQUE,    -- set only by the S7 history copy
  resolved_at                 timestamptz,
  resolution_note             text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  expires_at                  timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
  CHECK (num_nonnulls(owner_food_court_id, owner_restaurant_id) = 1),
  UNIQUE (provider, provider_ref)
);
CREATE UNIQUE INDEX payments_active_payer    ON public.payments (provider, payer_ref) WHERE status IN ('creating','created','unknown') AND payer_ref IS NOT NULL;
CREATE UNIQUE INDEX payments_active_checkout ON public.payments (checkout_key)        WHERE status IN ('creating','created','unknown');
CREATE INDEX payments_account_active ON public.payments (account_id, created_at) WHERE status IN ('creating','created','unknown');
CREATE INDEX payments_account_created ON public.payments (account_id, created_at DESC);
CREATE INDEX payments_payer_created   ON public.payments (payer_ref, created_at DESC);
CREATE INDEX payments_fc_created      ON public.payments (food_court_id, created_at DESC);
CREATE INDEX payments_rst_created     ON public.payments (owner_restaurant_id, created_at DESC);
CREATE INDEX payments_checkout_key    ON public.payments (checkout_key);

CREATE TABLE public.payment_events (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider         text NOT NULL,
  raw              text NOT NULL,          -- query string / body; never secrets
  provider_ref     text,
  status           text,
  signature_valid  boolean,                -- null = not checked (unknown ref)
  outcome          text,
  payment_id       uuid REFERENCES public.payments(id),
  received_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_events_ref ON public.payment_events (provider, provider_ref);
```
Lockdown both tables (035 convention). `update_updated_at` trigger on `payments`.

#### Function: `payment_kiosk_scope(p_user uuid)` → `(kind text, restaurant_id uuid, food_court_id uuid)`
SECURITY DEFINER, service_role only. Reads `org_members` (`role='kiosk_device'`, `restaurant_id` not
null) → `('restaurant', restaurant_id, restaurants.food_court_id)`; else `food_court_members`
(`role='kiosk_device'`) → `('food_court', null, food_court_id)`; else no row. This is the **only** way a kiosk
scope is determined anywhere in phase 2.

#### Function: `payment_resolve_owner(p_channel, p_food_court_id, p_restaurant_ids uuid[], p_kiosk_kind, p_kiosk_restaurant_id)` → jsonb
Internal (no grants except service_role; called by the two functions below). Implements architecture §2 / §2.1 /
diagram 3.3:
```
if p_channel = 'kiosk' and p_kiosk_kind = 'restaurant':
    restaurants in cart must all = p_kiosk_restaurant_id      else {error:'cart_invalid', reason:'not_this_restaurant'}
    owner = restaurant(p_kiosk_restaurant_id); venue_fc = restaurant.food_court_id (may be null)
elif cart restaurants have food_court_id null (standalone):
    exactly one restaurant                                    else {error:'cart_invalid'}
    owner = restaurant; venue_fc = null
else:
    all cart restaurants belong to p_food_court_id            else {error:'cart_invalid', reason:'other_food_court'}
    if food_courts.payment_mode = 'venue': owner = food_court
    else (per_restaurant): exactly one restaurant             else {error:'cart_invalid', reason:'single_restaurant_required'}
                           owner = that restaurant
return {owner_kind, owner_id, venue_food_court_id, venue_mode}
```
An empty cart is allowed for `resolve_payment_options` (checkout shows methods before items are final): then the
owner comes from `p_food_court_id` / the single restaurant / the kiosk.

#### Function: `resolve_payment_options(p_channel text, p_food_court_id uuid, p_restaurant_ids uuid[])` → jsonb
`STABLE SECURITY DEFINER`, `GRANT EXECUTE TO anon, authenticated, service_role`. Replaces `get_payment_options`.
- `p_channel = 'kiosk'` ⇒ caller must have a kiosk scope (`payment_kiosk_scope(auth.uid())`), else
  `{error:'not_a_kiosk'}`. Body ids are checked against the scope (D-5): mismatch ⇒ `{error:'scope_mismatch'}`.
- `p_channel = 'web'` ⇒ no auth needed.
- Resolve owner, then for each `payment_method_settings` row of the owner where `p_channel = ANY(channels)`,
  ordered by `coalesce(sort_order, method.sort_order)`:
  - pay_later ⇒ include.
  - pay_first ⇒ account = setting.account_id, or (fallback) the venue food court's setting for the same method
    when owner is a restaurant **kiosk** in a `venue` food court and setting.account_id is null and method ≠
    `card_present`. Include only if account exists, `enabled`, has an `active` secret, and — if `env='uat'` — now
    is inside Mon–Fri 07:00–18:30 America/Panama (same check as 049 `get_payment_options`). For
    `card_present`: phase 2 always hides (no device link yet; reason `terminal_unavailable`).
- Return:
```json
{
  "owner": {"kind": "food_court", "id": "…"},
  "single_restaurant_cart": false,
  "methods": [ {"code": "yappy", "label": "Yappy", "kind": "pay_first"},
               {"code": "yappy_on_delivery", "label": "Yappy en entrega", "kind": "pay_later"} ],
  "hidden": [ {"code": "card_online", "reason": "no_setting"} ]
}
```
  `hidden` uses the reason codes of the test matrix A.1 (`w`→`channel_not_possible`, `f`→`food_court_kiosk`,
  `n`→`no_setting`, `c`→`channel_not_enabled`) plus `account_disabled`, `no_active_secret`, `outside_uat_hours`,
  `terminal_unavailable`. **Never** return account ids, merchant ids or config.
  `single_restaurant_cart` = true when the owner rule requires one restaurant (per_restaurant food court, standalone,
  restaurant kiosk) — the UI uses it in phase 3.

#### Function: `payment_resolve_for_charge(p_channel, p_food_court_id, p_restaurant_ids, p_method, p_kiosk_user uuid)` → jsonb
service_role only. Same logic, for one method, re-checked at begin (D-9). Returns
`{owner_kind, owner_id, venue_food_court_id, account_id, provider, env, config}` or `{error:'method_unavailable', reason}` /
`{error:'cart_invalid', reason}`. `p_kiosk_user` is the JWT user id verified by the edge function (service role has
no `auth.uid()`).

#### Function: `payment_method_allowed_pay_later(p_channel, p_food_court_id, p_restaurant_ids, p_method, p_kiosk_user)` → jsonb
service_role only, used by `create-web-order` (S9). `{ok:true, owner_kind, owner_id}` or the same errors. Rejects
pay_first methods with `{error:'use_payment_create'}`.

#### Functions ported from 049/050 (same guarantees, generic names)
Port line by line; keep the comments. Differences listed:
- `begin_payment(p_resolved jsonb, p_method, p_channel, p_table_id, p_checkout_key, p_payer_ref, p_client_ip, p_subtotal_cents, p_tax_cents, p_total_cents, p_snapshot)`:
  - lock: `pg_advisory_xact_lock(hashtext('pay:' || account_id))`;
  - stale expiry per account at **5 min 30 s** (as 050);
  - existing live attempt for the same `checkout_key` ⇒ hand it back (as 049);
  - circuit breaker per **account** (> 40 creates / 10 min ⇒ `payment_accounts.enabled=false`, reason);
  - per-payer limit: `count(*) WHERE payer_ref = p AND created_at > now()-10min AND status <> 'executed'` ≥ 3 ⇒
    `rate_limited` (**UAT follow-up 2**);
  - per-table and per-IP limits as 049;
  - insert with owner/venue/account/provider/env from `p_resolved`; `unique_violation` ⇒ `payer_busy`.
  - returns `{existing, payment_id, status, provider_ref, env, expires_at, provider_data}`.
- `payment_mark_created(p_payment_id, p_provider_txn_id, p_provider_data jsonb)`, `payment_mark_failed`,
  `payment_mark_unknown` — as 049, conditional on `status='creating'`.
- `payment_client_cancel(p_payment_id, p_source text)` (**UAT follow-up 3**): if status in
  (`creating`,`created`,`unknown`) ⇒ `status='cancelled'`, `client_cancelled_at=now()`, `error_code='CLIENT_'||p_source`
  (`p_source` ∈ `DENIED`,`CANCELLED`,`USER`). Returns the new status. Frees payer/checkout indexes.
- `apply_payment_result(p_provider, p_provider_ref, p_status, p_confirmation, p_event_id)` — port of
  `yappy_apply_ipn`. Statuses stay provider-neutral letters for now (`E`,`C`,`X`; adapters map to them).
  Differences: lookup by `(provider, provider_ref)`; `payment_method` written on orders/sub_orders = the
  payment's `method` (`'yappy'`); `channel` = payment's channel; order number scope:
  `next_order_number(NULL, food_court_id)` when `food_court_id` not null, else
  `next_order_number(owner_restaurant_id, NULL)`; `E` on a `cancelled` row with `client_cancelled_at` ⇒ still
  creates the order and sets `fulfillment_warning` += `executed_after_client_cancel`.
- `get_payment_status(p_payment_id uuid)` — as `get_yappy_payment_status` + `method`, `client_cancelled`;
  anon/authenticated/service_role.

#### View `payment_attention` + `get_payment_attention()`
Port `yappy_attention` kinds onto `payments` / `payment_events` / `payment_accounts` (`merchant_disabled` now per
account), add `executed_after_client_cancel` (from `fulfillment_warning`) and `config_changed` (rows of
`payment_config_audit` from the last 7 days touching `account_id` or `payment_mode`). `get_payment_attention()`
platform admins only (as `get_yappy_attention`).

Checks: every new function has the REVOKE/GRANT pair. `anon` and `authenticated` can call only
`resolve_payment_options` and `get_payment_status` (plus `get_payment_attention`, which itself requires a platform
admin). `payment_kiosk_scope` is service_role only — `resolve_payment_options` calls it internally with `auth.uid()`.

Rollback: drop the new functions/view/tables (nothing uses them yet).

Commit: `feat(payments): generic ledger, owner/method resolution, begin/apply (052)`

---

### S3 — Migration `053_payment_method_codes.sql` (expand codes, no data change)
- Drop and recreate `orders_payment_method_check` and `sub_orders_payment_method_check` as
  `CHECK (payment_method IN ('yappy','cash_on_delivery','card_on_delivery','card_online','wallet','card_present','cash_counter','yappy_on_delivery'))`
  (NULL still passes a CHECK, as today).
  Old codes stay valid until S14 backfills them and S16 removes them.
- No backfill here.

Commit: `feat(payments): accept new payment_method codes on orders (053)`

---

### S4 — Shared payments code (`supabase/functions/_shared/payments/`)

Files:
```
_shared/payments/
  types.ts          Method, Channel, ChargeInput, ChargeResult, CallbackResult, Credentials
  crypto.ts         encryptSecret / decryptSecret (AES-256-GCM, WebCrypto)
  registry.ts       provider code → adapter; export PROVIDERS for the agreement test
  yappy.ts          Yappy adapter (moved from _shared/yappy.ts)
  core.ts           loadCredentials(accountId) → Credentials[]; status mapping helpers
  crypto.test.ts
  yappy.test.ts     (moved + extended from _shared/yappy.test.ts)
  registry.test.ts  adapter methods ⊆ payment_providers seed (parse 051 or hard-code the seed list)
```
Keep `_shared/yappy.ts` as a thin re-export until S16 so `yappy-create` / `yappy-ipn` keep deploying unchanged.

**`crypto.ts`**
- KEK from `Deno.env.get('PAYMENTS_KEK_' + version)` (base64, 32 bytes). Current version from
  `PAYMENTS_KEK_CURRENT` (e.g. `1`).
- `encryptSecret(plaintext, {accountId, version}) → {ciphertext, nonce, kekVersion}`: random 12-byte IV,
  `AES-GCM` with **additional data = `${accountId}:${version}`** — binds a ciphertext to its row so a DB writer
  can't move a secret from one account to another.
- `decryptSecret(row, accountId)`: same AAD; throws on failure (never returns partial data).
- Functions take an optional `getEnv` like `getYappyConfig` does, so node tests can inject a KEK.

**`types.ts` / adapter interface** (architecture §6):
```ts
export type Method = 'card_online' | 'wallet' | 'yappy' | 'card_present' | 'cash_counter' | 'yappy_on_delivery' | 'card_on_delivery'
export type Channel = 'web' | 'kiosk'
export interface Credentials { accountId: string; version: number; config: Record<string, unknown>; secrets: Record<string, string>; env: 'uat' | 'prod' }
// secrets = the decrypted JSON object of the adapter's kind:'secret' fields (Yappy: { secretKey })
export interface CredentialField {   // drives the admin-web onboarding form (plans/payments-onboarding.md 5.1)
  key: string; kind: 'config' | 'secret'; label: string; input: 'text' | 'url' | 'password'
  required: boolean; pattern?: string; default?: string; advanced?: boolean; help?: string
}
export interface ChargeInput { paymentId: string; providerRef: string; payerRef: string | null; subtotalCents: number; taxCents: number; callbackUrl: string }
export type ChargeResult =
  | { kind: 'created'; providerTxnId: string; providerData: Record<string, unknown>; clientPayload: Record<string, unknown> }
  | { kind: 'failed'; errorCode: string; message: string }     // provider said no, nothing charged
  | { kind: 'unknown'; errorCode: string }                     // may have charged
export interface CallbackResult { providerRef: string; status: 'E' | 'C' | 'X' | string; confirmation: string | null; signatureValid: boolean; raw: string }
export interface PaymentAdapter {
  provider: string
  label: string                                               // 'Yappy'
  methods: Method[]
  fields: CredentialField[]
  validateConfig(config: unknown): void                       // throws with a readable message
  testCredentials(creds: Credentials): Promise<{ ok: true } | { ok: false; code: string; message: string }>
  validatePayer(payerRef: string | null): { ok: true; value: string | null } | { ok: false; code: string; message: string }
  createCharge(input: ChargeInput, creds: Credentials): Promise<ChargeResult>
  parseCallback(req: Request): Promise<{ providerRef: string; raw: string }>
  verifyCallback(req: Request, creds: Credentials[]): Promise<CallbackResult>   // tries each credential, active first
}
```

**`yappy.ts` adapter** — move logic from `_shared/yappy.ts` and `yappy-create/index.ts`:
- `validateConfig`: `{merchantId: non-empty string, domain: https URL without trailing slash}`.
- `fields`: `merchantId` (config, text, "ID del comercio", required), `secretKey` (secret, password, "Clave
  secreta", required), `domain` (config, url, default `https://order.estoeskiki.com`, advanced). Help text: "Yappy
  Comercial → Botón de Pago → Credenciales".
- `testCredentials`: `validate/merchant` only (8 s timeout) — token ⇒ ok; Yappy E-code / 4xx ⇒ credential failure
  with a readable message; timeout / 5xx ⇒ `provider_unavailable`. Never calls `payment-wc` (nothing is charged).
- `validatePayer` (**UAT follow-up 1**): strip non-digits, drop leading `507` when 11 digits, require
  `^6\d{7}$`; message `'Ingresa un número Yappy válido (8 dígitos, empieza con 6).'`, code `invalid_alias`.
- `createCharge`: validate/merchant (8 s timeout) → payment-wc (20 s) exactly as `yappy-create` today, base URL
  from Edge secret `YAPPY_<ENV>_BASE_URL` (not per merchant), `merchantId`/`domain` from `creds.config`,
  `ipnUrl = input.callbackUrl`. Same failed/unknown classification as today
  (E-codes or 4xx with a readable body ⇒ failed; everything else ⇒ unknown).
  `clientPayload = {transactionId, token, documentName}`; `providerData = {token, documentName}`.
- Error messages: keep `YAPPY_ERROR_MESSAGES` and add
  `'YAPPY-004': 'Revisa tu número Yappy e inténtalo de nuevo.'` (**UAT follow-up 1**).
- `verifyCallback`: domain must equal `creds.config.domain`; hash per `computeYappyHash`; try every credential
  (active, then retired newest first); `signatureValid=false` if none match.

**Tests (node)**: everything in today's `yappy.test.ts`, plus: alias accepts `61234567`, `50761234567`,
`6123-4567`; rejects `12345678`, `7123456`, `612345678`; YAPPY-004 message; crypto round trip; tampered
ciphertext / wrong AAD / wrong KEK throw; verifyCallback succeeds with a retired secret when the active one fails
(C-11) and fails when all are wrong.

Commit: `feat(payments): shared adapter interface, envelope crypto, Yappy adapter`

---

### S5 — Edge Function `payment-admin` (verify_jwt true, platform admins only in phase 2)
Purpose: the only writer of merchants, secrets, settings and `payment_mode` (architecture §4.2). In phase 2 every
action requires `is_platform_admin()` for the caller (check with the caller's JWT: create a client with the
caller's `Authorization` header and call `rpc('is_platform_admin')`, like `admin-invite-user` re-verifies the
caller). Writes use the service role, after `select set_config('payments.actor', <caller uuid>, true)` in the same
transaction (use a SQL function per action so the set_config and the write share a transaction).

Actions (POST JSON `{action, …}`):
| action | input | effect |
|---|---|---|
| `create_account` | `provider, env, display_name, owner: {kind:'kiki'\|'food_court'\|'restaurant', id?}, config` | insert `payment_accounts`. `config` may be partial (e.g. only `domain`, merchant id added by `import_env_config`); `payment-create` runs `validateConfig` before every charge and fails with `CONFIG` if incomplete |
| `import_env_config` | `account_id, key, env_var` | `env_var` must match `^YAPPY_(UAT\|PROD)(_[A-Z0-9]+)*_MERCHANT_ID$` (e.g. `YAPPY_UAT_MERCHANT_ID`, `YAPPY_PROD_PLAZAMAYOR_MERCHANT_ID`); sets `config[key]` from the Edge secret server-side (re-run adapter `validateConfig`). Nobody copies the merchant id by hand. |
| `import_env_secret` | `account_id, env_var` | `env_var` must match `^YAPPY_(UAT\|PROD)(_[A-Z0-9]+)*_SECRET$` — Yappy secrets only, never other Edge secrets (test: `PAYMENTS_KEK_1`, `SUPABASE_SERVICE_ROLE_KEY`, `YAPPY_UAT_BASE_URL` rejected). Stored as `{secretKey}`. Reads it from Edge secrets, encrypts, inserts version n+1 `active`, retires the previous active one. **The secret never leaves the server.** |
| `set_secret` | `account_id, secrets` (object of the adapter's secret fields) | same as above with provided values (used from the phase 3 UI over HTTPS; never from chat); marks the last test stale |
| `onboard_account` | `provider, env, display_name, owner, config, secrets` | one transaction: `create_account` + `validateConfig` + secret v1; invalid input ⇒ nothing written |
| `update_account_config` | `account_id, config` (partial) | merge + `validateConfig`; marks the last test stale |
| `test_account` | `account_id` | decrypt active secret, `adapter.testCredentials`, store `last_test_*` |
| `describe_providers` | — | `[{code, label, methods, fields}]` from `registry.ts` (no secrets) |
| `describe_owner` | `owner` | allowed channels per method, selectable merchants, `payment_mode`, `can_write` — the UI renders from this, never re-implements the rules |
| `preview_options` | `owner` | `resolve_payment_options` for web and kiosk for that owner |
| `list_audit` | `owner, limit` | `payment_config_audit` rows |
| `retire_secret` / `revoke_secret` | `account_id, version` | state changes |
| `set_account_enabled` | `account_id, enabled, reason?` | |
| `upsert_setting` | `owner, method, channels, account_id?, sort_order?` | insert/update `payment_method_settings` (guards enforce rules) |
| `delete_setting` | `setting_id` | |
| `set_payment_mode` | `food_court_id, mode` | update `food_courts.payment_mode` (guard enforces I-1/I-4) |
| `list` | `owner?` | accounts (no secret fields; show `secret_versions: [{version, state, created_at}]`), settings, modes |

Responses: `{ok:true, …}` or `{error:'<code>', message}`; guard violations map their message to `error`.
Never log request bodies of `set_secret`.

Commit: `feat(payments): payment-admin edge function (platform admins)`

---

### S6 — Edge Function `payment-webhook` (verify_jwt **false**)
Route: `/functions/v1/payment-webhook/<provider>` (take the last path segment). Unknown provider ⇒ 404.
Port of `yappy-ipn` made generic:
1. `console.log` the raw query/body; insert `payment_events` (`provider`, `raw`, `provider_ref`, `status`). Insert
   failure ⇒ 503 (provider retries; log keeps it recoverable).
2. `adapter.parseCallback` → provider_ref. Missing ⇒ outcome `missing_ref`, 200 `{success:false}`.
3. Look up `payments` by `(provider, provider_ref)`. Not found ⇒ `unknown_ref`, 200 `{success:false}`.
4. Load credentials of `payment.account_id`: active + retired secrets not past grace (draft: retired < 7 days;
   make it a constant `RETIRED_SECRET_GRACE_DAYS = 7`), decrypt each.
5. `adapter.verifyCallback(req, creds)`. Invalid ⇒ update event `signature_valid=false, outcome='invalid_signature'`,
   200 `{success:false}`.
6. Valid ⇒ `signature_valid=true, payment_id=…`; `rpc('apply_payment_result', …)`. RPC error ⇒ 500 (event stays with
   no outcome ⇒ `ipn_not_applied` attention). Success ⇒ 200 `{success:true}`.
Must answer within 5 s (Yappy requirement) — no pricing, no provider API calls.

Commit: `feat(payments): generic payment-webhook with Yappy route`

---

### S7 — Migration `054_payments_seed_and_history.sql`
1. **No merchant rows here.** The Kiki Yappy UAT account and Plaza Mayor's `yappy` setting are created in S8
   through `payment-admin` (so the merchant id and secret are read server-side from Edge secrets and never typed,
   pasted or committed). This migration seeds only pay-later settings.
2. **Settings that reproduce today's checkout** (no behaviour change for anyone):
   - every food court: `(food_court, yappy_on_delivery, {web,kiosk})`, `(food_court, card_on_delivery, {web,kiosk})`;
   - every standalone restaurant: same two rows;
   - every restaurant that has an active restaurant `device_tokens` row and sits in a food court (restaurant
     kiosks, e.g. Kiki Centro's "Walk-Up Simulator Tablet"): `(restaurant, yappy_on_delivery, {kiosk})`,
     `(restaurant, card_on_delivery, {kiosk})`.
   Verify with a query that every food court, standalone restaurant and restaurant kiosk resolves ≥ 1 method for
   each channel it uses.
3. **History copy** (test data only, for traceability): for each `yappy_payments` row insert a `payments` row with
   `method='yappy'`, `channel='web'`, `provider='yappy'`, `account_id=<Kiki UAT account>`,
   `owner_food_court_id = food_court_id = yappy_payments.food_court_id`, `provider_ref = yappy_order_id`,
   `provider_txn_id = transaction_id`, `payer_ref = alias_yappy`, `provider_data = {token, documentName}`,
   `provider_status = ipn_status`, all other columns 1:1, `legacy_yappy_payment_id = id`. Copy
   `yappy_ipn_events` into `payment_events` (`provider='yappy'`, `raw=raw_query`, `provider_ref=yappy_order_id`,
   `signature_valid=hash_valid`, `payment_id` via the provider_ref). The account row only exists after S8, so this
   part is its own migration **`055_payments_history_copy.sql`**, applied after S8 (look the account up by
   `provider='yappy' AND env='uat' AND restaurant_id IS NULL AND food_court_id IS NULL`; fail loudly unless exactly one).

Commit: `feat(payments): seed method settings reproducing current checkout (054)`

---

### S8 — Configure Plaza Mayor through `payment-admin` (ops step, needs Edgar)
1. **Edgar** generates the KEK locally (`openssl rand -base64 32`) and sets Edge secrets `PAYMENTS_KEK_1` and
   `PAYMENTS_KEK_CURRENT=1` in the dashboard. Also confirm `YAPPY_UAT_BASE_URL` exists (it does today).
   Edgar keeps an offline copy of the KEK (password manager): losing it = re-entering every merchant secret.
2. As a platform admin (Edgar's session), call `payment-admin`:
   - `create_account {provider:'yappy', env:'uat', display_name:'Kiki — Yappy (UAT)', owner:{kind:'kiki'}, config:{domain:'https://order.estoeskiki.com'}}`
   - `import_env_config {account_id, key:'merchantId', env_var:'YAPPY_UAT_MERCHANT_ID'}`
   - `import_env_secret {account_id, env_var:'YAPPY_UAT_SECRET'}`
   - `test_account {account_id}` ⇒ `last_test_ok = true` (during UAT hours)
   - `upsert_setting {owner:{kind:'food_court', id:'fc000000-0000-0000-0000-000000000001'}, method:'yappy', channels:['web'], account_id}`
3. Apply `055_payments_history_copy.sql` (S7 point 3).
4. Checks: `select * from resolve_payment_options('web', 'fc000000-0000-0000-0000-000000000001', '{}')` during UAT
   hours shows `yappy`, `yappy_on_delivery`, `card_on_delivery`; outside hours `yappy` is in `hidden` with
   `outside_uat_hours`. `payment_config_audit` has rows for each write with Edgar's uuid as actor.

---

### S9 — `payment-create` Edge Function (verify_jwt true) — replaces `yappy-create`
Request (same shape as today's `CreateYappyPaymentPayload` + `method`, `channel`):
```json
{ "action": "create", "method": "yappy", "channel": "web",
  "tableToken": "…", "foodCourtId": "…", "restaurantId": null,
  "checkoutKey": "uuid", "payerRef": "61234567",
  "orderType": "dine-in", "customerName": "…", "customerPhone": "…", "tableId": "…", "tableNumber": null,
  "notes": {"<restaurantId>": "…"}, "items": [ {"menuItemId": "…", "restaurantId": "…", "quantity": 1, "selectedOptionIds": []} ] }
```
Other actions: `{action:'client_success', paymentId}` (as today), `{action:'client_cancel', paymentId, source:'DENIED'|'CANCELLED'|'USER'}` (**UAT follow-up 3**, calls `payment_client_cancel`).

Flow:
1. CORS exactly as `yappy-create` (allowed origins from `YAPPY_UAT_DOMAIN`/`YAPPY_PROD_DOMAIN` + www + localhost);
   rename env later if needed, not now.
2. If `channel='kiosk'`: get the caller from the JWT (`supabase.auth.getUser(token)` with the anon client), then
   `payment_kiosk_scope(user.id)`. No scope ⇒ 403 `not_a_kiosk`. In phase 2 no kiosk pay-first setting exists, so
   this path will return `method_unavailable`; keep it implemented for phase 3+.
3. Price the cart: `priceCart` (extend `_shared/pricing.ts` minimally so it also accepts a restaurant table or a
   kiosk scope without table token — **only if** needed for a test; Plaza Mayor web is the only live pay-first
   case and already works. If you extend it, mirror `create-web-order` step 1 exactly and add a node test).
4. `payment_resolve_for_charge(channel, foodCourtId, restaurantIds from priced snapshot, method, kioskUser)`.
   Error ⇒ return it (`cart_invalid` keeps today's shape with `closedRestaurantIds`/`unavailableItemIds` when it
   comes from pricing).
5. Adapter for `resolved.provider`; `validatePayer(payerRef)`; amounts range check (`buildYappyAmounts` throws ⇒
   `amount_out_of_range` as today).
6. `begin_payment(...)`. `existing` ⇒ same hand-back logic as `yappy-create` (created ⇒ return the same
   transaction; else `payment_in_progress` with `paymentId`). Errors ⇒ messages:
   `payer_busy` (was `alias_busy`), `rate_limited`, `method_unavailable` — reuse today's Spanish texts.
7. Load + decrypt the active secret of `account_id` (S4 `core.loadCredentials`). Missing ⇒ `payment_mark_failed('CONFIG')`, `method_unavailable`.
8. `callbackUrl = (Deno.env.get('PAYMENTS_WEBHOOK_BASE_URL') || SUPABASE_URL + '/functions/v1/payment-webhook') + '/' + provider`.
9. `adapter.createCharge` ⇒ `payment_mark_created` / `payment_mark_failed` / `payment_mark_unknown` exactly as today.
10. Response on success: `{paymentId, method, provider, expiresAt, client: {transactionId, token, documentName}}`.

Commit: `feat(payments): payment-create edge function`

---

### S10 — `create-web-order` changes (pay-later path) — **COS-critical**
Save the live version first (S0). Changes, in this order inside the function:
1. **Legacy code mapping** at the top: `yappy` → `yappy_on_delivery`, `cash_on_delivery` → `cash_counter`. New
   codes accepted: `cash_counter`, `yappy_on_delivery`, `card_on_delivery`. Any pay_first code ⇒ 400
   `use_payment_create`. Update the `PaymentMethod` type accordingly.
2. **Kiosk identity**: if `body.channel === 'kiosk'`, read the caller from the `Authorization` JWT and
   `payment_kiosk_scope`. No scope ⇒ 403 `not_a_kiosk`. Then **override** `restaurantId`/`foodCourtId` from the
   scope (food court kiosk ⇒ `foodCourtId`; restaurant kiosk ⇒ `restaurantId`) and ignore the body's values.
   `channel` is `'kiosk'` only when this succeeds; otherwise it is `'web'`.
3. After pricing (restaurants known): `payment_method_allowed_pay_later(channel, foodCourtId, restaurantIds, method, kioskUser)`.
   Error ⇒ `cart_invalid` (with reason) or 400 `method_unavailable`. This also enforces the per_restaurant
   single-restaurant rule (B-8, B-10) and restaurant-kiosk cart scope (B-5).
4. Insert with the **new** code.
5. Smoke test immediately after deploy (section 0.4): COS food court kiosk order with "Tarjeta", COS web order with
   "Yappy" (en entrega); Kiki Centro restaurant kiosk if a device is available. Check rows: `channel`, new
   `payment_method`, `payment_status='pending'`.
Rollback: redeploy the saved version (DB accepts both code sets, so nothing else to undo).

Commit: `feat(payments): create-web-order checks enabled methods and kiosk identity`

---

### S11 — order-web (web checkout) — deploy via PR to `main`
Files: `apps/order-web/lib/yappy.ts` → split into `lib/payments.ts` (generic) + keep Yappy-specific bits;
`app/checkout/page.tsx`; `components/checkout/YappyButton.tsx`; `components/checkout/YappyWaitingOverlay.tsx`;
`lib/types.ts`; `lib/api.ts`.
1. `lib/types.ts`: `PaymentMethod` = all 7 codes.
2. `lib/payments.ts`:
   - `getPaymentOptions({foodCourtId, restaurantId, restaurantIds})` → `rpc('resolve_payment_options', {p_channel:'web', …})`;
     on error return pay-later fallback `[]` + error flag (checkout then shows the error state, not a guess).
   - `createPayment(payload)` → `functions.invoke('payment-create', …)` (same error classes as today's
     `createYappyPayment`, `alias_busy` → `payer_busy`).
   - `getPaymentStatus(id)` → `rpc('get_payment_status')`.
   - `cancelPayment(id, source)` → `payment-create` `client_cancel`.
   - Pending-attempt storage unchanged (`kiki-yappy-pending` key may stay; TTL stays 6 min, 050 comment applies).
3. Checkout page:
   - Replace the hard-coded `['yappy','card_on_delivery']` with the `methods` list from `getPaymentOptions`, in the
     returned order, using `label` from the server. Default selection = first method. Refetch when the cart's
     restaurant set changes.
   - `kind === 'pay_first' && code === 'yappy'` ⇒ the existing Yappy button + alias field; all `pay_later` ⇒ the
     existing "Confirmar pedido" path with that code.
   - Alias validation `^6\d{7}$` with message "Tu número Yappy debe tener 8 dígitos y empezar con 6."
     (**UAT follow-up 1**, client side).
   - Copy: pay_later description "El pedido se paga cuando te lo entreguen." / for `cash_counter` "Pagas en caja al
     recoger."; pay_first Yappy as today.
   - Empty `methods` ⇒ show "No hay métodos de pago disponibles en este momento." and disable submit.
   - Demo storefronts (`getDemo`) keep their current behaviour (skip resolution as today).
4. Waiting overlay (**UAT follow-up 3**):
   - When the button reports `DENIED` or `CANCELLED` (`setYappyButtonHint`) while waiting, call
     `cancelPayment(paymentId, hint)` and show: title "Rechazaste el pago en Yappy", body "No se cobró nada.",
     actions "Reintentar" (new checkoutKey, as today's retry) and "Pagar de otra forma" (closes overlay, keeps cart).
   - Add a small "Cancelar" link in the first state (`now < expiresAt`): opens a confirm "¿Ya rechazaste o cerraste
     el cobro en tu app Yappy? Si lo confirmas allí, el pedido se crea igual." → "Sí, cancelar" ⇒
     `cancelPayment(id,'USER')` ⇒ same end state.
   - If after a client cancel the status poll still returns `executed` (late E), go to the thank-you page as usual.
5. `YappyButton`: unchanged contract; `onCreate` now calls `createPayment` with `method:'yappy', channel:'web'`.
6. Read the Next.js docs folder first (0.1.4). Typecheck: `npx tsc --noEmit -p .` in `apps/order-web`.
7. Deploy: PR → preview URL → test on the preview → merge → production.

Commit(s): `feat(order-web): checkout methods from resolve_payment_options`, `feat(order-web): end Yappy wait on rejection + Cancelar`

---

### S12 — Kiosk app (OTA)
Files: `apps/kiosk/src/services/orderApi.ts`, `apps/kiosk/src/screens/CheckoutScreen.tsx`, i18n strings.
1. `PaymentMethod` type = pay-later codes (`cash_counter | yappy_on_delivery | card_on_delivery`); pay-first is not
   offered on kiosks in phase 2.
2. On checkout mount (and when the cart's restaurant set changes): `rpc('resolve_payment_options', {p_channel:'kiosk', p_food_court_id: foodCourtId, p_restaurant_ids})` — the kiosk's anonymous session is the identity.
   Render `methods` where `kind === 'pay_later'`, labels from the server (fall back to i18n by code).
3. Submit unchanged except the code; the server now derives scope from the session (S10) so the body's
   `restaurantId`/`foodCourtId` may stay for compatibility.
4. Empty list ⇒ show an error and block submit (should not happen after S7 seeds; it means a config gap).
5. OTA: `cd apps/kiosk && eas update --branch preview --message "Kiosk: payment methods from server"` — check the
   kiosk app's EAS channel first (`eas update:list`), it may differ from the admin app's.
6. Smoke test at COS (food court kiosk) and a restaurant kiosk (Kiki Centro tablet) if available.

Commit: `feat(kiosk): checkout methods from resolve_payment_options`

---

### S13 — POS (admin app), printer, admin-web labels
Must ship **before or together with** S10 so new codes never show blank.
1. `apps/admin/src/data/types.ts`: `PaymentMethod` = 7 new codes + legacy `cash_on_delivery`.
2. `apps/admin/src/utils/orderLabels.ts` and `apps/admin/src/services/printerService.ts`:
   `card_online → 'Tarjeta'`, `wallet → 'Apple/Google Pay'`, `yappy → 'Yappy'`, `card_present → 'Datáfono'`,
   `cash_counter → 'Efectivo'`, `yappy_on_delivery → 'Yappy'`, `card_on_delivery → 'Tarjeta'`,
   legacy `cash_on_delivery → 'Efectivo'`. (The PAGADO / POR COBRAR chip already distinguishes paid vs to collect.)
   Deduplicate: printerService should import from `orderLabels.ts`.
3. admin-web `app/(dashboard)/orders/[orderId]/page.tsx` `PAYMENT_METHOD_LABEL`: same map (consider moving it to
   `lib/format.ts`). Read the Next.js docs folder first.
4. OTA admin: `cd apps/admin && eas update --branch preview --message "POS: labels for new payment method codes"`.
   Deploy admin-web via PR.

Commit: `feat(admin): labels for new payment method codes`

---

### S14 — Migration `056_backfill_payment_method_codes.sql` (after S10–S13 are live)
```sql
UPDATE orders     SET payment_method = 'yappy_on_delivery' WHERE payment_method = 'yappy' AND payment_status <> 'paid';
UPDATE sub_orders SET payment_method = 'yappy_on_delivery' WHERE payment_method = 'yappy' AND payment_status <> 'paid';
UPDATE orders     SET payment_method = 'cash_counter'      WHERE payment_method = 'cash_on_delivery';
UPDATE sub_orders SET payment_method = 'cash_counter'      WHERE payment_method = 'cash_on_delivery';
```
Before running: count affected rows and write the counts in section 6; after: recount. Paid `'yappy'` rows (pay-first)
keep `'yappy'`. Do **not** yet remove old codes from the CHECK (S16).

Commit: `chore(payments): backfill legacy payment_method codes (056)`

---

### S15 — Tests

#### L1 — `supabase/tests/payments_matrix_test.sql`
Pattern of `049_yappy_payments_test.sql`: one `DO $test$ … $test$` block that seeds the fixture world of
`payments-test-matrix.md` §1 with fixed UUIDs (prefix them, e.g. `f1000000-…`), runs assertions, collects
`PASS/FAIL <cell id>` lines in an array, and ends with `RAISE EXCEPTION '%', array_to_string(v_log, E'\n')` so
**nothing persists**. Run it with MCP `execute_sql`; the error text is the report. Expectations as a `VALUES`
table: `(cell_id, ctx, method, expected text)` where expected is the merchant fixture name, `pay_later`, or
`hidden:<reason>`.

Fixture notes:
- The card gateway provider doesn't exist until phase 5: insert a fixture provider
  `('test_card', '{card_online,wallet}')` inside the block so `M-KIKI-CARD` / `M-RP1-CARD` can be created.
- `resolve_payment_options` hides `uat` merchants outside Yappy UAT hours and the test can't fake `now()`: create
  all fixture merchants with `env='prod'` (no hours gate), and for C-5 create one `uat` merchant and assert
  `hidden:outside_uat_hours` or shown depending on the current Panama time computed inside the test.
- Fixture merchants need an `active` row in `payment_account_secrets` to be offered; any non-empty base64 text works
  for `ciphertext`/`nonce` because SQL never decrypts.

Kiosk contexts need an `auth.uid()`: inside the block use
`PERFORM set_config('request.jwt.claims', json_build_object('sub', <fixture user uuid>, 'role','authenticated')::text, true)`
with fixture `org_members` / `food_court_members` rows (`role='kiosk_device'`) for each fixture kiosk, and reset
it between contexts.

Phase 2 must pass:
| layer | cells |
|---|---|
| A availability | all 70 cells **except** `card_present` cells C3/C4/C8/C10, which in phase 2 must be `hidden:terminal_unavailable` (assert that instead; phase 4 flips them) |
| A.2 fallback | A-FB-1 … A-FB-5 |
| B cart rule (server) | B-1, B-2, B-3, B-4, B-5, B-6, B-8, B-10, B-11, B-12 (UI cells B-7/B-9 are phase 3) |
| C merchant state | C-1, C-2, C-3, C-4, C-5, C-8, C-9, C-10, C-11 (L2), C-12 (L2); C-6/C-7 phase 4 |
| D tampering | D-1 … D-4, D-6, D-7, D-8, D-9 (D-5 via L2 against `create-web-order`/`payment-create`) |
| E collector/payout | E-1 … E-9 for `account_id` / owner columns (call `begin_payment` + `apply_payment_result('E')`); payout flag is derived — assert the owner of `account_id` |
| F order record | F-3, F-5, F-6, F-7, F-8 (F-1/F-2/F-4 need adapters from later phases) |
| H.1 constraints | H-1 … H-12, H-21, H-22 |
| I mode changes | I-1, I-3, I-4, I-5 (I-2 is UI) |
Plus ports of the 049 test cases onto the new functions: one active attempt per payer and per cart, sibling
double-execute ⇒ one order + `refund_required`, snapshot mismatch ⇒ warning not failure, broken snapshot ⇒
`fulfillment_error` with payment still `executed`, rate limits incl. **executed attempts not counted**, client
cancel frees the payer, `E` after client cancel creates the order + warning.

#### L2 — node tests (S4) + edge checks
- `node --experimental-strip-types --test supabase/functions/_shared/payments/*.test.ts`
- Manual `curl` checks after deploy: `payment-webhook/yappy` with a bad hash (T4), replay of a real callback (T5),
  unknown provider path ⇒ 404; `create-web-order` with `channel:'kiosk'` and no kiosk JWT ⇒ 403 (D-5);
  `payment-admin` as a non-admin ⇒ forbidden (H-13…H-20 subset); onboarding actions H-23…H-27.

#### L3 — Yappy UAT rerun (during UAT hours, Edgar has the UAT app)
T1 E, T2 C, T3 X, T4 bad hash, T5 replay — through the new path. Plus: rejection ends the wait immediately;
"Cancelar" works; `12345678` is blocked before Yappy; 4 attempts with rejections ⇒ 4th refused, but after a
success the counter doesn't block. Record in section 6.

Commit: `test(payments): L1 matrix + node tests`

---

### S16 — Retire the old path (schedule; run ≥ 24 h after S11 is live and UAT passed)
1. Confirm no `yappy_payments` row is active and no IPN hit `yappy-ipn` in the last 24 h (function logs).
2. Delete Edge Functions `yappy-create`, `yappy-ipn` (Supabase dashboard or `supabase functions delete`; ask
   Edgar if the MCP can't).
3. Migration `057_retire_yappy_tables.sql`: rename `yappy_*` tables to `legacy_yappy_*` (keep the data until
   go-live), drop `yappy_*` functions and `get_payment_options`, drop view `yappy_attention` /
   `get_yappy_attention`. Remove old codes from the CHECK only after S14 counts show zero `cash_on_delivery` and
   zero unpaid `yappy` rows.
4. Remove `_shared/yappy.ts` re-export and `_shared/yappy.test.ts`.
5. Edgar removes Edge secrets `YAPPY_UAT_SECRET` and `YAPPY_UAT_MERCHANT_ID` (keep `YAPPY_UAT_BASE_URL`,
   `YAPPY_UAT_DOMAIN` for CORS).
6. Update `plans/payments-architecture.md` decisions log and `plans/yappy-test-plan.md` §9 (go-live checklist now
   points to `payment_accounts`).

---

## 4. Acceptance checklist (tick in a PR description)
- [ ] S1–S3 migrations applied; guards reject every H.1 case with the documented message.
- [ ] `resolve_payment_options` matches table A for every phase-2 cell (L1 report attached).
- [ ] Secrets: DB holds only ciphertext; `select ciphertext` is useless without `PAYMENTS_KEK_1`; AAD binding test passes.
- [ ] `payment-create` + `payment-webhook` handle T1–T5 in UAT.
- [ ] Per-payer limit ignores executed attempts; `^6\d{7}$` enforced client + server; YAPPY-004 message shown.
- [ ] Rejection / Cancelar end the wait immediately; late `E` still produces the order + attention warning.
- [ ] `create-web-order` derives kiosk scope from the JWT; spoofed scope refused (D-5).
- [ ] COS kiosk + web orders OK after S10, S12 (smoke test notes in section 6).
- [ ] POS / printer / admin-web show labels for all codes; no blank labels.
- [ ] Backfill counts recorded; no unexpected rows changed.
- [ ] `payment_config_audit` rows exist for every config write, without secret material.
- [ ] S16 scheduled with date.

## 5. Deploy order (summary)
| # | action | reversible by |
|---|---|---|
| 1 | Apply 051, 052, 053 | dropping new objects (unused) |
| 2 | Deploy `payment-admin`, `payment-webhook`, `payment-create` (unused yet) | deleting the functions |
| 3 | Apply 054 (settings seed) | deleting seeded settings |
| 4 | Edgar sets `PAYMENTS_KEK_1`, `PAYMENTS_KEK_CURRENT` | — |
| 5 | S8 via `payment-admin`; history copy (055) | deleting the account/settings rows |
| 6 | POS OTA + admin-web deploy (labels, S13) | previous OTA (`eas update:rollback` / republish) |
| 7 | Deploy `create-web-order` v2 (S10) → **COS smoke test** | redeploy saved version |
| 8 | Kiosk OTA (S12) → **COS smoke test** | previous OTA |
| 9 | order-web PR → preview test → merge (S11) | revert PR |
| 10 | L1 matrix run; Yappy UAT rerun (S15) | — |
| 11 | Apply 056 backfill (S14) | reverse UPDATEs using the counts/ids saved before |
| 12 | ≥ 24 h later: S16 | restore from `legacy_yappy_*` |

## 6. Implementation log (fill in while working)
| date | step | result / notes |
|---|---|---|
| | S0 baseline | |

## 7. Open questions for Edgar (ask before the step that needs them)
- S7/S8: provide nothing in chat — confirm the `import_env_config` / `import_env_secret` route is OK (no copying of
  merchant id or secret by anyone).
- S12: the kiosk app's EAS channel name (if not `preview`).
- S10: who runs the COS smoke test, and at what time (COS is live on match days).
- S16: date to retire the old functions.
