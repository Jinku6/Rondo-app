import { useMemo } from 'react';
import { vars } from 'nativewind';

import { ColorChannels } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function useThemeVars() {
  const { scheme } = useTheme();

  return useMemo(() => {
    const c = ColorChannels[scheme];

    return vars({
      '--color-bg': c.bg,
      '--color-bg-elev': c.bgElev,
      '--color-bg-surface': c.bgSurface,
      '--color-bg-surface2': c.bgSurface2,
      '--color-surface': c.bgSurface,
      '--color-surface2': c.bgSurface2,
      '--color-input': c.inputBg,
      '--color-pressed': c.pressed,
      '--color-border': c.border,
      '--color-border-strong': c.borderStrong,
      '--color-ink': c.text,
      '--color-ink-dim': c.textDim,
      '--color-ink-muted': c.textMuted,
      '--color-brand': c.brand,
      '--color-brand-deep': c.brandDeep,
      '--color-brand-ink': c.brandInk,
      '--color-danger': c.danger,
      '--color-warning': c.warning,
      '--color-info': c.info,
    });
  }, [scheme]);
}
