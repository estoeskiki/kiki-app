import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MenuItem } from '@/data/types';

export type RootStackParamList = {
  Welcome: undefined;
  Directory: undefined;
  Menu: { restaurantId?: string; restaurantName?: string } | undefined;
  ItemDetail: { item: MenuItem; restaurantId?: string; restaurantName?: string };
  Checkout: undefined;
  ThankYou: { orderNumber: number; orderId: string; customerName?: string };
};

export type ScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
