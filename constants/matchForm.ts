import type { MatchLevel, PositionKey, RequestedPositions } from '@/types/database';

type MatchLevelOption = {
  key: MatchLevel;
  label: string;
  emoji: string;
  activeBg: string;
  activeBorder: string;
  color: string;
};

export const MATCH_LEVEL_OPTIONS: readonly MatchLevelOption[] = [
  { key: 'tranquilo', label: 'Tranquilo', emoji: '😌', activeBg: 'bg-brand/20', activeBorder: 'border-brand', color: '#22C55E' },
  { key: 'medio', label: 'Medio', emoji: '⚽', activeBg: 'bg-warning/20', activeBorder: 'border-warning', color: '#F59E0B' },
  { key: 'competitivo', label: 'Competitivo', emoji: '🔥', activeBg: 'bg-danger/20', activeBorder: 'border-danger', color: '#EF4444' },
];

export const MATCH_POSITION_OPTIONS: readonly {
  key: PositionKey;
  label: string;
  emoji: string;
}[] = [
  { key: 'portero', label: 'Portero', emoji: '🧤' },
  { key: 'defensa', label: 'Defensa', emoji: '🛡️' },
  { key: 'mediocentro', label: 'Mediocentro', emoji: '⚙️' },
  { key: 'delantero', label: 'Delantero', emoji: '⚡' },
  { key: 'cualquiera', label: 'Cualquiera', emoji: '⚽' },
];

export function createEmptyRequestedPositions(): RequestedPositions {
  return {
    portero: 0,
    defensa: 0,
    mediocentro: 0,
    delantero: 0,
    cualquiera: 0,
  };
}
