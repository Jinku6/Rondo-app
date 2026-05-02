import { ColorsByTheme } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof ColorsByTheme.light & keyof typeof ColorsByTheme.dark
) {
  const theme = useColorScheme() ?? 'dark';
  const colorFromProps = props[theme];
  if (colorFromProps) return colorFromProps;
  return ColorsByTheme[theme][colorName];
}
