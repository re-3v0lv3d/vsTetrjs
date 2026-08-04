/** Catchy melodic arcade loop (Web Audio, no assets) */
export class MusicSynth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private comp: DynamicsCompressorNode | null = null;
  private timer: number | null = null;
  private step = 0;
  private playing = false;
  muted = false;
  intensity = 1;

  private ensure(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.16;
      this.comp = this.ctx.createDynamicsCompressor();
      this.comp.threshold.value = -18;
      this.comp.knee.value = 12;
      this.comp.ratio.value = 4;
      this.comp.attack.value = 0.01;
      this.comp.release.value = 0.2;
      this.master.connect(this.comp);
      this.comp.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  start(): void {
    if (this.playing) return;
    this.ensure();
    this.playing = true;
    this.step = 0;
    this.schedule();
  }

  stop(): void {
    this.playing = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  setIntensity(level: number): void {
    this.intensity = Math.max(0.7, Math.min(2, level));
    if (this.master && this.ctx) {
      const base = this.muted ? 0 : 0.12 + this.intensity * 0.035;
      this.master.gain.setTargetAtTime(base, this.ctx.currentTime, 0.25);
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.16, this.ctx.currentTime, 0.05);
    }
  }

  private schedule(): void {
    if (!this.playing || !this.ctx || !this.master) return;
    const bpm = 112 + (this.intensity - 1) * 6;
    const stepDur = 60 / bpm / 4;

    this.playStep(this.step % 64, this.ctx.currentTime + 0.01);
    this.step++;
    this.timer = window.setTimeout(() => this.schedule(), stepDur * 1000);
  }

  private tone(
    freq: number,
    t: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    filterFreq?: number,
  ): void {
    if (!this.ctx || !this.master || freq <= 0) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (filterFreq) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterFreq;
      osc.connect(f);
      f.connect(g);
    } else {
      osc.connect(g);
    }
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(t: number, dur: number, gain: number, hp: number): void {
    if (!this.ctx || !this.master) return;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = hp;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur);
  }

  private playStep(step: number, t: number): void {
    if (!this.ctx || !this.master || this.muted) return;

    // --- Drums (lighter, leave room for melody) ---
    if (step % 4 === 0) {
      this.tone(150, t, 0.14, 'sine', 0.55);
      this.tone(55, t, 0.16, 'triangle', 0.35);
    }
    if (step % 8 === 4) this.noise(t, 0.09, 0.16, 900);
    if (step % 2 === 1) this.noise(t, 0.025, 0.045, 8000);

    // Chord roots per bar (Am – F – C – G), 16 steps each bar in 64-loop = 4 bars
    const bassProg = [110, 87.31, 130.81, 98];
    const bar = Math.floor(step / 16) % 4;
    const root = bassProg[bar]!;
    if (step % 4 === 0) {
      this.tone(root, t, 0.28, 'sawtooth', 0.1, 220 + this.intensity * 40);
      this.tone(root * 2, t, 0.22, 'triangle', 0.04, 600);
    } else if (step % 4 === 2) {
      this.tone(root * 1.5, t, 0.12, 'triangle', 0.045, 500);
    }

    // Soft pad on downbeats
    if (step % 16 === 0) {
      const thirds = [root * 1.2, root * 1.5, root * 1.25, root * 1.5];
      this.tone(thirds[bar]! * 2, t, 0.9, 'sine', 0.03);
    }

    // --- Hook melody (catchy 2-bar phrases, 32-step) ---
    // A minor-ish hook: memorable leap + stepwise answer
    const A4 = 440;
    const B4 = 493.88;
    const C5 = 523.25;
    const D5 = 587.33;
    const E5 = 659.25;
    const F5 = 698.46;
    const G5 = 783.99;
    const _ = 0;

    const melody: number[] = [
      // phrase A
      E5, _, E5, _, B4, C5, D5, _,
      D5, _, C5, B4, A4, _, A4, C5,
      // phrase B
      E5, _, D5, C5, B4, _, B4, C5,
      D5, _, E5, _, A4, _, _, _,
      // phrase A'
      E5, _, E5, _, B4, C5, D5, _,
      D5, _, C5, B4, A4, _, C5, E5,
      // phrase C (lift)
      G5, _, F5, E5, D5, _, E5, C5,
      B4, _, C5, D5, A4, _, _, _,
    ];

    const note = melody[step % melody.length]!;
    if (note > 0) {
      const leadGain = 0.07 + Math.min(this.intensity, 1.6) * 0.02;
      this.tone(note, t, 0.18, 'triangle', leadGain);
      this.tone(note * 2, t, 0.1, 'square', leadGain * 0.22, 3200);
    }

    // Counter-melody every other cycle half (steps 32-63 echo)
    if (step >= 32 && step % 4 === 2) {
      const echo = melody[(step - 32) % 32]!;
      if (echo > 0) this.tone(echo / 2, t, 0.14, 'sine', 0.035);
    }
  }
}
