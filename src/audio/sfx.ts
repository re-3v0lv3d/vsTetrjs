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
    if (slide) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(40, freq + slide),
        ctx.currentTime + dur,
      );
    }
    const lvl = gain * this.volume;
    g.gain.setValueAtTime(lvl, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  private noiseBurst(dur: number, gain: number, hp = 1200): void {
    if (this.muted || this.volume <= 0.001) return;
    const ctx = this.ac();
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = hp;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(gain * this.volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start(t);
    src.stop(t + dur);
  }

  move(): void {
    this.beep(190, 0.03, 'square', 0.035);
  }

  rotate(): void {
    this.beep(340, 0.05, 'square', 0.045);
    this.beep(520, 0.04, 'triangle', 0.03);
  }

  /** Solid thud when a piece settles on the stack */
  place(): void {
    if (this.muted) return;
    const ctx = this.ac();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(46, t + 0.1);
    g.gain.setValueAtTime(0.18 * this.volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.13);
    this.noiseBurst(0.04, 0.05, 800);
    this.beep(240, 0.03, 'square', 0.04);
  }

  line(n: number): void {
    if (n >= 4) {
      this.beep(440, 0.1, 'sawtooth', 0.1);
      setTimeout(() => this.beep(554, 0.1, 'sawtooth', 0.09), 55);
      setTimeout(() => this.beep(659, 0.12, 'square', 0.085), 110);
      setTimeout(() => this.beep(880, 0.2, 'triangle', 0.08), 175);
      setTimeout(() => this.noiseBurst(0.08, 0.06, 2000), 80);
    } else if (n === 3) {
      this.beep(420, 0.09, 'square', 0.08);
      setTimeout(() => this.beep(560, 0.11, 'triangle', 0.075), 60);
      setTimeout(() => this.beep(700, 0.12, 'square', 0.07), 120);
    } else {
      this.beep(380 + n * 70, 0.09, 'square', 0.07);
      setTimeout(() => this.beep(480 + n * 70, 0.08, 'triangle', 0.05), 50);
    }
  }

  tSpin(full: boolean): void {
    if (full) {
      this.beep(280, 0.07, 'sawtooth', 0.1);
      setTimeout(() => this.beep(420, 0.08, 'square', 0.1), 45);
      setTimeout(() => this.beep(560, 0.1, 'triangle', 0.1), 95);
      setTimeout(() => this.beep(840, 0.16, 'square', 0.09), 150);
      setTimeout(() => this.noiseBurst(0.1, 0.07, 1500), 40);
    } else {
      this.beep(360, 0.07, 'triangle', 0.08);
      setTimeout(() => this.beep(540, 0.1, 'square', 0.09), 60);
      setTimeout(() => this.beep(720, 0.1, 'triangle', 0.06), 120);
    }
  }

  combo(n: number): void {
    const base = 400 + Math.min(8, n) * 55;
    this.beep(base, 0.07, 'square', 0.06 + Math.min(0.04, n * 0.005));
    setTimeout(() => this.beep(base * 1.25, 0.09, 'triangle', 0.05), 40);
  }

  hardDrop(): void {
    this.beep(85, 0.1, 'triangle', 0.09, -45);
    this.noiseBurst(0.05, 0.06, 600);
  }

  hold(): void {
    this.beep(260, 0.06, 'sine', 0.05);
    this.beep(390, 0.05, 'sine', 0.03);
  }

  powerupGain(): void {
    this.beep(520, 0.07, 'sine', 0.06);
    setTimeout(() => this.beep(720, 0.09, 'sine', 0.055), 45);
    setTimeout(() => this.beep(960, 0.08, 'triangle', 0.04), 95);
  }

  powerupSend(): void {
    this.beep(620, 0.08, 'sawtooth', 0.075, 220);
    this.noiseBurst(0.05, 0.04, 2500);
  }

  powerupHit(): void {
    this.beep(140, 0.14, 'sawtooth', 0.11, -90);
    this.noiseBurst(0.12, 0.08, 400);
  }

  ko(): void {
    this.beep(220, 0.18, 'sawtooth', 0.12, -160);
    setTimeout(() => this.beep(90, 0.32, 'triangle', 0.14, -35), 90);
    setTimeout(() => this.noiseBurst(0.25, 0.1, 300), 40);
  }

  win(): void {
    this.beep(523, 0.1, 'square', 0.08);
    setTimeout(() => this.beep(659, 0.1, 'square', 0.08), 90);
    setTimeout(() => this.beep(784, 0.12, 'triangle', 0.09), 180);
    setTimeout(() => this.beep(1046, 0.22, 'square', 0.08), 280);
  }

  ui(): void {
    this.beep(500, 0.045, 'sine', 0.04);
  }

  countdown(): void {
    this.beep(360, 0.09, 'square', 0.065);
  }

  go(): void {
    this.beep(740, 0.18, 'square', 0.085);
    this.beep(980, 0.14, 'triangle', 0.05);
  }
}
