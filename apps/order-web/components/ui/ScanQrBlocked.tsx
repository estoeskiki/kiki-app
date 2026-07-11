// Shown on /mall/<slug> and /r/<slug> in production when no table token is
// present in the session — every real order must come from a /t/<token>
// link (printed on a table/zone QR card) so staff always know where an
// order came from. These bare-slug routes stay live in dev for convenience.
export function ScanQrBlocked() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="text-5xl">📱</span>
      <p className="font-heading text-2xl font-bold text-text-primary">Escanea el código QR</p>
      <p className="max-w-xs font-body text-sm text-text-secondary">
        Para hacer un pedido, escanea el código QR de tu mesa.
      </p>
    </div>
  );
}
