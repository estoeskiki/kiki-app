# Kiki Upsell & Recommendation Engine — Architecture Plan

## Context

Upselling is a primary revenue lever for self-service kiosks. The kiosk has no current suggestion mechanism — only a `popular` boolean flag on menu items. This plan lays out a three-phase architecture for a recommendation engine that surfaces smart, contextual suggestions at the right moments in the ordering flow without blocking or annoying the customer.

**Goal:** Increase average order value per session via timely, relevant suggestions that feel natural (not pushy).

---

## Architectural Overview

Three layers, independently shippable:

| Phase | Name | Intelligence Source | When |
|-------|------|---------------------|------|
| 1 | Rule-Based | Admin-configured pairings | MVP |
| 2 | Frequency-Based | Co-purchase scoring from `order_items` | Post-launch |
| 3 | AI-Enriched | Claude API via Supabase Edge Function | Future |

All phases share the same data model and UX surfaces. Later phases add signals without replacing earlier ones — Phase 1 rules always take priority over Phase 2 affinity scores (restaurant owner intent over algorithmic inference).

**Critical principle:** All suggestion evaluation is **client-side, synchronous, and offline-tolerant**. Upsell data is fetched once at menu load time and cached in a Zustand store. Zero extra network round trips at the moment of surfacing a suggestion.

---

## Data Model (New Tables)

**Migration:** `supabase/migrations/006_upsell_engine.sql`

### `item_pairings`
Directional admin-configured rules: "when a customer adds item A, suggest item B."

```sql
CREATE TABLE item_pairings (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id    uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  source_item_id   uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  target_item_id   uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  pairing_type     text NOT NULL DEFAULT 'complement'
                     CHECK (pairing_type IN ('complement', 'upgrade', 'bundle')),
  priority         integer NOT NULL DEFAULT 100,
  label_override   text,  -- e.g. "Add a drink?" shown on kiosk card
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self_pair CHECK (source_item_id <> target_item_id)
);
-- RLS: SELECT for kiosk role, ALL for owner/manager
```

Directional (not symmetric) because upgrade pairings (small → large) are never reversible, and admin intent must be explicit.

### `category_gap_rules`
"If the cart has no item from category X, show a nudge."

```sql
CREATE TABLE category_gap_rules (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id       uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id         uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  fallback_item_ids   jsonb NOT NULL DEFAULT '[]',  -- ordered uuid[] of items to suggest
  prompt_text         text,   -- "Don't forget a drink!"
  min_cart_items      integer NOT NULL DEFAULT 1,   -- don't fire too early
  priority            integer NOT NULL DEFAULT 100,
  active              boolean NOT NULL DEFAULT true,
  UNIQUE(restaurant_id, category_id)
);
```

`min_cart_items` prevents the banner from firing when a customer has only one item and might still be browsing.

### `item_affinity_scores` (Phase 2, schema created now)
Co-purchase frequency derived from `order_items`. Populated by a background job, never written by the kiosk.

```sql
CREATE TABLE item_affinity_scores (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id    uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  item_a_id        uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  item_b_id        uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  score            numeric(5,4) NOT NULL DEFAULT 0,   -- 0.0–1.0
  order_count      integer NOT NULL DEFAULT 0,
  computed_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self_affinity CHECK (item_a_id <> item_b_id),
  UNIQUE(restaurant_id, item_a_id, item_b_id)
);
```

### `upsell_events` (analytics)
Append-only impression + acceptance log. Fire-and-forget from kiosk — non-fatal on failure.

```sql
CREATE TABLE upsell_events (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id     uuid NOT NULL,
  order_id          uuid REFERENCES orders(id) ON DELETE SET NULL,
  source_item_id    uuid REFERENCES menu_items(id) ON DELETE SET NULL,
  suggested_item_id uuid REFERENCES menu_items(id) ON DELETE SET NULL,
  placement         text CHECK (placement IN ('item_detail', 'cart_banner', 'checkout_gap')),
  engine            text DEFAULT 'rule' CHECK (engine IN ('rule', 'affinity', 'ai')),
  accepted          boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);
```

---

## UX Placement Strategy

Three surfaces, ordered by expected conversion impact:

### 1. Post-Add Suggestion Sheet — `ItemDetailModal.tsx` (highest conversion)

