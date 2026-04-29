const { Colors, Radius } = require('./constants/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#22C55E',
          deep: '#16A34A',
          soft: 'rgba(34,197,94,0.14)',
          glow: 'rgba(34,197,94,0.32)',
          ink: '#FFFFFF',
        },
        bg: {
          DEFAULT: '#0A0A0A',
          elev: '#111827',
          surface: '#161A18',
          surface2: '#1F2423',
        },
        ink: {
          DEFAULT: '#F4F3EE',
          dim: '#8A938F',
          muted: '#5A625D',
        },
        danger: '#EF4444',
        warning: '#F59E0B',
        info: '#3B82F6',
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
