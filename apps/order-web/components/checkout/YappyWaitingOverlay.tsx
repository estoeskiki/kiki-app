'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/currency';
import { getYappyPaymentStatus, PENDING_TTL_MS, type YappyPending, type YappyStatusResult } from '@/lib/yappy';
import { useCartStore } from '@/store/useCartStore';
import { useLastOrderStore } from '@/store/useLastOrderStore';
import { useYappyPendingStore } from '@/store/useYappyPendingStore';

const POLL_MS = 3000;
// After the IPN says executed, how long to show "creando tu pedido" before
// admitting a human has to look at it (fulfillment_error / attention).
const ORDER_GRACE_MS = 60_000;

const BUTTON_HINTS: Record<string, string> = {
  DENIED: 'Yappy indica que el pago fue rechazado.',
  CANCELLED: 'Yappy indica que cancelaste el pago.',
  EXPIRED: 'Yappy indica que el pago expiró.',
  DUPLICATED_TRANSACTION: 'Yappy detectó un pago duplicado.',
  ERROR: 'Yappy reportó un error.',
};

function mmss(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Mounted once in the root layout: whenever a Yappy attempt is pending —
// just started at checkout, or resumed after the tab was closed — this
// covers the page and polls get_yappy_payment_status until the IPN settles
// it. It never lets the customer pay again while Yappy might still confirm.
export function YappyWaitingOverlay() {
  const pending = useYappyPendingStore((s) => s.pending);
  const hydrate = useYappyPendingStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Keyed per attempt so all local state starts fresh for a new payment.
  return pending ? <WaitingCard key={pending.paymentId} pending={pending} /> : null;
}

function WaitingCard({ pending }: { pending: YappyPending }) {
  const router = useRouter();
  const buttonHint = useYappyPendingStore((s) => s.buttonHint);
  const finish = useYappyPendingStore((s) => s.finish);
  const clearCart = useCartStore((s) => s.clearCart);
  const setLastOrder = useLastOrderStore((s) => s.set);

  const [status, setStatus] = useState<YappyStatusResult | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // When the IPN first reported 'executed' while the order wasn't there yet.
  const [executedAt, setExecutedAt] = useState<number | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const s = await getYappyPaymentStatus(pending.paymentId);
        if (stopped) return;
        if (!s) {
          finish(); // unknown or older than 24h
          return;
        }
        setStatus(s);
        if (s.status === 'executed') {
          setExecutedAt((t) => t ?? Date.now());
          if (s.orderId) {
            stopped = true;
            clearCart();
            setLastOrder({ orderId: s.orderId, orderNumber: s.orderNumber ?? 0, customerName: pending.customerName });
            finish();
            router.replace(`/order/${s.orderId}/thank-you`);
            return;
          }
        }
      } catch {
        // transient — keep polling
      }
      if (!stopped) timer = setTimeout(poll, POLL_MS);
    };
    poll();

    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(tick);
    };
  }, [pending, finish, clearCart, setLastOrder, router]);

  const total = status?.totalCents ?? null;
  const expiresAt = status ? new Date(status.expiresAt).getTime() : pending.createdAt + 5 * 60 * 1000;
  const graceEndsAt = pending.createdAt + PENDING_TTL_MS;
  const executed = status?.status === 'executed';
  // A terminal answer from Yappy itself (IPN), or a clean refusal from
  // payment-wc. A local expiry without IPN is NOT terminal: Yappy may still
  // confirm, so it falls through to the time-based "don't pay again" wait.
  const settledNoPay =
    !!status &&
    (status.status === 'failed' ||
      ((status.status === 'cancelled' || status.status === 'expired') && status.ipnReceived));

  const close = (retry: boolean) => finish({ retry });
  const closePaid = () => {
    clearCart();
    finish();
  };

  let icon: 'spin' | 'check' | 'warn' = 'spin';
  let title: string;
  let body: React.ReactNode = null;
  let actions: React.ReactNode = null;

  if (executed) {
    const late = executedAt !== null && now - executedAt > ORDER_GRACE_MS;
    icon = 'check';
    title = late ? 'Pago recibido' : 'Pago recibido, creando tu pedido…';
    body = late ? (
      <>
        El comercio está revisando tu pedido. No pagues de nuevo.
        {status?.confirmationNumber && (
          <span className="mt-2 block font-mono text-xs text-text-muted">Confirmación: {status.confirmationNumber}</span>
        )}
      </>
    ) : null;
    if (late) {
      actions = (
        <button onClick={closePaid} className="font-body text-sm font-semibold text-text-secondary underline">
          Cerrar
        </button>
      );
    }
  } else if (settledNoPay) {
    icon = 'warn';
    title =
      status!.status === 'cancelled' ? 'Pago cancelado' : status!.status === 'expired' ? 'El pago expiró' : 'No se pudo iniciar el pago';
    body = 'No se cobró nada. Puedes intentarlo de nuevo.';
    actions = (
      <div className="flex w-full flex-col gap-2">
        <button
          onClick={() => close(true)}
          className="h-12 w-full rounded-xl bg-primary font-heading font-bold text-on-primary transition active:scale-[0.98]"
        >
          Reintentar
        </button>
        <button onClick={() => close(false)} className="font-body text-sm font-semibold text-text-secondary underline">
          Cerrar
        </button>
      </div>
    );
  } else if (now < expiresAt) {
    title = 'Abre Yappy y confirma el pago';
    body = (
      <>
        Te enviamos el cobro a tu app Yappy.
        <span className="mt-2 block font-heading text-3xl font-black tabular-nums text-text-primary">{mmss(expiresAt - now)}</span>
        {buttonHint && <span className="mt-2 block text-xs text-text-muted">{BUTTON_HINTS[buttonHint] ?? buttonHint} Confirmando…</span>}
      </>
    );
  } else if (now < graceEndsAt) {
    icon = 'spin';
    title = 'Esperando confirmación de Yappy';
    body = 'Si ya confirmaste en Yappy, no pagues de nuevo. Te avisamos apenas llegue la confirmación.';
  } else {
    icon = 'warn';
    title = 'No recibimos confirmación';
    body = 'Si Yappy te cobró, el comercio lo verá y te ayudará. Si no pagaste, puedes intentarlo de nuevo.';
    actions = (
      <div className="flex w-full flex-col gap-2">
        <button
          onClick={() => close(true)}
          className="h-12 w-full rounded-xl bg-primary font-heading font-bold text-on-primary transition active:scale-[0.98]"
        >
          No pagué, reintentar
        </button>
        <button onClick={() => close(false)} className="font-body text-sm font-semibold text-text-secondary underline">
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <div className="fade-up-item flex w-full max-w-xs flex-col items-center gap-4 rounded-2xl bg-surface px-6 py-8 text-center shadow-xl">
        {icon === 'check' ? (
          <svg width="64" height="64" viewBox="0 0 88 88" fill="none" className="check-circle">
            <circle cx="44" cy="44" r="42" fill="#ccff00" fillOpacity="0.2" stroke="#9bc200" strokeWidth="2" />
            <path d="M28 45L39 56L60 33" stroke="#5f7a00" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="check-path" />
          </svg>
        ) : icon === 'warn' ? (
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-error/10 text-2xl">!</span>
        ) : (
          <span className="h-14 w-14 animate-spin rounded-full border-4 border-border-light border-t-primary" />
        )}
        <div className="flex flex-col gap-1">
          <p className="font-heading text-lg font-bold text-text-primary">{title}</p>
          {total !== null && <p className="font-heading text-2xl font-black text-text-primary">{formatCurrency(total)}</p>}
        </div>
        {body && <p className="font-body text-sm text-text-secondary">{body}</p>}
        {actions}
        <p className="rounded-full bg-surface-container px-3 py-1 font-body text-[11px] font-semibold text-text-muted">
          Pago con Yappy
        </p>
      </div>
    </div>
  );
}
