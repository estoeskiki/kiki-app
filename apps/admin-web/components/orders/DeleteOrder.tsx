'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { deleteOrder } from '@/app/(dashboard)/orders/actions';

/**
 * Permanent deletion, kept behind two deliberate steps: open the panel, then
 * type the order number. No window.confirm — a native dialog blocks the page
 * and is the easiest thing in the world to click through by reflex.
 *
 * `blockedReason` is passed in when the server already knows the delete will
 * be refused (paid, or fiscally invoiced), so the control explains itself
 * instead of offering an action that will only fail on submit.
 */
export function DeleteOrder({
  orderId,
  orderNumber,
  blockedReason,
}: {
  orderId: string;
  orderNumber: number;
  blockedReason: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');

  if (blockedReason) {
    return (
      <div className="flex items-start gap-2 text-2xs leading-relaxed text-muted">
        <span className="mt-px shrink-0">
          <Icon name="x" size={12} />
        </span>
        <span>{blockedReason}</span>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-[0.08em] text-muted transition-colors hover:text-secondary"
      >
        <Icon name="x" size={12} />
        Eliminar pedido
      </button>
    );
  }

  return (
    <form action={deleteOrder} className="flex flex-col gap-2.5">
      <input type="hidden" name="order_id" value={orderId} />

      <p className="text-2xs leading-relaxed text-secondary">
        Se elimina de forma permanente, junto con sus artículos e historial. No se puede deshacer.
      </p>

      <label className="block">
        <span className="mb-1.5 block text-2xs text-muted">
          Escribe <span className="font-bold text-text-primary">{orderNumber}</span> para confirmar
        </span>
        <input
          name="confirm_order_number"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          inputMode="numeric"
          autoComplete="off"
          className="w-full rounded-sm border border-line-strong bg-surface-container px-3 py-2 text-xs text-text-primary transition-colors focus:border-secondary focus:ring-2 focus:ring-secondary/25 focus-visible:outline-none"
        />
      </label>

      <div className="flex items-center gap-2">
        <Button
          type="submit"
          size="sm"
          variant="danger"
          disabled={typed.trim() !== String(orderNumber)}
        >
          Eliminar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setTyped('');
          }}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
