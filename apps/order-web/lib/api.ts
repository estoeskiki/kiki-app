import { supabase } from './supabase';
import type {
  Category,
  CustomizationGroup,
  MenuItem,
  OrderStatusResult,
  OrderType,
  PaymentMethod,
  StorefrontData,
  ZoneSummary,
} from './types';

function mapZones(zones: any): ZoneSummary[] {
  return (zones ?? []).map((z: any) => ({
    id: z.id,
    label: z.label,
    allowsManualNumber: z.allows_manual_number ?? false,
  }));
}

export async function getPublicStorefront(args: { slug?: string; tableToken?: string }): Promise<StorefrontData> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Request timed out')), 10000),
  );

  const { data, error } = await Promise.race([
    supabase.rpc('get_public_storefront', {
      p_slug: args.slug ?? null,
      p_table_token: args.tableToken ?? null,
    }),
    timeout,
  ]);

  if (error) return { type: 'error', error: error.message };
  const result = data as any;
  if (result?.error) return { type: 'error', error: result.error };

  if (result.type === 'restaurant') {
    return {
      type: 'restaurant',
      restaurant: {
        id: result.restaurant.id,
        slug: result.restaurant.slug,
        name: result.restaurant.name,
        isOpen: result.restaurant.is_open,
        taxRate: Number(result.restaurant.tax_rate),
        currency: result.restaurant.currency,
        logoUrl: result.restaurant.logo_url ?? null,
        welcomeBgUrl: result.restaurant.welcome_bg_url ?? null,
        slogan: result.restaurant.slogan ?? null,
      },
      tableId: result.table_id ?? null,
      tableLabel: result.table_label ?? null,
      tableAllowsManualNumber: result.table_allows_manual_number ?? false,
      zones: mapZones(result.zones),
    };
  }

  return {
    type: 'food_court',
    foodCourt: {
      id: result.food_court.id,
      slug: result.food_court.slug,
      name: result.food_court.name,
      address: result.food_court.address,
      welcomeBgUrl: result.food_court.welcome_bg_url ?? null,
      slogan: result.food_court.slogan ?? null,
    },
    restaurants: (result.restaurants ?? []).map((r: any) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      isOpen: r.is_open,
      taxRate: Number(r.tax_rate),
      logoUrl: r.logo_url ?? null,
    })),
    tableId: result.table_id ?? null,
    tableLabel: result.table_label ?? null,
    tableAllowsManualNumber: result.table_allows_manual_number ?? false,
    zones: mapZones(result.zones),
  };
}

// Public menu tables have an anon-readable RLS policy (migration 010), so
// this is a direct table query — same pattern kiosk's useMenuStore uses,
// which also means a supabase.channel(...) realtime subscription on
// menu_items works from this app too, unlike orders/restaurants.
export async function fetchMenu(restaurantId: string): Promise<{ categories: Category[]; items: MenuItem[] }> {
  const [{ data: catData }, { data: itemData }] = await Promise.all([
    supabase.from('categories').select('*').eq('restaurant_id', restaurantId).order('sort_order'),
    supabase
      .from('menu_items')
      .select('*, customization_groups(*, customization_options(*))')
      .eq('restaurant_id', restaurantId)
      .eq('available', true)
      .order('sort_order'),
  ]);

  const categories: Category[] = (catData ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon,
    sortOrder: c.sort_order,
  }));

  const items: MenuItem[] = (itemData ?? []).map((d: any) => ({
    id: d.id,
    categoryId: d.category_id,
    name: d.name,
    description: d.description,
    price: d.price,
    image: d.image_url,
    available: d.available,
    popular: d.popular,
    customizations: (d.customization_groups ?? [])
      .map(
        (cg: any): CustomizationGroup => ({
          id: cg.id,
          name: cg.name,
          required: cg.required,
          maxSelections: cg.max_selections,
          options: (cg.customization_options ?? []).map((co: any) => ({
            id: co.id,
            name: co.name,
            priceModifier: co.price_modifier,
          })),
        }),
      )
      .sort((a: CustomizationGroup, b: CustomizationGroup) => (a.required === b.required ? 0 : a.required ? -1 : 1)),
  }));

  return { categories, items };
}

export interface CreateWebOrderPayload {
  restaurantId?: string;
  foodCourtId?: string;
  tableToken?: string;
  // Customer-confirmed zone, which may differ from tableToken's own zone if
  // they corrected it at checkout (e.g. a QR card got moved). The server
  // only honors this when it belongs to the same food court/restaurant the
  // token resolved to.
  tableId?: string;
  tableNumber?: string;
  orderType: OrderType;
  customerName: string;
  customerPhone?: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  items: { menuItemId: string; restaurantId?: string; quantity: number; selectedOptionIds: string[] }[];
}

export async function createWebOrder(payload: CreateWebOrderPayload): Promise<{ orderId: string; orderNumber: number }> {
  const { data, error } = await supabase.functions.invoke('create-web-order', { body: payload });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return { orderId: data.orderId, orderNumber: data.orderNumber };
}

export async function getOrderStatus(orderId: string): Promise<OrderStatusResult | null> {
  const { data, error } = await supabase.rpc('get_order_status_public', { p_order_id: orderId });
  if (error || !data) return null;
  return data as unknown as OrderStatusResult;
}
