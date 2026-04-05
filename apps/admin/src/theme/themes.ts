// ─── KIKI Brand Theme System ────────────────────────────────────────────────
// Based on KIKI-brand.md color palette

export type ThemeColors = {
  // Backgrounds / Surfaces
  background: string;
  surface: string;
  surfaceContainer: string;
  surfaceHighlight: string;

  // Brand
  primary: string;
  onPrimary: string;
  secondary: string;
  tertiary: string;

  // Semantic
  success: string;
  error: string;
  warning: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  // Borders / Dividers
  border: string;
  borderLight: string;

  // Overlays
  overlay: string;
  overlayHeavy: string;

  // Status-specific accents (for order cards)
  statusConfirmedBg: string;
  statusConfirmedText: string;
  statusPreparingBg: string;
  statusPreparingText: string;
  statusReadyBg: string;
  statusReadyText: string;
  statusCompletedBg: string;
  statusCompletedText: string;

  // Tab bar
  tabBarBg: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;
};

export const darkTheme: ThemeColors = {
  // Backgrounds — deep navy from KIKI brand
  background: '#060e1d',
  surface: '#0f192c',
  surfaceContainer: '#0a1324',
  surfaceHighlight: '#162035',

  // Brand colors from KIKI-brand.md
  primary: '#ccff00',      // Lime green CTA
  onPrimary: '#000000',
  secondary: '#ff6b98',    // Hot pink
  tertiary: '#00f0ff',     // Cyan

  // Semantic
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',

  // Text — from KIKI brand On Surface tokens
  textPrimary: '#dde5fb',
  textSecondary: '#a3abc0',
  textMuted: '#40485a',
  textInverse: '#060e1d',

  // Borders — subtle in dark mode
  border: '#40485a',
  borderLight: '#1e2d44',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.65)',
  overlayHeavy: 'rgba(0, 0, 0, 0.88)',

  // Order status badges
  statusConfirmedBg: 'rgba(204,255,0,0.15)',
  statusConfirmedText: '#ccff00',
  statusPreparingBg: 'rgba(255,107,152,0.15)',
  statusPreparingText: '#ff6b98',
  statusReadyBg: 'rgba(34,197,94,0.15)',
  statusReadyText: '#22C55E',
  statusCompletedBg: 'rgba(163,171,192,0.1)',
  statusCompletedText: '#a3abc0',

  // Tab bar
  tabBarBg: '#0a1324',
  tabBarBorder: '#40485a',
  tabBarActive: '#ccff00',
  tabBarInactive: '#40485a',
};

export const lightTheme: ThemeColors = {
  // Backgrounds — clean white/light gray
  background: '#f4f6fb',
  surface: '#ffffff',
  surfaceContainer: '#edf0f8',
  surfaceHighlight: '#e4e8f4',

  // Brand colors stay consistent
  primary: '#ccff00',
  onPrimary: '#000000',
  secondary: '#ff6b98',
  tertiary: '#0099bb',   // Darker cyan for light mode readability

  // Semantic
  success: '#16A34A',
  error: '#DC2626',
  warning: '#D97706',

  // Text
  textPrimary: '#060e1d',
  textSecondary: '#40485a',
  textMuted: '#8b95ad',
  textInverse: '#ffffff',

  // Borders
  border: '#d0d6e8',
  borderLight: '#e8eaf5',

  // Overlays
  overlay: 'rgba(6,14,29,0.4)',
  overlayHeavy: 'rgba(6,14,29,0.75)',

  // Order status badges
  statusConfirmedBg: 'rgba(0,0,0,0.06)',
  statusConfirmedText: '#3d6600',       // Dark olive on white
  statusPreparingBg: 'rgba(255,107,152,0.12)',
  statusPreparingText: '#b5004e',
  statusReadyBg: 'rgba(22,163,74,0.12)',
  statusReadyText: '#166534',
  statusCompletedBg: 'rgba(64,72,90,0.1)',
  statusCompletedText: '#40485a',

  // Tab bar
  tabBarBg: '#ffffff',
  tabBarBorder: '#d0d6e8',
  tabBarActive: '#060e1d',   // Dark brand on light tab bar
  tabBarInactive: '#8b95ad',
};
