# Kiki Admin Web — Multi-Tenant Analytics & Management Dashboard

## Context

`apps/admin-web` is currently an empty Next.js 16 starter. The goal is to turn it into a production-grade SaaS dashboard that serves four distinct audiences over a single, role-aware UI:

| Audience | Scope | Primary needs |
|----------|-------|---------------|
| **Super admin** (you) | All orgs, all food courts, all restaurants | Onboard restaurants/orgs, upload assets, provision users, see global analytics, manage food courts, monitor kiosk fleet |
| **Food court admin** | A single `food_courts` row → only the restaurants linked to it | Aggregate venue analytics, stall status, sub-order flow, assist stall managers |
| **Restaurant owner** | One `organizations` row → all its restaurants | Per-restaurant + roll-up analytics, menu/category/customization mgmt, staff mgmt, branding |
| **Restaurant manager** | One `restaurants` row | Branch analytics, menu CRUD, order ops, device tokens |

The DB (see `supabase/migrations/001_schema.sql`, `007_food_courts.sql`) already enforces multi-tenant isolation via RLS keyed on `restaurant_id`, and supports both standalone restaurants and food-court venues with parent `orders` + per-stall `sub_orders`. Two roles are missing today (`super_admin`, `food_court_admin`) and must be added before the dashboard can serve all audiences. Food court admins must see only restaurants that belong to their food court — never the parent org's other restaurants.

The dashboard must look like a **San Francisco–grade SaaS product**: dark-first, KIKI brand (`#ccff00` lime / `#ff6b98` pink / `#00f0ff` cyan on `#060e1d`), Space Grotesk + Syne typography, dense but airy layouts, premium micro-interactions.

---

## Stack Decision

**Framework:** Next.js 16 App Router (already installed) + React 19 + TypeScript + Tailwind v4
**Auth + DB:** Supabase (existing) — `@supabase/ssr` for server-side sessions in RSC + middleware
**UI primitives:** shadcn/ui (Tailwind v4 compatible, fully brandable)
**Charts:** Recharts under the hood, Tremor blocks for KPI cards/sparklines/donuts
**Tables:** TanStack Table v8
**Data fetching:** Server Components for first paint + TanStack Query v5 for client mutations & realtime invalidation
**URL state:** nuqs (filter persistence in dashboards)
**Forms:** React Hook Form + Zod
**Toasts:** Sonner
**Icons:** Lucide
**Motion:** Framer Motion (subtle only)
**i18n:** next-intl (matches existing JSONB i18n schema for menu)
**Dates:** date-fns + date-fns-tz (restaurant timezone aware)
**Storage:** Supabase Storage with RLS-aligned policies
**Image:** next/image for optimization

---

## Phased Plan

### Phase 0 — Foundation (groundwork, no user-facing feature)

**Database — new migration `008_admin_roles_and_storage.sql`:**

1. Extend `org_members.role` CHECK to include `'super_admin'` and `'food_court_admin'`.
2. Make `org_members.org_id` nullable (super admin has no org).
3. Add `org_members.food_court_id uuid REFERENCES food_courts(id) ON DELETE CASCADE`.
4. Add a partial unique index for super admins: `(user_id) WHERE role = 'super_admin'`.
5. Add helper functions (SECURITY DEFINER STABLE):
   - `is_super_admin() returns boolean`
   - `get_user_food_court_id() returns uuid`
6. Update **every** existing helper and policy to also pass when `is_super_admin()` is true:
   - `get_user_restaurant_ids()` returns all restaurants when super admin
   - For `food_court_admin`: returns `ARRAY(SELECT id FROM restaurants WHERE food_court_id = get_user_food_court_id())`
7. Update `food_court_select` policy so food court admins see their food court directly; super admins see all.
8. Update `org_select` so food court admins can read the orgs that own restaurants in their venue (read-only).
9. Restrict `members_*` policies so food court admins can read members of restaurants in their venue but cannot mutate; super admins can do anything.
10. Update `handle_new_user()` trigger to honor `super_admin` and `food_court_admin` metadata on signup.

**Database — new migration `009_analytics_views.sql`:**

Postgres views (re-using RLS through `security_invoker = true`):
- `v_orders_enriched` — orders + sub_orders unioned, joined to restaurant + org + food_court, with `effective_total`, `effective_restaurant_id`, `local_date` (in restaurant tz), `local_hour`.
- `v_order_lines` — order_items joined to menu_items with current name (jsonb→text by locale param via RPC instead).
- `v_kiosk_fleet` — device_tokens + restaurant + food_court + last_seen_at staleness bucket (live/stale/dead).

