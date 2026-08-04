export type PowerupId =
  | 'garbage'
  | 'blind'
  | 'slow'
  | 'speed'
  | 'clear'
  | 'lock'
  | 'stain'
  | 'rush';

export type PowerupKind = 'buff' | 'debuff';

export interface PowerupDef {
  id: PowerupId;
  kind: PowerupKind;
  label: string;
  short: string;
  desc: string;
  color: string;
  durationMs?: number;
  garbageRows?: number;
}

export const POWERUPS: Record<PowerupId, PowerupDef> = {
  garbage: {
    id: 'garbage',
    kind: 'debuff',
    label: 'Basura',
    short: 'GBG',
    desc: 'Envía 2 filas basura',
    color: '#8B9AA8',
    garbageRows: 2,
  },
  blind: {
    id: 'blind',
    kind: 'debuff',
    label: 'Ceguera',
    short: 'BLD',
    desc: 'Oscurece el tablero 4s',
    color: '#1a1a2e',
    durationMs: 4000,
  },
  slow: {
    id: 'slow',
    kind: 'debuff',
    label: 'Lento',
    short: 'SLW',
    desc: 'Ralentiza la caída 5s',
    color: '#4FC3F7',
    durationMs: 5000,
  },
  speed: {
    id: 'speed',
    kind: 'buff',
    label: 'Turbo',
    short: 'SPD',
    desc: 'Acelera tu gravedad 6s',
    color: '#B8FF3C',
    durationMs: 6000,
  },
  clear: {
    id: 'clear',
    kind: 'buff',
    label: 'Limpia',
    short: 'CLR',
    desc: 'Borra la fila inferior',
    color: '#FFE566',
  },
  lock: {
    id: 'lock',
    kind: 'debuff',
    label: 'Espejo',
    short: 'MIR',
    desc: 'Espeja movimiento y rotación 5s',
    color: '#FF4D6D',
    durationMs: 5000,
  },
  stain: {
    id: 'stain',
    kind: 'debuff',
    label: 'Manchas',
    short: 'INK',
    desc: 'Manchas en su pantalla 6s',
    color: '#9B59B6',
    durationMs: 6000,
  },
  rush: {
    id: 'rush',
    kind: 'debuff',
    label: 'Acelera',
    short: 'FST',
    desc: 'Acelera el juego del rival 6s',
    color: '#FF8A3D',
    durationMs: 6000,
  },
};

const DEBUFFS: PowerupId[] = ['garbage', 'blind', 'slow', 'lock', 'stain', 'rush'];
const BUFFS: PowerupId[] = ['speed', 'clear'];
const VERSUS_POOL: PowerupId[] = [...DEBUFFS, ...BUFFS];
const SOLO_POOL: PowerupId[] = [...BUFFS, 'clear', 'speed'];

export function rollPowerup(versus: boolean, rng = Math.random): PowerupId {
  const pool = versus ? VERSUS_POOL : SOLO_POOL;
  return pool[Math.floor(rng() * pool.length)]!;
}

export function isSelfBuff(id: PowerupId): boolean {
  return POWERUPS[id].kind === 'buff';
}
