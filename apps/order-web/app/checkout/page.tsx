'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/useCartStore';
import { useSessionStore } from '@/store/useSessionStore';
import { useLastOrderStore } from '@/store/useLastOrderStore';
import { createWebOrder, validateCart, CartInvalidError } from '@/lib/api';
import { Header } from '@/components/layout/Header';
import { CartItemRow } from '@/components/cart/CartItemRow';
import { CartSummary } from '@/components/cart/CartSummary';
import { Button } from '@/components/ui/Button';
import type { PaymentMethod } from '@/lib/types';

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const getItemsByRestaurant = useCartStore((s) => s.getItemsByRestaurant);
  const clearCart = useCartStore((s) => s.clearCart);
  const removeItem = useCartStore((s) => s.removeItem);
  const setLastOrder = useLastOrderStore((s) => s.set);

  const mode = useSessionStore((s) => s.mode);
  const slug = useSessionStore((s) => s.slug);
  const restaurantId = useSessionStore((s) => s.restaurantId);
  const foodCourtId = useSessionStore((s) => s.foodCourtId);
  const tableToken = useSessionStore((s) => s.tableToken);
  const tableId = useSessionStore((s) => s.tableId);
  const tableAllowsManualNumber = useSessionStore((s) => s.tableAllowsManualNumber);
  const zones = useSessionStore((s) => s.zones);
  const setTable = useSessionStore((s) => s.setTable);
  // Defaults to 'dine-in', always editable here regardless of how the
  // customer arrived (a scanned table QR no longer locks this).
  const orderType = useSessionStore((s) => s.orderType);
  const setOrderType = useSessionStore((s) => s.setOrderType);
  const getTaxRate = useSessionStore((s) => s.getTaxRate);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card_on_delivery');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  // Keyed by restaurantId — each restaurant in the cart gets its own note,
  // since a global comment doesn't make sense once an order can span
  // multiple restaurants (food court mode).
  const [notesByRestaurant, setNotesByRestaurant] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Restaurants that closed / items that went unavailable since browsing.
  // Populated by the soft pre-check on mount and by a submit-time rejection.
  const [closedRestaurantIds, setClosedRestaurantIds] = useState<string[]>([]);
  const [unavailableItemIds, setUnavailableItemIds] = useState<string[]>([]);

  const groups = useMemo(() => getItemsByRestaurant(), [items, getItemsByRestaurant]);

  const closedSet = useMemo(() => new Set(closedRestaurantIds), [closedRestaurantIds]);
  const unavailableSet = useMemo(() => new Set(unavailableItemIds), [unavailableItemIds]);
  const hasBlocked = useMemo(
    () =>
      items.some((it) => closedSet.has(it.restaurantId) || unavailableSet.has(it.menuItem.id)),
    [items, closedSet, unavailableSet],
  );

  // Soft pre-check: re-validate whenever the cart composition changes (mount,
  // manual edits, recovery). Best-effort — the edge function is authoritative
  // at submit; this just surfaces problems early. Keyed on the item signature
  // so it doesn't refire on every unrelated render.
  const cartSignature = items.map((it) => `${it.restaurantId}:${it.menuItem.id}`).join('|');
  useEffect(() => {
    if (items.length === 0) return;
    let cancelled = false;
    validateCart(items.map((it) => ({ restaurantId: it.restaurantId, menuItemId: it.menuItem.id }))).then((v) => {
      if (cancelled) return;
      setClosedRestaurantIds(v.closedRestaurantIds);
      setUnavailableItemIds(v.unavailableItemIds);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartSignature]);

  const removeBlocked = () => {
    for (const it of items) {
      if (closedSet.has(it.restaurantId) || unavailableSet.has(it.menuItem.id)) removeItem(it.id);
    }
    setClosedRestaurantIds([]);
    setUnavailableItemIds([]);
  };

  const { subtotal, tax } = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    for (const g of groups) {
      const groupSubtotal = g.items.reduce((sum, i) => sum + i.lineTotal, 0);
      subtotal += groupSubtotal;
      tax += Math.round(groupSubtotal * getTaxRate(g.restaurantId));
    }
    return { subtotal, tax };
  }, [groups, getTaxRate]);

  const phoneDigits = customerPhone.replace(/\D/g, '');
  const isPhoneValid = phoneDigits.length >= 8;

  const canSubmit = items.length > 0 && customerName.trim().length > 0 && isPhoneValid && !isSubmitting && !hasBlocked;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const { orderId, orderNumber } = await createWebOrder({
        restaurantId: restaurantId ?? undefined,
        foodCourtId: foodCourtId ?? undefined,
        tableToken: tableToken ?? undefined,
        tableId: tableId ?? undefined,
        tableNumber: tableAllowsManualNumber ? tableNumber.trim() || undefined : undefined,
        orderType,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        paymentMethod,
        notes: Object.fromEntries(
          Object.entries(notesByRestaurant)
            .map(([rid, text]) => [rid, text.trim()])
            .filter(([, text]) => text.length > 0),
        ),
        items: items.map((item) => ({
          menuItemId: item.menuItem.id,
          restaurantId: item.restaurantId,
          quantity: item.quantity,
          selectedOptionIds: Object.values(item.selectedCustomizations).flat(),
        })),
      });
      // Cart is cleared on the thank-you bridge screen's mount, not here — so
      // this page's empty-cart state doesn't flash for a frame while the
      // route transition is in flight.
      setLastOrder({ orderId, orderNumber, customerName: customerName.trim() });
      router.replace(`/order/${orderId}/thank-you`);
    } catch (err: any) {
      // A last-second race (closed/unavailable between our pre-check and submit)
      // comes back structured — surface it as banners, not a raw error string.
      if (err instanceof CartInvalidError) {
        setClosedRestaurantIds(err.closedRestaurantIds);
        setUnavailableItemIds(err.unavailableItemIds);
        setError(null);
      } else {
        setError(err.message ?? 'Algo salió mal al hacer tu pedido. Por favor intenta de nuevo.');
      }
      setIsSubmitting(false);
    }
  };

  const handleClearCart = () => {
    clearCart();
    router.push(mode === 'food_court' ? `/mall/${slug}` : `/r/${slug}`);
  };

  if (mode === null) {
    return <p className="p-10 text-center font-body text-text-muted">Tu sesión expiró — por favor escanea el código QR de nuevo.</p>;
  }

  if (items.length === 0) {
    return (
      <div className="min-h-dvh">
        <Header title="Pagar" showBack showCart={false} />
        <p className="p-10 text-center font-body text-text-muted">Tu carrito está vacío.</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-10">
      <Header title="Pagar" showBack showCart={false} />

      <div className="flex flex-col gap-6 px-4 py-4">
        {hasBlocked && (
          <div className="flex flex-col gap-2 rounded-xl border border-error/40 bg-error/10 px-4 py-3">
            <p className="font-body text-sm font-semibold text-error">
              {closedRestaurantIds.length > 0 && unavailableItemIds.length > 0
                ? 'Un restaurante cerró y algunos platos ya no están disponibles.'
                : closedRestaurantIds.length > 0
                  ? 'Un restaurante cerró mientras hacías tu pedido.'
                  : 'Algunos platos ya no están disponibles.'}
            </p>
            <p className="font-body text-xs text-text-secondary">Quítalos para continuar con el resto de tu pedido.</p>
            <button
              onClick={removeBlocked}
              className="mt-1 self-start rounded-lg bg-error px-4 py-2 font-body text-sm font-bold text-white transition active:scale-[0.98]"
            >
              Quitar y continuar
            </button>
          </div>
        )}

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-text-muted">Tu pedido</h2>
            <button onClick={handleClearCart} className="font-body text-xs font-semibold text-error">
              Vaciar carrito
            </button>
          </div>
          {groups.map((g) => (
            <div
              key={g.restaurantId}
              className={`rounded-xl border bg-surface px-4 ${closedSet.has(g.restaurantId) ? 'border-error/40' : 'border-border-light'}`}
            >
              {groups.length > 1 && (
                <p className="border-b border-border-light py-2 font-heading text-xs font-bold uppercase tracking-wide text-text-secondary">
                  {g.restaurantName}
                </p>
              )}
              {closedSet.has(g.restaurantId) && (
                <p className="border-b border-error/20 py-2 font-body text-xs font-bold text-error">
                  ⛔ Este restaurante cerró — no puedes ordenar de aquí ahora.
                </p>
              )}
              {g.items.map((item) => (
                <CartItemRow
                  key={item.id}
                  item={item}
                  unavailable={unavailableSet.has(item.menuItem.id) || closedSet.has(g.restaurantId)}
                />
              ))}
              <div className="mb-3 mt-3 flex flex-col gap-1.5">
                <p className="font-body text-[11px] font-bold uppercase tracking-wide text-text-muted">
                  {groups.length > 1 ? `Notas para ${g.restaurantName}` : 'Notas del pedido'}
                </p>
                <textarea
                  value={notesByRestaurant[g.restaurantId] ?? ''}
                  onChange={(e) => setNotesByRestaurant((prev) => ({ ...prev, [g.restaurantId]: e.target.value }))}
                  placeholder="Ej. sin cebolla, salsa aparte… (opcional)"
                  rows={2}
                  className="w-full rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 font-body text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-primary"
                />
              </div>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="-mb-1 font-heading text-sm font-bold uppercase tracking-wide text-text-muted">Tipo de pedido</h2>
          <div className="flex gap-2">
            {(['dine-in', 'takeaway'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                className={`flex-1 rounded-lg border px-4 py-3 font-body text-sm font-semibold ${orderType === t ? 'border-primary bg-primary/10 text-text-primary' : 'border-border-light text-text-secondary'
                  }`}
              >
                {t === 'dine-in' ? 'Comer aquí' : 'Para llevar'}
              </button>
            ))}
          </div>
          {orderType === 'takeaway' && (
            <p className="-mt-1 font-body text-xs text-text-muted">Te lo empacamos para que te lo lleves a casa.</p>
          )}
        </section>

        {zones.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="-mb-1 font-heading text-sm font-bold uppercase tracking-wide text-text-muted">Confirma tu ubicación</h2>
            <p className="-mt-2 font-body text-xs text-text-muted">Escogimos esta según tu código QR — cámbiala si no es correcta.</p>
            <div className="flex flex-wrap gap-2">
              {zones.map((zone) => (
                <button
                  key={zone.id}
                  onClick={() => setTable(zone.id)}
                  className={`rounded-lg border px-4 py-3 font-body text-sm font-semibold ${tableId === zone.id ? 'border-primary bg-primary/10 text-text-primary' : 'border-border-light text-text-secondary'
                    }`}
                >
                  {zone.label}
                </button>
              ))}
            </div>
            {tableAllowsManualNumber && (
              <div className="flex flex-col gap-1">
                <input
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="Número de mesa (opcional)"
                  className="h-12 rounded-lg border border-border-light bg-surface px-4 font-body text-text-primary outline-none focus:border-primary"
                />
                <p className="font-body text-xs text-text-muted">Revisa el número en tu tarjeta QR — ayuda al mesero a encontrarte.</p>
              </div>
            )}
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-text-muted">Tus datos</h2>
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Nombre"
            className="h-12 rounded-lg border border-border-light bg-surface px-4 font-body text-text-primary outline-none focus:border-primary"
          />
          <input
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="Celular (ej. 61234567)"
            type="tel"
            className="h-12 rounded-lg border border-border-light bg-surface px-4 font-body text-text-primary outline-none focus:border-primary"
          />
          {customerPhone.trim().length > 0 && !isPhoneValid && (
            <p className="-mt-1 font-body text-xs text-error">Ingresa un número válido (mínimo 8 dígitos).</p>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-text-muted">Pago</h2>
          <p className="font-body text-xs text-text-muted">El pedido se paga cuando te lo entreguen.</p>
          {(['yappy', 'card_on_delivery'] as const).map((method) => (
            <button
              key={method}
              onClick={() => setPaymentMethod(method)}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left ${paymentMethod === method ? 'border-primary bg-primary/10' : 'border-border-light bg-surface'
                }`}
            >
              <span className="font-body text-sm font-semibold text-text-primary">
                {method === 'yappy' ? 'Yappy (en entrega)' : 'Tarjeta (en entrega)'}
              </span>
              {paymentMethod === method && <span className="text-primary">✓</span>}
            </button>
          ))}
        </section>

        <CartSummary subtotal={subtotal} tax={tax} />

        {error && <p className="font-body text-sm text-error">{error}</p>}

        <Button onClick={handleSubmit} disabled={!canSubmit} size="xl" className="w-full">
          {isSubmitting ? 'Enviando pedido…' : 'Confirmar pedido'}
        </Button>
      </div>
    </div>
  );
}
