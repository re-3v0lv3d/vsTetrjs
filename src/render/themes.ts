import type { CellColor, PieceId } from '../game/constants';

export const THEME = {
  bg: '#071018',
  bgElevated: '#0c1824',
  grid: 'rgba(184, 255, 60, 0.06)',
  panel: 'rgba(12, 24, 36, 0.85)',
  lime: '#B8FF3C',
  coral: '#FF4D6D',
  text: '#E8F0F5',
  muted: '#7A8A96',
  garbage: '#5A6670',
} as const;

export const PIECE_COLORS: Record<Exclude<CellColor, 0>, { fill: string; glow: string }> = {
  I: { fill: '#3DE0FF', glow: 'rgba(61, 224, 255, 0.55)' },
  O: { fill: '#FFE566', glow: 'rgba(255, 229, 102, 0.55)' },
  T: { fill: '#C77DFF', glow: 'rgba(199, 125, 255, 0.5)' },
  S: { fill: '#B8FF3C', glow: 'rgba(184, 255, 60, 0.5)' },
  Z: { fill: '#FF4D6D', glow: 'rgba(255, 77, 109, 0.5)' },
  J: { fill: '#4D7CFF', glow: 'rgba(77, 124, 255, 0.5)' },
  L: { fill: '#FF9F43', glow: 'rgba(255, 159, 67, 0.5)' },
  G: { fill: '#5A6670', glow: 'rgba(90, 102, 112, 0.35)' },
};

export function colorFor(cell: CellColor | PieceId): { fill: string; glow: string } {
  if (cell === 0) return { fill: 'transparent', glow: 'transparent' };
  return PIECE_COLORS[cell];
}
