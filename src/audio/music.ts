export type MusicBed = 'menu' | 'game' | 'none';

const FADE_IN_S = 0.45;
const FADE_OUT_S = 1.4;

function asset(path: string): string {
  const base = import.meta.env.BASE_URL || './';
  return `${base}${path.replace(/^\//, '')}`;
}

const TRACKS = {
  menu: asset('audio/menu.mp3'),
  game: [asset('audio/game1.mp3'), asset('audio/game2.mp3'), asset('audio/game3.mp3')],
} as const;

/** Streamed MP3 beds with fade in/out at track edges */
export class MusicSynth {
  muted = false;
  volume = 0.85;
  intensity = 1;

  private bed: MusicBed = 'none';
  private audio: HTMLAudioElement | null = null;
  private gameIndex = 0;
  private unlocked = false;
  private fadeToken = 0;
  private ending = false;
  private advancing = false;
  private watchTimer: number | null = null;
  private duckUntil = 0;
  private duckFactor = 1;
  private duckTimer: number | null = null;
  private cache = new Map<string, HTMLAudioElement>();
  private switching: Promise<void> | null = null;

  constructor() {
    this.preload(TRACKS.menu);
    for (const u of TRACKS.game) this.preload(u);
  }

  private preload(url: string): void {
    if (this.cache.has(url)) return;
    const a = new Audio();
    a.preload = 'auto';
    a.src = url;
    a.load();
    this.cache.set(url, a);
  }

  private takeAudio(url: string): HTMLAudioElement {
    const cached = this.cache.get(url);
    if (cached) {
      // Clone node keeps buffer warm in many browsers
      const clone = cached.cloneNode(true) as HTMLAudioElement;
      clone.preload = 'auto';
      return clone;
    }
    const a = new Audio(url);
    a.preload = 'auto';
    return a;
  }

  unlock(): void {
    this.unlocked = true;
  }

  /** @deprecated use playMenu / playGame */
  start(): void {
    this.unlock();
    if (this.bed === 'none') void this.playMenu();
  }

  playMenu(): void {
    this.unlocked = true;
    void this.switchBed('menu');
  }

  playGame(): void {
    this.unlocked = true;
    if (this.bed !== 'game') {
      this.gameIndex = Math.floor(Math.random() * TRACKS.game.length);
    }
    void this.switchBed('game');
  }

  stop(): void {
    void this.switchBed('none');
  }

  /** Resume after autoplay block or unmute */
  async ensurePlaying(): Promise<void> {
    if (!this.unlocked) return;
    if (this.bed === 'none') {
      await this.switchBed('menu');
      return;
    }
    if (this.audio) {
      if (this.audio.paused) {
        try {
          await this.audio.play();
        } catch {
          return;
        }
      }
      if (!this.ending) void this.fadeTo(this.targetVolume(), FADE_IN_S);
      return;
    }
    await this.startCurrentTrack(true);
  }

  setIntensity(level: number): void {
    this.intensity = Math.max(0.7, Math.min(2, level));
    this.applyTargetVolume(0.15);
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyTargetVolume(0.06);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (!m) void this.ensurePlaying();
    else this.applyTargetVolume(0.04);
  }

  getBpm(): number {
    return 112 + (this.intensity - 1) * 6;
  }

  duck(factor = 0.28, ms = 450): void {
    this.duckFactor = Math.max(0.05, Math.min(1, factor));
    this.duckUntil = performance.now() + ms;
    this.applyTargetVolume(0.05);
    if (this.duckTimer !== null) clearTimeout(this.duckTimer);
    this.duckTimer = window.setTimeout(() => {
      this.duckFactor = 1;
      this.duckUntil = 0;
      this.applyTargetVolume(0.18);
      this.duckTimer = null;
    }, ms + 40);
  }

  private targetVolume(): number {
    if (this.muted || this.bed === 'none') return 0;
    const ducked = performance.now() < this.duckUntil ? this.duckFactor : 1;
    const base = this.bed === 'game' ? 0.55 + this.intensity * 0.06 : 0.52;
    return Math.min(1, base * this.volume * ducked);
  }

  private applyTargetVolume(smoothS: number): void {
    if (!this.audio || this.ending) return;
    void this.fadeTo(this.targetVolume(), smoothS);
  }

