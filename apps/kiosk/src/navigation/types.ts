import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MenuItem } from '@/data/types';

export type RootStackParamList = {
  Welcome: undefined;
  OrderType: undefined;
  Menu: undefined;
  ItemDetail: { item: MenuItem };
  Cart: undefined;
  Checkout: undefined;
  Payment: undefined;
  ThankYou: { orderNumber: number };
};

export type ScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
