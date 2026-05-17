import type { ReactNode } from 'react';
import { Text, TextProps, StyleProp, TextStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

interface ScreenTitleProps extends TextProps {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}

export function ScreenTitle({ children, style, ...props }: ScreenTitleProps) {
  const { colors } = useTheme();

  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: 'Archivo_900Black',
          fontSize: 30,
          lineHeight: 34,
          fontWeight: '900',
          color: colors.text,
          textTransform: 'uppercase',
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
