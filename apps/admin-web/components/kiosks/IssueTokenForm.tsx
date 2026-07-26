'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { CardLabel } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { issueDeviceToken, type IssueTokenState } from '@/app/(dashboard)/kiosks/actions';
import type { ScopeFoodCourt, ScopeRestaurant } from '@/lib/types';

const INPUT =
  'w-full rounded-[8px] border border-line bg-surface-container px-3 py-2 text-[13px] text-text-primary outline-none focus:border-primary/40';

/**
 * Issues a pairing token and shows it exactly once.
 *
 * useActionState is what makes "once" possible — the value comes back in the
 * action result and lives only in this component's state. Reloading the page
 * loses it, which is the intended behaviour: the token is a credential, and the
 * operator is told to copy it before leaving.
 */
export function IssueTokenForm({
  restaurants,
  foodCourts,
}: {
  restaurants: ScopeRestaurant[];
  foodCourts: ScopeFoodCourt[];
}) {
  const [state, formAction, pending] = useActionState<IssueTokenState, FormData>(
    issueDeviceToken,
    {}
  );

  return (
    <div>
      <form action={formAction} className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <CardLabel className="mb-1.5">Nombre del dispositivo *</CardLabel>
          <input
            name="device_name"
            required
            minLength={2}
            maxLength={80}
            placeholder="p. ej. Kiosko entrada norte"
            className={INPUT}
          />
        </label>

        <label className="block">
          <CardLabel className="mb-1.5">Emparejar con *</CardLabel>
          <select name="scope" required className={INPUT}>
            {restaurants.map((restaurant) => (
              <option key={restaurant.id} value={`restaurant:${restaurant.id}`}>
                {restaurant.name}
              </option>
            ))}
            {foodCourts.map((foodCourt) => (
              <option key={foodCourt.id} value={`foodcourt:${foodCourt.id}`}>
                {foodCourt.name} · todo el patio
              </option>
            ))}
          </select>
        </label>

        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            <Icon name="plus" size={13} />
            {pending ? 'Emitiendo…' : 'Emitir token'}
          </Button>
        </div>
      </form>

      {state.error ? (
        <p
          role="alert"
          className="mt-3 rounded-[8px] border border-secondary/30 bg-secondary/10 px-3 py-2 text-[12px] text-secondary"
        >
          {state.error}
        </p>
      ) : null}

      {state.token ? (
        <div className="mt-3 rounded-[10px] border border-primary/35 bg-primary/[0.07] p-4">
          <CardLabel className="mb-2 text-primary">Token de emparejamiento</CardLabel>
          <code className="block select-all font-heading text-[20px] font-bold tracking-[0.12em] text-primary">
            {state.token}
          </code>
          <p className="mt-2.5 text-[11px] text-muted">
            Cópialo ahora: no se volverá a mostrar. Introdúcelo una vez en la app del kiosko para
            emparejar el dispositivo.
          </p>
        </div>
      ) : null}
    </div>
  );
}
