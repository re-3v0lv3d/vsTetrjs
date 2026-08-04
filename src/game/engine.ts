import {
  BASE_GRAVITY_MS,
  COLS,
  LINES_PER_LEVEL,
  LOCK_DELAY_MS,
  MAX_LOCK_RESETS,
  MAX_POWERUP_SLOTS,
  POWERUP_EVERY_LINES,
  SCORE_TABLE,
  SOFT_DROP_MS,
  SPRINT_LINES,
  SURVIVAL_GARBAGE_MS,
  TOTAL_ROWS,
  ULTRA_MS,
  type CellColor,
  type TSpinKind,
} from './constants';
import type { SoloKind } from './modes';
import {
  addGarbage,
  boardLite,
  clearBottomRow,
  clearLines,
  collides,
  createBoard,
  ghostY,
  lockPiece,
  type BoardGrid,
} from './board';
import {
  BagRandom,
  cellsOf,
  kicksFor,
  spawnPiece,
  tCenter,
  type ActivePiece,
  type Coord,
} from './pieces';
import { isSelfBuff, rollPowerup, type PowerupId } from './powerups';

export type GameMode = 'solo' | 'versus';

export interface ClearInfo {
  lines: number[];
  count: number;
  tSpin: TSpinKind;
  label: string;
  combo: number;
  comboMul: number;
}

export interface EngineEvents {
  onLock?: () => void;
  onClear?: (info: ClearInfo) => void;
  onTSpin?: (kind: TSpinKind, lines: number) => void;
  onGameOver?: () => void;
  onWin?: (reason: 'sprint' | 'ultra') => void;
  onPowerupGain?: (id: PowerupId) => void;
  onPowerupUse?: (id: PowerupId, target: 'self' | 'rival') => void;
  onEffect?: (id: PowerupId, active: boolean) => void;
  onScore?: (score: number) => void;
  onLevel?: (level: number) => void;
  onHold?: () => void;
  onMove?: () => void;
  onRotate?: () => void;
  onHardDrop?: () => void;
}

export interface EngineSnapshot {
  board: BoardGrid;
  active: ActivePiece | null;
  hold: ActivePiece['id'] | null;
  canHold: boolean;
  next: ActivePiece['id'][];
  score: number;
  lines: number;
  level: number;
  combo: number;
  comboMul: number;
  slots: (PowerupId | null)[];
  effects: ActiveEffects;
  gameOver: boolean;
  won: boolean;
  paused: boolean;
  ghostY: number;
  clearing: number[];
  shake: number;
  elapsedMs: number;
  remainMs: number | null;
  soloKind: SoloKind | null;
}

export interface ActiveEffects {
  blindUntil: number;
  slowUntil: number;
  speedUntil: number;
  invertUntil: number;
  stainUntil: number;
  rushUntil: number;
  stainSeed: number;
}

function emptyEffects(): ActiveEffects {
  return {
    blindUntil: 0,
    slowUntil: 0,
    speedUntil: 0,
    invertUntil: 0,
    stainUntil: 0,
    rushUntil: 0,
    stainSeed: 0,
  };
}

export class GameEngine {
  mode: GameMode;
  soloKind: SoloKind | null;
  board: BoardGrid = createBoard();
  active: ActivePiece | null = null;
  hold: ActivePiece['id'] | null = null;
  canHold = true;
  nextQueue: ActivePiece['id'][] = [];
  score = 0;
  lines = 0;
  level = 1;
  combo = -1;
  slots: (PowerupId | null)[] = [null, null, null];
  effects = emptyEffects();
  gameOver = false;
  won = false;
  paused = false;
  clearing: number[] = [];
  shake = 0;
  elapsedMs = 0;
  private bag: BagRandom;
  private dropAcc = 0;
  private lockAcc = 0;
  private lockResets = 0;
  private lowestY = 0;
  private clearTimer = 0;
  private softDropping = false;
  private events: EngineEvents;
  private pendingGarbage = 0;
  private pendingGarbageHoles: number[] = [];
  private linesSincePowerup = 0;
  private survivalAcc = 0;
  private survivalWave = 0;
  /** Last player action that moved the piece */
  private lastAction: 'none' | 'move' | 'rotate' | 'drop' = 'none';
  /** True if last rotate used a non-zero wall kick */
  private lastRotateKicked = false;
  private lastKickIndex = 0;

  constructor(
    mode: GameMode,
    seed: number,
    events: EngineEvents = {},
    soloKind: SoloKind | null = null,
  ) {
    this.mode = mode;
    this.soloKind = mode === 'solo' ? soloKind ?? 'marathon' : null;
    this.bag = new BagRandom(seed);
    this.events = events;
    this.fillNext();
    this.spawn();
  }