**When:** Immediately after customer taps "Add to Cart" — before `navigation.goBack()` fires.
**What:** A bottom sheet slides up (280px max height). Header: "Goes great with [Item Name]". Below: horizontal scroll of 2–3 `SuggestionCard` mini-cards (name, price, single-tap add). Swipe to dismiss = go back. No required customization flow for Phase 1 (if target item has required customizations, navigate to its `ItemDetail` instead of quick-adding).

**Why this placement converts best:** The customer just made a positive decision. Cognitive momentum is at its peak — this is the "would you like fries with that?" moment, directly tied to the item they just committed to.

### 2. Cart Gap Banner — `CartScreen.tsx` (medium conversion, high visibility)

**When:** CartScreen mounts. Cart gap analysis runs synchronously (pure JS, ~1ms).
**What:** If a gap rule fires, an animated banner appears inside the ScrollView above the item list. Shows prompt text + 2 compact item cards. Only the highest-priority firing rule shows — never multiple banners.

**Why this placement works:** The customer is in review mode and can visually verify the gap claim ("I see I have no drink"). The banner is inside the scroll view, not pinned above it — naturally skippable.

### 3. Checkout Gap Alert — `CheckoutScreen.tsx` (medium conversion, last chance)

**When:** CheckoutScreen mounts, same gap analysis. Only fires if gap is still present (customer didn't act on the CartScreen banner).
**What:** A soft-color inline alert card between `OrderReviewList` and `CartSummary`. "Almost done — add a [drink]?" with 1–2 tap-to-add cards. Tapping navigates to `ItemDetail` then returns.

**Why this placement exists:** Last opportunity before payment lock-in. Only reaches customers who ignored the cart banner.

---

## Kiosk Service Layer

### New Zustand Store: `useUpsellStore.ts`
Path: `apps/kiosk/src/store/useUpsellStore.ts`

```typescript
interface UpsellState {
  pairings: UpsellRule[];
  gapRules: CategoryGapRule[];
  affinityScores: AffinityScore[];  // empty in Phase 1
  isLoaded: boolean;

  fetchUpsellData: () => Promise<void>;

  // Pure selectors — synchronous, no network
  getSuggestionsForItem: (itemId: string, cartItemIds: string[]) => MenuItem[];
  getCartGapSuggestions: (cartItems: CartItem[], allMenuItems: MenuItem[]) => GapSuggestion | null;

  // Analytics — fire-and-forget
  recordImpression: (params: UpsellEventParams) => void;
  recordAcceptance: (params: UpsellEventParams) => void;
}
```

**Fetch timing:** Called in `MenuScreen`'s existing `useEffect` alongside `fetchMenu()` using `Promise.all`. Upsell data is small (< 100 rows typical) — no separate loading state needed for the user.

**Offline behavior:** Store initializes with empty arrays. If fetch fails, all selectors return empty — the menu still works, suggestions silently don't appear.

**`getSuggestionsForItem` logic:**
1. Filter `pairings` where `sourceItemId === itemId`
2. Exclude items already in cart
3. Sort by `priority`
4. Resolve to `MenuItem` objects via `useMenuStore.getState()` (no re-render coupling)
5. Return max 3 available items

### New Utility: `cartGapAnalysis.ts`
Path: `apps/kiosk/src/utils/cartGapAnalysis.ts`

Pure function. No side effects. Fully testable.

```typescript
function analyzeCartGaps(
  cartItems: CartItem[],
  gapRules: CategoryGapRule[],
  allMenuItems: MenuItem[],
): GapSuggestion | null {
  if (cartItems.length === 0) return null;
  const cartCategoryIds = new Set(cartItems.map(ci => ci.menuItem.categoryId));

  for (const rule of gapRules) {             // already sorted by priority
    if (cartItems.length < rule.minCartItems) continue;
    if (cartCategoryIds.has(rule.categoryId)) continue;  // gap exists

    // Resolve items: admin fallback list first, then popular items from category
    let items = rule.fallbackItemIds
      .map(id => allMenuItems.find(m => m.id === id && m.available))
      .filter(Boolean)
      .slice(0, 3);

    if (!items.length) {
      items = allMenuItems
        .filter(m => m.categoryId === rule.categoryId && m.available && m.popular)
        .slice(0, 3);
    }
    if (!items.length) continue;

    return { rule, suggestedItems: items, promptText: rule.promptText ?? `Add something from this category?` };
  }
  return null;
}
```

---

## New Files to Create

### Kiosk (React Native)
| File | Purpose |
|------|---------|
| `apps/kiosk/src/store/useUpsellStore.ts` | Zustand store: fetch, cache, selectors, analytics |
| `apps/kiosk/src/utils/cartGapAnalysis.ts` | Pure gap analysis function |
| `apps/kiosk/src/components/upsell/SuggestionSheet.tsx` | Post-add bottom sheet |
| `apps/kiosk/src/components/upsell/SuggestionCard.tsx` | Mini item card inside suggestion sheet |
| `apps/kiosk/src/components/upsell/CartGapBanner.tsx` | Gap nudge banner (shared by Cart + Checkout) |

### Database
| File | Purpose |
|------|---------|
| `supabase/migrations/006_upsell_engine.sql` | All 4 new tables, indexes, RLS policies |

### Admin Web (Next.js)
| File | Purpose |
|------|---------|
| `apps/admin-web/app/upsell/page.tsx` | Upsell configuration overview |
| `apps/admin-web/app/upsell/pairings/page.tsx` | Item pairing CRUD (source → target, type, priority) |
| `apps/admin-web/app/upsell/gap-rules/page.tsx` | Category gap rule CRUD |

---

## Existing Files to Modify (Surgical Changes)

| File | Change |
|------|--------|
| `apps/kiosk/src/screens/MenuScreen.tsx` | Add `fetchUpsellData()` to existing `useEffect` alongside `fetchMenu()` |
| `apps/kiosk/src/screens/ItemDetailModal.tsx` | After `addItem()`, before `goBack()`, check suggestions and conditionally show `SuggestionSheet` |
| `apps/kiosk/src/screens/CartScreen.tsx` | Add `<CartGapBanner>` as first child inside ScrollView |
| `apps/kiosk/src/screens/CheckoutScreen.tsx` | Add `<CartGapBanner>` between `OrderReviewList` and `CartSummary` |

---

## Phase 1 MVP Scope

**Build now:**
- Migration `006_upsell_engine.sql` (all 4 tables — affinity table is empty but schema is done once)
- `useUpsellStore.ts` with fetch and selectors
- `cartGapAnalysis.ts`
- `SuggestionSheet.tsx`, `SuggestionCard.tsx`, `CartGapBanner.tsx`
- Wire up in 4 existing screens
- Admin pairing editor in Next.js

**Deferred to Phase 2:**
- Background Edge Function `supabase/functions/compute-affinity-scores/index.ts` (nightly job computing co-purchase rates from `order_items`)
- Promoting affinity scores as fallback when no admin pairing exists
- AsyncStorage caching for deeper offline resilience
- Conversion analytics dashboard in admin panel

**Deferred to Phase 3:**
- Claude API integration via Edge Function for contextual/time-aware prompts

---

## Implementation Sequence

1. **DB first:** `006_upsell_engine.sql` → seed 2–3 test pairings and 1 gap rule
2. **Store + util:** `useUpsellStore.ts` + `cartGapAnalysis.ts` (can be tested in isolation)
3. **Components:** `CartGapBanner.tsx` → wire into Cart + Checkout (visible quickly, low risk)
4. **Post-add sheet:** `SuggestionSheet.tsx` + `SuggestionCard.tsx` → wire into `ItemDetailModal`
5. **Admin UI:** Pairing editor in `apps/admin-web`

---

## Verification

1. Seed a test pairing: Burger → Fries (complement). Add Burger to cart → `SuggestionSheet` appears with Fries card. Tap "Add" → Fries added, sheet dismisses, navigate back to menu.
2. Seed a gap rule: Drinks category, `min_cart_items: 1`. Add a food item with no drink → go to CartScreen → `CartGapBanner` appears. Add a drink → banner disappears.
3. Verify gap banner also appears on CheckoutScreen if still no drink.
4. Verify `upsell_events` rows are inserted on impression and acceptance.
5. Verify offline: disable network after menu loads → add item → suggestions still appear (from cached store).
