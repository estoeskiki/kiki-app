import type { HeatCell } from '@/lib/types';

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/**
 * Hour × weekday density. Intensity is scaled against the busiest cell in the
 * current filter window, so the pattern stays readable whether the scope is one
 * stall or the whole platform.
 */
export function Heatmap({ cells }: { cells: HeatCell[] }) {
  const byKey = new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c.orders]));
  const peak = Math.max(1, ...cells.map((c) => c.orders));

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[280px] gap-[3px]">
        <div className="flex w-[18px] flex-col gap-[2px] pt-[17px]">
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={h}
              className="h-[9px] text-right text-[7px] leading-[9px] text-muted"
              // Only every sixth hour is labelled; the rest keep the row height.
              style={{ visibility: h % 6 === 0 ? 'visible' : 'hidden' }}
            >
              {h}
            </div>
          ))}
        </div>

        {DAYS.map((day, dow) => (
          <div key={day} className="flex flex-1 flex-col gap-[2px]">
            <div className="h-[14px] text-center text-[8px] font-bold tracking-[0.04em] text-muted">
              {day}
            </div>
            {Array.from({ length: 24 }, (_, hour) => {
              const orders = byKey.get(`${dow}-${hour}`) ?? 0;
              return (
                <div
                  key={hour}
                  title={`${day} ${String(hour).padStart(2, '0')}:00 · ${orders} pedidos`}
                  className="h-[9px] rounded-[2px]"
                  style={{
                    background: `color-mix(in srgb, var(--color-primary) ${
                      Math.round(Math.max(0.04, orders / peak) * 85)
                    }%, transparent)`,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
