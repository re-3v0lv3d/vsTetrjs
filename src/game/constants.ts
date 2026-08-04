export const COLS = 10;
export const ROWS = 20;
export const HIDDEN_ROWS = 2;
export const TOTAL_ROWS = ROWS + HIDDEN_ROWS;

export const BASE_GRAVITY_MS = 800;
export const LOCK_DELAY_MS = 500;
/** Max move/rotate lock-delay resets while grounded (Guideline-style) */
export const MAX_LOCK_RESETS = 15;
export const DAS_MS = 140;
export const ARR_MS = 35;
/** Soft drop: fixed ms per cell (not a gravity multiplier — avoids teleport) */
export const SOFT_DROP_MS = 65;

export const LINES_PER_LEVEL = 3;
export const MAX_POWERUP_SLOTS = 3;
/** Bonus powerup every N lines cleared (also on doubles+) */
export const POWERUP_EVERY_LINES = 4;

export const SCORE_TABLE = {
  single: 100,
  double: 300,
  triple: 500,
  tetris: 800,
  softDrop: 1,
  hardDrop: 2,
  combo: 50,
  debuffSoloBonus: 150,
} as const;

export type CellColor =
  | 0
  | 'I'
  | 'O'
  | 'T'
  | 'S'
  | 'Z'
  | 'J'
  | 'L'
  | 'G';

export type PieceId = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
