/**
 * Rondo Design System — constants/theme.ts
 * Colors and typography aligned with estilos.md
 *
 * Tailwind class mapping:
 *   Brand primary  = green-500 (#22C55E) — use `green-*` classes, NOT emerald/teal
 *   Main BG (dark) = neutral-950 (#0A0A0A)
 *   Card/Input BG (dark) = gray-900 (#111827)
 *   Borders (dark) = gray-800 (#1F2937)
 *   Warning        = amber-* classes
 *   Error          = red-* classes
 */

import { Platform } from 'react-native';

// ─── Brand Colors ───────────────────────────────────────────
export const Brand = {
  /** Primary green — CTA buttons, active states */
  primary: '#22C55E',
} as const;

// ─── Semantic State Colors ──────────────────────────────────
export const StateColors = {
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
} as const;

// ─── Light / Dark Theme Tokens ──────────────────────────────
export const Colors = {
  light: {
    text: '#111827',
    secondaryText: '#6B7280',
    background: '#FFFFFF',
    secondaryBackground: '#F9FAFB',
    tint: Brand.primary,
    icon: '#6B7280',
    secondaryIcon: '#64748b',
    tabIconDefault: '#6B7280',
    tabIconSelected: Brand.primary,
    card: '#FFFFFF',
    divider: '#E5E7EB',
  },
  dark: {
    text: '#FFFFFF',
    secondaryText: '#9CA3AF',
    background: '#0A0A0A',
    secondaryBackground: '#111827',
    tint: Brand.primary,
    icon: '#9BA1A6',
    secondaryIcon: '#94a3b8',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: Brand.primary,
    card: '#111827',
    divider: '#1F2937',
  },
} as const;

// ─── Typography ─────────────────────────────────────────────
export const Fonts = Platform.select({
  ios: {
    /** iOS system font (Inter loaded via expo-font where needed) */
    sans: 'Inter',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'Inter',
    serif: 'serif',
    rounded: 'Inter',
    mono: 'monospace',
  },
  web: {
    sans: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "Inter, system-ui, sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// ─── Spacing (from estilos.md) ──────────────────────────────
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
