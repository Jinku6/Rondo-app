import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  style?: ViewStyle;
}

export function EmptyState({ icon = 'calendar-outline', title, description, action, style }: EmptyStateProps) {
  return (
    <View className="items-center justify-center p-6 mt-10" style={style}>
      <View className="mb-4">
        <Ionicons name={icon} size={64} color="#94a3b8" />
      </View>
      <Text className="text-xl font-bold text-slate-800 dark:text-slate-100 text-center mb-2">
        {title}
      </Text>
      {description && (
        <Text className="text-sm font-medium text-slate-500 mt-2 text-center mb-6 px-4">
          {description}
        </Text>
      )}
      {action && (
        <TouchableOpacity
          className="bg-green-500 px-6 py-3 rounded-full mt-2"
          onPress={action.onClick}
        >
          <Text className="text-white font-bold">{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
