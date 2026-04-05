// KIKI Kiosk Colors
// Re-exports from the theme system for backwards compatibility.
// Screens and components should use `useTheme()` from context instead of importing this directly.

import { lightTheme } from './themes';

// Default to light theme tokens (kiosk default)
export const colors = {
  background: lightTheme.background,
  surface: lightTheme.surface,
  surfaceElevated: lightTheme.surfaceContainer,
  surfaceHighlight: lightTheme.surfaceHighlight,

  primary: lightTheme.primary,
  primaryDark: '#aad600',       // Darker lime for pressed states
  primaryLight: '#d9ff33',

  secondary: lightTheme.secondary,
  secondaryDark: '#cc4472',

  success: lightTheme.success,
  successDark: '#15803d',
  error: lightTheme.error,
  errorDark: '#b91c1c',
  warning: lightTheme.warning,

  textPrimary: lightTheme.textPrimary,
  textSecondary: lightTheme.textSecondary,
  textMuted: lightTheme.textMuted,
  textInverse: lightTheme.textInverse,

  border: lightTheme.border,
  borderLight: lightTheme.borderLight,

  overlay: lightTheme.overlay,
  overlayHeavy: lightTheme.overlayHeavy,
} as const;

export type ColorName = keyof typeof colors;
