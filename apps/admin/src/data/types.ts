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
  customizations?: string[] | null; // resolved display names, populated when mapping a fetched order
  lineTotal: number; // (base + modifiers) * qty, in cents
}

export type OrderType = 'dine-in' | 'takeaway' | 'delivery';

export type OrderStatus =
  | 'idle'
  | 'processing'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled'
  | 'failed';

export type OrderChannel = 'kiosk' | 'web';
export type PaymentMethod = 'yappy' | 'cash_on_delivery' | 'card_on_delivery';
export type PaymentStatus = 'pending' | 'paid' | 'failed';

export interface DeliveryAddress {
  line1: string;
  line2?: string;
  instructions?: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  customerName?: string;
  customerPhone?: string;
  orderType: OrderType;
  items: CartItem[];
  subtotal: number; // cents
  tax: number; // cents
  total: number; // cents
  status: OrderStatus;
  transactionId: string | null;
  createdAt: string; // ISO timestamp
  fiscalInvoiceId?: string;
  fiscalCufe?: string;
  fiscalQrContent?: string;
  // Web ordering channel (apps/order-web) — absent/defaulted for kiosk orders.
  channel?: OrderChannel;
  paymentMethod?: PaymentMethod | null;
  paymentStatus?: PaymentStatus;
  tableLabel?: string | null;
  tableNumber?: string | null;
  deliveryAddress?: DeliveryAddress | null;
  notes?: string | null;
}
