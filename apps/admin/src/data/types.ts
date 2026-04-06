export type TranslatableText = {
  es: string;
  en: string;
};

export interface Category {
  id: string;
  name: TranslatableText | string;
  slug: string;
  icon: string;
  sortOrder: number;
}

export interface CustomizationOption {
  id: string;
  name: TranslatableText | string;
  priceModifier: number; // in cents (can be negative, zero, or positive)
}

export interface CustomizationGroup {
  id: string;
  name: TranslatableText | string;
  required: boolean;
  maxSelections: number; // 1 = radio, >1 = checkbox
  options: CustomizationOption[];
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: TranslatableText | string;
  description: TranslatableText | string;
  price: number; // base price in cents
  image: string; // URI or require() key
  available: boolean;
  popular: boolean;
  customizations: CustomizationGroup[];
}

export interface CartItem {
  id: string; // unique cart line ID
  menuItem: MenuItem;
  quantity: number;
  selectedCustomizations: Record<string, string[]>; // groupId -> optionId[]
  lineTotal: number; // (base + modifiers) * qty, in cents
}

export type OrderType = 'dine-in' | 'takeaway';

export type OrderStatus =
  | 'idle'
  | 'processing'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'failed';

export interface Order {
  id: string;
  orderNumber: number;
  orderType: OrderType;
  items: CartItem[];
  subtotal: number; // cents
  tax: number; // cents
  total: number; // cents
  status: OrderStatus;
  transactionId: string | null;
  createdAt: string; // ISO timestamp
}
