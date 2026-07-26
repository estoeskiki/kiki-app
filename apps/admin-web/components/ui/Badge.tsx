import type { ReactNode } from 'react';
import type { MemberRole, OrderChannel, OrderStatus } from '@/lib/types';

/**
 * Pill badge with a soft translucent fill — never a solid block. This is a
 * standing rule for the Kiki brand across the kiosk, KDS and this console.
 */
export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-[5px] px-2 py-[3px] text-[11px] font-semibold ${TONE_CLASS[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export type Tone = 'lime' | 'pink' | 'cyan' | 'blue' | 'neutral' | 'green';

const TONE_CLASS: Record<Tone, string> = {
  lime: 'bg-primary/10 text-primary',
  pink: 'bg-secondary/12 text-secondary',
  cyan: 'bg-tertiary/12 text-tertiary',
  blue: 'bg-[#60a5fa]/12 text-[#60a5fa]',
  green: 'bg-success/12 text-success',
  neutral: 'bg-text-secondary/10 text-muted',
};

const STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  confirmed: { label: 'Confirmado', tone: 'blue' },
  preparing: { label: 'Preparando', tone: 'cyan' },
  ready: { label: 'Listo', tone: 'lime' },
  completed: { label: 'Completado', tone: 'neutral' },
  cancelled: { label: 'Cancelado', tone: 'pink' },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS[status as OrderStatus] ?? { label: status, tone: 'neutral' as Tone };
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}

export function statusLabel(status: string): string {
  return STATUS[status as OrderStatus]?.label ?? status;
}

/**
 * Where the order came from — `orders.channel`, written at creation time by
 * supabase/functions/create-web-order (the kiosk posts channel:'kiosk' through
 * the same function). Shown on every order row and on the Overview breakdown.
 */
export function ChannelBadge({ channel }: { channel: string }) {
  const isKiosk = channel === 'kiosk';
  return (
    <Badge tone={isKiosk ? 'lime' : 'cyan'}>{isKiosk ? 'Kiosko' : 'Web'}</Badge>
  );
}

export function channelLabel(channel: string): string {
  return channel === 'kiosk' ? 'Kiosko' : 'Web';
}

/**
 * Which zone the order came from. A zone is a row in `tables` — Sala VIP,
 * Palco #1, Mesa 5 — and the label rendered here is the snapshot taken on the
 * order itself, so renaming or deleting a zone never rewrites history.
 *
 * A null table_id means no QR was scanned (walk-up or slug entry).
 */
export function ZoneBadge({
  tableId,
  label,
  tableNumber,
}: {
  tableId: string | null;
  label: string | null;
  tableNumber?: string | null;
}) {
  if (!tableId || !label) {
    return <Badge tone="neutral">Sin zona</Badge>;
  }

  const normalized = label.toLowerCase();
  const tone: Tone = normalized.includes('vip')
    ? 'pink'
    : normalized.includes('palco')
      ? 'cyan'
      : 'neutral';

  return (
    <Badge tone={tone}>
      {label}
      {tableNumber ? <span className="ml-1 opacity-70">· {tableNumber}</span> : null}
    </Badge>
  );
}

const ROLE: Record<MemberRole, { label: string; tone: Tone }> = {
  owner: { label: 'Propietario', tone: 'pink' },
  manager: { label: 'Gerente', tone: 'cyan' },
  staff: { label: 'Personal', tone: 'neutral' },
  kiosk_device: { label: 'Kiosko', tone: 'lime' },
};

export function RoleBadge({ role, isPlatformAdmin }: { role: string | null; isPlatformAdmin?: boolean }) {
  if (isPlatformAdmin) return <Badge tone="lime">Super Admin</Badge>;
  if (!role) return <Badge tone="neutral">—</Badge>;
  const cfg = ROLE[role as MemberRole] ?? { label: role, tone: 'neutral' as Tone };
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}

export function ChannelDot({ channel }: { channel: OrderChannel | string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-[7px] rounded-full ${
        channel === 'kiosk' ? 'bg-primary' : 'bg-tertiary'
      }`}
    />
  );
}
