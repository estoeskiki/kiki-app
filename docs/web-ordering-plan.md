# Web Ordering Channel for KIKI

## Context

KIKI is a multi-tenant kiosk-ordering SaaS (Panama). Today customers order via `apps/kiosk` (Expo/RN, physical touchscreen device, locked portrait, device-token auth) or `apps/admin` (Expo/RN staff POS). Restaurant owners want a second channel: customers order from their own phone via a QR code on the table, browse the same menu, pay Yappy (future) or on delivery (cash/card), and track their order — hitting the same Supabase backend so orders show up in `apps/admin` exactly like kiosk orders do today.

Key discovery from exploration: the DB **already models multi-restaurant orders** (`orders` parent + `sub_orders` per restaurant, built for kiosk "food court" mode) — this is exactly the shape needed for "mall mode" (order across several restaurants at once), so no new data model is needed for that part, only a new client and a safe way for an untrusted public client to write to it. Payment method, order channel, delivery, and table/QR identification don't exist in the schema at all today — greenfield additions.

User-confirmed decisions:
- **Location:** new app inside this monorepo (not a separate repo).
- **Stack:** Next.js, rebuilt web-native (not Expo/React-native-web) — matches the already-present (but empty) `apps/admin-web` scaffold, best perf/SEO for a public storefront. Same aesthetics achieved via shared design tokens (colors/type/spacing), not shared RN code.
- **Order tracking access:** unique unguessable order link only, no login (same trust model as Stripe/DoorDash tracking links).
- **New requirement:** QR codes are printed per physical table (in a single restaurant or in a food court) and must tell the app which table the order came from.

## Architecture Overview

```
Customer phone ──QR──> apps/order-web (Next.js, Vercel)
                          ├─ reads menu/restaurant via RPC (SECURITY DEFINER, anon key)
                          ├─ places order via Edge Function create-web-order (service role, recomputes prices)
                          └─ tracks order via RPC get_order_status_public (anon key, polling)
                                          │
                                          ▼
                              Supabase (same project as kiosk/admin)
                              orders / sub_orders / order_items  ← unchanged by kiosk, just a new writer
                                          │
                                          ▼
                          apps/admin (Expo/RN staff POS) — realtime on sub_orders, unchanged logic,
                          small additions to show channel/payment method/table/delivery address
```

Why an Edge Function (not direct client insert) for order creation: the kiosk trusts client-computed totals because the kiosk is a controlled device. A public web client is untrusted — it must not be able to submit arbitrary prices. The function recomputes subtotal/tax/total server-side from `menu_items`/`customization_options`, mirroring `apps/kiosk/src/services/orderService.ts`'s standalone/food-court branching, then writes with the service-role key (same pattern already used in `supabase/functions/generate-fiscal-invoices`).

Why RPCs (not opening tables to `anon`) for menu reads/order tracking: `restaurants` has a secret column (`fiscal_api_token`) so it can't be broadly exposed; `orders`/`sub_orders` contain customer PII (name, phone, delivery address) so a blanket `anon` SELECT policy would let anyone dump every order across every tenant. `SECURITY DEFINER` functions return only whitelisted fields and enforce the lookup key server-side. Menu/category tables have no secrets, so those *do* get a plain public SELECT policy — this also lets the web app use real Supabase Realtime for live menu/is-open updates, same pattern as kiosk's `subscribeToMenu`/`subscribeToStatus`.

## Execution Phases

- [x] DONE — **Phase 0:** Workspace wiring (pnpm/npm workspaces for `apps/*` + `packages/*`, fill `packages/supabase/types.ts`)
- [x] DONE — **Phase 1:** Database migration `010_web_ordering.sql` (`tables`, order/sub_order columns, public menu RLS, `get_public_storefront`, `get_order_status_public`) — written, not yet applied to the live project (needs Supabase CLI login, see Phase 6)
- [x] DONE — **Phase 2:** Edge Function `create-web-order` — written, not yet deployed (needs `supabase functions deploy`, see Phase 6)
- [x] DONE — **Phase 3:** Shared package `packages/ui-tokens` (colors/typography/spacing + Tailwind preset)
- [x] DONE — **Phase 4:** `apps/order-web` scaffold + routes (`/t/[token]`, `/r/[slug]`, `/mall/[slug]`, `/checkout`, `/order/[orderId]`) + cart/checkout state — builds clean (`next build`), boots and renders correct fallback states (`next start`, verified 200s + expected copy on `/`, `/r/[slug]`, `/checkout`)
- [x] DONE — **Phase 5:** `apps/admin` additions (surface channel/payment/table/delivery on order cards; Tables management + QR display) — `tsc --noEmit` passes
- [ ] TODO — **Phase 6:** Deploy + live end-to-end verification — could not run in this session (no Supabase CLI/login available). See "Remaining manual steps" below.

Each phase is implemented and checked off in order; later phases depend on earlier ones (e.g. Phase 4 needs Phase 1's RPCs and Phase 2's edge function to exist).

### Remaining manual steps (need your Supabase login)

