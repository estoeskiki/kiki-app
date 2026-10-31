# Plan: Payments test matrix

Status: **draft** · Started 2026-10-30 · Owner: Edgar
Tests the design in `plans/payments-architecture.md` (rev 4+). Provider lifecycle for Yappy stays in
`plans/yappy-test-plan.md` (T1–T11) and is referenced, not repeated.

## 0. Strategy — test each dimension where it lives

The full product (modes × kiosk types × methods × cart shapes × merchant states × outcomes) is thousands of
cases. Most dimensions are independent, so we split them and test each one fully at the cheapest level:

| layer | what | how many | level |
|---|---|---|---|
| A | **Availability**: which methods each context shows, and who collects | 10 contexts × 7 methods = 70 cells | L1 SQL (all), L4 UI (one per context) |
| B | **Cart rule**: single vs multi restaurant per context | 12 | L1 SQL + L4 UI |
| C | **Merchant state**: when a configured method must hide | 12 | L1 SQL |
| D | **Server tampering**: client asks for something not offered | 9 | L1 SQL / L2 edge |
| E | **Collector + payout**: money lands where table A says, payout includes/excludes it | every pay-first cell of A | L1 SQL |
| F | **Order record**: `payment_method` / `payment_status` per method | 7 + legacy | L1 SQL |
| G | **Provider lifecycle**: E / R / C / X / timeout / duplicate / late callback | per provider, once | L2 edge (mocked) + L3 UAT |
| H | **Config security**: constraints + who can change what | 20 | L1 SQL |
| I | **Mode changes** | 5 | L1 SQL |

Levels:
- **L1 — SQL, rolled back.** Same pattern as `supabase/tests/049_yappy_payments_test.sql`: seed the fixture
  world (section 1) inside a transaction, assert, `RAISE EXCEPTION` with the results so nothing persists.
  Expectations are a `VALUES` table keyed by the cell IDs below, so this doc and the test stay 1:1.
- **L2 — Edge functions, mocked provider.** Deno tests for adapters: request shape, signature verify (active +
  retired secret), error mapping, timeouts.
- **L3 — UAT with the real provider.** Only provider lifecycle + one smoke per collector type.
- **L4 — UI.** order-web and kiosk render exactly what `resolve_payment_options` returns; labels, order, empty
  states.

A combination counts as covered when its cell passes at L1 and its context has one L4 check.

## 1. Fixture world

### Food courts
| id | mode | merchants it owns | method settings (channels → merchant) |
|---|---|---|---|
| **FCV** | `venue` | `M-FCV-YA` (Yappy) | `yappy` {web,kiosk} → M-FCV-YA · `card_online` {web} → `M-KIKI-CARD` · `wallet` {web} → M-KIKI-CARD · `cash_counter` {web,kiosk} · `yappy_on_delivery` {web,kiosk} · `card_on_delivery` {web,kiosk} |
| **FCP** | `per_restaurant` | — | — (restaurants decide) |

Kiki owns `M-KIKI-CARD` (card gateway, supports `card_online` + `wallet`).

### Restaurants
| id | in | merchants it owns | method settings |
|---|---|---|---|
| **RV1** | FCV | `M-RV1-YA` (Yappy), `M-RV1-BG` (BG terminal) | kiosk only: `yappy` → M-RV1-YA · `card_present` → M-RV1-BG · `cash_counter` · `card_on_delivery` |
| **RV2** | FCV | `M-RV2-BG` | kiosk only: `yappy` → *null (fallback)* · `card_present` → M-RV2-BG · `cash_counter` · `yappy_on_delivery` · `card_on_delivery` |
| **RV3** | FCV | — | — (no kiosk; sold only via web / FCV kiosk) |
| **RP1** | FCP | `M-RP1-YA`, `M-RP1-CARD`, `M-RP1-BG` | `card_online` {web} → M-RP1-CARD · `wallet` {web} → M-RP1-CARD · `yappy` {web,kiosk} → M-RP1-YA · `card_present` {kiosk} → M-RP1-BG · `cash_counter` {web,kiosk} · `yappy_on_delivery` {web} |
| **RP2** | FCP | — | `cash_counter` {web,kiosk} · `card_on_delivery` {web,kiosk} |
| **S1** | standalone | `M-S1-YA`, `M-S1-BG` | `yappy` {web} → M-S1-YA · `card_present` {kiosk} → M-S1-BG · `cash_counter` {web,kiosk} |

### Kiosks (`device_tokens`) and terminals
| id | assigned to | terminal |
|---|---|---|
| **K-FCV** | food court FCV | — |
| **K-RV1** | restaurant RV1 | on M-RV1-BG |
| **K-RV2** | restaurant RV2 | on M-RV2-BG |
| **K-FCP** | food court FCP | — |
| **K-RP1** | restaurant RP1 | on M-RP1-BG |
| **K-S1** | restaurant S1 | on M-S1-BG |

