'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { dbId } from '@/lib/validation';
import { canAdminister, canWrite, requireViewer } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { ORDER_STATUSES } from '@/lib/filters';
import type { OrderStatus, PaymentStatus } from '@/lib/types';

/**
 * Manual order intervention — "in case of emergencies," not the normal
 * fulfillment flow (that stays in the kiosk/KDS/RN admin apps).
 *
 * These write to `sub_orders`, the same row and the same RLS policy
 * (sub_orders_update) every other client already writes through, so a manual
 * override here shows up identically to a normal one everywhere else:
 * sync_parent_order_status rolls the parent order's status up automatically,
 * and log_sub_order_status_change (042/045) logs it with this caller's
 * auth.uid() as the actor — an override is indistinguishable from a kiosk
 * action in the data model except that the log says who did it.
 *
 * What this deliberately does NOT expose: line items, prices, subtotal/tax/
 * total, or anything that has already been fiscally invoiced. Rewriting money
 * after the fact needs a credit-note / re-fiscalization process this is not —
 * see the fiscal_invoice_id guard in updateOrderStatus.
 */

const uuid = dbId;
const statusEnum = z.enum(ORDER_STATUSES as [string, ...string[]]);

function fail(message: string): never {
  throw new Error(message);
}

async function loadScopedSubOrder(subOrderId: string) {
  const supabase = await createClient();
  // No restaurant filter: RLS already scopes sub_orders to what this viewer
  // may see, so a foreign id simply returns nothing here.
  const { data, error } = await supabase
    .from('sub_orders')
    .select('id, restaurant_id, status, fiscal_invoice_id')
    .eq('id', subOrderId)
    .maybeSingle();

  if (error || !data) fail('Ese pedido no existe o está fuera de tu alcance');
  return { supabase, subOrder: data };
}

export async function updateOrderStatus(formData: FormData) {
  const viewer = await requireViewer();
  if (!canWrite(viewer)) fail('No tienes permiso para cambiar el estado de pedidos');

  const subOrderId = uuid.parse(formData.get('sub_order_id'));
  const orderId = uuid.parse(formData.get('order_id'));
  const nextStatus = statusEnum.parse(formData.get('status'));
  const reason = z.string().trim().max(300).optional().parse(formData.get('cancellation_reason') || undefined);

  if (nextStatus === 'cancelled' && !reason) {
    fail('Indica un motivo para cancelar el pedido');
  }

  const { supabase, subOrder } = await loadScopedSubOrder(subOrderId);

  // Once a fiscal invoice exists for this line, the status is no longer just
  // an internal operational flag — Panama's DGI has a record tied to it.
  // Un-completing or cancelling it here would desync the admin view from a
  // document that already exists outside this database, with no credit-note
  // process behind it. Refuse rather than silently create that gap.
  if (subOrder.fiscal_invoice_id && subOrder.status !== nextStatus) {
    fail('Ya se generó una factura fiscal para este pedido; el estado no se puede cambiar desde aquí.');
  }

  const { error } = await supabase
    .from('sub_orders')
    .update({
      // Cast, not a loosened type: statusEnum already validated this value
      // against the same ORDER_STATUSES list at runtime above.
      status: nextStatus as OrderStatus,
      // Clear a stale reason if the order is being moved out of cancelled;
      // set it when moving into cancelled.
      cancellation_reason: nextStatus === 'cancelled' ? reason : null,
    })
    .eq('id', subOrderId);

  if (error) fail(error.message);

  revalidatePath('/orders');
  revalidatePath(`/orders/${orderId}`);
}

const detailsSchema = z.object({
  customer_name: z.string().trim().max(120).optional(),
  customer_phone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(500).optional(),
  table_number: z.string().trim().max(40).optional(),
});

