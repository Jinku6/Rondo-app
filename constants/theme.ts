/**
 * Rondo Design System — Stadium Fusion v2
 * Colors, typography, spacing aligned with estilos.md and mockup
 */

// ─── DARK MODE TOKENS ───────────────────────────────────────────
export const Colors = {
  bg: '#0A0A0A',
  bgElev: '#111827',
  bgSurface: '#161A18',
  bgSurface2: '#1F2423',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',

  text: '#F4F3EE',
  textDim: '#8A938F',
  textMuted: '#5A625D',

  brand: '#22C55E',
  brandDeep: '#16A34A',
  brandSoft: 'rgba(34,197,94,0.14)',
  brandGlow: 'rgba(34,197,94,0.32)',
  brandInk: '#FFFFFF',

  danger: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
} as const;

// ─── LIGHT MODE TOKENS ──────────────────────────────────────────
export const ColorsLight = {
  bg: '#FFFFFF',
  bgElev: '#F8FAF9',
  bgSurface: '#F0F5F1',
  bgSurface2: '#E8EEE9',
  border: 'rgba(0,0,0,0.08)',
  borderStrong: 'rgba(0,0,0,0.16)',

  text: '#111827',
  textDim: '#374151',
  textMuted: '#4B5563',

  brand: '#22C55E',
  brandDeep: '#166534',
  brandSoft: 'rgba(22,163,74,0.12)',
  brandGlow: 'rgba(22,163,74,0.25)',
  brandInk: '#FFFFFF',

  danger: '#B91C1C',
  warning: '#92400E',
  info: '#1D4ED8',
} as const;

export type ThemeColors = typeof Colors;

// ─── TYPOGRAPHY ─────────────────────────────────────────────────
export const Fonts = {
  display: 'Archivo',
  body: 'Inter',
  mono: 'JetBrainsMono',
} as const;

// ─── RADIUS ─────────────────────────────────────────────────────
export const Radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
} as const;

// ─── SPACING ────────────────────────────────────────────────────
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

// ─── SHADOWS (per theme) ────────────────────────────────────────
export const Shadows = {
  dark: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 8 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.6, shadowRadius: 50, elevation: 16 },
  },
  light: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 32, elevation: 8 },
  },
} as const;

export const theme = { colors: Colors, fonts: Fonts, radius: Radius, spacing: Spacing } as const;

// ─── LEGACY / COMPAT ────────────────────────────────────────────
export const Brand = { primary: Colors.brand } as const;
export const StateColors = { success: Colors.brand, error: Colors.danger, warning: Colors.warning, info: Colors.info } as const;

export const ColorsByTheme = {
  light: {
    text: ColorsLight.text,
    secondaryText: ColorsLight.textDim,
    background: ColorsLight.bg,
    secondaryBackground: ColorsLight.bgElev,
    tint: ColorsLight.brandDeep,
    icon: ColorsLight.textDim,
    secondaryIcon: ColorsLight.textMuted,
    tabIconDefault: ColorsLight.textMuted,
    tabIconSelected: ColorsLight.brandDeep,
    card: ColorsLight.bgSurface,
    divider: ColorsLight.border,
  },
  dark: {
    text: Colors.text,
    secondaryText: Colors.textDim,
    background: Colors.bg,
    secondaryBackground: Colors.bgElev,
    tint: Colors.brand,
    icon: Colors.textDim,
    secondaryIcon: Colors.textMuted,
    tabIconDefault: Colors.textDim,
    tabIconSelected: Colors.brand,
    card: Colors.bgSurface,
    divider: Colors.border,
  },
} as const;