All merchants `enabled`, `env = uat`, one active secret, unless a test in section C changes that.

## 2. Contexts

| ctx | where | cart |
|---|---|---|
| **C1** | web, FCV | RV1 + RV3 (multi) |
| **C2** | kiosk K-FCV | RV1 + RV3 (multi) |
| **C3** | kiosk K-RV1 | RV1 |
| **C4** | kiosk K-RV2 | RV2 |
| **C5** | web, FCP | RP1 |
| **C6** | web, FCP | RP2 |
| **C7** | kiosk K-FCP | RP1 |
| **C8** | kiosk K-RP1 | RP1 |
| **C9** | web, S1 | S1 |
| **C10** | kiosk K-S1 | S1 |

## A. Availability + collector (70 cells)

Cell = what `resolve_payment_options` returns and, for pay-first, which merchant `begin_payment` freezes.
`✓` = shown (pay-later, no merchant) · `merchant` = shown, collected by it · `—` = hidden (reason in A.1).
Cell ID = `A-<ctx>-<method>`, e.g. `A-C4-yappy`.

| ctx | `card_online` | `wallet` | `yappy` | `card_present` | `cash_counter` | `yappy_on_delivery` | `card_on_delivery` |
|---|---|---|---|---|---|---|---|
| C1 web FCV | M-KIKI-CARD | M-KIKI-CARD | M-FCV-YA | — w | ✓ | ✓ | ✓ |
| C2 K-FCV | — k | — k | M-FCV-YA | — f | ✓ | ✓ | ✓ |
| C3 K-RV1 | — k | — k | M-RV1-YA | M-RV1-BG | ✓ | — n | ✓ |
| C4 K-RV2 | — k | — k | **M-FCV-YA (fallback)** | M-RV2-BG | ✓ | ✓ | ✓ |
| C5 web FCP / RP1 | M-RP1-CARD | M-RP1-CARD | M-RP1-YA | — w | ✓ | ✓ | — n |
| C6 web FCP / RP2 | — n | — n | — n | — w | ✓ | — n | ✓ |
| C7 K-FCP / RP1 | — k | — k | M-RP1-YA | — f | ✓ | — c | — n |
| C8 K-RP1 | — k | — k | M-RP1-YA | M-RP1-BG | ✓ | — c | — n |
| C9 web S1 | — n | — n | M-S1-YA | — w | ✓ | — n | — n |
| C10 K-S1 | — k | — k | — c | M-S1-BG | ✓ | — n | — n |

### A.1 Hide reasons (assert the reason, not just absence)
| code | reason |
|---|---|
| w | method not possible on web |
| k | method not possible on kiosk |
| f | food court kiosk never offers datáfono |
| n | owner has no setting for this method |
| c | owner has the method but not for this channel |

### A.2 Fallback-specific cells
| id | setup change | expect |
|---|---|---|
| A-FB-1 | FCV disables `yappy` | C4 `yappy` hidden (no own merchant, no fallback); C3 `yappy` still M-RV1-YA |
| A-FB-2 | FCV `yappy` merchant disabled | C4 `yappy` hidden; C1, C2 hidden too |
| A-FB-3 | RV2 adds own `M-RV2-YA` | C4 `yappy` → M-RV2-YA (own wins over fallback) |
| A-FB-4 | RV2 `card_present` with null merchant | rejected by constraint (no fallback for datáfono) |
| A-FB-5 | RP1 (`per_restaurant`) `yappy` with null merchant | rejected (no venue merchant to fall back to) |

## B. Cart rule

| id | ctx | cart | expect (UI) | expect (server) |
|---|---|---|---|---|
| B-1 | C1 web FCV | RV1 + RV3 | allowed | allowed |
| B-2 | C1 web FCV | RV1 | allowed | allowed |
| B-3 | C2 K-FCV | RV1 + RV3 | allowed | allowed |
| B-4 | C3 K-RV1 | RV1 | allowed | allowed |
| B-5 | C3 K-RV1 | RV1 + RV2 (tampered) | menu shows only RV1 | `cart_invalid` |
| B-6 | C5 web FCP | RP1 | allowed | allowed |
| B-7 | C5 web FCP | add RP2 item | "Tu pedido es de RP1, ¿vaciar carrito?" | — |
| B-8 | C5 web FCP | RP1 + RP2 (tampered) | — | `cart_invalid` for every method, pay-later included |
| B-9 | C7 K-FCP | add second restaurant | same prompt as B-7 | — |
| B-10 | C7 K-FCP | RP1 + RP2 (tampered) | — | `cart_invalid` |
| B-11 | C9 web S1 | S1 | allowed | allowed |
| B-12 | C1 web FCV | item from a restaurant of another food court (tampered) | — | `cart_invalid` |

