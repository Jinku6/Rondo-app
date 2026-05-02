import type { ReactNode } from 'react';
import { Text, TextProps, StyleProp, TextStyle } from 'react-native';

import { Colors } from '@/constants/theme';

interface ScreenTitleProps extends TextProps {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}

export function ScreenTitle({ children, style, ...props }: ScreenTitleProps) {
  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: 'Archivo_900Black',
          fontSize: 30,
          lineHeight: 34,
          fontWeight: '900',
          color: Colors.text,
          textTransform: 'uppercase',
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
