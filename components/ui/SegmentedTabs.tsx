import { Pressable, Text, View } from 'react-native';

export interface SegmentedTabOption<TValue extends string> {
  label: string;
  value: TValue;
  accessibilityLabel?: string;
}

interface SegmentedTabsProps<TValue extends string> {
  options: readonly SegmentedTabOption<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
}

export function SegmentedTabs<TValue extends string>({
  options,
  value,
  onChange,
}: SegmentedTabsProps<TValue>) {
  return (
    <View className="flex-row rounded-xl border border-border bg-bg-surface p-1">
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            className={`min-h-11 flex-1 items-center justify-center rounded-lg ${isActive ? 'bg-brand' : 'bg-transparent'}`}
            style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
          >
            <Text
              className={`font-display text-xs uppercase tracking-wider ${isActive ? 'text-white' : 'text-ink-dim'}`}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
