/**
 * Visual tokens mirrored from apps/web/app/styles.css so the native app feels
 * like the same product. Keep in sync with the web palette.
 */
export const colors = {
  ink: '#101828',
  muted: '#687386',
  soft: '#f5f8fc',
  wash: '#eef5f7',
  surface: '#ffffff',
  surfaceStrong: '#fbfcff',
  canvas: '#f4f7fb',
  line: '#d8e0ee',
  lineStrong: '#b9c6da',
  accent: '#0757c2',
  accentStrong: '#0645a1',
  accentSoft: '#e7f0ff',
  teal: '#0f8f83',
  tealSoft: '#e6f7f5',
  violet: '#7147d8',
  violetSoft: '#f0eafb',
  danger: '#b42318',
  dangerSoft: '#feeceb',
  success: '#087443',
  successSoft: '#e7f7ee',
  warning: '#946200',
  warningSoft: '#fff4d7',
  disabled: '#9aa6b8',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '700' as const, letterSpacing: -0.4 },
  title: { fontSize: 21, lineHeight: 27, fontWeight: '700' as const, letterSpacing: -0.2 },
  subtitle: { fontSize: 17, lineHeight: 23, fontWeight: '600' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' as const },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  smallStrong: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const },
  eyebrow: { fontSize: 11, lineHeight: 15, fontWeight: '700' as const, letterSpacing: 1.1 },
} as const;

export const shadow = {
  card: {
    shadowColor: '#101828',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
} as const;
