// Ported from apps/kiosk/src/theme/typography.ts. Font *values* here are the
// web (CSS font-family) names — apps/order-web loads Space Grotesk + Syne via
// next/font/google. The kiosk RN app loads the same two families via
// expo-google-fonts under its own (RN-specific) font-weight names.

export const fonts = {
  heading: "'Space Grotesk', sans-serif", // weight 700
  headingSemiBold: "'Space Grotesk', sans-serif", // weight 600
  body: "'Syne', sans-serif", // weight 400
  bodySemiBold: "'Syne', sans-serif", // weight 600
  bodyBold: "'Syne', sans-serif", // weight 700
} as const;

export const fontSizes = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  '2xl': 30,
  '3xl': 38,
  '4xl': 48,
  '5xl': 60,
} as const;

export const lineHeights = {
  tight: 1.1,
  snug: 1.25,
  normal: 1.4,
  relaxed: 1.6,
} as const;

export const letterSpacing = {
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  wider: 1,
  widest: 2,
} as const;
