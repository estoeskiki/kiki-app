export const colors = {
  background: '#0A0A0A',
  surface: '#1A1A1A',
  surfaceElevated: '#242424',
  surfaceHighlight: '#2E2E2E',

  primary: '#FF6B35',
  primaryDark: '#CC5529',
  primaryLight: '#FF8F66',

  secondary: '#FFB800',
  secondaryDark: '#CC9300',

  success: '#22C55E',
  successDark: '#16A34A',
  error: '#EF4444',
  errorDark: '#DC2626',
  warning: '#F59E0B',

  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textMuted: '#666666',
  textInverse: '#0A0A0A',

  border: '#2A2A2A',
  borderLight: '#3A3A3A',

  overlay: 'rgba(0, 0, 0, 0.6)',
  overlayHeavy: 'rgba(0, 0, 0, 0.85)',
} as const;

export type ColorName = keyof typeof colors;