## C. Merchant state (pay-first must hide, pay-later unaffected)

Run on `A-C1-yappy` (venue merchant) and `A-C8-card_present` (restaurant terminal) unless stated.

| id | change | expect |
|---|---|---|
| C-1 | merchant `enabled = false` | hidden |
| C-2 | no `active` secret (only retired) | hidden |
| C-3 | merchant `env = prod`, function env `uat` | hidden |
| C-4 | circuit breaker tripped (> 40 creates / 10 min) | hidden; merchant disabled with reason |
| C-5 | Yappy UAT hours gate (outside Mon–Fri 07:00–18:30 Panama) | `yappy` hidden, reason `outside_uat_hours` |
| C-6 | K-RP1 terminal removed | C8 `card_present` hidden |
| C-7 | K-RP1 terminal moved to M-RV1-BG | rejected by constraint |
| C-8 | setting `enabled` channel removed (`yappy` {web} only) | C7, C8 `yappy` hidden (reason c) |
| C-9 | all pay-first hidden in C1 | pay-later still shown; checkout not empty |
| C-10 | C-1 while a payment is `created` | in-flight payment still completes (merchant frozen at begin) |
| C-11 | merchant rotated secret during a `created` payment | IPN signed with old key verifies (retired secret) |
| C-12 | rotated secret, retired past grace (`revoked`) | IPN fails verify → logged, attention row |

## D. Server tampering (client asks for what it wasn't offered)

| id | request | expect |
|---|---|---|
| D-1 | C2 asks `card_online` | `method_unavailable` |
| D-2 | C6 asks `yappy` | `method_unavailable` |
| D-3 | C10 asks `yappy` (web-only for S1) | `method_unavailable` |
| D-4 | C1 asks `card_present` | `method_unavailable` |
| D-5 | kiosk body claims `device_id` = K-RV1 but token is K-FCV | device taken from token only; served as C2 |
| D-6 | client sends `account_id` / merchant | ignored; server resolves |
| D-7 | client sends amount | ignored; snapshot price used |
| D-8 | pay-later via `create-web-order` with method not enabled (C9 `card_on_delivery`) | rejected |
| D-9 | C4 asks `yappy` after FCV disabled it between options and pay | `method_unavailable` (re-resolved at begin) |

## E. Collector and payout

For **every pay-first cell in table A**: run `begin_payment` + a verified success, then assert:
- `payments.account_id` = the merchant in the cell;
- `payments.food_court_id / restaurant_id` = the owner;
- payout flag: merchant owned by Kiki or the food court → **in** venue payout split by `sub_orders`; owned by the
  restaurant → **directly collected**, excluded.

| id | cell | collector | payout |
|---|---|---|---|
| E-1 | A-C1-yappy | FCV | in (split RV1 / RV3) |
| E-2 | A-C1-card_online | Kiki | in (split) |
| E-3 | A-C2-yappy | FCV | in |
| E-4 | A-C3-yappy | RV1 | excluded |
| E-5 | A-C3-card_present | RV1 | excluded |
| E-6 | A-C4-yappy | FCV (fallback) | **in** |
| E-7 | A-C4-card_present | RV2 | excluded |
| E-8 | A-C5-*, A-C7-yappy, A-C8-* | RP1 | n/a (per_restaurant) |
| E-9 | A-C9-yappy, A-C10-card_present | S1 | n/a |

Pay-later in a multi-restaurant venue order (C1 `card_on_delivery`, RV1 + RV3): one `sub_orders.payment_status`
per restaurant, each marked paid separately (as COS today).

## F. Order record

| id | method | `orders.payment_method` | `payment_status` at creation |
|---|---|---|---|
| F-1 | `card_online` | `card_online` | `paid` (created on success) |
| F-2 | `wallet` | `wallet` | `paid` |
| F-3 | `yappy` | `yappy` | `paid` |
| F-4 | `card_present` | `card_present` | `paid` |
| F-5 | `cash_counter` | `cash_counter` | `pending` |
| F-6 | `yappy_on_delivery` | `yappy_on_delivery` | `pending` |
| F-7 | `card_on_delivery` | `card_on_delivery` | `pending` |
| F-8 | legacy rows | unpaid `yappy` → `yappy_on_delivery`; `cash_on_delivery` → `cash_counter` | unchanged |
| F-9 | all apps | labels + printer + POS chip show the right text for each code | — |

## G. Provider lifecycle (once per provider, not per context)

| provider | cases | where |
|---|---|---|
| Yappy | T1–T11 in `plans/yappy-test-plan.md` (E, R, C, X, E005, timeout/504, duplicate IPN, late IPN, bad hash, outside hours) | L2 mocked + L3 UAT |
| BG / Banistmo terminal | approved · declined · cancelled on terminal · terminal offline · kiosk crashes after approval (payment row must exist, order recoverable) · duplicate approval message | L2 mocked + L3 with device |
| Card gateway (`card_online`, `wallet`) | approved · declined · 3DS abandon · webhook before redirect · duplicate webhook · late webhook after expiry · Apple Pay / Google Pay sheet cancel | L2 mocked + L3 sandbox |
| Pay-later | order created `pending`; staff marks each sub-order paid | L1 |