export async function updateOrderDetails(formData: FormData) {
  const viewer = await requireViewer();
  if (!canWrite(viewer)) fail('No tienes permiso para editar pedidos');

  const subOrderId = uuid.parse(formData.get('sub_order_id'));
  const orderId = uuid.parse(formData.get('order_id'));

  const parsed = detailsSchema.parse({
    customer_name: formData.get('customer_name') || undefined,
    customer_phone: formData.get('customer_phone') || undefined,
    notes: formData.get('notes') || undefined,
    table_number: formData.get('table_number') || undefined,
  });

  const { supabase } = await loadScopedSubOrder(subOrderId);

  const { error } = await supabase
    .from('sub_orders')
    .update({
      customer_name: parsed.customer_name || null,
      customer_phone: parsed.customer_phone || null,
      notes: parsed.notes || null,
      table_number: parsed.table_number || null,
    })
    .eq('id', subOrderId);

  if (error) fail(error.message);

  revalidatePath('/orders');
  revalidatePath(`/orders/${orderId}`);
}

/**
 * Permanent deletion, for test/junk orders that should never have existed.
 *
 * Destructive and unrecoverable: the FKs cascade, so sub_orders, order_items
 * and order_status_events go with it. There is no soft-delete fallback by
 * design — an order that fails the guards is meant to be cancelled, not hidden.
 *
 * The real guards are in the orders_delete RLS policy (046): platform admin
 * only, no fiscal invoice at either grain, nothing paid. The checks here exist
 * to produce a sentence explaining *why* a deletion was refused, since RLS on
 * its own just silently removes zero rows. They are a mirror of the policy,
 * never a substitute for it.
 */
export async function deleteOrder(formData: FormData) {
  const viewer = await requireViewer();
  if (!viewer.is_platform_admin) fail('Solo el operador de la plataforma puede eliminar pedidos');

  const orderId = uuid.parse(formData.get('order_id'));
  // Typing the order number is the confirmation step: it makes deleting the
  // wrong order take a deliberate act rather than a misplaced click.
  const confirmation = z.string().trim().parse(formData.get('confirm_order_number') ?? '');

  const supabase = await createClient();

  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, payment_status, fiscal_invoice_ids')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) fail('Ese pedido no existe o está fuera de tu alcance');

  if (confirmation !== String(order.order_number)) {
    fail(`Escribe ${order.order_number} para confirmar la eliminación`);
  }

  if ((order.fiscal_invoice_ids ?? []).length > 0) {
    fail('Este pedido tiene factura fiscal; no se puede eliminar.');
  }
  if (order.payment_status === 'paid') {
    fail('Este pedido está pagado; no se puede eliminar. Cancélalo en su lugar.');
  }

  const { data: stalls } = await supabase
    .from('sub_orders')
    .select('fiscal_invoice_id, payment_status')
    .eq('order_id', orderId);

  if ((stalls ?? []).some((s) => s.fiscal_invoice_id)) {
    fail('Un local de este pedido ya tiene factura fiscal; no se puede eliminar.');
  }
  if ((stalls ?? []).some((s) => s.payment_status === 'paid')) {
    fail('Un local de este pedido está pagado; no se puede eliminar. Cancélalo en su lugar.');
  }

  const { error, count } = await supabase
    .from('orders')
    .delete({ count: 'exact' })
    .eq('id', orderId);

  if (error) fail(error.message);
  // RLS refuses by matching zero rows, not by erroring — without this, a
  // blocked delete would look like a success and the row would quietly remain.
  if (!count) fail('La base de datos rechazó la eliminación de este pedido.');

  revalidatePath('/orders');
  redirect('/orders');
}

const paymentStatusEnum = z.enum(['pending', 'paid', 'failed']);

/**
 * Owner/manager only — stricter than the sub_orders_update RLS policy, which
 * also permits staff. RLS is the ceiling here, not the whole gate: payment
 * reconciliation is a step up in sensitivity from "mark this ready," so the
 * app enforces a tighter floor on top of it.
 */
export async function updatePaymentStatus(formData: FormData) {
  const viewer = await requireViewer();
  if (!canAdminister(viewer)) fail('Solo propietarios y gerentes pueden anular el estado de pago');

  const subOrderId = uuid.parse(formData.get('sub_order_id'));
  const orderId = uuid.parse(formData.get('order_id'));
  const nextStatus = paymentStatusEnum.parse(formData.get('payment_status'));

  const { supabase } = await loadScopedSubOrder(subOrderId);

  const { error } = await supabase
    .from('sub_orders')
    .update({ payment_status: nextStatus as PaymentStatus })
    .eq('id', subOrderId);

  if (error) fail(error.message);

  revalidatePath('/orders');
  revalidatePath(`/orders/${orderId}`);
}
