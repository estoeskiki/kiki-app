import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MenuItem } from '@/data/types';

export type RootStackParamList = {
  Welcome: undefined;
  OrderType: undefined;
  Directory: undefined;
  Menu: { restaurantId?: string; restaurantName?: string } | undefined;
  ItemDetail: { item: MenuItem; restaurantId?: string; restaurantName?: string };
  Cart: undefined;
  Checkout: undefined;
  Payment: undefined;
  ThankYou: { orderNumber: number };
};

export type ScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