Materialized views (refreshed by `pg_cron` every 5 min):
- `mv_daily_restaurant_revenue (restaurant_id, day, orders, gross_cents, net_cents, aov_cents)`
- `mv_hourly_restaurant_orders (restaurant_id, day, hour, orders)`
- `mv_item_popularity_30d (restaurant_id, menu_item_id, qty, revenue_cents)`
- `mv_food_court_stall_revenue (food_court_id, restaurant_id, day, gross_cents, orders)`

Indexes on `(restaurant_id, day)` and `(food_court_id, day)`.

**Database — RPCs (`010_analytics_rpcs.sql`):**

All take a scope (`p_restaurant_ids uuid[] DEFAULT NULL`) so the same function works for owners (rolled up) and managers (single). Default uses `get_user_restaurant_ids()`. RLS still enforced via the underlying views/MVs.

- `rpc_kpi_summary(p_from, p_to, p_restaurant_ids)` → revenue, orders, AOV, % vs previous period
- `rpc_revenue_timeseries(p_from, p_to, p_granularity, p_restaurant_ids)` → daily/hourly buckets
- `rpc_top_items(p_from, p_to, p_limit, p_restaurant_ids)`
- `rpc_hour_dow_heatmap(p_from, p_to, p_restaurant_ids)` → 7×24 cells
- `rpc_funnel(p_from, p_to, p_restaurant_ids)` → confirmed/preparing/ready/completed/cancelled counts
- `rpc_food_court_stall_breakdown(p_from, p_to, p_food_court_id)`
- `rpc_kiosk_fleet_status(p_scope_ids)` (for monitoring page; placeholder until monitoring tables ship)

**Storage buckets (in migration as `insert into storage.buckets`):**
- `org-logos` (public read)
- `org-welcome-bg` (public read)
- `restaurant-logos` (public read)
- `restaurant-backgrounds` (public read)
- `menu-images` (public read)
- `food-court-logos` (public read)

RLS on `storage.objects`: write requires user to have access to the path's `restaurant_id` / `org_id` / `food_court_id` (path convention: `${scopeId}/${filename}`). Super admins can write anywhere.

**App scaffolding (`apps/admin-web`):**

Install:
```
shadcn@latest init
@supabase/ssr @supabase/supabase-js
@tanstack/react-query @tanstack/react-table
@tremor/react recharts
react-hook-form zod @hookform/resolvers
sonner lucide-react framer-motion nuqs
date-fns date-fns-tz next-intl
```

Files to create:
- `apps/admin-web/middleware.ts` — Supabase session refresh + auth gating; redirects unauthenticated → `/login`
- `apps/admin-web/lib/supabase/server.ts` — `createServerClient()` reading cookies
- `apps/admin-web/lib/supabase/client.ts` — `createBrowserClient()` (replaces current `packages/supabase/client.ts` for web; native apps unaffected)
- `apps/admin-web/lib/supabase/admin.ts` — service-role client for server-only mutations (user provisioning)
- `apps/admin-web/lib/auth/session.ts` — `getSession()`, `getViewer()` returning `{ user, role, orgId, restaurantId, foodCourtId, scope }`
- `apps/admin-web/lib/auth/guards.ts` — `requireRole()`, `requireScope()` for RSC route protection
- `apps/admin-web/lib/format.ts` — money (cents→locale), dates (in restaurant tz), pluralization
- `apps/admin-web/app/globals.css` — Tailwind v4 `@theme` block exposing KIKI tokens (`--color-primary`, `--color-surface`, etc.) + Space Grotesk/Syne via `next/font`
- `apps/admin-web/components/ui/*` — shadcn primitives (Button, Card, Sheet, Dialog, DataTable, Tabs, DropdownMenu, Command, Toast)
- `apps/admin-web/components/brand/*` — logo, glow effects, branded primitives matching `KIKI-brand.md`
- `apps/admin-web/lib/types/database.ts` — generated via `supabase gen types typescript`

Generate Supabase types into `packages/supabase/types.ts` (currently a placeholder).

---

### Phase 1 — Auth, Shell & Super Admin Restaurant CRUD

**Routes (App Router):**

