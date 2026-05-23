export const Colors = {
  accent: '#00C896',
  accentDim: 'rgba(0,200,150,0.15)',
  destructive: '#FF4444',
  destructiveDim: 'rgba(255,68,68,0.15)',
  warning: '#F59E0B',

  dark: {
    background: '#0b0b0b',
    surface: '#1a1a1a',
    surface2: '#242424',
    textPrimary: '#ffffff',
    textSecondary: 'rgba(255,255,255,0.55)',
    textTertiary: 'rgba(255,255,255,0.3)',
    border: 'rgba(255,255,255,0.08)',
  },

  light: {
    background: '#f8f8f8',
    surface: '#ffffff',
    surface2: '#f2f2f2',
    textPrimary: '#0b0b0b',
    textSecondary: 'rgba(0,0,0,0.45)',
    textTertiary: 'rgba(0,0,0,0.25)',
    border: 'rgba(0,0,0,0.08)',
  },

  gradients: {
    trip: ['#1a3a5c', '#0d7377'] as [string, string],
    home: ['#7c3500', '#c84b00'] as [string, string],
    couple: ['#6b1a3a', '#4a0080'] as [string, string],
    utilities: ['#1e2a4a', '#2d3a8c'] as [string, string],
    family: ['#0a4a2a', '#0d7a4a'] as [string, string],
    other: ['#1a1a1a', '#2d2d2d'] as [string, string],
  },

  balance: {
    positiveFrom: '#003d2e',
    positiveTo: '#005a42',
    negativeFrom: '#3d0000',
    negativeTo: '#5a0000',
  },
} as const;
