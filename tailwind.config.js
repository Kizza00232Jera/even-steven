/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        'surface-2': 'var(--color-surface-2)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-tertiary': 'var(--color-text-tertiary)',
        border: 'var(--color-border)',
        accent: '#00C896',
        'accent-dim': 'rgba(0,200,150,0.15)',
        destructive: '#FF4444',
        'destructive-dim': 'rgba(255,68,68,0.15)',
        warning: '#F59E0B',
      },
    },
  },
  plugins: [],
};
