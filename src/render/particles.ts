export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  kind: 'spark' | 'ember' | 'ring';
  grow?: number;
}

export class ParticleSystem {
  particles: Particle[] = [];

  burst(x: number, y: number, color: string, count = 12): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 50 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 50,
        life: 0.45 + Math.random() * 0.55,
        maxLife: 1,
        color,
        size: 2 + Math.random() * 3.5,
        kind: Math.random() > 0.7 ? 'ember' : 'spark',
      });
    }
  }

  ring(x: number, y: number, color: string, size = 18): void {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.55,
      maxLife: 0.55,
      color,
      size,
      grow: 90,
      kind: 'ring',
    });
  }

  sparkle(x: number, y: number, color: string): void {
    this.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 20,
      vy: -20 - Math.random() * 40,
      life: 0.35 + Math.random() * 0.35,
      maxLife: 0.7,
      color,
      size: 1.5 + Math.random() * 2,
      kind: 'spark',
    });
  }

  update(dt: number): void {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'ring') {
        p.size += (p.grow ?? 80) * dt;
      } else {
        p.vy += (p.kind === 'ember' ? 180 : 260) * dt;
      }
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = a;
      if (p.kind === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5 * a;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.kind === 'ember' ? 10 : 6;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.particles = [];
  }
}
