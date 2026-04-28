import React from 'react';
import { View, Text, ViewProps } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export type BadgeVariant = 'open' | 'full' | 'org' | 'joined' | 'tranquilo' | 'medio' | 'competitivo';

interface BadgeProps extends ViewProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'open', style, ...props }) => {
  const { colors } = useTheme();

  const variantStyles: Record<BadgeVariant, { bg: string; color: string; border: string }> = {
    open:        { bg: colors.brandSoft,              color: colors.brand,   border: 'rgba(34,197,94,0.30)' },
    full:        { bg: 'rgba(239,68,68,0.12)',         color: colors.danger,  border: 'rgba(239,68,68,0.30)' },
    org:         { bg: 'rgba(245,158,11,0.13)',        color: colors.warning, border: 'rgba(245,158,11,0.30)' },
    joined:      { bg: 'rgba(34,197,94,0.13)',         color: colors.brand,   border: 'rgba(34,197,94,0.30)' },
    tranquilo:   { bg: 'rgba(34,197,94,0.12)',         color: colors.brand,   border: 'rgba(34,197,94,0.30)' },
    medio:       { bg: 'rgba(245,158,11,0.13)',        color: colors.warning, border: 'rgba(245,158,11,0.30)' },
    competitivo: { bg: 'rgba(239,68,68,0.12)',         color: colors.danger,  border: 'rgba(239,68,68,0.30)' },
  };

  const s = variantStyles[variant];

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 9,
          paddingVertical: 4,
          borderRadius: 100,
          backgroundColor: s.bg,
          borderWidth: 1,
          borderColor: s.border,
        },
        style,
      ]}
      {...props}
    >
      <Text style={{ color: s.color, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>
        {children}
      </Text>
    </View>
  );
};
