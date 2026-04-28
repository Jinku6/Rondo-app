const { Colors, Radius } = require('./constants/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        'rondo-bg':           Colors.bg,
        'rondo-bg-elev':      Colors.bgElev,
        'rondo-bg-surface':   Colors.bgSurface,
        'rondo-bg-surface2':  Colors.bgSurface2,
        'rondo-text':         Colors.text,
        'rondo-text-dim':     Colors.textDim,
        'rondo-text-muted':   Colors.textMuted,
        'rondo-brand':        Colors.brand,
        'rondo-brand-deep':   Colors.brandDeep,
        'rondo-danger':       Colors.danger,
        'rondo-warning':      Colors.warning,
        'rondo-info':         Colors.info,
      },
      borderRadius: {
        'rondo-sm': `${Radius.sm}px`,
        'rondo-md': `${Radius.md}px`,
        'rondo-lg': `${Radius.lg}px`,
        'rondo-xl': `${Radius.xl}px`,
      },
    },
  },
  plugins: [],
};
