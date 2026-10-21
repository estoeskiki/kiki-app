'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';

const ICON_BTN =
  'inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border transition-colors';
const IDLE = 'border-line text-muted hover:border-primary/40 hover:text-primary';

/**
 * Copy / open buttons for a zone's ordering-site link. Icon-only so they sit
 * beside the zone's status badge without competing with it; the link text
 * itself is rendered by ZonesCard under the zone name.
 */
export function OrderLinkActions({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (non-secure context) — the open button still works.
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={copy}
        title={copied ? 'Copiado' : 'Copiar link de pedidos'}
        aria-label="Copiar link de pedidos"
        className={`${ICON_BTN} ${copied ? 'border-primary/40 bg-primary/10 text-primary' : IDLE}`}
      >
        <Icon name={copied ? 'check' : 'copy'} size={14} />
      </button>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title="Abrir sitio de pedidos"
        aria-label="Abrir sitio de pedidos"
        className={`${ICON_BTN} ${IDLE}`}
      >
        <Icon name="external" size={14} />
      </a>
    </>
  );
}