```
app/
├─ (auth)/
│   ├─ login/page.tsx            # Email + password (Supabase auth)
│   └─ accept-invite/page.tsx    # For provisioned users (token in URL)
├─ (app)/
│   ├─ layout.tsx                # Sidebar shell, scope switcher, user menu
│   ├─ page.tsx                  # Redirects to default landing per role
│   ├─ overview/page.tsx         # Phase 2
│   ├─ restaurants/
│   │   ├─ page.tsx              # List (super admin sees all, owner sees own org)
│   │   ├─ new/page.tsx          # Super admin / owner: create restaurant
│   │   └─ [restaurantId]/
│   │       ├─ page.tsx          # Single restaurant overview
│   │       ├─ branding/page.tsx # Logo, background, slogan upload
│   │       ├─ menu/             # Phase 2
│   │       ├─ team/             # Phase 3
│   │       ├─ devices/page.tsx  # Device tokens
│   │       └─ settings/page.tsx # Tax, currency, timezone, hours
│   ├─ orgs/                     # Super admin only: org CRUD
│   ├─ food-courts/              # Phase 4
│   ├─ team/                     # Phase 3
│   ├─ kiosks/                   # Phase 4
│   └─ analytics/                # Phase 2
└─ api/
    ├─ users/invite/route.ts     # Server route using service-role client
    ├─ uploads/sign/route.ts     # Signed upload URLs for storage
    └─ revalidate/route.ts       # Cache busting after mutations
```

**Sidebar shell (`components/shell/Sidebar.tsx`):**
- Top: KIKI wordmark with lime glow
- Scope switcher: super admin can switch between "All orgs / specific org / specific food court"; owner can switch between their restaurants; manager has no switcher
- Nav items rendered conditionally per `getViewer().role`
- Bottom: user menu (theme toggle, language, sign out)

**Branding page (per restaurant):**
- Drag-and-drop image upload (logo, background) via signed Supabase Storage URLs
- Slogan + welcome bg input writes to `organizations.slogan`, `organizations.welcome_bg_url` for org assets and `restaurants` for restaurant-level
- Live preview tile mirroring kiosk welcome screen

**Restaurant list / create:**
- Super admin: full CRUD across all orgs, can pick `org_id` from a Combobox
- Owner: only sees own org's restaurants, can create within own org
- Form fields: name, slug (auto from name), address, timezone (Combobox), currency, tax_rate, optional `food_court_id`

**Realtime:** Restaurants list subscribes to `restaurants` insert/update via Supabase channel.

---

### Phase 2 — Analytics Dashboard

**Overview page (`/overview`):**

Layout: 12-col grid, dense but breathable.

```
┌─────────────────────────────────────────────────────────────┐
│  Header: scope label (e.g. "Kiki Centro · Last 7 days")     │
│  Date-range picker (nuqs ?from=&to=) | Compare prev period  │
├──────────┬──────────┬──────────┬──────────┬─────────────────┤
│ Revenue  │ Orders   │ AOV      │ Cancel%  │  ← KPI cards    │
│ €12,430  │ 482      │ €25.79   │ 2.1%     │   (Tremor)      │
│ ▲ 8.2%   │ ▲ 4.0%   │ ▲ 3.8%   │ ▼ 0.4%   │                 │
├──────────┴──────────┴──────────┴──────────┴─────────────────┤
│  Revenue timeseries (Recharts area chart, KIKI lime fill)   │
│  Granularity tabs: Hour | Day | Week                        │
├──────────────────────────────┬──────────────────────────────┤
│  Hour×DOW heatmap            │  Top 10 items (bar chart)    │
│  (Recharts ScatterChart      │  + qty + revenue split       │
│   styled as heatmap)         │                              │
├──────────────────────────────┴──────────────────────────────┤
│  Order funnel (Tremor) | Live orders feed (realtime list)   │
└─────────────────────────────────────────────────────────────┘
```

**Data flow per panel:**
- RSC fetches initial data via the Phase 0 RPCs through server Supabase client
- Hydrates a TanStack Query cache (key: `[panel, scope, from, to]`)
- Realtime subscription on `orders` (and `sub_orders` in food-court mode) invalidates the query keys for any panel scoped to the affected restaurant

**Scope-aware:**
- Super admin / owner: roll-up by default, with a Combobox to drill into a single restaurant
- Food court admin: roll-up across stalls in their venue + per-stall breakdown using `rpc_food_court_stall_breakdown`
- Manager: single restaurant always

