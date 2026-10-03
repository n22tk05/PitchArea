/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"Space Mono"', 'monospace'],
        sans: ['"Space Grotesk"', 'sans-serif'],
        headline: ['"Space Grotesk"', 'sans-serif'],
      },
      colors: {
        background: '#f9f9fb',
        surface: '#ffffff',
        'surface-container-low': '#f3f3f5',
        'surface-container': '#eeeef0',
        'surface-container-high': '#e8e8ea',
        'surface-container-highest': '#e2e2e4',
        'on-surface': '#1a1c1d',
        'on-surface-variant': '#46464b',
        primary: '#000000',
        'on-primary': '#ffffff',
        error: '#ba1a1a',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',
      },
      boxShadow: {
        arcade: '4px 4px 0px 0px #0a0b0e',
        'arcade-sm': '2px 2px 0px 0px #0a0b0e',
      },
    },
  },
  plugins: [],
};
