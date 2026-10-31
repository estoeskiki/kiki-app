# Plan: Payment onboarding from admin-web

Status: **agreed** (questions answered 2026-10-31) · Written 2026-10-31 · Owner: Edgar
Design: `plans/payments-architecture.md` (rev 4+). Backend it builds on: `plans/payments-phase-2.md` (S1, S4, S5).
Tests: `plans/payments-test-matrix.md` layer H, including H.3 onboarding (H-21…H-27), + section 9 here.

## 1. Goal

A new food court or restaurant gets payments working **from admin-web only**: no code, no SQL, no Edge secrets,
no agent.

> Open the restaurant (or food court) → **Pagos** → pick the methods it accepts on web and kiosk → for methods
> that need a merchant, add the merchant's credentials → **Probar conexión** → done. Checkout shows the new methods
> immediately.

Every provider is an existing adapter (`_shared/payments/<provider>.ts`). Onboarding never adds code; it only
creates a `payment_accounts` row (whose merchant), its encrypted secret, and `payment_method_settings` rows (which
methods, which platform, which merchant). A **new provider** (e.g. the card gateway in phase 5) is the only thing
that needs code: one adapter, after which it appears in this UI by itself.

## 2. Where it lives (placement)

Follows `feedback_ui_placement`: payments belong to the entity that collects, so the UI is a **Pagos** card inside
the existing detail pages, not a new top-level page and not a top-of-page card.

| Page | What the Pagos card shows |
|---|---|
| `app/(dashboard)/food-courts/[foodCourtId]/page.tsx` | **Modo de cobro** (venue / per_restaurant) + — if `venue` — methods × web/kiosk and the food court's merchants; if `per_restaurant` — one row per restaurant with its readiness and a link to its page |
| `app/(dashboard)/restaurants/[restaurantId]/page.tsx` | methods × channels the restaurant may own (see 4.3) and the restaurant's merchants |
| Standalone restaurant (no `food_court_id`) | same as the restaurant page, all channels |

Placement on the page: full-width card **below** the existing two-column grid (after Detalles / Estado / Zonas).
Visual language from `reference_admin_web_design` (hairline 12px cards, uppercase micro-labels, pill badges, 28px
icon buttons with lime hover). Components: reuse `Card`, `CardTitle`, `CardLabel`, `Badge`, `Button`, `FlagSwitch`
pattern, `Select`, `Table`.

Kiki's own merchants (owner = Kiki, used by `venue` food courts by default) are managed in
`app/(dashboard)/settings` → **Cuentas de cobro de Kiki** (platform admins only), same component.

## 3. Screens

### 3.1 Pagos card (restaurant, standalone or venue food court)

```
PAGOS                                                     [Vista previa del checkout]
─────────────────────────────────────────────────────────────────────────────────────
MÉTODO                   WEB     KIOSCO    COBRA CON                    ESTADO
Yappy                    [on]    [on]      Yappy · Plaza Mayor (PROD) ▾  ● Listo
Tarjeta                  [off]    —        —                             Sin cuenta
Apple Pay / Google Pay   [off]    —        —                             Sin cuenta
Tarjeta (datáfono)        —      [off]     —                             Fase 4
Efectivo en caja         [on]    [on]      Restaurante en caja           ● Listo
Yappy en entrega         [on]    [off]     Restaurante en entrega        ● Listo
Tarjeta en entrega       [on]    [on]      Restaurante en entrega        ● Listo
─────────────────────────────────────────────────────────────────────────────────────
CUENTAS DE COBRO                                                    [+ Agregar cuenta]
Yappy · Plaza Mayor   PROD   ID 1234…89   Clave v2 · 31 oct   ✓ Probada 31 oct 10:02
                                                        [Probar] [Rotar clave] [⋯]
─────────────────────────────────────────────────────────────────────────────────────
Historial ▸   (who changed what, from payment_config_audit)
```

Rules for the grid:
- Rows: `payment_methods` ordered by `sort_order`. A cell is shown only if the channel is in the method's
  `allowed_channels` **and** the owner may hold it (4.3); otherwise `—`.