1. `supabase login` then `supabase link --project-ref shmmbnvdtmqxmrlzpluh`
2. `supabase db push` — applies `010_web_ordering.sql` to the live database
3. `supabase functions deploy create-web-order` (and re-deploy `generate-fiscal-invoices` if you want real DGI invoices instead of the current dev bypass — see `apps/kiosk/src/services/orderService.ts`'s `generateFiscalInvoices()`)
4. `supabase gen types typescript --linked > packages/supabase/types.ts` — replaces the hand-written types with the authoritative generated ones
5. Seed at least one `tables` row (via the new "Mesas" section in `apps/admin` Settings, once that build is deployed/run) and test `/t/<qr_token>` end to end
6. Set `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` in your `apps/order-web` hosting provider (Vercel or similar) — same values as `apps/order-web/.env.local`
7. Run through the Verification checklist below against the live deployment

## 1. Database migration (`supabase/migrations/010_web_ordering.sql`)

- **New `tables` table** — physical tables identified by QR, scoped to a restaurant *or* a food court (mirrors the existing `chk_device_scope` nullable-pair pattern on `device_tokens`):
  ```sql
  CREATE TABLE tables (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
    food_court_id uuid REFERENCES food_courts(id) ON DELETE CASCADE,
    label text NOT NULL,                 -- "Table 12", shown to staff & customer
    qr_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_table_scope CHECK (
      (restaurant_id IS NOT NULL AND food_court_id IS NULL) OR
      (restaurant_id IS NULL AND food_court_id IS NOT NULL)
    )
  );
  ```
  RLS: staff (`owner`/`manager`, via `get_user_restaurant_ids()`/food-court equivalent) can select/insert/update their own tables. No public policy needed — tables are only read via the RPC below.

- **Extend `orders` and `sub_orders`** (same columns on both, matching the existing denormalization pattern where `subtotal`/`tax`/`customer_name` are already duplicated on both):
  - `channel text NOT NULL DEFAULT 'kiosk' CHECK (channel IN ('kiosk','web'))`
  - `payment_method text CHECK (payment_method IN ('yappy','cash_on_delivery','card_on_delivery'))`
  - `payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed'))`
  - `table_id uuid REFERENCES tables(id) ON DELETE SET NULL` (orders only)
  - `table_label text` (snapshot, survives table deletion — same rationale as `order_items.item_name` snapshotting)
  - `delivery_address jsonb`
  - `customer_phone text`
  - Widen `order_type` check constraint from `('dine-in','takeaway')` to `('dine-in','takeaway','delivery')`.

- **Public read policies** (new, safe — no secret columns) on `categories`, `menu_items`, `customization_groups`, `customization_options`: `FOR SELECT TO anon USING (true)`. Confirms with existing Supabase default grants (kiosk/admin already rely on RLS-only, no explicit GRANTs in prior migrations).

- **`get_public_storefront(p_slug text, p_table_token text)`** — `SECURITY DEFINER` SQL/plpgsql function. Resolves either a table QR token or a restaurant/food-court slug to: restaurant or food-court public fields (name, slogan, is_open, welcome_bg_url, tax_rate — **not** `fiscal_api_token`), the resolved table's label if entered via QR, and the restaurant list (food-court mode) or menu (categories → menu_items → customization groups/options) needed to render the storefront. `GRANT EXECUTE ... TO anon`.

- **`get_order_status_public(p_order_id uuid)`** — `SECURITY DEFINER` SQL function, takes the order's UUID (the "bearer link") and returns only: order number, top-level status, order type, table label, payment method/status, and a per-restaurant breakdown of `sub_orders` (restaurant name, status, item names/qty) — no customer name/phone/address beyond what the requester already has via the link. `GRANT EXECUTE ... TO anon`. Web tracking page polls this every ~5s while status is non-terminal.

## 2. Edge Function: `supabase/functions/create-web-order/`

Mirrors `apps/kiosk/src/services/orderService.ts`'s `createStandaloneOrder`/`createFoodCourtOrder`, server-side:
- Input: `{ restaurantId? , foodCourtId?, tableToken?, orderType, customerName, customerPhone, items: [{menuItemId, quantity, selectedCustomizationOptionIds}], paymentMethod, deliveryAddress? }`.
- Uses the service-role client (like `generate-fiscal-invoices`) — bypasses RLS entirely, so no new `orders`/`sub_orders` INSERT policy for anon is needed.
- **Recomputes every price from `menu_items`/`customization_options`** — never trusts client-sent totals or line prices. Rejects unavailable items.
- Resolves `tableToken` → `table_id`/`table_label` via the `tables` row if present.
- Branches standalone (1 sub_order) vs food-court (group cart items by `restaurantId`, N sub_orders) exactly like the kiosk function; calls `next_order_number` RPC the same way; fixes the kiosk's known hardcoded-10%-tax bug by using each restaurant's real `tax_rate`.
- Sets `channel='web'`, `payment_method`, `payment_status='pending'`, `delivery_address`, `customer_phone`, `table_id`/`table_label` on both `orders` and `sub_orders`.
- Inserts `order_items`/`order_item_customizations` same shape as kiosk.
- Invokes `generate-fiscal-invoices` the same way ThankYou/PaymentScreen does for kiosk (real call this time, not the dev bypass — flag to user as a separate fix if they want it live).
- Returns `{ orderId, orderNumber }` to the client — `orderId` becomes the tracking link.

## 3. Workspace wiring (small, needed once)

The repo isn't currently a real npm/pnpm workspace (`apps/*`/`packages/*` are standalone folders — `packages/@kiki/supabase` exists but nothing imports it yet). Add a `pnpm-workspace.yaml` (or `workspaces` field in root `package.json`) covering `apps/*` and `packages/*` so `apps/order-web` can depend on `@kiki/supabase` and the new `@kiki/ui-tokens` via the workspace protocol instead of copy-pasting client/token code. Fill in `packages/supabase/types.ts` via `supabase gen types typescript`.

## 4. New shared package: `packages/ui-tokens`

Ports `apps/kiosk/src/theme/{themes,typography,spacing}.ts` values (lime `#ccff00`, hot pink `#ff6b98`, cyan, dark navy `#060e1d`/`#0f192c`, Space Grotesk/Syne, the same spacing/radius scale — sourced from `DESIGN.md`) into framework-agnostic exports plus a Tailwind v4 preset, so `apps/order-web` (and later `apps/admin-web`) share one source of truth instead of hand-copying hex values — this is the mechanism that makes "same aesthetics" true by construction.

## 5. New app: `apps/order-web` (Next.js App Router)

Routes:
- `app/t/[token]/page.tsx` — QR landing. Calls `get_public_storefront(p_table_token)`, stores `{tableToken, tableLabel, restaurantId|foodCourtId}` in a persisted Zustand store, redirects into `/r/[slug]` or `/mall/[slug]`.
- `app/r/[slug]/page.tsx` — single-restaurant storefront: category tabs, menu grid, item modal — visual/behavioral port of `MenuScreen`/`ItemDetailModal`/`CategoryTabs`/`MenuGrid`/`MenuItemCard`.
- `app/mall/[slug]/page.tsx` — food-court directory + shared cart across restaurants, port of `DirectoryScreen` + food-court cart grouping from `CartScreen`.
- `app/checkout/page.tsx` — cart review, order type (auto-locked to `dine-in` + table label if entered via QR, otherwise takeaway/delivery choice), name/phone, delivery address field (delivery only), payment method: **Yappy button disabled/greyed with "coming soon"**, **Cash on delivery** / **Card on delivery** selectable. Calls `create-web-order`.
- `app/order/[orderId]/page.tsx` — tracking page, polls `get_order_status_public`, shows aggregate + per-restaurant status mirroring admin's `confirmed → preparing → ready → completed` labels (customer-friendly copy).

State: Zustand stores mirroring kiosk's shape (`useCartStore` getters `getSubtotal/getTax/getTotal`, per-restaurant grouping helpers) so the ordering logic (not just the look) matches.

Excluded vs. kiosk (per user's requirements): no printer integration, no device-token pairing screen, no idle-auto-reset, no forced portrait/tablet lock — responsive mobile-first layout instead (kiosk has no responsive breakpoints today; this app needs them since it targets personal phones, not a fixed kiosk display).

## 6. `apps/admin` additions (small, needed for staff to act on web orders)

- Extend the `sub_orders` select in `useOrdersStore.ts` and the admin `Order` type (`apps/admin/src/data/types.ts`) to include `channel`, `payment_method`, `payment_status`, `table_label`, `delivery_address`.
- `OrderCard`/`OrderDetailsModal`: show a small "Web" / table-label / delivery-address badge so staff know an order didn't come from the kiosk counter and what to collect (cash/card) on delivery.
- New lightweight "Tables" screen (or a section in `SettingsScreen`) for staff to create table rows and display/print their QR (encode `https://order.kiki.<domain>/t/<qr_token>` with a small QR-rendering library). This is the only way to actually get printable QR codes onto tables.

## Verification

1. Apply migration 010 locally/staging (`supabase db push` or SQL editor), regenerate types into `packages/supabase/types.ts`.
2. Seed a `tables` row for an existing restaurant and for the existing food court; hit `/t/<token>` in the browser, confirm it resolves to the right storefront with the table label shown at checkout.
3. Standalone flow: browse → customize → cart → checkout (delivery, card-on-delivery) → place order → land on `/order/[id]` tracking page.
4. Mall flow: from `/mall/<slug>`, add items from two different restaurants, checkout once, confirm the edge function creates 1 `orders` row + 2 `sub_orders`.
5. With `apps/admin` running (`npm run admin` / `expo start`) logged in as staff for each restaurant, confirm both new sub_orders appear in realtime, advancing status in admin updates the tracking page (via polling) within ~5s, and channel/payment/table/delivery info is visible on the order card.
6. Confirm Yappy button is visibly disabled and cannot be selected.
7. Throttle network in devtools and sanity-check load/interaction speed against the kiosk app's feel.
