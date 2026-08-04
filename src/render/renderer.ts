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
  private beatPulse = 0;
  private time = 0;
  private impactRings: { x: number; y: number; life: number; max: number; color: string; r: number }[] =
    [];
  private lockBurst = 0;
  private ambientSpark = 0;

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

  setBeatPulse(p: number): void {
    this.beatPulse = Math.max(0, Math.min(1, p));
  }

  triggerClear(lines: number[], board: BoardGrid, opts?: { tSpin?: boolean; label?: string }): void {
    this.flash = opts?.tSpin ? 1.35 : 1;
    if (opts?.tSpin) this.tSpinFlash = 1;
    if (opts?.label) {
      this.banner = opts.label;
      this.bannerLife = opts.tSpin ? 1.15 : 0.7;
    }
    const midY =
      lines.reduce((a, y) => a + (y - HIDDEN_ROWS + 0.5) * this.cell, 0) / Math.max(1, lines.length);
    const cx = (COLS / 2) * this.cell;
    this.particles.ring(cx, midY, opts?.tSpin ? '#C77DFF' : THEME.lime, 12);
    this.impactRings.push({
      x: cx,
      y: midY,
      life: 0.7,
      max: 0.7,
      color: opts?.tSpin ? '#C77DFF' : THEME.lime,
      r: 20,
    });
    for (const y of lines) {
      for (let x = 0; x < COLS; x++) {
        const cell = board[y]?.[x] ?? 0;
        const { fill } = colorFor(cell === 0 ? 'T' : cell);
        this.particles.burst(
          (x + 0.5) * this.cell,
          (y - HIDDEN_ROWS + 0.5) * this.cell,
          fill,
          opts?.tSpin ? 16 : 10,
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

  triggerLockFlash(): void {
    this.lockBurst = 0.4;
    const cx = (COLS / 2) * this.cell;
    const cy = (ROWS * 0.55) * this.cell;
    this.particles.sparkle(cx + (Math.random() - 0.5) * this.cell * 4, cy, THEME.lime);
    this.particles.sparkle(cx + (Math.random() - 0.5) * this.cell * 4, cy, '#3DE0FF');
  }

  update(dt: number): void {
    this.time += dt;
    this.flash = Math.max(0, this.flash - dt * 3);
    this.tSpinFlash = Math.max(0, this.tSpinFlash - dt * 2.2);
    this.lockBurst = Math.max(0, this.lockBurst - dt * 2.8);
    this.bannerLife = Math.max(0, this.bannerLife - dt);
    if (this.bannerLife <= 0) this.banner = '';
    for (const r of this.impactRings) {
      r.life -= dt;
      r.r += 140 * dt;
    }
    this.impactRings = this.impactRings.filter((r) => r.life > 0);
    this.particles.update(dt);

    this.ambientSpark -= dt;
    if (this.ambientSpark <= 0) {
      this.ambientSpark = 0.12 + Math.random() * 0.2;
      if (Math.random() < 0.55) {
        this.particles.sparkle(
          Math.random() * COLS * this.cell,
          Math.random() * ROWS * this.cell,
          Math.random() > 0.5 ? THEME.lime : '#3DE0FF',
        );
      }
    }
  }

  draw(
    snap: EngineSnapshot,
    opts: { blind?: boolean; stain?: boolean; rival?: boolean } = {},
  ): void {
    const { ctx, cell } = this;
    const w = COLS * cell;
    const h = ROWS * cell;
    const pulse = this.beatPulse;
    const breathe = 0.5 + 0.5 * Math.sin(this.time * 2.4);
    const danger = this.stackDanger(snap);

    const shakeAmt = snap.shake * 8 + pulse * danger * 1.2;
    const shakeX = (Math.random() - 0.5) * shakeAmt;
    const shakeY = (Math.random() - 0.5) * shakeAmt;

    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.translate(shakeX, shakeY);

    // background with living gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `rgba(10, 28, 40, 1)`);
    grad.addColorStop(0.5, THEME.bg);
    grad.addColorStop(1, danger > 0.4 ? '#120810' : THEME.bg);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // ambient radial pulse
    const amb = ctx.createRadialGradient(w * 0.5, h * 0.35, 10, w * 0.5, h * 0.5, h * 0.75);
    amb.addColorStop(0, `rgba(184, 255, 60, ${0.04 + pulse * 0.07 + breathe * 0.02})`);
    amb.addColorStop(0.55, `rgba(61, 224, 255, ${0.02 + pulse * 0.03})`);
    amb.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = amb;
    ctx.fillRect(0, 0, w, h);

    if (danger > 0.25) {
      const dg = ctx.createLinearGradient(0, 0, 0, h * 0.45);
      dg.addColorStop(0, `rgba(255, 77, 109, ${(0.08 + pulse * 0.12) * danger})`);
      dg.addColorStop(1, 'rgba(255, 77, 109, 0)');
      ctx.fillStyle = dg;
      ctx.fillRect(0, 0, w, h * 0.45);
    }

    this.drawGrid(pulse, danger);

    // locked cells
    for (let y = HIDDEN_ROWS; y < HIDDEN_ROWS + ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = snap.board[y][x];
        if (c !== 0) {
          const clearing = snap.clearing.includes(y);
          const rowPulse = clearing ? 0.35 + this.flash : 1;
          this.drawBlock(x, y - HIDDEN_ROWS, c, rowPulse, false, {
            pulse: pulse * 0.35 + (clearing ? this.flash : 0),
            hot: danger > 0.5 && y - HIDDEN_ROWS < 6,
          });
        }
      }
    }

    if (snap.active && !opts.blind) {
      const ghost = { ...snap.active, y: snap.ghostY };
      for (const [x, y] of cellsOf(ghost)) {
        if (y >= HIDDEN_ROWS) {
          this.drawBlock(x, y - HIDDEN_ROWS, snap.active.id, 0.18 + pulse * 0.08, true);
        }
      }
      const piecePulse = 0.55 + pulse * 0.45 + breathe * 0.15;
      for (const [x, y] of cellsOf(snap.active)) {
        if (y >= HIDDEN_ROWS) {
          this.drawBlock(x, y - HIDDEN_ROWS, snap.active.id, 1, false, {
            pulse: piecePulse,
            active: true,
          });
        }
      }
    }

    this.particles.draw(ctx);

    // impact rings
    for (const r of this.impactRings) {
      const a = r.life / r.max;
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = a * 0.85;
      ctx.lineWidth = 3 * a;
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(184, 255, 60, ${this.flash * 0.18})`;
      ctx.fillRect(0, 0, w, h);
    }

    if (this.lockBurst > 0) {
      ctx.fillStyle = `rgba(232, 240, 245, ${this.lockBurst * 0.12})`;
      ctx.fillRect(0, 0, w, h);
    }

    if (this.tSpinFlash > 0) {
      ctx.fillStyle = `rgba(199, 125, 255, ${this.tSpinFlash * 0.24})`;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = `rgba(199, 125, 255, ${this.tSpinFlash * 0.85})`;
      ctx.lineWidth = 3 + this.tSpinFlash * 2;
      ctx.shadowColor = '#C77DFF';
      ctx.shadowBlur = 20 * this.tSpinFlash;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.shadowBlur = 0;
    }

    // pulsing frame
    const frameA = 0.25 + pulse * 0.45 + danger * 0.25;
    ctx.strokeStyle = danger > 0.45
      ? `rgba(255, 77, 109, ${frameA})`
      : `rgba(184, 255, 60, ${frameA * 0.75})`;
    ctx.lineWidth = 2 + pulse * 1.5;
    ctx.shadowColor = danger > 0.45 ? THEME.coral : THEME.lime;
    ctx.shadowBlur = 8 + pulse * 18 + danger * 10;
    ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
    ctx.shadowBlur = 0;

    // corner ticks that pulse
    this.drawCorners(w, h, pulse, danger);

    if (this.banner && this.bannerLife > 0) {
      const a = Math.min(1, this.bannerLife * 2);
      const scale = 1 + (1 - Math.min(1, this.bannerLife * 3)) * 0.12 + pulse * 0.04;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(7, 16, 24, 0.6)';
      ctx.fillRect(0, h * 0.38, w, h * 0.18);
      ctx.translate(w / 2, h * 0.47);
      ctx.scale(scale, scale);
      ctx.fillStyle = this.banner.includes('T-SPIN') ? '#C77DFF' : THEME.lime;
      ctx.font = `800 ${Math.max(14, Math.floor(cell * 0.72))}px Syne, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 18 + pulse * 12;
      ctx.fillText(this.banner, 0, 0);
      ctx.restore();
    }

    // scanlines with pulse opacity
    ctx.fillStyle = `rgba(0,0,0,${0.1 + pulse * 0.04})`;
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);

    // soft vignette
    const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, `rgba(0,0,0,${0.28 + danger * 0.15})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    if (opts.stain || performance.now() < snap.effects.stainUntil) {
      this.drawStains(w, h, snap.effects.stainSeed || 1);
    }

    if (opts.blind) {
      ctx.fillStyle = 'rgba(7, 16, 24, 0.92)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = THEME.coral;
      ctx.font = `700 ${Math.floor(cell * 0.7)}px Syne, sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = THEME.coral;
      ctx.shadowBlur = 16 + pulse * 10;
      ctx.fillText('¿?', w / 2, h / 2);
      ctx.shadowBlur = 0;
    }

    if (snap.paused) {
      ctx.fillStyle = 'rgba(7, 16, 24, 0.7)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = THEME.lime;
      ctx.font = `800 ${Math.floor(cell)}px Syne, sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowBlur = 20;
      ctx.shadowColor = THEME.lime;
      ctx.fillText('PAUSA', w / 2, h / 2);
      ctx.shadowBlur = 0;
    }

    // expose CSS vars for UI sync
    const wrap = this.canvas.parentElement;
    if (wrap) {
      wrap.style.setProperty('--board-pulse', String(pulse.toFixed(3)));
      wrap.style.setProperty('--board-danger', String(danger.toFixed(3)));
      wrap.classList.toggle('is-danger', danger > 0.45);
      wrap.classList.toggle('is-clearing', this.flash > 0.2);
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

  private stackDanger(snap: EngineSnapshot): number {
    let top = ROWS;
    for (let y = HIDDEN_ROWS; y < HIDDEN_ROWS + ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (snap.board[y][x] !== 0) {
          top = Math.min(top, y - HIDDEN_ROWS);
          break;
        }
      }
    }
    if (top >= 10) return 0;
    return Math.min(1, (10 - top) / 10);
  }

  private drawCorners(w: number, h: number, pulse: number, danger: number): void {
    const { ctx } = this;
    const len = 10 + pulse * 6;
    const col = danger > 0.45 ? THEME.coral : THEME.lime;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.4 + pulse * 0.5;
    ctx.shadowColor = col;
    ctx.shadowBlur = 8 + pulse * 10;
    const corners: [number, number, number, number, number, number][] = [
      [0, 0, len, 0, 0, len],
      [w, 0, -len, 0, 0, len],
      [0, h, len, 0, 0, -len],
      [w, h, -len, 0, 0, -len],
    ];
    for (const [x, y, dx, , , dy] of corners) {
      ctx.beginPath();
      ctx.moveTo(x + dx, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + dy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
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
      ctx.fillStyle = `rgba(255, 77, 109, ${0.08 + rand() * 0.1})`;
      ctx.beginPath();
      ctx.ellipse(x - rx * 0.2, y - ry * 0.25, rx * 0.25, ry * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawGrid(pulse: number, danger: number): void {
    const { ctx, cell } = this;
    const a = 0.05 + pulse * 0.04 + danger * 0.03;
    ctx.strokeStyle = danger > 0.45 ? `rgba(255, 77, 109, ${a})` : `rgba(184, 255, 60, ${a})`;
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
    fx: { pulse?: number; active?: boolean; hot?: boolean } = {},
  ): void {
    const { ctx } = this;
    const s = this.cell;
    const { fill, glow } = colorFor(cell);
    const px = x * s;
    const py = y * s;
    const pad = ghost ? 2 : 1;
    const p = fx.pulse ?? 0;

    ctx.save();
    ctx.globalAlpha = alpha;
    if (!ghost) {
      ctx.shadowColor = fx.hot ? THEME.coral : glow;
      ctx.shadowBlur = 10 + p * 16 + (fx.active ? 8 : 0);
    }
    ctx.fillStyle = fill;
    ctx.fillRect(px + pad, py + pad, s - pad * 2, s - pad * 2);

    if (!ghost) {
      ctx.shadowBlur = 0;
      // inner pulse highlight
      if (fx.active || p > 0.2) {
        const hi = ctx.createLinearGradient(px, py, px, py + s);
        hi.addColorStop(0, `rgba(255,255,255,${0.35 + p * 0.25})`);
        hi.addColorStop(0.35, `rgba(255,255,255,${0.08})`);
        hi.addColorStop(1, 'rgba(0,0,0,0.2)');
        ctx.fillStyle = hi;
        ctx.fillRect(px + pad, py + pad, s - pad * 2, s - pad * 2);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.fillRect(px + pad, py + pad, s - pad * 2, s * 0.22);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(px + pad, py + s * 0.72, s - pad * 2, s * 0.22 - pad);
      }
      if (fx.active) {
        ctx.strokeStyle = `rgba(255,255,255,${0.25 + p * 0.35})`;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(px + pad + 0.5, py + pad + 0.5, s - pad * 2 - 1, s - pad * 2 - 1);
      }
    } else {
      ctx.strokeStyle = fill;
      ctx.globalAlpha = alpha * (0.7 + p * 0.3);
      ctx.shadowColor = fill;
      ctx.shadowBlur = 6 + p * 8;
      ctx.strokeRect(px + 2, py + 2, s - 4, s - 4);
    }
    ctx.restore();
  }
}
