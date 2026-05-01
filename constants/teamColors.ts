export type TeamColorOption = {
  label: string;
  value: string;
};

export const TEAM_COLOR_OPTIONS: readonly TeamColorOption[] = [
  { label: 'Rojo', value: '#EF4444' },
  { label: 'Azul', value: '#3B82F6' },
  { label: 'Verde', value: '#10B981' },
  { label: 'Amarillo', value: '#F59E0B' },
  { label: 'Negro', value: '#000000' },
  { label: 'Blanco', value: '#FFFFFF' },
] as const;
