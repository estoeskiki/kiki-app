'use client';

import { useEffect, useRef } from 'react';
import type { YappyTransaction } from '@/lib/yappy';

// Yappy's official web component (Angular element, loaded from their CDN).
// Inputs are element properties; outputs are DOM CustomEvents named after
// the output: eventClick, eventSuccess (detail = transactionId), eventError
// (detail = EXPIRED | DENIED | DUPLICATED_TRANSACTION | CANCELLED | ERROR),
// isYappyOnline (detail = boolean).
declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'btn-yappy': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        theme?: string;
        rounded?: string;
      };
    }
  }
}

type BtnYappyElement = HTMLElement & {
  eventPayment: (tx: { transactionId: string; token: string; documentName: string }) => void;
  isButtonLoading: boolean;
  triggerModal: boolean;
};

const CDN_URL = process.env.NEXT_PUBLIC_YAPPY_CDN_URL;
const LOAD_TIMEOUT_MS = 10_000;

let loader: Promise<void> | null = null;

// Loaded once per page lifetime, as a module script (that's how Yappy ships it).
function loadYappyComponent(): Promise<void> {
  if (!CDN_URL) return Promise.reject(new Error('missing_cdn_url'));
  if (loader) return loader;
  loader = new Promise<void>((resolve, reject) => {
    const fail = (err: Error) => {
      loader = null; // allow a later retry
      reject(err);
    };
    const timer = setTimeout(() => fail(new Error('cdn_timeout')), LOAD_TIMEOUT_MS);
    const defined = () =>
      customElements.whenDefined('btn-yappy').then(() => {
        clearTimeout(timer);
        resolve();
      });
    if (customElements.get('btn-yappy')) return void defined();
    const script = document.createElement('script');
    script.type = 'module';
    script.src = CDN_URL;
    script.onload = () => void defined();
    script.onerror = () => {
      clearTimeout(timer);
      script.remove();
      fail(new Error('cdn_error'));
    };
    document.head.appendChild(script);
  });
  return loader;
}

export function YappyButton({
  disabled,
  onCreate,
  onSuccess,
  onError,
  onUnavailable,
}: {
  disabled: boolean;
  // Creates (or reuses) the server-side charge. null = refused, already handled.
  onCreate: () => Promise<YappyTransaction | null>;
  onSuccess: (transactionId: string) => void;
  onError: (status: string) => void;
  // CDN failed to load or Yappy reports itself offline: checkout falls back
  // to pay-on-delivery.
  onUnavailable: () => void;
}) {
  const ref = useRef<BtnYappyElement>(null);
  // Latest callbacks without re-binding the element's listeners.
  const cb = useRef({ disabled, onCreate, onSuccess, onError, onUnavailable });
  useEffect(() => {
    cb.current = { disabled, onCreate, onSuccess, onError, onUnavailable };
  });

  useEffect(() => {
    let cancelled = false;
    let el: BtnYappyElement | null = null;
    let busy = false;

    const handleClick = async () => {
      if (!el || busy || cb.current.disabled) return;
      busy = true;
      el.isButtonLoading = true;
      try {
        const tx = await cb.current.onCreate();
        if (tx && !cancelled) {
          el.eventPayment({ transactionId: tx.transactionId, token: tx.token, documentName: tx.documentName });
        }
      } finally {
        busy = false;
        if (el) el.isButtonLoading = false;
      }
    };
    const handleSuccess = (e: Event) => cb.current.onSuccess(String((e as CustomEvent).detail ?? ''));
    const handleError = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      cb.current.onError(typeof detail === 'string' ? detail : 'ERROR');
    };
    const handleOnline = (e: Event) => {
      if ((e as CustomEvent).detail === false) cb.current.onUnavailable();
    };

    loadYappyComponent()
      .then(() => {
        if (cancelled || !ref.current) return;
        el = ref.current;
        // Our own overlay (YappyWaitingOverlay) shows progress, driven by the
        // IPN. Yappy's modal would stack a second, event-driven one on top.
        el.triggerModal = false;
        el.addEventListener('eventClick', handleClick);
        el.addEventListener('eventSuccess', handleSuccess);
        el.addEventListener('eventError', handleError);
        el.addEventListener('isYappyOnline', handleOnline);
      })
      .catch(() => {
        if (!cancelled) cb.current.onUnavailable();
      });

    return () => {
      cancelled = true;
      if (el) {
        el.removeEventListener('eventClick', handleClick);
        el.removeEventListener('eventSuccess', handleSuccess);
        el.removeEventListener('eventError', handleError);
        el.removeEventListener('isYappyOnline', handleOnline);
      }
    };
  }, []);

  return (
    <div className={`flex justify-center transition ${disabled ? 'pointer-events-none opacity-40' : ''}`} aria-disabled={disabled}>
      <btn-yappy ref={ref} theme="light" rounded="true" />
    </div>
  );
}
