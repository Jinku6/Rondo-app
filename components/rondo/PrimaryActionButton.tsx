import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type PrimaryActionButtonProps = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryActionButton({
  label,
  onPress,
  accessibilityLabel = label,
  disabled = false,
  loading = false,
  style,
}: PrimaryActionButtonProps) {
  const { colors: c } = useTheme();
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: c.brand, shadowColor: c.brand },
        style,
        (pressed || inactive) && styles.inactive,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={c.brandInk} />
      ) : (
        <Text style={[styles.label, { color: c.brandInk }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    minHeight: 60,
    borderRadius: 26,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 8,
  },
  label: {
    fontFamily: 'Archivo_900Black',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  inactive: { opacity: 0.65 },
});
