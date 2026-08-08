'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FieldLabel, Select } from '@/components/ui/Select';
import { Icon } from '@/components/ui/Icon';
import { statusLabel } from '@/components/ui/Badge';
import { ORDER_STATUSES } from '@/lib/filters';
import {
  updateOrderDetails,
  updateOrderStatus,
  updatePaymentStatus,
} from '@/app/(dashboard)/orders/actions';

const PAYMENT_OPTIONS: Record<string, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  failed: 'Fallido',
};

const INPUT =
  'w-full rounded-sm border border-line-strong bg-surface-container px-3 py-2 text-xs text-text-primary transition-colors placeholder:text-muted hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/25 focus-visible:outline-none';

/**
 * Manual intervention panel — every control here is an override of what the
 * kiosk/KDS would normally drive, so the whole block is visually set apart
 * and captioned as such rather than sitting inline like ordinary order data.
 *
 * Submit buttons only render once a value actually differs from what's
 * stored. A row of permanently-lit "Aplicar" buttons reads as the primary
 * thing to do on the page, which is the opposite of what an emergency tool
 * should invite.
 */
export function OrderActions({
  subOrderId,
  orderId,
  status,
  paymentStatus,
  customerName,
  customerPhone,
  tableNumber,
  notes,
  writable,
  administers,
  fiscallyLocked,
}: {
  subOrderId: string;
  orderId: string;
  status: string;
  paymentStatus: string;
  customerName: string | null;
  customerPhone: string | null;
  tableNumber: string | null;
  notes: string | null;
  writable: boolean;
  administers: boolean;
  fiscallyLocked: boolean;
}) {
  const [nextStatus, setNextStatus] = useState(status);
  const [nextPayment, setNextPayment] = useState(paymentStatus);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const statusDirty = nextStatus !== status;
  const paymentDirty = nextPayment !== paymentStatus;

  return (
    <div className="border-t border-line bg-surface-highlight/40 px-4 py-3.5">
      <div className="mb-3 flex items-center gap-1.5">
        <span className="text-muted">
          <Icon name="settings" size={12} />
        </span>
        <span className="text-2xs font-bold uppercase tracking-[0.08em] text-muted">
          Intervención manual
        </span>
      </div>

      <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
        {writable ? (
          <form action={updateOrderStatus} className="min-w-[168px]">
            <input type="hidden" name="sub_order_id" value={subOrderId} />
            <input type="hidden" name="order_id" value={orderId} />

            <FieldLabel>Estado del pedido</FieldLabel>

            {fiscallyLocked ? (
              <p className="max-w-[240px] text-2xs leading-relaxed text-muted">
                Factura fiscal generada — el estado ya no se puede cambiar desde aquí.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Select
                    name="status"
                    value={nextStatus}
                    onChange={(e) => setNextStatus(e.target.value)}
                    aria-label="Estado del pedido"
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {statusLabel(s)}
                      </option>
                    ))}
                  </Select>
                  {statusDirty ? (
                    <Button type="submit" size="sm">
                      Aplicar
                    </Button>
                  ) : null}
                </div>

                {nextStatus === 'cancelled' ? (
                  <textarea
                    name="cancellation_reason"
                    required
                    maxLength={300}
                    rows={2}
                    placeholder="Motivo de la cancelación (obligatorio)"
                    className={`${INPUT} mt-2 max-w-[280px] resize-y`}
                  />
                ) : null}
              </>
            )}
          </form>
        ) : null}

        {administers ? (
          <form action={updatePaymentStatus} className="min-w-[150px]">
            <input type="hidden" name="sub_order_id" value={subOrderId} />
            <input type="hidden" name="order_id" value={orderId} />

            <FieldLabel>Estado de pago</FieldLabel>
            <div className="flex items-center gap-2">
              <Select
                name="payment_status"
                value={nextPayment}
                onChange={(e) => setNextPayment(e.target.value)}
                aria-label="Estado de pago"
              >
                {Object.entries(PAYMENT_OPTIONS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              {paymentDirty ? (
                <Button type="submit" size="sm">
                  Aplicar
                </Button>
              ) : null}
            </div>
          </form>
        ) : null}
      </div>

      {writable ? (
        <div className="mt-3.5 border-t border-line pt-3">
          {detailsOpen ? (
            <form action={updateOrderDetails}>
              <input type="hidden" name="sub_order_id" value={subOrderId} />
              <input type="hidden" name="order_id" value={orderId} />

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <FieldLabel>Cliente</FieldLabel>
                  <input
                    name="customer_name"
                    defaultValue={customerName ?? ''}
                    maxLength={120}
                    className={INPUT}
                  />
                </label>
                <label className="block">
                  <FieldLabel>Teléfono</FieldLabel>
                  <input
                    name="customer_phone"
                    defaultValue={customerPhone ?? ''}
                    maxLength={40}
                    className={INPUT}
                  />
                </label>
                <label className="block">
                  <FieldLabel>Mesa</FieldLabel>
                  <input
                    name="table_number"
                    defaultValue={tableNumber ?? ''}
                    maxLength={40}
                    className={INPUT}
                  />
                </label>
              </div>

              <label className="mt-3 block">
                <FieldLabel>Nota interna</FieldLabel>
                <textarea
                  name="notes"
                  defaultValue={notes ?? ''}
                  maxLength={500}
                  rows={2}
                  className={`${INPUT} resize-y`}
                />
              </label>

              <div className="mt-3 flex items-center gap-2">
                <Button type="submit" size="sm">
                  Guardar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setDetailsOpen(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-[0.08em] text-muted transition-colors hover:text-primary"
            >
              <Icon name="edit" size={12} />
              Editar datos del cliente
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
