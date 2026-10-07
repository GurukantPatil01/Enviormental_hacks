export const colors = {
  primary: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    300: '#86EFAC',
    400: '#4ADE80',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
    800: '#166534',
    900: '#0E3B2E', // EcoPulse signature dark green
    950: '#052E16',
  },
  eco: {
    leaf: '#10B981',
    forest: '#0D2818',
    lime: '#84CC16',
    soil: '#78350F',
    sky: '#0284C7',
  },
  accent: {
    streak: '#EA580C', // vibrant fire amber
    streakBg: '#FFF7ED',
    points: '#D97706', // warm eco gold
    pointsBg: '#FEF3C7',
  },
  neutral: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },
  surface: {
    white: '#FFFFFF',
    background: '#F8FAFC',
    card: '#FFFFFF',
    border: '#E2E8F0',
    hover: '#F1F5F9',
  },
  status: {
    success: '#16A34A',
    warning: '#D97706',
    error: '#DC2626',
    info: '#2563EB',
  }
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const typography = {
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 22,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
  },
  bodyBold: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  metric: {
    fontSize: 34,
    fontWeight: '800' as const,
    letterSpacing: -1,
  }
} as const;