L3 smoke per collector type (one real payment each): food court merchant (C1 yappy), fallback (C4 yappy),
restaurant merchant online (C5 yappy), restaurant terminal (C8 card_present), standalone (C9 yappy). Yappy UAT
gives one merchant — several `payment_accounts` rows may share its credentials so collector routing is still
verified by `account_id`.

## H. Config security

### H.1 DB constraints (insert must fail)
| id | attempt |
|---|---|
| H-1 | restaurant setting pointing at another restaurant's merchant |
| H-2 | food court setting pointing at another food court's merchant |
| H-3 | food court setting pointing at a restaurant's merchant |
| H-4 | restaurant setting in FCV with `channels` containing `web` |
| H-5 | food court setting on FCP (`per_restaurant`) |
| H-6 | setting with a method the merchant's provider doesn't support (`card_online` → Yappy merchant) |
| H-7 | `channels` outside the method's allowed (`card_present` {web}) |
| H-8 | pay-first setting with null merchant outside the venue-kiosk fallback (A-FB-4, A-FB-5) |
| H-9 | pay-later setting with a merchant |
| H-10 | terminal on a food court kiosk (K-FCV) |
| H-11 | second terminal on the same kiosk |
| H-12 | merchant with both `restaurant_id` and `food_court_id` |

### H.2 Who can do what (through `payment-admin`, as each role)
| id | role | action | expect |
|---|---|---|---|
| H-13 | restaurant owner RV1 | edit RV2's settings | denied |
| H-14 | restaurant owner RV1 | edit FCV web settings | denied |
| H-15 | food court admin FCV | switch `yappy` from M-FCV-YA to M-KIKI-* | denied (Kiki ops only) |
| H-16 | food court admin FCV | change `payment_mode` | denied (request only) |
| H-17 | any role | read a secret | never returned |
| H-18 | anon / authenticated | direct `INSERT/UPDATE` on payment tables | denied by RLS |
| H-19 | any allowed change | audit row written + Kiki alert on merchant change | yes |
| H-20 | restaurant staff | any payment config change | denied |

### H.3 Onboarding (`plans/payments-onboarding.md`)
| id | case | expect |
|---|---|---|
| H-21 | enabled setting → `prod` merchant never tested | `account_untested` |
| H-22 | enabled setting → `prod` merchant tested on secret v1, active secret is v2 | `account_untested` |
| H-23 | `onboard_account` with invalid config (no merchant id) | error, no account row, no secret row |
| H-24 | `import_env_secret` with `PAYMENTS_KEK_1` / `SUPABASE_SERVICE_ROLE_KEY` / `YAPPY_UAT_BASE_URL` | rejected |
| H-25 | `import_env_secret` with `YAPPY_PROD_PLAZAMAYOR_SECRET` | accepted, stored encrypted |
| H-26 | any `payment-admin` response (list, onboard, rotate, test) | contains no secret plaintext |
| H-27 | `describe_owner` for RV1 (restaurant in FCV) | only kiosk channel writable, own merchants only |
| H-28 | after go-live migration: enabled setting on a non-demo food court / standalone → `env='uat'` merchant | `uat_account_on_live_owner`; same on a demo food court ⇒ allowed |

## I. Mode changes

| id | change | expect |
|---|---|---|
| I-1 | FCV `venue` → `per_restaurant` while FCV settings exist | blocked until food court settings are removed (or migrated) — admin lists them |
| I-2 | after I-1, open multi-restaurant web carts | checkout `cart_invalid` → "Tu carrito tiene varios restaurantes" |
| I-3 | after I-1, RV1/RV2 kiosk-only settings | allowed to widen to web; restaurants without settings flagged in admin |
| I-4 | FCP `per_restaurant` → `venue` | restaurant web settings must be narrowed to kiosk or removed before switch |
| I-5 | mode change while payments are `created` | in-flight payments complete with frozen merchant |

## 3. Running it

- L1 file: `supabase/tests/payments_matrix_test.sql` — seeds section 1, loops over an expectations `VALUES`
  table (`cell_id, ctx, method, expected_merchant, expected_reason`), runs A–F, H, I, prints one line per
  cell id with PASS / FAIL in the final `RAISE EXCEPTION`.
- Run on every migration touching payments and before each deploy of `payment-create` / `payment-webhook`.
- Track results in section 4 (date, commit, failures).

## 4. Results log

| date | commit | layer | result |
|---|---|---|---|
| | | | |