**Per-restaurant analytics page (`/restaurants/[id]/analytics`):** same components, pre-scoped.

---

### Phase 3 — Menu Management & Team

**Menu management (`/restaurants/[id]/menu`):**
- Two-pane layout: left = categories (drag-to-reorder, sort_order), right = items grid for selected category
- Item editor (Sheet): bilingual name/description (ES/EN tabs writing into `name` jsonb), price (cents-aware input shown as €XX.XX), image upload, available toggle, popular toggle
- Customization editor (Dialog): groups (required, max_selections) and options (price_modifier, sort_order)
- All writes via TanStack Query mutations + optimistic updates + Sonner toasts
- Realtime subscription so two managers editing the same menu stay in sync

**Team management (`/team` and `/restaurants/[id]/team`):**
- List org_members with role badge, scope (org/restaurant/food court), last sign-in
- Invite flow: super admin / owner picks role + scope → POST `/api/users/invite` → server uses service-role client to create user + org_members row + send Supabase invite email
- Edit role / revoke access
- Food court admin can view but not mutate members of restaurants in venue
- Manager cannot see this page

---

### Phase 4 — Food Courts, Live Ops & Kiosk Fleet

**Food courts (`/food-courts`, super admin):**
- CRUD for `food_courts` table, logo upload to `food-court-logos` bucket
- Stall management: link/unlink restaurants by setting `restaurants.food_court_id`
- Provision food court admin users scoped to a venue

**Food court detail (`/food-courts/[id]`):**
- Shows venue analytics (stall revenue split, busiest stall, customer name flow)
- Live sub_orders feed grouped by stall, with parent order number rolled up

**Live ops (`/live` or per-restaurant):**
- Realtime order board (kanban: confirmed → preparing → ready → completed)
- Optional sub_order view in food-court mode
- Click an order → drawer with line items + customizations
- Status changes via Supabase update, realtime echoes back

**Kiosk fleet (`/kiosks`):**
- Table powered by `v_kiosk_fleet` view: device name, scope, last_seen, status badge (live/stale/dead based on `last_seen_at` thresholds)
- Issue/revoke device tokens (super admin / owner / manager)
- Placeholder for richer monitoring once `monitoring-plan.md` tables ship — RPC `rpc_kiosk_fleet_status` is the integration point

---

## Critical Files to Create / Modify

**New migrations (`supabase/migrations/`):**
- `008_admin_roles_and_storage.sql` — roles + storage buckets + RLS
- `009_analytics_views.sql` — views + materialized views + pg_cron
- `010_analytics_rpcs.sql` — analytics functions

**Modify:**
- `packages/supabase/types.ts` — generate from new schema
- `apps/admin-web/app/globals.css` — KIKI brand tokens for Tailwind v4
- `apps/admin-web/app/layout.tsx` — fonts, providers (TanStack Query, theme, intl)
- `apps/admin-web/package.json` — new deps
- `supabase/seed.sql` — add a super admin seed user + food court admin for `Plaza Mayor Food Hall`

**New (high-leverage):**
- `apps/admin-web/middleware.ts`
- `apps/admin-web/lib/supabase/{server,client,admin}.ts`
- `apps/admin-web/lib/auth/{session,guards}.ts`
- `apps/admin-web/lib/format.ts`
- `apps/admin-web/lib/realtime/useOrdersChannel.ts`
- `apps/admin-web/components/shell/{Sidebar,Topbar,ScopeSwitcher,UserMenu}.tsx`
- `apps/admin-web/components/charts/{RevenueArea,HourDowHeatmap,TopItemsBar,FunnelBars,KpiCard}.tsx`
- `apps/admin-web/components/uploads/ImageDropzone.tsx`

---

## Reuse from Existing Codebase

- **Supabase client pattern:** `packages/supabase/client.ts` and `packages/supabase/index.ts` already export `createClient` + `Database` type. Extend `packages/supabase/types.ts` (currently empty) by running `supabase gen types typescript --project-id <id> > packages/supabase/types.ts`.
- **Auth patterns:** `apps/admin/src/store/useAuthStore.ts` has the metadata extraction (org_id, restaurant_id, role) — port the shape into `lib/auth/session.ts`.
- **Menu shape & queries:** `apps/admin/src/store/useMenuStore.ts` already does the nested select `menu_items(*, customization_groups(*, customization_options(*)))` — reuse the query string in the web menu page.
- **Theme tokens:** `apps/admin/src/theme/themes.ts` defines the KIKI palette in TS — translate to Tailwind v4 `@theme` block instead of duplicating.
- **Brand reference:** `KIKI-brand.md` is the source of truth for colors, fonts, glow effects.