  comboMultiplier(): number {
    if (this.combo <= 0) return 1;
    return 1 + this.combo * SCORE_TABLE.comboMulStep;
  }

  remainMs(): number | null {
    if (this.soloKind !== 'ultra') return null;
    return Math.max(0, ULTRA_MS - this.elapsedMs);
  }

  private fillNext(): void {
    while (this.nextQueue.length < 5) this.nextQueue.push(this.bag.next());
  }

  private spawn(): void {
    this.fillNext();
    const id = this.nextQueue.shift()!;
    this.active = spawnPiece(id);
    this.canHold = true;
    this.resetLockState();
    if (collides(this.board, this.active)) {
      this.gameOver = true;
      this.events.onGameOver?.();
    }
  }

  private resetLockState(): void {
    this.lockAcc = 0;
    this.lockResets = 0;
    this.lowestY = this.active?.y ?? 0;
  }

  gravityMs(): number {
    if (this.softDropping) return SOFT_DROP_MS;
    const now = performance.now();
    let g = Math.max(80, BASE_GRAVITY_MS - (this.level - 1) * 70);
    if (now < this.effects.slowUntil) g *= 2.2;
    if (now < this.effects.speedUntil) g *= 0.35;
    // Forced haste from rival — very fast, hard to control
    if (now < this.effects.rushUntil) g *= 0.32;
    return Math.max(45, g);
  }

  setSoftDrop(on: boolean): void {
    if (on && !this.softDropping) this.dropAcc = 0;
    this.softDropping = on;
  }

  togglePause(): void {
    if (this.mode !== 'solo' || this.gameOver) return;
    this.paused = !this.paused;
  }

  private inverted(): boolean {
    return performance.now() < this.effects.invertUntil;
  }

  move(dx: number): boolean {
    if (!this.active || this.paused || this.gameOver || this.clearTimer > 0) return false;
    if (this.inverted()) dx = -dx;
    const next = { ...this.active, x: this.active.x + dx };
    if (!collides(this.board, next)) {
      this.active = next;
      this.lastAction = 'move';
      this.resetLock();
      this.events.onMove?.();
      return true;
    }
    return false;
  }

  rotate(dir: 1 | -1): boolean {
    if (!this.active || this.paused || this.gameOver || this.clearTimer > 0) return false;
    if (this.inverted()) dir = dir === 1 ? -1 : 1;
    const from = this.active.rot;
    const to = (from + dir + 4) % 4;
    const tests = kicksFor(this.active.id, from, to);
    for (let i = 0; i < tests.length; i++) {
      const [kx, ky] = tests[i]!;
      const next = { ...this.active, rot: to, x: this.active.x + kx, y: this.active.y + ky };
      if (!collides(this.board, next)) {
        this.active = next;
        this.lastAction = 'rotate';
        this.lastRotateKicked = kx !== 0 || ky !== 0;
        this.lastKickIndex = i;
        this.resetLock();
        this.events.onRotate?.();
        return true;
      }
    }
    return false;
  }

  hardDrop(): void {
    if (!this.active || this.paused || this.gameOver || this.clearTimer > 0) return;
    let dist = 0;
    while (!collides(this.board, { ...this.active, y: this.active.y + 1 })) {
      this.active.y++;
      dist++;
    }
    this.score += dist * SCORE_TABLE.hardDrop;
    if (dist > 0) this.lastAction = 'drop';
    this.events.onHardDrop?.();
    this.lock();
  }

  holdPiece(): void {
    if (!this.active || !this.canHold || this.paused || this.gameOver || this.clearTimer > 0) return;
    const current = this.active.id;
    if (this.hold) {
      this.active = spawnPiece(this.hold);
    } else {
      this.fillNext();
      this.active = spawnPiece(this.nextQueue.shift()!);
    }
    this.hold = current;
    this.canHold = false;
    this.resetLockState();
    this.events.onHold?.();
    if (collides(this.board, this.active)) {
      this.gameOver = true;
      this.events.onGameOver?.();
    }
  }

  /** Reset lock delay on move/rotate, but only a limited number of times while grounded */
  private resetLock(): void {
    if (!this.active) return;
    if (this.active.y > this.lowestY) {
      this.lowestY = this.active.y;
      this.lockResets = 0;
    }
    const grounded = collides(this.board, { ...this.active, y: this.active.y + 1 });
    if (!grounded) {
      this.lockAcc = 0;
      return;
    }
    if (this.lockResets >= MAX_LOCK_RESETS) return;
    this.lockResets++;
    this.lockAcc = 0;
  }

