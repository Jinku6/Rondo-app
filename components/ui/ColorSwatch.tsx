import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ColorSwatchProps = {
  color: string;
  label: string;
  selected?: boolean;
  onPress: () => void;
  size?: number;
};

const SELECTED_BORDER = '#22C55E';
const DEFAULT_BORDER = 'rgba(255,255,255,0.34)';
const INNER_BORDER = 'rgba(0,0,0,0.24)';

const hexToRgb = (hex: string) => {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;

  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
};

const isLightColor = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 170;
};

export function ColorSwatch({
  color,
  label,
  selected = false,
  onPress,
  size = 36,
}: ColorSwatchProps) {
  const iconColor = isLightColor(color) ? '#111827' : '#FFFFFF';

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Color ${label}`}
      accessibilityState={{ selected }}
      activeOpacity={0.72}
      onPress={onPress}
      style={[
        styles.target,
        {
          width: size + 10,
          height: size + 10,
          borderColor: selected ? SELECTED_BORDER : DEFAULT_BORDER,
        },
      ]}
    >
      <View
        style={[
          styles.swatch,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
        ]}
      >
        {selected && <Ionicons name="checkmark" size={18} color={iconColor} />}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  target: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
  },
  swatch: {
    alignItems: 'center',
    borderColor: INNER_BORDER,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
});
