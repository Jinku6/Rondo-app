import { Text, TouchableOpacity } from 'react-native';

interface StatCardProps {
  label: string;
  value: number;
  tone: 'brand' | 'warning' | 'muted';
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}

const toneClasses = {
  brand: {
    idle: 'bg-brand/10 border-brand/20',
    active: 'bg-brand/20 border-brand',
    value: 'text-brand',
  },
  warning: {
    idle: 'bg-warning/10 border-warning/20',
    active: 'bg-warning/20 border-warning',
    value: 'text-warning',
  },
  muted: {
    idle: 'bg-input/5 border-border',
    active: 'bg-input/10 border-border-strong',
    value: 'text-ink-dim',
  },
} as const;

export function StatCard({
  label,
  value,
  tone,
  selected,
  onPress,
  accessibilityLabel,
}: StatCardProps) {
  const classes = toneClasses[tone];

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      className={`min-h-[96px] flex-1 items-center justify-center rounded-xl border px-4 py-4 ${selected ? classes.active : classes.idle}`}
    >
      <Text className="mb-1 text-center font-mono text-[10px] uppercase tracking-wider text-ink-dim">
        {label}
      </Text>
      <Text className={`text-center font-display text-4xl leading-[42px] ${classes.value}`}>
        {value}
      </Text>
    </TouchableOpacity>
  );
}
