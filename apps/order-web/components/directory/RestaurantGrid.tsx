import Link from 'next/link';
import type { RestaurantSummary } from '@/lib/types';
import { getPlateColor } from '@/lib/plateColor';

export function RestaurantGrid({ slug, restaurants }: { slug: string; restaurants: RestaurantSummary[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
      {restaurants.map((r) => (
        <Link
          key={r.id}
          href={r.isOpen ? `/mall/${slug}/${r.id}` : '#'}
          aria-disabled={!r.isOpen}
          className={`flex items-center gap-4 rounded-xl border border-border-light bg-surface p-4 transition ${
            r.isOpen ? 'active:scale-[0.98]' : 'pointer-events-none opacity-50'
          }`}
        >
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full"
            style={{ backgroundColor: getPlateColor(r.id) }}
          >
            {r.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary per-restaurant logo URLs
              <img src={r.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="font-heading text-xl font-black text-text-secondary/40">
                {r.name.trim().charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-lg font-bold text-text-primary">{r.name}</p>
            <p className="font-body text-sm text-text-muted">{r.isOpen ? 'Abierto ahora' : 'Cerrado'}</p>
          </div>
          <span className="shrink-0 text-2xl">→</span>
        </Link>
      ))}
    </div>
  );
}