  private cellBlocked(x: number, y: number): boolean {
    if (x < 0 || x >= COLS || y >= TOTAL_ROWS) return true;
    if (y < 0) return false;
    return this.board[y][x] !== 0;
  }

  /**
   * Guideline-style T-Spin check (corners around T center).
   * Must run BEFORE locking the piece into the board.
   */
  private detectTSpin(piece: ActivePiece): TSpinKind {
    if (piece.id !== 'T' || this.lastAction !== 'rotate') return 'none';

    const [cx, cy] = tCenter(piece);
    const corners: Coord[] = [
      [cx - 1, cy - 1], // TL
      [cx + 1, cy - 1], // TR
      [cx - 1, cy + 1], // BL
      [cx + 1, cy + 1], // BR
    ];
    const filled = corners.map(([x, y]) => this.cellBlocked(x, y));
    const filledCount = filled.filter(Boolean).length;

    // Front corners depend on facing
    const frontIdx: Record<number, [number, number]> = {
      0: [0, 1], // point up → TL, TR
      1: [1, 3], // point right → TR, BR
      2: [2, 3], // point down → BL, BR
      3: [0, 2], // point left → TL, BL
    };
    const [f0, f1] = frontIdx[piece.rot] ?? [0, 1];
    const frontFilled = (filled[f0] ? 1 : 0) + (filled[f1] ? 1 : 0);

    if (filledCount >= 3 && frontFilled === 2) return 'full';
    if (filledCount >= 3) {
      // 3 corners but not both fronts → Mini (or Full if 5th kick / TST-ish)
      return this.lastKickIndex >= 4 ? 'mini' : 'full';
    }
    // Mini: rotated into a tight slot (kick) with 2 corners
    if (filledCount >= 2 && this.lastRotateKicked) return 'mini';

    // Immobile T after rotate also counts as mini
    const immobile =
      collides(this.board, { ...piece, x: piece.x - 1 }) &&
      collides(this.board, { ...piece, x: piece.x + 1 }) &&
      collides(this.board, { ...piece, y: piece.y - 1 });
    if (immobile && filledCount >= 2) return 'mini';

    return 'none';
  }

  private tSpinScore(kind: TSpinKind, lines: number): number {
    if (kind === 'none') {
      if (lines === 1) return SCORE_TABLE.single;
      if (lines === 2) return SCORE_TABLE.double;
      if (lines === 3) return SCORE_TABLE.triple;
      if (lines >= 4) return SCORE_TABLE.tetris;
      return 0;
    }
    if (kind === 'mini') {
      if (lines === 0) return SCORE_TABLE.tSpinMiniZero;
      if (lines === 1) return SCORE_TABLE.tSpinMiniSingle;
      // Mini double treated as full TSD-ish
      if (lines === 2) return SCORE_TABLE.tSpinDouble;
    }
    if (lines === 0) return SCORE_TABLE.tSpinZero;
    if (lines === 1) return SCORE_TABLE.tSpinSingle;
    if (lines === 2) return SCORE_TABLE.tSpinDouble;
    return SCORE_TABLE.tSpinTriple;
  }

  private tSpinLabel(kind: TSpinKind, lines: number): string {
    if (kind === 'none') {
      if (lines >= 4) return 'TETRIS';
      if (lines === 3) return 'TRIPLE';
      if (lines === 2) return 'DOUBLE';
      if (lines === 1) return 'SINGLE';
      return '';
    }
    const prefix = kind === 'mini' ? 'T-SPIN MINI' : 'T-SPIN';
    if (lines === 0) return prefix;
    if (lines === 1) return `${prefix} SINGLE`;
    if (lines === 2) return `${prefix} DOUBLE`;
    return `${prefix} TRIPLE`;
  }

