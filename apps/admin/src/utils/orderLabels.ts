import { PaymentMethod } from '../data/types';

export function paymentMethodLabel(method?: PaymentMethod | null): string {
  switch (method) {
    case 'yappy': return 'Yappy';
    case 'cash_on_delivery': return 'Efectivo';
    case 'card_on_delivery': return 'Tarjeta';
    default: return '';
  }
}
