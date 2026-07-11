import type { OrderType } from '@/lib/types';

const OPTIONS: { type: OrderType; icon: string; title: string; subtitle: string }[] = [
  { type: 'dine-in', icon: '🍽️', title: 'Comer aquí', subtitle: 'Para disfrutar en el restaurante' },
  { type: 'takeaway', icon: '🥡', title: 'Para llevar', subtitle: 'Para llevar contigo' },
];

export function OrderTypeSelect({ onSelect }: { onSelect: (type: OrderType) => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-10 px-6 py-10">
      <div className="fade-up-item flex flex-col items-center gap-2 text-center" style={{ animationDelay: '60ms' }}>
        <p className="font-body text-xs font-bold uppercase tracking-[0.25em] text-primary">Bienvenido</p>
        <h1 className="font-heading text-3xl font-black tracking-tight text-text-primary">Elige tu tipo de orden</h1>
      </div>

      <div className="flex w-full max-w-md gap-3">
        {OPTIONS.map((opt, i) => (
          <button
            key={opt.type}
            onClick={() => onSelect(opt.type)}
            className="fade-up-item flex flex-1 flex-col items-center gap-3 rounded-xl border border-border-light bg-surface px-4 py-8 text-center transition active:scale-[0.96]"
            style={{ animationDelay: `${180 + i * 90}ms` }}
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container text-3xl">
              {opt.icon}
            </span>
            <span className="font-heading text-lg font-bold text-text-primary">{opt.title}</span>
            <span className="font-body text-xs text-text-muted">{opt.subtitle}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
