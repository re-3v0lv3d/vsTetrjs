import { PIECE_COLORS } from '../render/themes';
import type { PieceId } from '../game/constants';
import { SHAPES } from '../game/pieces';

interface Floater {
  id: PieceId;
  x: number;
  y: number;
  rot: number;
  rotSpeed: number;
  speed: number;
  size: number;
  alpha: number;
  drift: number;
}

const IDS: PieceId[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

/** Full-bleed falling tetromino field behind the menu hero */
export class MenuFx {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private floaters: Floater[] = [];
  private raf = 0;
  private running = false;
  private last = 0;
  private glitch = 0;
  private t = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D no disponible');
    this.ctx = ctx;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.resize();
    this.seed();
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.t += dt;
      this.glitch = Math.max(0, this.glitch - dt);
      if (Math.random() < 0.008) this.glitch = 0.12 + Math.random() * 0.1;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private seed(): void {
    this.floaters = [];
    const count = Math.min(18, Math.floor(window.innerWidth / 70) + 8);
    for (let i = 0; i < count; i++) this.floaters.push(this.make(true));
  }

  private make(spreadY: boolean): Floater {
    const id = IDS[(Math.random() * IDS.length) | 0];
    return {
      id,
      x: Math.random() * window.innerWidth,
      y: spreadY ? Math.random() * window.innerHeight : -40 - Math.random() * 120,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 1.2,
      speed: 28 + Math.random() * 55,
      size: 10 + Math.random() * 16,
      alpha: 0.18 + Math.random() * 0.35,
      drift: (Math.random() - 0.5) * 24,
    };
  }

  private update(dt: number): void {
    const h = window.innerHeight;
    const w = window.innerWidth;
    for (const f of this.floaters) {
      f.y += f.speed * dt;
      f.x += Math.sin(this.t * 1.2 + f.y * 0.01) * f.drift * dt;
      f.rot += f.rotSpeed * dt;
      if (f.y > h + 60) {
        Object.assign(f, this.make(false));
        f.x = Math.random() * w;
      }
    }
  }

  private draw(): void {
    const { ctx } = this;
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    // aurora washes
    const a1 = ctx.createRadialGradient(w * 0.2, h * 0.15, 0, w * 0.2, h * 0.15, w * 0.55);
    a1.addColorStop(0, `rgba(184, 255, 60, ${0.12 + Math.sin(this.t) * 0.04})`);
    a1.addColorStop(1, 'transparent');
    ctx.fillStyle = a1;
    ctx.fillRect(0, 0, w, h);

    const a2 = ctx.createRadialGradient(w * 0.85, h * 0.75, 0, w * 0.85, h * 0.75, w * 0.5);
    a2.addColorStop(0, `rgba(255, 77, 109, ${0.1 + Math.cos(this.t * 0.8) * 0.04})`);
    a2.addColorStop(1, 'transparent');
    ctx.fillStyle = a2;
    ctx.fillRect(0, 0, w, h);

    const a3 = ctx.createRadialGradient(w * 0.55, h * 0.4, 0, w * 0.55, h * 0.4, w * 0.4);
    a3.addColorStop(0, `rgba(61, 224, 255, ${0.06 + Math.sin(this.t * 1.4) * 0.03})`);
    a3.addColorStop(1, 'transparent');
    ctx.fillStyle = a3;
    ctx.fillRect(0, 0, w, h);

    for (const f of this.floaters) this.drawPiece(f);

    // scan sweep
    const sweepY = ((this.t * 80) % (h + 120)) - 60;
    const sg = ctx.createLinearGradient(0, sweepY - 40, 0, sweepY + 40);
    sg.addColorStop(0, 'transparent');
    sg.addColorStop(0.5, 'rgba(184, 255, 60, 0.06)');
    sg.addColorStop(1, 'transparent');
    ctx.fillStyle = sg;
    ctx.fillRect(0, sweepY - 40, w, 80);

    if (this.glitch > 0) {
      ctx.fillStyle = `rgba(184, 255, 60, ${this.glitch * 0.08})`;
      ctx.fillRect(0, Math.random() * h, w, 2 + Math.random() * 6);
      ctx.fillStyle = `rgba(255, 77, 109, ${this.glitch * 0.06})`;
      ctx.fillRect(0, Math.random() * h, w, 1 + Math.random() * 4);
    }
  }

  private drawPiece(f: Floater): void {
    const shape = SHAPES[f.id][0];
    const { fill, glow } = PIECE_COLORS[f.id];
    const { ctx } = this;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    ctx.globalAlpha = f.alpha;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 14;
    ctx.fillStyle = fill;
    for (const [bx, by] of shape) {
      ctx.fillRect(bx * f.size, by * f.size, f.size - 1.5, f.size - 1.5);
    }
    ctx.restore();
  }
}