  private async switchBed(next: MusicBed): Promise<void> {
    const run = async () => {
      if (next === this.bed && this.audio && !this.audio.paused) {
        void this.fadeTo(this.targetVolume(), 0.2);
        return;
      }
      // Same bed but paused (autoplay blocked) → just resume
      if (next === this.bed && this.audio && this.audio.paused && this.unlocked) {
        try {
          await this.audio.play();
          void this.fadeTo(this.targetVolume(), FADE_IN_S);
          this.armEndWatcher(this.audio);
          return;
        } catch {
          /* fall through to recreate */
        }
      }
      this.bed = next;
      await this.tearDown(true);
      if (next === 'none' || !this.unlocked) return;
      await this.startCurrentTrack(true);
    };
    this.switching = (this.switching ?? Promise.resolve()).then(run, run);
    await this.switching;
  }

  private currentUrl(): string | null {
    if (this.bed === 'menu') return TRACKS.menu;
    if (this.bed === 'game') return TRACKS.game[this.gameIndex % TRACKS.game.length]!;
    return null;
  }

  private async startCurrentTrack(fadeIn: boolean): Promise<void> {
    const url = this.currentUrl();
    if (!url) return;

    const a = this.takeAudio(url);
    a.loop = false;
    a.volume = 0;
    this.audio = a;
    this.ending = false;

    a.addEventListener(
      'ended',
      () => {
        void this.onTrackEnded();
      },
      { once: true },
    );

    try {
      await a.play();
    } catch {
      return;
    }

    // Audible immediately, then finish the short fade
    if (fadeIn) {
      a.volume = Math.min(0.2, this.targetVolume() * 0.35);
      void this.fadeTo(this.targetVolume(), FADE_IN_S);
    } else {
      a.volume = this.targetVolume();
    }

    this.armEndWatcher(a);
  }

  private armEndWatcher(a: HTMLAudioElement): void {
    if (this.watchTimer !== null) {
      clearInterval(this.watchTimer);
      this.watchTimer = null;
    }
    this.watchTimer = window.setInterval(() => {
      if (this.audio !== a || this.ending) return;
      if (!Number.isFinite(a.duration) || a.duration <= 0) return;
      const left = a.duration - a.currentTime;
      if (left <= FADE_OUT_S + 0.05) {
        this.ending = true;
        void this.fadeTo(0, Math.max(0.2, left)).then(() => {
          if (this.audio === a) void this.onTrackEnded();
        });
      }
    }, 100);
  }

  private async onTrackEnded(): Promise<void> {
    if (this.bed === 'none' || this.advancing) return;
    this.advancing = true;
    try {
      await this.tearDown(false);
      if (this.bed === 'game') {
        this.gameIndex = (this.gameIndex + 1) % TRACKS.game.length;
      }
      if (this.bed === 'menu' || this.bed === 'game') {
        await this.startCurrentTrack(true);
      }
    } finally {
      this.advancing = false;
    }
  }

  private async tearDown(fadeOut: boolean): Promise<void> {
    if (this.watchTimer !== null) {
      clearInterval(this.watchTimer);
      this.watchTimer = null;
    }
    const a = this.audio;
    this.audio = null;
    if (!a) return;
    if (fadeOut && a.volume > 0.01 && !a.paused) {
      this.audio = a;
      await this.fadeTo(0, Math.min(0.55, FADE_OUT_S));
      this.audio = null;
    }
    a.pause();
    a.removeAttribute('src');
    try {
      a.load();
    } catch {
      /* ignore */
    }
  }

  private fadeTo(target: number, seconds: number): Promise<void> {
    const a = this.audio;
    if (!a) return Promise.resolve();
    const token = ++this.fadeToken;
    const from = a.volume;
    const dur = Math.max(0.04, seconds) * 1000;
    const t0 = performance.now();

    return new Promise((resolve) => {
      const step = (now: number) => {
        if (token !== this.fadeToken || this.audio !== a) {
          resolve();
          return;
        }
        const t = Math.min(1, (now - t0) / dur);
        const e = t * t * (3 - 2 * t);
        a.volume = Math.max(0, Math.min(1, from + (target - from) * e));
        if (t < 1) requestAnimationFrame(step);
        else {
          a.volume = Math.max(0, Math.min(1, target));
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }
}
