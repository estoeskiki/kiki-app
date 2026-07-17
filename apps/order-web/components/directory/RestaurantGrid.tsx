import Image from 'next/image';
import Link from 'next/link';
import type { RestaurantSummary } from '@/lib/types';
import { getPlateColor } from '@/lib/plateColor';

export function RestaurantGrid({ slug, restaurants }: { slug: string; restaurants: RestaurantSummary[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
      {restaurants.map((r, i) => (
        <Link
          key={r.id}
          href={r.isOpen ? `/mall/${slug}/${r.id}` : '#'}
          aria-disabled={!r.isOpen}
          className={`group fade-up-item flex flex-col overflow-hidden rounded-2xl border border-border-light bg-surface transition ${r.isOpen ? 'active:scale-[0.97]' : 'pointer-events-none'
            }`}
          style={{ animationDelay: `${60 + i * 60}ms` }}
        >
          <div
            className="relative aspect-square w-full"
            style={{ backgroundColor: getPlateColor(r.id) }}
          >
            {r.logoUrl ? (
              <Image src={r.logoUrl} alt="" fill sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw" className="object-contain p-5" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center font-heading text-4xl font-black text-text-secondary/30">
                {r.name.trim().charAt(0).toUpperCase()}
              </span>
            )}

            {!r.isOpen && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[1px]">
                <span className="rounded-full bg-text-primary px-3 py-1 font-body text-xs font-bold text-background">Cerrado</span>
              </div>
            )}
          </div>

          <div className="flex flex-1 items-center justify-between gap-2 px-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading text-sm font-bold leading-tight text-text-primary">{r.name}</p>
              <div className="flex items-center gap-1.5">
                {r.isOpen && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                <span className={`font-body text-xs ${r.isOpen ? 'text-text-secondary' : 'text-text-muted'}`}>
                  {r.isOpen ? 'Abierto' : 'Cerrado'}
                </span>
              </div>
            </div>
            {r.isOpen && (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition group-active:translate-x-0.5">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7h9.5M7.5 2.5 12 7l-4.5 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