  private lock(): void {
    if (!this.active) return;
    const locked = { ...this.active };
    const tSpin = this.detectTSpin(locked);

    lockPiece(this.board, locked);
    this.active = null;
    this.events.onLock?.();
    this.shake = Math.max(this.shake, tSpin !== 'none' ? 1.1 : 0.3);

    const cleared = clearLines(this.board);
    const n = cleared.length;
    const base = this.tSpinScore(tSpin, n);
    const label = this.tSpinLabel(tSpin, n);

    if (tSpin !== 'none') {
      this.events.onTSpin?.(tSpin, n);
    }

    if (n > 0 || tSpin !== 'none') {
      if (n > 0) {
        this.clearing = cleared;
        this.clearTimer = tSpin !== 'none' ? 280 : 220;
        this.combo++;
        this.lines += n;
        const newLevel = Math.floor(this.lines / LINES_PER_LEVEL) + 1;
        if (newLevel !== this.level) {
          this.level = newLevel;
          this.events.onLevel?.(this.level);
        }
        this.awardPowerups(n + (tSpin === 'full' && n >= 2 ? 1 : 0));
        this.shake = tSpin !== 'none' ? 1.4 : 1;
      } else {
        // T-Spin no lines — still awards points, then continue
        this.combo = -1;
      }

      const mul = n > 0 ? this.comboMultiplier() : 1;
      const comboBonus = n > 0 ? Math.max(0, this.combo) * SCORE_TABLE.combo : 0;
      this.score += Math.floor(base * this.level * mul) + comboBonus;
      this.events.onScore?.(this.score);
      this.events.onClear?.({
        lines: cleared,
        count: n,
        tSpin,
        label,
        combo: Math.max(0, this.combo),
        comboMul: mul,
      });

      if (n > 0 && this.soloKind === 'sprint' && this.lines >= SPRINT_LINES) {
        this.finishWin('sprint');
        return;
      }

      if (n === 0) {
        this.applyPendingGarbage();
        this.spawn();
      }
    } else {
      this.combo = -1;
      this.applyPendingGarbage();
      this.spawn();
    }

    this.lastAction = 'none';
    this.lastRotateKicked = false;
    this.lastKickIndex = 0;
  }

  private finishWin(reason: 'sprint' | 'ultra'): void {
    if (this.gameOver || this.won) return;
    this.won = true;
    this.gameOver = true;
    this.active = null;
    this.events.onWin?.(reason);
  }

  /**
   * Powerups:
   * - Double / triple → 1
   * - Tetris (4+) → 2
   * - Además, cada POWERUP_EVERY_LINES líneas totales → 1 extra
   */
  private awardPowerups(clearedCount: number): void {
    let grants = 0;
    if (clearedCount >= 4) grants += 2;
    else if (clearedCount >= 2) grants += 1;

    this.linesSincePowerup += clearedCount;
    while (this.linesSincePowerup >= POWERUP_EVERY_LINES) {
      this.linesSincePowerup -= POWERUP_EVERY_LINES;
      grants += 1;
    }

    for (let i = 0; i < grants; i++) this.grantPowerup();
  }

  private grantPowerup(): void {
    const idx = this.slots.findIndex((s) => s === null);
    if (idx === -1) return;
    const id = rollPowerup(this.mode === 'versus');
    this.slots[idx] = id;
    this.events.onPowerupGain?.(id);
  }

  useSlot(index: number): PowerupId | null {
    if (this.paused || this.gameOver) return null;
    const id = this.slots[index];
    if (!id) return null;
    this.slots[index] = null;

    if (isSelfBuff(id)) {
      this.applySelf(id);
      this.events.onPowerupUse?.(id, 'self');
      return id;
    }

    if (this.mode === 'solo') {
      this.score += SCORE_TABLE.debuffSoloBonus * this.level;
      this.events.onScore?.(this.score);
      this.events.onPowerupUse?.(id, 'self');
      return id;
    }

    this.events.onPowerupUse?.(id, 'rival');
    return id;
  }

  private applySelf(id: PowerupId): void {
    const now = performance.now();
    if (id === 'speed') {
      this.effects.speedUntil = now + 6000;
      this.events.onEffect?.(id, true);
    } else if (id === 'clear') {
      if (clearBottomRow(this.board)) {
        this.score += 50 * this.level;
        this.events.onScore?.(this.score);
      }
    }
  }

  /** Incoming attack from rival */
  receiveAttack(id: PowerupId, meta?: { rows?: number; hole?: number }): void {
    const now = performance.now();
    if (id === 'garbage') {
      const rows = meta?.rows ?? 2;
      const hole = meta?.hole ?? Math.floor(Math.random() * COLS);
      for (let i = 0; i < rows; i++) {
        // Prefer provided hole for first row, randomize extras
        this.pendingGarbageHoles.push(i === 0 ? hole : Math.floor(Math.random() * COLS));
      }
      this.pendingGarbage += rows;
      this.shake = 1.2;
    } else if (id === 'blind') {
      this.effects.blindUntil = Math.max(this.effects.blindUntil, now + 4000);
      this.events.onEffect?.(id, true);
      this.shake = 0.8;
    } else if (id === 'slow') {
      this.effects.slowUntil = Math.max(this.effects.slowUntil, now + 5000);
      this.events.onEffect?.(id, true);
    } else if (id === 'lock') {
      this.effects.invertUntil = Math.max(this.effects.invertUntil, now + 5000);
      this.events.onEffect?.(id, true);
      this.shake = 0.6;
    } else if (id === 'stain') {
      this.effects.stainUntil = Math.max(this.effects.stainUntil, now + 6000);
      this.effects.stainSeed = (Math.random() * 1e9) >>> 0;
      this.events.onEffect?.(id, true);
      this.shake = 0.5;
    } else if (id === 'rush') {
      this.effects.rushUntil = Math.max(this.effects.rushUntil, now + 6000);
      this.events.onEffect?.(id, true);
      this.shake = 0.7;
    }
  }

