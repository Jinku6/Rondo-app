import { Colors } from '@/constants/theme';

const c = Colors;

export const POSITIONS = ['portero', 'defensa', 'mediocentro', 'delantero'];

export const POSITION_EMOJIS: Record<string, string> = {
  portero: '🧤',
  defensa: '🛡️',
  mediocentro: '⚙️',
  delantero: '⚡',
};

export const POSITION_LABELS: Record<string, string> = {
  portero: 'Portero',
  defensa: 'Defensa',
  mediocentro: 'Medio',
  delantero: 'Delantero',
};

export function getReliabilityInfo(score: number): { label: string; icon: string; color: string } {
  if (score >= 90) return { label: 'Nunca falta', icon: '✅', color: c.brand };
  if (score >= 75) return { label: 'Casi nunca falta', icon: '🌟', color: c.warning };
  if (score >= 50) return { label: 'Falta con frecuencia', icon: '⚠️', color: '#F97316' };
  return { label: 'Falta casi siempre', icon: '🚫', color: c.danger };
}

export function getAttitudeEmoji(rating: number): string {
  if (rating === 0) return '—';
  if (rating >= 4) return '🤩';
  if (rating >= 2.5) return '😐';
  return '😠';
}

export function formatMemberSince(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}
