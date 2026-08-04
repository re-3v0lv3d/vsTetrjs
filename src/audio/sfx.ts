export class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;
  volume = 0.9;

  private ac(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
  }

  private beep(
    freq: number,
    dur: number,
    type: OscillatorType = 'square',
    gain = 0.08,
    slide = 0,
  ): void {
    if (this.muted || this.volume <= 0.001) return;
    const ctx = this.ac();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), ctx.currentTime + dur);
    const lvl = gain * this.volume;
    g.gain.setValueAtTime(lvl, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  move(): void {
    this.beep(180, 0.04, 'square', 0.04);
  }

  rotate(): void {
    this.beep(320, 0.06, 'square', 0.05);
  }

  lock(): void {
    this.beep(95, 0.07, 'triangle', 0.1, -30);
    this.beep(160, 0.05, 'square', 0.05);
  }

  /** Solid thud when a piece settles on the stack */
  place(): void {
    if (this.muted) return;
    const ctx = this.ac();
    const t = ctx.currentTime;
    // low thud
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.09);
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.12);
    // click
    this.beep(220, 0.035, 'square', 0.045);
  }

  line(n: number): void {
    if (n >= 4) {
      this.beep(440, 0.12, 'sawtooth', 0.09);
      setTimeout(() => this.beep(660, 0.14, 'sawtooth', 0.08), 60);
      setTimeout(() => this.beep(880, 0.18, 'square', 0.07), 120);
    } else {
      this.beep(400 + n * 80, 0.1, 'square', 0.07);
    }
  }

  tSpin(full: boolean): void {
    if (full) {
      this.beep(300, 0.08, 'sawtooth', 0.09);
      setTimeout(() => this.beep(450, 0.1, 'square', 0.1), 50);
      setTimeout(() => this.beep(600, 0.12, 'triangle', 0.1), 100);
      setTimeout(() => this.beep(900, 0.18, 'square', 0.08), 160);
    } else {
      this.beep(360, 0.08, 'triangle', 0.08);
      setTimeout(() => this.beep(540, 0.12, 'square', 0.09), 70);
    }
  }

  hardDrop(): void {
    this.beep(90, 0.1, 'triangle', 0.08, -50);
  }

  hold(): void {
    this.beep(260, 0.07, 'sine', 0.05);
  }

  powerupGain(): void {
    this.beep(520, 0.08, 'sine', 0.06);
    setTimeout(() => this.beep(720, 0.1, 'sine', 0.05), 50);
  }

  powerupSend(): void {
    this.beep(600, 0.08, 'sawtooth', 0.07, 200);
  }

  powerupHit(): void {
    this.beep(140, 0.15, 'sawtooth', 0.1, -80);
  }

  ko(): void {
    this.beep(200, 0.2, 'sawtooth', 0.1, -150);
    setTimeout(() => this.beep(80, 0.35, 'triangle', 0.12, -40), 100);
  }

  ui(): void {
    this.beep(480, 0.05, 'sine', 0.04);
  }

  countdown(): void {
    this.beep(360, 0.1, 'square', 0.06);
  }

  go(): void {
    this.beep(720, 0.2, 'square', 0.08);
  }
}
