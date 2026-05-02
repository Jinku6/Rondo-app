import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, ColorsLight, Fonts, Radius, Shadows, Spacing } from '@/constants/theme';

export function useTheme() {
  const scheme = useColorScheme() ?? 'dark';
  const colors = scheme === 'light' ? ColorsLight : Colors;
  const shadows = scheme === 'light' ? Shadows.light : Shadows.dark;
  return { colors, fonts: Fonts, radius: Radius, spacing: Spacing, shadows, scheme } as const;
}
