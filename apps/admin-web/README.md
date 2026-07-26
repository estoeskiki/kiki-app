# admin-web — Kiki operator console

Multi-tenant dashboard for monitoring and managing orders, menus, locations and
staff. Restaurant admins see the same UI narrowed to their own scope, using the
same credentials as the React Native admin app (`apps/admin`).

```bash
npm run admin-web        # from the repo root
```

Needs `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (same project as `apps/order-web`).

> **Next.js 16**: Middleware is now `proxy.ts`, and several APIs differ from
> earlier versions. See `AGENTS.md` — read `node_modules/next/dist/docs/`
> before changing routing, caching or request APIs.

## Security model

**No `service_role` key in this app.** Every read and write runs on the signed-in
user's own JWT, so Postgres RLS is the single enforcement point — a bug in a page
cannot leak another tenant's rows, because the database refuses to return them.

- `lib/auth/dal.ts` — the authorization boundary. Every layout, page and Server
  Action calls it. Uses `auth.getUser()` (revalidates the JWT), never
  `getSession()` (trusts the cookie).
- `proxy.ts` — refreshes auth cookies, sets the per-request CSP nonce, and does
  an *optimistic* redirect to `/login`. Next's docs are explicit that proxy is
  not an authorization solution; it decides nothing about data access.
- Cross-tenant access comes from `platform_admins` + `is_platform_admin()`,
  which every RLS policy ORs in front of its tenant scope
  (`supabase/migrations/031_platform_admins.sql`).

The one exception is creating user accounts, which needs the Admin API. That
lives in the `admin-invite-user` Edge Function, which re-verifies the caller's
permissions with *their* JWT before using the service role — so the key stays
inside Supabase.

## Data model notes

- **Grain**: analytics aggregate `sub_orders`, not `orders`. A food-court order
  is one `orders` row fanned out into one `sub_orders` row per restaurant;
  summing `orders.total` double-counts across stalls. Order counts use
  `COUNT(DISTINCT order_id)`.
- **Channel**: `orders.channel` is `kiosk` | `web`, written by
  `supabase/functions/create-web-order` (the kiosk posts `channel:'kiosk'`
  through the same function).
- **Zone**: a row in `tables` — Sala VIP, Palco #1, Mesa 5. Reporting groups on
  `table_id`; display uses the `table_label` snapshot on the order, so renaming
  a zone never rewrites history. `table_id IS NULL` is the real "Sin zona"
  bucket (walk-up / slug entry).
- **Money**: integer cents everywhere. Only divided at display, in `lib/format.ts`.

## Layout

```
app/(dashboard)/     authenticated shell — all pages live here
app/login/           email + password, Server Action
proxy.ts             cookie refresh, CSP nonce, optimistic redirect
lib/auth/dal.ts      authorization boundary
lib/queries.ts       read layer (dashboard_* RPCs + the facts view)
lib/filters.ts       URL <-> filter state; all filter state lives in the URL
components/charts/   inline SVG, no charting library
```

Every page lives under the `(dashboard)` route group. Note that a route group
does not appear in the URL, so `app/page.tsx` and `app/(dashboard)/page.tsx`
both resolve to `/` — do not create the former.

Filter state is entirely in the URL, so every view is shareable and
server-rendered, and there is no client cache to disagree with what was queried.

UI is ported from a Claude Design project — see the `reference_admin_web_design`
note in project memory before adding new surfaces.
