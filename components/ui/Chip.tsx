import React from 'react';
import { Text, TouchableOpacity, TouchableOpacityProps } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

type ChipVariant = 'default' | 'action';

interface ChipProps extends TouchableOpacityProps {
  label: string;
  selected?: boolean;
  variant?: ChipVariant;
  onPress?: () => void;
}

export const Chip: React.FC<ChipProps> = ({ label, selected = false, variant = 'default', onPress, style, ...props }) => {
  const { colors } = useTheme();
  const isAction = variant === 'action';

  const bgColor = variant === 'default' && selected ? colors.brandSoft : isAction ? colors.bgElev : colors.bgSurface;
  const textColor = variant === 'default' && selected ? colors.brand : colors.text;
  const borderColor = variant === 'default' && selected ? colors.brand : isAction ? colors.borderStrong : colors.border;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
      style={[
        {
          paddingHorizontal: 12,
          paddingVertical: isAction ? 10 : 6,
          borderRadius: 100,
          backgroundColor: bgColor,
          borderWidth: 1,
          borderColor,
          minHeight: isAction ? 42 : undefined,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
      {...props}
    >
      <Text style={{ fontSize: isAction ? 12 : 13, fontWeight: '600', color: textColor, textAlign: 'center' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};
