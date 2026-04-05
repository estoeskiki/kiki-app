// ─── KIKI Brand Theme System (Kiosk) ─────────────────────────────────────────

export type ThemeColors = {
  // Backgrounds / Surfaces
  background: string;
  surface: string;
  surfaceContainer: string;
  surfaceHighlight: string;

  // Brand
  primary: string;       // lime #ccff00
  onPrimary: string;     // #000 for text on lime
  secondary: string;     // hot pink
  tertiary: string;      // cyan

  // Semantic
  success: string;
  error: string;
  warning: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  // Borders
  border: string;
  borderLight: string;

  // Overlays
  overlay: string;
  overlayHeavy: string;
};

// ── Light Theme (default for kiosk – clean, airy, Square-like) ───────────────
export const lightTheme: ThemeColors = {
  background: '#f6f8ff',
  surface: '#ffffff',
  surfaceContainer: '#edf0f8',
  surfaceHighlight: '#e2e6f3',

  primary: '#ccff00',
  onPrimary: '#000000',
  secondary: '#ff6b98',
  tertiary: '#0099bb',

  success: '#16A34A',
  error: '#DC2626',
  warning: '#D97706',

  textPrimary: '#060e1d',
  textSecondary: '#40485a',
  textMuted: '#8b95ad',
  textInverse: '#ffffff',

  border: '#d0d6e8',
  borderLight: '#e8eaf5',

  overlay: 'rgba(6,14,29,0.35)',
  overlayHeavy: 'rgba(6,14,29,0.72)',
};

// ── Dark Theme ────────────────────────────────────────────────────────────────
export const darkTheme: ThemeColors = {
  background: '#060e1d',
  surface: '#0f192c',
  surfaceContainer: '#0a1324',
  surfaceHighlight: '#162035',

  primary: '#ccff00',
  onPrimary: '#000000',
  secondary: '#ff6b98',
  tertiary: '#00f0ff',

  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',

  textPrimary: '#dde5fb',
  textSecondary: '#a3abc0',
  textMuted: '#40485a',
  textInverse: '#060e1d',

  border: '#40485a',
  borderLight: '#1e2d44',

  overlay: 'rgba(0, 0, 0, 0.65)',
  overlayHeavy: 'rgba(0, 0, 0, 0.88)',
};
