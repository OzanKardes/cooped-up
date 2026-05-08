// ─── Cooped Up — Neobrutalist Theme ──────────────────────────────────────────
// Palette: blue-grays, off-whites, deep navy, sharp black borders
// Style: neobrutalism — thick borders, hard shadows, bold type, flat colour

export const Colors = {
  // Core
  black: '#0D0D0D',
  white: '#F5F3EE',        // warm off-white, not pure white
  cream: '#EDE9E0',

  // Blues & Grays (primary palette)
  navy: '#1B2A4A',
  blue: '#2D4B8E',
  blueLight: '#4A6DB5',
  bluePale: '#C8D6F0',
  blueMuted: '#8FA5C9',

  gray900: '#1A1A1A',
  gray700: '#3D3D3D',
  gray500: '#7A7A7A',
  gray300: '#B8B8B8',
  gray100: '#E8E6E0',

  // Accents (used sparingly)
  accent: '#E8F0FE',       // pale blue accent background
  accentStrong: '#2D4B8E', // strong blue for highlights

  // Status
  green: '#2D6A4F',
  greenLight: '#B7E4C7',
  orange: '#E76F51',
  orangeLight: '#FFD6C4',
  red: '#C1121F',
  redLight: '#FFD6D8',
};

export const Typography = {
  // DM Sans — clean, geometric, modern sans with character
  // Closest open-source match to the Imperial Pentagram typeface
  display: 'DM Sans',
  body: 'DM Sans',

  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 24,
    xxl: 32,
    hero: 42,
  },

  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    black: '900' as const,
  },
};

export const Borders = {
  width: 2,               // neobrutalism uses thick borders
  widthHeavy: 3,
  radius: 4,              // mostly sharp corners — neobrutalism signature
  radiusSm: 2,
  radiusLg: 8,
};

export const Shadows = {
  // Hard offset shadows — neobrutalism signature
  sm: {
    shadowColor: Colors.black,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  md: {
    shadowColor: Colors.black,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  lg: {
    shadowColor: Colors.black,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
};