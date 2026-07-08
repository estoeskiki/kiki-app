import Link from 'next/link';
import type { RestaurantSummary } from '@/lib/types';

export function RestaurantGrid({ slug, restaurants }: { slug: string; restaurants: RestaurantSummary[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
      {restaurants.map((r) => (
        <Link
          key={r.id}
          href={r.isOpen ? `/mall/${slug}/${r.id}` : '#'}
          aria-disabled={!r.isOpen}
          className={`flex items-center justify-between rounded-xl border border-border-light bg-surface p-5 transition ${
            r.isOpen ? 'active:scale-[0.98]' : 'pointer-events-none opacity-50'
          }`}
        >
          <div>
            <p className="font-heading text-lg font-bold text-text-primary">{r.name}</p>
            <p className="font-body text-sm text-text-muted">{r.isOpen ? 'Abierto ahora' : 'Cerrado'}</p>
          </div>
          <span className="text-2xl">→</span>
        </Link>
      ))}
    </div>
  );
}
