import { formatCurrency } from '@/lib/currency';

interface CartSummaryProps {
  subtotal: number;
  tax: number;
  taxLabel?: string;
}

export function CartSummary({ subtotal, tax, taxLabel = 'Impuesto (est.)' }: CartSummaryProps) {
  const total = subtotal + tax;
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-surface-container p-4">
      <Row label="Subtotal" value={formatCurrency(subtotal)} />
      <Row label={taxLabel} value={formatCurrency(tax)} />
      <div className="my-1 h-px bg-border-light" />
      <Row label="Total" value={formatCurrency(total)} bold />
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between font-body">
      <span className={bold ? 'font-heading text-base font-bold text-text-primary' : 'text-sm text-text-secondary'}>{label}</span>
      <span className={bold ? 'font-heading text-lg font-bold text-text-primary' : 'text-sm text-text-secondary'}>{value}</span>
    </div>
  );
}