  private applyPendingGarbage(): void {
    while (this.pendingGarbage > 0) {
      const hole = this.pendingGarbageHoles.shift() ?? Math.floor(Math.random() * COLS);
      const ok = addGarbage(this.board, 1, hole);
      this.pendingGarbage--;
      if (!ok) {
        this.gameOver = true;
        this.events.onGameOver?.();
        return;
      }
    }
  }

  softStep(): void {
    if (!this.active || this.paused || this.gameOver || this.clearTimer > 0) return;
    if (!collides(this.board, { ...this.active, y: this.active.y + 1 })) {
      this.active.y++;
      // Player soft-drop cancels T-Spin; natural gravity does not
      if (this.softDropping) {
        this.lastAction = 'drop';
        this.score += SCORE_TABLE.softDrop;
        this.events.onScore?.(this.score);
      }
      this.lockAcc = 0;
      // New lowest row → allow fresh lock resets (Guideline)
      if (this.active.y > this.lowestY) {
        this.lowestY = this.active.y;
        this.lockResets = 0;
      }
    }
  }

  update(dt: number): void {
    if (this.gameOver || this.paused) return;

    this.elapsedMs += dt * 1000;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3);

    if (this.soloKind === 'ultra' && this.elapsedMs >= ULTRA_MS) {
      this.finishWin('ultra');
      return;
    }

    if (this.soloKind === 'survival') {
      this.survivalAcc += dt * 1000;
      const interval = Math.max(5500, SURVIVAL_GARBAGE_MS - this.survivalWave * 400);
      if (this.survivalAcc >= interval) {
        this.survivalAcc = 0;
        this.survivalWave++;
        const rows = this.survivalWave % 5 === 0 ? 2 : 1;
        this.receiveAttack('garbage', {
          rows,
          hole: Math.floor(Math.random() * COLS),
        });
      }
    }

    if (this.clearTimer > 0) {
      this.clearTimer -= dt * 1000;
      if (this.clearTimer <= 0) {
        this.clearing = [];
        this.applyPendingGarbage();
        if (this.gameOver) return;
        this.spawn();
      }
      return;
    }

    if (!this.active) return;

    this.dropAcc += dt * 1000;
    const g = this.gravityMs();
    // Soft drop: max 1 cell/frame so lag never teleports the piece
    const maxSteps = this.softDropping ? 1 : 4;
    let steps = 0;
    while (this.dropAcc >= g && steps < maxSteps) {
      this.dropAcc -= g;
      this.softStep();
      steps++;
      if (!this.active || this.clearTimer > 0) return;
    }
    if (steps >= maxSteps) this.dropAcc = Math.min(this.dropAcc, g);

    const grounded = collides(this.board, { ...this.active, y: this.active.y + 1 });
    if (grounded) {
      this.lockAcc += dt * 1000;
      if (this.lockAcc >= LOCK_DELAY_MS) this.lock();
    } else {
      this.lockAcc = 0;
    }
  }

  snapshot(): EngineSnapshot {
    const gy = this.active ? ghostY(this.board, this.active) : 0;
    const combo = Math.max(0, this.combo);
    return {
      board: this.board,
      active: this.active,
      hold: this.hold,
      canHold: this.canHold,
      next: this.nextQueue.slice(0, 3),
      score: this.score,
      lines: this.lines,
      level: this.level,
      combo,
      comboMul: this.comboMultiplier(),
      slots: this.slots.slice(0, MAX_POWERUP_SLOTS) as (PowerupId | null)[],
      effects: { ...this.effects },
      gameOver: this.gameOver,
      won: this.won,
      paused: this.paused,
      ghostY: gy,
      clearing: this.clearing,
      shake: this.shake,
      elapsedMs: this.elapsedMs,
      remainMs: this.remainMs(),
      soloKind: this.soloKind,
    };
  }

  liteBoard(): number[] {
    return boardLite(this.board);
  }

  activeCells(): Coord[] {
    if (!this.active) return [];
    return cellsOf(this.active);
  }
}

export type { BoardGrid, CellColor, ActivePiece };
