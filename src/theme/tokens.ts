// Design tokens adapted from afkaf_v13.html CSS variables
import { Platform } from 'react-native';

export const colors = {
  // Surfaces
  surface: '#F5F2EA',
  card: '#FFFFFF',
  cardWarm: '#FDFAF3',
  ink: '#1C1D1A',
  textSecondary: '#4F524D',
  textMuted: '#797D76',
  textSoft: '#A8ABA3',
  border: 'rgba(31,33,28,0.07)',
  borderStrong: 'rgba(31,33,28,0.13)',

  // Brand
  primary: '#3A7D32',
  primaryDark: '#2C5F25',
  primaryDeep: '#1C4117',
  primaryLight: '#EBF4E6',
  primaryMid: '#C2DCB8',
  primaryTint: '#F4FAF1',

  // Safety semantics
  danger: '#C0392B',
  dangerBg: '#FDECEB',
  caution: '#C25B08',
  cautionBg: '#FDEED6',
  cautionMid: '#FBBF24',
  safe: '#3A7D32',
  safeBg: '#EBF4E6',

  // Misc
  white: '#FFFFFF',
  cream: '#FBF6EC',
  sun: '#EFB73A',
} as const;

export const radii = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  full: 999,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#1F211C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#1F211C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#1F211C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;

export const typography = {
  display: { fontSize: 28, fontWeight: '800' as const, fontFamily: 'Nunito_800ExtraBold', letterSpacing: -0.5 },
  h1: { fontSize: 22, fontWeight: '700' as const, fontFamily: 'Nunito_700Bold', letterSpacing: -0.4 },
  h2: { fontSize: 18, fontWeight: '700' as const, fontFamily: 'Nunito_700Bold', letterSpacing: -0.3 },
  h3: { fontSize: 16, fontWeight: '600' as const, fontFamily: 'Nunito_600SemiBold' },
  body: { fontSize: 15, fontWeight: '400' as const, fontFamily: 'Nunito_400Regular' },
  sm: { fontSize: 13, fontWeight: '400' as const, fontFamily: 'Nunito_400Regular' },
  xs: { fontSize: 11, fontWeight: '400' as const, fontFamily: 'Nunito_400Regular' },
  mono: { fontSize: 15, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const animation = {
  fast: 180,
  base: 260,
  slow: 340,
} as const;

// Heat status visual config
export const heatVis = {
  ok: { color: colors.safe, tint: colors.safeBg, label: 'ok' },
  caution: { color: colors.caution, tint: colors.cautionBg, label: 'caution' },
  danger: { color: colors.danger, tint: colors.dangerBg, label: 'danger' },
} as const;
