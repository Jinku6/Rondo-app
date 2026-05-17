/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'rgb(var(--color-brand) / <alpha-value>)',
          deep: 'rgb(var(--color-brand-deep) / <alpha-value>)',
          soft: 'rgb(var(--color-brand) / 0.14)',
          glow: 'rgb(var(--color-brand) / 0.32)',
          ink: 'rgb(var(--color-brand-ink) / <alpha-value>)',
        },
        bg: {
          DEFAULT: 'rgb(var(--color-bg) / <alpha-value>)',
          elev: 'rgb(var(--color-bg-elev) / <alpha-value>)',
          surface: 'rgb(var(--color-bg-surface) / <alpha-value>)',
          surface2: 'rgb(var(--color-bg-surface2) / <alpha-value>)',
        },
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        surface2: 'rgb(var(--color-surface2) / <alpha-value>)',
        input: 'rgb(var(--color-input) / <alpha-value>)',
        pressed: 'rgb(var(--color-pressed) / <alpha-value>)',
        border: {
          DEFAULT: 'rgb(var(--color-border) / 0.08)',
          strong: 'rgb(var(--color-border-strong) / 0.16)',
        },
        ink: {
          DEFAULT: 'rgb(var(--color-ink) / <alpha-value>)',
          dim: 'rgb(var(--color-ink-dim) / <alpha-value>)',
          muted: 'rgb(var(--color-ink-muted) / <alpha-value>)',
        },
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        info: 'rgb(var(--color-info) / <alpha-value>)',
      },
      fontFamily: {
        display: ['Archivo_900Black', 'Archivo_800ExtraBold', 'sans-serif'],
        body: ['Inter_400Regular', 'Inter_600SemiBold', 'sans-serif'],
        mono: ['JetBrainsMono_500Medium', 'JetBrainsMono_700Bold', 'monospace'],
      },
      borderRadius: {
        'sm-r': '10px',
        'md-r': '14px',
        'lg-r': '20px',
        'xl-r': '26px',
      },
    },
  },
  plugins: [],
};
