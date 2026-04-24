# Kiki — Platform Todo

> Living document. Update as features are built, bugs found, and improvements identified.

---

## Phase 1 — Close the Kiosk ↔ Admin Loop

> Goal: a customer places an order on the kiosk → it appears on the Admin POS in real time → gets printed to the kitchen. This is the revenue path.

### 📱 Kiosk (`apps/kiosk`)

- [ ] **Payment integration** — connect `PaymentScreen` to real payment terminal (Stripe Terminal, SumUp, or POS hardware SDK)
- [ ] **Kiosk lock mode (Android)** — single-app mode, disable nav bar, auto-restart on crash (`expo-task-manager` + Android device policy)
- [ ] **Offline resilience** — queue orders locally if Supabase is unreachable, auto-sync on reconnect
- [ ] **Image prefetching** — prefetch & cache menu item images from Supabase Storage on app load
- [ ] **`is_open` gate** — if `restaurants.is_open = false`, show a "Closed" screen instead of the menu
- [ ] **End-to-end hardware test** — run on a real Android tablet with live Supabase data, fix all bugs
- [ ] **Buzzer support** — logic for associating/displaying a hardware restaurant buzzer number for the order

### 🖨 Admin (`apps/admin`)

- [ ] **Sound/vibration alerts on new order** — play an audio cue when `orders` Realtime fires an INSERT
- [ ] **Thermal print formatting** — finalize receipt layout on the Senraise hardware, handle print failure gracefully
- [ ] **Use device tokens** — authenticate via `device_tokens` (like the Kiosk) instead of email/password
- [ ] **Menu item image uploads** — image picker → upload to Supabase Storage → save URL on `menu_items`
- [ ] **Daily sales summary** — simple card on OrdersScreen showing today's order count + revenue total
- [ ] **Error boundary + crash logging** — global handler, consider Sentry or Expo's crash reporting
- [ ] **Hardware test on Senraise POS** — sideload APK, test all flows end-to-end on the real device
- [ ] **Undo order status** — add a way to revert an order to its previous status locally and in Supabase
- [ ] **Buzzer input** — tie a restaurant buzzer number to the incoming or active order

### 🔗 Shared

- [ ] **`packages/shared` TypeScript types** — generate DB types from Supabase schema and share across all apps
- [ ] **Error boundary** — global error handling in each app
- [ ] **Environment config** — document how to configure `.env` for production vs development

---

## Phase 2 — Kitchen Display System

> Build `apps/kds` from scratch. Simple app: read orders, update status, display queue.

- [ ] **`AuthScreen`** — device token login (same pattern as Kiosk)
- [ ] **`QueueScreen`** — grid of active orders, color-coded by age (<5min green, <10min yellow, >10min red)
- [ ] **`CompletedScreen`** — orders marked `ready` in the last hour
- [ ] **Realtime subscription** — subscribe to `orders` filtered by `restaurant_id`
- [ ] **Status cycling** — tap a card to advance: `confirmed` → `preparing` → `ready`
- [ ] **Sound alert** — play a sound on new order INSERT
- [ ] **Landscape lock + immersive mode** — no status bar, full screen
- [ ] **EAS build + sideload** — APK deployed to kitchen Android tablet

---

## Phase 3 — Admin Web Panel

> Build `apps/admin-web` with Next.js 15. Owner-facing dashboard for managing the restaurant remotely.

- [ ] **`/login`** — Supabase Auth (email/password)
- [ ] **`/dashboard`** — daily revenue, order count, average ticket size
- [ ] **`/menu`** — full CRUD for categories, menu items, customization groups + options, image uploads
- [ ] **`/orders`** — order history with filters (date range, status) and CSV export
- [ ] **`/devices`** — generate and revoke kiosk device tokens per branch
- [ ] **`/settings`** — org profile, branch config, tax rate, currency, store hours
- [ ] **Auth middleware** — protect all routes, redirect to `/login` if unauthenticated
- [ ] **Multi-language toggle** — Spanish / English for the UI
- [ ] **Deploy to Vercel** — production deployment with env vars configured

---

## Backend (`supabase/`)

- [ ] **`authenticate_device` edge function** — validate device token → return scoped JWT for kiosk
- [ ] **`translate` edge function** — batch translate menu item names/descriptions via Google Translate API
- [ ] **Storage bucket** — create `menu-images` bucket with public read + authenticated write policy
- [ ] **pgcron / scheduled jobs** — optional: auto-archive completed orders older than 30 days
- [ ] **Monitoring** — Supabase dashboard alerts for DB CPU, Realtime connection count

---

## Infrastructure & DevOps

See [`build-release.md`](./build-release.md) for the full build and release strategy.

- [ ] **Phase 1: Manual EAS builds** — set up EAS for Admin, Kiosk, KDS
- [ ] **Phase 2: CI/CD pipelines** — GitHub Actions for automated builds on PR merge

---

## Improvements Backlog

> Ideas and polish items to revisit once the core product is stable.

- [ ] **Menu template sync** — shared "base menu" that can be pushed to new branches
- [ ] **Multi-currency support** — display prices in local currency per branch
- [ ] **Order analytics** — most popular items, peak hours heatmap
- [ ] **Push notifications** — alert staff on new orders without Realtime (fallback)
- [ ] **Customer receipt by SMS/email** — optional receipt sent after payment
- [ ] **Kiosk accessibility** — larger text mode, high contrast option
- [ ] **Dark / light mode toggle** — currently only dark mode
