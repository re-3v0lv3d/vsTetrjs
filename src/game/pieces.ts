import type { PieceId } from './constants';

export type Coord = [number, number];

/** 4 rotations × cells, SRS-style shapes */
export const SHAPES: Record<PieceId, Coord[][]> = {
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  O: [
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]],
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
};

/**
 * SRS wall-kick offsets. Guideline uses +Y up; we use +Y down → negate Y.
 * Indexed as fromRot * 4 + toRot for JLSTZ / I.
 */
function negY(table: Coord[][]): Coord[][] {
  return table.map((row) => row.map(([x, y]) => [x, -y] as Coord));
}

/** JLSTZ kicks (including T) — SRS */
const JLSTZ_RAW: Coord[][] = [
  // 0>>1
  [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  // 1>>0
  [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  // 1>>2
  [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  // 2>>1
  [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  // 2>>3
  [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  // 3>>2
  [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  // 3>>0
  [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  // 0>>3
  [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
];

const I_RAW: Coord[][] = [
  [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
];

const JLSTZ_KICKS = negY(JLSTZ_RAW);
const I_KICKS = negY(I_RAW);

function kickIndex(from: number, to: number): number {
  const map: Record<string, number> = {
    '0,1': 0,
    '1,0': 1,
    '1,2': 2,
    '2,1': 3,
    '2,3': 4,
    '3,2': 5,
    '3,0': 6,
    '0,3': 7,
  };
  return map[`${from},${to}`] ?? 0;
}

export function kicksFor(id: PieceId, from: number, to: number): Coord[] {
  if (id === 'O') return [[0, 0]];
  const idx = kickIndex(from, to);
  if (id === 'I') return I_KICKS[idx] ?? [[0, 0]];
  return JLSTZ_KICKS[idx] ?? [[0, 0]];
}

/** Fallback simple kicks (unused by engine if SRS tables work) */
export const KICKS: Coord[] = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [0, -1],
  [-1, -1],
  [1, -1],
  [-2, 0],
  [2, 0],
  [0, -2],
];

export const BAG_ORDER: PieceId[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

export interface ActivePiece {
  id: PieceId;
  x: number;
  y: number;
  rot: number;
}

export function cellsOf(piece: ActivePiece): Coord[] {
  return SHAPES[piece.id][piece.rot].map(([cx, cy]) => [piece.x + cx, piece.y + cy]);
}

/** Center of T tetromino in board coords */
export function tCenter(piece: ActivePiece): Coord {
  return [piece.x + 1, piece.y + 1];
}

export function spawnPiece(id: PieceId): ActivePiece {
  return { id, x: 3, y: 0, rot: 0 };
}

export class BagRandom {
  private bag: PieceId[] = [];
  private rng: () => number;

  constructor(seed = Date.now()) {
    let s = seed >>> 0;
    this.rng = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x100000000;
    };
  }

  next(): PieceId {
    if (this.bag.length === 0) {
      this.bag = [...BAG_ORDER];
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    return this.bag.pop()!;
  }
}
