import { formatCurrency } from '@/lib/currency';
import type { PaymentMethod } from '@/lib/types';

export type DemoPaymentPhase = 'processing' | 'approved';

// Stand-in for a real payment gateway on the demo storefronts — a spinner,
// then an approval checkmark. Nothing is charged; see lib/demo.ts.
export function DemoPaymentOverlay({
  phase,
  method,
  total,
}: {
  phase: DemoPaymentPhase;
  method: PaymentMethod;
  total: number;
}) {
  const approved = phase === 'approved';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <div className="fade-up-item flex w-full max-w-xs flex-col items-center gap-4 rounded-2xl bg-surface px-6 py-8 text-center shadow-xl">
        {approved ? (
          <svg width="64" height="64" viewBox="0 0 88 88" fill="none" className="check-circle">
            <circle cx="44" cy="44" r="42" fill="#ccff00" fillOpacity="0.2" stroke="#9bc200" strokeWidth="2" />
            <path d="M28 45L39 56L60 33" stroke="#5f7a00" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="check-path" />
          </svg>
        ) : (
          <span className="h-14 w-14 animate-spin rounded-full border-4 border-border-light border-t-primary" />
        )}
        <div className="flex flex-col gap-1">
          <p className="font-heading text-lg font-bold text-text-primary">
            {approved ? 'Pago aprobado' : method === 'yappy' ? 'Esperando Yappy…' : 'Procesando tarjeta…'}
          </p>
          <p className="font-heading text-2xl font-black text-text-primary">{formatCurrency(total)}</p>
        </div>
        <p className="rounded-full bg-surface-container px-3 py-1 font-body text-[11px] font-semibold text-text-muted">
          Pago simulado · no se cobra nada
        </p>
      </div>
    </div>
  );
}
