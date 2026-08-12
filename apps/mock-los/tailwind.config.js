/** @type {import('tailwindcss').Config} */
const config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy:   '#0a0f1e',
        card:   '#111827',
        border: '#1e2d40',
        accent: { DEFAULT: '#3b82f6', hover: '#2563eb' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

module.exports = config;