---

## Verification

**Per phase:**

Phase 0:
- `supabase db reset` runs all migrations cleanly
- `psql` smoke test: create a super admin, food court admin, owner, manager; verify each `select * from restaurants` returns the expected scope
- `select rpc_kpi_summary(...)` returns sane numbers against seed data
- Storage upload: signed URL works for owner on own restaurant, denied on another org's restaurant

Phase 1:
- Sign in as each role → land on a role-appropriate page
- Super admin can create a restaurant; owner can create within own org; manager cannot
- Upload a logo → appears in `restaurant-logos` bucket → renders on branding page
- Sign out clears session and redirects

Phase 2:
- Insert orders via SQL → KPI cards reflect change after MV refresh (or directly via RPC) within seconds
- Date range picker updates URL (`?from=&to=`) and chart refetches
- Realtime: insert an `orders` row in another tab → live feed updates without refresh

Phase 3:
- Create a menu item with bilingual content → renders correctly with locale switch
- Reorder categories → DB `sort_order` updated
- Invite a manager via email → user receives invite, accepts, lands in dashboard scoped to their restaurant

Phase 4:
- Create a food court, link restaurants, create food court admin → admin sees only those stalls
- Create a parent order with sub_orders → live ops shows aggregated parent + per-stall breakdown
- Mark all sub_orders ready → trigger flips parent to ready in realtime UI

**E2E:** Add Playwright in Phase 1; one happy-path test per role per phase. Run `pnpm --filter admin-web test:e2e` in CI.

**Type safety:** `tsc --noEmit` clean after every phase; regenerate Supabase types after each new migration.

**Visual QA:** Each page reviewed against `KIKI-brand.md` — Space Grotesk for headlines, Syne for body, lime/pink/cyan accents on dark surfaces, glow effects on primary CTAs.

---

## Splitting Into a Separate Repository

You can absolutely build the dashboard in its own repo. The hard rule: **the Supabase project (DB, RLS, Storage, Auth) is a single shared backend for kiosk, KDS, native admin, and admin-web**. Whatever repo strategy you pick, the same Supabase URL + anon key feed all four apps. What changes is only where the *code* and *migrations* live.

### Recommended split: two repos

| Repo | Owns |
|------|------|
| **`kiki`** (existing monorepo) | All Supabase migrations, seed, edge functions; `apps/admin` (RN), `apps/kiosk` (RN), `apps/kds` (RN); shared RN packages; brand reference (`KIKI-brand.md`) as source of truth |
| **`kiki-admin-web`** (new repo) | Next.js 16 app, all dashboard UI, server routes, middleware. Consumes the shared Supabase backend over network. |

This keeps the database schema, RLS, and migrations co-located with the apps that depend on them most tightly (the native ops apps), while letting the web dashboard ship on its own cadence with its own CI, hosting (Vercel), and dependencies.

### What stays in `kiki`

- **All `supabase/migrations/`** — including the three new migrations from this plan (`008_admin_roles_and_storage.sql`, `009_analytics_views.sql`, `010_analytics_rpcs.sql`). The DB is the contract; everyone reads from it.
- **`supabase/seed.sql`** — extended with super admin + food court admin seed users.
- **Any Supabase Edge Functions** (e.g., the `authenticate_device` callsite, future `invite_user` if you move it server-side here instead of Next.js API routes).
- **`packages/supabase/`** — keep generating types here (`supabase gen types typescript > packages/supabase/types.ts`). Native apps already import from this.
- **`apps/admin/`, `apps/kiosk/`, `apps/kds/`** — unchanged.
- **`KIKI-brand.md`** — source of truth for design tokens.
- **Architecture docs** (`db_architecture.md`, `UPSELL_ARCHITECTURE.md`, `migration-food-courts.md`, `monitoring-plan.md`, `dashboard-plan.md`).

### What moves to `kiki-admin-web`

Everything currently scoped under `apps/admin-web/` in this plan:

