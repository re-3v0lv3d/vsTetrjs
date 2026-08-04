import { SPRINT_LINES, ULTRA_MS } from './constants';

export type SoloKind = 'marathon' | 'sprint' | 'ultra' | 'survival';

export interface ModeDef {
  id: SoloKind;
  title: string;
  blurb: string;
}

export const SOLO_MODES: ModeDef[] = [
  { id: 'marathon', title: 'Normal', blurb: 'Sin límite. Sube de nivel y sobrevive.' },
  { id: 'sprint', title: 'Sprint 40', blurb: `Limpia ${SPRINT_LINES} líneas lo más rápido posible.` },
  { id: 'ultra', title: 'Ultra 2 min', blurb: 'Máxima puntuación en 2 minutos.' },
  { id: 'survival', title: 'Survival', blurb: 'Basura periódica. Aguanta todo lo que puedas.' },
];

export function modeLabel(kind: SoloKind): string {
  return SOLO_MODES.find((m) => m.id === kind)?.title ?? kind;
}

export function formatTime(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export { SPRINT_LINES, ULTRA_MS };
