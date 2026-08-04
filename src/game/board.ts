import { COLS, TOTAL_ROWS, type CellColor } from './constants';
import type { ActivePiece, Coord } from './pieces';
import { cellsOf } from './pieces';

export type BoardGrid = CellColor[][];

export function createBoard(): BoardGrid {
  return Array.from({ length: TOTAL_ROWS }, () => Array<CellColor>(COLS).fill(0));
}

export function cloneBoard(board: BoardGrid): BoardGrid {
  return board.map((row) => row.slice());
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < COLS && y >= 0 && y < TOTAL_ROWS;
}

export function collides(board: BoardGrid, piece: ActivePiece): boolean {
  for (const [x, y] of cellsOf(piece)) {
    if (!inBounds(x, y) || board[y][x] !== 0) return true;
  }
  return false;
}

export function lockPiece(board: BoardGrid, piece: ActivePiece): void {
  for (const [x, y] of cellsOf(piece)) {
    if (inBounds(x, y)) board[y][x] = piece.id;
  }
}

export function clearLines(board: BoardGrid): number[] {
  const cleared: number[] = [];
  for (let y = TOTAL_ROWS - 1; y >= 0; y--) {
    if (board[y].every((c) => c !== 0)) {
      cleared.push(y);
      board.splice(y, 1);
      board.unshift(Array<CellColor>(COLS).fill(0));
      y++;
    }
  }
  return cleared;
}

export function addGarbage(board: BoardGrid, rows: number, hole: number): boolean {
  for (let i = 0; i < rows; i++) {
    if (board[0].some((c) => c !== 0)) return false;
    board.shift();
    const row = Array<CellColor>(COLS).fill('G');
    row[hole] = 0;
    board.push(row);
  }
  return true;
}

export function clearBottomRow(board: BoardGrid): boolean {
  const y = TOTAL_ROWS - 1;
  if (board[y].every((c) => c === 0)) return false;
  board.splice(y, 1);
  board.unshift(Array<CellColor>(COLS).fill(0));
  return true;
}

export function ghostY(board: BoardGrid, piece: ActivePiece): number {
  const ghost = { ...piece };
  while (!collides(board, { ...ghost, y: ghost.y + 1 })) ghost.y++;
  return ghost.y;
}

/** Compact visible board for network sync (visible rows only) */
export function boardLite(board: BoardGrid): number[] {
  const out: number[] = [];
  const map: Record<string, number> = { I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7, G: 8 };
  for (let y = TOTAL_ROWS - 20; y < TOTAL_ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = board[y][x];
      out.push(c === 0 ? 0 : map[c] ?? 0);
    }
  }
  return out;
}

export function expandBoardLite(lite: number[]): BoardGrid {
  const board = createBoard();
  const rev: CellColor[] = [0, 'I', 'O', 'T', 'S', 'Z', 'J', 'L', 'G'];
  let i = 0;
  for (let y = TOTAL_ROWS - 20; y < TOTAL_ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      board[y][x] = rev[lite[i++]] ?? 0;
    }
  }
  return board;
}

export type { Coord };