- Switch on a method that `needs_account` with no merchant selected → the "Cobra con" select opens; saving
  without a merchant is blocked client-side and rejected server-side (guard trigger).
- "Cobra con" lists merchants whose provider supports the method (`payment_providers.methods`) and that the owner
  may use: own merchants; for a venue food court also Kiki's merchants (switching to/from Kiki's is platform
  admin only, architecture 4.2). Disabled merchants are listed but not selectable.
- Status per row: `Listo` (on, merchant enabled, last test OK), `Falta probar` (merchant never tested or test
  older than the last secret change), `Cuenta deshabilitada`, `Solo UAT` (merchant `env='uat'` — shown in amber),
  `Sin cuenta`, `Fase 4` / `Fase 5` (method has no adapter yet → switch disabled).
- Pay-later methods have no merchant: "Cobra con" shows who collects in person.
- Every change saves immediately per row (same as `FlagSwitch`), with optimistic UI and rollback + toast on the
  server error message (guard messages are already readable Spanish, see 6.3).

### 3.2 Agregar cuenta de cobro (drawer)

1. **Proveedor** — select of providers that have an adapter (from `describe_providers`, 5.2). Phase 3: Yappy only.
2. **Ambiente** — `UAT (pruebas)` / `Producción`. Production is preselected; UAT is shown with a warning badge.
3. **Nombre** — e.g. `Yappy · Plaza Mayor`. Prefilled `<Proveedor> · <owner name>`.
4. **Fields rendered from the adapter's field list** (5.1). For Yappy:
   - `ID del comercio` (config, text, required)
   - `Clave secreta` (secret, password input, required)
   - `Dominio` (config, URL, under "Avanzado", default `https://order.estoeskiki.com`)
   Help text under each field says where to find it ("Yappy Comercial → Botón de Pago → Credenciales").
5. **Guardar y probar** → server action → `payment-admin onboard_account` (create + config + encrypted secret in
   one transaction) → then `test_account` automatically. Result shown inline:
   ✓ "Conexión exitosa" or ✗ the adapter's readable error ("Yappy rechazó el ID del comercio o la clave").
   A failed test keeps the account (so the user can fix it) but it is marked `Falta probar` and cannot be
   selected for a **production** method until a test passes.

Secret inputs: `type="password"`, `autocomplete="off"`, never prefilled, cleared after submit, no "show" toggle
after saving. The drawer never receives the secret back.

### 3.3 Account actions
- **Probar** → `test_account`. Stores result (5.3) and shows it.
- **Rotar clave** → drawer with only the secret fields → `set_secret` (new version active, old retired — late IPNs
  still verify, architecture 4.4) → auto test.
- **Editar** (⋯) → non-secret config (name, merchant id, domain) → `update_account_config` → auto test.
- **Deshabilitar / Habilitar** (⋯) → `set_account_enabled` with a reason. Disabling a merchant in use shows which
  methods stop working (from the settings that reference it) and asks to confirm.

### 3.4 Modo de cobro (food court page only)
Segmented control **Todo el patio (un carrito)** / **Por restaurante**, with one line explaining each:
- Todo el patio: "Un carrito con varios restaurantes. El patio (o Kiki) cobra los pagos en línea."
- Por restaurante: "Cada pedido es de un solo restaurante. Cada restaurante configura y cobra sus pagos."
Switching calls `set_payment_mode`. The guard (`payment_mode_guard`, phase 2 S1) rejects inconsistent switches;
the UI shows what blocks it (e.g. "Hay métodos configurados a nivel de patio; desactívalos primero") with a link.
Platform admin only (architecture 4.2: food court admin can only request).

### 3.5 Vista previa del checkout
Button on the Pagos card → panel with two columns, **Web** and **Kiosco**, listing exactly what checkout will show,
by calling `resolve_payment_options` (phase 2 S2) for that owner. Also lists `hidden` methods with their reason
(`outside_uat_hours`, `account_disabled`, `circuit_open`, …). This is the "is it really working" check and needs no
test order. For a restaurant inside a venue food court, the Web column shows the food court's options (with a note)
and the Kiosco column the restaurant kiosk's options including the fallback (architecture 2.1).

