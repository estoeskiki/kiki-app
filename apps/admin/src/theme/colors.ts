// Static color constants — use useTheme() for theme-aware colors in components
// These are kept for legacy imports and non-component contexts

export const colors = {
  // KIKI brand dark theme (default)
  background: '#060e1d',
  surface: '#0f192c',
  surfaceElevated: '#0a1324',
  surfaceHighlight: '#162035',

  primary: '#ccff00',
  primaryDark: '#99cc00',
  primaryLight: '#d9ff4d',

  secondary: '#ff6b98',
  secondaryDark: '#cc0058',

  success: '#22C55E',
  successDark: '#16A34A',
  error: '#EF4444',
  errorDark: '#DC2626',
  warning: '#F59E0B',

  textPrimary: '#dde5fb',
  textSecondary: '#a3abc0',
  textMuted: '#40485a',
  textInverse: '#060e1d',

  border: '#40485a',
  borderLight: '#1e2d44',

  overlay: 'rgba(0, 0, 0, 0.65)',
  overlayHeavy: 'rgba(0, 0, 0, 0.88)',
} as const;

export type ColorName = keyof typeof colors;
