import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy:   { DEFAULT: '#0a0f1e', 50: '#f0f4ff', 900: '#0a0f1e' },
        slate2: '#0d1424',
        card:   '#111827',
        border: '#1e2d40',
        accent: { DEFAULT: '#3b82f6', hover: '#2563eb' },
        green:  { score: '#22c55e' },
        yellow: { score: '#eab308' },
        red:    { score: '#ef4444' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