- `app/`, `components/`, `lib/`, `middleware.ts`
- Next.js config, Tailwind config, `package.json`, `tsconfig.json`
- E2E tests (Playwright)
- Vercel project config

Plus a few things that need to be **duplicated or imported**:

- **Supabase types** (`Database` TS type) — see options below
- **Brand tokens** — copy `KIKI-brand.md` into the new repo's `docs/` and translate it into `app/globals.css` `@theme` block. Treat it as a versioned snapshot; if KIKI ever rebrands, both repos update.
- **`.env` template** — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only)

### Sharing the `Database` TypeScript type across repos

Pick one (in order of effort):

1. **Copy + regenerate (simplest, recommended for now):** After every migration in `kiki`, run `supabase gen types typescript --project-id <id> > packages/supabase/types.ts`, commit it there, and copy/paste into `kiki-admin-web/lib/types/database.ts`. Trivial, zero infra, fine for a small team. CI script in `kiki-admin-web` can fetch the file from a GitHub raw URL on every build to stay fresh.
2. **Private npm package (`@kiki/supabase-types`):** Publish `packages/supabase/` to GitHub Packages or npm under your scope. `kiki-admin-web` installs it like any dep. Bump version after each migration. Better as the team grows.
3. **Git submodule:** Mount `kiki/packages/supabase` into `kiki-admin-web`. Powerful but submodules are fiddly — only worth it if you have other shared code too.

Start with **#1**. Promote to #2 when copy/paste becomes annoying.

### What still needs to be done in `kiki` (regardless of split)

These are **pure backend** items from this plan and don't depend on which repo the dashboard lives in:

1. Write and apply migration `008_admin_roles_and_storage.sql` (roles + storage buckets + RLS).
2. Write and apply migration `009_analytics_views.sql` (views + materialized views + pg_cron).
3. Write and apply migration `010_analytics_rpcs.sql` (analytics RPCs).
4. Update `supabase/seed.sql` with super admin + food court admin seed rows.
5. Regenerate `packages/supabase/types.ts`.
6. Smoke-test all RLS policies via `psql` (super admin sees all, food court admin sees only their venue's stalls, owner sees their org, manager sees their branch).
7. (Optional) Convert the `/api/users/invite` server route into a Supabase Edge Function so user provisioning can also be triggered from native apps later.

### What needs to be done in `kiki-admin-web` (new repo)

Everything in **Phase 0 app scaffolding** through **Phase 4** of this plan, minus the migrations. Concretely:

1. `npx create-next-app@latest kiki-admin-web` (or copy current `apps/admin-web/` as a starting point and prune monorepo references).
2. Install the dep set listed in Phase 0.
3. Set up `.env.local` pointing at the shared Supabase project.
4. Configure shadcn/ui, Tailwind v4 with KIKI tokens, fonts.
5. Wire `@supabase/ssr` middleware + auth.
6. Implement Phases 1–4 routes/components.
7. Set up Vercel deploy (one project per environment: preview/staging/prod).
8. Add CI (GitHub Actions): lint, typecheck, Playwright, optional script to refresh `Database` types from `kiki`.

### What to delete from `kiki` after the split

- `apps/admin-web/` (the empty Next.js starter that's currently there). It moves to the new repo, so remove it from this monorepo to avoid drift and confusion.
- Any Turborepo/workspace entries for `admin-web` in the root `package.json` / `pnpm-workspace.yaml`.

### Trade-offs to be aware of

| Pro of split | Con of split |
|--------------|--------------|
| Independent deploys (Vercel push without touching native apps) | Type drift risk — the moment migrations land in `kiki` and types aren't synced, `kiki-admin-web` can break silently. Mitigate with a CI step that fetches latest types. |
| Smaller dependency surface per repo | Two PRs for cross-cutting changes (e.g., add a column → update RPC → consume in dashboard) |
| Different team / contributors can own each repo | Can't atomically refactor across DB + dashboard in one commit |
| Faster CI on each side | Onboarding requires cloning both repos and matching env vars |

### Alternative: keep it in the monorepo

If you're a solo developer or a small team for the foreseeable future, **keeping `admin-web` inside `kiki`** is the lower-friction choice — atomic PRs across DB + dashboard, no type-sync chore, one CI pipeline. The split pays off mainly when (a) the team grows and ownership separates, (b) Vercel deploys become noisy alongside the native app workflows, or (c) you want to open-source one half but not the other.
