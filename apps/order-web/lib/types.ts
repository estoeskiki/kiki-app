// Mirrors apps/kiosk/src/data/types.ts — same shapes, same ordering
// capabilities, adapted for the web checkout (payment method).

export type Translatable = { es: string; en: string };

export interface Category {
  id: string;
  name: Translatable | string;
  slug: string;
  icon: string;
  sortOrder: number;
}

export interface CustomizationOption {
  id: string;
  name: Translatable | string;
  priceModifier: number; // cents
}

export interface CustomizationGroup {
  id: string;
  name: Translatable | string;
  required: boolean;
  maxSelections: number; // 1 = radio, >1 = checkbox
  options: CustomizationOption[];
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: Translatable | string;
  description: Translatable | string;
  price: number; // base price in cents
  image: string;
  available: boolean;
  popular: boolean;
  customizations: CustomizationGroup[];
}

export interface CartItem {
  id: string; // unique cart line id
  menuItem: MenuItem;
  quantity: number;
  selectedCustomizations: Record<string, string[]>; // groupId -> optionId[]
  lineTotal: number; // cents
  restaurantId: string;
  restaurantName: string;
}

export type OrderType = 'dine-in' | 'takeaway';
export type PaymentMethod = 'yappy' | 'cash_on_delivery' | 'card_on_delivery';

export interface RestaurantSummary {
  id: string;
  slug: string;
  name: string;
  isOpen: boolean;
  taxRate: number;
  currency?: string;
  logoUrl?: string | null;
  welcomeBgUrl?: string | null;
}

export interface FoodCourtSummary {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  welcomeBgUrl?: string | null;
}

export type StorefrontData =
  | { type: 'restaurant'; restaurant: RestaurantSummary; tableId: string | null; tableLabel: string | null }
  | { type: 'food_court'; foodCourt: FoodCourtSummary; restaurants: RestaurantSummary[]; tableId: string | null; tableLabel: string | null }
  | { type: 'error'; error: string };

export interface OrderStatusSubOrder {
  restaurant_name: string;
  status: 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  items: { name: string; quantity: number }[];
}

export interface OrderStatusResult {
  order_number: number;
  status: 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  order_type: OrderType;
  table_label: string | null;
  payment_method: PaymentMethod | null;
  payment_status: 'pending' | 'paid' | 'failed';
  created_at: string;
  sub_orders: OrderStatusSubOrder[];
}
