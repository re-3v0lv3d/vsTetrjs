import { COLS, HIDDEN_ROWS, ROWS, type CellColor } from '../game/constants';
import type { EngineSnapshot } from '../game/engine';
import { cellsOf } from '../game/pieces';
import type { BoardGrid } from '../game/board';
import { ParticleSystem } from './particles';
import { THEME, colorFor } from './themes';

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cell: number;
  readonly particles = new ParticleSystem();
  private flash = 0;
  private banner = '';
  private bannerLife = 0;
  private tSpinFlash = 0;

  constructor(canvas: HTMLCanvasElement, cellSize = 30) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D no disponible');
    this.ctx = ctx;
    this.cell = cellSize;
    this.resize(cellSize);
  }

  resize(cellSize: number): void {
    this.cell = cellSize;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = COLS * cellSize;
    const h = ROWS * cellSize;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  triggerClear(lines: number[], board: BoardGrid, opts?: { tSpin?: boolean; label?: string }): void {
    this.flash = opts?.tSpin ? 1.35 : 1;
    if (opts?.tSpin) this.tSpinFlash = 1;
    if (opts?.label) {
      this.banner = opts.label;
      this.bannerLife = opts.tSpin ? 1.15 : 0.7;
    }
    for (const y of lines) {
      for (let x = 0; x < COLS; x++) {
        const cell = board[y]?.[x] ?? 0;
        const { fill } = colorFor(cell === 0 ? 'T' : cell);
        this.particles.burst(
          (x + 0.5) * this.cell,
          (y - HIDDEN_ROWS + 0.5) * this.cell,
          fill,
          opts?.tSpin ? 14 : 8,
        );
      }
    }
  }

  triggerBanner(label: string, tSpin = false): void {
    this.banner = label;
    this.bannerLife = tSpin ? 1.15 : 0.7;
    if (tSpin) {
      this.tSpinFlash = 1;
      this.flash = Math.max(this.flash, 1.2);
    }
  }

  update(dt: number): void {
    this.flash = Math.max(0, this.flash - dt * 3);
    this.tSpinFlash = Math.max(0, this.tSpinFlash - dt * 2.2);
    this.bannerLife = Math.max(0, this.bannerLife - dt);
    if (this.bannerLife <= 0) this.banner = '';
    this.particles.update(dt);
  }

  draw(
    snap: EngineSnapshot,
    opts: { blind?: boolean; stain?: boolean; rival?: boolean } = {},
  ): void {
    const { ctx, cell } = this;
    const w = COLS * cell;
    const h = ROWS * cell;

    const shakeX = (Math.random() - 0.5) * snap.shake * 8;
    const shakeY = (Math.random() - 0.5) * snap.shake * 8;

    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.translate(shakeX, shakeY);

    // background
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0a1520');
    grad.addColorStop(1, THEME.bg);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    this.drawGrid();

    // locked cells
    for (let y = HIDDEN_ROWS; y < HIDDEN_ROWS + ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = snap.board[y][x];
        if (c !== 0) {
          const clearing = snap.clearing.includes(y);
          this.drawBlock(x, y - HIDDEN_ROWS, c, clearing ? 0.3 + this.flash : 1);
        }
      }
    }

    if (snap.active && !opts.blind) {
      // ghost
      const ghost = { ...snap.active, y: snap.ghostY };
      for (const [x, y] of cellsOf(ghost)) {
        if (y >= HIDDEN_ROWS) this.drawBlock(x, y - HIDDEN_ROWS, snap.active.id, 0.22, true);
      }
      for (const [x, y] of cellsOf(snap.active)) {
        if (y >= HIDDEN_ROWS) this.drawBlock(x, y - HIDDEN_ROWS, snap.active.id, 1);
      }
    }

    this.particles.draw(ctx);

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(184, 255, 60, ${this.flash * 0.15})`;
      ctx.fillRect(0, 0, w, h);
    }

    if (this.tSpinFlash > 0) {
      ctx.fillStyle = `rgba(199, 125, 255, ${this.tSpinFlash * 0.22})`;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = `rgba(199, 125, 255, ${this.tSpinFlash * 0.7})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, w - 4, h - 4);
    }

    if (this.banner && this.bannerLife > 0) {
      const a = Math.min(1, this.bannerLife * 2);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(7, 16, 24, 0.55)';
      ctx.fillRect(0, h * 0.38, w, h * 0.18);
      ctx.fillStyle = this.banner.includes('T-SPIN') ? '#C77DFF' : THEME.lime;
      ctx.font = `800 ${Math.max(14, Math.floor(cell * 0.72))}px Syne, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 16;
      ctx.fillText(this.banner, w / 2, h * 0.47);
      ctx.restore();
    }

    // scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);

    if (opts.stain || performance.now() < snap.effects.stainUntil) {
      this.drawStains(w, h, snap.effects.stainSeed || 1);
    }

    if (opts.blind) {
      ctx.fillStyle = 'rgba(7, 16, 24, 0.92)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = THEME.coral;
      ctx.font = `700 ${Math.floor(cell * 0.7)}px Syne, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('¿?', w / 2, h / 2);
    }

    if (snap.paused) {
      ctx.fillStyle = 'rgba(7, 16, 24, 0.7)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = THEME.lime;
      ctx.font = `800 ${Math.floor(cell)}px Syne, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('PAUSA', w / 2, h / 2);
    }

    ctx.restore();
  }

  drawMini(board: BoardGrid | number[] | null, canvas: HTMLCanvasElement, blind = false): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cell = 12;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = COLS * cell;
    const h = ROWS * cell;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = THEME.bgElevated;
    ctx.fillRect(0, 0, w, h);

    if (!board) {
      ctx.fillStyle = THEME.muted;
      ctx.font = '12px IBM Plex Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('…', w / 2, h / 2);
      return;
    }

    const get = (x: number, y: number): CellColor => {
      if (Array.isArray(board[0])) {
        return (board as BoardGrid)[y + HIDDEN_ROWS][x];
      }
      const lite = board as number[];
      const rev: CellColor[] = [0, 'I', 'O', 'T', 'S', 'Z', 'J', 'L', 'G'];
      return rev[lite[y * COLS + x]] ?? 0;
    };

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = get(x, y);
        if (c === 0) continue;
        const { fill } = colorFor(c);
        ctx.fillStyle = fill;
        ctx.fillRect(x * cell + 0.5, y * cell + 0.5, cell - 1, cell - 1);
      }
    }

    if (blind) {
      ctx.fillStyle = 'rgba(7,16,24,0.9)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = THEME.coral;
      ctx.font = 'bold 16px Syne, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BLIND', w / 2, h / 2);
    }
  }

  private drawStains(w: number, h: number, seed: number): void {
    const { ctx } = this;
    let s = seed || 1;
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x100000000;
    };
    const blobs = 7 + Math.floor(rand() * 4);
    for (let i = 0; i < blobs; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const rx = 28 + rand() * 55;
      const ry = 22 + rand() * 48;
      const g = ctx.createRadialGradient(x, y, 2, x, y, rx);
      const alpha = 0.55 + rand() * 0.35;
      g.addColorStop(0, `rgba(20, 8, 28, ${alpha})`);
      g.addColorStop(0.45, `rgba(60, 20, 80, ${alpha * 0.75})`);
      g.addColorStop(1, 'rgba(20, 8, 28, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
      // glossy speck
      ctx.fillStyle = `rgba(255, 77, 109, ${0.08 + rand() * 0.1})`;
      ctx.beginPath();
      ctx.ellipse(x - rx * 0.2, y - ry * 0.25, rx * 0.25, ry * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawGrid(): void {
    const { ctx, cell } = this;
    ctx.strokeStyle = THEME.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cell + 0.5, 0);
      ctx.lineTo(x * cell + 0.5, ROWS * cell);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cell + 0.5);
      ctx.lineTo(COLS * cell, y * cell + 0.5);
      ctx.stroke();
    }
  }

  private drawBlock(
    x: number,
    y: number,
    cell: CellColor | NonNullable<EngineSnapshot['active']>['id'],
    alpha = 1,
    ghost = false,
  ): void {
    const { ctx } = this;
    const s = this.cell;
    const { fill, glow } = colorFor(cell);
    const px = x * s;
    const py = y * s;
    const pad = ghost ? 2 : 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    if (!ghost) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = 10;
    }
    ctx.fillStyle = fill;
    ctx.fillRect(px + pad, py + pad, s - pad * 2, s - pad * 2);

    if (!ghost) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(px + pad, py + pad, s - pad * 2, s * 0.22);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(px + pad, py + s * 0.72, s - pad * 2, s * 0.22 - pad);
    } else {
      ctx.strokeStyle = fill;
      ctx.globalAlpha = alpha * 0.8;
      ctx.strokeRect(px + 2, py + 2, s - 4, s - 4);
    }
    ctx.restore();
  }
}
