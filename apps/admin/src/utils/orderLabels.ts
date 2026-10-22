import { PaymentMethod, PaymentStatus } from '../data/types';

export function paymentMethodLabel(method?: PaymentMethod | null): string {
  switch (method) {
    case 'yappy': return 'Yappy';
    case 'cash_on_delivery': return 'Efectivo';
    case 'card_on_delivery': return 'Tarjeta';
    default: return '';
  }
}

// Whether staff still has to collect. Yappy pay-first orders (migration 049)
// arrive already paid — charging again at handover would double-charge.
export function paymentStatusLabel(status?: PaymentStatus | null): string {
  return status === 'paid' ? 'PAGADO' : 'POR COBRAR';
}