### 3.6 Readiness on lists
`restaurants/page.tsx` and `food-courts/page.tsx`: a small `Pagos` badge per row — `Listo` / `Incompleto` /
`Solo UAT` — computed from the same data as 3.1 (no new query per row: one `payment_onboarding_status` view, 5.4).

## 4. Rules the UI follows (all enforced server-side too)

### 4.1 Who
- **Phase 3: platform admins only** (`is_platform_admin()`), exactly like `payment-admin` in phase 2 — Kiki staff
  type merchants' credentials (decided 2026-10-31). Other roles
  see the Pagos card read-only (methods + status, no merchant ids, no actions).
- Later (flag `payments.self_service`): food court admins and restaurant owners per architecture 4.2, same UI,
  role checks already inside `payment-admin`.

### 4.2 Secrets
- Path: browser → Next server action (HTTPS) → `payment-admin` (HTTPS, caller's JWT) → encrypted with the KEK →
  `payment_account_secrets`. The server action forwards the value and never stores, logs or returns it; on error
  it returns only `error`/`message` from the function.
- No API returns a secret or a decrypted value. `list` returns `secret_versions: [{version, state, created_at}]`.
- Merchant id is not secret but is shown masked (`1234…89`) in lists; full value only in Editar.
- `set_secret` / `onboard_account` request bodies are never logged (phase 2 S5 rule). Vercel: the server action
  must not `console.log` form data.
- No re-authentication step for secret writes (decided 2026-10-31): a valid platform-admin session is enough.

### 4.3 What each owner may configure (mirror of architecture 4.3 guards)
| Owner | Channels | Merchants it can pick |
|---|---|---|
| Venue food court | web + kiosk | own + Kiki's |
| Restaurant in a venue food court | **kiosk only** (its own kiosks); account own or empty = fallback to the food court's merchant | own |
| Restaurant in a per_restaurant food court | web + kiosk | own |
| Standalone restaurant | web + kiosk | own |
| `card_present` | restaurant only, kiosk only, needs a terminal (phase 4) | own |

The UI reads these from `describe_owner` (5.2) instead of re-implementing them, so UI and guards cannot disagree.

### 4.4 Production safety
- A method on a **production** owner can only point at a merchant whose last test passed after its last secret
  change (`payment-admin` checks; UI shows why).
- `env='uat'` merchants show `Solo UAT` everywhere and trigger the UAT-hours gate (as today).
- **From go-live (2b) on, UAT merchants only on demo food courts** (`food_courts.is_demo`, decided 2026-10-31).
  Guard rule `uat_account_on_live_owner`: an enabled setting may reference an `env='uat'` account only if its owner
  is a demo food court or a restaurant inside one. Standalone restaurants and non-demo food courts (Plaza Mayor,
  COS) can only use `prod` merchants. Added by the go-live migration, not in phase 2, because Plaza Mayor (not a
  demo) runs on the UAT merchant until then. The migration fails if any live owner still points at a UAT merchant.
  The UI hides UAT in "Ambiente" for non-demo owners after go-live.
- Every write lands in `payment_config_audit` (phase 2 S1) with the caller as actor; the Historial section shows it.

## 5. Backend additions

Most of it exists after phase 2. These additions are small and are **folded into phase 2** (S1, S4, S5 of
`plans/payments-phase-2.md`) so the UI is frontend-only work.

### 5.1 Adapter field list (phase 2 S4)
Each adapter declares its onboarding fields and a credential test:
```ts
export interface CredentialField {
  key: string                       // config key or secret key
  kind: 'config' | 'secret'
  label: string                     // Spanish, shown in the UI
  input: 'text' | 'url' | 'password'
  required: boolean
  pattern?: string                  // client-side hint; validateConfig is the real check
  default?: string
  advanced?: boolean                // shown under "Avanzado"
  help?: string
}
export interface PaymentAdapter {
  // …existing members (phase 2 S4)…
  label: string                                   // 'Yappy'
  fields: CredentialField[]
  testCredentials(creds: Credentials): Promise<{ ok: true } | { ok: false; code: string; message: string }>
}
```
- `Credentials.secret: string` becomes `secrets: Record<string, string>` (the encrypted plaintext is a JSON object
  of all `kind:'secret'` fields), so a provider with several secrets (API key + webhook key) fits the same table.
  Yappy: `{ secretKey }`.
- Yappy `testCredentials`: call `validate/merchant` with the merchant id + domain (same call as step 1 of
  `createCharge`, 8 s timeout). Token returned ⇒ ok. Never calls `payment-wc`, so nothing is charged.
  Errors mapped to readable messages (wrong id / wrong domain / Yappy down ⇒ `provider_unavailable`, not a
  credential failure).

### 5.2 New `payment-admin` actions (phase 2 S5)
| action | input | effect |
|---|---|---|
| `describe_providers` | — | `[{code, label, methods, fields}]` for providers with an adapter in `registry.ts`; no secrets |
| `describe_owner` | `owner` | allowed channels per method, selectable merchants, mode, and whether the caller may write (4.1, 4.3) |
| `onboard_account` | `provider, env, display_name, owner, config, secrets` | one transaction: `create_account` + `validateConfig` + encrypted secret v1; returns `account_id` |
| `update_account_config` | `account_id, config` (partial) | merge + `validateConfig`; marks test stale |
| `test_account` | `account_id` | decrypt active secret, `adapter.testCredentials`, store result (5.3) |
| `preview_options` | `owner` | `resolve_payment_options` for web and kiosk for that owner (3.5) |
| `list_audit` | `owner, limit` | `payment_config_audit` rows for the Historial |

`set_secret` input becomes `account_id, secrets` (object). `import_env_config` / `import_env_secret` stay for
scripted setup (phase 2 S8) and accept any env var matching
`^YAPPY_(UAT|PROD)(_[A-Z0-9]+)*_(MERCHANT_ID|SECRET)$` (e.g. `YAPPY_PROD_PLAZAMAYOR_SECRET`) — still Yappy-only,
never arbitrary Edge secrets. After phase 3 the UI is the normal path; env import is for automation/recovery.

### 5.3 Test result columns (phase 2 S1, `payment_accounts`)
```sql
last_test_at       timestamptz,
last_test_ok       boolean,
last_test_error    text,          -- readable message, never provider raw bodies with secrets
last_test_version  int            -- secret version that was tested; stale if < active version
```
`payment_settings_guard` (phase 2 S1): an enabled setting may reference a `prod` account only if
`last_test_ok AND last_test_version = active secret version`. Phase 2 S8 runs `test_account` for the Kiki UAT
merchant so the guard is satisfied from day one.

### 5.4 View `payment_onboarding_status`
One row per owner (food court in venue mode, restaurant): `owner_kind, owner_id, ready boolean, uat_only boolean,
missing text[]` (e.g. `{'yappy:no_account'}`). Security invoker; platform admins see all, others their scope.
Used by 3.6 lists.

## 6. admin-web implementation

### 6.1 Files
```
apps/admin-web/
  lib/payments/admin.ts           server-only: callPaymentAdmin(action, body) with the viewer's JWT
                                  (same pattern as team/actions.ts → admin-invite-user)
  lib/payments/types.ts           response types (ProviderDescription, OwnerDescription, AccountRow, …)
  app/(dashboard)/payments-actions.ts   'use server' actions: toggleMethod, setMethodAccount, onboardAccount,
                                  rotateSecret, updateAccountConfig, testAccount, setAccountEnabled,
                                  setPaymentMode — zod-validated, revalidatePath of the owner page
  components/payments/PaymentsCard.tsx        3.1 (server component: loads describe_owner + list)
  components/payments/MethodRow.tsx           client: switches + merchant select
  components/payments/AccountsList.tsx        3.1 lower half + 3.3
  components/payments/AccountDrawer.tsx       3.2 / rotate / edit (client, form rendered from fields)
  components/payments/PaymentModeControl.tsx  3.4
  components/payments/CheckoutPreview.tsx     3.5
  components/payments/AuditList.tsx           Historial
```
Read `apps/admin-web/AGENTS.md` first ("This is NOT the Next.js you know").

### 6.2 Data loading
- Server component calls `describe_owner`, `list` and `describe_providers` in parallel via `callPaymentAdmin`.
- Read-only viewers: load the `payment_onboarding_status` view + `payment_method_settings` under RLS instead
  (no merchant config).

### 6.3 Errors
`payment-admin` returns `{error, message}` where `error` is the guard / action code (`account_untested`,
`remove_food_court_settings_first`, …). `lib/payments/messages.ts` maps every code to Spanish copy; unknown codes →
"No se pudo guardar. Inténtalo de nuevo." Never show raw `message` from the provider.

## 7. Onboarding runbook (what Edgar does for a new client)

**A. With the merchant (outside kiki)**
1. Merchant has Yappy Comercial with **Botón de Pago** enabled.
2. Merchant registers the domain `order.estoeskiki.com` in Botón de Pago (pending: can several merchants share it?
   architecture section 9).
3. Merchant gives you the **ID del comercio** and **Clave secreta** — in person or typed by them into admin-web;
   never by chat or email.

**B. In admin-web**
4. Food court: set **Modo de cobro**. Restaurant: open it from Restaurantes.
5. Pagos → **Agregar cuenta** → Yappy, Producción, fields → **Guardar y probar** → ✓.
6. Turn on methods for Web / Kiosco; for Yappy pick the new account in "Cobra con".
7. **Vista previa del checkout** → both columns show what you expect.
8. One real payment with the cheapest item → order shows PAGADO in POS (refund it in Yappy Comercial).

**Rotation:** merchant regenerates the key in Yappy → Pagos → Rotar clave → ✓. Old key keeps verifying late
notices for the grace period.

## 8. Phase placement

| Piece | Phase |
|---|---|
| 5.1 field list + `testCredentials`, `secrets` object | **2** (S4) |
| 5.2 new actions + env-var pattern | **2** (S5) |
| 5.3 columns + guard, 5.4 view | **2** (S1 / S2) |
| UI 3.1–3.6, 6.x | **3**, first deliverable (before per_restaurant UI work) |
| Self-service roles (4.1 later) | after 3, behind `payments.self_service` |

Phase 2 still configures Plaza Mayor via `payment-admin` calls (S8); the UI arrives right after go-live (2b).
If a second merchant is needed before the UI ships, use `import_env_*` with a named env var (5.2).

## 9. Tests

L1 (SQL, `supabase/tests/payments_matrix_test.sql`):
- Settings guard rejects a prod account with no passing test / stale test version (H-21, H-22).
- `payment_onboarding_status` matches the matrix contexts C1–C10.

Edge (node / deno):
- `onboard_account` is atomic: invalid config ⇒ no account row, no secret row.
- `import_env_secret` rejects `SUPABASE_SERVICE_ROLE_KEY`, `PAYMENTS_KEK_1`, `YAPPY_UAT_BASE_URL`; accepts
  `YAPPY_PROD_PLAZAMAYOR_SECRET`.
- No action response contains a secret value (assert against the plaintext used in the test).
- Non-platform-admin caller ⇒ `forbidden` for every write action.
- Yappy `testCredentials`: token ⇒ ok; E-code ⇒ credential failure; timeout ⇒ `provider_unavailable`.

admin-web (manual, then Playwright later):
- New standalone restaurant from zero → Listo, preview shows the methods, one UAT payment in UAT hours.
- Restaurant inside a venue food court: only Kiosco column editable; preview shows fallback.
- Switch Modo de cobro with food-court settings present ⇒ blocked with the readable message.
- Rotate secret ⇒ v2 active, v1 retired, test passes, an IPN signed with v1 still verifies (C-11).
- Read-only role sees status, no merchant ids, no buttons.

## 10. Decisions (answered 2026-10-31)
1. Who types credentials: **Kiki staff** for now (platform admins). Self-service later behind `payments.self_service`.
2. Re-auth for secret writes: **no**.
3. UAT merchants after go-live: **only on demo food courts** (4.4, guard `uat_account_on_live_owner`, H-28).
4. Kiki's own merchants: **Settings** → Cuentas de cobro de Kiki.
