// Deterministic pastel "plate" placeholder color for menu items with no
// photo — same hashing approach as apps/kiosk/src/screens/ItemDetailModal.tsx
// so item cards feel consistent between kiosk and web.
const LIGHT_PLATES = ['#eef3ff', '#f0fff4', '#fff4f0', '#f9f0ff', '#f0fffe', '#fffbf0', '#fff0f5', '#f0f7ff'] as const;

export function getPlateColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return LIGHT_PLATES[Math.abs(h) % LIGHT_PLATES.length];
}
